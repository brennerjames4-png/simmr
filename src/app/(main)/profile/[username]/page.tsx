import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import {
  getUserProfileWithFollowStats,
  getRelationshipState,
  canViewUserContent,
} from "@/queries/follows";
import { getUserPosts } from "@/queries/posts";
import { getUserSkillCount, getUserTotalSkillCount } from "@/queries/skills";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/feed/post-card";
import { FollowButton } from "@/components/follow/follow-button";
import { ProfileStats } from "@/components/profile/profile-stats";
import { Calendar, ChefHat, Flame, Leaf, Lock, Pencil, Settings, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { getDietaryLabel } from "@/lib/dietary-config";
import { getUserBadges } from "@/lib/badges";
import { BADGE_DEFINITIONS, type BadgeType } from "@/lib/badges-config";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserProfileWithFollowStats(username);

  if (!profile) notFound();

  const isOwnProfile = currentUser.id === profile.id;
  const relationship = isOwnProfile
    ? "none" as const
    : await getRelationshipState(currentUser.id, profile.id);
  const canView = await canViewUserContent(currentUser.id, profile.id);

  // Only fetch posts if the viewer can see them
  const posts = canView ? await getUserPosts(username, currentUser.id) : [];
  const [skillCount, totalSkillCount, badges] = canView
    ? await Promise.all([
        getUserSkillCount(profile.id),
        getUserTotalSkillCount(profile.id),
        getUserBadges(profile.id),
      ])
    : [0, 0, []];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {profile.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOwnProfile && (
            <Link
              href={`/profile/${profile.username}/edit`}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold">{profile.displayName}</h1>
            {isOwnProfile && (
              <Link
                href={`/profile/${profile.username}/settings`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
          </div>
          <p className="text-muted-foreground">@{profile.username}</p>
          {profile.isPrivate && (
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Private account</span>
            </div>
          )}
        </div>
        {profile.bio && (
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Follow Button */}
        {!isOwnProfile && (
          <FollowButton
            targetUserId={profile.id}
            relationship={relationship}
            isOwnProfile={false}
          />
        )}

        {/* Profile Stats */}
        <ProfileStats
          username={profile.username}
          postCount={profile.postCount}
          totalLikes={profile.totalLikes}
          followerCount={profile.followerCount}
          followingCount={profile.followingCount}
          simmrCount={profile.simmrCount}
        />

        {/* Streak */}
        {profile.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{profile.currentStreak} day streak</span>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {badges.map((b) => {
              const def = BADGE_DEFINITIONS[b.badgeType as BadgeType];
              if (!def) return null;
              return (
                <span
                  key={b.badgeType}
                  className="text-lg cursor-default"
                  title={`${def.name} — ${def.description}`}
                >
                  {def.icon}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            Joined {format(new Date(profile.createdAt), "MMM yyyy")}
          </span>
        </div>
      </div>

      {/* Kitchen Inventory CTA - only for profile owner */}
      {isOwnProfile && (
        <>
          {!profile.kitchenInventory ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ChefHat className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Set up your kitchen</p>
                <p className="text-xs text-muted-foreground">
                  Tell us what equipment you have for personalized dish
                  recommendations.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/profile/${profile.username}/kitchen`}>
                  Set up
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChefHat className="h-4 w-4" />
                <span>Kitchen inventory configured</span>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/profile/${profile.username}/kitchen`}>
                  Edit kitchen
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dietary Preferences & Food Exclusions */}
      {(() => {
        const hasDietary = profile.dietaryPreferences && profile.dietaryPreferences.length > 0;
        const hasExclusions = profile.foodExclusions && profile.foodExclusions.length > 0;
        const hasAny = hasDietary || hasExclusions;

        if (isOwnProfile) {
          const parts: string[] = [];
          if (hasDietary) parts.push(profile.dietaryPreferences!.map((p) => getDietaryLabel(p)).join(", "));
          if (hasExclusions) parts.push(`Avoids: ${profile.foodExclusions!.join(", ")}`);

          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <Leaf className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {hasAny ? parts.join(" · ") : "No dietary preferences set"}
                </span>
              </div>
              <Button asChild size="sm" variant="ghost" className="shrink-0">
                <Link href={`/profile/${profile.username}/dietary`}>
                  {hasAny ? "Edit" : "Set up"}
                </Link>
              </Button>
            </div>
          );
        }

        if (!hasAny) return null;

        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Leaf className="h-4 w-4 shrink-0" />
            <span>
              {[
                hasDietary && profile.dietaryPreferences!.map((p) => getDietaryLabel(p)).join(", "),
                hasExclusions && `Avoids: ${profile.foodExclusions!.join(", ")}`,
              ].filter(Boolean).join(" · ")}
            </span>
          </div>
        );
      })()}

      {/* Cooking Skills Link */}
      {canView && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>
              {totalSkillCount > 0
                ? skillCount > 0
                  ? `${skillCount} mastered${totalSkillCount - skillCount > 0 ? `, ${totalSkillCount - skillCount} in progress` : ""}`
                  : `${totalSkillCount} skill${totalSkillCount !== 1 ? "s" : ""} in progress`
                : isOwnProfile
                  ? "No skills yet — publish a recipe to start!"
                  : "No skills earned yet"}
            </span>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/profile/${profile.username}/skills`}>
              {totalSkillCount > 0 ? "View skills" : "View"}
            </Link>
          </Button>
        </div>
      )}

      <Separator />

      {/* User Posts — gated by privacy */}
      {!canView ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">This account is private</p>
          <p className="text-sm text-muted-foreground mt-1">
            Follow this user to see their posts.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
            <Flame className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">No posts yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
