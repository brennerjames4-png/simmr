"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShoppingListCard } from "./shopping-list-card";
import { createShoppingListFromMealPlan } from "@/actions/shopping-list";
import { toast } from "sonner";
import type { ShoppingList } from "@/lib/db/schema";

export function ShoppingClient({
  initialLists,
  currentMealPlanId,
}: {
  initialLists: ShoppingList[];
  currentMealPlanId: string | null;
}) {
  const [lists, setLists] = useState(initialLists);
  const [isCreating, startCreating] = useTransition();

  function handleCreateFromPlan() {
    if (!currentMealPlanId) return;
    startCreating(async () => {
      const result = await createShoppingListFromMealPlan(currentMealPlanId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.list) {
        setLists((prev) => [result.list!, ...prev]);
        toast.success("Shopping list created from meal plan!");
      }
    });
  }

  function handleDeleted(listId: string) {
    setLists((prev) => prev.filter((l) => l.id !== listId));
  }

  return (
    <div className="space-y-6">
      {currentMealPlanId && (
        <Button
          variant="outline"
          onClick={handleCreateFromPlan}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create from Meal Plan
        </Button>
      )}

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No shopping lists</h2>
          <p className="text-muted-foreground mt-1">
            {currentMealPlanId
              ? "Create a shopping list from your meal plan above."
              : "Generate a meal plan first, then create a shopping list from it."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {lists.map((list) => (
            <ShoppingListCard
              key={list.id}
              list={list}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
