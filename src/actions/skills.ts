"use server";

import { db } from "@/lib/db";
import { skills, userSkills, posts } from "@/lib/db/schema";
import type { RecipeStep, Ingredient, SkillTier, SkillCategory } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { extractSkillsFromRecipe } from "@/lib/ai/skills";
import { MASTERY_THRESHOLDS } from "@/lib/skills-config";

/**
 * Extract skills from a recipe and allocate them to the user.
 * Called from both publishDraft() and createPost().
 * Non-fatal: if AI fails, the publish still succeeds.
 *
 * Skills now require repeated practice to master. Each publish
 * increments the practice count. Once the threshold for the
 * skill's tier is met, the skill is marked as mastered.
 *
 * Saves allocated skill IDs on the post for reliable deallocation on delete.
 */
export async function allocateSkills(params: {
  userId: string;
  postId: string;
  title: string;
  steps: RecipeStep[];
  ingredients: Ingredient[];
}): Promise<void> {
  try {
    // 1. Get all existing skill names for AI context
    const existingSkills = await db
      .select({ id: skills.id, name: skills.name })
      .from(skills);

    const existingSkillNames = existingSkills.map((s) => s.name);
    const existingSkillMap = new Map(
      existingSkills.map((s) => [s.name.toLowerCase(), s])
    );

    // 2. Ask AI to extract skills from the recipe
    const extracted = await extractSkillsFromRecipe({
      title: params.title,
      steps: params.steps,
      ingredients: params.ingredients,
      existingSkillNames,
    });

    if (!extracted || extracted.length === 0) return;

    // Track all skill IDs allocated from this recipe
    const allocatedSkillIds: string[] = [];

    // 3. For each extracted skill, upsert into global catalog and track progress
    for (const skill of extracted) {
      const normalizedName = skill.name.trim();
      const existing = existingSkillMap.get(normalizedName.toLowerCase());

      let skillId: string;
      let tier: SkillTier;

      if (existing) {
        skillId = existing.id;
        // Look up the tier from the DB
        const [skillRow] = await db
          .select({ tier: skills.tier })
          .from(skills)
          .where(eq(skills.id, skillId))
          .limit(1);
        tier = skillRow.tier;
      } else {
        tier = skill.tier as SkillTier;
        const [newSkill] = await db
          .insert(skills)
          .values({
            name: normalizedName,
            tier,
            category: skill.category as SkillCategory,
            description: skill.description || null,
            usageCount: 0,
          })
          .onConflictDoNothing({ target: skills.name })
          .returning({ id: skills.id });

        if (!newSkill) {
          const found = await db
            .select({ id: skills.id, tier: skills.tier })
            .from(skills)
            .where(eq(skills.name, normalizedName))
            .limit(1);
          if (found.length === 0) continue;
          skillId = found[0].id;
          tier = found[0].tier;
        } else {
          skillId = newSkill.id;

          // Video generation disabled — can be triggered manually via backfill script
        }
      }

      allocatedSkillIds.push(skillId);

      const threshold = MASTERY_THRESHOLDS[tier];

      // 4. Check if user already has this skill tracked
      const [existingUserSkill] = await db
        .select({
          id: userSkills.id,
          practiceCount: userSkills.practiceCount,
          mastered: userSkills.mastered,
        })
        .from(userSkills)
        .where(
          and(
            eq(userSkills.userId, params.userId),
            eq(userSkills.skillId, skillId)
          )
        )
        .limit(1);

      if (existingUserSkill) {
        // Already tracking — increment practice count
        const newCount = existingUserSkill.practiceCount + 1;
        const nowMastered = newCount >= threshold;

        await db
          .update(userSkills)
          .set({
            practiceCount: newCount,
            // Update postId to the latest recipe that practiced this skill
            postId: params.postId,
            ...(nowMastered && !existingUserSkill.mastered
              ? { mastered: true, masteredAt: new Date() }
              : {}),
          })
          .where(eq(userSkills.id, existingUserSkill.id));
      } else {
        // First time seeing this skill — insert with count 1
        const isMastered = threshold <= 1;

        await db
          .insert(userSkills)
          .values({
            userId: params.userId,
            skillId,
            postId: params.postId,
            practiceCount: 1,
            mastered: isMastered,
            masteredAt: isMastered ? new Date() : null,
          })
          .onConflictDoNothing();
      }

      // 5. Increment global usage count
      await db
        .update(skills)
        .set({
          usageCount: sql`${skills.usageCount} + 1`,
        })
        .where(eq(skills.id, skillId));
    }

    // 6. Save allocated skill IDs on the post for reliable deallocation
    if (allocatedSkillIds.length > 0) {
      await db
        .update(posts)
        .set({ allocatedSkillIds: allocatedSkillIds })
        .where(eq(posts.id, params.postId));
    }
  } catch (error) {
    console.error("Skill allocation failed:", error);
  }
}

/**
 * Reverse skill allocation when a recipe is deleted.
 * Uses the stored allocatedSkillIds on the post to know exactly
 * which skills to decrement — no AI re-extraction needed.
 * Non-fatal: deletion still succeeds if this fails.
 */
export async function deallocateSkills(params: {
  userId: string;
  allocatedSkillIds: string[];
}): Promise<void> {
  try {
    if (!params.allocatedSkillIds || params.allocatedSkillIds.length === 0) {
      return;
    }

    for (const skillId of params.allocatedSkillIds) {
      // Find the user's tracking row for this skill
      const [userSkill] = await db
        .select({
          id: userSkills.id,
          practiceCount: userSkills.practiceCount,
          skillTier: skills.tier,
        })
        .from(userSkills)
        .innerJoin(skills, eq(userSkills.skillId, skills.id))
        .where(
          and(
            eq(userSkills.userId, params.userId),
            eq(userSkills.skillId, skillId)
          )
        )
        .limit(1);

      if (!userSkill) continue;

      const newCount = userSkill.practiceCount - 1;

      if (newCount <= 0) {
        // Remove the skill entirely
        await db.delete(userSkills).where(eq(userSkills.id, userSkill.id));
      } else {
        // Decrement and check if still mastered
        const threshold = MASTERY_THRESHOLDS[userSkill.skillTier];
        const stillMastered = newCount >= threshold;

        await db
          .update(userSkills)
          .set({
            practiceCount: newCount,
            ...(stillMastered ? {} : { mastered: false, masteredAt: null }),
          })
          .where(eq(userSkills.id, userSkill.id));
      }

      // Decrement global usage count (floor at 0)
      await db
        .update(skills)
        .set({
          usageCount: sql`GREATEST(${skills.usageCount} - 1, 0)`,
        })
        .where(eq(skills.id, skillId));
    }
  } catch (error) {
    console.error("Skill deallocation failed:", error);
  }
}
