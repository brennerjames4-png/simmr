"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { deleteMealPlan } from "@/actions/meal-plan";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { MealPlan } from "@/lib/db/schema";

export function MealPlanHistory({
  plans,
  onDelete,
}: {
  plans: MealPlan[];
  onDelete: (id: string) => void;
}) {
  async function handleDelete(planId: string) {
    const result = await deleteMealPlan(planId);
    if (result.error) {
      toast.error(result.error);
    } else {
      onDelete(planId);
      toast.success("Meal plan deleted.");
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Previous Plans
      </h3>
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div>
            <p className="text-sm font-medium">
              Week of {format(new Date(plan.weekStart), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.days.length} meals &middot;{" "}
              {format(new Date(plan.createdAt), "MMM d")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(plan.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
