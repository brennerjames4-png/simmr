import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles, UtensilsCrossed } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LikeButton } from "./like-button";
import { DifficultyBadge } from "@/components/shared/difficulty-badge";
import { formatDistanceToNow } from "date-fns";
import type { PostWithUser } from "@/queries/posts";

export function PostCard({ post }: { post: PostWithUser }) {
  return (
    <Card className="overflow-hidden border-border/50 bg-card">
      {/* Header - user info */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Link href={`/profile/${post.user.username}`}>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {post.user.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${post.user.username}`}
            className="text-sm font-semibold hover:underline"
          >
            {post.user.displayName}
          </Link>
          <p className="text-xs text-muted-foreground">
            @{post.user.username} &middot;{" "}
            {formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        {post.difficulty && <DifficultyBadge difficulty={post.difficulty} />}
      </div>

      {/* Image */}
      <Link href={`/post/${post.id}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-muted">
          <Image
            src={post.imageUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Actions row */}
        <div className="flex items-center justify-between">
          <LikeButton
            postId={post.id}
            likeCount={post.likeCount}
            isLiked={post.isLiked}
          />
          {post.cookTime && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {post.cookTime >= 60
                  ? `${Math.floor(post.cookTime / 60)}h ${post.cookTime % 60}m`
                  : `${post.cookTime}m`}
              </span>
            </div>
          )}
          {post.servings && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>{post.servings} servings</span>
            </div>
          )}
        </div>

        {/* Title + Description */}
        <div>
          <Link href={`/post/${post.id}`}>
            <h3 className="font-semibold text-lg leading-tight hover:underline">
              {post.title}
            </h3>
          </Link>
          {post.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          )}
        </div>

        {/* AI Tip */}
        {post.aiTip && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 border border-primary/10">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-primary">Chef AI:</span>{" "}
              {post.aiTip}
            </p>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
