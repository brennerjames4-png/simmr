import { db } from "@/lib/db";
import { posts, users, likes, collectionItems, collections } from "@/lib/db/schema";
import type { Ingredient, RecipeStep, InspirationRecipe } from "@/lib/db/schema";
import { desc, eq, sql, and, lt, count } from "drizzle-orm";

export type PostWithUser = {
  id: string;
  title: string;
  description: string | null;
  recipeNotes: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  tags: string[] | null;
  cookTime: number | null;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert" | null;
  servings: number | null;
  ingredients: Ingredient[] | null;
  steps: RecipeStep[] | null;
  aiTip: string | null;
  status: "draft" | "published";
  source: string;
  aiRecipe: InspirationRecipe | null;
  createdAt: Date;
  userId: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  isLiked: boolean;
  isSimmr: boolean;
  isSaved: boolean;
};

export async function getFeedPosts(
  currentUserId: string,
  cursor?: string,
  limit = 10
): Promise<PostWithUser[]> {
  const whereConditions = [
    // Only show published posts in feed
    eq(posts.status, "published"),
    // Privacy filter: show own posts, public users' posts, or accepted follows' posts
    sql`(
      ${posts.userId} = ${currentUserId}
      OR ${users.isPrivate} = false
      OR EXISTS (
        SELECT 1 FROM follows
        WHERE follows.follower_id = ${currentUserId}
        AND follows.following_id = ${posts.userId}
        AND follows.status = 'accepted'
      )
    )`,
    // Block filter: exclude blocked users in both directions
    sql`NOT EXISTS (
      SELECT 1 FROM follows
      WHERE follows.status = 'blocked'
      AND (
        (follows.follower_id = ${currentUserId} AND follows.following_id = ${posts.userId})
        OR (follows.follower_id = ${posts.userId} AND follows.following_id = ${currentUserId})
      )
    )`,
  ];

  if (cursor) {
    whereConditions.push(lt(posts.createdAt, new Date(cursor)));
  }

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
      ingredients: posts.ingredients,
      steps: posts.steps,
      aiTip: posts.aiTip,
      status: posts.status,
      source: posts.source,
      aiRecipe: posts.aiRecipe,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
      isSimmr: sql<boolean>`EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
        WHERE f1.follower_id = ${currentUserId}
        AND f1.following_id = ${posts.userId}
        AND f1.status = 'accepted'
        AND f2.status = 'accepted'
      )`,
      isSaved: sql<boolean>`EXISTS (
        SELECT 1 FROM collection_items ci
        JOIN collections c ON ci.collection_id = c.id
        WHERE ci.post_id = ${posts.id} AND c.user_id = ${currentUserId}
      )`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(and(...whereConditions))
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
    ingredients: r.ingredients ?? null,
    steps: r.steps ?? null,
    aiTip: r.aiTip,
    status: r.status,
    source: r.source,
    aiRecipe: r.aiRecipe ?? null,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
    isSimmr: r.isSimmr ?? false,
    isSaved: r.isSaved ?? false,
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
      ingredients: posts.ingredients,
      steps: posts.steps,
      aiTip: posts.aiTip,
      status: posts.status,
      source: posts.source,
      aiRecipe: posts.aiRecipe,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
      isSimmr: sql<boolean>`EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
        WHERE f1.follower_id = ${currentUserId}
        AND f1.following_id = ${posts.userId}
        AND f1.status = 'accepted'
        AND f2.status = 'accepted'
      )`,
      isSaved: sql<boolean>`EXISTS (
        SELECT 1 FROM collection_items ci
        JOIN collections c ON ci.collection_id = c.id
        WHERE ci.post_id = ${posts.id} AND c.user_id = ${currentUserId}
      )`,
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
    ingredients: r.ingredients ?? null,
    steps: r.steps ?? null,
    aiTip: r.aiTip,
    status: r.status,
    source: r.source,
    aiRecipe: r.aiRecipe ?? null,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
    isSimmr: r.isSimmr ?? false,
    isSaved: r.isSaved ?? false,
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
      ingredients: posts.ingredients,
      steps: posts.steps,
      aiTip: posts.aiTip,
      status: posts.status,
      source: posts.source,
      aiRecipe: posts.aiRecipe,
      createdAt: posts.createdAt,
      userId: posts.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      likeCount: sql<number>`count(${likes.id})::int`,
      isLiked: sql<boolean>`bool_or(${likes.userId} = ${currentUserId})`,
      isSimmr: sql<boolean>`EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
        WHERE f1.follower_id = ${currentUserId}
        AND f1.following_id = ${posts.userId}
        AND f1.status = 'accepted'
        AND f2.status = 'accepted'
      )`,
      isSaved: sql<boolean>`EXISTS (
        SELECT 1 FROM collection_items ci
        JOIN collections c ON ci.collection_id = c.id
        WHERE ci.post_id = ${posts.id} AND c.user_id = ${currentUserId}
      )`,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(and(eq(users.username, username), eq(posts.status, "published")))
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
    ingredients: r.ingredients ?? null,
    steps: r.steps ?? null,
    aiTip: r.aiTip,
    status: r.status,
    source: r.source,
    aiRecipe: r.aiRecipe ?? null,
    createdAt: r.createdAt,
    userId: r.userId,
    user: {
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    },
    likeCount: r.likeCount ?? 0,
    isLiked: r.isLiked ?? false,
    isSimmr: r.isSimmr ?? false,
    isSaved: r.isSaved ?? false,
  }));
}
