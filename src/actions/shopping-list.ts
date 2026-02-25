"use server";

import { db } from "@/lib/db";
import { shoppingLists, mealPlans } from "@/lib/db/schema";
import type { ShoppingList, ShoppingListItem, Ingredient, MealPlanDay } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { aggregateIngredients } from "@/lib/shopping-list";

export async function createShoppingList(params: {
  name: string;
  recipes: Array<{
    title: string;
    ingredients: Ingredient[];
  }>;
}): Promise<{ list?: ShoppingList; error?: string }> {
  const user = await requireAuth();

  if (!params.name.trim()) {
    return { error: "List name is required." };
  }

  if (!params.recipes.length) {
    return { error: "At least one recipe is required." };
  }

  try {
    const items = aggregateIngredients(params.recipes);

    const [saved] = await db
      .insert(shoppingLists)
      .values({
        userId: user.id,
        name: params.name.trim().slice(0, 100),
        items,
      })
      .returning();

    revalidatePath("/shopping");

    return {
      list: {
        id: saved.id,
        name: saved.name,
        items: saved.items,
        sourceRecipeIds: saved.sourceRecipeIds,
        isCompleted: saved.isCompleted,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
    };
  } catch (error) {
    console.error("createShoppingList error:", error);
    return { error: "Failed to create shopping list." };
  }
}

export async function createShoppingListFromMealPlan(
  mealPlanId: string
): Promise<{ list?: ShoppingList; error?: string }> {
  const user = await requireAuth();

  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, user.id)),
  });

  if (!plan) {
    return { error: "Meal plan not found." };
  }

  const recipes = (plan.planData as MealPlanDay[]).map((day) => ({
    title: day.recipe.title,
    ingredients: day.recipe.ingredients,
  }));

  const weekDate = new Date(plan.weekStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return createShoppingList({
    name: `Week of ${weekDate}`,
    recipes,
  });
}

export async function toggleShoppingListItem(
  listId: string,
  itemIndex: number
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const list = await db.query.shoppingLists.findFirst({
    where: and(
      eq(shoppingLists.id, listId),
      eq(shoppingLists.userId, user.id)
    ),
  });

  if (!list) {
    return { error: "Shopping list not found." };
  }

  const items = list.items as ShoppingListItem[];
  if (itemIndex < 0 || itemIndex >= items.length) {
    return { error: "Invalid item index." };
  }

  items[itemIndex].checked = !items[itemIndex].checked;

  await db
    .update(shoppingLists)
    .set({
      items,
      updatedAt: new Date(),
    })
    .where(eq(shoppingLists.id, listId));

  return { success: true };
}

export async function deleteShoppingList(
  listId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const list = await db.query.shoppingLists.findFirst({
    where: and(
      eq(shoppingLists.id, listId),
      eq(shoppingLists.userId, user.id)
    ),
  });

  if (!list) {
    return { error: "Shopping list not found." };
  }

  await db.delete(shoppingLists).where(eq(shoppingLists.id, listId));

  revalidatePath("/shopping");
  return { success: true };
}

export async function getShoppingLists(): Promise<ShoppingList[]> {
  const user = await requireAuth();

  const results = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, user.id))
    .orderBy(desc(shoppingLists.createdAt));

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    items: r.items,
    sourceRecipeIds: r.sourceRecipeIds,
    isCompleted: r.isCompleted,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}
