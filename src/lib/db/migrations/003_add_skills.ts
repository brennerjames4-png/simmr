import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running skills migration...");

  // 1. Create skill_tier enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE skill_tier AS ENUM ('prep_cook', 'line_cook', 'sous_chef', 'head_chef', 'iron_chef');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  console.log("Created skill_tier enum");

  // 2. Create skill_category enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE skill_category AS ENUM ('technique', 'knife_work', 'baking_pastry', 'specialty');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  console.log("Created skill_category enum");

  // 3. Create skills table (global catalog)
  await sql`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      tier skill_tier NOT NULL,
      category skill_category NOT NULL,
      description VARCHAR(255),
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("Created skills table");

  // 4. Create user_skills table (junction)
  await sql`
    CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, skill_id)
    )
  `;
  console.log("Created user_skills table");

  // 5. Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skills_tier ON skills(tier)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_skills_post_id ON user_skills(post_id)`;
  console.log("Created indexes");

  console.log("Skills migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
