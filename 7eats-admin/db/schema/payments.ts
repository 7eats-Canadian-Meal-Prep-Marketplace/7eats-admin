import { sql } from "drizzle-orm";
import {
  check,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { paymentStatus, payoutStatus } from "./enums";
import { orders } from "./orders";

const isAdmin = sql`auth.role() = 'admin'`;

// ─── Cook Agreements ──────────────────────────────────────────────────────────
// Tracks platform fee rate history per cook. Admin-managed; a new row is
// inserted whenever the negotiated rate changes rather than updating in place.

export const cookAgreements = pgTable(
  "cook_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    platformFeePct: numeric("platform_fee_pct", {
      precision: 5,
      scale: 2,
    }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    notes: text("notes"),
    createdBy: text("created_by").references(() => authUser.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "cook_agreements_fee_pct_valid",
      sql`${t.platformFeePct} > 0 AND ${t.platformFeePct} <= 100`,
    ),
    pgPolicy("cook_agreements_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("cook_agreements_select_own_cook", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cook_agreements_insert_admin", {
      for: "insert",
      to: "public",
      withCheck: isAdmin,
    }),
    pgPolicy("cook_agreements_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();

// ─── Order Payments ───────────────────────────────────────────────────────────
// 1-to-1 with orders. Tracks the full escrow lifecycle from authorization
// through hold, release, or refund along with all Stripe identifiers.

export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    status: paymentStatus("status").notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    platformFeePct: numeric("platform_fee_pct", {
      precision: 5,
      scale: 2,
    }).notNull(),
    platformFeeAmount: numeric("platform_fee_amount", {
      precision: 10,
      scale: 2,
    }),
    cookPayoutAmount: numeric("cook_payout_amount", {
      precision: 10,
      scale: 2,
    }),
    currency: varchar("currency", { length: 3 }).default("CAD"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    stripeTransferId: text("stripe_transfer_id"),
    stripeRefundId: text("stripe_refund_id"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    heldAt: timestamp("held_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("order_payments_total_amount_positive", sql`${t.totalAmount} > 0`),
    check(
      "order_payments_fee_pct_valid",
      sql`${t.platformFeePct} > 0 AND ${t.platformFeePct} <= 100`,
    ),
    pgPolicy("order_payments_select_client", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("order_payments_select_cook", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("order_payments_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("order_payments_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("order_payments_update_service", {
      for: "update",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
  ],
).enableRLS();

// ─── Stripe Webhook Events ────────────────────────────────────────────────────
// Idempotency ledger for incoming Stripe webhooks. The primary key is the
// Stripe event id, so an `onConflictDoNothing` insert lets the handler detect
// and skip events Stripe has already delivered (retries are routine).

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    pgPolicy("stripe_webhook_events_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("stripe_webhook_events_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("stripe_webhook_events_delete_service", {
      for: "delete",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
  ],
).enableRLS();

// ─── Cook Payouts ─────────────────────────────────────────────────────────────
// Tracks Stripe Connect bank payouts to cook accounts. Written exclusively
// by the service role (webhook handler / payout scheduler).

export const cookPayouts = pgTable(
  "cook_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    stripePayoutId: text("stripe_payout_id").notNull().unique(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CAD"),
    status: payoutStatus("status").notNull(),
    arrivalDate: timestamp("arrival_date", { withTimezone: true }),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("cook_payouts_amount_positive", sql`${t.amount} > 0`),
    pgPolicy("cook_payouts_select_own_cook", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cook_payouts_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("cook_payouts_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("cook_payouts_update_service", {
      for: "update",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
  ],
).enableRLS();
