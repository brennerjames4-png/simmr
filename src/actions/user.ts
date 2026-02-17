"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateAvatar(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const user = await requireAuth();

  const avatarUrl = formData.get("avatarUrl") as string;

  if (!avatarUrl) {
    return { error: "No image provided" };
  }

  await db
    .update(users)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/feed");

  return { success: true };
}
