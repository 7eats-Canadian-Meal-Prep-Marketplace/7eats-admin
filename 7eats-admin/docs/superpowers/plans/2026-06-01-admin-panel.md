# 7eats Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-grade internal admin panel for the 7eats platform covering cook application review, cook management, certifications, listings, users, orders, reviews, and analytics.

**Architecture:** Next.js 16 App Router with server components by default; CSS Modules + vanilla CSS (no Tailwind); Drizzle ORM talking to the shared Neon Postgres database; Better Auth for admin session management; API route handlers for all mutations; Recharts for analytics visualizations.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM + @neondatabase/serverless, better-auth, lucide-react, sonner, recharts, resend, zod, CSS Modules, Plus Jakarta Sans

---

## File Structure

### Infrastructure
- `db/index.ts` — Drizzle HTTP client
- `db/schema/index.ts` — re-exports all schema modules
- `db/schema/enums.ts` — all pgEnum values
- `db/schema/auth.ts` — user, session, account, verification tables
- `db/schema/applications.ts` — cook_applications, setup_tokens
- `db/schema/cooks.ts` — cook_profiles, cook_certifications
- `db/schema/listings.ts` — listings, listing_dishes, listing_promotions, listing_bundles
- `db/schema/dishes.ts` — dishes + supporting tables
- `db/schema/orders.ts` — orders, order_dishes, reviews
- `db/schema/payments.ts` — order_payments, cook_payouts, cook_agreements
- `db/schema/subscriptions.ts` — listing_subscription_tiers, client_subscriptions
- `lib/auth.ts` — Better Auth server instance (same config as main app)
- `lib/session.ts` — `getAdminSession()` helper (redirects if not admin)
- `lib/email.ts` — `sendMail()` wrapper (no-op when RESEND_API_KEY unset)
- `drizzle.config.ts` — Drizzle config (read-only schema reference)
- `next.config.ts` — security headers

### App Shell
- `app/globals.css` — full design system (overwrites default)
- `app/layout.tsx` — root layout with Plus Jakarta Sans
- `app/login/page.tsx` — admin login page (server component)
- `app/login/LoginForm.tsx` — "use client" login form
- `app/login/login.module.css`
- `app/auth/[...all]/route.ts` — Better Auth catch-all handler
- `app/admin/layout.tsx` — sidebar shell + auth guard
- `app/admin/Sidebar.tsx` — "use client" sidebar with active state
- `app/admin/admin.module.css`

### Pages (server components + client sub-components for interactivity)
- `app/admin/page.tsx` + `app/admin/dashboard.module.css`
- `app/admin/applications/page.tsx` + `ApplicationsClient.tsx` + `applications.module.css`
- `app/admin/applications/[id]/page.tsx` + `ApplicationActions.tsx` + `application-detail.module.css`
- `app/admin/cooks/page.tsx` + `CooksClient.tsx` + `cooks.module.css`
- `app/admin/cooks/[cookId]/page.tsx` + `CookDetailTabs.tsx` + `cook-detail.module.css`
- `app/admin/certifications/page.tsx` + `CertificationsClient.tsx` + `certifications.module.css`
- `app/admin/listings/page.tsx` + `ListingsClient.tsx` + `listings.module.css`
- `app/admin/users/page.tsx` + `UsersClient.tsx` + `users.module.css`
- `app/admin/users/[userId]/page.tsx` + `UserActions.tsx` + `user-detail.module.css`
- `app/admin/orders/page.tsx` + `OrdersClient.tsx` + `orders.module.css`
- `app/admin/orders/[orderId]/page.tsx` + `order-detail.module.css`
- `app/admin/reviews/page.tsx` + `ReviewsClient.tsx` + `reviews.module.css`
- `app/admin/analytics/page.tsx` + `AnalyticsCharts.tsx` + `analytics.module.css`

