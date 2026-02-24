"use client";

import { useState, useTransition, useOptimistic } from "react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser, cancelRequest } from "@/actions/follow";
import type { FollowRelationship } from "@/queries/follows";
import { cn } from "@/lib/utils";
import { Loader2, UserPlus, UserCheck, UserX } from "lucide-react";

interface FollowButtonProps {
  targetUserId: string;
  relationship: FollowRelationship;
  isOwnProfile?: boolean;
}

export function FollowButton({
  targetUserId,
  relationship,
  isOwnProfile,
}: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);
  const [optimisticRelationship, setOptimisticRelationship] = useOptimistic(
    relationship,
    (_state, newRelationship: FollowRelationship) => newRelationship
  );

  if (isOwnProfile) return null;
  if (optimisticRelationship === "blocked" || optimisticRelationship === "blocked_by") return null;

  function handleFollow() {
    startTransition(async () => {
      setOptimisticRelationship("following");
      await followUser(targetUserId);
    });
  }

  function handleUnfollow() {
    startTransition(async () => {
      setOptimisticRelationship("none");
      await unfollowUser(targetUserId);
    });
  }

  function handleCancelRequest() {
    startTransition(async () => {
      setOptimisticRelationship("none");
      await cancelRequest(targetUserId);
    });
  }

  if (optimisticRelationship === "none") {
    return (
      <Button
        size="sm"
        onClick={handleFollow}
        disabled={isPending}
        className="min-w-[90px]"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Follow
          </>
        )}
      </Button>
    );
  }

  if (optimisticRelationship === "pending") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleCancelRequest}
        disabled={isPending}
        className="min-w-[90px]"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          "Requested"
        )}
      </Button>
    );
  }

  // Following state
  return (
    <Button
      size="sm"
      variant={isHovering ? "destructive" : "outline"}
      onClick={handleUnfollow}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      disabled={isPending}
      className="min-w-[90px]"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isHovering ? (
        <>
          <UserX className="h-3.5 w-3.5 mr-1.5" />
          Unfollow
        </>
      ) : (
        <>
          <UserCheck className="h-3.5 w-3.5 mr-1.5" />
          Following
        </>
      )}
    </Button>
  );
}
