import { createHash } from "crypto";
import { eq, sql, and, or, not, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  recipeCorpus,
  cookingTipsCache,
  skillExtractionCache,
  corpusAnalytics,
} from "@/lib/db/schema";
import type {
  Ingredient,
  RecipeStep,
  GeneratedRecipe,
  InspirationRecipe,
  RecipeCorpusEntry,
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

// ---------------------------------------------------------------------------
// Smart dish name normalization (Option 2: better normalization)
// ---------------------------------------------------------------------------

/** Filler words stripped during normalization — these don't affect dish identity */
const FILLER_WORDS = new Set([
  // Articles & possessives
  "a", "an", "the", "my", "our", "their", "his", "her",
  // Adjectives that don't change the dish
  "homemade", "home-made", "easy", "simple", "quick", "fast",
  "classic", "traditional", "authentic", "best", "perfect",
  "amazing", "delicious", "ultimate", "favorite", "favourite",
  "super", "great", "healthy", "hearty", "fresh", "crispy",
  "creamy", "spicy", "mild", "rich", "light", "loaded",
  "old-fashioned", "old", "fashioned", "grandma's", "grandmas",
  "mom's", "moms", "famous",
  // Style/method qualifiers that aren't core to the dish
  "style", "inspired",
]);

/** Prepositions and connectors normalized away between dish parts */
const CONNECTOR_WORDS = new Set([
  "alla", "al", "a la", "au", "aux", "con", "di", "del", "della",
  "with", "in", "on", "and", "over", "from",
]);

function normalizeDishName(title: string): string {
  let name = title
    .toLowerCase()
    .trim()
    // Normalize unicode quotes and apostrophes
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    // Remove parenthetical notes like "(vegan)" or "(serves 4)"
    .replace(/\([^)]*\)/g, "")
    // Remove possessives: "mom's" → "mom"
    .replace(/'s\b/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();

  // Split into words and filter filler
  const words = name.split(/\s+/).filter((w) => !FILLER_WORDS.has(w));

  // Also remove connector words (but keep them if they're the only words)
  const meaningful = words.filter((w) => !CONNECTOR_WORDS.has(w));

  return (meaningful.length > 0 ? meaningful : words).join(" ");
}

/**
 * Extract the "core" dish keywords from a title.
 * E.g. "Creamy Garlic Spaghetti Carbonara" → ["spaghetti", "carbonara"]
 * E.g. "Pad Thai with Shrimp" → ["pad", "thai", "shrimp"]
 * Used as a last-resort ILIKE search when exact/fuzzy match fails.
 */
function extractCoreKeywords(title: string): string[] {
  const normalized = normalizeDishName(title);
  const words = normalized.split(/\s+/);

  // Additional generic cooking words to skip during keyword extraction
  const GENERIC_WORDS = new Set([
    "recipe", "dish", "meal", "dinner", "lunch", "breakfast",
    "snack", "appetizer", "dessert", "salad", "soup", "stew",
    "baked", "grilled", "fried", "roasted", "sauteed", "steamed",
    "braised", "smoked", "pan", "oven", "slow", "cooker",
    "garlic", "butter", "lemon", "herb", "cheese", "cream",
  ]);

  // Keep words that are likely the dish identity
  const keywords = words.filter(
    (w) => w.length > 2 && !GENERIC_WORDS.has(w) && !CONNECTOR_WORDS.has(w)
  );

  // Return at least something — fall back to all normalized words
  return keywords.length > 0 ? keywords : words;
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

// ---------------------------------------------------------------------------
// Corpus-first recipe serving — Tiered fuzzy search
// ---------------------------------------------------------------------------
//
// Search tiers (tried in order, first match wins):
//   1. EXACT  — normalized dish name equals corpus normalized name
//   2. ILIKE  — corpus name contains the search term or vice versa
//   3. TRIGRAM — pg_trgm similarity() ≥ 0.3 (handles typos, rewordings)
//   4. KEYWORD — extract core dish words and ILIKE search for each
//
// All tiers respect dietary exclusions and increment timesServed.
// ---------------------------------------------------------------------------

/** Minimum pg_trgm similarity score to consider a fuzzy match */
const TRIGRAM_THRESHOLD = 0.3;

type CorpusRow = typeof recipeCorpus.$inferSelect;

/**
 * Check if any food exclusions conflict with the cached recipe's ingredients.
 * Returns true if the recipe is safe (no conflicts).
 */
function isRecipeSafeForExclusions(
  recipeIngredients: Ingredient[],
  userExclusions: string[]
): boolean {
  if (!userExclusions || userExclusions.length === 0) return true;
  if (!recipeIngredients || recipeIngredients.length === 0) return true;

  const exclusionSet = new Set(userExclusions.map((e) => e.toLowerCase()));
  for (const ingredient of recipeIngredients) {
    const name = ingredient.name.toLowerCase();
    for (const exclusion of exclusionSet) {
      if (name.includes(exclusion) || exclusion.includes(name)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Tiered corpus search — the heart of the fuzzy matching system.
 * Runs through 4 search strategies and returns the first batch of candidates.
 * Callers filter candidates for their specific needs (full recipe vs ingredients).
 */
async function tieredCorpusSearch(
  dishName: string,
  extraConditions?: ReturnType<typeof and>,
  limit = 10
): Promise<CorpusRow[]> {
  const normalized = normalizeDishName(dishName);
  const orderClause = sql`${recipeCorpus.qualityScore} DESC, ${recipeCorpus.timesServed} ASC`;

  // --- Tier 1: Exact match on normalized name ---
  const exact = await db
    .select()
    .from(recipeCorpus)
    .where(
      extraConditions
        ? and(eq(recipeCorpus.dishNameNormalized, normalized), extraConditions)
        : eq(recipeCorpus.dishNameNormalized, normalized)
    )
    .orderBy(orderClause)
    .limit(limit);

  if (exact.length > 0) return exact;

  // --- Tier 2: ILIKE containment (corpus contains search or search contains corpus) ---
  const ilikePattern = `%${normalized}%`;
  const ilikeCandidates = await db
    .select()
    .from(recipeCorpus)
    .where(
      extraConditions
        ? and(
            or(
              ilike(recipeCorpus.dishNameNormalized, ilikePattern),
              ilike(recipeCorpus.title, ilikePattern),
              // Also check if the corpus name is contained IN our search
              sql`${normalized} ILIKE '%' || ${recipeCorpus.dishNameNormalized} || '%'`
            ),
            extraConditions
          )
        : or(
            ilike(recipeCorpus.dishNameNormalized, ilikePattern),
            ilike(recipeCorpus.title, ilikePattern),
            sql`${normalized} ILIKE '%' || ${recipeCorpus.dishNameNormalized} || '%'`
          )
    )
    .orderBy(orderClause)
    .limit(limit);

  if (ilikeCandidates.length > 0) return ilikeCandidates;

  // --- Tier 3: pg_trgm trigram similarity (handles typos, rewordings) ---
  const trigramCandidates = await db
    .select()
    .from(recipeCorpus)
    .where(
      extraConditions
        ? and(
            sql`similarity(${recipeCorpus.dishNameNormalized}, ${normalized}) >= ${TRIGRAM_THRESHOLD}`,
            extraConditions
          )
        : sql`similarity(${recipeCorpus.dishNameNormalized}, ${normalized}) >= ${TRIGRAM_THRESHOLD}`
    )
    .orderBy(sql`similarity(${recipeCorpus.dishNameNormalized}, ${normalized}) DESC`)
    .limit(limit);

  if (trigramCandidates.length > 0) return trigramCandidates;

  // --- Tier 4: Core keyword fallback ---
  const keywords = extractCoreKeywords(dishName);
  if (keywords.length === 0) return [];

  // Build an OR condition: corpus name or title ILIKE any keyword
  const keywordConditions = keywords.map((kw) =>
    or(
      ilike(recipeCorpus.dishNameNormalized, `%${kw}%`),
      ilike(recipeCorpus.title, `%${kw}%`)
    )
  );

  const keywordCandidates = await db
    .select()
    .from(recipeCorpus)
    .where(
      extraConditions
        ? and(or(...keywordConditions), extraConditions)
        : or(...keywordConditions)
    )
    .orderBy(orderClause)
    .limit(limit);

  return keywordCandidates;
}

/**
 * Increment the timesServed counter for a corpus entry.
 */
async function incrementTimesServed(id: string): Promise<void> {
  await db
    .update(recipeCorpus)
    .set({ timesServed: sql`${recipeCorpus.timesServed} + 1` })
    .where(eq(recipeCorpus.id, id));
}

/**
 * Look up a full recipe (ingredients + steps) from the corpus.
 * Used for generateRecipe() — tiered fuzzy match by dish name.
 * Only returns recipes that have both ingredients and steps.
 */
export async function getCorpusRecipe(
  dishName: string,
  servings?: number,
  dietary?: {
    dietaryPreferences?: string[] | null;
    foodExclusions?: string[] | null;
  }
): Promise<GeneratedRecipe | null> {
  try {
    const candidates = await tieredCorpusSearch(
      dishName,
      not(eq(recipeCorpus.source, "ingredient_only"))
    );

    if (candidates.length === 0) return null;

    const userExclusions = dietary?.foodExclusions ?? [];
    const compatible = candidates.find((c) => {
      if (!c.ingredients || !c.steps) return false;
      if ((c.ingredients as Ingredient[]).length === 0) return false;
      if ((c.steps as RecipeStep[]).length === 0) return false;
      return isRecipeSafeForExclusions(
        c.ingredients as Ingredient[],
        userExclusions
      );
    });

    if (!compatible) return null;

    await incrementTimesServed(compatible.id);

    return {
      ingredients: compatible.ingredients as Ingredient[],
      steps: compatible.steps as RecipeStep[],
    };
  } catch (error) {
    console.error("Corpus recipe lookup failed:", error);
    return null;
  }
}

/**
 * Look up an ingredient list from the corpus.
 * Used for generateIngredients() — tiered fuzzy match by dish name.
 */
export async function getCorpusIngredients(
  dishName: string,
  servings?: number,
  dietary?: {
    dietaryPreferences?: string[] | null;
    foodExclusions?: string[] | null;
  }
): Promise<Ingredient[] | null> {
  try {
    const candidates = await tieredCorpusSearch(dishName);

    if (candidates.length === 0) return null;

    const userExclusions = dietary?.foodExclusions ?? [];
    const compatible = candidates.find((c) => {
      if (!c.ingredients) return false;
      if ((c.ingredients as Ingredient[]).length === 0) return false;
      return isRecipeSafeForExclusions(
        c.ingredients as Ingredient[],
        userExclusions
      );
    });

    if (!compatible) return null;

    await incrementTimesServed(compatible.id);

    return compatible.ingredients as Ingredient[];
  } catch (error) {
    console.error("Corpus ingredient lookup failed:", error);
    return null;
  }
}

/**
 * Look up an inspiration recipe from the corpus.
 * Used for generateInspiration() — tiered fuzzy match when the user
 * requests a specific dish by name. Free-form ingredient lists skip this.
 */
export async function getCorpusInspirationRecipe(
  dishNameOrIngredients: string,
  servings: number,
  dietary?: {
    dietaryPreferences?: string[] | null;
    foodExclusions?: string[] | null;
  }
): Promise<InspirationRecipe | null> {
  try {
    const normalized = normalizeDishName(dishNameOrIngredients);

    // Only match if the input looks like a dish name (short, no commas)
    // Free-form ingredient lists should always go to AI
    const looksLikeDishName =
      normalized.length < 60 &&
      !normalized.includes(",") &&
      normalized.split(/\s+/).length <= 6;

    if (!looksLikeDishName) return null;

    const candidates = await tieredCorpusSearch(
      dishNameOrIngredients,
      eq(recipeCorpus.source, "inspiration")
    );

    if (candidates.length === 0) return null;

    const userExclusions = dietary?.foodExclusions ?? [];
    const compatible = candidates.find((c) => {
      if (!c.inspirationMetadata) return false;
      const meta = c.inspirationMetadata as InspirationRecipe;
      if (!meta.ingredients || meta.ingredients.length === 0) return false;
      if (!meta.steps || meta.steps.length === 0) return false;
      return isRecipeSafeForExclusions(
        meta.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        userExclusions
      );
    });

    if (!compatible) return null;

    await incrementTimesServed(compatible.id);

    return compatible.inspirationMetadata as InspirationRecipe;
  } catch (error) {
    console.error("Corpus inspiration recipe lookup failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Corpus analytics — track hit rates
// ---------------------------------------------------------------------------

export async function trackCorpusEvent(params: {
  endpoint: string;
  servedFrom: "corpus" | "api";
  dishNameNormalized?: string;
  userId?: string;
}): Promise<void> {
  try {
    await db.insert(corpusAnalytics).values({
      endpoint: params.endpoint,
      servedFrom: params.servedFrom,
      dishNameNormalized: params.dishNameNormalized ?? null,
      userId: params.userId ?? null,
    });
  } catch (error) {
    console.error("Corpus analytics tracking failed (non-blocking):", error);
  }
}
