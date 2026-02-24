import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
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

// Recipe step type for post recipes
export type RecipeStep = {
  step_number: number;
  instruction: string;
  duration_minutes?: number;
};

// Combined recipe type returned by AI generation
export type GeneratedRecipe = {
  ingredients: Ingredient[];
  steps: RecipeStep[];
};

// Inspiration system types
export type InspirationIngredient = Ingredient & {
  source: "provided" | "inferred" | "pantry";
};

export type InspirationRecipe = {
  title: string;
  description: string;
  ingredients: InspirationIngredient[];
  steps: RecipeStep[];
  cookTime: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  servings: number;
  equipmentUsed: string[];
  dietaryNotes: string | null;
  newSkills?: string[];
};

// Skill system types
export type SkillTier =
  | "prep_cook"
  | "line_cook"
  | "sous_chef"
  | "head_chef"
  | "iron_chef";

export type SkillCategory =
  | "technique"
  | "knife_work"
  | "baking_pastry"
  | "specialty";

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
  customEquipment?: Array<{ name: string; count: number }>;
};

export const difficultyEnum = pgEnum("difficulty_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const postStatusEnum = pgEnum("post_status", ["draft", "published"]);

export const followStatusEnum = pgEnum("follow_status", [
  "pending",
  "accepted",
  "blocked",
]);

export const skillTierEnum = pgEnum("skill_tier", [
  "prep_cook",
  "line_cook",
  "sous_chef",
  "head_chef",
  "iron_chef",
]);

export const skillCategoryEnum = pgEnum("skill_category", [
  "technique",
  "knife_work",
  "baking_pastry",
  "specialty",
]);

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 50 }).unique().notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    authProvider: text("auth_provider").default("credentials").notNull(),
    googleId: text("google_id").unique(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    isPrivate: boolean("is_private").default(false).notNull(),
    kitchenInventory: jsonb("kitchen_inventory").$type<KitchenInventory>(),
    dietaryPreferences: text("dietary_preferences")
      .array()
      .default(sql`'{}'`),
    foodExclusions: text("food_exclusions")
      .array()
      .default(sql`'{}'`),
    bypassCode: varchar("bypass_code", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_users_display_name").on(table.displayName),
    index("idx_users_google_id").on(table.googleId),
  ]
);

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
    steps: jsonb("steps").$type<RecipeStep[]>(),
    aiTip: text("ai_tip"),
    status: postStatusEnum("status").notNull().default("published"),
    source: text("source").notNull().default("manual"),
    aiRecipe: jsonb("ai_recipe").$type<InspirationRecipe>(),
    allocatedSkillIds: text("allocated_skill_ids")
      .array()
      .default(sql`'{}'`),
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
    index("idx_posts_user_status").on(table.userId, table.status),
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

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 255 }).notNull(),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_verification_tokens_token").on(table.token),
    index("idx_verification_tokens_email").on(table.email),
  ]
);

export const follows = pgTable(
  "follows",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: followStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("follows_follower_following_unique").on(
      table.followerId,
      table.followingId
    ),
    index("idx_follows_following_status").on(table.followingId, table.status),
    index("idx_follows_follower_status").on(table.followerId, table.status),
  ]
);

export const skills = pgTable(
  "skills",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).unique().notNull(),
    tier: skillTierEnum("tier").notNull(),
    category: skillCategoryEnum("category").notNull(),
    description: varchar("description", { length: 255 }),
    videoUrl: text("video_url"),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_skills_name").on(table.name),
    index("idx_skills_tier").on(table.tier),
    index("idx_skills_category").on(table.category),
  ]
);

export const userSkills = pgTable(
  "user_skills",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .references(() => posts.id, { onDelete: "set null" }),
    practiceCount: integer("practice_count").default(1).notNull(),
    mastered: boolean("mastered").default(false).notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
  },
  (table) => [
    unique("user_skills_user_skill_unique").on(table.userId, table.skillId),
    index("idx_user_skills_user_id").on(table.userId),
    index("idx_user_skills_skill_id").on(table.skillId),
    index("idx_user_skills_post_id").on(table.postId),
  ]
);

export const recipeCorpus = pgTable(
  "recipe_corpus",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dishNameNormalized: varchar("dish_name_normalized", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients").$type<Ingredient[]>(),
    steps: jsonb("steps").$type<RecipeStep[]>(),
    cookTime: integer("cook_time"),
    difficulty: difficultyEnum("difficulty"),
    servings: integer("servings"),
    tags: text("tags")
      .array()
      .default(sql`'{}'`),
    dietaryTags: text("dietary_tags")
      .array()
      .default(sql`'{}'`),
    foodExclusions: text("food_exclusions")
      .array()
      .default(sql`'{}'`),
    appliancesUsed: text("appliances_used")
      .array()
      .default(sql`'{}'`),
    cuisineTags: text("cuisine_tags")
      .array()
      .default(sql`'{}'`),
    source: text("source").notNull(),
    sourceUserId: text("source_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    inspirationMetadata: jsonb("inspiration_metadata").$type<InspirationRecipe>(),
    qualityScore: integer("quality_score").default(0),
    timesServed: integer("times_served").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_corpus_dish_name").on(table.dishNameNormalized),
    index("idx_corpus_difficulty").on(table.difficulty),
    index("idx_corpus_servings").on(table.servings),
    index("idx_corpus_source").on(table.source),
    index("idx_corpus_created_at").on(table.createdAt),
  ]
);

export const cookingTipsCache = pgTable(
  "cooking_tips_cache",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dishNameNormalized: varchar("dish_name_normalized", { length: 200 }).notNull(),
    tipText: text("tip_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_cooking_tips_dish_name").on(table.dishNameNormalized),
  ]
);

export const skillExtractionCache = pgTable(
  "skill_extraction_cache",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    stepsHash: varchar("steps_hash", { length: 64 }).notNull().unique(),
    recipeTitle: varchar("recipe_title", { length: 200 }).notNull(),
    extractedSkills: jsonb("extracted_skills").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_skill_extraction_steps_hash").on(table.stepsHash),
  ]
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type UserSkill = typeof userSkills.$inferSelect;
export type NewUserSkill = typeof userSkills.$inferInsert;
export type RecipeCorpusEntry = typeof recipeCorpus.$inferSelect;
export type NewRecipeCorpusEntry = typeof recipeCorpus.$inferInsert;
export type CookingTipCache = typeof cookingTipsCache.$inferSelect;
export type NewCookingTipCache = typeof cookingTipsCache.$inferInsert;
export type SkillExtractionCache = typeof skillExtractionCache.$inferSelect;
export type NewSkillExtractionCache = typeof skillExtractionCache.$inferInsert;
