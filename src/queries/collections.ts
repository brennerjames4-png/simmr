import { db } from "@/lib/db";
import { collections, collectionItems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export type CollectionWithCount = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  itemCount: number;
  createdAt: Date;
};

export async function getUserCollectionsWithCounts(
  userId: string
): Promise<CollectionWithCount[]> {
  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      isDefault: collections.isDefault,
      itemCount: sql<number>`count(${collectionItems.id})::int`,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .leftJoin(collectionItems, eq(collections.id, collectionItems.collectionId))
    .where(eq(collections.userId, userId))
    .groupBy(collections.id)
    .orderBy(sql`${collections.isDefault} DESC, ${collections.createdAt} DESC`);

  return results;
}
