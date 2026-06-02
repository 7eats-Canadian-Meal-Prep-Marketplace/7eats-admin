import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { cookProfiles } from "./cooks";
import { orders } from "./orders";

const currentCookOwnsConversation = sql`cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)`;

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One conversation per (cook, client, order) triple when orderId is present
    uniqueIndex("conversations_cook_client_order_uidx")
      .on(t.cookId, t.clientId, t.orderId)
      .where(sql`${t.orderId} IS NOT NULL`),
    index("conversations_cook_id_idx").on(t.cookId),
    index("conversations_last_message_at_idx").on(t.lastMessageAt),
    pgPolicy("conversations_select_cook", {
      for: "select",
      to: "public",
      using: currentCookOwnsConversation,
    }),
    pgPolicy("conversations_select_client", {
      for: "select",
      to: "public",
      using: sql`client_id = auth.uid()::text`,
    }),
    pgPolicy("conversations_insert_service", {
      for: "insert",
      to: "public",
      withCheck: sql`auth.role() = 'service_role'`,
    }),
    pgPolicy("conversations_update_cook", {
      for: "update",
      to: "public",
      using: currentCookOwnsConversation,
    }),
  ],
).enableRLS();

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderRole: text("sender_role").notNull(),
    body: text("body").notNull(),
    isReadByCook: boolean("is_read_by_cook").notNull().default(false),
    isReadByClient: boolean("is_read_by_client").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_conversation_id_idx").on(t.conversationId),
    pgPolicy("messages_select_cook", {
      for: "select",
      to: "public",
      using: sql`conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      )`,
    }),
    pgPolicy("messages_select_client", {
      for: "select",
      to: "public",
      using: sql`conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      )`,
    }),
    pgPolicy("messages_insert_cook", {
      for: "insert",
      to: "public",
      withCheck: sql`
        sender_role = 'cook'
        AND conversation_id IN (
          SELECT id FROM conversations
          WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
        )
      `,
    }),
    pgPolicy("messages_insert_client", {
      for: "insert",
      to: "public",
      withCheck: sql`
        sender_role = 'client'
        AND conversation_id IN (
          SELECT id FROM conversations WHERE client_id = auth.uid()::text
        )
      `,
    }),
    pgPolicy("messages_update_cook", {
      for: "update",
      to: "public",
      using: sql`conversation_id IN (
        SELECT id FROM conversations
        WHERE cook_id IN (SELECT id FROM cook_profiles WHERE user_id = auth.uid()::text)
      )`,
    }),
    pgPolicy("messages_update_client", {
      for: "update",
      to: "public",
      using: sql`conversation_id IN (
        SELECT id FROM conversations WHERE client_id = auth.uid()::text
      )`,
    }),
  ],
).enableRLS();
