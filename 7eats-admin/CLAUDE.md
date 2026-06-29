# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Internal admin panel for the **7eats** platform — the dashboard the 7eats team uses to manage
cook applications, certifications, listings, users, orders, discounts, reviews, and analytics.
It is a separate Next.js app from the main 7eats customer/cook app but talks to the **same Neon
Postgres database**.

**Main 7eats repo (the primary consumer of this DB):** `F:\Coding_Projects\Personal\7eats` — the
customer/cook app lives in its `my-app/` subfolder (`F:\Coding_Projects\Personal\7eats\my-app`). The
`db/schema/*` here is copied from that repo's `my-app\db\schema\` and must be kept in sync with it.

Stack: Next.js 16 (App Router + Turbopack), React 19, Drizzle ORM + `@neondatabase/serverless`,
Better Auth, Recharts (analytics), Sonner (toasts), Zod (validation). Styling is **CSS Modules +
plain CSS — there is no Tailwind** despite `@tailwindcss/postcss` being present in deps.

## Commands

Uses **pnpm**. Dev server runs on port 3000 by default; the admin app expects to be served at
`NEXT_PUBLIC_ADMIN_URL` (default `http://localhost:3001`) and the main app at `NEXT_PUBLIC_APP_URL`
(`:3000`) — both are configurable via env.

```bash
pnpm dev            # next dev (Turbopack)
pnpm build          # next build
pnpm lint           # biome check  (lint + format check)
pnpm format         # biome format --write

# Tests use Node's built-in test runner via tsx (no test script in package.json):
node --import tsx --test lib/discounts/status.test.ts   # run a single test file
node --import tsx --test "lib/**/*.test.ts"             # run all tests

# Apply SQL migrations to the shared Neon DB (idempotent, skips "already exists"):
node scripts/apply-discount-migration.mjs
```

There is no `pnpm test` script and no Jest/Vitest — tests are colocated `*.test.ts` files using
`node:test` + `node:assert`.

## Architecture & conventions

**Lazy proxy singletons for `db` and `auth`.** `db/index.ts` and `lib/auth.ts` each export a `Proxy`
that constructs the real instance on first property access. This is deliberate: it lets `next build`
succeed without `DATABASE_URL` / `BETTER_AUTH_SECRET` set. **Do not** replace these with eager
module-level instantiation — it will break the build.

**Two separate auth domains.** `db/schema/admin-auth.ts` defines `admin_user` / `admin_session` /
`admin_account` / `admin_verification` tables, used by Better Auth for admin login (email+password).
The main app's user tables live in `db/schema/auth.ts` (`user`, etc.). Better Auth here is wired only
to the `admin_*` tables; every `admin_user` is treated as `role: "admin"`.

**Auth enforcement is two-layered:**
- Page/layout level — `app/admin/layout.tsx` calls `getAdminSession()` (`lib/session.ts`), which
  redirects to `/login` if there's no session. The root `/` redirects to `/admin`.
- API route level — each route under `app/api/admin/**` independently re-checks the session and
  `role === "admin"`, returning 401 otherwise. Always include this check in new admin API routes;
  do not rely on the layout guard for API routes.

**Page structure pattern.** Admin pages follow server-component-fetches → client-component-renders:
- `app/admin/<feature>/page.tsx` — server component, starts with `export const dynamic = "force-dynamic"`,
  queries Drizzle directly, passes results as props to a client component. Keep `force-dynamic` on new
  pages (they read live DB state and per-request session).
- `app/admin/<feature>/<Feature>Client.tsx` — `"use client"` component that renders the data and calls
  the API routes for mutations.

**API routes** (`app/api/admin/**/route.ts`) validate input with Zod, use `db.transaction()` for
multi-step writes, and compensate on external failures (see `applications/[id]/approve/route.ts`:
it reverts the application status and deletes the setup token if the Resend email fails).

**Database driver choice matters.** `db/index.ts` uses the **WebSocket `Pool` driver**
(`drizzle-orm/neon-serverless` + `ws`), not the neon-http driver, because admin routes use
`db.transaction()` and neon-http has no transaction support. This requires the Node runtime.

**Schema is shared with the main app.** `db/schema/*` is copied from the main 7eats repo
(`F:\Coding_Projects\Personal\7eats\my-app\db\schema\`). Keep it in sync. Tables enable Postgres RLS
with `service_role`/`admin` policies (`pgPolicy` + `.enableRLS()`) — preserve these when editing schema.

**Migrations** live in `db/migrations/*.sql` and are applied with `scripts/apply-discount-migration.mjs`
(applies every `.sql` file in order, idempotently). `drizzle.config.ts` points drizzle-kit at the same
dir, but the apply script — not `drizzle-kit migrate` — is the established way to push changes here.

## Build gotcha: kysely patch

Better Auth bundles `@better-auth/kysely-adapter`, which imports `DEFAULT_MIGRATION_TABLE`,
`DEFAULT_MIGRATION_LOCK_TABLE`, and `DefaultQueryCompiler` from kysely's main export — these moved to
internal modules in kysely 0.28+, and Turbopack rejects the missing exports at build time even though
the adapter is dead code (we use the Drizzle adapter). `scripts/patch-kysely.mjs` appends the
re-exports to the installed kysely build and runs automatically via the `postinstall` hook.
`next.config.ts` also sets `serverExternalPackages: ["better-auth"]`.

If a build fails with `Export DEFAULT_MIGRATION_LOCK_TABLE doesn't exist in target module`, re-run
`pnpm install` (or `node scripts/patch-kysely.mjs`) to re-apply the patch.

## Tooling notes

- **Biome** (not ESLint/Prettier) handles lint + format: 2-space indent, organize-imports on, Next +
  React domains enabled. Run `pnpm lint` before considering work done.
- Path alias `@/*` maps to the repo root (e.g. `@/db`, `@/lib/auth`).
- Email is sent via **Resend** (`lib/email.ts`); HTML templates are built in `lib/emails/base.ts`.
  Sending is a no-op if `RESEND_API_KEY` is unset, so it's safe in dev.
