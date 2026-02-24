import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Changing user_skills.post_id FK from CASCADE to SET NULL...");

  // post_id already nullable from first run

  // Find and drop the FK constraint on post_id
  const constraints = await sql`
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'user_skills'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'post_id'
  `;

  for (const c of constraints) {
    // Use raw query to drop constraint by name
    await sql.query(`ALTER TABLE user_skills DROP CONSTRAINT "${c.constraint_name}"`);
    console.log(`Dropped constraint: ${c.constraint_name}`);
  }

  // Add new FK with SET NULL
  await sql`
    ALTER TABLE user_skills
    ADD CONSTRAINT user_skills_post_id_fk
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
  `;
  console.log("Added new FK with SET NULL");

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
