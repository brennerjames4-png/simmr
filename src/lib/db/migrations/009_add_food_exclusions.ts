import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding food_exclusions column to users...");

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS food_exclusions TEXT[] DEFAULT '{}'
  `;

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
