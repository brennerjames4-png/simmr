import { requireAuth } from "@/lib/auth";
import { getUserCollectionsWithCounts } from "@/queries/collections";
import { CollectionsList } from "@/components/collections/collections-list";
import { Bookmark } from "lucide-react";

export const metadata = {
  title: "Collections",
};

export default async function CollectionsPage() {
  const user = await requireAuth();
  const collections = await getUserCollectionsWithCounts(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground mt-1">
          Save and organize your favorite recipes.
        </p>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Bookmark className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No collections yet</h2>
          <p className="text-muted-foreground mt-1">
            Save recipes from the feed to start building your collection.
          </p>
        </div>
      ) : (
        <CollectionsList collections={collections} />
      )}
    </div>
  );
}
