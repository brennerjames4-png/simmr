import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding video_url column to skills...");

  await sql`
    ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS video_url TEXT
  `;

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
