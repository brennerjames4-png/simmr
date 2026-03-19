"use client";

import { useState } from "react";
import type { MealPlan } from "@/lib/db/schema";
import { GeneratePlanForm } from "./generate-plan-form";
import { MealPlanGrid } from "./meal-plan-grid";
import { MealPlanHistory } from "./meal-plan-history";
import { IntegratedShoppingList } from "./integrated-shopping-list";
import { BatchCookingPanel } from "./batch-cooking-panel";
import { WeeklyNutritionSummary } from "./weekly-nutrition-summary";
import { CalendarDays, ShoppingCart, ChefHat } from "lucide-react";

type Tab = "plan" | "shopping" | "mealprep";

export function MealPlannerClient({
  initialPlans,
  defaultHouseholdSize = 2,
  defaultServingsPerMeal,
  defaultMealTypes = ["dinner"],
  defaultMealPrepEnabled = false,
}: {
  initialPlans: MealPlan[];
  defaultHouseholdSize?: number;
  defaultServingsPerMeal?: number;
  defaultMealTypes?: string[];
  defaultMealPrepEnabled?: boolean;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const currentPlan = plans[0] ?? null;
  const historyPlans = plans.slice(1);

  function handlePlanGenerated(plan: MealPlan) {
    setPlans((prev) => [plan, ...prev]);
    setActiveTab("plan");
  }

  function handlePlanDeleted(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  function handlePlanUpdated(updatedPlan: MealPlan) {
    setPlans((prev) =>
      prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "plan", label: "Plan", icon: <CalendarDays className="h-4 w-4" /> },
    { id: "shopping", label: "Shopping", icon: <ShoppingCart className="h-4 w-4" /> },
    { id: "mealprep", label: "Meal Prep", icon: <ChefHat className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <GeneratePlanForm
        onPlanGenerated={handlePlanGenerated}
        defaultHouseholdSize={defaultHouseholdSize}
        defaultServingsPerMeal={defaultServingsPerMeal}
        defaultMealTypes={defaultMealTypes}
        defaultMealPrepEnabled={defaultMealPrepEnabled}
      />

      {currentPlan ? (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "plan" && (
            <div className="space-y-4">
              <WeeklyNutritionSummary days={currentPlan.days} />
              <MealPlanGrid
                plan={currentPlan}
                onDelete={handlePlanDeleted}
                onPlanUpdated={handlePlanUpdated}
              />
            </div>
          )}

          {activeTab === "shopping" && (
            <IntegratedShoppingList plan={currentPlan} />
          )}

          {activeTab === "mealprep" && (
            <BatchCookingPanel plan={currentPlan} />
          )}
        </>
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
