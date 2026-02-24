"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBypassCode } from "@/actions/user";
import { Loader2, FlaskConical, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface BypassCodeFormProps {
  hasValidCode: boolean;
}

export function BypassCodeForm({ hasValidCode }: BypassCodeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(hasValidCode);
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState("");

  function handleActivate() {
    if (!code.trim()) return;

    startTransition(async () => {
      const result = await updateBypassCode(code);
      if (result.valid) {
        setIsActive(true);
        setCode("");
        setIsExpanded(false);
        toast.success("Tester access activated");
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await updateBypassCode("");
      if (result.success) {
        setIsActive(false);
        toast.success("Tester access removed");
      }
    });
  }

  if (isActive) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Tester Access</p>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI rate limits are bypassed
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRemove}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Remove"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 text-left"
      >
        <FlaskConical className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Tester Access
          </p>
          <p className="text-xs text-muted-foreground">
            Enter a code to bypass AI rate limits
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 flex gap-2">
          <Input
            type="password"
            placeholder="Enter access code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleActivate();
              }
            }}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={isPending || !code.trim()}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Activate"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
