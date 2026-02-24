"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { acceptRequest, rejectRequest } from "@/actions/follow";
import { Check, X, Loader2 } from "lucide-react";

interface FollowRequestCardProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export function FollowRequestCard({ user }: FollowRequestCardProps) {
  const [isAccepting, startAccepting] = useTransition();
  const [isRejecting, startRejecting] = useTransition();

  function handleAccept() {
    startAccepting(async () => {
      await acceptRequest(user.id);
    });
  }

  function handleReject() {
    startRejecting(async () => {
      await rejectRequest(user.id);
    });
  }

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
        <p className="text-xs text-muted-foreground">@{user.username}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={isAccepting || isRejecting}
        >
          {isAccepting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Accept
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isAccepting || isRejecting}
        >
          {isRejecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
