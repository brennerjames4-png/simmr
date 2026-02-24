import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import type { Ingredient, InspirationRecipe } from "@/lib/db/schema";
import { desc, eq, and, count } from "drizzle-orm";

export type RecentMeal = {
  title: string;
  tags: string[] | null;
  ingredients: Ingredient[] | null;
};

export type DraftPost = {
  id: string;
  title: string;
  description: string | null;
  cookTime: number | null;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert" | null;
  servings: number | null;
  ingredients: Ingredient[] | null;
  steps: { step_number: number; instruction: string; duration_minutes?: number }[] | null;
  aiRecipe: InspirationRecipe | null;
  source: string;
  createdAt: Date;
};

export async function getRecentMeals(
  userId: string,
  limit = 15
): Promise<RecentMeal[]> {
  const results = await db
    .select({
      title: posts.title,
      tags: posts.tags,
      ingredients: posts.ingredients,
    })
    .from(posts)
    .where(
      and(eq(posts.userId, userId), eq(posts.status, "published"))
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  return results.map((r) => ({
    title: r.title,
    tags: r.tags,
    ingredients: r.ingredients ?? null,
  }));
}

export async function getDraftCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "draft")));

  return result?.value ?? 0;
}

export async function getDrafts(userId: string): Promise<DraftPost[]> {
  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      cookTime: posts.cookTime,
      difficulty: posts.difficulty,
      servings: posts.servings,
      ingredients: posts.ingredients,
      steps: posts.steps,
      aiRecipe: posts.aiRecipe,
      source: posts.source,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "draft")))
    .orderBy(desc(posts.createdAt));

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    cookTime: r.cookTime,
    difficulty: r.difficulty,
    servings: r.servings,
    ingredients: r.ingredients ?? null,
    steps: r.steps ?? null,
    aiRecipe: r.aiRecipe ?? null,
    source: r.source,
    createdAt: r.createdAt,
  }));
}
