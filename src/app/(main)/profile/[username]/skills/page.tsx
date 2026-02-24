import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getUserSkills } from "@/queries/skills";
import { canViewUserContent } from "@/queries/follows";
import { SkillsDisplay } from "@/components/profile/skills-display";
import { ArrowLeft, Lock } from "lucide-react";

export const metadata = {
  title: "Cooking Skills",
};

export default async function SkillsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  const isOwner = currentUser.id === profile.id;
  const canView = await canViewUserContent(currentUser.id, profile.id);

  if (!canView) {
    return (
      <div className="space-y-6">
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">This account is private</p>
          <p className="text-sm text-muted-foreground mt-1">
            Follow this user to see their skills.
          </p>
        </div>
      </div>
    );
  }

  const userSkills = await getUserSkills(profile.id);

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
        <h1 className="text-2xl font-bold">
          {isOwner ? "My Cooking Skills" : `${profile.displayName}'s Skills`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isOwner
            ? "Skills earned by publishing recipes. Cook more to unlock new skills!"
            : `Cooking techniques ${profile.displayName} has demonstrated.`}
        </p>
      </div>

      <SkillsDisplay skills={userSkills} isOwner={isOwner} />
    </div>
  );
}
