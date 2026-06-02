import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { subscriptionInterval, subscriptionStatus } from "./enums";
import { listings } from "./listings";

const isAdmin = sql`auth.role() = 'admin'`;
const isServiceRole = sql`auth.role() = 'service_role'`;

// ─── Listing Subscription Tiers ───────────────────────────────────────────────
// One row per interval option a cook offers on a subscription listing.
// At most one tier per (listing, interval) pair — enforced by unique index.

export const listingSubscriptionTiers = pgTable(
  "listing_subscription_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    interval: subscriptionInterval("interval").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    stripePriceId: text("stripe_price_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("listing_interval_uidx").on(t.listingId, t.interval),
    check("tier_price_positive", sql`${t.price} > 0`),
    pgPolicy("tiers_select_public", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active') AND is_active = TRUE`,
    }),
    pgPolicy("tiers_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("tiers_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("tiers_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("tiers_update_service", {
      for: "update",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
    pgPolicy("tiers_delete_service", {
      for: "delete",
      to: "public",
      using: isServiceRole,
    }),
  ],
).enableRLS();

// ─── Client Subscriptions ─────────────────────────────────────────────────────
// One row per client-listing-tier subscription. Source of truth for who is
// subscribed to what. The Stripe subscription ID is the join key for webhooks.

export const clientSubscriptions = pgTable(
  "client_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => listingSubscriptionTiers.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").notNull().default("active"),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (_t) => [
    pgPolicy("subscriptions_select_client", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("subscriptions_select_cook", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("subscriptions_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("subscriptions_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("subscriptions_update_service", {
      for: "update",
      to: "public",
      using: isServiceRole,
    }),
    // No delete policy — cancellation is via status field update, never hard DELETE.
    // Default-deny on DELETE is intentional.
  ],
).enableRLS();
