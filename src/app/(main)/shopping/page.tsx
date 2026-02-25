import { requireAuth } from "@/lib/auth";
import { getShoppingLists } from "@/actions/shopping-list";
import { getMealPlans } from "@/actions/meal-plan";
import { ShoppingClient } from "@/components/shopping/shopping-client";
import { ShoppingCart } from "lucide-react";

export const metadata = {
  title: "Shopping Lists",
};

export default async function ShoppingPage() {
  const user = await requireAuth();
  const [lists, plans] = await Promise.all([
    getShoppingLists(),
    getMealPlans(1),
  ]);

  const currentPlan = plans[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shopping Lists</h1>
        <p className="text-muted-foreground mt-1">
          Aggregated ingredients from your meal plans and recipes.
        </p>
      </div>

      <ShoppingClient
        initialLists={lists}
        currentMealPlanId={currentPlan?.id ?? null}
      />
    </div>
  );
}
