"use server";

import { db } from "@/lib/db";
import { collections, collectionItems, posts } from "@/lib/db/schema";
import type { Collection, Post } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getOrCreateDefaultCollection(userId: string): Promise<string> {
  const existing = await db.query.collections.findFirst({
    where: and(
      eq(collections.userId, userId),
      eq(collections.isDefault, true)
    ),
  });

  if (existing) return existing.id;

  const [created] = await db
    .insert(collections)
    .values({
      userId,
      name: "Saved Recipes",
      isDefault: true,
    })
    .returning({ id: collections.id });

  return created.id;
}

export async function createCollection(
  name: string,
  description?: string
): Promise<{ collection?: Collection; error?: string }> {
  const user = await requireAuth();

  if (!name.trim()) {
    return { error: "Collection name is required." };
  }

  try {
    const [collection] = await db
      .insert(collections)
      .values({
        userId: user.id,
        name: name.trim().slice(0, 100),
        description: description?.trim() || null,
      })
      .returning();

    revalidatePath("/collections");
    return { collection };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("unique")) {
      return { error: "You already have a collection with that name." };
    }
    console.error("createCollection error:", error);
    return { error: "Failed to create collection." };
  }
}

export async function deleteCollection(
  collectionId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.userId, user.id)
    ),
  });

  if (!collection) {
    return { error: "Collection not found." };
  }

  if (collection.isDefault) {
    return { error: "Cannot delete the default collection." };
  }

  await db.delete(collections).where(eq(collections.id, collectionId));

  revalidatePath("/collections");
  return { success: true };
}

export async function saveToCollection(
  postId: string,
  collectionId?: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const targetCollectionId =
    collectionId ?? (await getOrCreateDefaultCollection(user.id));

  // Verify ownership of collection
  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, targetCollectionId),
      eq(collections.userId, user.id)
    ),
  });

  if (!collection) {
    return { error: "Collection not found." };
  }

  try {
    await db
      .insert(collectionItems)
      .values({
        collectionId: targetCollectionId,
        postId,
      })
      .onConflictDoNothing();

    revalidatePath("/collections");
    return { success: true };
  } catch (error) {
    console.error("saveToCollection error:", error);
    return { error: "Failed to save recipe." };
  }
}

export async function removeFromCollection(
  postId: string,
  collectionId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  // Verify ownership
  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.userId, user.id)
    ),
  });

  if (!collection) {
    return { error: "Collection not found." };
  }

  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.postId, postId)
      )
    );

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  return { success: true };
}

export async function getCollections(): Promise<Collection[]> {
  const user = await requireAuth();

  return db.query.collections.findMany({
    where: eq(collections.userId, user.id),
    orderBy: (table, { desc }) => [desc(table.isDefault), desc(table.createdAt)],
  });
}

export async function getCollectionItems(
  collectionId: string
): Promise<(Post & { user: { username: string; displayName: string; avatarUrl: string | null } })[]> {
  const user = await requireAuth();

  // Verify ownership
  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.userId, user.id)
    ),
  });

  if (!collection) return [];

  const items = await db
    .select({
      item: collectionItems,
      post: posts,
    })
    .from(collectionItems)
    .innerJoin(posts, eq(collectionItems.postId, posts.id))
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(collectionItems.addedAt);

  // We need user info for each post too
  const { users } = await import("@/lib/db/schema");
  const postsWithUsers = await Promise.all(
    items.map(async (item) => {
      const [postUser] = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, item.post.userId))
        .limit(1);

      return {
        ...item.post,
        user: postUser ?? { username: "unknown", displayName: "Unknown", avatarUrl: null },
      };
    })
  );

  return postsWithUsers;
}

export async function isPostSaved(postId: string): Promise<boolean> {
  const user = await requireAuth();

  const defaultCollection = await db.query.collections.findFirst({
    where: and(
      eq(collections.userId, user.id),
      eq(collections.isDefault, true)
    ),
  });

  if (!defaultCollection) return false;

  const item = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, defaultCollection.id),
      eq(collectionItems.postId, postId)
    ),
  });

  return !!item;
}

export async function toggleSavePost(
  postId: string
): Promise<{ saved: boolean; error?: string }> {
  const user = await requireAuth();

  const defaultCollectionId = await getOrCreateDefaultCollection(user.id);

  const existing = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, defaultCollectionId),
      eq(collectionItems.postId, postId)
    ),
  });

  if (existing) {
    await db.delete(collectionItems).where(eq(collectionItems.id, existing.id));
    revalidatePath("/collections");
    return { saved: false };
  } else {
    await db.insert(collectionItems).values({
      collectionId: defaultCollectionId,
      postId,
    });
    revalidatePath("/collections");
    return { saved: true };
  }
}
