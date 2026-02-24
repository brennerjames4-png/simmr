"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { RecipeDisplay } from "./recipe-display";
import { publishDraft, deleteDraft } from "@/actions/inspiration";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { DraftPost } from "@/queries/inspiration";

interface DraftCardProps {
  draft: DraftPost;
}

export function DraftCard({ draft }: DraftCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPublishing, startPublishing] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handlePublish() {
    startPublishing(async () => {
      const result = await publishDraft(draft.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recipe published to your feed!");
      }
    });
  }

  function handleDelete() {
    startDeleting(async () => {
      const result = await deleteDraft(draft.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Draft deleted");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{draft.title}</CardTitle>
            {draft.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {draft.description}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700 shrink-0">
            Draft
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {draft.cookTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {draft.cookTime} min
            </span>
          )}
          {draft.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {draft.servings} servings
            </span>
          )}
          {draft.difficulty && (
            <Badge variant="secondary" className="text-xs py-0">
              {draft.difficulty}
            </Badge>
          )}
          <span>
            {formatDistanceToNow(new Date(draft.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Expandable recipe */}
        {draft.aiRecipe && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-xs"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                  Hide recipe
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  Show full recipe
                </>
              )}
            </Button>

            {expanded && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <RecipeDisplay recipe={draft.aiRecipe} compact />
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {showDeleteConfirm ? (
            <div className="flex gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Confirm Delete"
                )}
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPublishing || isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <Link href={`/post/${draft.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={isPublishing || isDeleting}
                className="flex-1"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
