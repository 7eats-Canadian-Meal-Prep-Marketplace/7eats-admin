# Platform-Wide Discounts — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation plan
**Repos affected:** `7eats-admin` (this repo) and `7eats` consumer app (`F:\Coding_Projects\Personal\7eats`, `my-app/`)

## 1. Summary

Add admin-created, platform-funded promotional discounts that apply **automatically**
at checkout across the marketplace — modelled on Uber/DoorDash welcome offers
(e.g. "your next 5 orders get $5 off" or "5% off your next order").

This is distinct from the existing **`dish_promotions`** (consumer app) /
`listing_promotions` (admin repo) — those are **per-listing, cook-funded**. Platform
discounts are **global, admin-created, platform-funded**.

## 2. Confirmed decisions

| Decision | Choice |
|---|---|
| Per-user cap semantics | **Per-user** — discount applies to a user's next N non-cancelled orders |
| How customer receives it | **Automatic** — no promo codes |
| Who absorbs the cost | **Platform** — cook payout and platform-fee base unchanged |
| Extra controls | **Min order subtotal** + **max discount cap** (for %) |
| Multiple active discounts | **Best for customer** — apply the single largest-saving eligible discount; no stacking between platform discounts |
| What it discounts | **Pre-discount subtotal** (after cook dish promos); **stacks** with a cook dish promotion |
| Taxes | **Disabled platform-wide** — no tax math; discount comes straight off subtotal |

### Pricing formula (taxes disabled)

```
S       = subtotal after cook dish promos
D       = delivery fee snapshot
P       = best eligible platform discount (dollars)
fee     = platform_fee_pct * (S + D)        # on PRE-discount base — unchanged
payout  = cook's share of S                 # PRE-discount — cook paid in full
total   = S - P + D                         # what the customer pays
```

The platform absorbs `P` (it comes out of the platform's cut; if `P` exceeds the
platform fee the platform is net-negative on that order — acceptable, it's a
marketing spend).

## 3. Data model

### New enum

`platform_discount_type`: `'percentage' | 'fixed'`

### New table `platform_discounts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `defaultRandom()` |
| `name` | varchar(120) | required |
| `description` | text | optional |
| `discount_type` | `platform_discount_type` | required |
| `value` | numeric(10,2) | percent (≤100) or dollar amount |
| `max_discount_amount` | numeric(10,2) | nullable — caps a % discount (e.g. 5% up to $10) |
| `min_order_subtotal` | numeric(10,2) | nullable — order subtotal must reach this to qualify |
| `per_user_limit` | integer | ≥1, default 1 — the "next N orders" |
| `starts_at` | timestamptz | nullable |
| `ends_at` | timestamptz | nullable |
| `is_active` | boolean | default true |
| `created_by` | text FK → `auth_user(id)` `on delete set null` | |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | default now, `$onUpdate` |

**Check constraints** (mirroring `listing_promotions` conventions):
- `value > 0`
- `discount_type <> 'percentage' OR value <= 100`
- `max_discount_amount IS NULL OR max_discount_amount > 0`
- `min_order_subtotal IS NULL OR min_order_subtotal >= 0`
- `per_user_limit >= 1`
- `ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at`

**RLS policies** (matching existing patterns):
- `select` / `insert` / `update` / `delete` for admin (`auth.role() = 'admin'`)
- `select` for `public` limited to currently redeemable rows:
  `is_active = TRUE AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`
  (so the consumer app can read eligible discounts at checkout)

### Orders table — additive columns (BOTH repos)

| Column | Type | Notes |
|---|---|---|
| `platform_discount_id` | uuid FK → `platform_discounts(id)` `on delete set null` | nullable |
| `platform_discount_amount` | numeric(10,2) | nullable — dollars discounted |

Plus index `orders_platform_discount_client_idx` on `(platform_discount_id, client_id)`
to make the per-user count cheap.

### No separate redemptions table

Per-user usage is counted directly off `orders`:

```sql
SELECT count(*) FROM orders
WHERE platform_discount_id = :id
  AND client_id = :user
  AND status <> 'cancelled';
```

Single source of truth; cancelling an order naturally frees a slot.

## 4. Selection & pricing logic (consumer app, at order placement)

After subtotal `S` (post dish-promo) is known, inside the placement transaction:

1. Fetch active discounts in their date window where `S >= COALESCE(min_order_subtotal, 0)`.
2. Compute each discount's dollar value:
   - `fixed`: `min(value, S)`
   - `percentage`: `min(S * value / 100, COALESCE(max_discount_amount, ∞), S)`
