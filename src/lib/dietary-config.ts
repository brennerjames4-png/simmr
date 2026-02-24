export type DietaryPreference = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

export const DIETARY_OPTIONS: DietaryPreference[] = [
  { id: "vegan", label: "Vegan", description: "No animal products", icon: "🌱" },
  { id: "vegetarian", label: "Vegetarian", description: "No meat or fish", icon: "🥬" },
  { id: "pescatarian", label: "Pescatarian", description: "No meat, but eats fish", icon: "🐟" },
  { id: "gluten_free", label: "Gluten-Free", description: "No wheat, barley, or rye", icon: "🌾" },
  { id: "dairy_free", label: "Dairy-Free", description: "No milk, cheese, or butter", icon: "🥛" },
  { id: "nut_free", label: "Nut-Free", description: "No tree nuts or peanuts", icon: "🥜" },
  { id: "halal", label: "Halal", description: "Follows Islamic dietary laws", icon: "🍖" },
  { id: "kosher", label: "Kosher", description: "Follows Jewish dietary laws", icon: "✡️" },
  { id: "keto", label: "Keto", description: "Low carb, high fat", icon: "🥑" },
  { id: "paleo", label: "Paleo", description: "No processed foods, grains, or dairy", icon: "🦴" },
  { id: "low_sodium", label: "Low Sodium", description: "Reduced salt intake", icon: "🧂" },
  { id: "shellfish_free", label: "Shellfish-Free", description: "No shrimp, crab, lobster, etc.", icon: "🦐" },
  { id: "egg_free", label: "Egg-Free", description: "No eggs", icon: "🥚" },
  { id: "soy_free", label: "Soy-Free", description: "No soy products", icon: "🫘" },
];

export function getDietaryLabel(id: string): string {
  return DIETARY_OPTIONS.find((d) => d.id === id)?.label ?? id;
}

export function getDietaryIcon(id: string): string {
  return DIETARY_OPTIONS.find((d) => d.id === id)?.icon ?? "🍽️";
}
