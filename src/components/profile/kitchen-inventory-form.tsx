"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateKitchenInventory } from "@/actions/kitchen";
import type { KitchenInventory } from "@/lib/db/schema";
import {
  defaultKitchenInventory,
  kitchenLabels,
  categoryLabels,
  buildLabelLookup,
} from "@/lib/kitchen-defaults";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  initialInventory: KitchenInventory | null;
}

export function KitchenInventoryForm({ initialInventory }: Props) {
  const [inventory, setInventory] = useState<KitchenInventory>(() => {
    const base = initialInventory ?? defaultKitchenInventory;
    // Ensure customEquipment exists for older inventory data
    return { ...base, customEquipment: base.customEquipment ?? [] };
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [customInput, setCustomInput] = useState("");

  function updateNumber(category: string, key: string, value: number) {
    setInventory((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category as keyof KitchenInventory] as Record<
          string,
          unknown
        >),
        [key]: Math.max(0, value),
      },
    }));
    setSaved(false);
  }

  function updateBoolean(category: string, key: string, value: boolean) {
    setInventory((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category as keyof KitchenInventory] as Record<
          string,
          unknown
        >),
        [key]: value,
      },
    }));
    setSaved(false);
  }

  function addCustomItem() {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Check if the item matches an existing pre-made item
    const lookup = buildLabelLookup();
    const match = lookup.get(trimmed.toLowerCase());

    if (match) {
      // Item exists in pre-made list — toggle/increment it
      if (match.type === "boolean") {
        updateBoolean(match.category, match.key, true);
      } else {
        const currentValue = (
          inventory[match.category as keyof KitchenInventory] as Record<
            string,
            number
          >
        )[match.key];
        updateNumber(match.category, match.key, currentValue + 1);
      }
      setCustomInput("");
      toast.success(`"${trimmed}" found in ${categoryLabels[match.category]} — toggled on!`);
      return;
    }

    // Check if already in custom list
    const existing = (inventory.customEquipment ?? []).find(
      (item) => item.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setCustomInput("");
      toast.info(`"${trimmed}" is already in your custom equipment.`);
      return;
    }

    // Add as custom equipment
    setInventory((prev) => ({
      ...prev,
      customEquipment: [...(prev.customEquipment ?? []), { name: trimmed, count: 1 }],
    }));
    setCustomInput("");
    setSaved(false);
  }

  function updateCustomCount(index: number, count: number) {
    setInventory((prev) => ({
      ...prev,
      customEquipment: (prev.customEquipment ?? []).map((item, i) =>
        i === index ? { ...item, count: Math.max(1, count) } : item
      ),
    }));
    setSaved(false);
  }

  function removeCustomItem(index: number) {
    setInventory((prev) => ({
      ...prev,
      customEquipment: (prev.customEquipment ?? []).filter((_, i) => i !== index),
    }));
    setSaved(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomItem();
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateKitchenInventory(inventory);
      if (result.success) {
        setSaved(true);
        toast.success("Kitchen inventory saved!");
      }
    });
  }

  const categories = Object.keys(categoryLabels) as Array<
    keyof KitchenInventory
  >;

  const customItems = inventory.customEquipment ?? [];

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const items = inventory[category] as Record<string, number | boolean>;
        const labels = kitchenLabels[category];

        return (
          <Card key={category} className="border-border/50">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle className="text-base">
                {categoryLabels[category]}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2.5">
                {Object.entries(items).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 min-w-0"
                  >
                    <Label className="text-sm text-muted-foreground truncate min-w-0">
                      {labels[key] ?? key}
                    </Label>
                    {typeof value === "boolean" ? (
                      <button
                        type="button"
                        onClick={() => updateBoolean(category, key, !value)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          value ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            value ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateNumber(category, key, value - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-accent transition-colors"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateNumber(category, key, value + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-accent transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Custom Equipment */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="text-base">Other Equipment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add any equipment not listed above.
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-3">
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Sous vide, Crepe pan, Thermomix"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addCustomItem}
              disabled={!customInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {customItems.length > 0 && (
            <div className="space-y-2">
              {customItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCustomCount(index, item.count - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-accent transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {item.count}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCustomCount(index, item.count + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm hover:bg-accent transition-colors"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCustomItem(index)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={isPending || saved}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving...
          </>
        ) : saved ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Saved
          </>
        ) : (
          "Save Kitchen Inventory"
        )}
      </Button>
    </div>
  );
}
