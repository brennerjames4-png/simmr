import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "./follow-button";
import type { FollowListUser } from "@/queries/follows";

interface UserListItemProps {
  user: FollowListUser;
  currentUserId: string;
}

export function UserListItem({ user, currentUserId }: UserListItemProps) {
  const isOwnProfile = user.id === currentUserId;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Link href={`/profile/${user.username}`}>
        <Avatar className="h-10 w-10">
          {user.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {user.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${user.username}`}
          className="text-sm font-semibold hover:underline"
        >
          {user.displayName}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          @{user.username}
        </p>
      </div>
      <FollowButton
        targetUserId={user.id}
        relationship={user.relationship}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
