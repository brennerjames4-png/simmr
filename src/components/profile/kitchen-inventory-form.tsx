"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateKitchenInventory } from "@/actions/kitchen";
import type { KitchenInventory } from "@/lib/db/schema";
import {
  defaultKitchenInventory,
  kitchenLabels,
  categoryLabels,
} from "@/lib/kitchen-defaults";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  initialInventory: KitchenInventory | null;
}

export function KitchenInventoryForm({ initialInventory }: Props) {
  const [inventory, setInventory] = useState<KitchenInventory>(
    initialInventory ?? defaultKitchenInventory
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function updateNumber(
    category: string,
    key: string,
    value: number
  ) {
    setInventory((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category as keyof KitchenInventory] as Record<string, unknown>),
        [key]: Math.max(0, value),
      },
    }));
    setSaved(false);
  }

  function updateBoolean(category: string, key: string, value: boolean) {
    setInventory((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category as keyof KitchenInventory] as Record<string, unknown>),
        [key]: value,
      },
    }));
    setSaved(false);
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

  const categories = Object.keys(categoryLabels) as Array<keyof KitchenInventory>;

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const items = inventory[category] as Record<string, number | boolean>;
        const labels = kitchenLabels[category];

        return (
          <Card key={category} className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {categoryLabels[category]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {Object.entries(items).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground shrink-0">
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
                      <div className="flex items-center gap-1">
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
