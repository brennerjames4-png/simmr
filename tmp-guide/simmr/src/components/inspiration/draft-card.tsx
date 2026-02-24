"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishDraft, deleteDraft } from "@/actions/inspiration";
import type { DraftPost } from "@/types/inspiration";
import {
  Clock,
  Users,
  Sparkles,
  Send,
  Trash2,
  Loader2,
  ChefHat,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { RecipeDisplay } from "./recipe-display";

interface DraftCardProps {
  draft: DraftPost;
}

export function DraftCard({ draft }: DraftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isPublishing, startPublishing] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const handlePublish = () => {
    startPublishing(async () => {
      const result = await publishDraft(draft.id);
      if (result.success) {
        toast.success("Published! 🎉", {
          description: `"${draft.title}" is now on your feed.`,
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete draft "${draft.title}"?`)) return;

    startDeleting(async () => {
      const result = await deleteDraft(draft.id);
      if (result.success) {
        setIsDeleted(true);
        toast.success("Draft deleted");
      } else {
        toast.error(result.error);
      }
    });
  };

  if (isDeleted) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">
                {draft.title}
              </h3>
              {draft.source === "inspiration" && (
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-600/15 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              )}
            </div>
            {draft.description && (
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                {draft.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
              {draft.cookTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {draft.cookTime} min
                </span>
              )}
              {draft.servings && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {draft.servings}
                </span>
              )}
              {draft.difficulty && (
                <span className="capitalize">{draft.difficulty}</span>
              )}
              <span>
                {formatDistanceToNow(draft.createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-3">
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing || isDeleting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isPublishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5 hidden sm:inline">Publish</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isPublishing || isDeleting}
              className="text-zinc-500 hover:text-red-400"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Tags */}
        {draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand to see full recipe */}
      {draft.aiRecipe && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-zinc-500 hover:text-zinc-400 border-t border-zinc-800/50 transition-colors"
          >
            <ChefHat className="h-3 w-3" />
            {isExpanded ? "Hide recipe" : "Show full recipe"}
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {isExpanded && (
            <div className="px-4 pb-4 border-t border-zinc-800/50">
              <RecipeDisplay recipe={draft.aiRecipe} editable={false} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
