import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";
import { notificationEntityTypeEnum } from "./enums";

const ownCook = sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)`;

export const cookNotificationReads = pgTable(
  "cook_notification_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    entityType: notificationEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    readAt: timestamp("read_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cook_notif_reads_cook_entity_uidx").on(
      t.cookId,
      t.entityType,
      t.entityId,
    ),
    pgPolicy("notif_reads_select_own", {
      for: "select",
      to: "public",
      using: ownCook,
    }),
    pgPolicy("notif_reads_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownCook,
    }),
    pgPolicy("notif_reads_delete_own", {
      for: "delete",
      to: "public",
      using: ownCook,
    }),
    pgPolicy("notif_reads_all_admin", {
      for: "all",
      to: "public",
      using: sql`auth.role() = 'admin'`,
    }),
  ],
).enableRLS();
