"use server";

import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { generateCookingTip } from "@/lib/ai/cooking-tips";
import { allocateSkills, deallocateSkills } from "@/actions/skills";
import { deleteUploadthingFile } from "@/lib/uploadthing-cleanup";
import { getCachedCookingTip } from "@/lib/corpus";
import type { Ingredient, RecipeStep } from "@/lib/db/schema";

const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  recipeNotes: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageKey: z.string().optional(),
  tags: z.string().optional(),
  ingredients: z.string().optional(),
  steps: z.string().optional(),
  cookTime: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  servings: z.coerce.number().int().positive().optional(),
});

export async function createPost(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const user = await requireAuth();

  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    recipeNotes: (formData.get("recipeNotes") as string) || undefined,
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    imageKey: (formData.get("imageKey") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    ingredients: (formData.get("ingredients") as string) || undefined,
    steps: (formData.get("steps") as string) || undefined,
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

  // Parse ingredients JSON from the form
  let ingredientsList: Ingredient[] | null = null;
  if (parsed.data.ingredients) {
    try {
      ingredientsList = JSON.parse(parsed.data.ingredients);
    } catch {
      // Ignore parse errors, ingredients are optional
    }
  }

  // Parse steps JSON from the form
  let stepsList: RecipeStep[] | null = null;
  if (parsed.data.steps) {
    try {
      stepsList = JSON.parse(parsed.data.steps);
    } catch {
      // Ignore parse errors, steps are optional
    }
  }

  // Check cache for cooking tip first, fall back to fresh generation
  const aiTip = await getCachedCookingTip(parsed.data.title)
    ?? await generateCookingTip(parsed.data.title, parsed.data.description);

  const [post] = await db
    .insert(posts)
    .values({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      recipeNotes: parsed.data.recipeNotes || null,
      imageUrl: parsed.data.imageUrl || null,
      imageKey: parsed.data.imageKey || null,
      tags: tagArray,
      cookTime: parsed.data.cookTime || null,
      difficulty: parsed.data.difficulty || null,
      servings: parsed.data.servings || null,
      ingredients: ingredientsList,
      steps: stepsList,
      aiTip,
    })
    .returning();

  // Allocate cooking skills from the recipe steps
  if (stepsList && stepsList.length > 0) {
    await allocateSkills({
      userId: user.id,
      postId: post.id,
      title: parsed.data.title,
      steps: stepsList,
      ingredients: ingredientsList ?? [],
    });
  }

  revalidatePath("/feed");
  redirect(`/post/${post.id}`);
}

export async function updateDraft(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const user = await requireAuth();
  const postId = formData.get("postId") as string;

  if (!postId) {
    return { error: "Post ID is required" };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || post.userId !== user.id) {
    return { error: "Draft not found" };
  }

  if (post.status !== "draft") {
    return { error: "Only drafts can be edited" };
  }

  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    recipeNotes: (formData.get("recipeNotes") as string) || undefined,
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    imageKey: (formData.get("imageKey") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    ingredients: (formData.get("ingredients") as string) || undefined,
    steps: (formData.get("steps") as string) || undefined,
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

  let ingredientsList: Ingredient[] | null = null;
  if (parsed.data.ingredients) {
    try {
      ingredientsList = JSON.parse(parsed.data.ingredients);
    } catch {
      // Ignore parse errors
    }
  }

  let stepsList: RecipeStep[] | null = null;
  if (parsed.data.steps) {
    try {
      stepsList = JSON.parse(parsed.data.steps);
    } catch {
      // Ignore parse errors
    }
  }

  await db
    .update(posts)
    .set({
      title: parsed.data.title,
      description: parsed.data.description || null,
      recipeNotes: parsed.data.recipeNotes || null,
      imageUrl: parsed.data.imageUrl || null,
      imageKey: parsed.data.imageKey || null,
      tags: tagArray,
      cookTime: parsed.data.cookTime || null,
      difficulty: parsed.data.difficulty || null,
      servings: parsed.data.servings || null,
      ingredients: ingredientsList,
      steps: stepsList,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  revalidatePath("/drafts");
  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
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

  // Delete post image from Uploadthing
  if (post.imageUrl) {
    deleteUploadthingFile(post.imageUrl as string).catch(() => {});
  }

  // Deallocate skills before deleting the post
  const allocatedSkillIds = (post.allocatedSkillIds as string[]) ?? [];
  if (allocatedSkillIds.length > 0) {
    await deallocateSkills({
      userId: user.id,
      allocatedSkillIds,
    });
  }

  await db.delete(posts).where(eq(posts.id, postId));

  revalidatePath("/feed");
  redirect("/feed");
}
