"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { updateAvatar } from "@/actions/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUploadThing } from "@/lib/uploadthing-helpers";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<File> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  });
}

export function AvatarUploadForm({
  currentAvatarUrl,
  displayName,
}: {
  currentAvatarUrl: string | null;
  displayName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [isSaving, startSaving] = useTransition();

  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("profileImage");

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  async function handleCropAndUpload() {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsUploading(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      const res = await startUpload([croppedFile]);

      if (res && res.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const file = res[0] as any;
        const uploadedUrl = file.ufsUrl || file.url || "";

        if (!uploadedUrl) {
          toast.error("Upload succeeded but no URL returned");
          return;
        }

        setAvatarUrl(uploadedUrl);
        setImageSrc(null);

        startSaving(async () => {
          const result = await updateAvatar(uploadedUrl);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Profile photo updated!");
          }
        });
      }
    } catch (err) {
      console.error("Crop/upload error:", err);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  }

  // Cropping view
  if (imageSrc) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
        <p className="text-sm font-medium">Crop your photo</p>
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setImageSrc(null)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleCropAndUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Default view
  return (
    <div className="flex flex-col items-center gap-6">
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Choose photo
      </Button>
    </div>
  );
}
