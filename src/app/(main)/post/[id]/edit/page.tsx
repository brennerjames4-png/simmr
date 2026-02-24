import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getPostById } from "@/queries/posts";
import { CreatePostForm } from "@/components/post/create-post-form";
import type { DraftData } from "@/components/post/create-post-form";
import type { Ingredient, RecipeStep } from "@/lib/db/schema";
import { ArrowLeft } from "lucide-react";

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const post = await getPostById(id, user.id);

  if (!post) notFound();
  if (post.userId !== user.id) notFound();
  if (post.status !== "draft") notFound();

  const draftData: DraftData = {
    id: post.id,
    title: post.title,
    description: post.description,
    recipeNotes: post.recipeNotes,
    imageUrl: post.imageUrl,
    imageKey: post.imageKey,
    tags: post.tags,
    cookTime: post.cookTime,
    difficulty: post.difficulty,
    servings: post.servings,
    ingredients: (post.ingredients as Ingredient[]) ?? null,
    steps: (post.steps as RecipeStep[]) ?? null,
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/post/${post.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to draft
      </Link>
      <h1 className="text-2xl font-bold">Edit Draft</h1>
      <CreatePostForm draft={draftData} />
    </div>
  );
}
