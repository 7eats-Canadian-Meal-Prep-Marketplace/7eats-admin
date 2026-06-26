import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  text,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";

const isAdmin = sql`auth.role() = 'admin'`;

export const cookPickupWindows = pgTable(
  "cook_pickup_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: text("day_of_week").notNull(),
    fromTime: time("from_time", { precision: 0 }).notNull(),
    toTime: time("to_time", { precision: 0 }).notNull(),
    windowType: text("window_type").notNull().default("pickup"),
  },
  (t) => [
    uniqueIndex("cpw_cook_day_uidx").on(t.cookId, t.dayOfWeek),
    check("cpw_time_order", sql`${t.toTime} > ${t.fromTime}`),
    check(
      "cpw_day_valid",
      sql`${t.dayOfWeek} IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')`,
    ),
    pgPolicy("cpw_select_public", {
      for: "select",
      to: "public",
      using: sql`EXISTS (
        SELECT 1 FROM cook_profiles cp
        INNER JOIN "user" u ON u.id = cp.user_id
        WHERE cp.id = cook_pickup_windows.cook_id AND u.status = 'active'
      )`,
    }),
    pgPolicy("cpw_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cpw_update_own", {
      for: "update",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
      withCheck: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cpw_delete_own", {
      for: "delete",
      to: "public",
      using: sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cpw_all_admin", {
      for: "all",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();
