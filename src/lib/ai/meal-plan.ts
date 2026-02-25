import { getAnthropicClient } from "./client";
import type {
  KitchenInventory,
  InspirationRecipe,
  SkillTier,
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

export async function generateMealPlanRecipe(params: {
  dayOfWeek: string;
  otherMealsThisWeek: string[];
  availableIngredients?: string;
  servings: number;
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
  kitchenInventory: KitchenInventory | null;
  userSkills?: { name: string; tier: SkillTier }[];
}): Promise<InspirationRecipe | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const kitchenContext = buildKitchenContext(params.kitchenInventory);

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

  const systemPrompt = `You are a meal planning chef creating a recipe for ${params.dayOfWeek} in a weekly meal plan.

Rules:
1. Create a complete, practical dinner recipe.
2. ${existingMeals}
3. ${kitchenContext}
4. ${skillsContext}
5. Servings: ${params.servings}
${dietaryParts.length > 0 ? `6. DIETARY (MANDATORY): ${dietaryParts.join(" ")}` : ""}
${params.availableIngredients ? `7. User has these ingredients available: ${params.availableIngredients}. Prioritize using them.` : ""}

Vary cuisines across the week. Include a mix of quick meals (under 30 min) and more involved recipes.

Return a JSON object:
{
  "title": "Recipe Name",
  "description": "1-2 sentence description",
  "ingredients": [{ "name": "ingredient", "quantity": "1", "unit": "cup", "source": "provided" }],
  "steps": [{ "step_number": 1, "instruction": "...", "duration_minutes": 5 }],
  "cookTime": 30,
  "difficulty": "beginner|intermediate|advanced|expert",
  "servings": ${params.servings},
  "equipmentUsed": ["Pan"],
  "dietaryNotes": null,
  "newSkills": []
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
          content: `Generate a ${params.dayOfWeek} dinner recipe for the meal plan.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeRecipe(parsed, params.servings);
  } catch (error) {
    console.error(`Meal plan recipe generation failed for ${params.dayOfWeek}:`, error);
    return null;
  }
}

function normalizeRecipe(
  parsed: Record<string, unknown>,
  defaultServings: number
): InspirationRecipe {
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
  };
}
