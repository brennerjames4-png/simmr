import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  pgEnum,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Ingredient type for post recipes
export type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
};

// Kitchen inventory type for user profiles
export type KitchenInventory = {
  pots: { small: number; medium: number; large: number };
  pans: { small: number; medium: number; large: number };
  baking: {
    baking_sheet: number;
    cake_pan: number;
    muffin_tin: number;
    loaf_pan: number;
    pie_dish: number;
  };
  appliances: {
    oven: boolean;
    microwave: boolean;
    toaster: boolean;
    blender: boolean;
    food_processor: boolean;
    stand_mixer: boolean;
    slow_cooker: boolean;
    pressure_cooker: boolean;
    air_fryer: boolean;
    grill: boolean;
  };
  prep_tools: {
    cutting_boards: number;
    mixing_bowls: boolean;
    colander: boolean;
    measuring_cups: boolean;
    rolling_pin: boolean;
    whisk: boolean;
    tongs: boolean;
    spatula: boolean;
    ladle: boolean;
    peeler: boolean;
    grater: boolean;
    mortar_and_pestle: boolean;
  };
  specialty: {
    wok: boolean;
    dutch_oven: boolean;
    cast_iron_skillet: boolean;
    griddle: boolean;
    steamer: boolean;
    deep_fryer: boolean;
  };
};

export const difficultyEnum = pgEnum("difficulty_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).unique().notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  kitchenInventory: jsonb("kitchen_inventory").$type<KitchenInventory>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const posts = pgTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    recipeNotes: text("recipe_notes"),
    imageUrl: text("image_url"),
    imageKey: text("image_key"),
    tags: text("tags")
      .array()
      .default(sql`'{}'`),
    cookTime: integer("cook_time"),
    difficulty: difficultyEnum("difficulty"),
    servings: integer("servings"),
    ingredients: jsonb("ingredients").$type<Ingredient[]>(),
    aiTip: text("ai_tip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_posts_user_id").on(table.userId),
    index("idx_posts_created_at").on(table.createdAt),
  ]
);

export const likes = pgTable(
  "likes",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("likes_user_post_unique").on(table.userId, table.postId),
    index("idx_likes_post_id").on(table.postId),
    index("idx_likes_user_id").on(table.userId),
  ]
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
