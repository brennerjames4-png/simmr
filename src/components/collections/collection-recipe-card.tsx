"use client";

import Link from "next/link";
import { Clock, ChefHat, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeFromCollection } from "@/actions/collections";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Post } from "@/lib/db/schema";

export function CollectionRecipeCard({
  post,
  collectionId,
}: {
  post: Post & {
    user: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
  collectionId: string;
}) {
  const router = useRouter();

  async function handleRemove() {
    const result = await removeFromCollection(post.id, collectionId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Removed from collection.");
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/post/${post.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{post.title}</h3>
          {post.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {post.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="text-xs">
              by{" "}
              <span className="font-medium">{post.user.displayName}</span>
            </span>
            {post.cookTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.cookTime}m
              </span>
            )}
            {post.difficulty && (
              <span className="flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                {post.difficulty}
              </span>
            )}
            {post.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {post.servings}
              </span>
            )}
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
