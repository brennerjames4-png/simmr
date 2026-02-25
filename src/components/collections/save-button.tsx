"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSavePost } from "@/actions/collections";
import { toast } from "sonner";

export function SaveButton({
  postId,
  initialSaved,
}: {
  postId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setSaved((prev) => !prev);
    startTransition(async () => {
      const result = await toggleSavePost(postId);
      if (result.error) {
        setSaved((prev) => !prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleToggle}
      disabled={isPending}
    >
      <Bookmark
        className={`h-4 w-4 ${saved ? "fill-primary text-primary" : "text-muted-foreground"}`}
      />
    </Button>
  );
}
