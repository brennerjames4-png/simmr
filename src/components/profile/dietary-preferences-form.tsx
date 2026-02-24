"use client";

import { useState, useTransition } from "react";
import { updateDietaryPreferences } from "@/actions/user";
import { DIETARY_OPTIONS } from "@/lib/dietary-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DietaryPreferencesFormProps {
  currentPreferences: string[];
  currentExclusions: string[];
}

export function DietaryPreferencesForm({
  currentPreferences,
  currentExclusions,
}: DietaryPreferencesFormProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentPreferences)
  );
  const [exclusions, setExclusions] = useState<string[]>(currentExclusions);
  const [newItem, setNewItem] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function togglePreference(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaved(false);
  }

  function addExclusion() {
    const trimmed = newItem.trim().toLowerCase();
    if (!trimmed) return;
    if (exclusions.includes(trimmed)) {
      setNewItem("");
      return;
    }
    setExclusions((prev) => [...prev, trimmed]);
    setNewItem("");
    setSaved(false);
  }

  function removeExclusion(item: string) {
    setExclusions((prev) => prev.filter((e) => e !== item));
    setSaved(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addExclusion();
    }
  }

  function handleSave() {
    startTransition(async () => {
      await updateDietaryPreferences(Array.from(selected), exclusions);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const preferencesChanged =
    selected.size !== currentPreferences.length ||
    !currentPreferences.every((p) => selected.has(p));

  const exclusionsChanged =
    exclusions.length !== currentExclusions.length ||
    !currentExclusions.every((e, i) => exclusions[i] === e);

  const hasChanges = preferencesChanged || exclusionsChanged;

  return (
    <div className="space-y-6">
      {/* Dietary Preferences Toggle Buttons */}
      <div className="space-y-3">
        <Label className="text-base">Dietary Preferences</Label>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_OPTIONS.map((option) => {
            const isSelected = selected.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => togglePreference(option.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <span className="text-base shrink-0">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{option.label}</span>
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Food Exclusions */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-base">Foods I Don&apos;t Cook With</Label>
          <p className="text-sm text-muted-foreground">
            Add specific ingredients you want to avoid.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. garlic, cilantro, mushrooms"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addExclusion}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {exclusions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {exclusions.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-2.5 pr-1 py-0.5 text-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeExclusion(item)}
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={isPending || !hasChanges}
        className="w-full"
        variant={saved ? "outline" : "default"}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Saved!
          </>
        ) : (
          "Save Preferences"
        )}
      </Button>
    </div>
  );
}
