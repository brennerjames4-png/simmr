import { requireAuth } from "@/lib/auth";
import { getCollectionItems } from "@/actions/collections";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { CollectionRecipeCard } from "@/components/collections/collection-recipe-card";

export const metadata = {
  title: "Collection",
};

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, id), eq(collections.userId, user.id)),
  });

  if (!collection) notFound();

  const items = await getCollectionItems(id);

  return (
    <div className="space-y-6">
      <Link
        href="/collections"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to collections
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{collection.name}</h1>
        {collection.description && (
          <p className="text-muted-foreground mt-1">
            {collection.description}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? "recipe" : "recipes"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
            <Bookmark className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">No recipes saved</p>
          <p className="text-sm text-muted-foreground mt-1">
            Save recipes from the feed to add them here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((post) => (
            <CollectionRecipeCard
              key={post.id}
              post={post}
              collectionId={id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
