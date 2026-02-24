import { getAnthropicClient } from "./client";
import type {
  Ingredient,
  KitchenInventory,
  InspirationRecipe,
  InspirationIngredient,
  RecipeStep,
  SkillTier,
} from "@/lib/db/schema";
import {
  kitchenLabels,
  categoryLabels,
} from "@/lib/kitchen-defaults";
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
    return "Kitchen equipment is unknown — assume they have basic equipment (stovetop, oven, basic pots/pans, cutting board, knife, mixing bowls).";
  }

  const equipment: string[] = [];

  for (const [category, items] of Object.entries(inventory)) {
    const labels = kitchenLabels[category];
    if (!labels) continue;

    for (const [key, value] of Object.entries(
      items as Record<string, number | boolean>
    )) {
      const label = labels[key] ?? key;
      if (typeof value === "boolean" && value) {
        equipment.push(label);
      } else if (typeof value === "number" && value > 0) {
        equipment.push(`${label} (x${value})`);
      }
    }
  }

  // Include custom equipment
  if (inventory.customEquipment && inventory.customEquipment.length > 0) {
    for (const item of inventory.customEquipment) {
      if (item.count > 1) {
        equipment.push(`${item.name} (x${item.count})`);
      } else {
        equipment.push(item.name);
      }
    }
  }

  if (equipment.length === 0) {
    return "User has set up their kitchen but hasn't selected any equipment — assume basic equipment only.";
  }

  return `User's kitchen equipment: ${equipment.join(", ")}. ONLY use equipment from this list.`;
}

function buildRecentMealsContext(
  meals: Array<{
    title: string;
    tags: string[] | null;
    ingredients: Ingredient[] | null;
  }>
): string {
  if (meals.length === 0) {
    return "No recent cooking history available.";
  }

  const lines = meals.map((meal, i) => {
    let line = `${i + 1}. "${meal.title}"`;
    if (meal.tags && meal.tags.length > 0) {
      line += ` [${meal.tags.join(", ")}]`;
    }
    if (meal.ingredients && meal.ingredients.length > 0) {
      const names = meal.ingredients.map((ing) => ing.name).join(", ");
      line += ` — Ingredients: ${names}`;
    }
    return line;
  });

  return `Recent meals cooked by this user:\n${lines.join("\n")}`;
}

function buildSkillsContext(
  userSkills?: { name: string; tier: SkillTier }[]
): string {
  if (!userSkills || userSkills.length === 0) {
    return "This user has no recorded cooking skills yet. Suggest beginner-friendly recipes and note which skills they'll learn.";
  }

  const tierLabels: Record<string, string> = {
    prep_cook: "Prep Cook",
    line_cook: "Line Cook",
    sous_chef: "Sous Chef",
    head_chef: "Head Chef",
    iron_chef: "Iron Chef",
  };

  const grouped = new Map<string, string[]>();
  for (const skill of userSkills) {
    const tier = tierLabels[skill.tier] ?? skill.tier;
    if (!grouped.has(tier)) grouped.set(tier, []);
    grouped.get(tier)!.push(skill.name);
  }

  const lines = Array.from(grouped.entries())
    .map(([tier, names]) => `  ${tier}: ${names.join(", ")}`)
    .join("\n");

  return `User's cooking skills:\n${lines}\n\nPrimarily suggest recipes within their skill level. You may include 1-2 techniques slightly above their current level to encourage growth. If the recipe will teach a NEW skill the user doesn't have yet, list those skill names in the "newSkills" array.`;
}

function buildDietaryContext(
  dietaryPreferences?: string[] | null,
  foodExclusions?: string[] | null,
  dietaryNotes?: string
): string {
  const parts: string[] = [];

  if (dietaryPreferences && dietaryPreferences.length > 0) {
    const labels = dietaryPreferences.map((p) => getDietaryLabel(p));
    parts.push(`User PROFILE dietary preferences: ${labels.join(", ")}. The recipe MUST comply with ALL of these dietary restrictions. Because these are the user's own dietary choices, assume any ingredients they list are compliant versions (e.g. if the user is vegan and lists "parmesan", assume they mean vegan parmesan — do NOT substitute or flag it).`);
  }

  if (foodExclusions && foodExclusions.length > 0) {
    parts.push(`User will NOT cook with these ingredients: ${foodExclusions.join(", ")}. NEVER include any of these in the recipe — not even as optional or pantry items.`);
  }

  if (dietaryNotes) {
    parts.push(`User-specified dietary requirements for THIS recipe: "${dietaryNotes}". This MUST be followed — the user may be cooking for someone else with specific needs (e.g. a vegan guest). Because this is a per-recipe note (not the user's own diet), do NOT assume ingredients are compliant — if the note says "vegan" and the user listed "parmesan", treat it as regular parmesan and substitute it with a vegan alternative.`);
  }

  if (parts.length === 0) return "";

  return parts.join("\n");
}

