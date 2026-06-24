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
