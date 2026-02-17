import { CreatePostForm } from "@/components/post/create-post-form";

export const metadata = {
  title: "New Post",
};

export default function NewPostPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Share your cook</h1>
      <CreatePostForm />
    </div>
  );
}
