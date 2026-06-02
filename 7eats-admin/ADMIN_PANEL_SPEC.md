# 7eats Admin Panel — Agent Specification

> This document is written for an AI agent tasked with building the 7eats admin panel.
> It contains everything needed: features, design system, database schema, and API context.
> Read this in full before writing a single line of code.

---

## 1. What You Are Building

A private, internal admin web panel at `/admin` for the 7eats team to:
- Review and approve or reject cook applications
- Approve or reject cook certifications and listings
- Manage user accounts (suspend, ban, change role)
- View platform-wide stats (users, orders, revenue)
- Override platform fee rates per cook
- Reissue onboarding setup links to approved cooks
- Moderate reviews

This is a **server-side-rendered Next.js App Router** interface. All admin routes live under `app/admin/`. Protect every admin route by checking `session.user.role === "admin"` server-side — redirect to `/` if not admin. No external admin framework; build with the same CSS Modules + vanilla CSS system used in the rest of the app.

---

## 2. Design System

### 2.1 Font

**Plus Jakarta Sans** — loaded via `next/font/google`:

```typescript
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});
```

CSS font stack: `"Plus Jakarta Sans", "Helvetica Neue", Helvetica, sans-serif`

All headings use `font-weight: 700`, `letter-spacing: -0.025em`, `line-height: 1.05`.  
Body text uses `font-size: 16px`, `line-height: 1.55`.

### 2.2 Color Palette

All colors are defined as CSS custom properties in `app/globals.css`:

| Token | Value | Usage |
|---|---|---|
| `--red` | `#d64045` | Primary brand color, CTAs, destructive actions, badges |
| `--red-deep` | `#b6353a` | Hover state for red elements |
| `--ink` | `#0f0f0f` | Primary text |
| `--ink-2` | `#1a1a1a` | Secondary text, headings |
| `--grey-900` | `#2a2a2a` | Dark surfaces, nav background |
| `--grey-700` | `#6b6b6b` | Muted/secondary text |
| `--grey-500` | `#9a9a9a` | Placeholder text, disabled |
| `--grey-300` | `#dadada` | Borders, dividers |
| `--grey-200` | `#ececec` | Table row hover, subtle bg |
| `--grey-100` | `#f4f4f4` | Page background, card bg |
| `--white` | `#ffffff` | Card surfaces, form fields |

Admin-specific semantic colors to define in CSS Modules:

| Semantic | Value | For |
|---|---|---|
| `status-pending` | `#f5a623` (amber) | `pending_review` badges |
| `status-approved` | `#27ae60` (green) | `approved` / `active` badges |
| `status-rejected` | `#d64045` (use `--red`) | `rejected` / `banned` badges |
| `status-suspended` | `#e67e22` (orange) | `suspended` badges |

### 2.3 Spacing & Radius

```css
--radius-sm:   8px
--radius-md:   16px
--radius-lg:   24px
--radius-pill: 999px
--maxw:        1240px
--pad-x:       24px  /* mobile */
               32px  /* ≥768px */
               56px  /* ≥1024px */
```

Admin panel can use a narrower internal max-width of `960px` for content areas.

### 2.4 Shadow

```css
--shadow-md: 0 4px 14px rgba(15,15,15,0.04), 0 12px 32px rgba(15,15,15,0.05);
```

Use on cards and modal dialogs.

### 2.5 Layout Pattern

The admin panel uses a **two-column shell**:

```
┌─────────────────────────────────────────────┐
│  Sidebar (220px fixed)  │  Main content area │
│  - Logo                 │  - Page header     │
│  - Nav links            │  - Data table/form │
│                         │                    │
└─────────────────────────────────────────────┘
```

Sidebar background: `--grey-900`. Active link: `--red`. Text on sidebar: `--white` / `--grey-300`.  
Main content area background: `--grey-100`. Cards use `--white` with `--shadow-md`.

### 2.6 Assets

Logo files live in `/public/`:
- `7eats-logo.svg` — full wordmark, use in sidebar header
- `7eats-icon-red.svg` — standalone red icon, use as favicon

---

## 3. Features

### 3.1 Dashboard (Home `/admin`)

Landing page with at-a-glance KPIs. Fetch all data server-side.

