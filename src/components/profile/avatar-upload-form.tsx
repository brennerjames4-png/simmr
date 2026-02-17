"use client";

import { useActionState, useState } from "react";
import { updateAvatar } from "@/actions/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useRef, useEffect } from "react";

export function AvatarUploadForm({
  currentAvatarUrl,
  displayName,
}: {
  currentAvatarUrl: string | null;
  displayName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [state, action, isPending] = useActionState(updateAvatar, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [justUploaded, setJustUploaded] = useState(false);

  // Auto-submit form when a new image is uploaded
  useEffect(() => {
    if (justUploaded && avatarUrl && formRef.current) {
      formRef.current.requestSubmit();
      setJustUploaded(false);
    }
  }, [justUploaded, avatarUrl]);

  // Show toast on success
  useEffect(() => {
    if (state?.success) {
      toast.success("Profile photo updated!");
    }
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Current avatar preview */}
      <div className="relative">
        <Avatar className="h-28 w-28">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={displayName} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-4xl">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {avatarUrl && (
          <button
            type="button"
            onClick={() => setAvatarUrl("")}
            className="absolute -top-1 -right-1 rounded-full bg-destructive p-1 text-white shadow-md hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Upload zone */}
      <div className="w-full max-w-sm">
        <UploadDropzone<OurFileRouter, "profileImage">
          endpoint="profileImage"
          onClientUploadComplete={(res) => {
            if (res?.[0]) {
              setAvatarUrl(res[0].ufsUrl);
              setJustUploaded(true);
            }
          }}
          onUploadError={(error) => {
            toast.error("Upload failed: " + error.message);
          }}
          className="border-dashed border-2 border-border rounded-lg p-6 ut-label:text-foreground ut-allowed-content:text-muted-foreground ut-button:bg-primary ut-button:text-primary-foreground"
          content={{
            label: "Upload a profile photo",
            allowedContent: "Images up to 4MB",
          }}
        />
      </div>

      {/* Hidden form for server action */}
      <form ref={formRef} action={action} className="hidden">
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </form>
    </div>
  );
}
