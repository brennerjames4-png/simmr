import { db } from "@/lib/db";
import { users, posts, likes } from "@/lib/db/schema";
import { eq, sql, count, or, ilike } from "drizzle-orm";
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
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      authProvider: users.authProvider,
      googleId: users.googleId,
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

export type SearchUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

export async function searchUsers(query: string): Promise<SearchUser[]> {
  if (!query || query.trim().length === 0) return [];

  const searchTerm = `%${query.trim()}%`;

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(users)
    .where(
      or(
        ilike(users.username, searchTerm),
        ilike(users.displayName, searchTerm)
      )
    )
    .orderBy(users.displayName)
    .limit(10);

  return results;
}
