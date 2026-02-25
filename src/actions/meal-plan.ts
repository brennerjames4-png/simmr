"use server";

import { db } from "@/lib/db";
import { mealPlans } from "@/lib/db/schema";
import type { MealPlanDay, MealPlan, Ingredient, RecipeStep } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateMealPlanRecipe } from "@/lib/ai/meal-plan";
import { getCorpusInspirationRecipe, saveToRecipeCorpus, trackCorpusEvent } from "@/lib/corpus";
import { getUserSkillsForAI } from "@/queries/skills";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function generateMealPlan(params: {
  servings: number;
  availableIngredients?: string;
  weekStart?: Date;
}): Promise<{ plan?: MealPlan; error?: string }> {
  const user = await requireAuth();

  const safeServings = params.servings >= 1 && params.servings <= 20 ? params.servings : 2;
  const weekStart = params.weekStart ?? getNextMonday();

  try {
    const userSkills = await getUserSkillsForAI(user.id);

    const days: MealPlanDay[] = [];
    const plannedTitles: string[] = [];

    for (const day of DAYS) {
      // Try corpus first
      const corpusRecipe = await getCorpusInspirationRecipe(
        `${day} dinner`, // Generic query — won't match much, but worth trying
        safeServings,
        {
          dietaryPreferences: user.dietaryPreferences,
          foodExclusions: user.foodExclusions,
        }
      );

      if (corpusRecipe && !plannedTitles.some((t) => t.toLowerCase() === corpusRecipe.title.toLowerCase())) {
        void trackCorpusEvent({
          endpoint: "inspiration",
          servedFrom: "corpus",
          dishNameNormalized: corpusRecipe.title,
          userId: user.id,
        });

        days.push({
          day,
          recipe: {
            title: corpusRecipe.title,
            description: corpusRecipe.description,
            ingredients: corpusRecipe.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
            steps: corpusRecipe.steps,
            cookTime: corpusRecipe.cookTime,
            difficulty: corpusRecipe.difficulty,
            servings: corpusRecipe.servings,
            dietaryNotes: corpusRecipe.dietaryNotes,
          },
          source: "corpus",
        });
        plannedTitles.push(corpusRecipe.title);
        continue;
      }

      // Generate via AI
      const recipe = await generateMealPlanRecipe({
        dayOfWeek: day,
        otherMealsThisWeek: plannedTitles,
        availableIngredients: params.availableIngredients,
        servings: safeServings,
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
        kitchenInventory: user.kitchenInventory,
        userSkills,
      });

      if (!recipe) {
        continue; // Skip this day if generation fails
      }

      void trackCorpusEvent({
        endpoint: "inspiration",
        servedFrom: "api",
        dishNameNormalized: recipe.title,
        userId: user.id,
      });

      // Write through to corpus
      void saveToRecipeCorpus({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        steps: recipe.steps,
        cookTime: recipe.cookTime,
        difficulty: recipe.difficulty,
        servings: recipe.servings,
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
        appliancesUsed: recipe.equipmentUsed,
        source: "inspiration",
        sourceUserId: user.id,
        inspirationMetadata: recipe,
      });

      days.push({
        day,
        recipe: {
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
          steps: recipe.steps,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          servings: recipe.servings,
          dietaryNotes: recipe.dietaryNotes,
        },
        source: "ai",
      });
      plannedTitles.push(recipe.title);
    }

    if (days.length === 0) {
      return { error: "Failed to generate any recipes. Please try again." };
    }

    // Save the plan
    const [saved] = await db
      .insert(mealPlans)
      .values({
        userId: user.id,
        weekStart,
        planData: days,
        preferences: {
          servings: safeServings,
          availableIngredients: params.availableIngredients || null,
        },
      })
      .returning();

    revalidatePath("/meal-planner");

    return {
      plan: {
        id: saved.id,
        weekStart: saved.weekStart,
        days: saved.planData,
        createdAt: saved.createdAt,
      },
    };
  } catch (error) {
    console.error("generateMealPlan error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function getMealPlans(
  limit: number = 10
): Promise<MealPlan[]> {
  const user = await requireAuth();

  const results = await db
    .select()
    .from(mealPlans)
    .where(eq(mealPlans.userId, user.id))
    .orderBy(desc(mealPlans.createdAt))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    days: r.planData,
    createdAt: r.createdAt,
  }));
}

export async function getMealPlan(
  planId: string
): Promise<MealPlan | null> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return null;

  return {
    id: result.id,
    weekStart: result.weekStart,
    days: result.planData,
    createdAt: result.createdAt,
  };
}

export async function deleteMealPlan(
  planId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, planId), eq(mealPlans.userId, user.id)),
  });

  if (!plan) {
    return { error: "Meal plan not found." };
  }

  await db.delete(mealPlans).where(eq(mealPlans.id, planId));

  revalidatePath("/meal-planner");
  return { success: true };
}
