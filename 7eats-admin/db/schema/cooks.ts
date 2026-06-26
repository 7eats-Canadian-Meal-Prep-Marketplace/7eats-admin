import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookApplications } from "./applications";
import { authUser } from "./auth";
import {
  certificationStatus,
  deliveryEnum,
  lateCancelFeeTypeEnum,
  leadTimeEnum,
} from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;

export const cookProfiles = pgTable(
  "cook_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => authUser.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .unique()
      .references(() => cookApplications.id),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    socialLink: text("social_link"),
    currentSetupStep: integer("current_setup_step").notNull().default(1),
    setupComplete: boolean("setup_complete").notNull().default(false),
    pickupAddress: text("pickup_address"),
    leadTime: leadTimeEnum("lead_time"),
    delivery: deliveryEnum("delivery"),
    acceptsSpecialRequests: boolean("accepts_special_requests")
      .notNull()
      .default(false),
    stripeAccountId: text("stripe_account_id"),
    platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("7.5"),
    lateCancelFeeEnabled: boolean("late_cancel_fee_enabled")
      .notNull()
      .default(false),
    lateCancelFeeType: lateCancelFeeTypeEnum("late_cancel_fee_type"),
    lateCancelFeeValue: numeric("late_cancel_fee_value", {
      precision: 10,
      scale: 2,
    }),
    lateCancelWindowHours: integer("late_cancel_window_hours")
      .notNull()
      .default(24),
    tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
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
    emailNotificationsNewOrder: boolean("email_notifications_new_order")
      .notNull()
      .default(true),
    emailNotificationsNewReview: boolean("email_notifications_new_review")
      .notNull()
      .default(true),
    smsNotificationsNewOrder: boolean("sms_notifications_new_order")
      .notNull()
      .default(false),
    pickupStreet: text("pickup_street"),
    pickupUnit: text("pickup_unit"),
    pickupCity: text("pickup_city"),
    pickupProvince: text("pickup_province"),
    pickupPostal: text("pickup_postal"),
    pickupLat: doublePrecision("pickup_lat"),
    pickupLng: doublePrecision("pickup_lng"),
    pickupPlaceId: text("pickup_place_id"),
    maxDeliveryKm: integer("max_delivery_km"),
    deliveryRatePerKm: numeric("delivery_rate_per_km", {
      precision: 6,
      scale: 2,
    }),
    deliveryFlatFee: numeric("delivery_flat_fee", { precision: 6, scale: 2 })
      .default("0"),
    freeDeliveryAbove: numeric("free_delivery_above", {
      precision: 8,
      scale: 2,
    }),
    minOrderQty: integer("min_order_qty").notNull().default(1),
    maxOrderQty: integer("max_order_qty"),
    cancellationAllowed: boolean("cancellation_allowed")
      .notNull()
      .default(false),
    bannerUrl: text("banner_url"),
    offersPickup: boolean("offers_pickup").notNull().default(true),
  },
  (t) => [
    check(
      "cook_profiles_fee_pct_valid",
      sql`${t.platformFeePct} > 0 AND ${t.platformFeePct} <= 100`,
    ),
    check(
      "cook_profiles_late_cancel_fee_positive",
      sql`${t.lateCancelFeeValue} IS NULL OR ${t.lateCancelFeeValue} > 0`,
    ),
    check(
      "cook_profiles_late_cancel_window_positive",
      sql`${t.lateCancelWindowHours} >= 1`,
    ),
    pgPolicy("cook_profiles_select_active", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM "user" u WHERE u.id = cook_profiles.user_id AND u.status = 'active')`,
    }),
    pgPolicy("cook_profiles_update_own", {
      for: "update",
      to: "public",
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy("cook_profiles_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("cook_profiles_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();

export const cookCertifications = pgTable(
  "cook_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    holderName: text("holder_name").notNull(),
    issuer: varchar("issuer", { length: 255 }),
    certificateNumber: varchar("certificate_number", { length: 100 }),
    province: varchar("province", { length: 50 }),
    issuedAt: timestamp("issued_at"),
    expiresAt: timestamp("expires_at"),
    fileUrl: text("file_url"),
    status: certificationStatus("status").notNull().default("pending_review"),
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
  },
  () => [
    pgPolicy("certs_select_own", {
      for: "select",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("certs_select_approved", {
      for: "select",
      to: "public",
      using: sql`status = 'approved'`,
    }),
    pgPolicy("certs_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("certs_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`
        cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())
        AND status = 'pending_review'
        AND reviewed_at IS NULL
        AND reviewed_by IS NULL
        AND review_notes IS NULL
      `,
    }),
    pgPolicy("certs_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("certs_delete_own_pending", {
      for: "delete",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()) AND status = 'pending_review'`,
    }),
  ],
).enableRLS();
