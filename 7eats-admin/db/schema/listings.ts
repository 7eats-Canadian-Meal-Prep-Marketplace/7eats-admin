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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { dishes } from "./dishes";
import {
  lateCancelFeeTypeEnum,
  listingStatus,
  listingType,
  promotionType,
  subscriptionInterval,
} from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;

const ownListing = sql`cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
)`;

// ─── Listing ─────────────────────────────────────────────────────────────────

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // Subscription type: one_time now; subscription reserved for future use.
    type: listingType("type").notNull().default("one_time"),
    status: listingStatus("status").notNull().default("draft"),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
    // If null the UI generates a collage from the listing's dish photos.
    coverPhotoUrl: text("cover_photo_url"),
    stripeProductId: text("stripe_product_id"),
    minOrderQty: integer("min_order_qty").notNull().default(1),
    maxOrderQty: integer("max_order_qty"),
    // How many days before the next billing period a client must cancel/pause.
    // null = no restriction.
    cancellationNoticeDays: integer("cancellation_notice_days"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => authUser.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    depositEnabled: boolean("deposit_enabled").notNull().default(false),
    depositType: lateCancelFeeTypeEnum("deposit_type"),
    depositValue: numeric("deposit_value", { precision: 10, scale: 2 }),
    subscriptionInterval: subscriptionInterval("subscription_interval"),
    commitmentPeriods: integer("commitment_periods"),
    subscriptionEnabled: boolean("subscription_enabled")
      .notNull()
      .default(false),
    fulfillment: varchar("fulfillment", { length: 20 })
      .notNull()
      .default("pickup"),
  },
  (t) => [
    check("listings_base_price_positive", sql`${t.basePrice} > 0`),
    check("listings_min_order_qty_positive", sql`${t.minOrderQty} >= 1`),
    check(
      "listings_max_order_qty_valid",
      sql`${t.maxOrderQty} IS NULL OR ${t.maxOrderQty} >= ${t.minOrderQty}`,
    ),
    check(
      "listings_cancellation_notice_days_non_negative",
      sql`${t.cancellationNoticeDays} IS NULL OR ${t.cancellationNoticeDays} >= 0`,
    ),
    pgPolicy("listings_select_active", {
      for: "select",
      to: "public",
      using: sql`status = 'active'`,
    }),
    pgPolicy("listings_select_own", {
      for: "select",
      to: "public",
      using: ownListing,
    }),
    pgPolicy("listings_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listings_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'draft'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      `,
    }),
    pgPolicy("listings_update_own", {
      for: "update",
      to: "public",
      using: ownListing,
      withCheck: ownListing,
    }),
    pgPolicy("listings_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listings_delete_own_draft", {
      for: "delete",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'draft'`,
    }),
  ],
).enableRLS();

// ─── Listing Dishes ──────────────────────────────────────────────────────────
// Defines which dishes (and how many) make up a listing.
// Composition changes are blocked at API layer when non-cancelled orders exist.

export const listingDishes = pgTable(
  "listing_dishes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    // restrict: a dish row cannot be hard-deleted while referenced by any listing
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    // Same dish can only appear once per listing
    uniqueIndex("listing_dishes_listing_dish_uidx").on(t.listingId, t.dishId),
    check("listing_dishes_quantity_positive", sql`${t.quantity} >= 1`),
    // Public: only reveal composition of active listings
    pgPolicy("listing_dishes_select_public", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (SELECT id FROM listings WHERE status = 'active')`,
    }),
    pgPolicy("listing_dishes_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("listing_dishes_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    // A cook can only wire their own dishes into their own listings
    pgPolicy("listing_dishes_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`
        listing_id IN (
          SELECT l.id FROM listings l
          JOIN cook_profiles cp ON l.cook_id = cp.id
          WHERE cp.user_id = auth.uid()
        )
        AND dish_id IN (
          SELECT d.id FROM dishes d
          JOIN cook_profiles cp ON d.cook_id = cp.id
          WHERE cp.user_id = auth.uid()
        )
      `,
    }),
    pgPolicy("listing_dishes_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
      withCheck: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("listing_dishes_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();

// ─── Listing Promotions ──────────────────────────────────────────────────────

export const listingPromotions = pgTable(
  "listing_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    type: promotionType("type").notNull(),
    // percentage_off: 1–100. fixed_off: positive dollar amount. null for buy_x_get_y.
    value: numeric("value", { precision: 10, scale: 2 }),
    // Minimum order quantity to qualify for this promotion
    minimumQty: integer("minimum_qty").notNull().default(1),
    // null = unlimited redemptions
    maxUses: integer("max_uses"),
    // Incremented atomically by service_role during order placement
    usesCount: integer("uses_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("promo_value_positive", sql`${t.value} IS NULL OR ${t.value} > 0`),
    check(
      "promo_percentage_max",
      sql`${t.type} != 'percentage_off' OR (${t.value} IS NOT NULL AND ${t.value} <= 100)`,
    ),
    check(
      "promo_fixed_requires_value",
      sql`${t.type} != 'fixed_off' OR ${t.value} IS NOT NULL`,
    ),
    check("promo_minimum_qty_positive", sql`${t.minimumQty} >= 1`),
    check(
      "promo_max_uses_positive",
      sql`${t.maxUses} IS NULL OR ${t.maxUses} >= 1`,
    ),
    check("promo_uses_count_non_negative", sql`${t.usesCount} >= 0`),
    check(
      "promo_uses_count_cap",
      sql`${t.maxUses} IS NULL OR ${t.usesCount} <= ${t.maxUses}`,
    ),
    check(
      "promo_dates_order",
      sql`${t.validFrom} IS NULL OR ${t.validUntil} IS NULL OR ${t.validUntil} > ${t.validFrom}`,
    ),
    // Public: only surfaced when genuinely redeemable
    pgPolicy("listing_promotions_select_public", {
      for: "select",
      to: "public",
      using: sql`
        is_active = TRUE
        AND listing_id IN (SELECT id FROM listings WHERE status = 'active')
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      `,
    }),
    pgPolicy("listing_promotions_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("listing_promotions_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listing_promotions_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("listing_promotions_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    // Service role increments uses_count atomically on order placement
    pgPolicy("listing_promotions_update_service", {
      for: "update",
      to: "public",
      using: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("listing_promotions_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();

// ─── Listing Bundles ─────────────────────────────────────────────────────────
// Volume-price tiers for one_time listings (e.g. 3 wings for $10, 6 for $17).

export const listingBundles = pgTable(
  "listing_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("listing_bundles_listing_qty_uidx").on(t.listingId, t.quantity),
    check("bundle_quantity_positive", sql`${t.quantity} >= 1`),
    check("bundle_price_positive", sql`${t.price} > 0`),
    pgPolicy("listing_bundles_select_public", {
      for: "select",
      to: "public",
      using: sql`
        is_active = TRUE
        AND listing_id IN (SELECT id FROM listings WHERE status = 'active')
      `,
    }),
    pgPolicy("listing_bundles_select_own", {
      for: "select",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("listing_bundles_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("listing_bundles_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("listing_bundles_update_own", {
      for: "update",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
    pgPolicy("listing_bundles_delete_own", {
      for: "delete",
      to: "public",
      using: sql`listing_id IN (
        SELECT l.id FROM listings l
        JOIN cook_profiles cp ON l.cook_id = cp.id
        WHERE cp.user_id = auth.uid()::text
      )`,
    }),
  ],
).enableRLS();
