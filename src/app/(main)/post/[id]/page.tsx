import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getPostById } from "@/queries/posts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LikeButton } from "@/components/feed/like-button";
import { DifficultyBadge } from "@/components/shared/difficulty-badge";
import { deletePost } from "@/actions/post";
import {
  ArrowLeft,
  Clock,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const post = await getPostById(id, user.id);

  if (!post) notFound();

  const isOwner = post.userId === user.id;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Image - only rendered if post has a photo */}
      {post.imageUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={post.imageUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
            priority
          />
        </div>
      )}

      {/* User + Actions */}
      <div className="flex items-center justify-between">
        <Link
          href={`/profile/${post.user.username}`}
          className="flex items-center gap-3"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {post.user.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{post.user.displayName}</p>
            <p className="text-xs text-muted-foreground">
              @{post.user.username} &middot;{" "}
              {formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <LikeButton
            postId={post.id}
            likeCount={post.likeCount}
            isLiked={post.isLiked}
          />
          {isOwner && (
            <form action={deletePost}>
              <input type="hidden" name="postId" value={post.id} />
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">{post.title}</h1>
        {post.description && (
          <p className="mt-2 text-muted-foreground leading-relaxed">
            {post.description}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        {post.difficulty && <DifficultyBadge difficulty={post.difficulty} />}
        {post.cookTime && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {post.cookTime >= 60
                ? `${Math.floor(post.cookTime / 60)}h ${post.cookTime % 60}m`
                : `${post.cookTime} min`}
            </span>
          </div>
        )}
        {post.servings && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <UtensilsCrossed className="h-4 w-4" />
            <span>{post.servings} servings</span>
          </div>
        )}
      </div>

      {/* AI Tip */}
      {post.aiTip && (
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4 border border-primary/10">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary mb-1">Chef AI Tip</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {post.aiTip}
            </p>
          </div>
        </div>
      )}

      {/* Ingredients */}
      {post.ingredients && post.ingredients.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Ingredients</h2>
            <ul className="space-y-1.5">
              {post.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 text-sm text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span>
                    <span className="text-foreground font-medium">
                      {ing.quantity} {ing.unit}
                    </span>{" "}
                    {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Recipe Notes */}
      {post.recipeNotes && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-2">Recipe Notes</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {post.recipeNotes}
            </p>
          </div>
        </>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
