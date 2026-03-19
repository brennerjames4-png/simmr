"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ChefHat,
  Users,
  Save,
  RefreshCw,
  Lock,
  Unlock,
  Utensils,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { saveDraft } from "@/actions/inspiration";
import { regenerateMealSlot, toggleMealSlotLock } from "@/actions/meal-plan";
import { rateRecipe } from "@/actions/recipe-ratings";
import { toast } from "sonner";
import type { MealSlot, MealPlan, InspirationRecipe } from "@/lib/db/schema";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealSlotCard({
  slot,
  planId,
  day,
  householdSize,
  onPlanUpdated,
}: {
  slot: MealSlot;
  planId: string;
  day: string;
  householdSize: number;
  onPlanUpdated?: (plan: MealPlan) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isSwapping, startSwapTransition] = useTransition();
  const [isLocking, startLockTransition] = useTransition();
  const [showSwapInput, setShowSwapInput] = useState(false);
  const [swapPrompt, setSwapPrompt] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  const isLeftover = slot.source === "leftover";
  const hasExtraServings = slot.cookServings > householdSize;

  function handleSaveDraft() {
    startSaveTransition(async () => {
      const recipe: InspirationRecipe = {
        title: slot.recipe.title,
        description: slot.recipe.description,
        ingredients: slot.recipe.ingredients.map((i) => ({
          ...i,
          source: "provided" as const,
        })),
        steps: slot.recipe.steps,
        cookTime: slot.recipe.cookTime,
        difficulty: slot.recipe.difficulty,
        servings: slot.recipe.servings,
        equipmentUsed: [],
        dietaryNotes: slot.recipe.dietaryNotes,
        newSkills: [],
      };
      const result = await saveDraft(recipe);
      if (result.error) toast.error(result.error);
      else toast.success("Saved as draft!");
    });
  }

  function handleSwap() {
    startSwapTransition(async () => {
      const result = await regenerateMealSlot({
        planId,
        day,
        mealType: slot.mealType,
        prompt: swapPrompt.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.updatedPlan) {
        onPlanUpdated?.(result.updatedPlan);
        toast.success("Meal swapped!");
      }
      setShowSwapInput(false);
      setSwapPrompt("");
    });
  }

  function handleToggleLock() {
    startLockTransition(async () => {
      const result = await toggleMealSlotLock({
        planId,
        day,
        mealType: slot.mealType,
      });
      if (result.error) toast.error(result.error);
    });
  }

  async function handleRate(stars: number) {
    setRating(stars);
    const result = await rateRecipe({
      recipeTitle: slot.recipe.title,
      rating: stars,
      mealPlanId: planId,
    });
    if (result.error) toast.error(result.error);
    else toast.success("Rating saved!");
  }

  return (
    <div
      className={`border-b last:border-b-0 ${slot.locked ? "bg-muted/30" : ""}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant={isLeftover ? "outline" : "secondary"}
              className="text-xs shrink-0"
            >
              {MEAL_TYPE_LABELS[slot.mealType]}
            </Badge>
            <span className="font-medium truncate text-sm">
              {slot.recipe.title}
            </span>
            {slot.locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
            {slot.source === "corpus" && (
              <Badge variant="secondary" className="text-xs shrink-0">
                cached
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {!isLeftover && (
              <>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {slot.recipe.cookTime}m
                </span>
                <span className="flex items-center gap-1">
                  <ChefHat className="h-3 w-3" />
                  {slot.recipe.difficulty}
                </span>
              </>
            )}
            {slot.recipe.nutrition && (
              <>
                <span>{slot.recipe.nutrition.calories} cal</span>
                <span>{slot.recipe.nutrition.protein}g protein</span>
              </>
            )}
            {hasExtraServings && (
              <span className="flex items-center gap-1 text-primary">
                <Utensils className="h-3 w-3" />
                Cooking {slot.cookServings} servings
              </span>
            )}
            {isLeftover && slot.leftoverOf && (
              <span className="italic">
                from {slot.leftoverOf.day} {slot.leftoverOf.mealType}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t p-3 space-y-3">
          {slot.recipe.description && (
            <p className="text-sm text-muted-foreground">
              {slot.recipe.description}
            </p>
          )}

          {hasExtraServings && (
            <p className="text-xs text-primary">
              Making {slot.cookServings} servings &mdash;{" "}
              {householdSize} to eat, {slot.cookServings - householdSize} for
              leftovers
            </p>
          )}

          {!isLeftover && (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-1">Ingredients</h4>
                <ul className="space-y-0.5">
                  {slot.recipe.ingredients.map((ing, i) => (
                    <li key={i} className="text-sm">
                      {ing.quantity} {ing.unit} {ing.name}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">Steps</h4>
                <ol className="space-y-1.5">
                  {slot.recipe.steps.map((step) => (
                    <li key={step.step_number} className="text-sm">
                      <span className="font-medium">{step.step_number}.</span>{" "}
                      {step.instruction}
                      {step.duration_minutes && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({step.duration_minutes}m)
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {/* Nutrition details */}
          {slot.recipe.nutrition && (
            <div className="text-xs text-muted-foreground grid grid-cols-4 gap-2 border rounded p-2">
              <div>
                <span className="font-medium">{slot.recipe.nutrition.calories}</span> cal
              </div>
              <div>
                <span className="font-medium">{slot.recipe.nutrition.protein}g</span> protein
              </div>
              <div>
                <span className="font-medium">{slot.recipe.nutrition.carbs}g</span> carbs
              </div>
              <div>
                <span className="font-medium">{slot.recipe.nutrition.fat}g</span> fat
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rate:</span>
            {[1, 2, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                onClick={() => handleRate(stars)}
                className="p-0.5"
              >
                <Star
                  className={`h-4 w-4 ${
                    rating !== null && stars <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSwapInput(!showSwapInput)}
              disabled={isSwapping}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Swap
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleLock}
              disabled={isLocking}
            >
              {slot.locked ? (
                <Unlock className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Lock className="h-3.5 w-3.5 mr-1" />
              )}
              {slot.locked ? "Unlock" : "Lock"}
            </Button>
            {!isLeftover && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
            )}
          </div>

          {showSwapInput && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Any preferences? (optional)"
                value={swapPrompt}
                onChange={(e) => setSwapPrompt(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSwap();
                }}
              />
              <Button size="sm" onClick={handleSwap} disabled={isSwapping}>
                {isSwapping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Go"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Keep the old export name for backward compat in history view
import { Loader2 } from "lucide-react";

export function MealPlanCard({
  dayLabel,
  day,
}: {
  dayLabel: string;
  day: { recipe?: { title: string; description: string; ingredients: { name: string; quantity: string; unit: string }[]; steps: { step_number: number; instruction: string; duration_minutes?: number }[]; cookTime: number; difficulty: string; servings: number; dietaryNotes: string | null }; source?: string; meals?: MealSlot[] };
}) {
  const [expanded, setExpanded] = useState(false);

  // Support old format
  const recipe = day.recipe;
  if (!recipe) return null;

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">
              {dayLabel}
            </span>
            <span className="font-semibold truncate">{recipe.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-24 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {recipe.cookTime}m
            </span>
            <span className="flex items-center gap-1">
              <ChefHat className="h-3 w-3" />
              {recipe.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {recipe.servings}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {recipe.description && (
            <p className="text-sm text-muted-foreground">{recipe.description}</p>
          )}
          <div>
            <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="text-sm">
                  {ing.quantity} {ing.unit} {ing.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Steps</h4>
            <ol className="space-y-2">
              {recipe.steps.map((step) => (
                <li key={step.step_number} className="text-sm">
                  <span className="font-medium">{step.step_number}.</span>{" "}
                  {step.instruction}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
