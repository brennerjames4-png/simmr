import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getSimmrs } from "@/queries/follows";
import { UserListItem } from "@/components/follow/user-list-item";
import { ArrowLeft, Flame } from "lucide-react";

export default async function SimmrsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  const simmrs = await getSimmrs(profile.id, currentUser.id);

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
          <h1 className="text-xl font-bold">Simmrs</h1>
          <p className="text-sm text-muted-foreground">
            @{username} &middot; {simmrs.length} mutual follow
            {simmrs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {simmrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
            <Flame className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">No Simmrs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            When you and another user follow each other, you become Simmrs
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {simmrs.map((user) => (
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
