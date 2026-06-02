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
import { lateCancelFeeTypeEnum, orderStatus } from "./enums";
import { listingPromotions, listings } from "./listings";
import { clientSubscriptions } from "./subscriptions";

const isAdmin = sql`auth.role() = 'admin'`;
const currentCookOwnsOrder = sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    quantity: integer("quantity").notNull().default(1),
    // Price of one listing unit at time of order — immutable after insert
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    // Promotion applied at time of order (null = no promotion)
    promotionId: uuid("promotion_id").references(() => listingPromotions.id, {
      onDelete: "set null",
    }),
    // Dollar amount discounted; null when no promotion applied
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
    // total_price = unit_price * quantity - COALESCE(discount_amount, 0)
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
    pickupAt: timestamp("pickup_at").notNull(),
    fulfilledAt: timestamp("fulfilled_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => authUser.id, {
      onDelete: "set null",
    }),
    lateCancelFee: numeric("late_cancel_fee", { precision: 10, scale: 2 }),
    notes: text("notes"),
    subscriptionId: uuid("subscription_id").references(
      () => clientSubscriptions.id,
      { onDelete: "set null" },
    ),
    pickupCodeHash: text("pickup_code_hash"),
    pickupCodeExpiresAt: timestamp("pickup_code_expires_at"),
    pickupCodeVerifiedAt: timestamp("pickup_code_verified_at"),
    pickupCodeAttempts: integer("pickup_code_attempts").notNull().default(0),
    lateCancelFeeEnabled: boolean("late_cancel_fee_enabled")
      .notNull()
      .default(false),
    lateCancelFeeType: lateCancelFeeTypeEnum("late_cancel_fee_type"),
    lateCancelFeeValue: numeric("late_cancel_fee_value", {
      precision: 10,
      scale: 2,
    }),
    lateCancelWindowHours: integer("late_cancel_window_hours"),
    lateCancelFeeApplied: numeric("late_cancel_fee_applied", {
      precision: 10,
      scale: 2,
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("orders_subscription_period_uidx").on(
      t.subscriptionId,
      t.pickupAt,
    ),
    check("orders_quantity_positive", sql`${t.quantity} >= 1`),
    check("orders_unit_price_positive", sql`${t.unitPrice} > 0`),
    check(
      "orders_discount_non_negative",
      sql`${t.discountAmount} IS NULL OR ${t.discountAmount} >= 0`,
    ),
    check("orders_total_price_non_negative", sql`${t.totalPrice} >= 0`),
    check(
      "orders_pickup_code_attempts_non_negative",
      sql`${t.pickupCodeAttempts} >= 0`,
    ),
    check(
      "orders_late_cancel_fee_applied_non_negative",
      sql`${t.lateCancelFeeApplied} IS NULL OR ${t.lateCancelFeeApplied} >= 0`,
    ),
    pgPolicy("orders_select_client", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid()`,
    }),
    pgPolicy("orders_select_cook", {
      for: "select",
      to: "public",
      using: currentCookOwnsOrder,
    }),
    pgPolicy("orders_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("orders_insert_client", {
      for: "insert",
      to: "public",
      withCheck: sql`
        client_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM listings l
          WHERE l.id = orders.listing_id
            AND l.status = 'active'
            AND l.cook_id = orders.cook_id
            AND l.base_price = orders.unit_price
        )
        AND orders.total_price = orders.unit_price * orders.quantity - COALESCE(orders.discount_amount, 0)
        AND (
          orders.promotion_id IS NULL
          OR EXISTS (
            SELECT 1 FROM listing_promotions lp
            WHERE lp.id = orders.promotion_id
              AND lp.listing_id = orders.listing_id
              AND lp.is_active = TRUE
              AND (lp.valid_from IS NULL OR lp.valid_from <= NOW())
              AND (lp.valid_until IS NULL OR lp.valid_until > NOW())
              AND (lp.max_uses IS NULL OR lp.uses_count < lp.max_uses)
          )
        )
      `,
    }),
    pgPolicy("orders_update_client", {
      for: "update",
      to: "public",
      using: sql`client_id = auth.uid() AND status = 'pending'`,
      withCheck: sql`client_id = auth.uid() AND status IN ('pending', 'cancelled')`,
    }),
    pgPolicy("orders_update_cook", {
      for: "update",
      to: "public",
      using: sql`${currentCookOwnsOrder} AND status IN ('pending', 'confirmed', 'ready')`,
      withCheck: sql`${currentCookOwnsOrder} AND status IN ('confirmed', 'ready', 'fulfilled', 'cancelled')`,
    }),
    pgPolicy("orders_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();

// ─── Order Dishes ─────────────────────────────────────────────────────────────
// Immutable snapshot of the listing's dish composition at order time.
// Protects both parties: customer knows what they contracted for; cook knows
// what to make even if the listing changes after the order is placed.

export const orderDishes = pgTable(
  "order_dishes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // restrict: a dish row cannot be hard-deleted while referenced by any order
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "restrict" }),
    // Snapshot of dish name at order time — preserved if dish is later renamed
    dishName: varchar("dish_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    // A dish can only appear once per order snapshot
    uniqueIndex("order_dishes_order_dish_uidx").on(t.orderId, t.dishId),
    check("order_dishes_quantity_positive", sql`${t.quantity} >= 1`),
    pgPolicy("order_dishes_select_client", {
      for: "select",
      to: "public",
      using: sql`order_id IN (SELECT id FROM orders WHERE client_id = auth.uid())`,
    }),
    pgPolicy("order_dishes_select_cook", {
      for: "select",
      to: "public",
      using: sql`order_id IN (
        SELECT o.id FROM orders o
        JOIN cook_profiles cp ON o.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("order_dishes_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    // Only the API (service_role) writes this at order creation — never the client directly
    pgPolicy("order_dishes_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    // No update or delete — order_dishes is an immutable contract snapshot
  ],
).enableRLS();

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    cookResponse: text("cook_response"),
    cookResponseAt: timestamp("cook_response_at"),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
    pgPolicy("reviews_select_visible", {
      for: "select",
      to: "public",
      using: sql`is_visible = TRUE`,
    }),
    pgPolicy("reviews_select_own", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid() OR cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("reviews_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("reviews_insert_client", {
      for: "insert",
      to: "public",
      withCheck: sql`
        client_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = reviews.order_id
            AND o.client_id = auth.uid()
            AND o.status = 'fulfilled'
            AND o.cook_id = reviews.cook_id
            AND o.listing_id = reviews.listing_id
        )
      `,
    }),
    pgPolicy("reviews_update_own", {
      for: "update",
      to: "public",
      using: sql`client_id = auth.uid()`,
      withCheck: sql`client_id = auth.uid()`,
    }),
    pgPolicy("reviews_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();
