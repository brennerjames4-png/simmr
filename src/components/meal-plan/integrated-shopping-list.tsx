"use client";

import { useMemo, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { toggleShoppingItem } from "@/actions/meal-plan";
import { aggregateIngredientsWithScaling, normalizeIngredientName } from "@/lib/shopping-list";
import type { MealPlan } from "@/lib/db/schema";

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy & Eggs",
  pantry: "Pantry",
  spices: "Spices & Seasonings",
  other: "Other",
};

const CATEGORY_ORDER = ["produce", "protein", "dairy", "pantry", "spices", "other"];

export function IntegratedShoppingList({
  plan,
  onCheckedChange,
}: {
  plan: MealPlan;
  onCheckedChange?: () => void;
}) {
  const [, startTransition] = useTransition();

  const shoppingItems = useMemo(() => {
    const recipes = plan.days.flatMap((day) =>
      (day.meals ?? [])
        .filter((slot) => slot.source !== "leftover")
        .map((slot) => ({
          title: slot.recipe.title,
          ingredients: slot.recipe.ingredients,
          cookServings: slot.cookServings,
          recipeServings: slot.recipe.servings,
        }))
    );
    return aggregateIngredientsWithScaling(recipes);
  }, [plan]);

  const checkedItems = plan.shoppingCheckedItems ?? {};

  const grouped = useMemo(() => {
    const groups: Record<string, typeof shoppingItems> = {};
    for (const item of shoppingItems) {
      const cat = item.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [shoppingItems]);

  function handleToggle(itemName: string, checked: boolean) {
    const normalized = normalizeIngredientName(itemName);
    startTransition(async () => {
      await toggleShoppingItem({
        planId: plan.id,
        normalizedItemName: normalized,
        checked,
      });
      onCheckedChange?.();
    });
  }

  const totalItems = shoppingItems.length;
  const checkedCount = shoppingItems.filter(
    (item) => checkedItems[normalizeIngredientName(item.name)]
  ).length;

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ShoppingCart className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No ingredients to shop for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {checkedCount} of {totalItems} items checked
        </p>
        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(checkedCount / totalItems) * 100}%` }}
          />
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;

        return (
          <div key={cat}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </h4>
            <div className="space-y-1">
              {items.map((item) => {
                const normalized = normalizeIngredientName(item.name);
                const isChecked = !!checkedItems[normalized];

                return (
                  <label
                    key={normalized}
                    className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer transition-colors ${
                      isChecked ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleToggle(item.name, checked === true)
                      }
                    />
                    <span
                      className={`text-sm flex-1 ${
                        isChecked ? "line-through" : ""
                      }`}
                    >
                      {item.quantity} {item.unit} {item.name}
                    </span>
                    {item.sourceRecipes.length > 1 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {item.sourceRecipes.length} recipes
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
