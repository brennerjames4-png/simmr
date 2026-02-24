"use server";

import { requireAuth } from "@/lib/auth";
import { generateIngredientList } from "@/lib/ai/cooking-tips";
import { enforceAIRateLimitForUser } from "@/lib/rate-limit";
import { saveToRecipeCorpus } from "@/lib/corpus";
import type { Ingredient } from "@/lib/db/schema";

export async function generateIngredients(
  dishName: string,
  servings?: number
): Promise<{ ingredients?: Ingredient[]; error?: string }> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  if (!dishName.trim()) {
    return { error: "Please enter a dish name first" };
  }

  const ingredients = await generateIngredientList(
    dishName,
    servings && servings >= 1 ? servings : undefined,
    {
      dietaryPreferences: user.dietaryPreferences,
      foodExclusions: user.foodExclusions,
    }
  );

  if (!ingredients) {
    return { error: "Failed to generate ingredients. Please try again." };
  }

  // Save to corpus (non-blocking)
  saveToRecipeCorpus({
    title: dishName,
    ingredients,
    steps: [],
    servings: servings ?? null,
    dietaryPreferences: user.dietaryPreferences,
    foodExclusions: user.foodExclusions,
    source: "ingredient_only",
    sourceUserId: user.id,
  });

  return { ingredients };
}
