import type { MealPlanDay, MealSlot, DayMealSchedule, DayOfWeek, NutritionInfo, Ingredient } from "@/lib/db/schema";

/**
 * Normalizes old single-recipe-per-day format to new multi-meal format.
 * Applied at read time — never runs a data migration on old rows.
 */
export function normalizeMealPlanDays(days: MealPlanDay[]): MealPlanDay[] {
  return days.map((day) => {
    // Old format: has `recipe` and `source` at top level, no `meals`
    if (day.recipe && !day.meals) {
      return {
        day: day.day,
        meals: [
          {
            mealType: "dinner" as const,
            recipe: {
              ...day.recipe,
              nutrition: null,
            },
            source: (day.source ?? "ai") as "corpus" | "ai" | "leftover",
            locked: false,
            cookServings: day.recipe.servings,
          },
        ],
      };
    }
    // Ensure all existing MealSlots have newer fields with defaults
    if (day.meals) {
      return {
        ...day,
        meals: day.meals.map((slot) => ({
          ...slot,
          locked: slot.locked ?? false,
          cookServings: slot.cookServings ?? slot.recipe.servings,
          recipe: {
            ...slot.recipe,
            nutrition: slot.recipe.nutrition ?? null,
          },
        })),
      };
    }
    return day;
  });
}

/**
 * Builds a default schedule from the user's default meal types.
 */
export function buildDefaultSchedule(
  defaultMealTypes: string[]
): DayMealSchedule[] {
  const DAYS: DayOfWeek[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return DAYS.map((day) => ({
    day,
    mealTypes: defaultMealTypes as ("breakfast" | "lunch" | "dinner" | "snack")[],
  }));
}

/**
 * Count total meal slots in a schedule.
 */
export function countScheduleSlots(schedule: DayMealSchedule[]): number {
  return schedule.reduce((sum, day) => sum + day.mealTypes.length, 0);
}

/**
 * Get all unique recipe titles from a plan's days.
 */
export function getPlannedTitles(days: MealPlanDay[]): string[] {
  return days.flatMap((day) =>
    (day.meals ?? [])
      .filter((slot) => slot.source !== "leftover")
      .map((slot) => slot.recipe.title)
  );
}

/**
 * Compute daily nutrition totals for a day's meals (per person).
 */
export function computeDailyNutrition(
  meals: MealSlot[]
): NutritionInfo | null {
  const withNutrition = meals.filter((m) => m.recipe.nutrition);
  if (withNutrition.length === 0) return null;

  return withNutrition.reduce(
    (acc, meal) => {
      const n = meal.recipe.nutrition!;
      return {
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
        fiber: acc.fiber + n.fiber,
        sugar: acc.sugar + n.sugar,
        sodium: acc.sodium + n.sodium,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
  );
}
