import type { Ingredient, ShoppingListItem } from "@/lib/db/schema";

// Simple keyword-based ingredient categorizer
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: [
    "lettuce", "tomato", "onion", "garlic", "potato", "carrot", "celery",
    "pepper", "broccoli", "spinach", "kale", "cabbage", "mushroom", "zucchini",
    "squash", "corn", "pea", "bean", "cucumber", "avocado", "lemon", "lime",
    "orange", "apple", "banana", "berry", "mango", "ginger", "cilantro",
    "parsley", "basil", "mint", "thyme", "rosemary", "scallion", "shallot",
    "leek", "asparagus", "eggplant", "beet", "radish", "turnip",
  ],
  protein: [
    "chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna",
    "shrimp", "tofu", "tempeh", "sausage", "bacon", "ham", "steak",
    "ground", "thigh", "breast", "drumstick", "wing", "fillet", "crab",
    "lobster", "clam", "mussel", "scallop", "anchovy",
  ],
  dairy: [
    "milk", "cream", "cheese", "butter", "yogurt", "sour cream", "egg",
    "mozzarella", "parmesan", "cheddar", "feta", "ricotta", "whipping",
    "half and half", "ghee",
  ],
  pantry: [
    "flour", "sugar", "rice", "pasta", "noodle", "bread", "tortilla",
    "oil", "vinegar", "soy sauce", "broth", "stock", "tomato sauce",
    "tomato paste", "coconut milk", "can", "dried", "lentil", "chickpea",
    "oat", "cereal", "honey", "maple", "peanut butter", "jam",
    "baking powder", "baking soda", "yeast", "cornstarch",
  ],
  spices: [
    "salt", "pepper", "cumin", "paprika", "cinnamon", "turmeric", "oregano",
    "chili", "cayenne", "nutmeg", "coriander", "cardamom", "clove",
    "bay leaf", "saffron", "curry", "garam masala", "thyme", "rosemary",
    "basil", "dill", "fennel", "allspice", "vanilla",
  ],
};

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  return "other";
}

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Basic singularization
    .replace(/ies$/, "y")
    .replace(/ves$/, "f")
    .replace(/oes$/, "o")
    .replace(/ses$/, "s")
    .replace(/([^s])s$/, "$1");
}

function parseQuantity(qty: string): number | null {
  // Handle fractions like "1/2", "1 1/2"
  const cleaned = qty.trim();
  if (!cleaned) return null;

  // Mixed number: "1 1/2"
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
  }

  // Fraction: "1/2"
  const fracMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return Number(fracMatch[1]) / Number(fracMatch[2]);
  }

  // Plain number
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatQuantity(num: number): string {
  if (Number.isInteger(num)) return num.toString();

  // Common fractions
  const fractions: Record<string, number> = {
    "1/4": 0.25,
    "1/3": 0.333,
    "1/2": 0.5,
    "2/3": 0.667,
    "3/4": 0.75,
  };

  const whole = Math.floor(num);
  const frac = num - whole;

  for (const [label, value] of Object.entries(fractions)) {
    if (Math.abs(frac - value) < 0.05) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }

  return num.toFixed(1);
}

export function aggregateIngredients(
  recipes: Array<{ title: string; ingredients: Ingredient[] }>
): ShoppingListItem[] {
  const grouped = new Map<
    string,
    {
      name: string;
      quantities: Array<{ quantity: string; unit: string }>;
      sourceRecipes: Set<string>;
      category: string;
    }
  >();

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const normalized = normalizeIngredientName(ingredient.name);
      const existing = grouped.get(normalized);

      if (existing) {
        existing.quantities.push({
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
        existing.sourceRecipes.add(recipe.title);
      } else {
        grouped.set(normalized, {
          name: ingredient.name, // Keep original casing for display
          quantities: [
            { quantity: ingredient.quantity, unit: ingredient.unit },
          ],
          sourceRecipes: new Set([recipe.title]),
          category: categorizeIngredient(ingredient.name),
        });
      }
    }
  }

  const items: ShoppingListItem[] = [];

  for (const [, group] of grouped) {
    // Try to sum quantities when units match
    const unitGroups = new Map<string, number>();

    for (const { quantity, unit } of group.quantities) {
      const normalizedUnit = unit.toLowerCase().trim();
      const parsed = parseQuantity(quantity);

      if (parsed !== null && normalizedUnit) {
        unitGroups.set(
          normalizedUnit,
          (unitGroups.get(normalizedUnit) ?? 0) + parsed
        );
      } else {
        // Can't parse — just keep as-is
        unitGroups.set(
          `${quantity} ${unit}`.trim(),
          (unitGroups.get(`${quantity} ${unit}`.trim()) ?? 0) + 1
        );
      }
    }

    // Build the final quantity string
    let finalQuantity: string;
    let finalUnit: string;

    if (unitGroups.size === 1) {
      const [unit, total] = [...unitGroups.entries()][0];
      finalQuantity = formatQuantity(total);
      finalUnit = unit;
    } else {
      // Multiple units — combine into a description
      const parts: string[] = [];
      for (const [unit, total] of unitGroups) {
        parts.push(`${formatQuantity(total)} ${unit}`);
      }
      finalQuantity = parts.join(" + ");
      finalUnit = "";
    }

    items.push({
      name: group.name,
      quantity: finalQuantity,
      unit: finalUnit,
      category: group.category,
      checked: false,
      sourceRecipes: Array.from(group.sourceRecipes),
    });
  }

  // Sort by category then name
  const categoryOrder = ["produce", "protein", "dairy", "pantry", "spices", "other"];
  items.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  return items;
}
