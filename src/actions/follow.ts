"use server";

import { db } from "@/lib/db";
import { follows, users } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isBlocked } from "@/queries/follows";

export async function followUser(targetUserId: string) {
  const currentUser = await requireAuth();

  if (currentUser.id === targetUserId) {
    return { error: "Cannot follow yourself" };
  }

  // Check if blocked in either direction
  const blocked = await isBlocked(currentUser.id, targetUserId);
  if (blocked) {
    return { error: "Cannot follow this user" };
  }

  // Check if target is private
  const target = await db
    .select({ isPrivate: users.isPrivate })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (target.length === 0) {
    return { error: "User not found" };
  }

  const status = target[0].isPrivate ? "pending" : "accepted";

  await db
    .insert(follows)
    .values({
      followerId: currentUser.id,
      followingId: targetUserId,
      status,
    })
    .onConflictDoNothing();

  revalidatePath("/feed");
  revalidatePath("/notifications");
  revalidatePath(`/profile`);
  return { success: true, status };
}

export async function unfollowUser(targetUserId: string) {
  const currentUser = await requireAuth();

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, currentUser.id),
        eq(follows.followingId, targetUserId),
        or(
          eq(follows.status, "accepted"),
          eq(follows.status, "pending")
        )
      )
    );

  revalidatePath("/feed");
  revalidatePath(`/profile`);
  return { success: true };
}

export async function cancelRequest(targetUserId: string) {
  const currentUser = await requireAuth();

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, currentUser.id),
        eq(follows.followingId, targetUserId),
        eq(follows.status, "pending")
      )
    );

  revalidatePath(`/profile`);
  return { success: true };
}

export async function acceptRequest(followerId: string) {
  const currentUser = await requireAuth();

  await db
    .update(follows)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, currentUser.id),
        eq(follows.status, "pending")
      )
    );

  revalidatePath("/notifications");
  revalidatePath("/feed");
  revalidatePath(`/profile`);
  return { success: true };
}

export async function rejectRequest(followerId: string) {
  const currentUser = await requireAuth();

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, currentUser.id),
        eq(follows.status, "pending")
      )
    );

  revalidatePath("/notifications");
  return { success: true };
}

export async function blockUser(targetUserId: string) {
  const currentUser = await requireAuth();

  if (currentUser.id === targetUserId) {
    return { error: "Cannot block yourself" };
  }

  // Use a transaction for atomicity
  await db.transaction(async (tx) => {
    // Delete any existing follow from current user to target, then insert blocked
    await tx
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, currentUser.id),
          eq(follows.followingId, targetUserId)
        )
      );

    await tx.insert(follows).values({
      followerId: currentUser.id,
      followingId: targetUserId,
      status: "blocked",
    });

    // Remove their follow of us (if any)
    await tx
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, targetUserId),
          eq(follows.followingId, currentUser.id)
        )
      );
  });

  revalidatePath("/feed");
  revalidatePath(`/profile`);
  return { success: true };
}

export async function unblockUser(targetUserId: string) {
  const currentUser = await requireAuth();

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, currentUser.id),
        eq(follows.followingId, targetUserId),
        eq(follows.status, "blocked")
      )
    );

  revalidatePath(`/profile`);
  return { success: true };
}

export async function togglePrivacy() {
  const currentUser = await requireAuth();

  // Get current privacy state
  const user = await db
    .select({ isPrivate: users.isPrivate })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  if (user.length === 0) return { error: "User not found" };

  const newIsPrivate = !user[0].isPrivate;

  await db.transaction(async (tx) => {
    // Toggle the privacy setting
    await tx
      .update(users)
      .set({ isPrivate: newIsPrivate, updatedAt: new Date() })
      .where(eq(users.id, currentUser.id));

    // If switching to public, auto-accept all pending follow requests
    if (!newIsPrivate) {
      await tx
        .update(follows)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(
          and(
            eq(follows.followingId, currentUser.id),
            eq(follows.status, "pending")
          )
        );
    }
  });

  revalidatePath("/feed");
  revalidatePath(`/profile`);
  revalidatePath("/notifications");
  return { success: true, isPrivate: newIsPrivate };
}
