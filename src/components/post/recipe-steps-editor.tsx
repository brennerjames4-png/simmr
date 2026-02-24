"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import type { RecipeStep } from "@/lib/db/schema";

interface RecipeStepsEditorProps {
  steps: RecipeStep[];
  onChange: (steps: RecipeStep[]) => void;
}

function renumber(steps: RecipeStep[]): RecipeStep[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

export function RecipeStepsEditor({ steps, onChange }: RecipeStepsEditorProps) {
  function updateStep(
    index: number,
    field: keyof RecipeStep,
    value: string | number | undefined
  ) {
    onChange(
      steps.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function removeStep(index: number) {
    onChange(renumber(steps.filter((_, i) => i !== index)));
  }

  function addStep() {
    onChange([
      ...steps,
      { step_number: steps.length + 1, instruction: "" },
    ]);
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [
      newSteps[targetIndex],
      newSteps[index],
    ];
    onChange(renumber(newSteps));
  }

  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold mt-1.5">
              {step.step_number}
            </span>
            <div className="flex-1 space-y-1.5">
              <Textarea
                value={step.instruction}
                onChange={(e) =>
                  updateStep(index, "instruction", e.target.value)
                }
                placeholder="Describe this step..."
                rows={2}
                className="text-sm"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={step.duration_minutes ?? ""}
                  onChange={(e) =>
                    updateStep(
                      index,
                      "duration_minutes",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  placeholder="min"
                  min={1}
                  className="h-7 w-20 text-xs"
                />
                <span className="text-xs text-muted-foreground">min</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(index, "up")}
                    disabled={index === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, "down")}
                    disabled={index === steps.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addStep}
          className="w-full mt-1"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add step
        </Button>
      </CardContent>
    </Card>
  );
}
