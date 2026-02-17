"use client";

import { useActionState, useState, useTransition } from "react";
import { createPost } from "@/actions/post";
import { generateIngredients } from "@/actions/ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";
import type { Ingredient } from "@/lib/db/schema";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export function CreatePostForm() {
  const [imageUrl, setImageUrl] = useState("");
  const [imageKey, setImageKey] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isGenerating, startGenerating] = useTransition();
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");

  const [state, action, isPending] = useActionState(createPost, undefined);

  function handleGenerateIngredients() {
    const servingsNum = servings ? parseInt(servings) : undefined;
    if (!title.trim()) {
      toast.error("Enter a dish name first");
      return;
    }

    startGenerating(async () => {
      const result = await generateIngredients(
        title,
        servingsNum && servingsNum >= 1 ? servingsNum : undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else if (result.ingredients) {
        setIngredients(result.ingredients);
        toast.success("Ingredients generated!");
      }
    });
  }

  function updateIngredient(
    index: number,
    field: keyof Ingredient,
    value: string
  ) {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }]);
  }

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>
          Photo{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="servings">Servings</Label>
          <Input
            id="servings"
            name="servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
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

      {/* Ingredients Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Ingredients</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateIngredients}
            disabled={isGenerating || !title.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate with AI
              </>
            )}
          </Button>
        </div>

        {ingredients.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="pt-4 space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 text-xs text-muted-foreground font-medium px-1">
                <span>Ingredient</span>
                <span>Qty</span>
                <span>Unit</span>
                <span></span>
              </div>
              {ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center"
                >
                  <Input
                    value={ingredient.name}
                    onChange={(e) =>
                      updateIngredient(index, "name", e.target.value)
                    }
                    placeholder="e.g. flour"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={ingredient.quantity}
                    onChange={(e) =>
                      updateIngredient(index, "quantity", e.target.value)
                    }
                    placeholder="2"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={ingredient.unit}
                    onChange={(e) =>
                      updateIngredient(index, "unit", e.target.value)
                    }
                    placeholder="cups"
                    className="h-8 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addIngredient}
                className="w-full mt-1"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add ingredient
              </Button>
            </CardContent>
          </Card>
        )}

        {ingredients.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Fill in the dish name, then click &quot;Generate with AI&quot; to
            auto-create an ingredient list.
          </p>
        )}
      </div>

      {/* Hidden field for ingredients JSON */}
      <input
        type="hidden"
        name="ingredients"
        value={ingredients.length > 0 ? JSON.stringify(ingredients) : ""}
      />

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          placeholder="pasta, italian, quick (comma separated)"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Publishing..." : "Publish"}
      </Button>
    </form>
  );
}
