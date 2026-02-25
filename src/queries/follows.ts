import { db } from "@/lib/db";
import { follows, users, posts, likes } from "@/lib/db/schema";
import { eq, and, sql, or, ne, count } from "drizzle-orm";

export type FollowRelationship =
  | "none"
  | "following"
  | "pending"
  | "blocked"
  | "blocked_by";

export type FollowListUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  relationship: FollowRelationship;
};

export type UserProfileWithFollowStats = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isPrivate: boolean;
  kitchenInventory: unknown;
  dietaryPreferences: string[] | null;
  foodExclusions: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  postCount: number;
  totalLikes: number;
  followerCount: number;
  followingCount: number;
  simmrCount: number;
  currentStreak: number;
  longestStreak: number;
  totalPublished: number;
};

/**
 * Get the relationship state from currentUser → targetUser
 */
export async function getRelationshipState(
  currentUserId: string,
  targetUserId: string
): Promise<FollowRelationship> {
  if (currentUserId === targetUserId) return "none";

  // Check outgoing follow (currentUser → target)
  const outgoing = await db
    .select({ status: follows.status })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, currentUserId),
        eq(follows.followingId, targetUserId)
      )
    )
    .limit(1);

  if (outgoing.length > 0) {
    const status = outgoing[0].status;
    if (status === "accepted") return "following";
    if (status === "pending") return "pending";
    if (status === "blocked") return "blocked";
  }

  // Check if target has blocked current user
  const incoming = await db
    .select({ status: follows.status })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, targetUserId),
        eq(follows.followingId, currentUserId),
        eq(follows.status, "blocked")
      )
    )
    .limit(1);

  if (incoming.length > 0) return "blocked_by";

  return "none";
}

/**
 * Get user profile with follow stats (replaces getUserByUsername for profile page)
 */
export async function getUserProfileWithFollowStats(
  username: string
): Promise<UserProfileWithFollowStats | null> {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      isPrivate: users.isPrivate,
      kitchenInventory: users.kitchenInventory,
      dietaryPreferences: users.dietaryPreferences,
      foodExclusions: users.foodExclusions,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      totalPublished: users.totalPublished,
      postCount: sql<number>`count(distinct ${posts.id})::int`,
      totalLikes: sql<number>`count(distinct ${likes.id})::int`,
      followerCount: sql<number>`(
        SELECT count(*)::int FROM follows
        WHERE follows.following_id = ${users.id} AND follows.status = 'accepted'
      )`,
      followingCount: sql<number>`(
        SELECT count(*)::int FROM follows
        WHERE follows.follower_id = ${users.id} AND follows.status = 'accepted'
      )`,
      simmrCount: sql<number>`(
        SELECT count(*)::int FROM follows f1
        WHERE f1.follower_id = ${users.id}
        AND f1.status = 'accepted'
        AND EXISTS (
          SELECT 1 FROM follows f2
          WHERE f2.follower_id = f1.following_id
          AND f2.following_id = f1.follower_id
          AND f2.status = 'accepted'
        )
      )`,
    })
    .from(users)
    .leftJoin(posts, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(users.username, username))
    .groupBy(users.id);

  if (result.length === 0) return null;
  return result[0];
}

/**
 * Get followers of a user
 */
export async function getFollowers(
  userId: string,
  currentUserId: string
): Promise<FollowListUser[]> {
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(
      and(
        eq(follows.followingId, userId),
        eq(follows.status, "accepted")
      )
    )
    .orderBy(users.displayName);

  // Enrich with relationship state for current user
  const enriched: FollowListUser[] = [];
  for (const user of results) {
    const relationship =
      user.id === currentUserId
        ? ("none" as FollowRelationship)
        : await getRelationshipState(currentUserId, user.id);
    enriched.push({ ...user, relationship });
  }
  return enriched;
}

/**
 * Get users that a user is following
 */
export async function getFollowing(
  userId: string,
  currentUserId: string
): Promise<FollowListUser[]> {
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(
      and(
        eq(follows.followerId, userId),
        eq(follows.status, "accepted")
      )
    )
    .orderBy(users.displayName);

  const enriched: FollowListUser[] = [];
  for (const user of results) {
    const relationship =
      user.id === currentUserId
        ? ("none" as FollowRelationship)
        : await getRelationshipState(currentUserId, user.id);
    enriched.push({ ...user, relationship });
  }
  return enriched;
}

/**
 * Get mutual follows (Simmrs) for a user
 */
export async function getSimmrs(
  userId: string,
  currentUserId: string
): Promise<FollowListUser[]> {
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(
      and(
        eq(follows.followerId, userId),
        eq(follows.status, "accepted"),
        sql`EXISTS (
          SELECT 1 FROM follows f2
          WHERE f2.follower_id = ${follows.followingId}
          AND f2.following_id = ${follows.followerId}
          AND f2.status = 'accepted'
        )`
      )
    )
    .orderBy(users.displayName);

  const enriched: FollowListUser[] = [];
  for (const user of results) {
    const relationship =
      user.id === currentUserId
        ? ("none" as FollowRelationship)
        : await getRelationshipState(currentUserId, user.id);
    enriched.push({ ...user, relationship });
  }
  return enriched;
}

/**
 * Get pending incoming follow requests for a user
 */
export async function getPendingRequests(
  userId: string
): Promise<FollowListUser[]> {
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(
      and(
        eq(follows.followingId, userId),
        eq(follows.status, "pending")
      )
    )
    .orderBy(follows.createdAt);

  return results.map((user) => ({
    ...user,
    relationship: "none" as FollowRelationship,
  }));
}

/**
 * Get count of pending incoming follow requests
 */
export async function getPendingRequestCount(
  userId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(
      and(
        eq(follows.followingId, userId),
        eq(follows.status, "pending")
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Check if current user can view target user's content
 */
export async function canViewUserContent(
  currentUserId: string | null,
  targetUserId: string
): Promise<boolean> {
  // Own profile
  if (currentUserId === targetUserId) return true;

  // Check if target is private
  const targetUser = await db
    .select({ isPrivate: users.isPrivate })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (targetUser.length === 0) return false;
  if (!targetUser[0].isPrivate) return true;

  // Private user — check if current user has accepted follow
  if (!currentUserId) return false;

  const follow = await db
    .select({ status: follows.status })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, currentUserId),
        eq(follows.followingId, targetUserId),
        eq(follows.status, "accepted")
      )
    )
    .limit(1);

  return follow.length > 0;
}

/**
 * Check if either user has blocked the other
 */
export async function isBlocked(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const result = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        or(
          and(
            eq(follows.followerId, userId1),
            eq(follows.followingId, userId2)
          ),
          and(
            eq(follows.followerId, userId2),
            eq(follows.followingId, userId1)
          )
        ),
        eq(follows.status, "blocked")
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get blocked users for settings page
 */
export async function getBlockedUsers(
  userId: string
): Promise<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]> {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(
      and(
        eq(follows.followerId, userId),
        eq(follows.status, "blocked")
      )
    )
    .orderBy(users.displayName);
}
