import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { accountStatus, userRole } from "./enums";

const isAdmin = sql`auth.role() = 'admin'`;
const isServiceRole = sql`auth.role() = 'service_role'`;

export const authUser = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    // App-specific fields
    role: userRole("role").notNull().default("cook"),
    status: accountStatus("status").notNull().default("active"),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    dateOfBirth: date("date_of_birth"),
    neighborhood: varchar("neighborhood", { length: 100 }),
    notificationPreferences: jsonb("notification_preferences"),
    isGuestAccount: boolean("is_guest_account").notNull().default(false),
  },
  () => [
    // Public read required: other tables' RLS policies JOIN this table to check
    // user.status (e.g. cook_profiles_select_active). Restricting select would
    // silently break anonymous browse flows.
    pgPolicy("user_select_all", {
      for: "select",
      to: "public",
      using: sql`true`,
    }),
    pgPolicy("user_insert_service", {
      for: "insert",
      to: "public",
      withCheck: isServiceRole,
    }),
    pgPolicy("user_update_own", {
      for: "update",
      to: "public",
      using: sql`id = auth.uid()::text`,
      withCheck: sql`id = auth.uid()::text`,
    }),
    pgPolicy("user_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("user_delete_admin", {
      for: "delete",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();

export const authSession = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  () => [
    pgPolicy("session_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const authAccount = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  () => [
    pgPolicy("account_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const authVerification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  () => [
    pgPolicy("verification_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();
