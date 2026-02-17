"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  getOnboardingSession,
  clearOnboardingSession,
  createSession,
} from "@/lib/auth/session";

export async function checkUsername(
  username: string
): Promise<{ available: boolean }> {
  if (!username || username.length < 3) {
    return { available: false };
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
  });

  return { available: !existing };
}

export async function completeOnboarding(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const session = await getOnboardingSession();
  if (!session) {
    return { error: "Onboarding session expired. Please sign in again." };
  }

  const username = (formData.get("username") as string)?.trim()?.toLowerCase();
  const displayName = (formData.get("displayName") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim() || null;
  const avatarUrl = (formData.get("avatarUrl") as string)?.trim() || null;

  if (!username || username.length < 3) {
    return { error: "Username must be at least 3 characters." };
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores." };
  }

  if (!displayName) {
    return { error: "Display name is required." };
  }

  // Check username availability
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    return { error: "Username is already taken." };
  }

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      username,
      displayName,
      email: session.email,
      emailVerified: true,
      authProvider: session.provider,
      googleId: session.googleId || null,
      bio,
      avatarUrl,
    })
    .returning();

  await clearOnboardingSession();
  await createSession(newUser.id, newUser.username);
  redirect("/feed");
}
