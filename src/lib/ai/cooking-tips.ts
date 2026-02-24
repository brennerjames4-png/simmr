import { getAnthropicClient } from "./client";
import type { Ingredient, RecipeStep, GeneratedRecipe } from "@/lib/db/schema";
import { getDietaryLabel } from "@/lib/dietary-config";
import { saveToCookingTipsCache } from "@/lib/corpus";

export type DietaryContext = {
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
};

function buildDietaryRules(dietary?: DietaryContext): string {
  if (!dietary) return "";

  const parts: string[] = [];

  if (dietary.dietaryPreferences && dietary.dietaryPreferences.length > 0) {
    const labels = dietary.dietaryPreferences.map((p) => getDietaryLabel(p));
    parts.push(`The user follows these diets: ${labels.join(", ")}. The recipe MUST comply with ALL of these.`);
  }

  if (dietary.foodExclusions && dietary.foodExclusions.length > 0) {
    parts.push(`The user does NOT cook with: ${dietary.foodExclusions.join(", ")}. NEVER include any of these ingredients.`);
  }

  if (parts.length === 0) return "";
  return `\n\nDIETARY RESTRICTIONS (MANDATORY):\n${parts.join("\n")}`;
}

export async function generateCookingTip(
  title: string,
  description?: string
): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system:
        "You are a world-class chef with Michelin-star experience. Given a dish, provide one concise, surprising pro tip (max 2 sentences) that would genuinely elevate the dish. Be specific and practical, not generic. Don't start with 'Pro tip:' or similar prefixes.",
      messages: [
        {
          role: "user",
          content: `Dish: ${title}${description ? `\nContext: ${description}` : ""}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const result = textBlock ? textBlock.text.trim() : null;

    if (result) {
      saveToCookingTipsCache(title, result);
    }

    return result;
  } catch (error) {
    console.error("AI tip generation failed:", error);
    return null;
  }
}

export async function generateIngredientList(
  dishName: string,
  servings?: number,
  dietary?: DietaryContext
): Promise<Ingredient[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const dietaryRules = buildDietaryRules(dietary);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: `You are a world-class chef. Given a dish name and optionally a number of servings, return a complete ingredient list as a JSON array. Each ingredient must have: "name" (string), "quantity" (string, e.g. "2", "1/2", "200"), "unit" (string, e.g. "cups", "g", "tbsp", "whole", "to taste"). Be precise with quantities for the given serving count. If no serving count is given, default to 4 servings. Return ONLY the JSON array, no markdown, no explanation.${dietaryRules}`,
      messages: [
        {
          role: "user",
          content: `Dish: ${dishName}${servings ? `\nServings: ${servings}` : ""}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    if (!Array.isArray(parsed)) return null;

    return parsed.map((item: Record<string, string>) => ({
      name: String(item.name || ""),
      quantity: String(item.quantity || ""),
      unit: String(item.unit || ""),
    }));
  } catch (error) {
    console.error("AI ingredient generation failed:", error);
    return null;
  }
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

function normalizeRecipeResponse(parsed: Record<string, unknown>): GeneratedRecipe {
  const ingredients: Ingredient[] = (
    (parsed.ingredients as Record<string, string>[]) || []
  ).map((item) => ({
    name: String(item.name || ""),
    quantity: String(item.quantity || ""),
    unit: String(item.unit || ""),
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

  return { ingredients, steps };
}

export async function generateFullRecipe(
  dishName: string,
  servings?: number,
  dietary?: DietaryContext
): Promise<GeneratedRecipe | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const dietaryRules = buildDietaryRules(dietary);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a world-class chef. Given a dish name and optionally a serving count, return a complete recipe as JSON with two keys:
- "ingredients": array of { "name": string, "quantity": string, "unit": string }
- "steps": array of { "step_number": number, "instruction": string, "duration_minutes": number | null }
Be precise with quantities for the given serving count (default 4). Steps should be clear, concise, and numbered sequentially. Include duration_minutes only when meaningful. Return ONLY the JSON object, no markdown, no explanation.${dietaryRules}`,
      messages: [
        {
          role: "user",
          content: `Dish: ${dishName}${servings ? `\nServings: ${servings}` : ""}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeRecipeResponse(parsed);
  } catch (error) {
    console.error("AI full recipe generation failed:", error);
    return null;
  }
}

export async function structureRecipeFromDescription(
  transcript: string,
  dishName: string,
  servings?: number,
  dietary?: DietaryContext
): Promise<GeneratedRecipe | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const dietaryRules = buildDietaryRules(dietary);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a world-class chef and recipe editor. You will receive a free-form description of how someone cooked a dish (possibly from voice dictation — expect informal language, filler words, and transcription errors). Extract and structure it into a clean recipe JSON with two keys:
- "ingredients": array of { "name": string, "quantity": string, "unit": string }
- "steps": array of { "step_number": number, "instruction": string, "duration_minutes": number | null }
Infer reasonable quantities if the speaker was vague (e.g. "some olive oil" → "2 tablespoons"). Organize steps into logical cooking order even if the speaker jumped around. Scale to the given serving count if provided. Return ONLY the JSON object, no markdown, no explanation.${dietaryRules}`,
      messages: [
        {
          role: "user",
          content: `Dish: ${dishName}${servings ? `\nServings: ${servings}` : ""}\n\nDescription:\n${transcript}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    return normalizeRecipeResponse(parsed);
  } catch (error) {
    console.error("AI recipe structuring failed:", error);
    return null;
  }
}

export async function regenerateStepsFromIngredients(
  dishName: string,
  ingredients: Ingredient[],
  servings?: number,
  dietary?: DietaryContext
): Promise<RecipeStep[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const ingredientsList = ingredients
    .map((i) => `${i.quantity} ${i.unit} ${i.name}`.trim())
    .join("\n");

  const dietaryRules = buildDietaryRules(dietary);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a world-class chef. Given a dish name and a specific list of ingredients, generate cooking steps that use ALL of the provided ingredients. Do not add extra ingredients — work only with what is given. Return a JSON array of steps:
[{ "step_number": number, "instruction": string, "duration_minutes": number | null }]
Steps should be clear, concise, and in logical cooking order. Include duration_minutes only when meaningful. Return ONLY the JSON array, no markdown, no explanation.${dietaryRules}`,
      messages: [
        {
          role: "user",
          content: `Dish: ${dishName}${servings ? `\nServings: ${servings}` : ""}\n\nIngredients:\n${ingredientsList}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(cleanJsonResponse(textBlock.text));
    if (!Array.isArray(parsed)) return null;

    return parsed.map((step: Record<string, unknown>, i: number) => ({
      step_number: typeof step.step_number === "number" ? step.step_number : i + 1,
      instruction: String(step.instruction || ""),
      ...(step.duration_minutes != null
        ? { duration_minutes: Number(step.duration_minutes) }
        : {}),
    }));
  } catch (error) {
    console.error("AI step regeneration failed:", error);
    return null;
  }
}
