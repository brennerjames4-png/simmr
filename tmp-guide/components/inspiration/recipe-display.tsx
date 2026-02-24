"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AIRecipe, AIRecipeIngredient, AIRecipeStep } from "@/types/inspiration";
import { regenerateRecipeSteps } from "@/actions/inspiration";
import {
  ShoppingBasket,
  ListOrdered,
  Lightbulb,
  Wrench,
  Eye,
  EyeOff,
  Sparkles,
  X,
  Pencil,
  Check,
  RotateCcw,
  Loader2,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

interface RecipeDisplayProps {
  recipe: AIRecipe;
  /** Called when the recipe is updated (ingredients edited or steps regenerated) */
  onRecipeUpdate?: (updatedRecipe: AIRecipe) => void;
  /** If false, ingredients are read-only (e.g. in draft cards) */
  editable?: boolean;
}

export function RecipeDisplay({
  recipe,
  onRecipeUpdate,
  editable = true,
}: RecipeDisplayProps) {
  const [showInferred, setShowInferred] = useState(true);

  // ============================================================
  // INGREDIENT EDITING STATE
  // ============================================================
  const [originalIngredients] = useState<AIRecipeIngredient[]>(recipe.ingredients);
  const [editedIngredients, setEditedIngredients] = useState<AIRecipeIngredient[]>(
    recipe.ingredients
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  // ============================================================
  // STEPS STATE (can be regenerated)
  // ============================================================
  const [currentSteps, setCurrentSteps] = useState<AIRecipeStep[]>(recipe.steps);
  const [currentTips, setCurrentTips] = useState<string[]>(recipe.tips);
  const [currentEquipmentUsed, setCurrentEquipmentUsed] = useState<string[]>(
    recipe.equipmentUsed
  );
  const [isRegenerating, startRegeneration] = useTransition();
  const [stepsStale, setStepsStale] = useState(false);

  // ============================================================
  // DIFF DETECTION
  // ============================================================
  const changes = useMemo(() => {
    const removed: AIRecipeIngredient[] = [];
    const modified: { original: AIRecipeIngredient; current: AIRecipeIngredient }[] = [];

    for (const orig of originalIngredients) {
      const current = editedIngredients.find((e) => e.name === orig.name);
      if (!current) {
        removed.push(orig);
      } else if (current.quantity !== orig.quantity) {
        modified.push({ original: orig, current });
      }
    }

    const hasChanges = removed.length > 0 || modified.length > 0;
    return { removed, modified, hasChanges };
  }, [originalIngredients, editedIngredients]);

  // ============================================================
  // INGREDIENT ACTIONS
  // ============================================================

  const handleRemoveIngredient = useCallback((index: number) => {
    setEditedIngredients((prev) => prev.filter((_, i) => i !== index));
    setStepsStale(true);
    setEditingIndex(null);
  }, []);

  const handleStartEditQuantity = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setEditQuantity(editedIngredients[index].quantity);
    },
    [editedIngredients]
  );

  const handleSaveQuantity = useCallback(
    (index: number) => {
      if (!editQuantity.trim()) return;
      setEditedIngredients((prev) =>
        prev.map((ing, i) =>
          i === index ? { ...ing, quantity: editQuantity.trim() } : ing
        )
      );
      setEditingIndex(null);
      setStepsStale(true);
    },
    [editQuantity]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditQuantity("");
  }, []);

  const handleResetIngredients = useCallback(() => {
    setEditedIngredients(originalIngredients);
    setStepsStale(false);
    setCurrentSteps(recipe.steps);
    setCurrentTips(recipe.tips);
    setCurrentEquipmentUsed(recipe.equipmentUsed);
  }, [originalIngredients, recipe]);

  // ============================================================
  // REGENERATE STEPS
  // ============================================================

  const handleRegenerateSteps = useCallback(() => {
    startRegeneration(async () => {
      const result = await regenerateRecipeSteps({
        dishName: recipe.dishName,
        servings: recipe.servings,
        ingredients: editedIngredients,
        removedIngredients: changes.removed.map((r) => r.name),
      });

      if (!result.success || !result.steps) {
        toast.error(result.error ?? "Failed to regenerate steps");
        return;
      }

      setCurrentSteps(result.steps);
      setCurrentTips(result.tips ?? currentTips);
      setCurrentEquipmentUsed(result.equipmentUsed ?? currentEquipmentUsed);
      setStepsStale(false);

      if (onRecipeUpdate) {
        onRecipeUpdate({
          ...recipe,
          ingredients: editedIngredients,
          steps: result.steps,
          tips: result.tips ?? currentTips,
          equipmentUsed: result.equipmentUsed ?? currentEquipmentUsed,
        });
      }

      toast.success("Steps updated to match your ingredients");
    });
  }, [
    recipe,
    editedIngredients,
    changes.removed,
    currentTips,
    currentEquipmentUsed,
    onRecipeUpdate,
  ]);

  // ============================================================
  // GROUP INGREDIENTS
  // ============================================================
  const providedIngredients = editedIngredients
    .map((ing, i) => ({ ...ing, _index: i }))
    .filter((i) => i.category === "provided");
  const inferredIngredients = editedIngredients
    .map((ing, i) => ({ ...ing, _index: i }))
    .filter((i) => i.category === "inferred");
  const pantryIngredients = editedIngredients
    .map((ing, i) => ({ ...ing, _index: i }))
    .filter((i) => i.category === "assumed_pantry");

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-5">
      {/* Description */}
      <p className="text-sm text-zinc-400 italic">{recipe.description}</p>

      {/* Inferred ingredients notice */}
      {recipe.inferredIngredients.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Inferred from your recent meals
            </p>
            <button
              onClick={() => setShowInferred(!showInferred)}
              className="text-xs text-amber-400/60 hover:text-amber-400 flex items-center gap-1"
            >
              {showInferred ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showInferred ? "Hide" : "Show"}
            </button>
          </div>
          {showInferred && (
            <p className="text-xs text-amber-200/60">
              We think you also have: {recipe.inferredIngredients.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* INGREDIENTS (editable) */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <ShoppingBasket className="h-4 w-4 text-amber-400" />
            Ingredients
            {editable && (
              <span className="text-[10px] font-normal text-zinc-600">(tap to edit)</span>
            )}
          </h3>
          {editable && changes.hasChanges && (
            <button
              onClick={handleResetIngredients}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <Undo2 className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>

        {/* Change summary */}
        {editable && changes.hasChanges && (
          <div className="mb-3 p-2 rounded bg-zinc-900/80 border border-zinc-800 text-xs space-y-1">
            {changes.removed.map((r) => (
              <p key={r.name} className="text-red-400 flex items-center gap-1.5">
                <X className="h-3 w-3" />
                <span className="line-through opacity-60">{r.name}</span>
                <span className="text-zinc-600">removed</span>
              </p>
            ))}
            {changes.modified.map((m) => (
              <p key={m.current.name} className="text-amber-400 flex items-center gap-1.5">
                <Pencil className="h-3 w-3" />
                <span>{m.current.name}</span>
                <span className="text-zinc-600">
                  {m.original.quantity} → {m.current.quantity}
                </span>
              </p>
            ))}
          </div>
        )}

        {providedIngredients.length > 0 && (
          <IngredientGroup
            label="Your ingredients"
            labelColor="text-zinc-600"
            items={providedIngredients}
            variant="provided"
            editable={editable}
            editingIndex={editingIndex}
            editQuantity={editQuantity}
            onEditQuantityChange={setEditQuantity}
            onStartEdit={handleStartEditQuantity}
            onSaveEdit={handleSaveQuantity}
            onCancelEdit={handleCancelEdit}
            onRemove={handleRemoveIngredient}
          />
        )}

        {inferredIngredients.length > 0 && (
          <IngredientGroup
            label="From your recent meals"
            labelColor="text-amber-500/60"
            items={inferredIngredients}
            variant="inferred"
            editable={editable}
            editingIndex={editingIndex}
            editQuantity={editQuantity}
            onEditQuantityChange={setEditQuantity}
            onStartEdit={handleStartEditQuantity}
            onSaveEdit={handleSaveQuantity}
            onCancelEdit={handleCancelEdit}
            onRemove={handleRemoveIngredient}
          />
        )}

        {pantryIngredients.length > 0 && (
          <IngredientGroup
            label="Pantry basics"
            labelColor="text-zinc-600"
            items={pantryIngredients}
            variant="pantry"
            editable={editable}
            editingIndex={editingIndex}
            editQuantity={editQuantity}
            onEditQuantityChange={setEditQuantity}
            onStartEdit={handleStartEditQuantity}
            onSaveEdit={handleSaveQuantity}
            onCancelEdit={handleCancelEdit}
            onRemove={handleRemoveIngredient}
          />
        )}
      </div>

      {/* ============================================================ */}
      {/* STEPS (with regenerate banner when stale) */}
      {/* ============================================================ */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
          <ListOrdered className="h-4 w-4 text-amber-400" />
          Instructions
        </h3>

        {/* Regenerate banner */}
        {editable && stepsStale && (
          <div className="mb-4 p-3 rounded-lg bg-orange-950/40 border border-orange-800/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-200">
                  Ingredients changed
                </p>
                <p className="text-xs text-orange-200/60 mt-0.5">
                  {changes.removed.length > 0 && (
                    <>
                      You removed{" "}
                      <span className="font-medium text-orange-300">
                        {changes.removed.map((r) => r.name).join(", ")}
                      </span>
                      .{" "}
                    </>
                  )}
                  {changes.modified.length > 0 && (
                    <>
                      You changed quantities for{" "}
                      <span className="font-medium text-orange-300">
                        {changes.modified.map((m) => m.current.name).join(", ")}
                      </span>
                      .{" "}
                    </>
                  )}
                  The steps below still reference the original recipe.
                </p>
                <Button
                  size="sm"
                  onClick={handleRegenerateSteps}
                  disabled={isRegenerating}
                  className="mt-2.5 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isRegenerating ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Regenerate Steps
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Regenerating indicator */}
        {isRegenerating && (
          <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Rewriting steps for your updated ingredients...
          </div>
        )}

        {/* Step list */}
        <ol className={`space-y-4 ${isRegenerating ? "opacity-40 pointer-events-none" : ""}`}>
          {currentSteps.map((step) => (
            <li key={step.stepNumber} className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400">
                {step.stepNumber}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {step.instruction}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {step.duration && (
                    <span className="text-[11px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                      ⏱ {step.duration} min
                    </span>
                  )}
                  {step.equipment && (
                    <span className="text-[11px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                      🍳 {step.equipment}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Equipment used */}
      {currentEquipmentUsed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-amber-400" />
            Equipment Used
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {currentEquipmentUsed.map((eq, i) => (
              <span
                key={i}
                className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full"
              >
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {currentTips.length > 0 && (
        <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Tips
          </h3>
          <ul className="space-y-1.5">
            {currentTips.map((tip, i) => (
              <li key={i} className="text-xs text-zinc-400 leading-relaxed">
                • {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INGREDIENT GROUP
// ============================================================

interface IngredientGroupProps {
  label: string;
  labelColor: string;
  items: (AIRecipeIngredient & { _index: number })[];
  variant: "provided" | "inferred" | "pantry";
  editable: boolean;
  editingIndex: number | null;
  editQuantity: string;
  onEditQuantityChange: (value: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number) => void;
  onCancelEdit: () => void;
  onRemove: (index: number) => void;
}

function IngredientGroup({
  label,
  labelColor,
  items,
  variant,
  editable,
  editingIndex,
  editQuantity,
  onEditQuantityChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: IngredientGroupProps) {
  const dotColor = {
    provided: "bg-green-500",
    inferred: "bg-amber-500",
    pantry: "bg-zinc-500",
  }[variant];

  return (
    <div className="mb-3">
      <p className={`text-[10px] uppercase tracking-wider ${labelColor} mb-1.5 font-medium`}>
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((ing) => {
          const isEditing = editingIndex === ing._index;

          return (
            <li
              key={`${ing.name}-${ing._index}`}
              className={`flex items-center gap-2 text-sm group ${
                editable ? "hover:bg-zinc-900/50 -mx-2 px-2 py-0.5 rounded" : ""
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor} flex-shrink-0`} />

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editQuantity}
                    onChange={(e) => onEditQuantityChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveEdit(ing._index);
                      if (e.key === "Escape") onCancelEdit();
                    }}
                    className="h-6 w-20 text-xs bg-zinc-800 border-zinc-700 px-1.5"
                    autoFocus
                  />
                  <button
                    onClick={() => onSaveEdit(ing._index)}
                    className="h-5 w-5 rounded flex items-center justify-center text-green-400 hover:bg-green-950/30"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="h-5 w-5 rounded flex items-center justify-center text-zinc-500 hover:bg-zinc-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span
                  className={`text-zinc-400 font-mono text-xs min-w-[70px] ${
                    editable
                      ? "cursor-pointer hover:text-amber-400 hover:underline decoration-dotted"
                      : ""
                  }`}
                  onClick={() => editable && onStartEdit(ing._index)}
                  title={editable ? "Click to edit quantity" : undefined}
                >
                  {ing.quantity}
                </span>
              )}

              <span className="text-zinc-300 flex-1">{ing.name}</span>

              {editable && !isEditing && (
                <button
                  onClick={() => onRemove(ing._index)}
                  className="h-5 w-5 rounded flex items-center justify-center text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-950/30 transition-all"
                  title={`Remove ${ing.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
