CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('technique', 'knife_work', 'baking_pastry', 'specialty');--> statement-breakpoint
CREATE TYPE "public"."skill_tier" AS ENUM('prep_cook', 'line_cook', 'sous_chef', 'head_chef', 'iron_chef');--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" text NOT NULL,
	"post_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_post_unique" UNIQUE("collection_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_user_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "cooking_tips_cache" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_name_normalized" varchar(200) NOT NULL,
	"tip_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corpus_analytics" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" varchar(50) NOT NULL,
	"served_from" varchar(20) NOT NULL,
	"dish_name_normalized" varchar(200),
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"status" "follow_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_following_unique" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"plan_data" jsonb NOT NULL,
	"household_size" integer DEFAULT 2 NOT NULL,
	"schedule" jsonb,
	"shopping_checked_items" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_normalized" varchar(100) NOT NULL,
	"quantity" varchar(50),
	"unit" varchar(30),
	"category" varchar(30) NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_corpus" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_name_normalized" varchar(200) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"ingredients" jsonb,
	"steps" jsonb,
	"cook_time" integer,
	"difficulty" "difficulty_level",
	"servings" integer,
	"tags" text[] DEFAULT '{}',
	"dietary_tags" text[] DEFAULT '{}',
	"food_exclusions" text[] DEFAULT '{}',
	"appliances_used" text[] DEFAULT '{}',
	"cuisine_tags" text[] DEFAULT '{}',
	"meal_type" text,
	"nutrition" jsonb,
	"source" text NOT NULL,
	"source_user_id" text,
	"inspiration_metadata" jsonb,
	"quality_score" integer DEFAULT 0,
	"times_served" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ratings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_title" varchar(200) NOT NULL,
	"dish_name_normalized" varchar(200) NOT NULL,
	"rating" integer NOT NULL,
	"meal_plan_id" text,
	"tags" text[] DEFAULT '{}',
	"notes" text,
	"cuisine_tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"items" jsonb NOT NULL,
	"source_recipe_ids" text[] DEFAULT '{}',
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_extraction_cache" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steps_hash" varchar(64) NOT NULL,
	"recipe_title" varchar(200) NOT NULL,
	"extracted_skills" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_extraction_cache_steps_hash_unique" UNIQUE("steps_hash")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"tier" "skill_tier" NOT NULL,
	"category" "skill_category" NOT NULL,
	"description" varchar(255),
	"video_url" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"badge_type" varchar(50) NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "user_badges_user_type_unique" UNIQUE("user_id","badge_type")
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"post_id" text,
	"practice_count" integer DEFAULT 1 NOT NULL,
	"mastered" boolean DEFAULT false NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mastered_at" timestamp with time zone,
	CONSTRAINT "user_skills_user_skill_unique" UNIQUE("user_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "steps" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status" "post_status" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "ai_recipe" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "allocated_skill_ids" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dietary_preferences" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "food_exclusions" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "household_size" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_meal_types" text[] DEFAULT '{"dinner"}';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "meal_prep_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_cook_servings_multiplier" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nutrition_goals" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "taste_profile" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bypass_code" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "longest_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_publish_date" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_published" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corpus_analytics" ADD CONSTRAINT "corpus_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_corpus" ADD CONSTRAINT "recipe_corpus_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_items_collection_added" ON "collection_items" USING btree ("collection_id","added_at");--> statement-breakpoint
CREATE INDEX "idx_collections_user_created" ON "collections" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cooking_tips_dish_name" ON "cooking_tips_cache" USING btree ("dish_name_normalized");--> statement-breakpoint
CREATE INDEX "idx_corpus_analytics_endpoint_served_created" ON "corpus_analytics" USING btree ("endpoint","served_from","created_at");--> statement-breakpoint
CREATE INDEX "idx_follows_following_status" ON "follows" USING btree ("following_id","status");--> statement-breakpoint
CREATE INDEX "idx_follows_follower_status" ON "follows" USING btree ("follower_id","status");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_user_week" ON "meal_plans" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_user_created" ON "meal_plans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pantry_user" ON "pantry_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pantry_user_name" ON "pantry_items" USING btree ("user_id","name_normalized");--> statement-breakpoint
CREATE INDEX "idx_corpus_dish_name" ON "recipe_corpus" USING btree ("dish_name_normalized");--> statement-breakpoint
CREATE INDEX "idx_corpus_difficulty" ON "recipe_corpus" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "idx_corpus_servings" ON "recipe_corpus" USING btree ("servings");--> statement-breakpoint
CREATE INDEX "idx_corpus_source" ON "recipe_corpus" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_corpus_created_at" ON "recipe_corpus" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_recipe_ratings_user" ON "recipe_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ratings_user_dish" ON "recipe_ratings" USING btree ("user_id","dish_name_normalized");--> statement-breakpoint
CREATE INDEX "idx_shopping_lists_user_created" ON "shopping_lists" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_skill_extraction_steps_hash" ON "skill_extraction_cache" USING btree ("steps_hash");--> statement-breakpoint
CREATE INDEX "idx_skills_name" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_skills_tier" ON "skills" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_skills_category" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_earned" ON "user_badges" USING btree ("user_id","earned_at");--> statement-breakpoint
CREATE INDEX "idx_user_skills_user_id" ON "user_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_skills_skill_id" ON "user_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "idx_user_skills_post_id" ON "user_skills" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_posts_user_status" ON "posts" USING btree ("user_id","status");