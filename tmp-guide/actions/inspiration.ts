"use server";

import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { generateInspirationRecipe, regenerateRecipeSteps as aiRegenerateSteps } from "@/lib/ai/inspiration";
import { getKitchenInventory } from "@/queries/kitchen";
import { getRecentMealsForInference } from "@/queries/inspiration";
import type { InspirationInput, AIRecipe, AIRecipeIngredient, AIRecipeStep } from "@/types/inspiration";
import type { ActionResult } from "@/types/follow";

// ============================================================
// GENERATE RECIPE (AI call)
// ============================================================

interface GenerateResult {
  success: boolean;
  error?: string;
  recipe?: AIRecipe;
}

export async function generateRecipe(
  input: InspirationInput
): Promise<GenerateResult> {
  const currentUser = await requireAuth();

  if (!input.availableIngredients.trim()) {
    return { success: false, error: "Please describe what ingredients you have available" };
  }

  if (input.availableIngredients.trim().length < 5) {
    return { success: false, error: "Please provide more detail about your ingredients" };
  }

  try {
    // Gather context in parallel
    const [kitchenInventory, recentMeals] = await Promise.all([
      getKitchenInventory(currentUser.id),
      getRecentMealsForInference(currentUser.id),
    ]);

    // Call AI
    const recipe = await generateInspirationRecipe({
      input,
      kitchenEquipment: kitchenInventory.items,
      recentMeals,
    });

    return { success: true, recipe };
  } catch (e) {
    console.error("Recipe generation failed:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to generate recipe. Please try again.",
    };
  }
}

// ============================================================
// REGENERATE STEPS (after ingredient edit)
// ============================================================

interface RegenerateStepsInput {
  dishName: string;
  servings: number;
  ingredients: AIRecipeIngredient[];
  removedIngredients: string[];
}

interface RegenerateStepsResult {
  success: boolean;
  error?: string;
  steps?: AIRecipeStep[];
  tips?: string[];
  equipmentUsed?: string[];
}

/**
 * Regenerate only the cooking steps after the user edits ingredients.
 * Cheaper and faster than regenerating the entire recipe — only the
 * steps, tips, and equipment list are re-generated.
 */
export async function regenerateRecipeSteps(
  input: RegenerateStepsInput
): Promise<RegenerateStepsResult> {
  const currentUser = await requireAuth();

  if (input.ingredients.length === 0) {
    return { success: false, error: "Recipe needs at least one ingredient" };
  }

  try {
    // Get kitchen equipment for the AI constraint
    const kitchenInventory = await getKitchenInventory(currentUser.id);

    const result = await aiRegenerateSteps({
      dishName: input.dishName,
      servings: input.servings,
      ingredients: input.ingredients,
      removedIngredients: input.removedIngredients,
      kitchenEquipment: kitchenInventory.items,
    });

    return {
      success: true,
      steps: result.steps,
      tips: result.tips,
      equipmentUsed: result.equipmentUsed,
    };
  } catch (e) {
    console.error("Step regeneration failed:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to regenerate steps. Please try again.",
    };
  }
}

// ============================================================
// SAVE RECIPE AS DRAFT
// ============================================================

interface SaveDraftResult {
  success: boolean;
  error?: string;
  draftId?: string;
}

export async function saveRecipeAsDraft(
  recipe: AIRecipe
): Promise<SaveDraftResult> {
  const currentUser = await requireAuth();

  try {
    // Build recipe notes from steps
    const recipeNotes = recipe.steps
      .map((step) => {
        let line = `${step.stepNumber}. ${step.instruction}`;
        if (step.duration) line += ` (${step.duration} min)`;
        return line;
      })
      .join("\n\n");

    // Build tags from the recipe
    const tags: string[] = [];
    if (recipe.difficulty) tags.push(recipe.difficulty);
    if (recipe.totalTime <= 30) tags.push("quick");
    if (recipe.totalTime <= 15) tags.push("15-min");
    // Add a couple ingredient-based tags
    const mainIngredients = recipe.ingredients
      .filter((i) => i.category === "provided")
      .slice(0, 3)
      .map((i) => i.name.toLowerCase());
    tags.push(...mainIngredients);

    // Create the draft post
    const result = await db
      .insert(posts)
      .values({
        userId: currentUser.id,
        title: recipe.dishName,
        description: recipe.description,
        recipeNotes,
        tags,
        cookTime: recipe.totalTime,
        difficulty: recipe.difficulty,
        servings: recipe.servings,
        aiRecipe: recipe as any, // JSONB
        aiTip: recipe.tips[0] ?? null,
        source: "inspiration",
        status: "draft",
      })
      .returning({ id: posts.id });

    const draftId = result[0]?.id;
    if (!draftId) {
      throw new Error("Failed to create draft");
    }

    revalidatePath("/drafts");
    revalidatePath("/feed");

    return { success: true, draftId };
  } catch (e) {
    console.error("Failed to save draft:", e);
    return {
      success: false,
      error: "Failed to save recipe as draft. Please try again.",
    };
  }
}

// ============================================================
// PUBLISH DRAFT
// ============================================================

export async function publishDraft(draftId: string): Promise<ActionResult> {
  const currentUser = await requireAuth();

  const draft = await db
    .select({ id: posts.id, userId: posts.userId, status: posts.status })
    .from(posts)
    .where(
      and(
        eq(posts.id, draftId),
        eq(posts.userId, currentUser.id),
        eq(posts.status, "draft")
      )
    )
    .limit(1);

  if (!draft[0]) {
    return { success: false, error: "Draft not found" };
  }

  await db
    .update(posts)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(posts.id, draftId));

  revalidatePath("/feed");
  revalidatePath("/drafts");
  revalidatePath("/profile");

  return { success: true };
}

// ============================================================
// DELETE DRAFT
// ============================================================

export async function deleteDraft(draftId: string): Promise<ActionResult> {
  const currentUser = await requireAuth();

  await db
    .delete(posts)
    .where(
      and(
        eq(posts.id, draftId),
        eq(posts.userId, currentUser.id),
        eq(posts.status, "draft")
      )
    );

  revalidatePath("/drafts");
  return { success: true };
}
