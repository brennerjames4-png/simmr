"use server";

import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { generateCookingTip } from "@/lib/ai/cooking-tips";

const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  recipeNotes: z.string().optional(),
  imageUrl: z.string().url("Valid image URL is required"),
  imageKey: z.string().optional(),
  tags: z.string().optional(),
  cookTime: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  servings: z.coerce.number().int().positive().optional(),
});

export async function createPost(formData: FormData) {
  const user = await requireAuth();

  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    recipeNotes: (formData.get("recipeNotes") as string) || undefined,
    imageUrl: formData.get("imageUrl") as string,
    imageKey: (formData.get("imageKey") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    cookTime: formData.get("cookTime") || undefined,
    difficulty: (formData.get("difficulty") as string) || undefined,
    servings: formData.get("servings") || undefined,
  };

  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const tagArray = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : [];

  // Generate AI cooking tip (non-blocking - if it fails, post still works)
  const aiTip = await generateCookingTip(
    parsed.data.title,
    parsed.data.description
  );

  const [post] = await db
    .insert(posts)
    .values({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      recipeNotes: parsed.data.recipeNotes || null,
      imageUrl: parsed.data.imageUrl,
      imageKey: parsed.data.imageKey || null,
      tags: tagArray,
      cookTime: parsed.data.cookTime || null,
      difficulty: parsed.data.difficulty || null,
      servings: parsed.data.servings || null,
      aiTip,
    })
    .returning();

  revalidatePath("/feed");
  redirect(`/post/${post.id}`);
}

export async function deletePost(formData: FormData) {
  const user = await requireAuth();
  const postId = formData.get("postId") as string;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || post.userId !== user.id) {
    return;
  }

  await db.delete(posts).where(eq(posts.id, postId));

  revalidatePath("/feed");
  redirect("/feed");
}
