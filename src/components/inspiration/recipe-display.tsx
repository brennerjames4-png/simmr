"use client";

import { useState, useRef, useEffect } from "react";
import type { InspirationRecipe, InspirationIngredient } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  ChefHat,
  Flame,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeDisplayProps {
  recipe: InspirationRecipe;
  compact?: boolean;
  editable?: boolean;
  editedIngredients?: InspirationIngredient[];
  onIngredientRemove?: (index: number) => void;
  onIngredientQuantityChange?: (index: number, newQuantity: string) => void;
  ingredientChangeSummary?: string[];
  onRegenerateSteps?: () => void;
  onResetIngredients?: () => void;
  isRegeneratingSteps?: boolean;
  hasIngredientChanges?: boolean;
}

const sourceConfig = {
  provided: {
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    label: "you have this",
  },
  inferred: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    label: "likely in your kitchen",
  },
  pantry: {
    dot: "bg-gray-400",
    text: "text-muted-foreground",
    label: "pantry staple",
  },
} as const;

function DifficultyBadge({
  difficulty,
}: {
  difficulty: string;
}) {
  const colors: Record<string, string> = {
    beginner: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
    intermediate: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
    advanced: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
    expert: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  };

  return (
    <Badge variant="outline" className={colors[difficulty] ?? ""}>
      {difficulty}
    </Badge>
  );
}

export function RecipeDisplay({
  recipe,
  compact,
  editable,
  editedIngredients,
  onIngredientRemove,
  onIngredientQuantityChange,
  ingredientChangeSummary,
  onRegenerateSteps,
  onResetIngredients,
  isRegeneratingSteps,
  hasIngredientChanges,
}: RecipeDisplayProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  const activeIngredients =
    editable && editedIngredients ? editedIngredients : recipe.ingredients;

  const providedCount = activeIngredients.filter(
    (i) => i.source === "provided"
  ).length;
  const inferredCount = activeIngredients.filter(
    (i) => i.source === "inferred"
  ).length;
  const pantryCount = activeIngredients.filter(
    (i) => i.source === "pantry"
  ).length;

  function handleStartEdit(index: number, currentQuantity: string) {
    setEditingIndex(index);
    setEditingValue(currentQuantity);
  }

  function handleFinishEdit() {
    if (editingIndex !== null && editingValue.trim()) {
      onIngredientQuantityChange?.(editingIndex, editingValue.trim());
    }
    setEditingIndex(null);
    setEditingValue("");
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFinishEdit();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setEditingValue("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Title & Description */}
      <div>
        <h3 className="text-lg font-bold">{recipe.title}</h3>
        {recipe.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {recipe.description}
          </p>
        )}
      </div>

      {/* Meta bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {recipe.cookTime > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {recipe.cookTime >= 60
                ? `${Math.floor(recipe.cookTime / 60)}h ${recipe.cookTime % 60}m`
                : `${recipe.cookTime} min`}
            </span>
          </div>
        )}
        {recipe.servings > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        <DifficultyBadge difficulty={recipe.difficulty} />
      </div>

      {/* New Skills Banner */}
      {recipe.newSkills && recipe.newSkills.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            New skills you&apos;ll learn
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recipe.newSkills.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <ChefHat className="h-4 w-4" />
          Ingredients
          {editable && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (tap to edit)
            </span>
          )}
        </h4>

        {/* Legend */}
        {!compact && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>You have ({providedCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Likely have ({inferredCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span>Pantry ({pantryCount})</span>
            </div>
          </div>
        )}

        <ul className="space-y-1.5">
          {activeIngredients.map((ing, i) => {
            const config = sourceConfig[ing.source] ?? sourceConfig.provided;
            const isEditing = editable && editingIndex === i;
            return (
              <li
                key={`${ing.name}-${i}`}
                className="flex items-start gap-2 text-sm group"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dot}`}
                />
                <span className={cn("flex-1", config.text)}>
                  {isEditing ? (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={handleEditKeyDown}
                        className="inline-block w-20 rounded border border-primary/30 bg-background px-1 py-0.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                      <span className="ml-1">
                        {ing.unit} {ing.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "font-medium",
                          editable &&
                            "cursor-pointer hover:underline hover:decoration-dotted"
                        )}
                        onClick={
                          editable
                            ? () => handleStartEdit(i, ing.quantity)
                            : undefined
                        }
                      >
                        {ing.quantity} {ing.unit}
                      </span>{" "}
                      {ing.name}
                      {!compact && (
                        <span className="text-xs ml-1 opacity-60">
                          ({config.label})
                        </span>
                      )}
                    </>
                  )}
                </span>
                {editable && !isEditing && (
                  <button
                    type="button"
                    onClick={() => onIngredientRemove?.(i)}
                    className="shrink-0 mt-0.5 p-0.5 rounded-sm text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${ing.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ingredient change banner */}
      {hasIngredientChanges && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Ingredients changed
            </span>
          </div>
          {ingredientChangeSummary && ingredientChangeSummary.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 ml-6">
              {ingredientChangeSummary.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 ml-6">
            <Button
              size="sm"
              onClick={onRegenerateSteps}
              disabled={isRegeneratingSteps}
              className="text-xs h-7"
            >
              {isRegeneratingSteps ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regenerate Steps
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetIngredients}
              disabled={isRegeneratingSteps}
              className="text-xs h-7"
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Steps */}
      <div
        className={cn(
          "space-y-2 transition-opacity duration-300",
          isRegeneratingSteps ? "opacity-30 pointer-events-none" : "opacity-100"
        )}
      >
        <h4 className="font-semibold text-sm">Steps</h4>
        <ol className="space-y-3">
          {recipe.steps.map((step) => (
            <li key={step.step_number} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {step.step_number}
              </span>
              <div className="flex-1">
                <p className="text-sm">{step.instruction}</p>
                {step.duration_minutes && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ~{step.duration_minutes} min
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Equipment Used */}
      {recipe.equipmentUsed.length > 0 && (
        <div
          className={cn(
            "space-y-2 transition-opacity duration-300",
            isRegeneratingSteps
              ? "opacity-30 pointer-events-none"
              : "opacity-100"
          )}
        >
          <h4 className="font-semibold text-sm">Equipment Used</h4>
          <div className="flex flex-wrap gap-1.5">
            {recipe.equipmentUsed.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Notes */}
      {recipe.dietaryNotes && (
        <div className="rounded-md bg-primary/5 border border-primary/10 p-3">
          <p className="text-xs text-muted-foreground">
            <Flame className="h-3 w-3 inline mr-1" />
            {recipe.dietaryNotes}
          </p>
        </div>
      )}
    </div>
  );
}
