import { getAnthropicClient } from "./client";

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
