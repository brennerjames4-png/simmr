"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";
import { addPantryItem, deletePantryItem, updatePantryItem } from "@/actions/pantry";
import { toast } from "sonner";
import type { PantryItem } from "@/lib/db/schema";

const CATEGORIES = [
  { value: "produce", label: "Produce" },
  { value: "protein", label: "Protein" },
  { value: "dairy", label: "Dairy & Eggs" },
  { value: "pantry", label: "Pantry" },
  { value: "spices", label: "Spices" },
  { value: "other", label: "Other" },
];

export function PantryClient({
  initialItems,
}: {
  initialItems: PantryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("pantry");
  const [isStaple, setIsStaple] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await addPantryItem({
        name: name.trim(),
        quantity: quantity.trim() || undefined,
        unit: unit.trim() || undefined,
        category,
        isStaple,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.item) {
        setItems((prev) => [...prev, result.item!]);
        setName("");
        setQuantity("");
        setUnit("");
        toast.success("Item added!");
      }
    });
  }

  async function handleDelete(id: string) {
    const result = await deletePantryItem(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item removed.");
    }
  }

  async function handleToggleStaple(id: string, isStaple: boolean) {
    const result = await updatePantryItem({ id, isStaple });
    if (result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isStaple } : i))
      );
    }
  }

  // Group by category
  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Add Item</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <Label htmlFor="pantry-name" className="text-xs">Name</Label>
            <Input
              id="pantry-name"
              placeholder="e.g., Olive oil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
          <div>
            <Label htmlFor="pantry-qty" className="text-xs">Qty</Label>
            <Input
              id="pantry-qty"
              placeholder="2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pantry-unit" className="text-xs">Unit</Label>
            <Input
              id="pantry-unit"
              placeholder="cups"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={isStaple}
              onCheckedChange={(checked) => setIsStaple(checked === true)}
            />
            Staple (always in stock)
          </label>
          <Button onClick={handleAdd} disabled={isPending || !name.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Your pantry is empty. Add items to get smarter shopping lists.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const catItems = grouped[cat.value];
            if (!catItems || catItems.length === 0) return null;

            return (
              <div key={cat.value}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {cat.label}
                </h4>
                <div className="space-y-1">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.name}</span>
                        {item.quantity && (
                          <span className="text-xs text-muted-foreground">
                            {item.quantity} {item.unit}
                          </span>
                        )}
                        {item.isStaple && (
                          <Badge variant="secondary" className="text-xs">
                            staple
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <Checkbox
                            checked={item.isStaple}
                            onCheckedChange={(checked) =>
                              handleToggleStaple(item.id, checked === true)
                            }
                          />
                          Staple
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
