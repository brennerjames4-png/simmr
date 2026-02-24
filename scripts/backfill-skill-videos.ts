import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isNull, eq } from "drizzle-orm";
import { skills, userSkills, posts } from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient });

// Pass --regenerate to clear and regenerate ALL videos
const regenerateAll = process.argv.includes("--regenerate");

async function backfillSkillVideos() {
  const { generateSkillVideo } = await import("../src/lib/ai/skill-video");

  console.log("Starting skill video backfill...\n");

  if (regenerateAll) {
    console.log("--regenerate flag: clearing ALL existing video URLs...\n");
    await db.update(skills).set({ videoUrl: null });
  }

  // Find all skills without a video
  const skillsToProcess = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
    })
    .from(skills)
    .where(isNull(skills.videoUrl));

  // For each skill, find associated recipe data for context
  const skillsWithContext: Array<{
    id: string;
    name: string;
    description: string | null;
    recipeContext: string | null;
    recipeData: {
      title: string;
      ingredients: Array<{ name: string; quantity: string; unit: string }>;
      steps: Array<{ instruction: string; step_number: number; duration_minutes?: number }>;
    } | null;
  }> = [];

  for (const skill of skillsToProcess) {
    // Get the most recent recipe this skill was allocated from
    const recipes = await db
      .select({
        title: posts.title,
        ingredients: posts.ingredients,
        steps: posts.steps,
      })
      .from(userSkills)
      .innerJoin(posts, eq(userSkills.postId, posts.id))
      .where(eq(userSkills.skillId, skill.id))
      .limit(1);

    const recipe = recipes[0];
    skillsWithContext.push({
      ...skill,
      recipeContext: recipe?.title ?? null,
      recipeData: recipe
        ? {
            title: recipe.title,
            ingredients: (recipe.ingredients as Array<{ name: string; quantity: string; unit: string }>) || [],
            steps: (recipe.steps as Array<{ instruction: string; step_number: number; duration_minutes?: number }>) || [],
          }
        : null,
    });
  }

  console.log(
    `Found ${skillsWithContext.length} skills to generate videos for.\n`
  );

  let success = 0;
  let failed = 0;

  for (const skill of skillsWithContext) {
    console.log(
      `[${success + failed + 1}/${skillsWithContext.length}] "${skill.name}"${skill.recipeContext ? ` (from: ${skill.recipeContext})` : ""}...`
    );

    try {
      await generateSkillVideo(
        skill.id,
        skill.name,
        skill.description,
        skill.recipeContext,
        skill.recipeData
      );
      success++;
      console.log(`  Done.\n`);
    } catch (error) {
      failed++;
      console.error(`  Failed:`, error);
    }

    if (success + failed < skillsWithContext.length) {
      console.log("  Waiting 2s before next...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("\n=== Backfill Complete ===");
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

backfillSkillVideos().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
