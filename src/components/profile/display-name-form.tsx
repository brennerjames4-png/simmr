"use client";

import { useState, useTransition } from "react";
import { updateDisplayName } from "@/actions/user";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export function DisplayNameForm({
  currentDisplayName,
  username,
}: {
  currentDisplayName: string;
  username: string;
}) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [isSaving, startSaving] = useTransition();
  const hasChanged = displayName.trim() !== currentDisplayName;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanged || !displayName.trim()) return;

    startSaving(async () => {
      const result = await updateDisplayName(displayName);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Display name updated!");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm mx-auto">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your display name"
          maxLength={100}
          disabled={isSaving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username" className="text-muted-foreground">
          Username
        </Label>
        <Input
          id="username"
          value={`@${username}`}
          disabled
          className="opacity-60"
        />
        <p className="text-xs text-muted-foreground">
          Usernames cannot be changed.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSaving || !hasChanged || !displayName.trim()}
        className="w-full"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving...
          </>
        ) : hasChanged ? (
          "Save Changes"
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Up to date
          </>
        )}
      </Button>
    </form>
  );
}
