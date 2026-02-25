"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MealPlanCard } from "./meal-plan-card";
import { deleteMealPlan } from "@/actions/meal-plan";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
}: {
  plan: MealPlan;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Week of {format(new Date(plan.weekStart), "MMM d, yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {plan.days.length} meals planned
          </p>
        </div>
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

      <div className="grid gap-3">
        {plan.days.map((day) => (
          <MealPlanCard
            key={day.day}
            dayLabel={DAY_LABELS[day.day] ?? day.day}
            day={day}
          />
        ))}
      </div>
    </div>
  );
}
