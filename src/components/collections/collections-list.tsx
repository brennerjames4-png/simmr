"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, FolderPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCollection, deleteCollection } from "@/actions/collections";
import { toast } from "sonner";
import type { CollectionWithCount } from "@/queries/collections";

export function CollectionsList({
  collections: initialCollections,
}: {
  collections: CollectionWithCount[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createCollection(newName.trim());
    setCreating(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.collection) {
      setCollections((prev) => [
        ...prev,
        { ...result.collection!, itemCount: 0 },
      ]);
      setNewName("");
      setShowCreate(false);
      toast.success("Collection created!");
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteCollection(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast.success("Collection deleted.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {showCreate ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            New Collection
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <Link
              href={`/collections/${collection.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{collection.name}</p>
                <p className="text-sm text-muted-foreground">
                  {collection.itemCount}{" "}
                  {collection.itemCount === 1 ? "recipe" : "recipes"}
                </p>
              </div>
            </Link>
            {!collection.isDefault && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(collection.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
