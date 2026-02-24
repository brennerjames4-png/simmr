"use server";

import { requireAuth } from "@/lib/auth";
import {
  generateFullRecipe,
  structureRecipeFromDescription,
  regenerateStepsFromIngredients,
} from "@/lib/ai/cooking-tips";
import { enforceAIRateLimitForUser } from "@/lib/rate-limit";
import { saveToRecipeCorpus } from "@/lib/corpus";
import type { GeneratedRecipe, Ingredient, RecipeStep } from "@/lib/db/schema";

export async function generateRecipe(
  dishName: string,
  servings?: number
): Promise<{ recipe?: GeneratedRecipe; error?: string }> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  if (!dishName.trim()) {
    return { error: "Please enter a dish name first" };
  }

  try {
    const recipe = await generateFullRecipe(
      dishName,
      servings && servings >= 1 ? servings : undefined,
      {
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
      }
    );

    if (!recipe) {
      return { error: "Failed to generate recipe. The AI service may be unavailable — please try again." };
    }

    // Save to corpus (non-blocking)
    saveToRecipeCorpus({
      title: dishName,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      servings: servings ?? null,
      dietaryPreferences: user.dietaryPreferences,
      foodExclusions: user.foodExclusions,
      source: "full_recipe",
      sourceUserId: user.id,
    });

    return { recipe };
  } catch (error) {
    console.error("generateRecipe action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function structureRecipe(
  transcript: string,
  dishName: string,
  servings?: number
): Promise<{ recipe?: GeneratedRecipe; error?: string }> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  if (!dishName.trim()) {
    return { error: "Please enter a dish name first" };
  }

  if (!transcript.trim()) {
    return { error: "No description to process" };
  }

  try {
    const recipe = await structureRecipeFromDescription(
      transcript,
      dishName,
      servings && servings >= 1 ? servings : undefined,
      {
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
      }
    );

    if (!recipe) {
      return { error: "Failed to structure recipe. The AI service may be unavailable — please try again." };
    }

    // Save to corpus (non-blocking)
    saveToRecipeCorpus({
      title: dishName,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      servings: servings ?? null,
      dietaryPreferences: user.dietaryPreferences,
      foodExclusions: user.foodExclusions,
      source: "structured_voice",
      sourceUserId: user.id,
    });

    return { recipe };
  } catch (error) {
    console.error("structureRecipe action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function regenerateSteps(
  dishName: string,
  ingredients: Ingredient[],
  servings?: number
): Promise<{ steps?: RecipeStep[]; error?: string }> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  if (!dishName.trim()) {
    return { error: "Please enter a dish name first" };
  }

  if (!ingredients.length) {
    return { error: "No ingredients to generate steps from" };
  }

  try {
    const steps = await regenerateStepsFromIngredients(
      dishName,
      ingredients,
      servings && servings >= 1 ? servings : undefined,
      {
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
      }
    );

    if (!steps) {
      return { error: "Failed to generate steps. Please try again." };
    }

    return { steps };
  } catch (error) {
    console.error("regenerateSteps action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
