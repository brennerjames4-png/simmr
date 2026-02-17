import { PostCardSkeleton } from "@/components/feed/post-card-skeleton";

export default function FeedLoading() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
