import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding allocated_skill_ids column to posts...");

  await sql`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS allocated_skill_ids TEXT[] DEFAULT '{}'
  `;

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
