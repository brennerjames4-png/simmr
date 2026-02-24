import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Updating mastery thresholds (doubled)...");

  // Un-master prep_cook skills that only have 1 practice (new threshold is 2)
  const result = await sql`
    UPDATE user_skills us
    SET mastered = false, mastered_at = NULL
    FROM skills s
    WHERE us.skill_id = s.id
      AND us.mastered = true
      AND s.tier = 'prep_cook'
      AND us.practice_count < 2
  `;

  console.log("Un-mastered prep_cook skills below new threshold");

  // Also un-master any other tier that somehow got mastered below new thresholds
  // line_cook: 4, sous_chef: 6, head_chef: 10, iron_chef: 16
  for (const [tier, threshold] of [
    ["line_cook", 4],
    ["sous_chef", 6],
    ["head_chef", 10],
    ["iron_chef", 16],
  ] as const) {
    await sql`
      UPDATE user_skills us
      SET mastered = false, mastered_at = NULL
      FROM skills s
      WHERE us.skill_id = s.id
        AND us.mastered = true
        AND s.tier = ${tier}
        AND us.practice_count < ${threshold}
    `;
  }

  console.log("All mastery states updated to new thresholds");
  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
