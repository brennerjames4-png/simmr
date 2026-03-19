"use server";

import { db } from "@/lib/db";
import { recipeRatings, users } from "@/lib/db/schema";
import type { TasteProfile } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

function normalizeDishName(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export async function rateRecipe(params: {
  recipeTitle: string;
  rating: number;
  mealPlanId?: string;
  tags?: string[];
  notes?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  if (params.rating < 1 || params.rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  try {
    await db.insert(recipeRatings).values({
      userId: user.id,
      recipeTitle: params.recipeTitle.slice(0, 200),
      dishNameNormalized: normalizeDishName(params.recipeTitle),
      rating: params.rating,
      mealPlanId: params.mealPlanId ?? null,
      tags: params.tags ?? [],
      notes: params.notes ?? null,
      cuisineTags: [],
    });

    // Recompute taste profile asynchronously
    void recomputeTasteProfile(user.id);

    return { success: true };
  } catch (error) {
    console.error("rateRecipe error:", error);
    return { error: "Failed to save rating." };
  }
}

async function recomputeTasteProfile(userId: string) {
  try {
    const ratings = await db
      .select()
      .from(recipeRatings)
      .where(eq(recipeRatings.userId, userId))
      .orderBy(desc(recipeRatings.createdAt))
      .limit(200);

    if (ratings.length < 5) return; // Not enough data

    // Simple aggregation — count preferences from high-rated recipes
    const cuisineCounts = new Map<string, { total: number; positive: number }>();
    const tagCounts = new Map<string, number>();

    for (const r of ratings) {
      const weight = r.rating >= 4 ? 1 : r.rating <= 2 ? -1 : 0;

      // Track cuisine tags
      for (const tag of (r.cuisineTags ?? [])) {
        const existing = cuisineCounts.get(tag) ?? { total: 0, positive: 0 };
        existing.total++;
        if (weight > 0) existing.positive++;
        cuisineCounts.set(tag, existing);
      }

      // Track user tags
      for (const tag of (r.tags ?? [])) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + weight);
      }
    }

    const preferredCuisines: string[] = [];
    const avoidedCuisines: string[] = [];

    for (const [cuisine, counts] of cuisineCounts) {
      const ratio = counts.positive / counts.total;
      if (ratio >= 0.7 && counts.total >= 3) preferredCuisines.push(cuisine);
      if (ratio <= 0.2 && counts.total >= 3) avoidedCuisines.push(cuisine);
    }

    const avgRating = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

    const profile: TasteProfile = {
      preferredCuisines,
      avoidedCuisines,
      preferredProteins: [],
      preferredCookingMethods: [],
      complexityPreference: avgRating >= 4 ? "complex" : avgRating >= 3 ? "moderate" : "simple",
      totalRatings: ratings.length,
      lastUpdated: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({ tasteProfile: profile })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("recomputeTasteProfile error:", error);
  }
}

export async function getRecipeRatings() {
  const user = await requireAuth();

  return db
    .select()
    .from(recipeRatings)
    .where(eq(recipeRatings.userId, user.id))
    .orderBy(desc(recipeRatings.createdAt))
    .limit(50);
}
