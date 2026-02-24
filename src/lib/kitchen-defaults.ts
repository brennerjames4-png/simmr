import type { KitchenInventory } from "@/lib/db/schema";

export const defaultKitchenInventory: KitchenInventory = {
  pots: { small: 0, medium: 0, large: 0 },
  pans: { small: 0, medium: 0, large: 0 },
  baking: {
    baking_sheet: 0,
    cake_pan: 0,
    muffin_tin: 0,
    loaf_pan: 0,
    pie_dish: 0,
  },
  appliances: {
    oven: false,
    microwave: false,
    toaster: false,
    blender: false,
    food_processor: false,
    stand_mixer: false,
    slow_cooker: false,
    pressure_cooker: false,
    air_fryer: false,
    grill: false,
  },
  prep_tools: {
    cutting_boards: 0,
    mixing_bowls: false,
    colander: false,
    measuring_cups: false,
    rolling_pin: false,
    whisk: false,
    tongs: false,
    spatula: false,
    ladle: false,
    peeler: false,
    grater: false,
    mortar_and_pestle: false,
  },
  specialty: {
    wok: false,
    dutch_oven: false,
    cast_iron_skillet: false,
    griddle: false,
    steamer: false,
    deep_fryer: false,
  },
  customEquipment: [],
};

// Human-readable labels for all kitchen items
export const kitchenLabels: Record<string, Record<string, string>> = {
  pots: { small: "Small Pot", medium: "Medium Pot", large: "Large Pot" },
  pans: { small: "Small Pan/Skillet", medium: "Medium Pan/Skillet", large: "Large Pan/Skillet" },
  baking: {
    baking_sheet: "Baking Sheet",
    cake_pan: "Cake Pan",
    muffin_tin: "Muffin Tin",
    loaf_pan: "Loaf Pan",
    pie_dish: "Pie Dish",
  },
  appliances: {
    oven: "Oven",
    microwave: "Microwave",
    toaster: "Toaster",
    blender: "Blender",
    food_processor: "Food Processor",
    stand_mixer: "Stand Mixer",
    slow_cooker: "Slow Cooker",
    pressure_cooker: "Pressure Cooker",
    air_fryer: "Air Fryer",
    grill: "Grill",
  },
  prep_tools: {
    cutting_boards: "Cutting Boards",
    mixing_bowls: "Mixing Bowls",
    colander: "Colander",
    measuring_cups: "Measuring Cups",
    rolling_pin: "Rolling Pin",
    whisk: "Whisk",
    tongs: "Tongs",
    spatula: "Spatula",
    ladle: "Ladle",
    peeler: "Peeler",
    grater: "Grater",
    mortar_and_pestle: "Mortar & Pestle",
  },
  specialty: {
    wok: "Wok",
    dutch_oven: "Dutch Oven",
    cast_iron_skillet: "Cast Iron Skillet",
    griddle: "Griddle",
    steamer: "Steamer",
    deep_fryer: "Deep Fryer",
  },
};

/**
 * Build a reverse lookup: lowercase label → { category, key, type }
 * Used to match user-typed custom items against existing pre-made items
 */
export function buildLabelLookup(): Map<
  string,
  { category: string; key: string; type: "boolean" | "number" }
> {
  const lookup = new Map<
    string,
    { category: string; key: string; type: "boolean" | "number" }
  >();

  for (const [category, labels] of Object.entries(kitchenLabels)) {
    const defaults = defaultKitchenInventory[
      category as keyof KitchenInventory
    ] as Record<string, number | boolean>;
    for (const [key, label] of Object.entries(labels)) {
      const type = typeof defaults[key] === "boolean" ? "boolean" : "number";
      lookup.set(label.toLowerCase(), { category, key, type });
    }
  }

  return lookup;
}

export const categoryLabels: Record<string, string> = {
  pots: "Pots",
  pans: "Pans & Skillets",
  baking: "Baking",
  appliances: "Appliances",
  prep_tools: "Prep Tools",
  specialty: "Specialty",
};