3. Keep only discounts where the user's non-cancelled redemption count `< per_user_limit`.
4. Pick the **largest** dollar value (`P`). Tie-break: most recently created.
5. Persist `platform_discount_id` + `platform_discount_amount = P`; subtract `P` from
   the customer total. Cook payout / platform fee stay on pre-discount `S`.

If no discount qualifies, `platform_discount_id`/`platform_discount_amount` stay null.

## 5. Admin UI (this repo)

- New **"Discounts"** sidebar nav item (lucide `Tag` or `Percent` icon) → `/admin/discounts`.
- **List page** (`app/admin/discounts/page.tsx` server component + `DiscountsClient.tsx`):
  table of name, type/value, window, per-user limit, status badge
  (Active / Scheduled / Expired / Inactive), and total redemptions
  (count of non-cancelled orders referencing it).
- **Create / Edit** via the existing `Modal.tsx` pattern: form with name, description,
  type radio ($/%), value, max-cap (shown only when %), min subtotal, per-user limit,
  start/end dates, active toggle.
- **API routes**, each Zod-validated with the admin-session guard from
  `app/api/admin/cooks/[cookId]/fee/route.ts`:
  - `app/api/admin/discounts/route.ts` — `POST` (create), `GET` (list, optional)
  - `app/api/admin/discounts/[id]/route.ts` — `PATCH` (edit / toggle active),
    `DELETE` (only when the discount has zero referencing orders; otherwise deactivate)

## 6. Migration strategy

The two repos' schemas have **drifted** (consumer app has `tax_amount`,
`delivery_fee_snapshot`, `fulfillment_mode`, per-line `order_dishes` discounts; admin
repo's `orders` still has the deprecated `unit_price`/`promotion_id`/`discount_amount`).
The admin repo also has **no `db/migrations` directory** — schema has been applied via
push, not generated migrations.

Therefore:
- **Do NOT run `drizzle-kit generate`** (it would diff against the stale admin schema
  and could emit destructive changes).
- Write a **single hand-authored, additive-only SQL migration**:
  `CREATE TYPE`, `CREATE TABLE platform_discounts`, `ALTER TABLE orders ADD COLUMN` ×2,
  the index, and the RLS policies. Apply it once to the shared Neon DB.
- Mirror the Drizzle TS schema (`db/schema/discounts.ts` + orders column additions +
  enum + `db/schema/index.ts` export) into **both** repos by hand so they match.

## 7. Consumer app work (separate `7eats` repo)

Workflow (explicitly required):
1. `cd` into `F:\Coding_Projects\Personal\7eats`.
2. `git checkout staging && git pull` to get the latest staging.
3. Create a new branch off staging (e.g. `feat/platform-discounts`).
4. Apply changes there.

Changes:
- Mirror `discounts` schema + orders columns + enum + index (additive).
- Wire selection/pricing logic into `lib/orders/place-order.ts` and the charge
  breakdown in `lib/order-totals.ts` / `computeOrderChargeBreakdown` — subtract the
  platform discount from the customer total while keeping platform fee + cook payout on
  the pre-discount subtotal. **Verify the tax code is actually disabled** and remove/skip
  any tax addition to the total.
- Checkout summary: add a "Platform discount −$X" line and automatically preview the
  best eligible discount for the current cart before the order is placed.

## 8. Known limitations (v1, accepted)

- **Per-user count concurrency race:** the count-then-insert is not atomic, so a user
  submitting multiple orders in the same instant (double-click, two tabs, retry) can
  exceed the per-user limit by ~1. Every such order is real and paid; impact is a tiny
  promo-budget over-spend, not a security issue. **Future mitigation:** a Postgres
  advisory lock keyed on `(discount_id, user_id)` at the top of the placement
  transaction to serialize a single user's concurrent checkouts.
- **Cancelled orders free a redemption slot** (a user can cancel and re-redeem). Minor,
  accepted for v1.

## 9. Out of scope (YAGNI)

- Promo codes / coupon entry (discounts are automatic).
- Global/total budget cap (only per-user cap chosen).
- New-customers-only targeting.
- Stacking multiple platform discounts on one order.
- Per-cook or per-listing targeting of platform discounts (these are global).

## 10. Orchestration note

Implementation will be executed via **subagents** for each independent unit
(admin schema/migration, admin API, admin UI, consumer schema, consumer pricing,
consumer UI), per the user's orchestration preference.
