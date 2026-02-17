import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { KitchenInventoryForm } from "@/components/profile/kitchen-inventory-form";
import { ArrowLeft } from "lucide-react";
import type { KitchenInventory } from "@/lib/db/schema";

export const metadata = {
  title: "My Kitchen",
};

export default async function KitchenPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  // Only the owner can edit their kitchen
  const isOwner = currentUser.id === profile.id;
  if (!isOwner) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">My Kitchen</h1>
        <p className="text-muted-foreground mt-1">
          Tell us what equipment you have. This helps us recommend dishes you can
          actually make.
        </p>
      </div>

      <KitchenInventoryForm
        initialInventory={profile.kitchenInventory as KitchenInventory | null}
      />
    </div>
  );
}
