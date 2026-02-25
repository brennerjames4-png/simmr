"use server";

import { requireAuth } from "@/lib/auth";
import { generateIngredientList } from "@/lib/ai/cooking-tips";
import { enforceAIRateLimitForUser, isRateLimitBypassed } from "@/lib/rate-limit";
import { saveToRecipeCorpus, getCorpusIngredients, trackCorpusEvent } from "@/lib/corpus";
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

  // Corpus-first: non-bypass users get cached ingredients when available
  if (!isRateLimitBypassed(user.bypassCode ?? null)) {
    const cached = await getCorpusIngredients(
      dishName,
      servings && servings >= 1 ? servings : undefined,
      {
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
      }
    );
    if (cached) {
      void trackCorpusEvent({ endpoint: "ingredients", servedFrom: "corpus", dishNameNormalized: dishName, userId: user.id });
      return { ingredients: cached };
    }
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

  // Track API call and save to corpus
  void trackCorpusEvent({ endpoint: "ingredients", servedFrom: "api", dishNameNormalized: dishName, userId: user.id });
  await saveToRecipeCorpus({
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