export async function generateInspirationRecipe(params: {
  availableIngredients: string;
  servings: number;
  dietaryNotes?: string;
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
  kitchenInventory: KitchenInventory | null;
  recentMeals: Array<{
    title: string;
    tags: string[] | null;
    ingredients: Ingredient[] | null;
  }>;
  previousRecipes?: string[];
  userSkills?: { name: string; tier: SkillTier }[];
}): Promise<InspirationRecipe | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const kitchenContext = buildKitchenContext(params.kitchenInventory);
  const mealsContext = buildRecentMealsContext(params.recentMeals);
  const skillsContext = buildSkillsContext(params.userSkills);
  const dietaryContext = buildDietaryContext(
    params.dietaryPreferences,
    params.foodExclusions,
    params.dietaryNotes
  );

  const systemPrompt = `You are a creative, practical home chef. The user tells you what ingredients they have on hand, OR asks for a specific dish by name, OR both. Your job is to create a delicious, complete recipe they can make.

Rules:
1. INGREDIENTS: The user's ingredient list tells you what is AVAILABLE, not what must ALL be used. Choose the ingredients that make sense for a cohesive, delicious dish. You may use all of them if they work well together, or just a subset. Do NOT force every listed ingredient into the recipe — only use what fits naturally.
2. DISH REQUESTS: If the user asks for a specific dish by name (e.g. "carbonara", "pad thai", "chicken tikka masala"), generate that exact dish. Use the listed ingredients where relevant, and fill in any missing essentials as "inferred" or "pantry" items.
3. You may add common pantry staples (salt, pepper, oil, butter, garlic, onions, sugar, flour, eggs, milk) — mark these as "pantry".
4. Look at the user's recent meals below. Infer other ingredients they probably keep stocked based on their cooking patterns (e.g., if they recently made pad thai, they likely have fish sauce, rice noodles, sesame oil). Mark these inferred additions as "inferred".
5. Equipment constraint: ${kitchenContext}
6. ${mealsContext}
7. ${skillsContext}${dietaryContext ? `\n8. DIETARY RESTRICTIONS (MANDATORY): ${dietaryContext}` : ""}

Return a JSON object with this EXACT structure:
{
  "title": "Recipe Name",
  "description": "A short, enticing 1-2 sentence description of the dish",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit", "source": "provided|inferred|pantry" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "Step instruction", "duration_minutes": 5 }
  ],
  "cookTime": 30,
  "difficulty": "beginner|intermediate|advanced|expert",
  "servings": ${params.servings},
  "equipmentUsed": ["Pan", "Oven"],
  "dietaryNotes": null,
  "newSkills": ["Skill Name"]
}

Each ingredient's "source" MUST be one of:
- "provided" — the user explicitly said they have it
- "inferred" — you're guessing they have it based on their recent cooking history
- "pantry" — a common kitchen staple most people have

The "newSkills" field should list cooking techniques used in this recipe that the user has NOT demonstrated before. If all techniques are already in their skill set, use an empty array [].

CRITICAL: Create something completely different each time. Vary the cuisine, cooking technique, and dish type.${
    params.previousRecipes && params.previousRecipes.length > 0
      ? `\n\nThe user has ALREADY REJECTED these recipes — do NOT suggest anything similar:\n${params.previousRecipes.map((t) => `- "${t}"`).join("\n")}\nPick a totally different cuisine, cooking style, and dish category.`
      : ""
  }

Return ONLY the JSON object. No markdown, no explanation, no extra text.`;

  const userMessage = `${params.availableIngredients}

Servings: ${params.servings}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeInspirationRecipe(parsed, params.servings);
  } catch (error) {
    console.error("AI inspiration generation failed:", error);
    return null;
  }
}

export async function regenerateRecipeSteps(params: {
  title: string;
  description: string;
  updatedIngredients: InspirationIngredient[];
  removedIngredients: string[];
  modifiedIngredients: string[];
  servings: number;
  difficulty: InspirationRecipe["difficulty"];
  kitchenInventory: KitchenInventory | null;
  dietaryNotes: string | null;
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
}): Promise<{
  steps: RecipeStep[];
  cookTime: number;
  equipmentUsed: string[];
} | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const kitchenContext = buildKitchenContext(params.kitchenInventory);

  const ingredientList = params.updatedIngredients
    .map((i) => `- ${i.quantity} ${i.unit} ${i.name}`)
    .join("\n");

  const removedSection =
    params.removedIngredients.length > 0
      ? `\nREMOVED ingredients (do NOT reference these in any step):\n${params.removedIngredients.map((n) => `- ${n}`).join("\n")}`
      : "";

  const modifiedSection =
    params.modifiedIngredients.length > 0
      ? `\nMODIFIED quantities:\n${params.modifiedIngredients.map((m) => `- ${m}`).join("\n")}\nAdjust cooking times and instructions accordingly.`
      : "";

  const systemPrompt = `You are a practical home chef. You are revising the cooking steps for an existing recipe because the user has changed the ingredient list.

