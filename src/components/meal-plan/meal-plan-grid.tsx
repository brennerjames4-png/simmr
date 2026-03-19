"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MealSlotCard } from "./meal-plan-card";
import { DailyNutritionSummary } from "./daily-nutrition-summary";
import { deleteMealPlan, regenerateUnlockedSlots } from "@/actions/meal-plan";
import { toast } from "sonner";
import { Trash2, RefreshCw, Loader2, Users } from "lucide-react";
import type { MealPlan } from "@/lib/db/schema";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function MealPlanGrid({
  plan,
  onDelete,
  onPlanUpdated,
}: {
  plan: MealPlan;
  onDelete: (id: string) => void;
  onPlanUpdated?: (plan: MealPlan) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [isRegenerating, startRegenTransition] = useTransition();

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMealPlan(plan.id);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      onDelete(plan.id);
      toast.success("Meal plan deleted.");
    }
  }

  function handleRegenerateUnlocked() {
    startRegenTransition(async () => {
      const result = await regenerateUnlockedSlots({ planId: plan.id });
      if (result.error) {
        toast.error(result.error);
      } else if (result.updatedPlan) {
        onPlanUpdated?.(result.updatedPlan);
        toast.success("Unlocked meals regenerated!");
      }
    });
  }

  const totalMeals = plan.days.reduce(
    (sum, d) => sum + (d.meals?.length ?? 0),
    0
  );
  const lockedCount = plan.days.reduce(
    (sum, d) => sum + (d.meals?.filter((s) => s.locked).length ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Week of {format(new Date(plan.weekStart), "MMM d, yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{totalMeals} meals planned</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Household of {plan.householdSize}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateUnlocked}
            disabled={isRegenerating}
            className="text-muted-foreground"
          >
            {isRegenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Regenerate{lockedCount > 0 ? " Unlocked" : ""}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {plan.days.map((day) => {
          const meals = day.meals ?? [];
          if (meals.length === 0) return null;

          return (
            <div key={day.day} className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <h3 className="text-sm font-semibold">
                  {DAY_LABELS[day.day] ?? day.day}
                </h3>
              </div>
              {meals.map((slot) => (
                <MealSlotCard
                  key={`${day.day}-${slot.mealType}`}
                  slot={slot}
                  planId={plan.id}
                  day={day.day}
                  householdSize={plan.householdSize}
                  onPlanUpdated={onPlanUpdated}
                />
              ))}
              <DailyNutritionSummary meals={meals} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
