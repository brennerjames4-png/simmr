import { requireAuth } from "@/lib/auth";
import { getFeedPosts } from "@/queries/posts";
import { PostCard } from "@/components/feed/post-card";
import { Flame } from "lucide-react";

export const metadata = {
  title: "Feed",
};

export default async function FeedPage() {
  const user = await requireAuth();
  const posts = await getFeedPosts(user.id);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
          <Flame className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No posts yet</h2>
        <p className="text-muted-foreground mt-1">
          Be the first to share what you&apos;re cooking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
