import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { DietaryPreferencesForm } from "@/components/profile/dietary-preferences-form";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Dietary Preferences",
};

export default async function DietaryPreferencesPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  // Only the owner can edit their dietary preferences
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
        <h1 className="text-2xl font-bold">Dietary Preferences</h1>
        <p className="text-muted-foreground mt-1">
          Select any dietary restrictions or preferences that apply to you.
          These will be shown on your profile.
        </p>
      </div>

      <DietaryPreferencesForm
        currentPreferences={profile.dietaryPreferences ?? []}
        currentExclusions={profile.foodExclusions ?? []}
      />
    </div>
  );
}
