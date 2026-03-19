"use server";

import { db } from "@/lib/db";
import { pantryItems } from "@/lib/db/schema";
import type { PantryItem } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizeIngredientName } from "@/lib/shopping-list";

export async function addPantryItem(params: {
  name: string;
  quantity?: string;
  unit?: string;
  category: string;
  isStaple?: boolean;
}): Promise<{ item?: PantryItem; error?: string }> {
  const user = await requireAuth();

  if (!params.name.trim()) {
    return { error: "Item name is required." };
  }

  try {
    const [saved] = await db
      .insert(pantryItems)
      .values({
        userId: user.id,
        name: params.name.trim().slice(0, 100),
        nameNormalized: normalizeIngredientName(params.name),
        quantity: params.quantity ?? null,
        unit: params.unit ?? null,
        category: params.category || "other",
        isStaple: params.isStaple ?? false,
      })
      .returning();

    revalidatePath("/pantry");
    revalidatePath("/meal-planner");

    return { item: saved };
  } catch (error) {
    console.error("addPantryItem error:", error);
    return { error: "Failed to add pantry item." };
  }
}

export async function updatePantryItem(params: {
  id: string;
  quantity?: string;
  unit?: string;
  isStaple?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const item = await db.query.pantryItems.findFirst({
    where: and(eq(pantryItems.id, params.id), eq(pantryItems.userId, user.id)),
  });

  if (!item) return { error: "Pantry item not found." };

  await db
    .update(pantryItems)
    .set({
      quantity: params.quantity ?? item.quantity,
      unit: params.unit ?? item.unit,
      isStaple: params.isStaple ?? item.isStaple,
      updatedAt: new Date(),
    })
    .where(eq(pantryItems.id, params.id));

  revalidatePath("/pantry");
  return { success: true };
}

export async function deletePantryItem(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const item = await db.query.pantryItems.findFirst({
    where: and(eq(pantryItems.id, id), eq(pantryItems.userId, user.id)),
  });

  if (!item) return { error: "Pantry item not found." };

  await db.delete(pantryItems).where(eq(pantryItems.id, id));

  revalidatePath("/pantry");
  return { success: true };
}

export async function getPantryItems(): Promise<PantryItem[]> {
  const user = await requireAuth();

  return db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.userId, user.id))
    .orderBy(pantryItems.category, pantryItems.name);
}
