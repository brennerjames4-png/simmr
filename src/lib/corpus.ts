import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recipeCorpus,
  cookingTipsCache,
  skillExtractionCache,
} from "@/lib/db/schema";
import type {
  Ingredient,
  RecipeStep,
  InspirationRecipe,
} from "@/lib/db/schema";
import type { ExtractedSkill } from "@/lib/ai/skills";

// Cuisine keywords map for simple inference
const CUISINE_KEYWORDS: Record<string, string[]> = {
  italian: [
    "pasta", "parmesan", "basil", "mozzarella", "risotto", "prosciutto",
    "marinara", "pesto", "lasagna", "gnocchi", "bruschetta", "focaccia",
    "oregano", "pancetta",
  ],
  asian: [
    "soy sauce", "ginger", "sesame", "tofu", "bok choy", "miso",
    "rice vinegar", "hoisin",
  ],
  japanese: [
    "mirin", "dashi", "wasabi", "nori", "sushi", "ramen", "tempura",
    "teriyaki", "edamame", "sake",
  ],
  chinese: [
    "wok", "five spice", "oyster sauce", "szechuan", "dumpling",
    "stir fry", "chow mein", "kung pao",
  ],
  thai: [
    "fish sauce", "lemongrass", "galangal", "thai basil", "coconut milk",
    "pad thai", "curry paste", "kaffir lime",
  ],
  indian: [
    "turmeric", "cumin", "garam masala", "naan", "tikka", "curry",
    "masala", "tandoori", "cardamom", "coriander",
  ],
  mexican: [
    "tortilla", "salsa", "cilantro", "jalapeno", "cumin", "taco",
    "enchilada", "chipotle", "avocado", "queso",
  ],
  french: [
    "beurre", "creme fraiche", "shallot", "dijon", "bechamel",
    "roux", "gratin", "souffle", "croissant", "confit",
  ],
  greek: [
    "feta", "olive", "tzatziki", "oregano", "gyro", "pita",
    "hummus", "dolma", "kalamata",
  ],
  korean: [
    "gochujang", "kimchi", "sesame oil", "bibimbap", "bulgogi",
    "ssamjang", "doenjang",
  ],
  mediterranean: [
    "tahini", "za'atar", "sumac", "pomegranate", "couscous",
    "harissa", "falafel",
  ],
  american: [
    "bbq", "barbecue", "burger", "cornbread", "mac and cheese",
    "pulled pork", "coleslaw",
  ],
  caribbean: [
    "jerk", "plantain", "scotch bonnet", "allspice", "coconut",
    "rum",
  ],
  middle_eastern: [
    "shawarma", "kebab", "saffron", "rose water", "baklava",
    "labneh",
  ],
};

// Appliance keywords to scan in step instructions
const APPLIANCE_KEYWORDS: Record<string, string[]> = {
  oven: ["oven", "bake", "roast", "broil", "preheat"],
  blender: ["blender", "blend", "puree", "pulse"],
  air_fryer: ["air fryer", "air fry", "air-fry"],
  grill: ["grill", "grilling", "charcoal"],
  stovetop: ["stovetop", "stove", "burner"],
  microwave: ["microwave"],
  slow_cooker: ["slow cooker", "crock pot", "crockpot"],
  pressure_cooker: ["pressure cooker", "instant pot"],
  food_processor: ["food processor"],
  stand_mixer: ["stand mixer", "mixer"],
  wok: ["wok"],
  dutch_oven: ["dutch oven"],
  toaster: ["toaster"],
};

function normalizeDishName(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/^(a |the |my )/, "");
}

function inferCuisineTags(title: string, ingredients: Ingredient[]): string[] {
  const searchText = [
    title.toLowerCase(),
    ...ingredients.map((i) => i.name.toLowerCase()),
  ].join(" ");

  const matched = new Set<string>();

  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        matched.add(cuisine);
        break;
      }
    }
  }

  return Array.from(matched);
}

