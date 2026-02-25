"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleShoppingListItem, deleteShoppingList } from "@/actions/shopping-list";
import { toast } from "sonner";
import type { ShoppingList, ShoppingListItem } from "@/lib/db/schema";

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy & Eggs",
  pantry: "Pantry",
  spices: "Spices & Seasonings",
  other: "Other",
};

export function ShoppingListCard({
  list: initialList,
  onDeleted,
}: {
  list: ShoppingList;
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialList.items);

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;

  // Group by category
  const grouped = new Map<string, Array<{ item: ShoppingListItem; index: number }>>();
  items.forEach((item, index) => {
    const cat = item.category || "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push({ item, index });
  });

  async function handleToggle(index: number) {
    // Optimistic update
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );

    const result = await toggleShoppingListItem(initialList.id, index);
    if (result.error) {
      // Revert
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, checked: !item.checked } : item
        )
      );
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    const result = await deleteShoppingList(initialList.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      onDeleted(initialList.id);
      toast.success("Shopping list deleted.");
    }
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <h3 className="font-semibold">{initialList.name}</h3>
          <p className="text-sm text-muted-foreground">
            {checkedCount} of {totalCount} items checked
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : "0%",
          }}
        />
      </div>

      <div className="p-4 space-y-4">
        {Array.from(grouped.entries()).map(([category, categoryItems]) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[category] ?? category}
            </h4>
            <div className="space-y-1">
              {categoryItems.map(({ item, index }) => (
                <label
                  key={index}
                  className="flex items-center gap-3 py-1.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggle(index)}
                    className="h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-primary"
                  />
                  <span
                    className={`text-sm flex-1 ${
                      item.checked
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {item.quantity} {item.unit} {item.name}
                  </span>
                  {item.sourceRecipes.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {item.sourceRecipes.length} recipes
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
