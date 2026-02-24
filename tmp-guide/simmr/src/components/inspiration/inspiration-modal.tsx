"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  ChefHat,
  Clock,
  Users,
  AlertTriangle,
  BookmarkPlus,
  RotateCcw,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { generateRecipe, saveRecipeAsDraft } from "@/actions/inspiration";
import type { AIRecipe, InspirationInput } from "@/types/inspiration";
import { RecipeDisplay } from "./recipe-display";
import { toast } from "sonner";
import Link from "next/link";

type Step = "input" | "generating" | "recipe";

interface InspirationModalProps {
  open: boolean;
  onClose: () => void;
  hasKitchenSetup: boolean;
}

export function InspirationModal({
  open,
  onClose,
  hasKitchenSetup,
}: InspirationModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [ingredients, setIngredients] = useState("");
  const [servings, setServings] = useState(2);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [recipe, setRecipe] = useState<AIRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // Voice recognition
  const {
    isSupported: voiceSupported,
    isListening,
    toggleListening,
    transcript,
    resetTranscript,
    error: voiceError,
  } = useSpeechRecognition({
    onFinalResult: (text) => {
      setIngredients(text);
    },
    onInterimResult: (text) => {
      setIngredients(text);
    },
  });

  const handleGenerate = useCallback(() => {
    if (!ingredients.trim()) {
      setError("Tell me what you've got in your kitchen!");
      return;
    }

    setError(null);
    setStep("generating");

    // Stop voice if active
    if (isListening) toggleListening();

    const input: InspirationInput = {
      availableIngredients: ingredients.trim(),
      servings,
      dietaryNotes: dietaryNotes.trim() || undefined,
    };

    startTransition(async () => {
      const result = await generateRecipe(input);

      if (!result.success || !result.recipe) {
        setError(result.error ?? "Something went wrong. Give it another shot.");
        setStep("input");
        return;
      }

      setRecipe(result.recipe);
      setStep("recipe");
    });
  }, [ingredients, servings, dietaryNotes, isListening, toggleListening]);

  const handleSaveAsDraft = useCallback(() => {
    if (!recipe) return;

    startSaving(async () => {
      const result = await saveRecipeAsDraft(recipe);

      if (!result.success) {
        toast.error(result.error ?? "Failed to save draft");
        return;
      }

      toast.success("Recipe saved as draft!", {
        description: "Find it in your Drafts to publish when you've cooked it.",
        action: {
          label: "View Drafts",
          onClick: () => (window.location.href = "/drafts"),
        },
      });

      handleReset();
      onClose();
    });
  }, [recipe, onClose]);

  const handleReset = useCallback(() => {
    setStep("input");
    setRecipe(null);
    setError(null);
    // Keep ingredients/servings so user can modify and re-generate
  }, []);

  const handleClose = useCallback(() => {
    if (step === "generating") return; // Don't close while generating
    handleReset();
    setIngredients("");
    setDietaryNotes("");
    setServings(2);
    resetTranscript();
    onClose();
  }, [step, onClose, resetTranscript, handleReset]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        {/* ============================================ */}
        {/* STEP 1: INPUT */}
        {/* ============================================ */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-zinc-100">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                Get Inspired
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Kitchen setup nudge */}
              {!hasKitchenSetup && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
                  <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-200 font-medium">
                      Set up your kitchen first!
                    </p>
                    <p className="text-amber-200/60 mt-0.5">
                      Tell us what equipment you have so we only suggest recipes you can actually make.
                    </p>
                    <Link
                      href="/profile/kitchen"
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 mt-1.5 font-medium"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Set up kitchen →
                    </Link>
                  </div>
                </div>
              )}

              {/* Ingredients input */}
              <div className="space-y-2">
                <Label htmlFor="ingredients" className="text-zinc-300 text-sm font-medium">
                  What&apos;s in your kitchen right now?
                </Label>
                <p className="text-xs text-zinc-500">
                  List the main ingredients you have. Don&apos;t worry about every spice and sauce —
                  we&apos;ll figure out what else you likely have based on your recent cooking.
                </p>
                <div className="relative">
                  <Textarea
                    id="ingredients"
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    placeholder="e.g. chicken thighs, rice, bell peppers, onions, garlic, soy sauce, some leftover mushrooms..."
                    rows={4}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 pr-12 resize-none"
                  />
                  {/* Voice input button */}
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`absolute bottom-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                        isListening
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                      }`}
                      title={isListening ? "Stop listening" : "Speak your ingredients"}
                    >
                      {isListening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                {isListening && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Listening... speak your ingredients
                  </p>
                )}
                {voiceError && (
                  <p className="text-xs text-red-400">{voiceError}</p>
                )}
              </div>

              {/* Servings + Dietary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="servings" className="text-zinc-300 text-sm font-medium">
                    Servings
                  </Label>
                  <Input
                    id="servings"
                    type="number"
                    min={1}
                    max={12}
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value) || 2)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dietary" className="text-zinc-300 text-sm font-medium">
                    Dietary notes
                    <span className="text-zinc-600 font-normal ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="dietary"
                    value={dietaryNotes}
                    onChange={(e) => setDietaryNotes(e.target.value)}
                    placeholder="e.g. no dairy, vegetarian"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!ingredients.trim() || isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium h-11"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Inspire Me
              </Button>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* STEP 2: GENERATING */}
        {/* ============================================ */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                <ChefHat className="h-10 w-10 text-amber-400 animate-bounce" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-amber-500/20 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-zinc-100">
                Cooking up something special...
              </p>
              <p className="text-sm text-zinc-500">
                Checking your kitchen, reviewing your recent meals, and crafting the perfect recipe
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              Typically takes 5-10 seconds
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* STEP 3: RECIPE RESULT */}
        {/* ============================================ */}
        {step === "recipe" && recipe && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-zinc-100">
                  <ChefHat className="h-5 w-5 text-amber-400" />
                  {recipe.dishName}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {recipe.totalTime} min
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {recipe.servings} servings
                </span>
                <span className="capitalize px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {recipe.difficulty}
                </span>
              </div>
            </DialogHeader>

            <div className="mt-2 space-y-4">
              <RecipeDisplay
                recipe={recipe}
                editable={true}
                onRecipeUpdate={(updatedRecipe) => setRecipe(updatedRecipe)}
              />

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                <Button
                  onClick={handleSaveAsDraft}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                  )}
                  Save as Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("input");
                    setRecipe(null);
                  }}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
