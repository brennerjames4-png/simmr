"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateFullRecipe,
  generateCookingTip,
  structureRecipeFromDescription,
  regenerateStepsFromIngredients,
} from "@/lib/ai/cooking-tips";
import { extractSkillsFromRecipe } from "@/lib/ai/skills";
import { enforceAIRateLimitForUser, isRateLimitBypassed } from "@/lib/rate-limit";
import { saveToRecipeCorpus, getCorpusRecipe, trackCorpusEvent } from "@/lib/corpus";
import type { GeneratedRecipe, Ingredient, RecipeStep } from "@/lib/db/schema";
import { skills } from "@/lib/db/schema";

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
    // Corpus-first: non-bypass users get cached recipes when available
    if (!isRateLimitBypassed(user.bypassCode ?? null)) {
      const cached = await getCorpusRecipe(
        dishName,
        servings && servings >= 1 ? servings : undefined,
        {
          dietaryPreferences: user.dietaryPreferences,
          foodExclusions: user.foodExclusions,
        }
      );
      if (cached) {
        void trackCorpusEvent({ endpoint: "recipe", servedFrom: "corpus", dishNameNormalized: dishName, userId: user.id });
        return { recipe: cached };
      }
    }

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

    // Pre-cache: corpus write, cooking tip, skill extraction, and analytics — all in parallel
    const preCacheTasks: Promise<unknown>[] = [
      saveToRecipeCorpus({
        title: dishName,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        servings: servings ?? null,
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
        source: "full_recipe",
        sourceUserId: user.id,
      }),
      generateCookingTip(dishName),
      trackCorpusEvent({ endpoint: "recipe", servedFrom: "api", dishNameNormalized: dishName, userId: user.id }),
    ];

    if (recipe.steps && recipe.steps.length > 0) {
      preCacheTasks.push(
        db.select({ name: skills.name })
          .from(skills)
          .then((existingSkills) =>
            extractSkillsFromRecipe({
              title: dishName,
              steps: recipe.steps,
              ingredients: recipe.ingredients,
              existingSkillNames: existingSkills.map((s) => s.name),
            })
          )
      );
    }

    await Promise.allSettled(preCacheTasks);

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

    // Pre-cache: corpus write, cooking tip, and skill extraction — all in parallel
    const preCacheTasks: Promise<unknown>[] = [
      saveToRecipeCorpus({
        title: dishName,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        servings: servings ?? null,
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
        source: "structured_voice",
        sourceUserId: user.id,
      }),
      generateCookingTip(dishName),
    ];

    if (recipe.steps && recipe.steps.length > 0) {
      preCacheTasks.push(
        db.select({ name: skills.name })
          .from(skills)
          .then((existingSkills) =>
            extractSkillsFromRecipe({
              title: dishName,
              steps: recipe.steps,
              ingredients: recipe.ingredients,
              existingSkillNames: existingSkills.map((s) => s.name),
            })
          )
      );
    }

    await Promise.allSettled(preCacheTasks);

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
