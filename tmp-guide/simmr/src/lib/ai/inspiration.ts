import Anthropic from "@anthropic-ai/sdk";
import type { AIRecipe, InspirationInput } from "@/types/inspiration";
import type { KitchenItem } from "@/types/inspiration";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ============================================================
// RECIPE GENERATION
// ============================================================

interface GenerateRecipeParams {
  input: InspirationInput;
  kitchenEquipment: KitchenItem[];
  recentMeals: { title: string; tags: string[]; ingredients?: string[] }[];
}

/**
 * Generate a full recipe using Claude, factoring in:
 * 1. User's available ingredients
 * 2. Kitchen equipment they own
 * 3. Recent meals → infer likely pantry staples
 */
export async function generateInspirationRecipe({
  input,
  kitchenEquipment,
  recentMeals,
}: GenerateRecipeParams): Promise<AIRecipe> {
  // Build equipment summary
  const equipmentSummary = formatEquipment(kitchenEquipment);

  // Build recent meals context for pantry inference
  const recentMealsSummary = formatRecentMeals(recentMeals);

  const systemPrompt = `You are a creative home chef assistant for Simmr, a social cooking app.
Your job is to suggest a delicious, achievable recipe based on what the user has available.

CRITICAL RULES:
1. ONLY use equipment the user actually owns. Never suggest a technique that requires equipment they don't have.
2. The user has told you what ingredients they have available RIGHT NOW. Use primarily these.
3. You should INFER additional pantry staples they likely have based on their recent cooking history. Things like:
   - Spices and seasonings used in recent meals
   - Cooking oils and vinegars
   - Sauces and condiments (soy sauce, hot sauce, etc.)
   - Canned goods and dry staples (pasta, rice, canned tomatoes, etc.)
   - Salt, pepper, sugar, flour — common basics
4. Clearly mark which ingredients are:
   - "provided" — user explicitly mentioned them
   - "inferred" — you're guessing they have from recent meals
   - "assumed_pantry" — universal basics (salt, pepper, oil)
5. Keep it realistic and home-cook friendly. No restaurant techniques.
6. The recipe must be complete with exact quantities, times, and clear instructions.

RESPOND ONLY WITH VALID JSON matching this exact schema (no markdown, no backticks, no explanation):
{
  "dishName": "string",
  "description": "string (1-2 enticing sentences)",
  "servings": number,
  "prepTime": number (minutes),
  "cookTime": number (minutes),
  "totalTime": number (minutes),
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [
    {
      "name": "string",
      "quantity": "string (e.g. '200g', '2 tbsp', '1 large')",
      "category": "provided" | "inferred" | "assumed_pantry"
    }
  ],
  "steps": [
    {
      "stepNumber": number,
      "instruction": "string (clear, detailed instruction)",
      "duration": number | null (minutes if time-based, null if not),
      "equipment": "string | null (what equipment this step uses)"
    }
  ],
  "tips": ["string (1-3 useful tips)"],
  "inferredIngredients": ["string (list of ingredients you inferred they have)"],
  "equipmentUsed": ["string (list of their equipment you used in this recipe)"]
}`;

  const userMessage = buildUserMessage(input, equipmentSummary, recentMealsSummary);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  // Extract text content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Parse JSON response
  const jsonText = textBlock.text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const recipe: AIRecipe = JSON.parse(jsonText);
    return validateRecipe(recipe);
  } catch (e) {
    console.error("Failed to parse AI recipe response:", jsonText);
    throw new Error("Failed to generate recipe. Please try again.");
  }
}

// ============================================================
// STEP REGENERATION (ingredient-aware)
// ============================================================

interface RegenerateStepsParams {
  dishName: string;
  servings: number;
  ingredients: { name: string; quantity: string; category: string }[];
  removedIngredients: string[];
  kitchenEquipment: KitchenItem[];
}

interface RegenerateStepsResult {
  steps: AIRecipe["steps"];
  tips: string[];
  equipmentUsed: string[];
}

/**
 * Regenerate ONLY the cooking steps for a recipe after the user
 * has edited the ingredient list. This is a cheaper, faster call
 * than regenerating the entire recipe.
 */
