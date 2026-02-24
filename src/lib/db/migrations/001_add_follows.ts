import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running follows migration...");

  // 1. Add is_private column to users
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false`;
  console.log("Added is_private column to users");

  // 2. Create follow_status enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE follow_status AS ENUM ('pending', 'accepted', 'blocked');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  console.log("Created follow_status enum");

  // 3. Create follows table
  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status follow_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(follower_id, following_id),
      CHECK(follower_id != following_id)
    )
  `;
  console.log("Created follows table");

  // 4. Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_follows_following_status ON follows(following_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_follows_follower_status ON follows(follower_id, status)`;
  console.log("Created indexes");

  console.log("Follows migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
