"use client";

import { useState } from "react";
import type { MealPlan } from "@/lib/db/schema";
import { GeneratePlanForm } from "./generate-plan-form";
import { MealPlanGrid } from "./meal-plan-grid";
import { MealPlanHistory } from "./meal-plan-history";
import { CalendarDays } from "lucide-react";

export function MealPlannerClient({
  initialPlans,
}: {
  initialPlans: MealPlan[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const currentPlan = plans[0] ?? null;
  const historyPlans = plans.slice(1);

  function handlePlanGenerated(plan: MealPlan) {
    setPlans((prev) => [plan, ...prev]);
  }

  function handlePlanDeleted(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  return (
    <div className="space-y-8">
      <GeneratePlanForm onPlanGenerated={handlePlanGenerated} />

      {currentPlan ? (
        <MealPlanGrid plan={currentPlan} onDelete={handlePlanDeleted} />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No meal plan yet</h2>
          <p className="text-muted-foreground mt-1">
            Generate your first weekly meal plan above.
          </p>
        </div>
      )}

      {historyPlans.length > 0 && (
        <MealPlanHistory plans={historyPlans} onDelete={handlePlanDeleted} />
      )}
    </div>
  );
}
