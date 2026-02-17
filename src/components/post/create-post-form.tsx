"use client";

import { useActionState, useState } from "react";
import { createPost } from "@/actions/post";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";
import { ImageIcon, X } from "lucide-react";
import Image from "next/image";

export function CreatePostForm() {
  const [imageUrl, setImageUrl] = useState("");
  const [imageKey, setImageKey] = useState("");

  const [state, action, isPending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      return await createPost(formData);
    },
    undefined
  );

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Photo *</Label>
        {imageUrl ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border">
            <Image
              src={imageUrl}
              alt="Upload preview"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImageUrl("");
                setImageKey("");
              }}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <UploadDropzone<OurFileRouter, "postImage">
            endpoint="postImage"
            onClientUploadComplete={(res) => {
              if (res?.[0]) {
                setImageUrl(res[0].ufsUrl);
                setImageKey(res[0].key);
              }
            }}
            onUploadError={(error) => {
              console.error("Upload error:", error);
            }}
            className="border-dashed border-2 border-border rounded-lg p-8 ut-label:text-foreground ut-allowed-content:text-muted-foreground ut-button:bg-primary ut-button:text-primary-foreground"
            content={{
              label: "Drop your food photo here",
              allowedContent: "Images up to 8MB",
            }}
          />
        )}
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <input type="hidden" name="imageKey" value={imageKey} />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          placeholder="What did you make?"
          maxLength={200}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Tell the story behind this dish..."
          rows={3}
        />
      </div>

      {/* Recipe Notes */}
      <div className="space-y-2">
        <Label htmlFor="recipeNotes">Recipe Notes</Label>
        <Textarea
          id="recipeNotes"
          name="recipeNotes"
          placeholder="Share your technique, tips, or full recipe..."
          rows={4}
        />
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cookTime">Cook Time (min)</Label>
          <Input
            id="cookTime"
            name="cookTime"
            type="number"
            placeholder="30"
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="servings">Servings</Label>
          <Input
            id="servings"
            name="servings"
            type="number"
            placeholder="4"
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <select
            id="difficulty"
            name="difficulty"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select...</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          placeholder="pasta, italian, quick (comma separated)"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !imageUrl}
      >
        {isPending ? "Publishing..." : "Publish"}
      </Button>
    </form>
  );
}
