"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChefHat, Clock, Package } from "lucide-react";
import { generateMealPrepGuide, type MealPrepGuide } from "@/lib/ai/meal-plan";
import type { MealPlan } from "@/lib/db/schema";

export function BatchCookingPanel({ plan }: { plan: MealPlan }) {
  const [guide, setGuide] = useState<MealPrepGuide | null>(null);
  const [isGenerating, startTransition] = useTransition();
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const weekPlan = plan.days.map((d) => ({
        day: d.day,
        meals: (d.meals ?? []).map((m) => ({
          mealType: m.mealType,
          recipe: {
            title: m.recipe.title,
            description: m.recipe.description,
            ingredients: m.recipe.ingredients,
          },
        })),
      }));

      const result = await generateMealPrepGuide({
        weekPlan,
        householdSize: plan.householdSize,
      });

      setGuide(result);
      setGenerated(true);
    });
  }

  if (!generated) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ChefHat className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          Generate a meal prep guide based on your current plan.
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating} variant="outline">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing your plan...
            </>
          ) : (
            <>
              <ChefHat className="h-4 w-4 mr-2" />
              Generate Meal Prep Guide
            </>
          )}
        </Button>
      </div>
    );
  }

  if (!guide) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Could not generate a meal prep guide. Try again later.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Prep Day: {guide.prepDay.charAt(0).toUpperCase() + guide.prepDay.slice(1)}
        </h3>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          ~{guide.totalPrepTime} min total
        </span>
      </div>

      {guide.sections.map((section, si) => (
        <div key={si} className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {section.title}
          </h4>
          {section.tasks.map((task, ti) => (
            <div
              key={ti}
              className="rounded border p-3 space-y-1 text-sm"
            >
              <p>{task.instruction}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.timeMinutes}m
                </span>
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {task.storageNote}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Used in: {task.affectedMeals.map((m) => `${m.day} ${m.mealType}`).join(", ")}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