### API Routes
- `app/api/admin/applications/[id]/approve/route.ts`
- `app/api/admin/applications/[id]/reject/route.ts`
- `app/api/admin/applications/[id]/reissue-link/route.ts`
- `app/api/admin/cooks/[cookId]/status/route.ts`
- `app/api/admin/cooks/[cookId]/fee/route.ts`
- `app/api/admin/certifications/[certId]/review/route.ts`
- `app/api/admin/listings/[listingId]/review/route.ts`
- `app/api/admin/users/[userId]/role/route.ts`
- `app/api/admin/users/[userId]/status/route.ts`
- `app/api/admin/reviews/[reviewId]/visibility/route.ts`

---

## Task 1: Install Dependencies & Base Configuration

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `.env.example`
- Modify: `next.config.ts`

- [ ] **Step 1.1: Install production dependencies**

```bash
cd "F:/Coding_Projects/Personal/7eats-admin/7eats-admin"
pnpm add @neondatabase/serverless drizzle-orm better-auth resend lucide-react sonner recharts zod ws
pnpm add -D drizzle-kit @types/ws
```

- [ ] **Step 1.2: Update tsconfig.json to add path alias `@/` → `./`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.3: Create .env.example**

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@7eats.ca
INTERNAL_API_KEY=...
```

- [ ] **Step 1.4: Update next.config.ts with security headers**

```typescript
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

---

## Task 2: DB Schema Setup

**Files:** Create all `db/schema/*.ts` files and `db/index.ts`

These are copied/adapted from the main 7eats app at `F:/Coding_Projects/Personal/7eats/my-app/db/`.

- [ ] **Step 2.1: Create `db/schema/enums.ts`** — all pgEnum definitions matching main app
- [ ] **Step 2.2: Create `db/schema/auth.ts`** — user, session, account, verification tables
- [ ] **Step 2.3: Create `db/schema/applications.ts`** — cook_applications, setup_tokens
- [ ] **Step 2.4: Create `db/schema/cooks.ts`** — cook_profiles, cook_certifications
- [ ] **Step 2.5: Create `db/schema/listings.ts`** — listings, listing_dishes, listing_promotions, listing_bundles
- [ ] **Step 2.6: Create `db/schema/dishes.ts`** — dishes and supporting tables
- [ ] **Step 2.7: Create `db/schema/orders.ts`** — orders, order_dishes, reviews
- [ ] **Step 2.8: Create `db/schema/payments.ts`** — order_payments, cook_payouts, cook_agreements
- [ ] **Step 2.9: Create remaining schema files** — subscriptions, messaging, notifications, tags, etc.
- [ ] **Step 2.10: Create `db/schema/index.ts`** — re-export all schemas
- [ ] **Step 2.11: Create `db/index.ts`**

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL environment variable is not set");

const sql = neon(url);
export const db = drizzle(sql, { schema });
```

---

## Task 3: Auth & Session Setup

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/session.ts`
- Create: `lib/email.ts`
- Create: `app/auth/[...all]/route.ts`

- [ ] **Step 3.1: Create `lib/email.ts`** (identical to main app)

```typescript
import { Resend } from "resend";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail({ to, subject, text }: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
    to,
    subject,
    text,
  });

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3.2: Create `lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { authAccount, authSession, authUser, authVerification } from "@/db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "client", required: false },
      status: { type: "string", defaultValue: "active", required: false },
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      phone: { type: "string", required: false },
      phoneVerified: { type: "boolean", defaultValue: false, required: false },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET ?? (() => { throw new Error("BETTER_AUTH_SECRET is not set"); })(),
  baseURL: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001",
});
```

- [ ] **Step 3.3: Create `lib/session.ts`** — server-side session helper

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getAdminSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.role !== "admin") {
    redirect("/login");
  }

  return session;
}
```

