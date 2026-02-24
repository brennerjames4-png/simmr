"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { togglePrivacy } from "@/actions/follow";
import { Globe, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PrivacyToggleProps {
  isPrivate: boolean;
}

export function PrivacyToggle({ isPrivate }: PrivacyToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [currentPrivate, setCurrentPrivate] = useState(isPrivate);

  function handleToggle() {
    startTransition(async () => {
      const result = await togglePrivacy();
      if (result.success) {
        setCurrentPrivate(result.isPrivate ?? !currentPrivate);
        toast.success(
          result.isPrivate
            ? "Account set to private"
            : "Account set to public — all pending requests accepted"
        );
      } else {
        toast.error(result.error || "Failed to update privacy");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {currentPrivate ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Globe className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {currentPrivate ? "Private Account" : "Public Account"}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentPrivate
              ? "Only approved followers can see your posts"
              : "Anyone can see your posts and follow you"}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : currentPrivate ? (
          "Make Public"
        ) : (
          "Make Private"
        )}
      </Button>
    </div>
  );
}