**Stat cards (top row):**
- Total users (all roles combined)
- Total cooks (role = `cook`, status = `active`)
- Pending cook applications (`cook_applications.status = pending_review`)
- Pending certifications (`cook_certifications.status = pending_review`)
- Pending listings (`listings.status = pending_review`)

**Order stats (second row):**
- Orders this month (count)
- Gross transaction volume this month (sum of `orders.totalPrice`)
- Platform fee revenue this month (sum of `order_payments.platformFeeAmount`)
- Fulfilled orders this month (status = `fulfilled`)

**Recent activity (table):**
- Last 10 cook applications (name, kitchen, submitted, status)
- Last 10 orders (cook, client, amount, status, date)

---

### 3.2 Cook Applications (`/admin/applications`)

**List view:**
- Table columns: Kitchen Name, Contact Name, Contact Email, Kitchen Type, City, Submitted Date, Status
- Filter by status: All | Pending | Approved | Rejected
- Search by kitchen name or email
- Row click → detail view

**Detail view (`/admin/applications/[id]`):**

Display all fields from `cook_applications`:
- Kitchen info: name, type, years operating
- Address: street, city, province, postal code
- Business: phone, email, website
- Contact: first name, last name, role, phone, email

**Actions:**

| Action | Condition | Behavior |
|---|---|---|
| **Approve** | status = `pending_review` | Shows confirmation modal with optional notes field → calls `/api/internal/issue-link` with `applicationId` → sends setup email to cook → updates status to `approved` |
| **Reject** | status = `pending_review` | Shows modal with required rejection reason field → sends rejection email via Resend → updates status to `rejected` and saves `reviewNotes` |
| **Reissue Setup Link** | status = `approved` | Shows confirmation modal → calls `/api/internal/reissue-link` with `applicationId` → sends new setup email → shows success toast |

**Approve flow detail:**
1. Admin clicks Approve
2. Modal: "Approve [Kitchen Name]? This will send a setup link to [email]. Add notes (optional)."
3. On confirm → POST `/api/admin/applications/[id]/approve` (server action or route)
   - Internally calls `/api/internal/issue-link`
   - Saves `reviewedAt`, `reviewedBy` (admin user ID), `reviewNotes` to `cook_profiles`
4. Toast: "Application approved. Setup link sent to [email]."

**Reject flow detail:**
1. Admin clicks Reject
2. Modal: "Reject [Kitchen Name]? Add rejection reason (required):" + textarea
3. On confirm → POST `/api/admin/applications/[id]/reject`
   - Updates `cook_applications.status = rejected`
   - Sends rejection email via `sendMail()` with the reason in the body
4. Toast: "Application rejected."

**Reissue Setup Link flow detail:**
1. Admin clicks "Reissue Link"
2. Modal: "Send a new setup link to [email]? Previous links will be invalidated."
3. On confirm → POST `/api/admin/applications/[id]/reissue-link`
   - Calls `/api/internal/reissue-link` (expires old tokens, issues new token, sends email)
4. Toast: "New setup link sent to [email]."

---

### 3.3 Cook Management (`/admin/cooks`)

**List view:**
- Table: Display Name, Kitchen Name, Email, Setup Step (1–4 / Complete), Account Status, Joined Date
- Filter by account status: All | Active | Pending | Suspended | Banned
- Search by name or email

**Detail view (`/admin/cooks/[cookId]`):**

Tabs:
1. **Profile** — displayName, bio, photoUrl, pickupAddress, leadTime, maxCapacity, stripeAccountId, platformFeePct, tosAcceptedAt, setupComplete
2. **Certifications** — table of `cook_certifications` (name, status, expires, reviewedAt); inline approve/reject actions per cert
3. **Listings** — table of cook's listings (title, status, price, orders count); inline approve/reject for `pending_review`
4. **Orders** — last 20 orders for this cook (date, client, amount, status)
5. **Payouts** — `cook_payouts` history (amount, status, arrival date)
6. **Fee History** — `cook_agreements` log (rate, effective from/to, notes, set by)

**Actions on cook detail:**
- **Suspend account** → sets `user.status = suspended` + confirmation modal
- **Ban account** → sets `user.status = banned` + confirmation modal
- **Reactivate** → sets `user.status = active`
- **Override platform fee** → modal with number input (%) → inserts new `cook_agreements` record with `effectiveFrom = today`, saves old one's `effectiveUntil = today`
- **Reissue setup link** → only visible if `setupComplete = false` → same flow as 3.2

