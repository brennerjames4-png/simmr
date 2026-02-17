import { db } from "@/lib/db";
import { users, posts, likes } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";
import type { User } from "@/lib/db/schema";

export type UserProfile = User & {
  postCount: number;
  totalLikes: number;
};

export async function getUserByUsername(
  username: string
): Promise<UserProfile | null> {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      passwordHash: users.passwordHash,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      kitchenInventory: users.kitchenInventory,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      postCount: sql<number>`count(distinct ${posts.id})::int`,
      totalLikes: sql<number>`count(distinct ${likes.id})::int`,
    })
    .from(users)
    .leftJoin(posts, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(users.username, username))
    .groupBy(users.id);

  if (result.length === 0) return null;
  return result[0];
}