function extractAppliancesFromSteps(steps: RecipeStep[]): string[] {
  const stepsText = steps
    .map((s) => s.instruction.toLowerCase())
    .join(" ");

  const matched = new Set<string>();

  for (const [appliance, keywords] of Object.entries(APPLIANCE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (stepsText.includes(keyword)) {
        matched.add(appliance);
        break;
      }
    }
  }

  return Array.from(matched);
}

export async function saveToRecipeCorpus(params: {
  title: string;
  description?: string | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  cookTime?: number | null;
  difficulty?: string | null;
  servings?: number | null;
  tags?: string[];
  dietaryPreferences?: string[] | null;
  foodExclusions?: string[] | null;
  appliancesUsed?: string[];
  source: "full_recipe" | "inspiration" | "structured_voice" | "ingredient_only";
  sourceUserId?: string;
  inspirationMetadata?: InspirationRecipe | null;
}): Promise<void> {
  try {
    const dishNameNormalized = normalizeDishName(params.title);
    const cuisineTags = inferCuisineTags(params.title, params.ingredients);
    const appliancesUsed =
      params.appliancesUsed && params.appliancesUsed.length > 0
        ? params.appliancesUsed
        : extractAppliancesFromSteps(params.steps);

    const validDifficulties = new Set([
      "beginner",
      "intermediate",
      "advanced",
      "expert",
    ]);
    const difficulty =
      params.difficulty && validDifficulties.has(params.difficulty)
        ? (params.difficulty as "beginner" | "intermediate" | "advanced" | "expert")
        : null;

    await db.insert(recipeCorpus).values({
      dishNameNormalized,
      title: params.title.slice(0, 200),
      description: params.description ?? null,
      ingredients: params.ingredients,
      steps: params.steps,
      cookTime: params.cookTime ?? null,
      difficulty,
      servings: params.servings ?? null,
      tags: params.tags ?? [],
      dietaryTags: params.dietaryPreferences ?? [],
      foodExclusions: params.foodExclusions ?? [],
      appliancesUsed,
      cuisineTags,
      source: params.source,
      sourceUserId: params.sourceUserId ?? null,
      inspirationMetadata: params.inspirationMetadata ?? null,
    });
  } catch (error) {
    console.error("Corpus write failed (non-blocking):", error);
  }
}

export async function saveToCookingTipsCache(
  dishName: string,
  tipText: string
): Promise<void> {
  try {
    const dishNameNormalized = normalizeDishName(dishName);

    await db.insert(cookingTipsCache).values({
      dishNameNormalized,
      tipText,
    });
  } catch (error) {
    console.error("Cooking tips cache write failed (non-blocking):", error);
  }
}

export async function saveToSkillExtractionCache(
  steps: RecipeStep[],
  title: string,
  extractedSkills: ExtractedSkill[]
): Promise<void> {
  try {
    const stepsHash = createHash("sha256")
      .update(JSON.stringify(steps))
      .digest("hex");

    await db
      .insert(skillExtractionCache)
      .values({
        stepsHash,
        recipeTitle: title.slice(0, 200),
        extractedSkills,
      })
      .onConflictDoNothing({ target: skillExtractionCache.stepsHash });
  } catch (error) {
    console.error("Skill extraction cache write failed (non-blocking):", error);
  }
}

export async function getCachedCookingTip(
  dishName: string
): Promise<string | null> {
  try {
    const dishNameNormalized = normalizeDishName(dishName);
    const cached = await db.query.cookingTipsCache.findFirst({
      where: eq(cookingTipsCache.dishNameNormalized, dishNameNormalized),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    return cached?.tipText ?? null;
  } catch (error) {
    console.error("Cooking tips cache lookup failed:", error);
    return null;
  }
}

export async function getCachedSkillExtraction(
  steps: RecipeStep[]
): Promise<ExtractedSkill[] | null> {
  try {
    const stepsHash = createHash("sha256")
      .update(JSON.stringify(steps))
      .digest("hex");
    const cached = await db.query.skillExtractionCache.findFirst({
      where: eq(skillExtractionCache.stepsHash, stepsHash),
    });
    if (!cached) return null;
    return cached.extractedSkills as ExtractedSkill[];
  } catch (error) {
    console.error("Skill extraction cache lookup failed:", error);
    return null;
  }
}
