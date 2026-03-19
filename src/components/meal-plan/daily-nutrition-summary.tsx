"use client";

import type { MealSlot } from "@/lib/db/schema";
import { computeDailyNutrition } from "@/lib/meal-plan-utils";

export function DailyNutritionSummary({ meals }: { meals: MealSlot[] }) {
  const totals = computeDailyNutrition(meals);
  if (!totals) return null;

  return (
    <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
      <span className="font-medium">Daily totals (est.):</span>{" "}
      {totals.calories} cal &middot; {totals.protein}g protein &middot;{" "}
      {totals.carbs}g carbs &middot; {totals.fat}g fat
    </div>
  );
}
