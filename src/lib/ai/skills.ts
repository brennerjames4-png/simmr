import { getAnthropicClient } from "./client";
import type { RecipeStep, Ingredient, SkillTier, SkillCategory } from "@/lib/db/schema";
import { saveToSkillExtractionCache } from "@/lib/corpus";

export type ExtractedSkill = {
  name: string;
  tier: SkillTier;
  category: SkillCategory;
  description: string;
  is_existing: boolean;
};

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export async function extractSkillsFromRecipe(params: {
  title: string;
  steps: RecipeStep[];
  ingredients: Ingredient[];
  existingSkillNames: string[];
}): Promise<ExtractedSkill[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const stepsText = params.steps
    .map((s) => `${s.step_number}. ${s.instruction}`)
    .join("\n");

  const ingredientsText = params.ingredients
    .map((i) => `${i.quantity} ${i.unit} ${i.name}`)
    .join(", ");

  const existingSkillsList =
    params.existingSkillNames.length > 0
      ? params.existingSkillNames.join(", ")
      : "None yet";

  const systemPrompt = `You are a culinary education expert. Given a recipe's steps and ingredients, identify the distinct cooking SKILLS demonstrated in this recipe.

Rules:
1. Extract 1-5 skills per recipe. Focus on meaningful techniques, not trivial actions.
2. Skills should be specific cooking techniques (e.g., "Sauteing", "Braising", "Julienne", "Tempering Chocolate") — NOT ingredient knowledge or recipe names.
3. Do NOT include generic actions like "measuring", "stirring", "reading a recipe", "plating", or "serving".
4. FIRST, check if the skill matches an existing skill from the catalog below. Use the EXACT name if it matches.
5. If the skill is genuinely new (not in the catalog), create a new entry with a concise name.
6. Each skill has an intrinsic difficulty tier (this describes the SKILL's difficulty, not the recipe's):
   - "prep_cook": Foundational techniques anyone can do (boiling, whisking, basic seasoning)
   - "line_cook": Standard kitchen techniques requiring practice (sauteing, pan-searing, making roux)
   - "sous_chef": Intermediate techniques requiring judgment and feel (emulsifying, braising, tempering)
   - "head_chef": Advanced techniques requiring significant experience (laminated dough, souffle, wok hei)
   - "iron_chef": Elite techniques few home cooks master (sugar work, molecular gastronomy, advanced fermentation)
7. Each skill has a category:
   - "technique": Heat application, mixing methods, sauce-making
   - "knife_work": Cutting, chopping, and preparation techniques
   - "baking_pastry": Dough, batter, sugar, and pastry work
   - "specialty": Equipment-specific or cuisine-specific skills

EXISTING SKILLS CATALOG:
${existingSkillsList}

Return a JSON array:
[
  {
    "name": "Skill Name",
    "tier": "line_cook",
    "category": "technique",
    "description": "One GENERIC sentence describing this cooking technique — NEVER reference a specific dish, recipe, or ingredient. Describe what the technique IS, not how it was used in this recipe.",
    "is_existing": true
  }
]

Set "is_existing" to true ONLY if the name EXACTLY matches one from the catalog.
Return ONLY the JSON array. No markdown, no explanation.`;

  const userMessage = `Recipe: "${params.title}"

Ingredients: ${ingredientsText}

Steps:
${stepsText}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock) return null;

    const cleaned = cleanJsonResponse(textBlock.text);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    const result = normalizeExtractedSkills(parsed);

    if (result.length > 0) {
      saveToSkillExtractionCache(params.steps, params.title, result);
    }

    return result;
  } catch (error) {
    console.error("AI skill extraction failed:", error);
    return null;
  }
}

function normalizeExtractedSkills(
  parsed: Record<string, unknown>[]
): ExtractedSkill[] {
  const validTiers = new Set<string>([
    "prep_cook",
    "line_cook",
    "sous_chef",
    "head_chef",
    "iron_chef",
  ]);
  const validCategories = new Set<string>([
    "technique",
    "knife_work",
    "baking_pastry",
    "specialty",
  ]);

  return parsed
    .map((item) => ({
      name: String(item.name || "").trim(),
      tier: (validTiers.has(String(item.tier))
        ? String(item.tier)
        : "line_cook") as SkillTier,
      category: (validCategories.has(String(item.category))
        ? String(item.category)
        : "technique") as SkillCategory,
      description: String(item.description || "").slice(0, 255),
      is_existing: Boolean(item.is_existing),
    }))
    .filter((skill) => skill.name.length > 0 && skill.name.length <= 100);
}