- [ ] **Step 3.4: Create `app/auth/[...all]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

---

## Task 4: Design System & Root Layout

**Files:**
- Modify: `app/globals.css` — full design system
- Modify: `app/layout.tsx` — Plus Jakarta Sans, minimal root layout

- [ ] **Step 4.1: Overwrite `app/globals.css`** with complete design system (CSS variables, reset, typography, button classes, status badge classes)
- [ ] **Step 4.2: Overwrite `app/layout.tsx`** with Plus Jakarta Sans font setup
- [ ] **Step 4.3: Add logo files** — copy from 7eats public folder or use text fallback

---

## Task 5: Admin Login Page

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/LoginForm.tsx` ("use client")
- Create: `app/login/login.module.css`

- [ ] **Step 5.1: Create login form UI** — email + password fields, submit button, error state
- [ ] **Step 5.2: Create `LoginForm.tsx`** using `authClient.signIn.email()` from better-auth/react
- [ ] **Step 5.3: Create `app/login/page.tsx`** — server component that redirects to /admin if already logged in

---

## Task 6: Admin Layout & Sidebar

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/Sidebar.tsx` ("use client")
- Create: `app/admin/admin.module.css`

- [ ] **Step 6.1: Create `app/admin/layout.tsx`** — auth guard (call getAdminSession), render sidebar + main content

```typescript
import { getAdminSession } from "@/lib/session";
import { Sidebar } from "./Sidebar";
import styles from "./admin.module.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await getAdminSession();
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 6.2: Create `Sidebar.tsx`** with nav links: Dashboard, Applications, Cooks, Certifications, Listings, Users, Orders, Reviews, Analytics, and Sign Out button
- [ ] **Step 6.3: Create `admin.module.css`** with two-column grid layout (220px sidebar + flex main)

---

## Task 7: Dashboard Page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/dashboard.module.css`

- [ ] **Step 7.1: Create server-side data fetching** — query all KPI counts:
  - Total users
  - Total active cooks
  - Pending applications
  - Pending certifications
  - Pending listings
  - Orders/revenue/fees/fulfilled this month

- [ ] **Step 7.2: Create KPI stat card components** (inline server markup, CSS Module classes)
- [ ] **Step 7.3: Create recent activity tables** — last 10 applications, last 10 orders
- [ ] **Step 7.4: Style with `dashboard.module.css`**

---

## Task 8: Cook Applications

**Files:**
- Create: `app/admin/applications/page.tsx`
- Create: `app/admin/applications/ApplicationsClient.tsx` ("use client" - search/filter)
- Create: `app/admin/applications/applications.module.css`
- Create: `app/admin/applications/[id]/page.tsx`
- Create: `app/admin/applications/[id]/ApplicationActions.tsx` ("use client" - modals)
- Create: `app/admin/applications/[id]/application-detail.module.css`

- [ ] **Step 8.1: Build applications list page** — server fetch, pass to client for search/filter
- [ ] **Step 8.2: Build application detail page** — display all cook_applications fields
- [ ] **Step 8.3: Build ApplicationActions** — Approve/Reject/Reissue modals with confirmation dialogs
- [ ] **Step 8.4: Create API routes**:
  - POST `/api/admin/applications/[id]/approve` → calls `/api/internal/issue-link`, saves reviewedAt/reviewedBy
  - POST `/api/admin/applications/[id]/reject` → updates status, saves reviewNotes, sends rejection email
  - POST `/api/admin/applications/[id]/reissue-link` → calls `/api/internal/reissue-link`

---

## Task 9: Cook Management

**Files:**
- Create: `app/admin/cooks/page.tsx` + `CooksClient.tsx` + `cooks.module.css`
- Create: `app/admin/cooks/[cookId]/page.tsx` + `CookDetailTabs.tsx` + `cook-detail.module.css`
- Create: `app/api/admin/cooks/[cookId]/status/route.ts`
- Create: `app/api/admin/cooks/[cookId]/fee/route.ts`

- [ ] **Step 9.1: Build cooks list page** — join cook_profiles + authUser, display table
- [ ] **Step 9.2: Build cook detail page** — fetch all related data
- [ ] **Step 9.3: Build CookDetailTabs** — Profile/Certifications/Listings/Orders/Payouts/Fee History tabs
- [ ] **Step 9.4: Create status API route** — suspend/ban/reactivate user
- [ ] **Step 9.5: Create fee API route** — insert new cook_agreements record

