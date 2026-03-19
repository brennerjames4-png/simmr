"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { NutritionGoals } from "@/lib/db/schema";

const PRESETS: { label: string; goals: NutritionGoals }[] = [
  {
    label: "Maintain",
    goals: { dailyCalories: 2000, dailyProtein: 120, dailyCarbs: 250, dailyFat: 65 },
  },
  {
    label: "Cut",
    goals: { dailyCalories: 1600, dailyProtein: 150, dailyCarbs: 150, dailyFat: 55 },
  },
  {
    label: "Bulk",
    goals: { dailyCalories: 2800, dailyProtein: 180, dailyCarbs: 350, dailyFat: 80 },
  },
];

export function NutritionGoalsForm({
  initialGoals,
  onSave,
}: {
  initialGoals: NutritionGoals | null;
  onSave: (goals: NutritionGoals) => Promise<{ success?: boolean; error?: string }>;
}) {
  const [goals, setGoals] = useState<NutritionGoals>(
    initialGoals ?? { dailyCalories: null, dailyProtein: null, dailyCarbs: null, dailyFat: null }
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function applyPreset(preset: NutritionGoals) {
    setGoals(preset);
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await onSave(goals);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSaved(true);
        toast.success("Nutrition goals saved!");
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Nutrition Goals</h3>
        <p className="text-sm text-muted-foreground">
          Set daily targets to guide meal plan generation. All values are
          estimates.
        </p>
      </div>

      <div className="flex gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.goals)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dailyCalories" className="text-xs">
            Daily Calories (kcal)
          </Label>
          <Input
            id="dailyCalories"
            type="number"
            placeholder="2000"
            value={goals.dailyCalories ?? ""}
            onChange={(e) =>
              setGoals({ ...goals, dailyCalories: Number(e.target.value) || null })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dailyProtein" className="text-xs">
            Daily Protein (g)
          </Label>
          <Input
            id="dailyProtein"
            type="number"
            placeholder="120"
            value={goals.dailyProtein ?? ""}
            onChange={(e) =>
              setGoals({ ...goals, dailyProtein: Number(e.target.value) || null })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dailyCarbs" className="text-xs">
            Daily Carbs (g)
          </Label>
          <Input
            id="dailyCarbs"
            type="number"
            placeholder="250"
            value={goals.dailyCarbs ?? ""}
            onChange={(e) =>
              setGoals({ ...goals, dailyCarbs: Number(e.target.value) || null })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dailyFat" className="text-xs">
            Daily Fat (g)
          </Label>
          <Input
            id="dailyFat"
            type="number"
            placeholder="65"
            value={goals.dailyFat ?? ""}
            onChange={(e) =>
              setGoals({ ...goals, dailyFat: Number(e.target.value) || null })
            }
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isPending} size="sm">
        {isPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4 mr-1" />
        ) : null}
        {saved ? "Saved" : "Save Goals"}
      </Button>
    </div>
  );
}
