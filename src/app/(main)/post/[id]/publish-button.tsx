"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { publishDraft } from "@/actions/inspiration";
import { toast } from "sonner";

export function PublishButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
      const result = await publishDraft(postId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recipe published!");
      }
    });
  }

  return (
    <Button size="sm" onClick={handlePublish} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          Publishing...
        </>
      ) : (
        <>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Publish
        </>
      )}
    </Button>
  );
}