---

## Task 10: Certifications & Listings

**Files:**
- Create: `app/admin/certifications/page.tsx` + `CertificationsClient.tsx` + `certifications.module.css`
- Create: `app/admin/listings/page.tsx` + `ListingsClient.tsx` + `listings.module.css`
- Create: `app/api/admin/certifications/[certId]/review/route.ts`
- Create: `app/api/admin/listings/[listingId]/review/route.ts`

- [ ] **Step 10.1: Build certifications list** — join cook_certifications + cook_profiles + authUser
- [ ] **Step 10.2: Build inline approve/reject for certifications** — modal with optional notes
- [ ] **Step 10.3: Create certifications review API route**
- [ ] **Step 10.4: Build listings list** — join listings + cook_profiles + authUser
- [ ] **Step 10.5: Build inline approve/reject for listings**
- [ ] **Step 10.6: Create listings review API route**

---

## Task 11: Users & Orders

**Files:**
- Create: `app/admin/users/page.tsx` + `UsersClient.tsx` + `users.module.css`
- Create: `app/admin/users/[userId]/page.tsx` + `UserActions.tsx` + `user-detail.module.css`
- Create: `app/admin/orders/page.tsx` + `OrdersClient.tsx` + `orders.module.css`
- Create: `app/admin/orders/[orderId]/page.tsx` + `order-detail.module.css`
- Create: `app/api/admin/users/[userId]/role/route.ts`
- Create: `app/api/admin/users/[userId]/status/route.ts`

- [ ] **Step 11.1: Build users list page** — filter by role/status, search
- [ ] **Step 11.2: Build user detail page** — profile, linked cook (if applicable), order history
- [ ] **Step 11.3: Build UserActions** — suspend/ban/reactivate/promote/demote modals
- [ ] **Step 11.4: Create user role & status API routes**
- [ ] **Step 11.5: Build orders list page** — filter by status, date range, search
- [ ] **Step 11.6: Build order detail page** — full order info, payment details, pickup code

---

## Task 12: Reviews & Analytics

**Files:**
- Create: `app/admin/reviews/page.tsx` + `ReviewsClient.tsx` + `reviews.module.css`
- Create: `app/admin/analytics/page.tsx` + `AnalyticsCharts.tsx` + `analytics.module.css`
- Create: `app/api/admin/reviews/[reviewId]/visibility/route.ts`

- [ ] **Step 12.1: Build reviews list** — filter by visibility, show/hide actions
- [ ] **Step 12.2: Create review visibility API route**
- [ ] **Step 12.3: Build analytics page** — server-side SQL aggregations
- [ ] **Step 12.4: Build AnalyticsCharts** — "use client" Recharts components (line, bar, pie/donut charts)

---

## Task 13: Lint, Build & Smoke Test

- [ ] **Step 13.1:** Run `pnpm lint` and fix all Biome errors
- [ ] **Step 13.2:** Run `pnpm build` and resolve any TypeScript/build errors
- [ ] **Step 13.3:** Test login flow and admin session guard
- [ ] **Step 13.4:** Test API routes return correct status codes
- [ ] **Step 13.5:** Verify search params work on list pages
- [ ] **Step 13.6:** Verify modal flows (approve/reject/etc) update UI correctly

---

## Environment Variables Required

```env
DATABASE_URL=              # Shared Neon Postgres URL (same as main 7eats app)
BETTER_AUTH_SECRET=        # Shared secret (same as main 7eats app)
NEXT_PUBLIC_ADMIN_URL=     # This admin panel's URL (e.g. http://localhost:3001)
NEXT_PUBLIC_APP_URL=       # Main 7eats app URL (for calling /api/internal/*)
RESEND_API_KEY=            # Resend API key (optional — no-op in dev)
RESEND_FROM_EMAIL=         # From address (default: noreply@7eats.ca)
INTERNAL_API_KEY=          # Shared internal API key (same as main 7eats app)
```
