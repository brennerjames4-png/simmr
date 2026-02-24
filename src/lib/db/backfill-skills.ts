import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, sql as drizzleSql } from "drizzle-orm";
import * as schema from "./schema";
import * as relations from "./relations";
import { extractSkillsFromRecipe } from "../ai/skills";
import type { RecipeStep, Ingredient, SkillTier, SkillCategory } from "./schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient, schema: { ...schema, ...relations } });

async function backfillSkills() {
  console.log("Starting skills backfill for existing published recipes...\n");

  // Fetch all published posts that have steps
  const publishedPosts = await db
    .select({
      id: schema.posts.id,
      userId: schema.posts.userId,
      title: schema.posts.title,
      steps: schema.posts.steps,
      ingredients: schema.posts.ingredients,
    })
    .from(schema.posts)
    .where(eq(schema.posts.status, "published"))
    .orderBy(schema.posts.createdAt);

  const postsWithSteps = publishedPosts.filter(
    (p) => p.steps && (p.steps as RecipeStep[]).length > 0
  );

  console.log(
    `Found ${publishedPosts.length} published posts, ${postsWithSteps.length} with steps.\n`
  );

  if (postsWithSteps.length === 0) {
    console.log("No posts with steps to backfill. Done.");
    return;
  }

  let totalSkillsCreated = 0;
  let totalUserSkillsLinked = 0;

  for (const post of postsWithSteps) {
    const steps = post.steps as RecipeStep[];
    const ingredients = (post.ingredients as Ingredient[]) ?? [];

    console.log(`Processing: "${post.title}" (${steps.length} steps)...`);

    // Get all existing skill names for AI context
    const existingSkills = await db
      .select({ id: schema.skills.id, name: schema.skills.name })
      .from(schema.skills);

    const existingSkillNames = existingSkills.map((s) => s.name);
    const existingSkillMap = new Map(
      existingSkills.map((s) => [s.name.toLowerCase(), s])
    );

    // Extract skills via AI
    const extracted = await extractSkillsFromRecipe({
      title: post.title,
      steps,
      ingredients,
      existingSkillNames,
    });

    if (!extracted || extracted.length === 0) {
      console.log(`  → No skills extracted (AI returned nothing)\n`);
      continue;
    }

    console.log(`  → Extracted ${extracted.length} skills: ${extracted.map((s) => s.name).join(", ")}`);

    for (const skill of extracted) {
      const normalizedName = skill.name.trim();
      const existing = existingSkillMap.get(normalizedName.toLowerCase());

      let skillId: string;

      if (existing) {
        skillId = existing.id;
        console.log(`    ✓ Reusing existing skill: "${normalizedName}"`);
      } else {
        const [newSkill] = await db
          .insert(schema.skills)
          .values({
            name: normalizedName,
            tier: skill.tier as SkillTier,
            category: skill.category as SkillCategory,
            description: skill.description || null,
            usageCount: 0,
          })
          .onConflictDoNothing({ target: schema.skills.name })
          .returning({ id: schema.skills.id });

        if (!newSkill) {
          const found = await db
            .select({ id: schema.skills.id })
            .from(schema.skills)
            .where(eq(schema.skills.name, normalizedName))
            .limit(1);
          if (found.length === 0) continue;
          skillId = found[0].id;
        } else {
          skillId = newSkill.id;
          totalSkillsCreated++;
          console.log(`    + Created new skill: "${normalizedName}" (${skill.tier}, ${skill.category})`);
        }
      }

      // Link to user
      const [inserted] = await db
        .insert(schema.userSkills)
        .values({
          userId: post.userId,
          skillId,
          postId: post.id,
        })
        .onConflictDoNothing()
        .returning({ id: schema.userSkills.id });

      if (inserted) {
        totalUserSkillsLinked++;
        await db
          .update(schema.skills)
          .set({
            usageCount: drizzleSql`${schema.skills.usageCount} + 1`,
          })
          .where(eq(schema.skills.id, skillId));
      }
    }

    console.log("");

    // Small delay to avoid rate limiting the AI API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("=== Backfill Complete ===");
  console.log(`Skills created: ${totalSkillsCreated}`);
  console.log(`User-skill links created: ${totalUserSkillsLinked}`);
}

backfillSkills().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
