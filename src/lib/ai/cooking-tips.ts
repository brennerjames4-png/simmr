import { getAnthropicClient } from "./client";
import type { Ingredient } from "@/lib/db/schema";

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
    return textBlock ? textBlock.text.trim() : null;
  } catch (error) {
    console.error("AI tip generation failed:", error);
    return null;
  }
}

export async function generateIngredientList(
  dishName: string,
  servings: number
): Promise<Ingredient[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: `You are a world-class chef. Given a dish name and number of servings, return a complete ingredient list as a JSON array. Each ingredient must have: "name" (string), "quantity" (string, e.g. "2", "1/2", "200"), "unit" (string, e.g. "cups", "g", "tbsp", "whole", "to taste"). Be precise with quantities for the given serving count. Return ONLY the JSON array, no markdown, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Dish: ${dishName}\nServings: ${servings}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const parsed = JSON.parse(textBlock.text.trim());
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
