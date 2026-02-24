import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running skill progress migration...");

  // 1. Add practice_count column (default 1 for existing rows — they already practiced once)
  await sql`
    ALTER TABLE user_skills
    ADD COLUMN IF NOT EXISTS practice_count INTEGER NOT NULL DEFAULT 1
  `;
  console.log("Added practice_count column");

  // 2. Add mastered column
  await sql`
    ALTER TABLE user_skills
    ADD COLUMN IF NOT EXISTS mastered BOOLEAN NOT NULL DEFAULT false
  `;
  console.log("Added mastered column");

  // 3. Add mastered_at column
  await sql`
    ALTER TABLE user_skills
    ADD COLUMN IF NOT EXISTS mastered_at TIMESTAMPTZ
  `;
  console.log("Added mastered_at column");

  // 4. Auto-master all existing prep_cook skills (threshold = 1, already met)
  await sql`
    UPDATE user_skills us
    SET mastered = true, mastered_at = us.earned_at
    FROM skills s
    WHERE us.skill_id = s.id AND s.tier = 'prep_cook'
  `;
  console.log("Auto-mastered existing prep_cook skills");

  console.log("Skill progress migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
