"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MealPlanDay } from "@/lib/db/schema";
import { computeDailyNutrition } from "@/lib/meal-plan-utils";

const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

export function WeeklyNutritionSummary({ days }: { days: MealPlanDay[] }) {
  const [expanded, setExpanded] = useState(false);

  const dailyNutrition = days.map((day) => ({
    day: day.day,
    nutrition: computeDailyNutrition(day.meals ?? []),
  }));

  const hasAnyNutrition = dailyNutrition.some((d) => d.nutrition !== null);
  if (!hasAnyNutrition) return null;

  const validDays = dailyNutrition.filter((d) => d.nutrition);
  const avg = validDays.length > 0
    ? {
        calories: Math.round(
          validDays.reduce((s, d) => s + (d.nutrition?.calories ?? 0), 0) / validDays.length
        ),
        protein: Math.round(
          validDays.reduce((s, d) => s + (d.nutrition?.protein ?? 0), 0) / validDays.length
        ),
      }
    : null;

  return (
    <div className="rounded-lg border p-3 text-sm">
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Weekly Nutrition Overview</span>
          {avg && (
            <span className="text-xs text-muted-foreground">
              Avg: {avg.calories} cal/day &middot; {avg.protein}g protein/day
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 pr-3 font-medium text-muted-foreground" />
                {dailyNutrition.map((d) => (
                  <th key={d.day} className="text-center py-1 px-2 font-medium text-muted-foreground">
                    {DAY_SHORT[d.day]}
                  </th>
                ))}
                <th className="text-center py-1 px-2 font-medium text-muted-foreground">
                  Avg
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1 pr-3 font-medium">Calories</td>
                {dailyNutrition.map((d) => (
                  <td key={d.day} className="text-center py-1 px-2">
                    {d.nutrition?.calories ?? "—"}
                  </td>
                ))}
                <td className="text-center py-1 px-2 font-medium">
                  {avg?.calories ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-medium">Protein</td>
                {dailyNutrition.map((d) => (
                  <td key={d.day} className="text-center py-1 px-2">
                    {d.nutrition ? `${d.nutrition.protein}g` : "—"}
                  </td>
                ))}
                <td className="text-center py-1 px-2 font-medium">
                  {avg ? `${avg.protein}g` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
