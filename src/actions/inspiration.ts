"use server";

import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import type {
  InspirationRecipe,
  InspirationIngredient,
  Ingredient,
  RecipeStep,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  generateInspirationRecipe,
  regenerateRecipeSteps,
} from "@/lib/ai/inspiration";
import { generateCookingTip } from "@/lib/ai/cooking-tips";
import { extractSkillsFromRecipe } from "@/lib/ai/skills";
import { allocateSkills } from "@/actions/skills";
import { getRecentMeals } from "@/queries/inspiration";
import { getUserSkillsForAI } from "@/queries/skills";
import { enforceAIRateLimitForUser } from "@/lib/rate-limit";
import { saveToRecipeCorpus, getCachedCookingTip } from "@/lib/corpus";
import { skills } from "@/lib/db/schema";

export async function generateInspiration(
  ingredients: string,
  servings: number,
  dietaryNotes?: string,
  previousRecipes?: string[]
): Promise<{ recipe?: InspirationRecipe; error?: string }> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  if (!ingredients.trim()) {
    return { error: "Please describe what ingredients you have." };
  }

  const safeServings = servings >= 1 && servings <= 20 ? servings : 2;

  try {
    const [recentMeals, userSkills] = await Promise.all([
      getRecentMeals(user.id, 15),
      getUserSkillsForAI(user.id),
    ]);

    const recipe = await generateInspirationRecipe({
      availableIngredients: ingredients,
      servings: safeServings,
      dietaryNotes: dietaryNotes || undefined,
      dietaryPreferences: user.dietaryPreferences,
      foodExclusions: user.foodExclusions,
      kitchenInventory: user.kitchenInventory,
      recentMeals,
      previousRecipes: previousRecipes?.length ? previousRecipes : undefined,
      userSkills,
    });

    if (!recipe) {
      return {
        error:
          "Failed to generate recipe. The AI service may be unavailable — please try again.",
      };
    }

    // Pre-cache: corpus write, cooking tip, and skill extraction — all in parallel
    const preCacheTasks: Promise<unknown>[] = [
      saveToRecipeCorpus({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
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
      }),
      generateCookingTip(recipe.title, recipe.description),
    ];

    if (recipe.steps && recipe.steps.length > 0) {
      preCacheTasks.push(
        db.select({ name: skills.name })
          .from(skills)
          .then((existingSkills) =>
            extractSkillsFromRecipe({
              title: recipe.title,
              steps: recipe.steps,
              ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
              existingSkillNames: existingSkills.map((s) => s.name),
            })
          )
      );
    }

    await Promise.allSettled(preCacheTasks);

    return { recipe };
  } catch (error) {
    console.error("generateInspiration action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function regenerateSteps(
  recipe: InspirationRecipe,
  updatedIngredients: InspirationIngredient[],
  removedIngredients: string[],
  modifiedIngredients: string[]
): Promise<{
  steps?: RecipeStep[];
  cookTime?: number;
  equipmentUsed?: string[];
  error?: string;
}> {
  const user = await requireAuth();

  try {
    enforceAIRateLimitForUser(user);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Rate limit exceeded. Please wait a moment." };
  }

  try {
    const result = await regenerateRecipeSteps({
      title: recipe.title,
      description: recipe.description,
      updatedIngredients,
      removedIngredients,
      modifiedIngredients,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      kitchenInventory: user.kitchenInventory,
      dietaryNotes: recipe.dietaryNotes,
      dietaryPreferences: user.dietaryPreferences,
      foodExclusions: user.foodExclusions,
    });

    if (!result) {
      return {
        error:
          "Failed to regenerate steps. The AI service may be unavailable — please try again.",
      };
    }

    return {
      steps: result.steps,
      cookTime: result.cookTime,
      equipmentUsed: result.equipmentUsed,
    };
  } catch (error) {
    console.error("regenerateSteps action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function saveDraft(
  recipe: InspirationRecipe
): Promise<{ postId?: string; error?: string }> {
  const user = await requireAuth();

  if (!recipe || !recipe.title) {
    return { error: "Invalid recipe data." };
  }

  try {
    // Strip source metadata from ingredients for the standard ingredients column
    const standardIngredients = recipe.ingredients.map(
      ({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })
    );

    const [post] = await db
      .insert(posts)
      .values({
        userId: user.id,
        title: recipe.title,
        description: recipe.description || null,
        cookTime: recipe.cookTime || null,
        difficulty: recipe.difficulty || null,
        servings: recipe.servings || null,
        ingredients: standardIngredients,
        steps: recipe.steps,
        status: "draft",
        source: "inspiration",
        aiRecipe: recipe,
      })
      .returning({ id: posts.id });

    revalidatePath("/feed");
    revalidatePath("/drafts");

    return { postId: post.id };
  } catch (error) {
    console.error("saveDraft action error:", error);
    return { error: "Failed to save draft. Please try again." };
  }
}

export async function publishDraft(
  postId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.userId, user.id)),
  });

  if (!post) {
    return { error: "Post not found." };
  }

  if (post.status !== "draft") {
    return { error: "This post is already published." };
  }

  // Check cache for cooking tip first, fall back to fresh generation
  // NOTE: Not rate limited — this is a post-publish side effect, not a user-initiated AI request
  const aiTip = await getCachedCookingTip(post.title)
    ?? await generateCookingTip(post.title, post.description ?? undefined);

  await db
    .update(posts)
    .set({
      status: "published",
      aiTip,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  // Allocate cooking skills from the recipe steps
  if (post.steps && (post.steps as RecipeStep[]).length > 0) {
    await allocateSkills({
      userId: user.id,
      postId: post.id,
      title: post.title,
      steps: post.steps as RecipeStep[],
      ingredients: (post.ingredients as Ingredient[]) ?? [],
    });
  }

  revalidatePath("/feed");
  revalidatePath("/drafts");
  revalidatePath(`/post/${postId}`);

  return { success: true };
}

export async function deleteDraft(
  postId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.userId, user.id)),
  });

  if (!post) {
    return { error: "Post not found." };
  }

  if (post.status !== "draft") {
    return { error: "Only draft posts can be deleted this way." };
  }

  await db.delete(posts).where(eq(posts.id, postId));

  revalidatePath("/drafts");

  return { success: true };
}
