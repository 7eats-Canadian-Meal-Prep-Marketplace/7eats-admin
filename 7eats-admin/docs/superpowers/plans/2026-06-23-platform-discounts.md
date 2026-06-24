# Platform-Wide Discounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-created, platform-funded discounts that apply automatically at checkout across the 7eats marketplace (Uber/DoorDash-style "your next N orders get $X / X% off").

**Architecture:** A new `platform_discounts` table (admin CRUD in the `7eats-admin` repo) is read at order placement in the consumer app (`7eats/my-app`), which automatically applies the single best-for-customer eligible discount, enforces a per-user redemption cap with a Postgres transaction-scoped advisory lock, and records `platform_discount_id` + `platform_discount_amount` on the order. Both repos share one Neon Postgres DB but keep duplicated Drizzle schemas, so the DB change is one hand-written additive SQL migration applied once, mirrored as TS in both repos.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, Neon Postgres (RLS), better-auth, Zod, TypeScript, Biome. Tests via Node's built-in test runner through `tsx`.

## Global Constraints

- **Money rounding:** every monetary value passes through `Math.round(n * 100) / 100` (cents). Copy this exactly.
- **Numeric columns** use Drizzle `numeric(p, s)` and are read/written as **strings** (`String(x.toFixed(2))` on write, `Number.parseFloat` on read).
- **Taxes are disabled** platform-wide via `isTaxCollectionEnabled()` (`calcTax()` returns 0). Do not add tax math; the discount reduces the subtotal directly.
- **Cost model = record-only v1:** customer charge is reduced by the discount; cook payout + platform fee are computed on the **pre-discount** base (cook nominally paid in full). The Stripe `application_fee_amount` is floored at 0; any residual subsidy when the discount exceeds the platform fee is a tracked follow-up, NOT handled here.
- **Best-for-customer selection:** at most ONE platform discount per order — the largest dollar value; tie-break = most recently created. No stacking between platform discounts (but it DOES stack on top of cook `dish_promotions`).
- **Migration is hand-written and additive only.** Never run `drizzle-kit generate` (schemas have drifted; it could emit destructive SQL).
- **No `console.log`** in committed code.
- **Commit messages:** Conventional Commits (`feat:`, `fix:`, `docs:`), no attribution trailer.
- **Admin auth guard** on every admin API route (copy from `app/api/admin/cooks/[cookId]/fee/route.ts`): reject when `session.user.role !== "admin"` with 401.

---

# PHASE A — Admin repo (`F:\Coding_Projects\Personal\7eats-admin\7eats-admin`)

Already on branch `feat/platform-discounts`.

---

### Task A1: Discount schema (Drizzle TS)

**Files:**
- Create: `db/schema/discounts.ts`
- Modify: `db/schema/enums.ts` (append one enum)
- Modify: `db/schema/orders.ts` (add 2 columns + 1 index + import)
- Modify: `db/schema/index.ts` (add export)

**Interfaces:**
- Produces: `platformDiscountType` (pgEnum), `platformDiscounts` (pgTable). `orders.platformDiscountId`, `orders.platformDiscountAmount`.

- [ ] **Step 1: Add the enum**

In `db/schema/enums.ts`, append:

```typescript
export const platformDiscountType = pgEnum("platform_discount_type", [
  "percentage",
  "fixed",
]);
```

- [ ] **Step 2: Create `db/schema/discounts.ts`**

