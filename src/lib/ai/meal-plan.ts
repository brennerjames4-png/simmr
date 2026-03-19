import { getAnthropicClient } from "./client";
import type {
  KitchenInventory,
  InspirationRecipe,
  SkillTier,
  NutritionInfo,
  NutritionGoals,
  Ingredient,
} from "@/lib/db/schema";
import { kitchenLabels } from "@/lib/kitchen-defaults";
import { getDietaryLabel } from "@/lib/dietary-config";

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

function buildKitchenContext(inventory: KitchenInventory | null): string {
  if (!inventory) {
    return "Kitchen equipment is unknown — assume basic equipment.";
  }

  const equipment: string[] = [];
  for (const [category, items] of Object.entries(inventory)) {
    const labels = kitchenLabels[category];
    if (!labels) continue;
    for (const [key, value] of Object.entries(
      items as Record<string, number | boolean>
    )) {
      const label = labels[key] ?? key;
      if (typeof value === "boolean" && value) equipment.push(label);
      else if (typeof value === "number" && value > 0) equipment.push(label);
    }
  }

  if (inventory.customEquipment) {
    for (const item of inventory.customEquipment) {
      equipment.push(item.name);
    }
  }

  return equipment.length > 0
    ? `Available equipment: ${equipment.join(", ")}.`
    : "Basic equipment only.";
}

function getMealTypeContext(mealType: string): string {
  switch (mealType) {
    case "breakfast":
      return "This is a BREAKFAST recipe. Keep prep under 20 minutes. Think eggs, toast, oatmeal, smoothies, yogurt bowls — quick, energizing morning food.";
    case "lunch":
      return "This is a LUNCH recipe. Keep it moderate effort. Emphasis on portability and reheating well. Salads, wraps, grain bowls, soups work great.";
    case "dinner":
      return "This is a DINNER recipe. Full range of complexity is fine. This is the main cooking event of the day.";
    case "snack":
      return "This is a SNACK. Very simple — under 10 minutes, small portions, 1-5 ingredients. Think hummus + veggies, fruit + nut butter, yogurt parfait.";
    default:
      return "This is a dinner recipe.";
  }
}

