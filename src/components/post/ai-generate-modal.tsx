"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic, Loader2, ArrowLeft } from "lucide-react";
import { VoiceRecorder } from "./voice-recorder";
import { generateRecipe, structureRecipe } from "@/actions/recipe-ai";
import type { GeneratedRecipe } from "@/lib/db/schema";
import { toast } from "sonner";

type ModalView = "select" | "auto" | "voice";

interface AiGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dishName: string;
  servings?: number;
  onRecipeGenerated: (recipe: GeneratedRecipe) => void;
}

export function AiGenerateModal({
  open,
  onOpenChange,
  dishName,
  servings,
  onRecipeGenerated,
}: AiGenerateModalProps) {
  const [view, setView] = useState<ModalView>("select");
  const [isProcessing, startProcessing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      setView("select");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  function handleAutoGenerate() {
    setView("auto");
    setError(null);
    startProcessing(async () => {
      const result = await generateRecipe(dishName, servings);
      if (result.error) {
        setError(result.error);
      } else if (result.recipe) {
        onRecipeGenerated(result.recipe);
        onOpenChange(false);
        toast.success("Recipe generated!");
      }
    });
  }

  function handleTranscriptReady(transcript: string) {
    setError(null);
    startProcessing(async () => {
      const result = await structureRecipe(transcript, dishName, servings);
      if (result.error) {
        setError(result.error);
      } else if (result.recipe) {
        onRecipeGenerated(result.recipe);
        onOpenChange(false);
        toast.success("Recipe structured!");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Selection view */}
        {view === "select" && (
          <>
            <DialogHeader>
              <DialogTitle>Generate Recipe with AI</DialogTitle>
              <DialogDescription>
                Choose how you&apos;d like to create your recipe
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={!dishName.trim()}
                className="flex flex-col items-center gap-2 rounded-lg border p-5 text-center hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-sm">Auto-Generate</span>
                <span className="text-xs text-muted-foreground">
                  AI creates the full recipe based on your dish name
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("voice");
                  setError(null);
                }}
                className="flex flex-col items-center gap-2 rounded-lg border p-5 text-center hover:bg-accent transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-sm">Describe It Yourself</span>
                <span className="text-xs text-muted-foreground">
                  Record or type your recipe, AI structures it
                </span>
              </button>
            </div>

            {!dishName.trim() && (
              <p className="text-xs text-muted-foreground text-center">
                Fill in the dish name first to use Auto-Generate
              </p>
            )}
          </>
        )}

        {/* Auto-generate view (loading) */}
        {view === "auto" && (
          <>
            <DialogHeader>
              <DialogTitle>Generating Recipe</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-3 py-8">
              {error ? (
                <>
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive w-full">
                    {error}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setView("select");
                        setError(null);
                      }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAutoGenerate}
                    >
                      Try again
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Generating recipe for &quot;{dishName}&quot;...
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {/* Voice view */}
        {view === "voice" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setView("select");
                    setError(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Describe Your Recipe</DialogTitle>
              </div>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {isProcessing ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Structuring your recipe...
                </p>
              </div>
            ) : (
              <VoiceRecorder
                onTranscriptReady={handleTranscriptReady}
                disabled={isProcessing}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