```typescript
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { platformDiscountType } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;

// ─── Platform Discounts ────────────────────────────────────────────────────────
// Admin-created, platform-funded promotions applied automatically at checkout
// across the whole marketplace. Distinct from cook-funded dish_promotions.

export const platformDiscounts = pgTable(
  "platform_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    discountType: platformDiscountType("discount_type").notNull(),
    // percentage: 1–100. fixed: positive dollar amount.
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    // Caps a percentage discount in dollars (e.g. 5% up to $10). Null = uncapped.
    maxDiscountAmount: numeric("max_discount_amount", {
      precision: 10,
      scale: 2,
    }),
    // Order subtotal must reach this to qualify. Null = no minimum.
    minOrderSubtotal: numeric("min_order_subtotal", { precision: 10, scale: 2 }),
    // The "next N orders" per user.
    perUserLimit: integer("per_user_limit").notNull().default(1),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => authUser.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("platform_discounts_value_positive", sql`${t.value} > 0`),
    check(
      "platform_discounts_percentage_max",
      sql`${t.discountType} <> 'percentage' OR ${t.value} <= 100`,
    ),
    check(
      "platform_discounts_max_discount_positive",
      sql`${t.maxDiscountAmount} IS NULL OR ${t.maxDiscountAmount} > 0`,
    ),
    check(
      "platform_discounts_min_subtotal_non_negative",
      sql`${t.minOrderSubtotal} IS NULL OR ${t.minOrderSubtotal} >= 0`,
    ),
    check("platform_discounts_per_user_limit_positive", sql`${t.perUserLimit} >= 1`),
    check(
      "platform_discounts_dates_order",
      sql`${t.startsAt} IS NULL OR ${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`,
    ),
    pgPolicy("platform_discounts_select_public", {
      for: "select",
      to: "public",
      using: sql`
        is_active = TRUE
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      `,
    }),
    pgPolicy("platform_discounts_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("platform_discounts_insert_admin", {
      for: "insert",
      to: "public",
      withCheck: isAdmin,
    }),
    pgPolicy("platform_discounts_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("platform_discounts_delete_admin", {
      for: "delete",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();
```

- [ ] **Step 3: Add columns + index to `db/schema/orders.ts`**

Add the import near the other schema imports at the top:

```typescript
import { platformDiscounts } from "./discounts";
```

Inside the `orders` `pgTable` column object, after the existing `discountAmount` column, add:

```typescript
    // Platform-funded discount applied at checkout (null = none). See discounts.ts.
    platformDiscountId: uuid("platform_discount_id").references(
      () => platformDiscounts.id,
      { onDelete: "set null" },
    ),
    platformDiscountAmount: numeric("platform_discount_amount", {
      precision: 10,
      scale: 2,
    }),
```

In the table's constraints/array callback `(t) => [ ... ]`, add an index (import `index` from `drizzle-orm/pg-core` if not already imported):

```typescript
    index("orders_platform_discount_client_idx").on(
      t.platformDiscountId,
      t.clientId,
    ),
```

- [ ] **Step 4: Export from `db/schema/index.ts`**

Add (keep alphabetical-ish ordering, after `./cooks`):

```typescript
export * from "./discounts";
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `discounts.ts`, `orders.ts`, or `enums.ts`.

- [ ] **Step 6: Commit**

```bash
git add db/schema/discounts.ts db/schema/enums.ts db/schema/orders.ts db/schema/index.ts
git commit -m "feat(db): add platform_discounts schema and order columns"
```

---

### Task A2: Hand-written SQL migration (apply once to shared Neon DB)

**Files:**
- Create: `db/migrations/0001_platform_discounts.sql`

**Interfaces:**
- Produces: the `platform_discount_type` type, `platform_discounts` table, `orders.platform_discount_id` + `orders.platform_discount_amount` columns, the index, and RLS policies — live in the shared Neon database used by BOTH repos.

- [ ] **Step 1: Write the migration file**

Create `db/migrations/0001_platform_discounts.sql`:

```sql
-- Platform-wide discounts. Additive-only. Safe to run once against the shared DB.

CREATE TYPE platform_discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE platform_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  description text,
  discount_type platform_discount_type NOT NULL,
  value numeric(10, 2) NOT NULL,
  max_discount_amount numeric(10, 2),
  min_order_subtotal numeric(10, 2),
  per_user_limit integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES auth_user (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_discounts_value_positive CHECK (value > 0),
  CONSTRAINT platform_discounts_percentage_max
    CHECK (discount_type <> 'percentage' OR value <= 100),
  CONSTRAINT platform_discounts_max_discount_positive
    CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  CONSTRAINT platform_discounts_min_subtotal_non_negative
    CHECK (min_order_subtotal IS NULL OR min_order_subtotal >= 0),
  CONSTRAINT platform_discounts_per_user_limit_positive CHECK (per_user_limit >= 1),
  CONSTRAINT platform_discounts_dates_order
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE platform_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_discounts_select_public ON platform_discounts
  FOR SELECT TO public
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );
CREATE POLICY platform_discounts_select_admin ON platform_discounts
  FOR SELECT TO public USING (auth.role() = 'admin');
CREATE POLICY platform_discounts_insert_admin ON platform_discounts
  FOR INSERT TO public WITH CHECK (auth.role() = 'admin');
CREATE POLICY platform_discounts_update_admin ON platform_discounts
  FOR UPDATE TO public USING (auth.role() = 'admin');
CREATE POLICY platform_discounts_delete_admin ON platform_discounts
  FOR DELETE TO public USING (auth.role() = 'admin');

ALTER TABLE orders
  ADD COLUMN platform_discount_id uuid REFERENCES platform_discounts (id) ON DELETE SET NULL,
  ADD COLUMN platform_discount_amount numeric(10, 2);

CREATE INDEX orders_platform_discount_client_idx
  ON orders (platform_discount_id, client_id);
```

- [ ] **Step 2: Apply to the shared DB**

The admin repo has `DATABASE_URL` in `.env.local`. Run:

```bash
npx tsx -e "import 'dotenv/config'; import { neon } from '@neondatabase/serverless'; import { readFileSync } from 'node:fs'; const sql = neon(process.env.DATABASE_URL); const text = readFileSync('db/migrations/0001_platform_discounts.sql','utf8'); for (const stmt of text.split(/;\s*\n/).map(s=>s.trim()).filter(Boolean)) { await sql.query(stmt); } console.error('migration applied');"
```

Expected output: `migration applied` with no error. (`dotenv` is transitively available; if the import fails, prefix the command with the URL: `DATABASE_URL="<value from .env.local>" npx tsx -e "..."` and drop the `dotenv/config` import.)

- [ ] **Step 3: Verify the table exists**

```bash
npx tsx -e "import { neon } from '@neondatabase/serverless'; const sql = neon(process.env.DATABASE_URL); const r = await sql.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='platform_discounts' ORDER BY 1\"); console.error(r.map(x=>x.column_name).join(', '));"
```
Expected: a comma list including `per_user_limit`, `discount_type`, `min_order_subtotal`, etc. (Use the same `DATABASE_URL` fallback as Step 2 if needed.)

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0001_platform_discounts.sql
git commit -m "feat(db): hand-written platform_discounts migration"
```

---

### Task A3: Validation schema + status helper (pure, tested)

**Files:**
- Create: `lib/discounts/schema.ts`
- Create: `lib/discounts/status.ts`
- Create: `lib/discounts/status.test.ts`

**Interfaces:**
- Produces:
  - `discountInputSchema` (Zod) — validates create/edit payloads; `DiscountInput = z.infer<typeof discountInputSchema>`.
  - `discountStatus(d: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now: Date): "active" | "scheduled" | "expired" | "inactive"`.

- [ ] **Step 1: Write the failing test for `discountStatus`**

Create `lib/discounts/status.test.ts`:

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";
import { discountStatus } from "./status";

const now = new Date("2026-06-23T12:00:00Z");

test("inactive overrides everything", () => {
  assert.equal(
    discountStatus({ isActive: false, startsAt: null, endsAt: null }, now),
    "inactive",
  );
});

test("active when in window and no bounds", () => {
  assert.equal(
    discountStatus({ isActive: true, startsAt: null, endsAt: null }, now),
    "active",
  );
});

test("scheduled when startsAt is in the future", () => {
  assert.equal(
    discountStatus(
      { isActive: true, startsAt: new Date("2026-07-01T00:00:00Z"), endsAt: null },
      now,
    ),
    "scheduled",
  );
});

test("expired when endsAt has passed", () => {
  assert.equal(
    discountStatus(
      { isActive: true, startsAt: null, endsAt: new Date("2026-06-01T00:00:00Z") },
      now,
    ),
    "expired",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test lib/discounts/status.test.ts`
Expected: FAIL — cannot find module `./status`.
(If `tsx --test` is unsupported, use `node --import tsx/esm --test lib/discounts/status.test.ts`.)

- [ ] **Step 3: Implement `lib/discounts/status.ts`**

```typescript
export type DiscountStatus = "active" | "scheduled" | "expired" | "inactive";

export function discountStatus(
  d: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): DiscountStatus {
  if (!d.isActive) return "inactive";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  if (d.endsAt && d.endsAt <= now) return "expired";
  return "active";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test lib/discounts/status.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement `lib/discounts/schema.ts`**

```typescript
import { z } from "zod";

const money = z
  .number()
  .positive()
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
    "At most 2 decimal places",
  );

export const discountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    discountType: z.enum(["percentage", "fixed"]),
    value: money,
    maxDiscountAmount: money.optional().nullable(),
    minOrderSubtotal: z
      .number()
      .nonnegative()
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
        "At most 2 decimal places",
      )
      .optional()
      .nullable(),
    perUserLimit: z.number().int().min(1).max(1000),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.discountType !== "percentage" || d.value <= 100, {
    message: "Percentage discount cannot exceed 100",
    path: ["value"],
  })
  .refine((d) => !(d.startsAt && d.endsAt) || d.endsAt > d.startsAt, {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export type DiscountInput = z.infer<typeof discountInputSchema>;
```

- [ ] **Step 6: Commit**

```bash
git add lib/discounts/schema.ts lib/discounts/status.ts lib/discounts/status.test.ts
git commit -m "feat(discounts): validation schema and status helper"
```

---

### Task A4: Admin API routes

**Files:**
- Create: `app/api/admin/discounts/route.ts` (GET list, POST create)
- Create: `app/api/admin/discounts/[id]/route.ts` (PATCH update, DELETE)
- Reference (read for the auth pattern): `app/api/admin/cooks/[cookId]/fee/route.ts`

**Interfaces:**
- Consumes: `discountInputSchema` / `DiscountInput` from Task A3, `platformDiscounts` from Task A1, `db` from `@/db`, `auth` from `@/lib/auth`.
- Produces: REST endpoints. POST returns `{ id }`. PATCH returns `{ ok: true }`. DELETE returns `{ ok: true }` or 409 when referenced by orders.

- [ ] **Step 1: Create `app/api/admin/discounts/route.ts`**

```typescript
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { auth } from "@/lib/auth";
import { discountInputSchema } from "@/lib/discounts/schema";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return null;
  }
  return session;
}

function toNumericString(n: number | null | undefined): string | null {
  return n == null ? null : String(n.toFixed(2));
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(platformDiscounts)
    .orderBy(desc(platformDiscounts.createdAt));
  return NextResponse.json({ discounts: rows });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = discountInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const [created] = await db
    .insert(platformDiscounts)
    .values({
      name: d.name,
      description: d.description ?? null,
      discountType: d.discountType,
      value: String(d.value.toFixed(2)),
      maxDiscountAmount: toNumericString(d.maxDiscountAmount),
      minOrderSubtotal: toNumericString(d.minOrderSubtotal),
      perUserLimit: d.perUserLimit,
      startsAt: d.startsAt ?? null,
      endsAt: d.endsAt ?? null,
      isActive: d.isActive,
      createdBy: session.user.id,
    })
    .returning({ id: platformDiscounts.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/admin/discounts/[id]/route.ts`**

```typescript
import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { orders } from "@/db/schema/orders";
import { auth } from "@/lib/auth";
import { discountInputSchema } from "@/lib/discounts/schema";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return null;
  }
  return session;
}

function toNumericString(n: number | null | undefined): string | null {
  return n == null ? null : String(n.toFixed(2));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = discountInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const result = await db
    .update(platformDiscounts)
    .set({
      name: d.name,
      description: d.description ?? null,
      discountType: d.discountType,
      value: String(d.value.toFixed(2)),
      maxDiscountAmount: toNumericString(d.maxDiscountAmount),
      minOrderSubtotal: toNumericString(d.minOrderSubtotal),
      perUserLimit: d.perUserLimit,
      startsAt: d.startsAt ?? null,
      endsAt: d.endsAt ?? null,
      isActive: d.isActive,
    })
    .where(eq(platformDiscounts.id, id))
    .returning({ id: platformDiscounts.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [{ used }] = await db
    .select({ used: count() })
    .from(orders)
    .where(eq(orders.platformDiscountId, id));
  if (Number(used) > 0) {
    return NextResponse.json(
      { error: "Discount is referenced by orders; deactivate it instead." },
      { status: 409 },
    );
  }
  await db.delete(platformDiscounts).where(eq(platformDiscounts.id, id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in the two new route files.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/discounts
git commit -m "feat(api): admin CRUD routes for platform discounts"
```

---

### Task A5: Admin list page + sidebar nav

**Files:**
- Create: `app/admin/discounts/page.tsx` (server component)
- Create: `app/admin/discounts/DiscountsClient.tsx` (client component)
- Create: `app/admin/discounts/discounts.module.css`
- Modify: `app/admin/Sidebar.tsx` (add nav item)
- Reference (read for table/list conventions): `app/admin/cooks/CooksClient.tsx`, `app/admin/reviews/ReviewsClient.tsx`

**Interfaces:**
- Consumes: `platformDiscounts` (Task A1), `discountStatus` (Task A3), `getAdminSession` from `@/lib/session`.
- Produces: the `/admin/discounts` route rendering a list with status badges and per-discount redemption counts, plus a "New discount" button that opens the form from Task A6 (the form is added in A6; in A5 wire the button to a placeholder `onCreate` no-op that A6 replaces).

- [ ] **Step 1: Add the sidebar nav item**

In `app/admin/Sidebar.tsx`, import a `Tag` icon from `lucide-react` (add to the existing import list) and add to `NAV_ITEMS` after the Orders entry:

```typescript
  { href: "/admin/discounts", label: "Discounts", icon: Tag },
```

- [ ] **Step 2: Create the server page `app/admin/discounts/page.tsx`**

```tsx
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { orders } from "@/db/schema/orders";
import { getAdminSession } from "@/lib/session";
import { DiscountsClient } from "./DiscountsClient";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await getAdminSession();

  const rows = await db
    .select({
      id: platformDiscounts.id,
      name: platformDiscounts.name,
      description: platformDiscounts.description,
      discountType: platformDiscounts.discountType,
      value: platformDiscounts.value,
      maxDiscountAmount: platformDiscounts.maxDiscountAmount,
      minOrderSubtotal: platformDiscounts.minOrderSubtotal,
      perUserLimit: platformDiscounts.perUserLimit,
      startsAt: platformDiscounts.startsAt,
      endsAt: platformDiscounts.endsAt,
      isActive: platformDiscounts.isActive,
      redemptions: sql<number>`(
        SELECT count(*) FROM ${orders}
        WHERE ${orders.platformDiscountId} = ${platformDiscounts.id}
          AND ${orders.status} <> 'cancelled'
      )`,
    })
    .from(platformDiscounts)
    .orderBy(desc(platformDiscounts.createdAt));

  return <DiscountsClient initialDiscounts={rows} />;
}
```

- [ ] **Step 3: Create `app/admin/discounts/DiscountsClient.tsx`**

```tsx
"use client";

import { Tag } from "lucide-react";
import { useState } from "react";
import { discountStatus } from "@/lib/discounts/status";
import styles from "./discounts.module.css";

export type DiscountRow = {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  value: string;
  maxDiscountAmount: string | null;
  minOrderSubtotal: string | null;
  perUserLimit: number;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  isActive: boolean;
  redemptions: number;
};

function toDate(v: string | Date | null): Date | null {
  return v == null ? null : v instanceof Date ? v : new Date(v);
}

function formatValue(d: DiscountRow): string {
  return d.discountType === "percentage"
    ? `${Number.parseFloat(d.value)}% off`
    : `$${Number.parseFloat(d.value).toFixed(2)} off`;
}

function formatWindow(d: DiscountRow): string {
  const s = toDate(d.startsAt);
  const e = toDate(d.endsAt);
  const fmt = (x: Date) => x.toLocaleDateString("en-CA");
  if (!s && !e) return "Always";
  if (s && e) return `${fmt(s)} – ${fmt(e)}`;
  if (s) return `From ${fmt(s)}`;
  return `Until ${fmt(e as Date)}`;
}

export function DiscountsClient({
  initialDiscounts,
}: {
  initialDiscounts: DiscountRow[];
}) {
  const [discounts] = useState<DiscountRow[]>(initialDiscounts);
  const now = new Date();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Tag size={20} strokeWidth={2} /> Discounts
          </h1>
          <p className={styles.subtitle}>
            Platform-funded promotions applied automatically at checkout.
          </p>
        </div>
        {/* A6 replaces this button with the create-form trigger. */}
        <button type="button" className={styles.newBtn}>
          New discount
        </button>
      </header>

      {discounts.length === 0 ? (
        <p className={styles.empty}>No discounts yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Discount</th>
              <th>Window</th>
              <th>Per user</th>
              <th>Redemptions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => {
              const status = discountStatus(
                {
                  isActive: d.isActive,
                  startsAt: toDate(d.startsAt),
                  endsAt: toDate(d.endsAt),
                },
                now,
              );
              return (
                <tr key={d.id}>
                  <td>
                    <div className={styles.name}>{d.name}</div>
                    {d.description && (
                      <div className={styles.desc}>{d.description}</div>
                    )}
                  </td>
                  <td>{formatValue(d)}</td>
                  <td>{formatWindow(d)}</td>
                  <td>{d.perUserLimit}</td>
                  <td>{d.redemptions}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[status]}`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/admin/discounts/discounts.module.css`**

```css
.page { display: flex; flex-direction: column; gap: 1.5rem; }
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.title { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; font-weight: 700; }
.subtitle { color: var(--muted, #6b7280); margin-top: 0.25rem; }
.newBtn { background: #111827; color: #fff; border: none; border-radius: 0.5rem; padding: 0.6rem 1rem; font-weight: 600; cursor: pointer; }
.newBtn:hover { background: #1f2937; }
.empty { color: var(--muted, #6b7280); }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
.name { font-weight: 600; }
.desc { color: #6b7280; font-size: 0.85rem; margin-top: 0.2rem; max-width: 32ch; }
.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
.active { background: #dcfce7; color: #166534; }
.scheduled { background: #dbeafe; color: #1e40af; }
.expired { background: #f3f4f6; color: #4b5563; }
.inactive { background: #fee2e2; color: #991b1b; }
```

- [ ] **Step 5: Verify it builds & renders**

Run: `npx tsc --noEmit`
Expected: no errors.
Then run `npm run dev`, log in as admin, visit `/admin/discounts`. Expected: empty-state or list renders, "Discounts" appears in the sidebar.

- [ ] **Step 6: Commit**

```bash
git add app/admin/discounts app/admin/Sidebar.tsx
git commit -m "feat(admin): platform discounts list page and nav"
```

---

### Task A6: Create/edit discount form

**Files:**
- Create: `app/admin/discounts/DiscountForm.tsx` (client form, uses existing `Modal`)
- Modify: `app/admin/discounts/DiscountsClient.tsx` (wire New + Edit/Delete + refresh)
- Reference (read for modal usage): `app/admin/Modal.tsx`, and an existing form-in-modal such as the cook fee edit UI in `app/admin/cooks/[cookId]/CookDetailTabs.tsx`

**Interfaces:**
- Consumes: `DiscountInput` shape (Task A3) via the POST/PATCH endpoints (Task A4), `Modal` from `@/app/admin/Modal`, `toast` from `sonner`.
- Produces: `DiscountForm` that submits to `POST /api/admin/discounts` (create) or `PATCH /api/admin/discounts/[id]` (edit) and calls `onSaved()` on success.

- [ ] **Step 1: Read `app/admin/Modal.tsx`** to confirm its prop names (`open`, `onClose`, `title`, children). Adapt the JSX below if the props differ.

- [ ] **Step 2: Create `app/admin/discounts/DiscountForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import styles from "./discounts.module.css";
import type { DiscountRow } from "./DiscountsClient";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: DiscountRow | null;
};

function dateInputValue(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export function DiscountForm({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    existing?.discountType ?? "fixed",
  );
  const [value, setValue] = useState(existing ? existing.value : "");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    existing?.maxDiscountAmount ?? "",
  );
  const [minOrderSubtotal, setMinOrderSubtotal] = useState(
    existing?.minOrderSubtotal ?? "",
  );
  const [perUserLimit, setPerUserLimit] = useState(
    String(existing?.perUserLimit ?? 1),
  );
  const [startsAt, setStartsAt] = useState(dateInputValue(existing?.startsAt));
  const [endsAt, setEndsAt] = useState(dateInputValue(existing?.endsAt));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      discountType,
      value: Number.parseFloat(value),
      maxDiscountAmount:
        discountType === "percentage" && maxDiscountAmount
          ? Number.parseFloat(maxDiscountAmount)
          : null,
      minOrderSubtotal: minOrderSubtotal
        ? Number.parseFloat(minOrderSubtotal)
        : null,
      perUserLimit: Number.parseInt(perUserLimit, 10),
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isActive,
    };
    const url = existing
      ? `/api/admin/discounts/${existing.id}`
      : "/api/admin/discounts";
    const method = existing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Failed to save discount");
        return;
      }
      toast.success(existing ? "Discount updated" : "Discount created");
      onSaved();
      onClose();
    } catch {
      toast.error("Network error saving discount");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit discount" : "New discount"}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Type</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
            >
              <option value="fixed">$ off</option>
              <option value="percentage">% off</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>{discountType === "percentage" ? "Percent" : "Amount ($)"}</span>
            <input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
        </div>
        {discountType === "percentage" && (
          <label className={styles.field}>
            <span>Max discount cap ($, optional)</span>
            <input type="number" step="0.01" min="0" value={maxDiscountAmount} onChange={(e) => setMaxDiscountAmount(e.target.value)} />
          </label>
        )}
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Min order subtotal ($, optional)</span>
            <input type="number" step="0.01" min="0" value={minOrderSubtotal} onChange={(e) => setMinOrderSubtotal(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Per-user limit</span>
            <input type="number" min="1" step="1" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} required />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Starts at (optional)</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Ends at (optional)</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Active</span>
        </label>
        <div className={styles.formActions}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
          <button type="submit" disabled={saving} className={styles.newBtn}>
            {saving ? "Saving…" : existing ? "Save changes" : "Create discount"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Append form styles to `app/admin/discounts/discounts.module.css`**

```css
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; flex: 1; }
.field input, .field select, .field textarea { padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.4rem; font: inherit; }
.row { display: flex; gap: 1rem; }
.checkboxField { display: flex; align-items: center; gap: 0.5rem; }
.formActions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
.cancelBtn { background: #fff; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.6rem 1rem; font-weight: 600; cursor: pointer; }
.editBtn { background: none; border: none; color: #2563eb; cursor: pointer; font-weight: 600; }
.deleteBtn { background: none; border: none; color: #dc2626; cursor: pointer; font-weight: 600; }
.actionsCell { display: flex; gap: 0.75rem; }
```

- [ ] **Step 4: Wire actions into `DiscountsClient.tsx`**

Replace `const [discounts] = useState(...)` with stateful create/edit/delete handling and a router refresh. Specifically:
- Import `useRouter` from `next/navigation`, `toast` from `sonner`, and `DiscountForm` from `./DiscountForm`.
- Add state: `const [formOpen, setFormOpen] = useState(false);` and `const [editing, setEditing] = useState<DiscountRow | null>(null);` and `const router = useRouter();`.
- Change the "New discount" button to `onClick={() => { setEditing(null); setFormOpen(true); }}`.
- Add an "Actions" column with Edit (`onClick={() => { setEditing(d); setFormOpen(true); }}`) and Delete buttons using the `actionsCell`/`editBtn`/`deleteBtn` classes.
- Delete handler:

```tsx
  async function handleDelete(d: DiscountRow) {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/discounts/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Could not delete");
      return;
    }
    toast.success("Discount deleted");
    router.refresh();
  }
```

- Render at the end of the component, before the closing `</div>`:

```tsx
      {formOpen && (
        <DiscountForm
          open={formOpen}
          existing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, go to `/admin/discounts`:
1. Create a `$5 off`, per-user limit 5 discount → appears in the list, status "active".
2. Edit it → change to `10% off`, max cap `$8` → list updates.
3. Delete it (no orders reference it) → row disappears.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npm run lint
npx tsc --noEmit
git add app/admin/discounts
git commit -m "feat(admin): create/edit/delete discount form"
```

---

# PHASE B — Consumer repo (`F:\Coding_Projects\Personal\7eats\my-app`)

All Phase B commands run with cwd `F:\Coding_Projects\Personal\7eats`.

---

### Task B1: Pull staging and branch

**Files:** none (git only).

- [ ] **Step 1: Fetch and check out latest staging**

```bash
git -C F:/Coding_Projects/Personal/7eats fetch origin
git -C F:/Coding_Projects/Personal/7eats checkout staging
git -C F:/Coding_Projects/Personal/7eats pull --ff-only origin staging
```
Expected: staging is up to date / fast-forwarded. If there are uncommitted local changes blocking checkout, STOP and report.

- [ ] **Step 2: Create the feature branch**

```bash
git -C F:/Coding_Projects/Personal/7eats checkout -b feat/platform-discounts
```
Expected: `Switched to a new branch 'feat/platform-discounts'`.

---

### Task B2: Mirror schema in the consumer repo

**Files:**
- Create: `my-app/db/schema/discounts.ts`
- Modify: `my-app/db/schema/enums.ts` (append enum)
- Modify: `my-app/db/schema/orders.ts` (add 2 columns + index + import)
- Modify: `my-app/db/schema/index.ts` (add export)

No migration here — Task A2 already applied the DDL to the shared DB.

- [ ] **Step 1: Append the enum** to `my-app/db/schema/enums.ts`:

```typescript
export const platformDiscountType = pgEnum("platform_discount_type", [
  "percentage",
  "fixed",
]);
```

- [ ] **Step 2: Create `my-app/db/schema/discounts.ts`**

Use the SAME content as admin Task A1 Step 2 (the `platformDiscounts` table + RLS policies). The imports (`authUser` from `./auth`, `platformDiscountType` from `./enums`) match this repo's layout — verify those files exist and export those names; adjust the import path only if needed.

- [ ] **Step 3: Add columns + index to `my-app/db/schema/orders.ts`**

Add import: `import { platformDiscounts } from "./discounts";`
After the deprecated `discountAmount` column, add the same two columns as admin Task A1 Step 3 (`platformDiscountId`, `platformDiscountAmount`). In the constraints array add the `orders_platform_discount_client_idx` index (import `index` from `drizzle-orm/pg-core` if missing).

- [ ] **Step 4: Export** from `my-app/db/schema/index.ts`: add `export * from "./discounts";`.

- [ ] **Step 5: Typecheck**

Run: `npm --prefix my-app run build` is heavy; instead `npx --prefix my-app tsc --noEmit` (or `cd my-app && npx tsc --noEmit`).
Expected: no new schema errors.

- [ ] **Step 6: Commit**

```bash
git -C F:/Coding_Projects/Personal/7eats add my-app/db/schema/discounts.ts my-app/db/schema/enums.ts my-app/db/schema/orders.ts my-app/db/schema/index.ts
git -C F:/Coding_Projects/Personal/7eats commit -m "feat(db): mirror platform_discounts schema in consumer app"
```

---

### Task B3: Pure discount selection module (+ tests)

**Files:**
- Create: `my-app/lib/orders/platform-discount.ts`
- Create: `my-app/lib/orders/platform-discount.test.ts`

**Interfaces:**
- Produces:
  - `type PlatformDiscountRow = { id: string; discountType: "percentage" | "fixed"; value: number; maxDiscountAmount: number | null; minOrderSubtotal: number | null; perUserLimit: number; createdAt: Date }`
  - `computeDiscountValue(d: PlatformDiscountRow, subtotal: number): number`
  - `orderCandidatesByValue(discounts: PlatformDiscountRow[], subtotal: number): Array<{ discount: PlatformDiscountRow; amount: number }>` (best-first, amount>0 only)

- [ ] **Step 1: Write the failing test** `my-app/lib/orders/platform-discount.test.ts`:

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeDiscountValue,
  orderCandidatesByValue,
  type PlatformDiscountRow,
} from "./platform-discount";

function mk(p: Partial<PlatformDiscountRow>): PlatformDiscountRow {
  return {
    id: "x",
    discountType: "fixed",
    value: 5,
    maxDiscountAmount: null,
    minOrderSubtotal: null,
    perUserLimit: 1,
    createdAt: new Date("2026-01-01"),
    ...p,
  };
}

test("fixed discount is capped at subtotal", () => {
  assert.equal(computeDiscountValue(mk({ value: 5 }), 30), 5);
  assert.equal(computeDiscountValue(mk({ value: 50 }), 30), 30);
});

test("percentage discount", () => {
  assert.equal(
    computeDiscountValue(mk({ discountType: "percentage", value: 10 }), 30),
    3,
  );
});

test("percentage respects max cap", () => {
  assert.equal(
    computeDiscountValue(
      mk({ discountType: "percentage", value: 50, maxDiscountAmount: 8 }),
      30,
    ),
    8,
  );
});

test("below min subtotal yields zero", () => {
  assert.equal(
    computeDiscountValue(mk({ value: 5, minOrderSubtotal: 25 }), 20),
    0,
  );
});

test("orders candidates best-first, drops zero", () => {
  const a = mk({ id: "a", value: 5 });
  const b = mk({ id: "b", discountType: "percentage", value: 50 }); // $15 on 30
  const c = mk({ id: "c", value: 5, minOrderSubtotal: 999 }); // 0 → dropped
  const out = orderCandidatesByValue([a, b, c], 30);
  assert.deepEqual(
    out.map((x) => x.discount.id),
    ["b", "a"],
  );
});

test("tie-break prefers most recently created", () => {
  const older = mk({ id: "old", value: 5, createdAt: new Date("2026-01-01") });
  const newer = mk({ id: "new", value: 5, createdAt: new Date("2026-02-01") });
  const out = orderCandidatesByValue([older, newer], 30);
  assert.equal(out[0].discount.id, "new");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd my-app && npx tsx --test lib/orders/platform-discount.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `my-app/lib/orders/platform-discount.ts`**

```typescript
export type PlatformDiscountRow = {
  id: string;
  discountType: "percentage" | "fixed";
  value: number;
  maxDiscountAmount: number | null;
  minOrderSubtotal: number | null;
  perUserLimit: number;
  createdAt: Date;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dollar value of a discount for a given subtotal. 0 if it does not qualify. */
export function computeDiscountValue(
  d: PlatformDiscountRow,
  subtotal: number,
): number {
  if (d.minOrderSubtotal != null && subtotal < d.minOrderSubtotal) return 0;
  if (subtotal <= 0) return 0;
  if (d.discountType === "fixed") return round2(Math.min(d.value, subtotal));
  const raw = (subtotal * d.value) / 100;
  const capped = d.maxDiscountAmount != null ? Math.min(raw, d.maxDiscountAmount) : raw;
  return round2(Math.min(capped, subtotal));
}

/** Candidates with a positive dollar value, best-first; tie-break newest. */
export function orderCandidatesByValue(
  discounts: PlatformDiscountRow[],
  subtotal: number,
): Array<{ discount: PlatformDiscountRow; amount: number }> {
  return discounts
    .map((d) => ({ discount: d, amount: computeDiscountValue(d, subtotal) }))
    .filter((c) => c.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        b.discount.createdAt.getTime() - a.discount.createdAt.getTime(),
    );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd my-app && npx tsx --test lib/orders/platform-discount.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git -C F:/Coding_Projects/Personal/7eats add my-app/lib/orders/platform-discount.ts my-app/lib/orders/platform-discount.test.ts
git -C F:/Coding_Projects/Personal/7eats commit -m "feat(discounts): pure platform-discount selection logic"
```

---

### Task B4: Apply discount at order placement (advisory lock + pricing)

**Files:**
- Modify: `my-app/lib/order-totals.ts` (`computeOrderChargeBreakdown` — add `platformDiscount` param)
- Modify: `my-app/lib/orders/platform-discount.ts` (add `fetchActiveDiscounts` + `resolvePlatformDiscount`)
- Modify: `my-app/lib/orders/place-order.ts` (wire it into the placement transaction)
- Reference: read the CURRENT `place-order.ts` end-to-end first — the snippets below must be adapted to the exact variable names/flow on staging.

**Interfaces:**
- Consumes: `orderCandidatesByValue`, `PlatformDiscountRow` (Task B3), `platformDiscounts`, `orders` schema (Task B2).
- Produces: `fetchActiveDiscounts(dbClient): Promise<PlatformDiscountRow[]>`, `resolvePlatformDiscount(tx, userId, candidates): Promise<{ discountId: string; amount: number } | null>`, and an extended `computeOrderChargeBreakdown` accepting `platformDiscount?: number`.

- [ ] **Step 1: Extend `computeOrderChargeBreakdown`**

In `my-app/lib/order-totals.ts`, change the signature and body so the discount reduces the customer total while the platform fee + cook payout stay on the pre-discount base, and the Stripe application fee floors at 0:

```typescript
export function computeOrderChargeBreakdown(params: {
  subtotal: number;
  deliveryFee: number;
  taxProvince: string | null | undefined;
  platformFeePct: number;
  platformDiscount?: number; // NEW — dollars, default 0
}): OrderChargeBreakdown {
  const platformDiscount = Math.max(0, params.platformDiscount ?? 0);
  const taxProvince = (params.taxProvince ?? "ON").trim().toUpperCase().slice(0, 2);

  // Pre-discount base drives platform fee + cook payout (record-only v1).
  const preDiscountBase =
    Math.round((params.subtotal + params.deliveryFee) * 100) / 100;
  // Customer pays the discounted base. Tax is 0 while collection is disabled.
  const taxableBase = Math.round((preDiscountBase - platformDiscount) * 100) / 100;
  const taxAmount = Math.round(calcTax(taxableBase, taxProvince) * 100) / 100;
  const totalPrice = Math.round((taxableBase + taxAmount) * 100) / 100;

  const totalCents = Math.round(totalPrice * 100);
  const preDiscountBaseCents = Math.round(preDiscountBase * 100);
  const platformFeeCents = Math.round(
    (preDiscountBaseCents * params.platformFeePct) / 100,
  );
  const taxCents = Math.round(taxAmount * 100);
  const discountCents = Math.round(platformDiscount * 100);
  // Platform absorbs the discount out of its own fee; never negative.
  const applicationFeeCents = Math.max(
    0,
    platformFeeCents + taxCents - discountCents,
  );
  const cookPayoutCents = totalCents - applicationFeeCents;

  return {
    taxableBase,
    taxProvince,
    taxAmount,
    totalPrice,
    totalCents,
    platformFeeCents,
    taxCents,
    applicationFeeCents,
    cookPayoutCents,
  };
}
```

(No `OrderChargeBreakdown` type change needed — fields are unchanged.)

- [ ] **Step 2: Add DB helpers to `my-app/lib/orders/platform-discount.ts`**

Append:

```typescript
import { and, count, eq, lte, gt, isNull, or, ne, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import { orders } from "@/db/schema/orders";
import { platformDiscounts } from "@/db/schema/discounts";

type AnyDb = typeof defaultDb;

/** Active, in-window discounts, parsed into PlatformDiscountRow. */
export async function fetchActiveDiscounts(
  dbClient: AnyDb = defaultDb,
): Promise<PlatformDiscountRow[]> {
  const rows = await dbClient
    .select()
    .from(platformDiscounts)
    .where(
      and(
        eq(platformDiscounts.isActive, true),
        or(isNull(platformDiscounts.startsAt), lte(platformDiscounts.startsAt, sql`now()`)),
        or(isNull(platformDiscounts.endsAt), gt(platformDiscounts.endsAt, sql`now()`)),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    discountType: r.discountType,
    value: Number.parseFloat(r.value),
    maxDiscountAmount: r.maxDiscountAmount == null ? null : Number.parseFloat(r.maxDiscountAmount),
    minOrderSubtotal: r.minOrderSubtotal == null ? null : Number.parseFloat(r.minOrderSubtotal),
    perUserLimit: r.perUserLimit,
    createdAt: r.createdAt,
  }));
}

/**
 * Pick the first best-first candidate the user is still entitled to, under a
 * transaction-scoped advisory lock keyed on (discount, user). MUST be called
 * inside a dbPool.transaction so the lock + count share one session.
 */
export async function resolvePlatformDiscount(
  tx: { execute: AnyDb["execute"]; select: AnyDb["select"] },
  userId: string,
  candidates: Array<{ discount: PlatformDiscountRow; amount: number }>,
): Promise<{ discountId: string; amount: number } | null> {
  for (const cand of candidates) {
    const key = `pd:${cand.discount.id}:${userId}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const [{ used }] = await tx
      .select({ used: count() })
      .from(orders)
      .where(
        and(
          eq(orders.platformDiscountId, cand.discount.id),
          eq(orders.clientId, userId),
          ne(orders.status, "cancelled"),
        ),
      );
    if (Number(used) < cand.discount.perUserLimit) {
      return { discountId: cand.discount.id, amount: cand.amount };
    }
  }
  return null;
}
```

(If `@/db` exports `db` as a different name, adjust. The `tx` passed in at the call site is the Drizzle transaction object, which has both `.execute` and `.select`.)

- [ ] **Step 3: Wire into `place-order.ts`**

Read the current file. Then make these changes (adapt names to the actual code):

1. Near the top imports add:
   ```typescript
   import {
     fetchActiveDiscounts,
     orderCandidatesByValue,
     resolvePlatformDiscount,
   } from "./platform-discount";
   ```
2. After `subtotal` is fully computed (≈ line 246) and BEFORE the Stripe PaymentIntent is created, fetch + rank candidates (pure, no per-user check yet):
   ```typescript
   const activeDiscounts = await fetchActiveDiscounts();
   const discountCandidates = orderCandidatesByValue(activeDiscounts, subtotal);
   ```
3. The per-user check, the charge computation, the PaymentIntent creation, and the inserts must all reflect ONE locked decision. Restructure so that **inside `dbPool.transaction(async (tx) => { ... })`**, the FIRST step resolves the discount under the advisory lock:
   ```typescript
   const resolved = await resolvePlatformDiscount(tx, client.id, discountCandidates);
   const platformDiscount = resolved?.amount ?? 0;
   const charges = computeOrderChargeBreakdown({
     subtotal,
     deliveryFee: deliveryFeeSnapshot,
     taxProvince: cook.pickupProvince,
     platformFeePct,
     platformDiscount,
   });
   ```
   If the Stripe PaymentIntent is currently created OUTSIDE the transaction, move its creation to AFTER this `charges` computation (it can remain inside the transaction; the call is short and the advisory lock only contends the same user+discount). Create the PI with `amount: charges.totalCents` and `application_fee_amount: charges.applicationFeeCents`.
4. In the `tx.insert(orders).values({ ... })` object, add:
   ```typescript
       platformDiscountId: resolved?.discountId ?? null,
       platformDiscountAmount:
         platformDiscount > 0 ? String(platformDiscount.toFixed(2)) : null,
   ```
5. Leave `orderPayments` storing the pre-discount nominal `platformFeeAmount`/`cookPayoutAmount` from `charges` (record-only v1) and `totalAmount: String(charges.totalPrice.toFixed(2))`.

- [ ] **Step 4: Typecheck**

Run: `cd my-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual end-to-end check**

With an active "$5 off, per-user limit 1" discount (create it from the admin panel against the same DB):
1. Place an order with subtotal ≥ $5 as a client → order's `platform_discount_id`/`platform_discount_amount` are set, customer total reduced by $5.
2. Place a SECOND order as the same client → no discount applied (limit reached).
Verify via:
```bash
cd my-app && npx tsx -e "import { db } from './db'; import { orders } from './db/schema/orders'; import { desc } from 'drizzle-orm'; const r = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(2); console.error(r.map(o=>({t:o.totalPrice,d:o.platformDiscountAmount,id:o.platformDiscountId})));"
```
Expected: newest order has null discount, the prior has `5.00`.

- [ ] **Step 6: Commit**

```bash
git -C F:/Coding_Projects/Personal/7eats add my-app/lib/order-totals.ts my-app/lib/orders/platform-discount.ts my-app/lib/orders/place-order.ts
git -C F:/Coding_Projects/Personal/7eats commit -m "feat(orders): apply best platform discount with per-user advisory lock"
```

---

### Task B5: Checkout preview + summary line

**Files:**
- Create: `my-app/app/api/discounts/preview/route.ts` (authenticated best-discount preview)
- Modify: `my-app/app/app/checkout/page.tsx` (fetch preview, render discount line, subtract from total)
- Reference: read the current checkout summary block (≈ lines 900–963) and the `tax`/`grandTotal` `useMemo` (≈ lines 251–259).

**Interfaces:**
- Consumes: `fetchActiveDiscounts`, `orderCandidatesByValue` (Task B3/B4), `resolvePlatformDiscount` is NOT used here (preview is best-effort, non-binding — it does not consume a redemption).
- Produces: `GET /api/discounts/preview?subtotal=NN` → `{ amount: number; name: string | null } | { amount: 0 }`.

- [ ] **Step 1: Create the preview route `my-app/app/api/discounts/preview/route.ts`**

```typescript
import { and, count, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema/orders";
import { platformDiscounts } from "@/db/schema/discounts";
import { auth } from "@/lib/auth";
import {
  fetchActiveDiscounts,
  orderCandidatesByValue,
} from "@/lib/orders/platform-discount";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ amount: 0 });
  }
  const subtotal = Number.parseFloat(
    req.nextUrl.searchParams.get("subtotal") ?? "0",
  );
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return NextResponse.json({ amount: 0 });
  }

  const active = await fetchActiveDiscounts();
  const candidates = orderCandidatesByValue(active, subtotal);

  // Best candidate the user has NOT exhausted (preview only; non-binding).
  for (const cand of candidates) {
    const [{ used }] = await db
      .select({ used: count() })
      .from(orders)
      .where(
        and(
          eq(orders.platformDiscountId, cand.discount.id),
          eq(orders.clientId, session.user.id),
          ne(orders.status, "cancelled"),
        ),
      );
    if (Number(used) < cand.discount.perUserLimit) {
      const [row] = await db
        .select({ name: platformDiscounts.name })
        .from(platformDiscounts)
        .where(eq(platformDiscounts.id, cand.discount.id))
        .limit(1);
      return NextResponse.json({ amount: cand.amount, name: row?.name ?? null });
    }
  }
  return NextResponse.json({ amount: 0 });
}
```

- [ ] **Step 2: Fetch the preview in `checkout/page.tsx`**

Add state + an effect that refetches when `subtotal` changes:

```tsx
const [discount, setDiscount] = useState<{ amount: number; name: string | null }>({
  amount: 0,
  name: null,
});

useEffect(() => {
  let cancelled = false;
  if (subtotal <= 0) {
    setDiscount({ amount: 0, name: null });
    return;
  }
  fetch(`/api/discounts/preview?subtotal=${subtotal}`)
    .then((r) => r.json())
    .then((j) => {
      if (!cancelled) setDiscount({ amount: j.amount ?? 0, name: j.name ?? null });
    })
    .catch(() => {
      if (!cancelled) setDiscount({ amount: 0, name: null });
    });
  return () => {
    cancelled = true;
  };
}, [subtotal]);
```

- [ ] **Step 3: Subtract the discount in the totals `useMemo`**

Update the `grandTotal` computation (≈ lines 251–259) so it subtracts `discount.amount` (clamped ≥ 0) and add `discount.amount` to the dependency array:

```tsx
const { tax, grandTotal, taxLabel } = useMemo(() => {
  const taxAmount =
    Math.round(calcTax(subtotal + deliveryFee, cookProvince) * 100) / 100;
  const total =
    Math.round((subtotal + deliveryFee + taxAmount - discount.amount) * 100) / 100;
  return {
    tax: taxAmount,
    grandTotal: Math.max(0, total),
    taxLabel: getTaxLabel(cookProvince),
  };
}, [subtotal, deliveryFee, cookProvince, discount.amount]);
```

- [ ] **Step 4: Render the discount line** in the summary sheet, right after the Delivery row and before the tax row:

```tsx
{discount.amount > 0 && (
  <div className={styles.summaryRow}>
    <span className={styles.summaryRowLabel}>
      {discount.name ?? "Discount"}
    </span>
    <span className={styles.summaryRowVal}>
      −${formatCartMoney(discount.amount)}
    </span>
  </div>
)}
```

- [ ] **Step 5: Verify**

Run `cd my-app && npx tsc --noEmit` (expect no errors), then `npm --prefix my-app run dev`, add items so subtotal ≥ a known discount's minimum, go to checkout. Expected: a "−$X" discount line appears and the Total drops by that amount; placing the order succeeds and the saved order matches the previewed discount.

- [ ] **Step 6: Commit**

```bash
git -C F:/Coding_Projects/Personal/7eats add my-app/app/api/discounts/preview/route.ts my-app/app/app/checkout/page.tsx
git -C F:/Coding_Projects/Personal/7eats commit -m "feat(checkout): preview and show platform discount in summary"
```

---

## Final verification checklist

- [ ] Admin: create / edit / delete discounts works; status badges correct; redemption counts show.
- [ ] DB: `platform_discounts` table + `orders.platform_discount_id/amount` exist in the shared Neon DB.
- [ ] Consumer: best-for-customer discount auto-applies; per-user limit holds (including a rapid double-submit, thanks to the advisory lock); cancelled orders free a slot.
- [ ] Pricing: customer total reduced by the discount; `order_payments` still records pre-discount platform fee + cook payout (record-only v1).
- [ ] Both repos typecheck; pure-logic tests pass in both.
- [ ] Open a PR in `7eats` from `feat/platform-discounts` → `staging`, and in `7eats-admin` from `feat/platform-discounts` → `main`.

## Known follow-ups (not in this plan)

- Stripe top-up so the cook is paid the full pre-discount amount when the discount exceeds the platform fee (the deferred half of "record-only v1").
- Optional: global/total budget cap, new-customer-only targeting, promo codes.
