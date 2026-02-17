"use client";

import { useState, useTransition } from "react";
import { updateAvatar } from "@/actions/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";
import { X } from "lucide-react";
import { toast } from "sonner";

export function AvatarUploadForm({
  currentAvatarUrl,
  displayName,
}: {
  currentAvatarUrl: string | null;
  displayName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [isSaving, startSaving] = useTransition();

  function handleUploadComplete(res: { ufsUrl: string; key: string }[]) {
    if (res?.[0]) {
      const url = res[0].ufsUrl;
      setAvatarUrl(url);
      startSaving(async () => {
        const result = await updateAvatar(url);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Profile photo updated!");
        }
      });
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Current avatar preview */}
      <div className="relative">
        <Avatar className="h-28 w-28">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-4xl">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {avatarUrl && !isSaving && (
          <button
            type="button"
            onClick={() => {
              setAvatarUrl("");
              startSaving(async () => {
                await updateAvatar("");
              });
            }}
            className="absolute -top-1 -right-1 rounded-full bg-destructive p-1 text-white shadow-md hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div className="w-full max-w-sm">
        <UploadDropzone<OurFileRouter, "profileImage">
          endpoint="profileImage"
          onClientUploadComplete={(res) => {
            handleUploadComplete(res as { ufsUrl: string; key: string }[]);
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
    </div>
  );
}
