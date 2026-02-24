"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { unblockUser } from "@/actions/follow";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UnblockButtonProps {
  userId: string;
}

export function UnblockButton({ userId }: UnblockButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleUnblock() {
    startTransition(async () => {
      const result = await unblockUser(userId);
      if (result.success) {
        toast.success("User unblocked");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleUnblock}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        "Unblock"
      )}
    </Button>
  );
}
