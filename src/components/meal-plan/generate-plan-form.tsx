"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { generateMealPlan } from "@/actions/meal-plan";
import { toast } from "sonner";
import type { MealPlan } from "@/lib/db/schema";

export function GeneratePlanForm({
  onPlanGenerated,
}: {
  onPlanGenerated: (plan: MealPlan) => void;
}) {
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateMealPlan({
        servings,
        availableIngredients: ingredients.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.plan) {
        onPlanGenerated(result.plan);
        toast.success(`Meal plan generated with ${result.plan.days.length} recipes!`);
      }
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Generate New Plan</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="servings">Servings per meal</Label>
          <Input
            id="servings"
            type="number"
            min={1}
            max={20}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 2)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ingredients">
            What ingredients do you have? (optional)
          </Label>
          <Textarea
            id="ingredients"
            placeholder="e.g., chicken thighs, broccoli, rice, garlic, soy sauce..."
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating plan (this takes a moment)...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Weekly Plan
          </>
        )}
      </Button>
    </div>
  );
}
