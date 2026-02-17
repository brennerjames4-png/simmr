"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateAvatar(avatarUrl: string) {
  const user = await requireAuth();

  if (!avatarUrl) {
    return { error: "No image provided" };
  }

  await db
    .update(users)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}`);
  revalidatePath(`/profile/${user.username}/edit`);
  revalidatePath("/feed");

  return { success: true };
}
