import { requireAuth } from "@/lib/auth";
import { getPantryItems } from "@/actions/pantry";
import { PantryClient } from "@/components/pantry/pantry-client";

export const metadata = {
  title: "Pantry",
};

export default async function PantryPage() {
  const user = await requireAuth();
  const items = await getPantryItems();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pantry</h1>
        <p className="text-muted-foreground mt-1">
          Track what you have on hand. Staples are automatically excluded from
          shopping lists.
        </p>
      </div>

      <PantryClient initialItems={items} />
    </div>
  );
}
