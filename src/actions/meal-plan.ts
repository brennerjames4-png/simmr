"use server";

import { db } from "@/lib/db";
import { mealPlans } from "@/lib/db/schema";
import type {
  MealPlanDay,
  MealPlan,
  MealSlot,
  DayMealSchedule,
  DayOfWeek,
  NutritionInfo,
  KitchenInventory,
  InspirationRecipe,
  SkillTier,
  NutritionGoals,
  TasteProfile,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateMealPlanRecipe, planLeftovers } from "@/lib/ai/meal-plan";
import {
  getCorpusInspirationRecipe,
  saveToRecipeCorpus,
  trackCorpusEvent,
} from "@/lib/corpus";
import { getUserSkillsForAI } from "@/queries/skills";
import {
  normalizeMealPlanDays,
  buildDefaultSchedule,
  computeDailyNutrition,
} from "@/lib/meal-plan-utils";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function generateMealPlan(params: {
  householdSize: number;
  servingsPerMeal: number;
  schedule: DayMealSchedule[];
  mealPrepEnabled: boolean;
  availableIngredients?: string;
  weekStart?: Date;
}): Promise<{ plan?: MealPlan; error?: string }> {
  const user = await requireAuth();

  const householdSize = Math.max(1, Math.min(20, params.householdSize || 2));
  const servingsPerMeal = Math.max(
    householdSize,
    Math.min(20, params.servingsPerMeal || householdSize)
  );
  const weekStart = params.weekStart ?? getNextMonday();

  try {
    const userSkills = await getUserSkillsForAI(user.id);

    // Step 1: Build the week skeleton from the per-day schedule
    const dayMap = new Map<DayOfWeek, MealSlot[]>();
    for (const daySched of params.schedule) {
      dayMap.set(daySched.day, []);
    }

    const plannedTitles: string[] = [];

    // Step 2: Generate dinner recipes first (anchor meals)
    for (const daySched of params.schedule) {
      if (!daySched.mealTypes.includes("dinner")) continue;

      const cookServings = servingsPerMeal;
      const recipe = await generateOrLookupRecipe({
        dayOfWeek: daySched.day,
        mealType: "dinner",
        householdSize,
        cookServings,
        plannedTitles,
        availableIngredients: params.availableIngredients,
        user,
        userSkills,
      });

      if (recipe) {
        const slots = dayMap.get(daySched.day) ?? [];
        slots.push({
          mealType: "dinner",
          recipe: {
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({
              name,
              quantity,
              unit,
            })),
            steps: recipe.steps,
            cookTime: recipe.cookTime,
            difficulty: recipe.difficulty,
            servings: recipe.servings,
            dietaryNotes: recipe.dietaryNotes,
            nutrition: recipe.nutrition ?? null,
          },
          source: (recipe as { _source?: string })._source === "corpus" ? "corpus" : "ai",
          locked: false,
          cookServings,
        });
        dayMap.set(daySched.day, slots);
        plannedTitles.push(recipe.title);
      }
    }

    // Step 3: If mealPrepEnabled, run leftover optimization
    const leftoverFilledSlots = new Set<string>(); // "day:mealType" keys
    if (params.mealPrepEnabled) {
      const dinners = Array.from(dayMap.entries())
        .flatMap(([day, slots]) =>
          slots
            .filter((s) => s.mealType === "dinner")
            .map((s) => ({
              day,
              title: s.recipe.title,
              description: s.recipe.description,
            }))
        );

      const lunchSlotsToFill = params.schedule
        .filter((ds) => ds.mealTypes.includes("lunch"))
        .map((ds) => ds.day);

      if (lunchSlotsToFill.length > 0 && dinners.length > 0) {
        const leftoverPlans = await planLeftovers({
          dinners,
          householdSize,
          lunchSlotsToFill,
        });

        for (const lp of leftoverPlans) {
          // Find the source dinner and increase its cookServings
          const sourceSlots = dayMap.get(lp.sourceDay as DayOfWeek);
          const sourceDinner = sourceSlots?.find(
            (s) => s.mealType === "dinner"
          );
          if (!sourceDinner) continue;

          sourceDinner.cookServings += lp.extraServings;

          // Scale up source dinner ingredients
          const scaleFactor =
            sourceDinner.cookServings / sourceDinner.recipe.servings;
          // Note: we don't mutate the base recipe ingredients here —
          // the shopping list computation handles scaling via cookServings/recipe.servings

          // Fill target lunch slots with leftover references
          for (const target of lp.targets) {
            const targetSlots = dayMap.get(target.day as DayOfWeek) ?? [];
            targetSlots.push({
              mealType: "lunch",
              recipe: {
                ...sourceDinner.recipe,
                title: target.repurposeIdea
                  ? `${target.repurposeIdea} (from ${sourceDinner.recipe.title})`
                  : `Leftover: ${sourceDinner.recipe.title}`,
              },
              source: "leftover",
              locked: false,
              cookServings: householdSize,
              leftoverOf: {
                day: lp.sourceDay,
                mealType: "dinner",
                recipeTitle: sourceDinner.recipe.title,
              },
            });
            dayMap.set(target.day as DayOfWeek, targetSlots);
            leftoverFilledSlots.add(`${target.day}:lunch`);
          }
        }
      }
    }

    // Step 4: Generate remaining non-leftover meals
    for (const daySched of params.schedule) {
      for (const mealType of daySched.mealTypes) {
        if (mealType === "dinner") continue; // Already done in step 2
        if (leftoverFilledSlots.has(`${daySched.day}:${mealType}`)) continue;

        const existingSlots = dayMap.get(daySched.day) ?? [];
        const otherMealsThisDay = existingSlots.map(
          (s) => s.recipe.title
        );

        const cookServings = servingsPerMeal;
        const recipe = await generateOrLookupRecipe({
          dayOfWeek: daySched.day,
          mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack",
          householdSize,
          cookServings,
          plannedTitles,
          otherMealsThisDay,
          availableIngredients: params.availableIngredients,
          user,
          userSkills,
        });

        if (recipe) {
          existingSlots.push({
            mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack",
            recipe: {
              title: recipe.title,
              description: recipe.description,
              ingredients: recipe.ingredients.map(
                ({ name, quantity, unit }) => ({ name, quantity, unit })
              ),
              steps: recipe.steps,
              cookTime: recipe.cookTime,
              difficulty: recipe.difficulty,
              servings: recipe.servings,
              dietaryNotes: recipe.dietaryNotes,
              nutrition: recipe.nutrition ?? null,
            },
            source:
              (recipe as { _source?: string })._source === "corpus"
                ? "corpus"
                : "ai",
            locked: false,
            cookServings,
          });
          dayMap.set(daySched.day, existingSlots);
          plannedTitles.push(recipe.title);
        }
      }
    }

    // Step 5: Build final days array
    const mealTypeOrder = ["breakfast", "lunch", "dinner", "snack"];
    const days: MealPlanDay[] = DAYS.filter((d) => dayMap.has(d)).map(
      (day) => {
        const meals = (dayMap.get(day) ?? []).sort(
          (a, b) =>
            mealTypeOrder.indexOf(a.mealType) -
            mealTypeOrder.indexOf(b.mealType)
        );
        return { day, meals };
      }
    );

    if (days.length === 0) {
      return { error: "Failed to generate any recipes. Please try again." };
    }

    // Save the plan
    const [saved] = await db
      .insert(mealPlans)
      .values({
        userId: user.id,
        weekStart,
        planData: days,
        householdSize,
        schedule: params.schedule,
        shoppingCheckedItems: {},
        preferences: {
          availableIngredients: params.availableIngredients || null,
          servingsPerMeal,
          mealPrepEnabled: params.mealPrepEnabled,
        },
      })
      .returning();

    revalidatePath("/meal-planner");

    return {
      plan: {
        id: saved.id,
        weekStart: saved.weekStart,
        days: normalizeMealPlanDays(saved.planData),
        householdSize: saved.householdSize,
        schedule: saved.schedule ?? params.schedule,
        shoppingCheckedItems: (saved.shoppingCheckedItems as Record<string, boolean>) ?? {},
        createdAt: saved.createdAt,
      },
    };
  } catch (error) {
    console.error("generateMealPlan error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

// Internal helper to try corpus first, then AI
async function generateOrLookupRecipe(params: {
  dayOfWeek: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  householdSize: number;
  cookServings: number;
  plannedTitles: string[];
  otherMealsThisDay?: string[];
  availableIngredients?: string;
  user: { id: string; dietaryPreferences: string[] | null; foodExclusions: string[] | null; kitchenInventory: KitchenInventory | null; nutritionGoals?: NutritionGoals | null; tasteProfile?: TasteProfile | null };
  userSkills: { name: string; tier: SkillTier }[];
}): Promise<(InspirationRecipe & { nutrition?: NutritionInfo | null; _source?: string }) | null> {
  // Try corpus first
  const corpusRecipe = await getCorpusInspirationRecipe(
    `${params.dayOfWeek} ${params.mealType}`,
    params.cookServings,
    {
      dietaryPreferences: params.user.dietaryPreferences,
      foodExclusions: params.user.foodExclusions,
    }
  );

  if (
    corpusRecipe &&
    !params.plannedTitles.some(
      (t) => t.toLowerCase() === corpusRecipe.title.toLowerCase()
    )
  ) {
    void trackCorpusEvent({
      endpoint: "inspiration",
      servedFrom: "corpus",
      dishNameNormalized: corpusRecipe.title,
      userId: params.user.id,
    });

    return {
      ...corpusRecipe,
      nutrition: null,
      _source: "corpus",
    };
  }

  // Generate via AI
  const recipe = await generateMealPlanRecipe({
    dayOfWeek: params.dayOfWeek,
    mealType: params.mealType,
    householdSize: params.householdSize,
    cookServings: params.cookServings,
    otherMealsThisWeek: params.plannedTitles,
    otherMealsThisDay: params.otherMealsThisDay ?? [],
    availableIngredients: params.availableIngredients,
    servings: params.cookServings,
    dietaryPreferences: params.user.dietaryPreferences,
    foodExclusions: params.user.foodExclusions,
    kitchenInventory: params.user.kitchenInventory,
    userSkills: params.userSkills,
  });

  if (!recipe) return null;

  void trackCorpusEvent({
    endpoint: "inspiration",
    servedFrom: "api",
    dishNameNormalized: recipe.title,
    userId: params.user.id,
  });

  void saveToRecipeCorpus({
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({
      name,
      quantity,
      unit,
    })),
    steps: recipe.steps,
    cookTime: recipe.cookTime,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    dietaryPreferences: params.user.dietaryPreferences,
    foodExclusions: params.user.foodExclusions,
    appliancesUsed: recipe.equipmentUsed,
    source: "inspiration",
    sourceUserId: params.user.id,
    inspirationMetadata: recipe,
  });

  return { ...recipe, _source: "ai" };
}

// Phase 3: Swap a single meal slot
export async function regenerateMealSlot(params: {
  planId: string;
  day: string;
  mealType: string;
  prompt?: string;
}): Promise<{ updatedPlan?: MealPlan; error?: string }> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, params.planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return { error: "Meal plan not found." };

  const days = normalizeMealPlanDays(result.planData);
  const dayIndex = days.findIndex((d) => d.day === params.day);
  if (dayIndex === -1) return { error: "Day not found in plan." };

  const slotIndex = days[dayIndex].meals.findIndex(
    (s) => s.mealType === params.mealType
  );
  if (slotIndex === -1) return { error: "Meal slot not found." };

  const userSkills = await getUserSkillsForAI(user.id);
  const allTitles = days.flatMap((d) =>
    d.meals.filter((s) => s.source !== "leftover").map((s) => s.recipe.title)
  );
  const otherDayTitles = days[dayIndex].meals
    .filter((_, i) => i !== slotIndex)
    .map((s) => s.recipe.title);

  const slot = days[dayIndex].meals[slotIndex];
  const recipe = await generateMealPlanRecipe({
    dayOfWeek: params.day,
    mealType: slot.mealType,
    householdSize: result.householdSize,
    cookServings: slot.cookServings,
    otherMealsThisWeek: allTitles,
    otherMealsThisDay: otherDayTitles,
    availableIngredients: params.prompt,
    servings: slot.cookServings,
    dietaryPreferences: user.dietaryPreferences,
    foodExclusions: user.foodExclusions,
    kitchenInventory: user.kitchenInventory,
    userSkills,
  });

  if (!recipe) return { error: "Failed to generate a new recipe." };

  days[dayIndex].meals[slotIndex] = {
    ...slot,
    recipe: {
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })),
      steps: recipe.steps,
      cookTime: recipe.cookTime,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      dietaryNotes: recipe.dietaryNotes,
      nutrition: recipe.nutrition ?? null,
    },
    source: "ai",
    locked: false,
    leftoverOf: undefined,
  };

  // If swapped slot was a leftover source, clear dependent leftover slots
  for (const day of days) {
    day.meals = day.meals.filter((s) => {
      if (
        s.source === "leftover" &&
        s.leftoverOf?.day === params.day &&
        s.leftoverOf?.mealType === params.mealType
      ) {
        return false; // Remove dependent leftover
      }
      return true;
    });
  }

  await db
    .update(mealPlans)
    .set({ planData: days, updatedAt: new Date() })
    .where(eq(mealPlans.id, params.planId));

  revalidatePath("/meal-planner");

  const schedule = (result.schedule as DayMealSchedule[]) ?? buildDefaultSchedule(["dinner"]);

  return {
    updatedPlan: {
      id: result.id,
      weekStart: result.weekStart,
      days,
      householdSize: result.householdSize,
      schedule,
      shoppingCheckedItems: (result.shoppingCheckedItems as Record<string, boolean>) ?? {},
      createdAt: result.createdAt,
    },
  };
}

