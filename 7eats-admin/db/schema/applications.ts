import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { applicationStatus, kitchenType } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;
const isService = sql`auth.role() = 'service_role'`;

export const cookApplications = pgTable(
  "cook_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenName: text("kitchen_name").notNull(),
    kitchenType: kitchenType("kitchen_type").notNull(),
    yearsOperating: text("years_operating").notNull(),
    streetAddress: text("street_address").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    website: text("website"),
    businessPhone: text("business_phone").notNull(),
    businessEmail: text("business_email").notNull(),
    contactFirstName: text("contact_first_name").notNull(),
    contactLastName: text("contact_last_name").notNull(),
    contactRole: text("contact_role").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email").notNull(),
    status: applicationStatus("status").notNull().default("pending_review"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("cook_applications_contact_email_idx").on(table.contactEmail),
    pgPolicy("applications_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isService,
    }),
    pgPolicy("applications_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("applications_select_service", {
      for: "select",
      to: "public",
      using: isService,
    }),
    pgPolicy("applications_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("applications_update_service", {
      for: "update",
      to: "public",
      using: isService,
      withCheck: isService,
    }),
  ],
).enableRLS();

export const setupTokens = pgTable(
  "setup_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => cookApplications.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    pgPolicy("setup_tokens_service_only", {
      for: "all",
      to: "public",
      using: isService,
      withCheck: isService,
    }),
  ],
).enableRLS();
