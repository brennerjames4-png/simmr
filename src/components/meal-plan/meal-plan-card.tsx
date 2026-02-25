"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Clock, ChefHat, Users, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveDraft } from "@/actions/inspiration";
import { toast } from "sonner";
import type { MealPlanDay, InspirationRecipe } from "@/lib/db/schema";

export function MealPlanCard({
  dayLabel,
  day,
}: {
  dayLabel: string;
  day: MealPlanDay;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();

  function handleSaveDraft() {
    startSaveTransition(async () => {
      const recipe: InspirationRecipe = {
        title: day.recipe.title,
        description: day.recipe.description,
        ingredients: day.recipe.ingredients.map((i) => ({
          ...i,
          source: "provided" as const,
        })),
        steps: day.recipe.steps,
        cookTime: day.recipe.cookTime,
        difficulty: day.recipe.difficulty,
        servings: day.recipe.servings,
        equipmentUsed: [],
        dietaryNotes: day.recipe.dietaryNotes,
        newSkills: [],
      };

      const result = await saveDraft(recipe);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Saved as draft!");
      }
    });
  }

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
            <span className="font-semibold truncate">{day.recipe.title}</span>
            {day.source === "corpus" && (
              <Badge variant="secondary" className="text-xs shrink-0">
                cached
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 ml-24 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {day.recipe.cookTime}m
            </span>
            <span className="flex items-center gap-1">
              <ChefHat className="h-3 w-3" />
              {day.recipe.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {day.recipe.servings}
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
          {day.recipe.description && (
            <p className="text-sm text-muted-foreground">
              {day.recipe.description}
            </p>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
            <ul className="space-y-1">
              {day.recipe.ingredients.map((ing, i) => (
                <li key={i} className="text-sm">
                  {ing.quantity} {ing.unit} {ing.name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Steps</h4>
            <ol className="space-y-2">
              {day.recipe.steps.map((step) => (
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save as Draft"}
          </Button>
        </div>
      )}
    </div>
  );
}
