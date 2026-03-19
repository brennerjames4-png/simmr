"use client";

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { generateMealPlan } from "@/actions/meal-plan";
import { toast } from "sonner";
import type { MealPlan, DayMealSchedule, DayOfWeek } from "@/lib/db/schema";

const DAYS: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks",
};

export function GeneratePlanForm({
  onPlanGenerated,
  defaultHouseholdSize = 2,
  defaultServingsPerMeal,
  defaultMealTypes = ["dinner"],
  defaultMealPrepEnabled = false,
}: {
  onPlanGenerated: (plan: MealPlan) => void;
  defaultHouseholdSize?: number;
  defaultServingsPerMeal?: number;
  defaultMealTypes?: string[];
  defaultMealPrepEnabled?: boolean;
}) {
  const [householdSize, setHouseholdSize] = useState(defaultHouseholdSize);
  const [servingsPerMeal, setServingsPerMeal] = useState(
    defaultServingsPerMeal ?? defaultHouseholdSize
  );
  const [defaults, setDefaults] = useState<Set<string>>(new Set(defaultMealTypes));
  const [schedule, setSchedule] = useState<DayMealSchedule[]>(() =>
    DAYS.map((day) => ({ day, mealTypes: [...defaultMealTypes] as DayMealSchedule["mealTypes"] }))
  );
  const [customized, setCustomized] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [mealPrepEnabled, setMealPrepEnabled] = useState(defaultMealPrepEnabled);
  const [ingredients, setIngredients] = useState("");
  const [isPending, startTransition] = useTransition();

  const extraServings = servingsPerMeal - householdSize;

  const toggleDefault = useCallback((mealType: string) => {
    setDefaults((prev) => {
      const next = new Set(prev);
      if (next.has(mealType)) {
        next.delete(mealType);
      } else {
        next.add(mealType);
      }
      if (!customized) {
        const types = Array.from(next) as DayMealSchedule["mealTypes"];
        setSchedule(DAYS.map((day) => ({ day, mealTypes: [...types] })));
      }
      return next;
    });
  }, [customized]);

  const toggleDayMeal = useCallback((day: DayOfWeek, mealType: string) => {
    setCustomized(true);
    setSchedule((prev) =>
      prev.map((ds) => {
        if (ds.day !== day) return ds;
        const types = ds.mealTypes.includes(mealType as typeof MEAL_TYPES[number])
          ? ds.mealTypes.filter((t) => t !== mealType)
          : [...ds.mealTypes, mealType as typeof MEAL_TYPES[number]];
        return { ...ds, mealTypes: types };
      })
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    const types = Array.from(defaults) as DayMealSchedule["mealTypes"];
    setSchedule(DAYS.map((day) => ({ day, mealTypes: [...types] })));
    setCustomized(false);
  }, [defaults]);

  const hasDinner = schedule.some((ds) => ds.mealTypes.includes("dinner"));
  const totalSlots = schedule.reduce((sum, ds) => sum + ds.mealTypes.length, 0);

  function handleGenerate() {
    if (!hasDinner) {
      toast.error("At least one day must include dinner.");
      return;
    }
    startTransition(async () => {
      const result = await generateMealPlan({
        householdSize,
        servingsPerMeal,
        schedule,
        mealPrepEnabled,
        availableIngredients: ingredients.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.plan) {
        const mealCount = result.plan.days.reduce(
          (sum, d) => sum + (d.meals?.length ?? 0),
          0
        );
        onPlanGenerated(result.plan);
        toast.success(`Meal plan generated with ${mealCount} meals!`);
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
        {/* People eating */}
        <div className="space-y-2">
          <Label htmlFor="householdSize">People eating per meal</Label>
          <div className="flex items-center gap-2">
            <Input
              id="householdSize"
              type="number"
              min={1}
              max={20}
              value={householdSize}
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setHouseholdSize(v);
                // If servings was tracking household size, keep them in sync
                if (servingsPerMeal < v) {
                  setServingsPerMeal(v);
                }
              }}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {householdSize === 1 ? "person" : "people"}
            </span>
          </div>
        </div>

        {/* Servings to cook */}
        <div className="space-y-2">
          <Label htmlFor="servingsPerMeal">Servings per recipe</Label>
          <div className="flex items-center gap-2">
            <Input
              id="servingsPerMeal"
              type="number"
              min={householdSize}
              max={20}
              value={servingsPerMeal}
              onChange={(e) =>
                setServingsPerMeal(
                  Math.max(householdSize, Number(e.target.value) || householdSize)
                )
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">servings</span>
          </div>
          {extraServings > 0 && (
            <p className="text-xs text-primary">
              +{extraServings} extra {extraServings === 1 ? "serving" : "servings"} per meal for leftovers
            </p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Default meals</Label>
          <div className="flex flex-wrap gap-3">
            {MEAL_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={defaults.has(type)}
                  onCheckedChange={() => toggleDefault(type)}
                />
                {MEAL_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={mealPrepEnabled}
              onCheckedChange={(checked) => setMealPrepEnabled(checked === true)}
            />
            <span>Smart meal prep mode</span>
          </label>
          {mealPrepEnabled && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Automatically identifies which dinners reheat or repurpose well,
              then scales those up so leftovers cover your lunches. Works on top
              of the servings you set above.
            </p>
          )}
        </div>
      </div>

      {/* Customize by day */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowCustomize(!showCustomize)}
        >
          {showCustomize ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Customize by day
        </button>

        {showCustomize && (
          <div className="mt-3 space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Day</th>
                    {MEAL_TYPES.map((type) => (
                      <th key={type} className="text-center py-1.5 px-2 font-medium text-muted-foreground">
                        {MEAL_LABELS[type].slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((ds) => (
                    <tr key={ds.day} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium">
                        {DAY_LABELS[ds.day]}
                      </td>
                      {MEAL_TYPES.map((type) => (
                        <td key={type} className="text-center py-1.5 px-2">
                          <Checkbox
                            checked={ds.mealTypes.includes(type)}
                            onCheckedChange={() => toggleDayMeal(ds.day, type)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                className="text-xs"
              >
                Reset to defaults
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
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

      {!hasDinner && (
        <p className="text-sm text-destructive">
          At least one day must include dinner.
        </p>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isPending || !hasDinner}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating {totalSlots} meals (this takes a moment)...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Weekly Plan ({totalSlots} meals)
          </>
        )}
      </Button>
    </div>
  );
}
