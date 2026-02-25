import { db } from "@/lib/db";
import { users, userBadges, userSkills, mealPlans, posts, recipeCorpus } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { BadgeType } from "./badges-config";

async function awardBadge(
  userId: string,
  badgeType: BadgeType,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const [inserted] = await db
      .insert(userBadges)
      .values({
        userId,
        badgeType,
        metadata: metadata ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: userBadges.id });

    return !!inserted;
  } catch {
    return false;
  }
}

export async function updateStreak(
  userId: string
): Promise<{ currentStreak: number; newBadges: string[] }> {
  const newBadges: string[] = [];

  try {
    const [user] = await db
      .select({
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        lastPublishDate: users.lastPublishDate,
        totalPublished: users.totalPublished,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { currentStreak: 0, newBadges };

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let newStreak = user.currentStreak;
    const newTotal = user.totalPublished + 1;

    if (user.lastPublishDate === today) {
      // Already published today — no streak change
    } else if (user.lastPublishDate === yesterday) {
      // Consecutive day — extend streak
      newStreak = user.currentStreak + 1;
    } else {
      // Gap in streak — reset to 1
      newStreak = 1;
    }

    const newLongest = Math.max(user.longestStreak, newStreak);

    await db
      .update(users)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastPublishDate: today,
        totalPublished: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Check streak badges
    if (newStreak >= 3 && (await awardBadge(userId, "three_day_streak"))) {
      newBadges.push("three_day_streak");
    }
    if (newStreak >= 7 && (await awardBadge(userId, "seven_day_streak"))) {
      newBadges.push("seven_day_streak");
    }
    if (newStreak >= 30 && (await awardBadge(userId, "thirty_day_streak"))) {
      newBadges.push("thirty_day_streak");
    }

    return { currentStreak: newStreak, newBadges };
  } catch (error) {
    console.error("updateStreak failed:", error);
    return { currentStreak: 0, newBadges };
  }
}

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const newBadges: string[] = [];

  try {
    const [user] = await db
      .select({ totalPublished: users.totalPublished })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return newBadges;

    // Recipe count badges
    if (user.totalPublished >= 1 && (await awardBadge(userId, "first_recipe"))) {
      newBadges.push("first_recipe");
    }
    if (user.totalPublished >= 5 && (await awardBadge(userId, "five_recipes"))) {
      newBadges.push("five_recipes");
    }
    if (user.totalPublished >= 25 && (await awardBadge(userId, "twenty_five_recipes"))) {
      newBadges.push("twenty_five_recipes");
    }
    if (user.totalPublished >= 50 && (await awardBadge(userId, "fifty_recipes"))) {
      newBadges.push("fifty_recipes");
    }
    if (user.totalPublished >= 100 && (await awardBadge(userId, "hundred_recipes"))) {
      newBadges.push("hundred_recipes");
    }

    // Skill badges
    const [skillCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkills)
      .where(and(eq(userSkills.userId, userId), eq(userSkills.mastered, true)));

    if (skillCount && skillCount.count >= 1 && (await awardBadge(userId, "first_skill_mastered"))) {
      newBadges.push("first_skill_mastered");
    }
    if (skillCount && skillCount.count >= 5 && (await awardBadge(userId, "five_skills_mastered"))) {
      newBadges.push("five_skills_mastered");
    }

    // Meal plan badge
    const [planCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId));

    if (planCount && planCount.count >= 1 && (await awardBadge(userId, "first_meal_plan"))) {
      newBadges.push("first_meal_plan");
    }

    return newBadges;
  } catch (error) {
    console.error("checkAndAwardBadges failed:", error);
    return newBadges;
  }
}

export async function getUserBadges(
  userId: string
): Promise<Array<{ badgeType: string; earnedAt: Date }>> {
  return db
    .select({
      badgeType: userBadges.badgeType,
      earnedAt: userBadges.earnedAt,
    })
    .from(userBadges)
    .where(eq(userBadges.userId, userId))
    .orderBy(userBadges.earnedAt);
}
