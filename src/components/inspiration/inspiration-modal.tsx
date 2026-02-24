"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Sparkles,
  ChefHat,
  Minus,
  Plus,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { SpeechInput } from "./speech-input";
import { RecipeDisplay } from "./recipe-display";
import {
  generateInspiration,
  saveDraft,
  regenerateSteps,
} from "@/actions/inspiration";
import type { InspirationRecipe, InspirationIngredient } from "@/lib/db/schema";
import { toast } from "sonner";

type ModalStep = "input" | "generating" | "recipe";

interface InspirationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasKitchenSetup: boolean;
  draftCount: number;
}

export function InspirationModal({
  open,
  onOpenChange,
  hasKitchenSetup,
  draftCount,
}: InspirationModalProps) {
  const [step, setStep] = useState<ModalStep>("input");
  const [ingredients, setIngredients] = useState("");
  const [servings, setServings] = useState(2);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [recipe, setRecipe] = useState<InspirationRecipe | null>(null);
  const [rejectedTitles, setRejectedTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // Ingredient editing state
  const [editedIngredients, setEditedIngredients] =
    useState<InspirationIngredient[] | null>(null);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [quantityChanges, setQuantityChanges] = useState<
    Map<string, { original: string; current: string }>
  >(new Map());
  const [isRegeneratingSteps, startRegeneratingSteps] = useTransition();
  const [originalRecipe, setOriginalRecipe] =
    useState<InspirationRecipe | null>(null);

  // Computed values for ingredient changes
  const hasIngredientChanges =
    removedIngredients.length > 0 || quantityChanges.size > 0;
  const ingredientChangeSummary: string[] = [
    ...removedIngredients.map((name) => `Removed: ${name}`),
    ...Array.from(quantityChanges.entries()).map(([key, change]) => {
      const [name] = key.split("|");
      return `${name}: ${change.original} \u2192 ${change.current}`;
    }),
  ];

  function resetEditState() {
    setEditedIngredients(null);
    setRemovedIngredients([]);
    setQuantityChanges(new Map());
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset step but keep inputs for next open
      setStep("input");
      setRecipe(null);
      setRejectedTitles([]);
      setError(null);
      resetEditState();
      setOriginalRecipe(null);
    }
    onOpenChange(newOpen);
  }

  function handleGenerate() {
    const previousStep = step;
    // If regenerating from the recipe view, remember the current recipe to avoid it
    const updatedRejected = recipe
      ? [...rejectedTitles, recipe.title]
      : rejectedTitles;
    if (recipe) {
      setRejectedTitles(updatedRejected);
    }
    setStep("generating");
    setError(null);
    startGenerating(async () => {
      const result = await generateInspiration(
        ingredients,
        servings,
        dietaryNotes || undefined,
        updatedRejected.length > 0 ? updatedRejected : undefined
      );
      if (result.error) {
        setError(result.error);
        // Go back to wherever we came from (input or recipe)
        setStep(previousStep === "recipe" ? "recipe" : "input");
      } else if (result.recipe) {
        setRecipe(result.recipe);
        setOriginalRecipe(result.recipe);
        resetEditState();
        setStep("recipe");
      }
    });
  }

  function handleSaveDraft() {
    if (!recipe) return;
    startSaving(async () => {
      const result = await saveDraft(recipe);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recipe saved as draft!");
        handleOpenChange(false);
        setIngredients("");
        setDietaryNotes("");
        setRejectedTitles([]);
      }
    });
  }

  function handleIngredientRemove(index: number) {
    const current = editedIngredients ?? recipe?.ingredients ?? [];
    const removed = current[index];
    if (!removed) return;

    const updated = current.filter((_, i) => i !== index);
    setEditedIngredients(updated);
    setRemovedIngredients((prev) => [...prev, removed.name]);

    // Clean up any quantity change for this ingredient
    const key = `${removed.name}|${removed.unit}`;
    setQuantityChanges((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function handleIngredientQuantityChange(
    index: number,
    newQuantity: string
  ) {
    const current = editedIngredients ?? recipe?.ingredients ?? [];
    const updated = [...current];
    const ingredient = updated[index];

    updated[index] = { ...ingredient, quantity: newQuantity };
    setEditedIngredients(updated);

    // Track the change relative to the original recipe
    const originalIng = originalRecipe?.ingredients.find(
      (i) => i.name === ingredient.name && i.unit === ingredient.unit
    );
    if (originalIng) {
      const key = `${ingredient.name}|${ingredient.unit}`;
      setQuantityChanges((prev) => {
        const next = new Map(prev);
        if (newQuantity === originalIng.quantity) {
          next.delete(key);
        } else {
          next.set(key, {
            original: originalIng.quantity,
            current: newQuantity,
          });
        }
        return next;
      });
    }
  }

  function handleResetIngredients() {
    if (!originalRecipe) return;
    setRecipe(originalRecipe);
    resetEditState();
  }

  function handleRegenerateSteps() {
    if (!recipe) return;

    const currentIngredients = editedIngredients ?? recipe.ingredients;

    // Build modification summaries for the AI
    const modifiedSummaries: string[] = [];
    quantityChanges.forEach((change, key) => {
      const [name] = key.split("|");
      modifiedSummaries.push(
        `${name}: ${change.original} -> ${change.current}`
      );
    });

    startRegeneratingSteps(async () => {
      const result = await regenerateSteps(
        recipe,
        currentIngredients,
        removedIngredients,
        modifiedSummaries
      );

      if (result.error) {
        toast.error(result.error);
      } else if (result.steps) {
        // Merge the new steps/cookTime/equipment into the recipe
        setRecipe({
          ...recipe,
          ingredients: currentIngredients,
          steps: result.steps,
          cookTime: result.cookTime ?? recipe.cookTime,
          equipmentUsed: result.equipmentUsed ?? recipe.equipmentUsed,
        });
        // Clear edit tracking — changes are now incorporated
        resetEditState();
      }
    });
  }

  const anyLoading = isGenerating || isSaving || isRegeneratingSteps;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Input step */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Get Inspired
              </DialogTitle>
              <DialogDescription>
                Tell us what&apos;s in your fridge and we&apos;ll create a recipe
                for you
              </DialogDescription>
            </DialogHeader>

            {draftCount > 0 && (
              <Link
                href="/drafts"
                onClick={() => handleOpenChange(false)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View {draftCount} draft{draftCount !== 1 ? "s" : ""} &rarr;
              </Link>
            )}

            <div className="space-y-4">
              {!hasKitchenSetup && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                  <ChefHat className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      <Link
                        href="/profile"
                        onClick={() => handleOpenChange(false)}
                        className="text-primary hover:underline font-medium"
                      >
                        Set up your kitchen
                      </Link>{" "}
                      for equipment-aware recipes
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ingredients">What do you want to cook?</Label>
                <SpeechInput
                  value={ingredients}
                  onChange={setIngredients}
                  placeholder="e.g. chicken thighs, lemon, rosemary... or just &quot;carbonara&quot;"
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <Label>Servings</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    disabled={servings <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-lg font-semibold tabular-nums w-6 text-center">
                    {servings}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setServings((s) => Math.min(20, s + 1))}
                    disabled={servings >= 20}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dietary">
                  Dietary notes{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="dietary"
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="e.g. cooking for a vegan friend, no spice, kid-friendly..."
                  disabled={isGenerating}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!ingredients.trim() || isGenerating}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Get Inspired
              </Button>
            </div>
          </>
        )}

        {/* Generating step */}
        {step === "generating" && (
          <>
            <DialogHeader>
              <DialogTitle>Creating your recipe...</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Finding the perfect recipe for your ingredients...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This usually takes 5-10 seconds
                </p>
              </div>
            </div>
          </>
        )}

        {/* Recipe step */}
        {step === "recipe" && recipe && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setStep("input")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Your Recipe</DialogTitle>
              </div>
            </DialogHeader>

            <RecipeDisplay
              recipe={recipe}
              editable
              editedIngredients={editedIngredients ?? undefined}
              onIngredientRemove={handleIngredientRemove}
              onIngredientQuantityChange={handleIngredientQuantityChange}
              ingredientChangeSummary={ingredientChangeSummary}
              onRegenerateSteps={handleRegenerateSteps}
              onResetIngredients={handleResetIngredients}
              isRegeneratingSteps={isRegeneratingSteps}
              hasIngredientChanges={hasIngredientChanges}
            />

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                }}
                disabled={anyLoading}
              >
                Discard
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={anyLoading}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={handleSaveDraft}
                disabled={anyLoading || hasIngredientChanges}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save as Draft"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
