import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getUserPosts } from "@/queries/posts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/feed/post-card";
import { Calendar, Flame } from "lucide-react";
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
