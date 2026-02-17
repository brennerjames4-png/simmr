import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { AvatarUploadForm } from "@/components/profile/avatar-upload-form";
import { ArrowLeft } from "lucide-react";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  // Only the profile owner can edit
  if (currentUser.id !== profile.id) {
    redirect(`/profile/${username}`);
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Link>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your profile photo
        </p>
      </div>

      <AvatarUploadForm
        currentAvatarUrl={profile.avatarUrl}
        displayName={profile.displayName}
      />
    </div>
  );
}
