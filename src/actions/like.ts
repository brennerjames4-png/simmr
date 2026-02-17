"use server";

import { db } from "@/lib/db";
import { likes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleLike(postId: string) {
  const user = await requireAuth();

  const existing = await db.query.likes.findFirst({
    where: and(eq(likes.userId, user.id), eq(likes.postId, postId)),
  });

  if (existing) {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, user.id), eq(likes.postId, postId)));
  } else {
    await db.insert(likes).values({
      userId: user.id,
      postId,
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
}
