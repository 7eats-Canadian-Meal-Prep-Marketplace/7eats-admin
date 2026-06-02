import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cookProfiles } from "./cooks";
import { dishStatus } from "./enums";
import { tags } from "./tags";

const isAdmin = sql`auth.role() = 'admin'`;

// cook owns this dish
const ownDish = sql`cook_id IN (
  SELECT id FROM cook_profiles WHERE user_id = auth.uid()
)`;

// dish is part of at least one active listing (makes it publicly visible)
const dishInActiveListing = sql`id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
)`;

// helper for child tables: cook owns the parent dish
const ownDishChild = sql`dish_id IN (
  SELECT d.id FROM dishes d
  JOIN cook_profiles cp ON d.cook_id = cp.id
  WHERE cp.user_id = auth.uid()
)`;

// helper for child tables: parent dish is in an active listing
const dishChildInActiveListing = sql`dish_id IN (
  SELECT ld.dish_id FROM listing_dishes ld
  JOIN listings l ON l.id = ld.listing_id
  WHERE l.status = 'active'
)`;

// ─── Dish ────────────────────────────────────────────────────────────────────

export const dishes = pgTable(
  "dishes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cookProfiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // Culinary identity
    cuisine: varchar("cuisine", { length: 100 }),
    // Array of category slugs: weight_loss, muscle_gain, heart_health,
    // high_protein, low_carb, balanced, comfort_food, kids_friendly, etc.
    // Validated at application layer; stored as text[] for flexibility.
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    // Dietary flags — all default false; cooks opt-in
    isHalal: boolean("is_halal").notNull().default(false),
    isVegan: boolean("is_vegan").notNull().default(false),
    isVegetarian: boolean("is_vegetarian").notNull().default(false),
    isGlutenFree: boolean("is_gluten_free").notNull().default(false),
    isDairyFree: boolean("is_dairy_free").notNull().default(false),
    isNutFree: boolean("is_nut_free").notNull().default(false),
    isKosher: boolean("is_kosher").notNull().default(false),
    // Portion info
    servingSize: varchar("serving_size", { length: 100 }),
    // Workflow status — public visibility is derived from listing membership,
    // not from this field.
    status: dishStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [
    // Public: dish appears in at least one active listing
    pgPolicy("dishes_select_public", {
      for: "select",
      to: "public",
      using: dishInActiveListing,
    }),
    pgPolicy("dishes_select_own", {
      for: "select",
      to: "public",
      using: ownDish,
    }),
    pgPolicy("dishes_select_admin", {
      for: "select",
      to: "public",
      using: isAdmin,
    }),
    pgPolicy("dishes_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`cook_id IN (
        SELECT id FROM cook_profiles WHERE user_id = auth.uid()
      )`,
    }),
    pgPolicy("dishes_update_own", {
      for: "update",
      to: "public",
      using: ownDish,
      withCheck: ownDish,
    }),
    pgPolicy("dishes_update_admin", {
      for: "update",
      to: "public",
      using: isAdmin,
    }),
    // No delete policy — dishes are retired via status='archived', never deleted.
    // Hard-delete is blocked because order_dishes keeps a FK reference.
  ],
).enableRLS();

// ─── Dish Photos ─────────────────────────────────────────────────────────────

export const dishPhotos = pgTable(
  "dish_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("dish_photos_select_public", {
      for: "select",
      to: "public",
      using: dishChildInActiveListing,
    }),
    pgPolicy("dish_photos_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_photos_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_photos_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_photos_delete_own", {
      for: "delete",
      to: "public",
      using: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Ingredients ────────────────────────────────────────────────────────

export const dishIngredients = pgTable(
  "dish_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: varchar("quantity", { length: 100 }),
    isAllergen: boolean("is_allergen").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  () => [
    pgPolicy("dish_ingredients_select_public", {
      for: "select",
      to: "public",
      using: dishChildInActiveListing,
    }),
    pgPolicy("dish_ingredients_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_ingredients_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_ingredients_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_ingredients_delete_own", {
      for: "delete",
      to: "public",
      using: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Nutrition ──────────────────────────────────────────────────────────
// One-to-one with dishes. All fields optional — cooks fill in what they know.

export const dishNutrition = pgTable(
  "dish_nutrition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dishId: uuid("dish_id")
      .notNull()
      .unique()
      .references(() => dishes.id, { onDelete: "cascade" }),
    calories: integer("calories"),
    proteinG: numeric("protein_g", { precision: 6, scale: 2 }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 2 }),
    fatG: numeric("fat_g", { precision: 6, scale: 2 }),
    saturatedFatG: numeric("saturated_fat_g", { precision: 6, scale: 2 }),
    fiberG: numeric("fiber_g", { precision: 6, scale: 2 }),
    sugarG: numeric("sugar_g", { precision: 6, scale: 2 }),
    sodiumMg: numeric("sodium_mg", { precision: 8, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "nutrition_calories_positive",
      sql`${t.calories} IS NULL OR ${t.calories} >= 0`,
    ),
    check(
      "nutrition_protein_positive",
      sql`${t.proteinG} IS NULL OR ${t.proteinG} >= 0`,
    ),
    check(
      "nutrition_carbs_positive",
      sql`${t.carbsG} IS NULL OR ${t.carbsG} >= 0`,
    ),
    check("nutrition_fat_positive", sql`${t.fatG} IS NULL OR ${t.fatG} >= 0`),
    check(
      "nutrition_satfat_positive",
      sql`${t.saturatedFatG} IS NULL OR ${t.saturatedFatG} >= 0`,
    ),
    check(
      "nutrition_fiber_positive",
      sql`${t.fiberG} IS NULL OR ${t.fiberG} >= 0`,
    ),
    check(
      "nutrition_sugar_positive",
      sql`${t.sugarG} IS NULL OR ${t.sugarG} >= 0`,
    ),
    check(
      "nutrition_sodium_positive",
      sql`${t.sodiumMg} IS NULL OR ${t.sodiumMg} >= 0`,
    ),
    pgPolicy("dish_nutrition_select_public", {
      for: "select",
      to: "public",
      using: dishChildInActiveListing,
    }),
    pgPolicy("dish_nutrition_select_own", {
      for: "select",
      to: "public",
      using: ownDishChild,
    }),
    pgPolicy("dish_nutrition_insert_own", {
      for: "insert",
      to: "public",
      withCheck: ownDishChild,
    }),
    pgPolicy("dish_nutrition_update_own", {
      for: "update",
      to: "public",
      using: ownDishChild,
      withCheck: ownDishChild,
    }),
  ],
).enableRLS();

// ─── Dish Tags ───────────────────────────────────────────────────────────────

export const dishTags = pgTable(
  "dish_tags",
  {
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.dishId, t.tagId] }),
    pgPolicy("dish_tags_select_public", {
      for: "select",
      to: "public",
      using: sql`dish_id IN (
        SELECT ld.dish_id FROM listing_dishes ld
        JOIN listings l ON l.id = ld.listing_id
        WHERE l.status = 'active'
      )`,
    }),
    pgPolicy("dish_tags_select_own", {
      for: "select",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_tags_insert_own", {
      for: "insert",
      to: "public",
      withCheck: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
    pgPolicy("dish_tags_delete_own", {
      for: "delete",
      to: "public",
      using: sql`dish_id IN (
        SELECT d.id FROM dishes d
        JOIN cook_profiles cp ON d.cook_id = cp.id
        WHERE cp.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
