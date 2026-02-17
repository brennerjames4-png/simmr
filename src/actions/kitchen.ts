"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { KitchenInventory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateKitchenInventory(inventory: KitchenInventory) {
  const user = await requireAuth();

  await db
    .update(users)
    .set({ kitchenInventory: inventory, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}`);
  revalidatePath(`/profile/${user.username}/kitchen`);

  return { success: true };
}
