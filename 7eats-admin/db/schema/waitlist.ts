import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const isServiceRole = sql`auth.role() = 'service_role'`;

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    city: text("city"),
  },
  () => [
    pgPolicy("waitlist_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();

export const rateLimitLog = pgTable(
  "rate_limit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  () => [
    pgPolicy("rate_limit_log_service_only", {
      for: "all",
      to: "public",
      using: isServiceRole,
      withCheck: isServiceRole,
    }),
  ],
).enableRLS();
