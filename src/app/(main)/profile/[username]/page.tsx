import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getUserPosts } from "@/queries/posts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/feed/post-card";
import { Calendar, ChefHat, Flame } from "lucide-react";
import { format } from "date-fns";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  const posts = await getUserPosts(username, currentUser.id);

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
            {profile.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>
        {profile.bio && (
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {profile.bio}
          </p>
        )}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-bold text-lg">{profile.postCount}</p>
            <p className="text-muted-foreground">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{profile.totalLikes}</p>
            <p className="text-muted-foreground">Likes</p>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Joined {format(new Date(profile.createdAt), "MMM yyyy")}</span>
          </div>
        </div>
      </div>

      {/* Kitchen Inventory CTA - only for profile owner */}
      {currentUser.id === profile.id && (
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

      <Separator />

      {/* User Posts */}
      {posts.length === 0 ? (
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
