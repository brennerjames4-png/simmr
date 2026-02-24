import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getFollowing } from "@/queries/follows";
import { UserListItem } from "@/components/follow/user-list-item";
import { ArrowLeft, Users } from "lucide-react";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  const following = await getFollowing(profile.id, currentUser.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${username}`}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Following</h1>
          <p className="text-sm text-muted-foreground">
            @{username} &middot; {following.length} following
          </p>
        </div>
      </div>

      {following.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Not following anyone yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {following.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              currentUserId={currentUser.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
