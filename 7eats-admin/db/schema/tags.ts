import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";

const isAdmin = sql`auth.role() = 'admin'`;

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    label: varchar("label", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("tags_select_all", {
      for: "select",
      to: "public",
      using: sql`TRUE`,
    }),
    pgPolicy("tags_insert_admin", {
      for: "insert",
      to: "public",
      withCheck: isAdmin,
    }),
    pgPolicy("tags_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("tags_delete_admin", {
      for: "delete",
      to: "public",
      using: isAdmin,
    }),
  ],
).enableRLS();

export const cookProfileTags = pgTable(
  "cook_profile_tags",
  {
    cookProfileId: uuid("cook_profile_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.cookProfileId, table.tagId] }),
    pgPolicy("cook_profile_tags_select_public", {
      for: "select",
      to: "public",
      using: sql`true`,
    }),
    pgPolicy("cook_profile_tags_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
    pgPolicy("cook_profile_tags_delete_own", {
      for: "delete",
      to: "public",
      using: sql`cook_profile_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid())`,
    }),
  ],
).enableRLS();
