import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running inspiration migration...");

  // 1. Create post_status enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE post_status AS ENUM ('draft', 'published');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  console.log("Created post_status enum");

  // 2. Add status column to posts
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS status post_status NOT NULL DEFAULT 'published'`;
  console.log("Added status column to posts");

  // 3. Add source column to posts
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`;
  console.log("Added source column to posts");

  // 4. Add ai_recipe column to posts
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_recipe JSONB`;
  console.log("Added ai_recipe column to posts");

  // 5. Create index for drafts query
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts(user_id, status)`;
  console.log("Created idx_posts_user_status index");

  console.log("Inspiration migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