export async function generateMealPlanRecipe(params: {
  dayOfWeek: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  householdSize: number;
  cookServings: number;
  otherMealsThisWeek: string[];
  otherMealsThisDay: string[];
  availableIngredients?: string;
  servings: number;
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
  kitchenInventory: KitchenInventory | null;
  userSkills?: { name: string; tier: SkillTier }[];
  nutritionGoals?: NutritionGoals | null;
  dailyNutritionSoFar?: NutritionInfo | null;
  tasteProfile?: { preferredCuisines: string[]; avoidedCuisines: string[]; preferredProteins: string[]; complexityPreference: string; totalRatings: number } | null;
  seasonalContext?: string;
}): Promise<(InspirationRecipe & { nutrition: NutritionInfo | null }) | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const kitchenContext = buildKitchenContext(params.kitchenInventory);
  const mealTypeContext = getMealTypeContext(params.mealType);

  const dietaryParts: string[] = [];
  if (params.dietaryPreferences && params.dietaryPreferences.length > 0) {
    const labels = params.dietaryPreferences.map((p) => getDietaryLabel(p));
    dietaryParts.push(`Dietary preferences: ${labels.join(", ")}. The recipe MUST comply.`);
  }
  if (params.foodExclusions && params.foodExclusions.length > 0) {
    dietaryParts.push(`NEVER use: ${params.foodExclusions.join(", ")}.`);
  }

  const skillsContext = params.userSkills && params.userSkills.length > 0
    ? `User's skill level: ${params.userSkills.map((s) => s.name).join(", ")}. Keep difficulty appropriate.`
    : "User is a beginner. Keep recipes simple.";

  const existingMeals = params.otherMealsThisWeek.length > 0
    ? `Already planned this week: ${params.otherMealsThisWeek.join(", ")}. Choose something DIFFERENT in cuisine, protein, and cooking method.`
    : "This is the first meal of the week — pick anything.";

  const sameDayContext = params.otherMealsThisDay.length > 0
    ? `Other meals today: ${params.otherMealsThisDay.join(", ")}. Avoid repetition within the same day.`
    : "";

  // Nutrition-aware generation
  let nutritionContext = "";
  if (params.nutritionGoals && params.dailyNutritionSoFar) {
    const goals = params.nutritionGoals;
    const soFar = params.dailyNutritionSoFar;
    const remaining = {
      calories: (goals.dailyCalories ?? 2000) - soFar.calories,
      protein: (goals.dailyProtein ?? 120) - soFar.protein,
      carbs: (goals.dailyCarbs ?? 250) - soFar.carbs,
      fat: (goals.dailyFat ?? 65) - soFar.fat,
    };
    nutritionContext = `\nUser's remaining daily targets: ~${Math.max(0, remaining.calories)} kcal, ~${Math.max(0, remaining.protein)}g protein, ~${Math.max(0, remaining.carbs)}g carbs, ~${Math.max(0, remaining.fat)}g fat. Aim roughly for these targets (approximate, not hard constraints).`;
  }

  // Taste profile context (only with enough data)
  let tasteContext = "";
  if (params.tasteProfile && params.tasteProfile.totalRatings >= 10) {
    const tp = params.tasteProfile;
    const parts: string[] = [];
    if (tp.preferredCuisines.length > 0) parts.push(`Enjoys: ${tp.preferredCuisines.join(", ")} cuisine`);
    if (tp.preferredProteins.length > 0) parts.push(`Prefers: ${tp.preferredProteins.join(", ")} as proteins`);
    parts.push(`Cooking style: ${tp.complexityPreference} complexity`);
    if (tp.avoidedCuisines.length > 0) parts.push(`Less excited about: ${tp.avoidedCuisines.join(", ")}`);
    tasteContext = `\nUser's taste preferences (learned from ${tp.totalRatings} ratings):\n- ${parts.join("\n- ")}\nLean toward their preferences while still offering variety.`;
  }

  const systemPrompt = `You are a meal planning chef creating a recipe for ${params.dayOfWeek} in a weekly meal plan.

${mealTypeContext}

${params.cookServings > params.householdSize
    ? `The user feeds ${params.householdSize} ${params.householdSize === 1 ? "person" : "people"} per meal but wants ${params.cookServings} servings total (the extra ${params.cookServings - params.householdSize} ${params.cookServings - params.householdSize === 1 ? "serving is" : "servings are"} intentional leftovers).`
    : `This recipe should make ${params.cookServings} servings for ${params.householdSize} ${params.householdSize === 1 ? "person" : "people"}.`}
Scale ingredient quantities for ${params.cookServings} servings. Nutrition should be PER SINGLE SERVING (not per the whole batch).

Rules:
1. Create a complete, practical recipe.
2. ${existingMeals}
${sameDayContext ? `3. ${sameDayContext}` : ""}
4. ${kitchenContext}
5. ${skillsContext}
${dietaryParts.length > 0 ? `6. DIETARY (MANDATORY): ${dietaryParts.join(" ")}` : ""}
${params.availableIngredients ? `7. User has these ingredients available: ${params.availableIngredients}. Prioritize using them.` : ""}
${params.seasonalContext ?? ""}
${nutritionContext}
${tasteContext}

Vary cuisines across the week. Include a mix of quick meals and more involved recipes.

Also estimate nutritional content PER SERVING. Use reasonable estimates based on standard nutritional databases.

Return a JSON object:
{
  "title": "Recipe Name",
  "description": "1-2 sentence description",
  "ingredients": [{ "name": "ingredient", "quantity": "1", "unit": "cup", "source": "provided" }],
  "steps": [{ "step_number": 1, "instruction": "...", "duration_minutes": 5 }],
  "cookTime": 30,
  "difficulty": "beginner|intermediate|advanced|expert",
  "servings": ${params.cookServings},
  "equipmentUsed": ["Pan"],
  "dietaryNotes": null,
  "newSkills": [],
  "nutrition": {
    "calories": 450,
    "protein": 32,
    "carbs": 45,
    "fat": 18,
    "fiber": 6,
    "sugar": 8,
    "sodium": 580
  }
}

Return ONLY JSON. No markdown.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate a ${params.dayOfWeek} ${params.mealType} recipe for the meal plan.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeRecipe(parsed, params.cookServings);
  } catch (error) {
    console.error(`Meal plan recipe generation failed for ${params.dayOfWeek} ${params.mealType}:`, error);
    return null;
  }
}

export type LeftoverPlan = {
  sourceDay: string;
  sourceMealType: "dinner";
  extraServings: number;
  targets: Array<{
    day: string;
    mealType: "lunch";
    portionsUsed: number;
    repurposeIdea?: string;
  }>;
};

export async function planLeftovers(params: {
  dinners: Array<{ day: string; title: string; description: string }>;
  householdSize: number;
  lunchSlotsToFill: string[];
}): Promise<LeftoverPlan[]> {
  if (params.lunchSlotsToFill.length === 0 || params.dinners.length === 0) {
    return [];
  }

  const client = getAnthropicClient();
  if (!client) return [];

  const dinnerList = params.dinners
    .map((d) => `- ${d.day}: ${d.title} — ${d.description}`)
    .join("\n");

  const systemPrompt = `You are a meal prep optimizer. Given a week of dinners for a household of ${params.householdSize}, decide which dinners should make extra servings so leftovers can cover specific lunches.

Dinners planned:
${dinnerList}

Lunch slots that need filling: ${params.lunchSlotsToFill.join(", ")}

Consider:
- Which dishes reheat well
- Which can be repurposed creatively (e.g., grilled chicken → chicken salad)
- Don't try to cover ALL lunches — only the ones where leftovers make sense
- Each leftover target consumes ${params.householdSize} extra portions from the source dinner

