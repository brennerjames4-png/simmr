"use server";

import { requireAuth } from "@/lib/auth";
import { generateIngredientList } from "@/lib/ai/cooking-tips";
import type { Ingredient } from "@/lib/db/schema";

export async function generateIngredients(
  dishName: string,
  servings: number
): Promise<{ ingredients?: Ingredient[]; error?: string }> {
  await requireAuth();

  if (!dishName.trim()) {
    return { error: "Please enter a dish name first" };
  }

  if (!servings || servings < 1) {
    return { error: "Please enter the number of servings" };
  }

  const ingredients = await generateIngredientList(dishName, servings);

  if (!ingredients) {
    return { error: "Failed to generate ingredients. Please try again." };
  }

  return { ingredients };
}
