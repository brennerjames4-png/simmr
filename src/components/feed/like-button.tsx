"use client";

import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleLike } from "@/actions/like";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  postId: string;
  likeCount: number;
  isLiked: boolean;
}

export function LikeButton({ postId, likeCount, isLiked }: LikeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    { likeCount, isLiked },
    (state) => ({
      likeCount: state.isLiked ? state.likeCount - 1 : state.likeCount + 1,
      isLiked: !state.isLiked,
    })
  );

  function handleClick() {
    startTransition(async () => {
      setOptimistic({ likeCount: optimistic.likeCount, isLiked: optimistic.isLiked });
      await toggleLike(postId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-sm transition-colors hover:text-primary"
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-all",
          optimistic.isLiked
            ? "fill-primary text-primary scale-110"
            : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "tabular-nums",
          optimistic.isLiked ? "text-primary" : "text-muted-foreground"
        )}
      >
        {optimistic.likeCount}
      </span>
    </button>
  );
}