Recipe: "${params.title}"
Description: "${params.description}"
Servings: ${params.servings}
Difficulty: ${params.difficulty}

Current ingredients (use ONLY these):
${ingredientList}
${removedSection}
${modifiedSection}

Equipment constraint: ${kitchenContext}
${(() => {
    const dc = buildDietaryContext(params.dietaryPreferences, params.foodExclusions, params.dietaryNotes ?? undefined);
    return dc ? `\nDIETARY RESTRICTIONS (MANDATORY): ${dc}` : "";
  })()}

Return a JSON object with this EXACT structure:
{
  "steps": [
    { "step_number": 1, "instruction": "Step instruction", "duration_minutes": 5 }
  ],
  "cookTime": 25,
  "equipmentUsed": ["Pan", "Oven"]
}

Rules:
1. Rewrite ALL steps from scratch to work with the updated ingredients.
2. Never mention any removed ingredient by name.
3. If a quantity was changed, adjust times (e.g., less meat = shorter cooking time).
4. Keep the same cuisine and cooking style as the original recipe.
5. ONLY use equipment from the constraint above.

Return ONLY the JSON object. No markdown, no explanation.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Regenerate the cooking steps for this recipe with the updated ingredients.",
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeRegeneratedSteps(parsed);
  } catch (error) {
    console.error("AI step regeneration failed:", error);
    return null;
  }
}

function normalizeRegeneratedSteps(
  parsed: Record<string, unknown>
): { steps: RecipeStep[]; cookTime: number; equipmentUsed: string[] } {
  const steps: RecipeStep[] = (
    (parsed.steps as Record<string, unknown>[]) || []
  ).map((item, i) => ({
    step_number: Number(item.step_number) || i + 1,
    instruction: String(item.instruction || ""),
    duration_minutes: item.duration_minutes
      ? Number(item.duration_minutes)
      : undefined,
  }));

  return {
    steps,
    cookTime: Math.max(1, Math.min(480, Number(parsed.cookTime) || 30)),
    equipmentUsed: Array.isArray(parsed.equipmentUsed)
      ? (parsed.equipmentUsed as string[]).map(String)
      : [],
  };
}

function normalizeInspirationRecipe(
  parsed: Record<string, unknown>,
  defaultServings: number
): InspirationRecipe {
  const validSources = new Set(["provided", "inferred", "pantry"]);

  const ingredients: InspirationIngredient[] = (
    (parsed.ingredients as Record<string, string>[]) || []
  ).map((item) => ({
    name: String(item.name || ""),
    quantity: String(item.quantity || ""),
    unit: String(item.unit || ""),
    source: validSources.has(item.source)
      ? (item.source as "provided" | "inferred" | "pantry")
      : "provided",
  }));

  const steps: RecipeStep[] = (
    (parsed.steps as Record<string, unknown>[]) || []
  ).map((item, i) => ({
    step_number: Number(item.step_number) || i + 1,
    instruction: String(item.instruction || ""),
    duration_minutes: item.duration_minutes
      ? Number(item.duration_minutes)
      : undefined,
  }));

  const validDifficulties = new Set([
    "beginner",
    "intermediate",
    "advanced",
    "expert",
  ]);

  return {
    title: String(parsed.title || "Inspired Recipe"),
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