---

### 3.4 Certification Review (`/admin/certifications`)

Standalone queue for Food Handler certificate approvals.

**List view:**
- Table: Cook Name, Cert Name, Holder Name, Issuer, Expires, Submitted, Status
- Filter by status: All | Pending | Approved | Rejected
- Click row → inline panel or modal with `fileUrl` (open PDF/image)

**Actions:**
- **Approve** → updates `cook_certifications.status = approved`, sets `reviewedAt`, `reviewedBy`
- **Reject** → requires rejection notes → updates status to `rejected`, saves `reviewNotes`

---

### 3.5 Listing Moderation (`/admin/listings`)

**List view:**
- Table: Title, Cook Name, Price, Min/Max Qty, Status, Submitted Date
- Filter by status: All | Pending Review | Active | Archived

**Actions (inline or on detail page):**
- **Approve** → sets `listings.status = active`, sets `reviewedAt`, `reviewedBy`
- **Reject** → requires reason → sets status to `archived`, saves `reviewNotes`
- **View listing dishes** — expandable row showing `listing_dishes` composition

---

### 3.6 User Management (`/admin/users`)

**List view:**
- Table: Name, Email, Role, Status, Phone Verified, Joined Date
- Filter by role: All | Client | Cook | Admin
- Filter by status: All | Active | Pending | Suspended | Banned
- Search by name or email

**Detail view (`/admin/users/[userId]`):**
- Profile fields from `user` table
- Linked cook profile (if role = cook) with link to cook detail
- Order history (last 20 as client)
- Actions: suspend, ban, reactivate, promote to admin, demote to client

---

### 3.7 Order Management (`/admin/orders`)

**List view:**
- Table: Order ID, Cook, Client, Listing, Qty, Total, Status, Pickup Date, Created Date
- Filter by status: All | Pending | Confirmed | Ready | Fulfilled | Cancelled
- Date range filter
- Search by cook or client name

**Detail view (`/admin/orders/[orderId]`):**
- Full order info including `order_dishes` snapshot
- Payment status from `order_payments` (amounts, Stripe IDs)
- Pickup code info (attempts, verified at)
- Late cancel fee details if applied

---

### 3.8 Review Moderation (`/admin/reviews`)

**List view:**
- Table: Cook, Client, Rating, Comment (truncated), Visible, Date
- Filter by visibility: All | Visible | Hidden

**Actions:**
- **Hide review** → sets `reviews.isVisible = false`
- **Show review** → sets `reviews.isVisible = true`

---

### 3.9 Stats & Analytics (`/admin/analytics`)

All computed server-side with SQL aggregations on the Drizzle client.

**Sections:**
- Orders by day (last 30 days) — line chart or bar chart (use a lightweight chart lib like Recharts)
- Revenue by week (gross volume vs platform fee)
- Cook signups by month
- Top 10 cooks by order volume
- Order status breakdown (pie/donut)
- Payout totals by status

---

## 4. Onboarding Flow Context

Understanding this flow is critical for wiring approval actions correctly.

```
① Cook submits application via /apply
   DB: INSERT cook_applications (status: pending_review)
   Email: team notified at RESEND_TEAM_EMAIL

② Admin reviews application in /admin/applications
   → Approve:
     DB: cook_applications.status = approved
     DB: cook_profiles record created (applicationId FK)
     Email: setup magic link sent to cook's contactEmail
     (via /api/internal/issue-link)

   → Reject:
     DB: cook_applications.status = rejected
     DB: reviewNotes saved
     Email: rejection email sent to cook's contactEmail

③ Cook clicks setup link in email
   URL: /business-auth/setup/create-password?token=<rawToken>
   DB: setup_tokens.tokenHash matched, consumedAt set
   DB: user account created with role = cook

④ Cook completes 4-step onboarding wizard:
   Step 1 → Profile: displayName, bio, photo, tags
   Step 2 → Operations: pickupAddress, leadTime, maxCapacity, delivery, pickup windows
   Step 3 → Compliance: Food Handler Certificate upload
             DB: cook_certifications (status: pending_review)
             Admin must approve at /admin/certifications
   Step 4 → Payment & TOS: Stripe Connect onboarding, TOS acceptance
             DB: cook_profiles.stripeAccountId, tosAcceptedAt, setupComplete = true

⑤ Cook creates listings
   DB: listings (status: draft → pending_review when submitted)
   Admin approves at /admin/listings → status = active
   Cook is now fully live on the platform
```