export async function regenerateRecipeSteps({
  dishName,
  servings,
  ingredients,
  removedIngredients,
  kitchenEquipment,
}: RegenerateStepsParams): Promise<RegenerateStepsResult> {
  const equipmentSummary = formatEquipment(kitchenEquipment);

  const systemPrompt = `You are a home chef assistant for Simmr. The user previously generated a recipe and has now EDITED the ingredient list. Your job is to rewrite ONLY the cooking steps to work with the updated ingredients.

CRITICAL RULES:
1. The steps MUST only use ingredients from the provided list. Do NOT reference any removed ingredients.
2. ONLY use equipment the user owns.
3. Adapt the cooking method if removing an ingredient requires a different technique.
4. Keep the same dish concept ("${dishName}") but adjust as needed.
5. If a key ingredient was removed, adapt creatively rather than producing a broken recipe.
6. Provide complete, clear, step-by-step instructions with times.

RESPOND ONLY WITH VALID JSON (no markdown, no backticks):
{
  "steps": [
    {
      "stepNumber": number,
      "instruction": "string",
      "duration": number | null,
      "equipment": "string | null"
    }
  ],
  "tips": ["string (1-3 tips, updated for the new ingredient list)"],
  "equipmentUsed": ["string (equipment used in the new steps)"]
}`;

  const ingredientList = ingredients
    .map((ing) => `- ${ing.quantity} ${ing.name} (${ing.category})`)
    .join("\n");

  const removedList =
    removedIngredients.length > 0
      ? `\n\n## Removed Ingredients (DO NOT USE THESE)\n${removedIngredients.map((r) => `- ❌ ${r}`).join("\n")}`
      : "";

  const userMessage = `Rewrite the cooking steps for "${dishName}" (${servings} servings) with these updated ingredients:

## Current Ingredients
${ingredientList}
${removedList}

## Available Kitchen Equipment
${equipmentSummary || "Basic kitchen: stovetop, oven, basic pots and pans."}

Write new steps that work perfectly with ONLY the ingredients listed above.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  const jsonText = textBlock.text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonText);

    return {
      steps: (parsed.steps ?? []).map((step: any, idx: number) => ({
        stepNumber: step.stepNumber ?? idx + 1,
        instruction: step.instruction ?? "",
        duration: step.duration ?? null,
        equipment: step.equipment ?? null,
      })),
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
      equipmentUsed: Array.isArray(parsed.equipmentUsed) ? parsed.equipmentUsed : [],
    };
  } catch (e) {
    console.error("Failed to parse regenerated steps:", jsonText);
    throw new Error("Failed to regenerate steps. Please try again.");
  }
}

// ============================================================
// HELPERS
// ============================================================

function buildUserMessage(
  input: InspirationInput,
  equipmentSummary: string,
  recentMealsSummary: string
): string {
  let message = `I need a recipe idea! Here's what I'm working with:

## My Available Ingredients
${input.availableIngredients}

## My Kitchen Equipment
${equipmentSummary || "No equipment profile set up — assume a basic kitchen with stovetop, oven, basic pots and pans."}

## My Recent Cooking History
${recentMealsSummary || "No recent meals on record — stick to universally common pantry staples only."}`;

  if (input.servings) {
    message += `\n\n## Servings Needed: ${input.servings}`;
  }

  if (input.dietaryNotes) {
    message += `\n\n## Dietary Notes: ${input.dietaryNotes}`;
  }

  message += `\n\nPlease suggest ONE creative, delicious recipe I can make. Factor in what spices and staples I likely have based on my recent meals.`;

  return message;
}

function formatEquipment(equipment: KitchenItem[]): string {
  if (equipment.length === 0) return "";

  const byCategory: Record<string, string[]> = {};

  for (const item of equipment) {
    if (!byCategory[item.category]) {
      byCategory[item.category] = [];
    }
    const sizeStr = item.size ? ` (${item.size})` : "";
    const qtyStr = item.quantity > 1 ? ` x${item.quantity}` : "";
    byCategory[item.category].push(`${item.itemName}${sizeStr}${qtyStr}`);
  }

  return Object.entries(byCategory)
    .map(([cat, items]) => `${cat}: ${items.join(", ")}`)
    .join("\n");
}

function formatRecentMeals(
  meals: { title: string; tags: string[]; ingredients?: string[] }[]
): string {
  if (meals.length === 0) return "";

  return meals
    .map((meal, i) => {
      let line = `${i + 1}. ${meal.title}`;
      if (meal.tags.length > 0) line += ` [${meal.tags.join(", ")}]`;
      if (meal.ingredients && meal.ingredients.length > 0) {
        line += ` — used: ${meal.ingredients.join(", ")}`;
      }
      return line;
    })
    .join("\n");
}

function validateRecipe(recipe: any): AIRecipe {
  // Basic validation to ensure the AI returned a complete recipe
  if (!recipe.dishName || typeof recipe.dishName !== "string") {
    throw new Error("Invalid recipe: missing dish name");
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error("Invalid recipe: missing ingredients");
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error("Invalid recipe: missing steps");
  }

  return {
    dishName: recipe.dishName,
    description: recipe.description ?? "",
    servings: recipe.servings ?? 2,
    prepTime: recipe.prepTime ?? 0,
    cookTime: recipe.cookTime ?? 0,
    totalTime: recipe.totalTime ?? (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0),
    difficulty: ["easy", "medium", "hard"].includes(recipe.difficulty)
      ? recipe.difficulty
      : "medium",
    ingredients: recipe.ingredients.map((ing: any) => ({
      name: ing.name ?? "Unknown",
      quantity: ing.quantity ?? "",
      category: ["provided", "inferred", "assumed_pantry"].includes(ing.category)
        ? ing.category
        : "provided",
    })),
    steps: recipe.steps.map((step: any, idx: number) => ({
      stepNumber: step.stepNumber ?? idx + 1,
      instruction: step.instruction ?? "",
      duration: step.duration ?? null,
      equipment: step.equipment ?? null,
    })),
    tips: Array.isArray(recipe.tips) ? recipe.tips : [],
    inferredIngredients: Array.isArray(recipe.inferredIngredients)
      ? recipe.inferredIngredients
      : [],
    equipmentUsed: Array.isArray(recipe.equipmentUsed)
      ? recipe.equipmentUsed
      : [],
  };
}