Return a JSON array of adjustments:
[
  {
    "sourceDay": "monday",
    "sourceMealType": "dinner",
    "extraServings": 2,
    "targets": [
      { "day": "tuesday", "mealType": "lunch", "portionsUsed": 2, "repurposeIdea": "Turn into a wrap" }
    ]
  }
]

If no good leftover opportunities exist, return an empty array [].
Return ONLY JSON. No markdown.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Plan the leftovers for this week.",
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return [];

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    if (!Array.isArray(parsed)) return [];

    return parsed as LeftoverPlan[];
  } catch (error) {
    console.error("Leftover planning failed:", error);
    return [];
  }
}

export type MealPrepGuide = {
  prepDay: string;
  totalPrepTime: number;
  sections: Array<{
    title: string;
    tasks: Array<{
      instruction: string;
      timeMinutes: number;
      affectedMeals: Array<{ day: string; mealType: string; recipeTitle: string }>;
      storageNote: string;
    }>;
  }>;
};

export async function generateMealPrepGuide(params: {
  weekPlan: Array<{ day: string; meals: Array<{ mealType: string; recipe: { title: string; description: string; ingredients: Ingredient[] } }> }>;
  householdSize: number;
}): Promise<MealPrepGuide | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const planSummary = params.weekPlan
    .map(
      (d) =>
        `${d.day}: ${d.meals.map((m) => `${m.mealType} - ${m.recipe.title}`).join(", ")}`
    )
    .join("\n");

  const systemPrompt = `You are a meal prep coach. Analyze a weekly meal plan for a household of ${params.householdSize} and create a batch cooking guide.

Weekly plan:
${planSummary}

Create a prep guide that:
1. Identifies shared base ingredients across recipes
2. Suggests what to prep in advance (proteins, vegetables, grains)
3. Provides time estimates
4. Includes storage instructions

Return a JSON object:
{
  "prepDay": "sunday",
  "totalPrepTime": 120,
  "sections": [
    {
      "title": "Proteins",
      "tasks": [
        {
          "instruction": "Grill 2 lbs chicken breast, slice and portion",
          "timeMinutes": 25,
          "affectedMeals": [{ "day": "monday", "mealType": "dinner", "recipeTitle": "Grilled Chicken" }],
          "storageNote": "Refrigerate up to 4 days"
        }
      ]
    }
  ]
}

Return ONLY JSON. No markdown.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Create the meal prep guide for this week.",
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return parsed as MealPrepGuide;
  } catch (error) {
    console.error("Meal prep guide generation failed:", error);
    return null;
  }
}

function normalizeNutrition(
  parsed: Record<string, unknown> | undefined | null
): NutritionInfo | null {
  if (!parsed || typeof parsed !== "object") return null;
  const calories = Number(parsed.calories);
  if (!calories || calories <= 0) return null;
  return {
    calories: Math.round(calories),
    protein: Math.round(Number(parsed.protein) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    fat: Math.round(Number(parsed.fat) || 0),
    fiber: Math.round(Number(parsed.fiber) || 0),
    sugar: Math.round(Number(parsed.sugar) || 0),
    sodium: Math.round(Number(parsed.sodium) || 0),
  };
}

function normalizeRecipe(
  parsed: Record<string, unknown>,
  defaultServings: number
): InspirationRecipe & { nutrition: NutritionInfo | null } {
  const validDifficulties = new Set(["beginner", "intermediate", "advanced", "expert"]);

  const ingredients = ((parsed.ingredients as Record<string, string>[]) || []).map((item) => ({
    name: String(item.name || ""),
    quantity: String(item.quantity || ""),
    unit: String(item.unit || ""),
    source: (["provided", "inferred", "pantry"].includes(item.source) ? item.source : "provided") as "provided" | "inferred" | "pantry",
  }));

  const steps = ((parsed.steps as Record<string, unknown>[]) || []).map((item, i) => ({
    step_number: Number(item.step_number) || i + 1,
    instruction: String(item.instruction || ""),
    duration_minutes: item.duration_minutes ? Number(item.duration_minutes) : undefined,
  }));

  return {
    title: String(parsed.title || "Meal Plan Recipe"),
    description: String(parsed.description || ""),
    ingredients,
    steps,
    cookTime: Math.max(1, Math.min(480, Number(parsed.cookTime) || 30)),
    difficulty: validDifficulties.has(parsed.difficulty as string)
      ? (parsed.difficulty as InspirationRecipe["difficulty"])
      : "intermediate",
    servings: Number(parsed.servings) || defaultServings,
    equipmentUsed: Array.isArray(parsed.equipmentUsed)
      ? (parsed.equipmentUsed as string[]).map(String)
      : [],
    dietaryNotes: parsed.dietaryNotes ? String(parsed.dietaryNotes) : null,
    newSkills: Array.isArray(parsed.newSkills)
      ? (parsed.newSkills as string[]).map(String).filter(Boolean)
      : [],
    nutrition: normalizeNutrition(parsed.nutrition as Record<string, unknown> | undefined),
  };
}
