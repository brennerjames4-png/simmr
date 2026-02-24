import { db } from "@/lib/db";
import { skills, userSkills, posts } from "@/lib/db/schema";
import type { SkillTier, SkillCategory } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export type UserSkillWithDetails = {
  id: string;
  skillId: string;
  name: string;
  tier: SkillTier;
  category: SkillCategory;
  description: string | null;
  videoUrl: string | null;
  practiceCount: number;
  mastered: boolean;
  earnedAt: Date;
  masteredAt: Date | null;
  postId: string | null;
  postTitle: string | null;
};

/**
 * Get all skills for a user with full details, for the skills page.
 * Returns both mastered and in-progress skills.
 */
export async function getUserSkills(
  userId: string
): Promise<UserSkillWithDetails[]> {
  const results = await db
    .select({
      id: userSkills.id,
      skillId: userSkills.skillId,
      name: skills.name,
      tier: skills.tier,
      category: skills.category,
      description: skills.description,
      videoUrl: skills.videoUrl,
      practiceCount: userSkills.practiceCount,
      mastered: userSkills.mastered,
      earnedAt: userSkills.earnedAt,
      masteredAt: userSkills.masteredAt,
      postId: userSkills.postId,
      postTitle: posts.title,
    })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .leftJoin(posts, eq(userSkills.postId, posts.id))
    .where(eq(userSkills.userId, userId))
    .orderBy(desc(userSkills.earnedAt));

  return results;
}

/**
 * Get mastered skill count for a user (for profile stats).
 */
export async function getUserSkillCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userSkills)
    .where(
      and(eq(userSkills.userId, userId), eq(userSkills.mastered, true))
    );

  return result?.count ?? 0;
}

/**
 * Get total skill count (mastered + in-progress) for profile display.
 */
export async function getUserTotalSkillCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userSkills)
    .where(eq(userSkills.userId, userId));

  return result?.count ?? 0;
}

/**
 * Get a user's mastered skill names and tiers (for AI inspiration context).
 */
export async function getUserSkillsForAI(
  userId: string
): Promise<{ name: string; tier: SkillTier }[]> {
  return db
    .select({
      name: skills.name,
      tier: skills.tier,
    })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .where(
      and(eq(userSkills.userId, userId), eq(userSkills.mastered, true))
    )
    .orderBy(skills.tier);
}

/**
 * Get all skill names from the global catalog (for AI extraction context).
 */
export async function getAllSkillNames(): Promise<string[]> {
  const results = await db
    .select({ name: skills.name })
    .from(skills)
    .orderBy(skills.name);

  return results.map((r) => r.name);
}
