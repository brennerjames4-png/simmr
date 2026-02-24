"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { searchUsers as searchUsersQuery } from "@/queries/users";
import type { SearchUser } from "@/queries/users";
import { deleteUploadthingFile } from "@/lib/uploadthing-cleanup";

export async function updateAvatar(avatarUrl: string) {
  const user = await requireAuth();

  if (!avatarUrl) {
    return { error: "No image provided" };
  }

  // Delete old avatar from Uploadthing if it exists
  const [currentUser] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (currentUser?.avatarUrl && currentUser.avatarUrl !== avatarUrl) {
    deleteUploadthingFile(currentUser.avatarUrl).catch(() => {});
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

export async function updateDisplayName(displayName: string) {
  const user = await requireAuth();

  const trimmed = displayName.trim();

  if (!trimmed) {
    return { error: "Display name cannot be empty." };
  }

  if (trimmed.length > 100) {
    return { error: "Display name must be 100 characters or less." };
  }

  await db
    .update(users)
    .set({ displayName: trimmed, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}`);
  revalidatePath(`/profile/${user.username}/edit`);
  revalidatePath("/feed");

  return { success: true };
}

export async function updateDietaryPreferences(
  preferences: string[],
  exclusions: string[]
) {
  const user = await requireAuth();

  // Validate that all preference IDs are valid
  const { DIETARY_OPTIONS } = await import("@/lib/dietary-config");
  const validIds = new Set(DIETARY_OPTIONS.map((d) => d.id));
  const filteredPreferences = preferences.filter((p) => validIds.has(p));

  // Clean up exclusions: trim, lowercase, deduplicate, limit to 50
  const cleanedExclusions = [
    ...new Set(
      exclusions
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.length <= 100)
    ),
  ].slice(0, 50);

  await db
    .update(users)
    .set({
      dietaryPreferences: filteredPreferences,
      foodExclusions: cleanedExclusions,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}`);
  revalidatePath(`/profile/${user.username}/dietary`);

  return { success: true };
}

export async function searchUsers(query: string): Promise<SearchUser[]> {
  await requireAuth();
  return searchUsersQuery(query);
}

export async function updateBypassCode(
  code: string
): Promise<{ success?: boolean; error?: string; valid?: boolean }> {
  const user = await requireAuth();

  const trimmed = code.trim();

  // Allow clearing the code
  if (!trimmed) {
    await db
      .update(users)
      .set({ bypassCode: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { success: true, valid: false };
  }

  // Check if the code is valid
  const validCode = process.env.SIMMR_BYPASS_CODE;
  const isValid = validCode ? trimmed === validCode : false;

  // Save the code regardless (so we can see what people entered), but tell them if it's valid
  await db
    .update(users)
    .set({ bypassCode: trimmed, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath(`/profile/${user.username}/settings`);

  if (isValid) {
    return { success: true, valid: true };
  } else {
    return { error: "Invalid code.", valid: false };
  }
}