**Reissue Link scenario:**  
If the cook's setup link expires (3-day TTL) or was lost, admin goes to the application detail (`/admin/applications/[id]`) and clicks "Reissue Setup Link". This calls `/api/internal/reissue-link`, which expires all old tokens and issues a fresh one, then emails the cook again.

---

## 5. Internal API Routes

These routes already exist and are what admin actions must call.

### `POST /api/internal/issue-link`

Issues setup link to an approved cook application for the first time.

```
Headers: x-internal-key: <INTERNAL_API_KEY env var>
Body: { applicationId: string }
Success: { ok: true }
Errors: 400 (missing id), 404 (not found), 409 (already approved/wrong status), 502 (email failed)
```

**Side effects:** sets `cook_applications.status = approved`, inserts `setup_tokens`, sends email.

### `POST /api/internal/reissue-link`

Re-sends setup link for an already-approved application.

```
Headers: x-internal-key: <INTERNAL_API_KEY env var>
Body: { applicationId: string }
Success: { ok: true }
Errors: 400, 404, 409 (not in approved state), 502
```

**Side effects:** expires all existing unconsumed tokens for the application, inserts new `setup_tokens`, sends email.

### Calling these from admin server actions

```typescript
// Inside a Next.js Server Action or Route Handler
const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/issue-link`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-key": process.env.INTERNAL_API_KEY!,
  },
  body: JSON.stringify({ applicationId }),
});
if (!res.ok) throw new Error("Failed to issue link");
```

---

## 6. Email Infrastructure

**Provider:** Resend  
**File:** `lib/email.ts`

```typescript
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail({ to, subject, text }: MailMessage): Promise<void>
```

- From address: `process.env.RESEND_FROM_EMAIL` (defaults to `noreply@7eats.ca`)
- No-op in dev when `RESEND_API_KEY` is unset (logs to console instead)
- Throws on API failure

**Email templates to write for admin actions:**

| Trigger | To | Subject | Body |
|---|---|---|---|
| Application rejected | `cook_applications.contactEmail` | "Your 7eats application" | Reason from `reviewNotes` |

Note: Approval email is already handled inside `/api/internal/issue-link` (`sendSetupEmail`). Rejection email must be sent explicitly from the admin reject action using `sendMail`.

---

## 7. Database Schema Reference

> All tables use Drizzle ORM with `@neondatabase/serverless`. Import client from `@/db`.  
> All tables have Row Level Security enabled. Admin routes run with the admin role — policies grant admins full read/write unless noted.

### 7.1 Enums

```typescript
// db/schema/enums.ts
userRole:              ["client", "cook", "admin"]
accountStatus:         ["active", "pending", "suspended", "banned"]
applicationStatus:     ["pending_review", "approved", "rejected"]
certificationStatus:   ["pending_review", "approved", "rejected"]
listingStatus:         ["draft", "pending_review", "active", "archived"]
dishStatus:            ["draft", "active", "archived"]
orderStatus:           ["pending", "confirmed", "ready", "fulfilled", "cancelled"]
paymentStatus:         ["pending", "authorized", "held", "released", "refunded", "disputed"]
payoutStatus:          ["pending", "in_transit", "paid", "failed", "cancelled"]
promotionType:         ["percentage_off", "fixed_off", "buy_x_get_y"]
subscriptionInterval:  ["weekly", "biweekly", "monthly"]
subscriptionStatus:    ["active", "paused", "cancelled", "past_due"]
kitchenType:           ["licensed_home", "commercial_rented", "ghost_kitchen", "restaurant_cafe", "community_kitchen", "other"]
leadTimeEnum:          ["same_day", "1_day", "2_days", "3_days", "4_days", "5_days"]
deliveryEnum:          ["none", "self"]
listingType:           ["one_time", "subscription"]
lateCancelFeeTypeEnum: ["flat", "percentage"]
notificationEntityTypeEnum: ["order_new", "order_cancelled", "review"]
```

### 7.2 Auth / Users (`db/schema/auth.ts`)

**`user`**
```
id                 text (PK)
name               text
email              text (unique, not null)
emailVerified      boolean
image              text
createdAt          timestamp
updatedAt          timestamp
role               userRole (default: client)
status             accountStatus (default: active)
firstName          text
lastName           text
phone              text
phoneVerified      boolean
stripeCustomerId   text
```

**`session`** — Better Auth sessions (service role only)  
**`account`** — OAuth provider accounts (service role only)  
**`verification`** — Email/phone verification codes (service role only)

### 7.3 Cook Applications (`db/schema/applications.ts`)

**`cook_applications`**
```
id               uuid (PK, default random)
kitchenName      text (not null)
kitchenType      kitchenType (not null)
yearsOperating   integer
streetAddress    text
city             text
province         text
postalCode       text
website          text
businessPhone    text
businessEmail    text
firstName        text (contact)
lastName         text (contact)
role             text (contact's role at kitchen)
phone            text (contact)
contactEmail     text (unique — used for setup link)
status           applicationStatus (default: pending_review)
createdAt        timestamp
updatedAt        timestamp
```

Unique index: `contactEmail`

**`setup_tokens`**
```
id             uuid (PK)
applicationId  uuid (FK → cook_applications, cascade delete)
tokenHash      text (unique — SHA256 of raw token)
expiresAt      timestamp (not null)
consumedAt     timestamp (null until used)
createdAt      timestamp
```

### 7.4 Cook Profiles & Certifications (`db/schema/cooks.ts`)

**`cook_profiles`**
```
id                          uuid (PK)
userId                      text (unique FK → user)
applicationId               uuid (unique FK → cook_applications)
displayName                 text
bio                         text
photoUrl                    text
socialLink                  text
currentSetupStep            integer (default: 1)
setupComplete               boolean (default: false)
pickupAddress               text
leadTime                    leadTimeEnum
maxCapacity                 integer
delivery                    deliveryEnum
acceptsSpecialRequests      boolean
stripeAccountId             text
platformFeePct              numeric (default: 7.5)
lateCancelFeeEnabled        boolean
lateCancelFeeType           lateCancelFeeTypeEnum
lateCancelFeeValue          numeric
lateCancelWindowHours       integer
tosAcceptedAt               timestamp
reviewedAt                  timestamp
reviewedBy                  text (FK → user, admin who approved)
reviewNotes                 text
emailNotificationsNewOrder  boolean
emailNotificationsNewReview boolean
smsNotificationsNewOrder    boolean
createdAt                   timestamp
updatedAt                   timestamp
```

**`cook_certifications`**
```
id                uuid (PK)
cookId            uuid (FK → cook_profiles)
name              text (cert name, e.g. "Food Handler Certificate")
holderName        text
issuer            text
certificateNumber text
province          text
issuedAt          date
expiresAt         date
fileUrl           text (uploaded PDF/image URL)
status            certificationStatus (default: pending_review)
reviewedAt        timestamp
reviewedBy        text (FK → user)
reviewNotes       text
createdAt         timestamp
updatedAt         timestamp
```

### 7.5 Listings & Dishes (`db/schema/listings.ts`, `db/schema/dishes.ts`)

**`listings`**
```
id                       uuid (PK)
cookId                   uuid (FK → cook_profiles)
title                    text
description              text
type                     listingType (default: one_time)
status                   listingStatus (default: draft)
basePrice                numeric (CAD, in dollars)
coverPhotoUrl            text
stripeProductId          text
minOrderQty              integer (default: 1)
maxOrderQty              integer
cancellationNoticeDays   integer
reviewedAt               timestamp
reviewedBy               text (FK → user)
reviewNotes              text
createdAt                timestamp
updatedAt                timestamp
```

**`listing_dishes`**
```
id         uuid (PK)
listingId  uuid (FK → listings, cascade)
dishId     uuid (FK → dishes, restrict)
quantity   integer
sortOrder  integer
```

**`listing_promotions`**
```
id           uuid (PK)
listingId    uuid (FK → listings, cascade)
type         promotionType
value        numeric
buyQty       integer (for buy_x_get_y)
getQty       integer (for buy_x_get_y)
minimumQty   integer
maxUses      integer (null = unlimited)
usesCount    integer (default: 0)
isActive     boolean
validFrom    timestamp
validUntil   timestamp
createdAt    timestamp
updatedAt    timestamp
```

**`listing_bundles`** — volume pricing tiers
```
id         uuid (PK)
listingId  uuid (FK → listings, cascade)
label      text
quantity   integer
price      numeric
isActive   boolean
createdAt  timestamp
updatedAt  timestamp
```

**`dishes`**
```
id                uuid (PK)
cookId            uuid (FK → cook_profiles)
name              text
description       text
cuisine           text
categories        text[] (array)
isHalal           boolean
isVegan           boolean
isVegetarian      boolean
isGlutenFree      boolean
isDairyFree       boolean
isNutFree         boolean
isKosher          boolean
servingSize       text
status            dishStatus (default: draft)
createdAt         timestamp
updatedAt         timestamp
```

**`dish_photos`**, **`dish_ingredients`**, **`dish_nutrition`**, **`dish_tags`** — supporting tables for dishes (see `db/schema/dishes.ts` for full fields)

### 7.6 Orders & Payments (`db/schema/orders.ts`, `db/schema/payments.ts`)

**`orders`**
```
id                      uuid (PK)
clientId                text (FK → user)
listingId               uuid (FK → listings)
cookId                  uuid (FK → cook_profiles)
promotionId             uuid (FK → listing_promotions, set null)
subscriptionId          uuid (FK → client_subscriptions, set null)
status                  orderStatus (default: pending)
quantity                integer
unitPrice               numeric (immutable snapshot at order time)
discountAmount          numeric (null if no promo)
totalPrice              numeric
currency                text (default: CAD)
pickupAt                timestamp
fulfilledAt             timestamp
cancelledAt             timestamp
cancelledBy             text (userId)
lateCancelFee           numeric
notes                   text
pickupCodeHash          text
pickupCodeExpiresAt     timestamp
pickupCodeVerifiedAt    timestamp
pickupCodeAttempts      integer (default: 0)
lateCancelFeeEnabled    boolean
lateCancelFeeType       lateCancelFeeTypeEnum
lateCancelFeeValue      numeric
lateCancelWindowHours   integer
lateCancelFeeApplied    boolean
createdAt               timestamp
updatedAt               timestamp
```

**`order_dishes`** — immutable snapshot of listing composition at time of order
```
id        uuid (PK)
orderId   uuid (FK → orders, cascade)
dishId    uuid (FK → dishes, restrict)
dishName  text (snapshot — copied at order time, do not join to dishes for display)
quantity  integer
sortOrder integer
```

**`reviews`**
```
id             uuid (PK)
orderId        uuid (unique FK → orders)
clientId       text (FK → user)
cookId         uuid (FK → cook_profiles)
listingId      uuid (FK → listings)
rating         integer (1–5)
comment        text
cookResponse   text
cookResponseAt timestamp
isVisible      boolean (default: true)
createdAt      timestamp
updatedAt      timestamp
```

**`order_payments`**
```
id                    uuid (PK)
orderId               uuid (unique FK → orders)
cookId                uuid (FK → cook_profiles)
clientId              text (FK → user)
status                paymentStatus (default: pending)
totalAmount           numeric
platformFeePct        numeric
platformFeeAmount     numeric
cookPayoutAmount      numeric
currency              text (default: CAD)
stripePaymentIntentId text
stripeChargeId        text
stripeTransferId      text
stripeRefundId        text
authorizedAt          timestamp
heldAt                timestamp
releasedAt            timestamp
refundedAt            timestamp
createdAt             timestamp
updatedAt             timestamp
```

**`cook_payouts`**
```
id              uuid (PK)
cookId          uuid (FK → cook_profiles)
stripePayoutId  text (unique)
amount          numeric
currency        text (default: CAD)
status          payoutStatus
arrivalDate     date
periodStart     date
periodEnd       date
createdAt       timestamp
updatedAt       timestamp
```

**`cook_agreements`** — platform fee rate history per cook
```
id              uuid (PK)
cookId          uuid (FK → cook_profiles)
createdBy       text (FK → user, admin who set it)
platformFeePct  numeric
effectiveFrom   date
effectiveUntil  date
notes           text
createdAt       timestamp
```

**`stripe_webhook_events`** — idempotency ledger (service role only)
```
id          text (PK — Stripe event ID)
type        text
receivedAt  timestamp
```

### 7.7 Subscriptions (`db/schema/subscriptions.ts`)

**`listing_subscription_tiers`**
```
id              uuid (PK)
listingId       uuid (FK → listings, cascade)
interval        subscriptionInterval
price           numeric
stripePriceId   text
isActive        boolean
createdAt       timestamp
updatedAt       timestamp
```

**`client_subscriptions`**
```
id                    uuid (PK)
clientId              text (FK → user)
listingId             uuid (FK → listings)
tierId                uuid (FK → listing_subscription_tiers)
cookId                uuid (FK → cook_profiles)
status                subscriptionStatus
stripeSubscriptionId  text (unique)
stripeCustomerId      text
currentPeriodStart    timestamp
currentPeriodEnd      timestamp
cancelAtPeriodEnd     boolean
cancelledAt           timestamp
createdAt             timestamp
updatedAt             timestamp
```

### 7.8 Messaging (`db/schema/messaging.ts`)

**`conversations`**
```
id             uuid (PK)
cookId         uuid (FK → cook_profiles)
clientId       text (FK → user)
orderId        uuid (FK → orders, set null)
lastMessageAt  timestamp
createdAt      timestamp
```

**`messages`**
```
id               uuid (PK)
conversationId   uuid (FK → conversations, cascade)
senderRole       text (cook | client)
body             text
isReadByCook     boolean
isReadByClient   boolean
createdAt        timestamp
```

### 7.9 Notifications (`db/schema/notifications.ts`)

**`cook_notification_reads`**
```
id          uuid (PK)
cookId      uuid (FK → cook_profiles)
entityType  notificationEntityTypeEnum
entityId    uuid
readAt      timestamp
```

### 7.10 Tags (`db/schema/tags.ts`)

**`tags`**
```
id         uuid (PK)
slug       text (unique)
label      text
category   text
createdAt  timestamp
```

**`cook_profile_tags`**
```
cookProfileId  uuid (FK → cook_profiles, cascade)
tagId          uuid (FK → tags, cascade)
```

### 7.11 Pickup Windows (`db/schema/cook_pickup_windows.ts`)

**`cook_pickup_windows`**
```
id           uuid (PK)
cookId       uuid (FK → cook_profiles)
dayOfWeek    integer (0=Sunday … 6=Saturday)
fromTime     time
toTime       time
```

Unique index: `(cookId, dayOfWeek)` — one window per day per cook.

### 7.12 Waitlist & Rate Limiting (`db/schema/waitlist.ts`)

**`waitlist`** — landing page signups
```
id         uuid (PK)
email      text (unique)
ipHash     text
createdAt  timestamp
```

**`rate_limit_log`**
```
id           uuid (PK)
ipHash       text
attemptedAt  timestamp
```

---

## 8. Tech Stack Reminders

- **Framework:** Next.js 16, App Router only (no Pages Router)
- **React:** v19, Server Components by default — `"use client"` only when strictly required (event handlers, browser APIs, state, effects)
- **ORM:** Drizzle with `drizzle-orm/neon-http`, client at `@/db`
- **Auth:** Better Auth — check session server-side with the Better Auth server client
- **Styling:** Vanilla CSS + CSS Modules (no Tailwind, no CSS-in-JS)
- **TypeScript:** Strict mode, `@/` maps to `my-app/`
- **Linting/Formatting:** Biome — run `pnpm lint` and `pnpm format` on touched files
- **Package manager:** pnpm

---

## 9. File Structure Conventions

Admin panel files go here:

```
app/
  admin/
    layout.tsx              ← sidebar shell, auth guard
    page.tsx                ← dashboard
    applications/
      page.tsx              ← list
      [id]/
        page.tsx            ← detail + approve/reject/reissue
    cooks/
      page.tsx
      [cookId]/
        page.tsx
    certifications/
      page.tsx
    listings/
      page.tsx
    users/
      page.tsx
      [userId]/
        page.tsx
    orders/
      page.tsx
      [orderId]/
        page.tsx
    reviews/
      page.tsx
    analytics/
      page.tsx
  api/
    admin/
      applications/
        [id]/
          approve/route.ts
          reject/route.ts
          reissue-link/route.ts
      cooks/
        [cookId]/
          status/route.ts
          fee/route.ts
      certifications/
        [certId]/
          review/route.ts
      listings/
        [listingId]/
          review/route.ts
      users/
        [userId]/
          role/route.ts
          status/route.ts
      reviews/
        [reviewId]/
          visibility/route.ts
```

CSS Modules for admin components go in the same directory as the component, e.g. `app/admin/applications/Applications.module.css`.
