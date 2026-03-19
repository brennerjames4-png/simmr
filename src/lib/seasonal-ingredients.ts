// Seasonal produce availability (US-centric)
// Month numbers: 1 = January, 12 = December

const SEASONAL_DATA: Record<number, { peak: string[]; available: string[] }> = {
  1: {
    peak: ["citrus", "kale", "leeks", "turnips", "parsnips"],
    available: ["beets", "Brussels sprouts", "cabbage", "carrots", "celery root", "collard greens", "grapefruit", "oranges", "sweet potatoes"],
  },
  2: {
    peak: ["citrus", "kale", "leeks", "turnips"],
    available: ["beets", "Brussels sprouts", "cabbage", "carrots", "grapefruit", "oranges", "sweet potatoes"],
  },
  3: {
    peak: ["citrus", "kale", "leeks", "artichokes"],
    available: ["asparagus", "broccoli", "cabbage", "carrots", "mushrooms", "peas", "spinach"],
  },
  4: {
    peak: ["asparagus", "peas", "artichokes", "radishes", "spring onions"],
    available: ["broccoli", "carrots", "lettuce", "mushrooms", "spinach", "strawberries"],
  },
  5: {
    peak: ["asparagus", "strawberries", "peas", "spring onions", "radishes"],
    available: ["artichokes", "cherries", "lettuce", "spinach", "zucchini"],
  },
  6: {
    peak: ["strawberries", "blueberries", "cherries", "corn", "tomatoes", "zucchini"],
    available: ["bell peppers", "cucumbers", "green beans", "peaches", "plums", "watermelon"],
  },
  7: {
    peak: ["tomatoes", "corn", "blueberries", "peaches", "watermelon", "zucchini"],
    available: ["bell peppers", "blackberries", "cucumbers", "eggplant", "figs", "green beans", "okra"],
  },
  8: {
    peak: ["tomatoes", "corn", "peaches", "peppers", "eggplant"],
    available: ["blackberries", "cantaloupe", "cucumbers", "figs", "grapes", "okra", "watermelon", "zucchini"],
  },
  9: {
    peak: ["apples", "grapes", "peppers", "tomatoes", "winter squash"],
    available: ["broccoli", "cauliflower", "eggplant", "figs", "pears", "sweet potatoes"],
  },
  10: {
    peak: ["apples", "pears", "pumpkin", "winter squash", "cranberries"],
    available: ["beets", "broccoli", "Brussels sprouts", "cauliflower", "sweet potatoes", "turnips"],
  },
  11: {
    peak: ["cranberries", "pumpkin", "winter squash", "sweet potatoes"],
    available: ["apples", "beets", "Brussels sprouts", "cabbage", "carrots", "pears", "turnips"],
  },
  12: {
    peak: ["citrus", "cranberries", "winter squash", "sweet potatoes"],
    available: ["beets", "Brussels sprouts", "cabbage", "carrots", "kale", "leeks", "parsnips", "turnips"],
  },
};

export function getSeasonalContext(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 0-indexed to 1-indexed
  const data = SEASONAL_DATA[month];
  if (!data) return "";

  const monthName = date.toLocaleString("en-US", { month: "long" });
  return `It's ${monthName}. In season: ${data.peak.join(", ")}. Also available: ${data.available.join(", ")}. Prefer seasonal produce when it fits the recipe.`;
}

export function isSeasonalIngredient(
  ingredientName: string,
  date: Date = new Date()
): boolean {
  const month = date.getMonth() + 1;
  const data = SEASONAL_DATA[month];
  if (!data) return false;

  const lower = ingredientName.toLowerCase();
  return [...data.peak, ...data.available].some((item) =>
    lower.includes(item.toLowerCase())
  );
}

export function getSeasonalData(month: number) {
  return SEASONAL_DATA[month] ?? { peak: [], available: [] };
}
