import { db } from "@/lib/db";
import { posts, users, likes } from "@/lib/db/schema";
import { desc, eq, sql, and, lt, count } from "drizzle-orm";

export type PostWithUser = {
  id: string;
  title: string;
  description: string | null;
  recipeNotes: string | null;
  imageUrl: string;
  imageKey: string | null;
  tags: string[] | null;
  cookTime: number | null;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert" | null;
  servings: number | null;
  aiTip: string | null;
  createdAt: Date;
  userId: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  isLiked: boolean;
};

export async function getFeedPosts(
  currentUserId: string,
  cursor?: string,
  limit = 10
): Promise<PostWithUser[]> {
  const conditions = cursor
    ? lt(posts.createdAt, new Date(cursor))
    : undefined;

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      recipeNotes: posts.recipeNotes,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      tags: posts.tags,
      cookTime: posts.cookTime,
      difficulty: posts.difficulty,
      servings: posts.servings,
      aiTip: posts.aiTip,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(conditions)
    .groupBy(posts.id, users.id)
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    recipeNotes: r.recipeNotes,
    imageUrl: r.imageUrl,
    imageKey: r.imageKey,
    tags: r.tags,
    cookTime: r.cookTime,
    difficulty: r.difficulty,
    servings: r.servings,
    aiTip: r.aiTip,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
  }));
}

export async function getPostById(
  postId: string,
  currentUserId: string
): Promise<PostWithUser | null> {
  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      recipeNotes: posts.recipeNotes,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      tags: posts.tags,
      cookTime: posts.cookTime,
      difficulty: posts.difficulty,
      servings: posts.servings,
      aiTip: posts.aiTip,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(posts.id, postId))
    .groupBy(posts.id, users.id);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    recipeNotes: r.recipeNotes,
    imageUrl: r.imageUrl,
    imageKey: r.imageKey,
    tags: r.tags,
    cookTime: r.cookTime,
    difficulty: r.difficulty,
    servings: r.servings,
    aiTip: r.aiTip,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
  };
}

export async function getUserPosts(
  username: string,
  currentUserId: string
): Promise<PostWithUser[]> {
  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      description: posts.description,
      recipeNotes: posts.recipeNotes,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      tags: posts.tags,
      cookTime: posts.cookTime,
      difficulty: posts.difficulty,
      servings: posts.servings,
      aiTip: posts.aiTip,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(users.username, username))
    .groupBy(posts.id, users.id)
    .orderBy(desc(posts.createdAt));

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    recipeNotes: r.recipeNotes,
    imageUrl: r.imageUrl,
    imageKey: r.imageKey,
    tags: r.tags,
    cookTime: r.cookTime,
    difficulty: r.difficulty,
    servings: r.servings,
    aiTip: r.aiTip,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
  }));
}
