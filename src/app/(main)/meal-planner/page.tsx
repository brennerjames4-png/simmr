import { requireAuth } from "@/lib/auth";
import { getMealPlans } from "@/actions/meal-plan";
import { MealPlannerClient } from "@/components/meal-plan/meal-planner-client";
import { CalendarDays } from "lucide-react";

export const metadata = {
  title: "Meal Planner",
};

export default async function MealPlannerPage() {
  const user = await requireAuth();
  const plans = await getMealPlans(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meal Planner</h1>
        <p className="text-muted-foreground mt-1">
          Generate a weekly meal plan tailored to your kitchen and preferences.
        </p>
      </div>

      <MealPlannerClient initialPlans={plans} />
    </div>
  );
}