// Phase 3: Toggle lock on a meal slot
export async function toggleMealSlotLock(params: {
  planId: string;
  day: string;
  mealType: string;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, params.planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return { error: "Meal plan not found." };

  const days = normalizeMealPlanDays(result.planData);
  const day = days.find((d) => d.day === params.day);
  if (!day) return { error: "Day not found." };

  const slot = day.meals.find((s) => s.mealType === params.mealType);
  if (!slot) return { error: "Meal slot not found." };

  slot.locked = !slot.locked;

  await db
    .update(mealPlans)
    .set({ planData: days, updatedAt: new Date() })
    .where(eq(mealPlans.id, params.planId));

  return { success: true };
}

// Phase 3: Regenerate all unlocked slots
export async function regenerateUnlockedSlots(params: {
  planId: string;
}): Promise<{ updatedPlan?: MealPlan; error?: string }> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, params.planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return { error: "Meal plan not found." };

  const days = normalizeMealPlanDays(result.planData);
  const userSkills = await getUserSkillsForAI(user.id);
  const lockedTitles = days.flatMap((d) =>
    d.meals.filter((s) => s.locked).map((s) => s.recipe.title)
  );

  for (const day of days) {
    for (let i = 0; i < day.meals.length; i++) {
      const slot = day.meals[i];
      if (slot.locked) continue;

      const otherDayTitles = day.meals
        .filter((_, j) => j !== i)
        .map((s) => s.recipe.title);

      const recipe = await generateMealPlanRecipe({
        dayOfWeek: day.day,
        mealType: slot.mealType,
        householdSize: result.householdSize,
        cookServings: slot.cookServings,
        otherMealsThisWeek: [...lockedTitles],
        otherMealsThisDay: otherDayTitles,
        servings: slot.cookServings,
        dietaryPreferences: user.dietaryPreferences,
        foodExclusions: user.foodExclusions,
        kitchenInventory: user.kitchenInventory,
        userSkills,
      });

      if (recipe) {
        day.meals[i] = {
          ...slot,
          recipe: {
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients.map(({ name, quantity, unit }) => ({
              name,
              quantity,
              unit,
            })),
            steps: recipe.steps,
            cookTime: recipe.cookTime,
            difficulty: recipe.difficulty,
            servings: recipe.servings,
            dietaryNotes: recipe.dietaryNotes,
            nutrition: recipe.nutrition ?? null,
          },
          source: "ai",
          leftoverOf: undefined,
        };
        lockedTitles.push(recipe.title);
      }
    }
  }

  await db
    .update(mealPlans)
    .set({ planData: days, updatedAt: new Date() })
    .where(eq(mealPlans.id, params.planId));

  revalidatePath("/meal-planner");

  const schedule = (result.schedule as DayMealSchedule[]) ?? buildDefaultSchedule(["dinner"]);

  return {
    updatedPlan: {
      id: result.id,
      weekStart: result.weekStart,
      days,
      householdSize: result.householdSize,
      schedule,
      shoppingCheckedItems: (result.shoppingCheckedItems as Record<string, boolean>) ?? {},
      createdAt: result.createdAt,
    },
  };
}

// Shopping list: toggle checked item
export async function toggleShoppingItem(params: {
  planId: string;
  normalizedItemName: string;
  checked: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, params.planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return { error: "Meal plan not found." };

  const checkedItems = (result.shoppingCheckedItems as Record<string, boolean>) ?? {};
  checkedItems[params.normalizedItemName] = params.checked;

  await db
    .update(mealPlans)
    .set({ shoppingCheckedItems: checkedItems, updatedAt: new Date() })
    .where(eq(mealPlans.id, params.planId));

  return { success: true };
}

export async function getMealPlans(limit: number = 10): Promise<MealPlan[]> {
  const user = await requireAuth();

  const results = await db
    .select()
    .from(mealPlans)
    .where(eq(mealPlans.userId, user.id))
    .orderBy(desc(mealPlans.createdAt))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    days: normalizeMealPlanDays(r.planData),
    householdSize: r.householdSize,
    schedule: (r.schedule as DayMealSchedule[]) ?? buildDefaultSchedule(["dinner"]),
    shoppingCheckedItems: (r.shoppingCheckedItems as Record<string, boolean>) ?? {},
    createdAt: r.createdAt,
  }));
}

export async function getMealPlan(planId: string): Promise<MealPlan | null> {
  const user = await requireAuth();

  const result = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, planId), eq(mealPlans.userId, user.id)),
  });

  if (!result) return null;

  return {
    id: result.id,
    weekStart: result.weekStart,
    days: normalizeMealPlanDays(result.planData),
    householdSize: result.householdSize,
    schedule: (result.schedule as DayMealSchedule[]) ?? buildDefaultSchedule(["dinner"]),
    shoppingCheckedItems: (result.shoppingCheckedItems as Record<string, boolean>) ?? {},
    createdAt: result.createdAt,
  };
}

export async function deleteMealPlan(
  planId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.id, planId), eq(mealPlans.userId, user.id)),
  });

  if (!plan) {
    return { error: "Meal plan not found." };
  }

  await db.delete(mealPlans).where(eq(mealPlans.id, planId));

  revalidatePath("/meal-planner");
  return { success: true };
}
