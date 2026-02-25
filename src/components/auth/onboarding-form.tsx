"use client";

import { useActionState, useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, checkUsername } from "@/actions/auth";
import { updateDietaryPreferences } from "@/actions/user";
import { updateKitchenInventory } from "@/actions/kitchen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Flame, Check, X, Loader2, ChevronRight, Leaf, ChefHat } from "lucide-react";
import { DIETARY_OPTIONS } from "@/lib/dietary-config";
import { defaultKitchenInventory } from "@/lib/kitchen-defaults";
import type { KitchenInventory } from "@/lib/db/schema";

type Step = 1 | 2 | 3;

const APPLIANCE_OPTIONS = [
  { key: "oven", label: "Oven", icon: "🔥" },
  { key: "microwave", label: "Microwave", icon: "📡" },
  { key: "toaster", label: "Toaster", icon: "🍞" },
  { key: "blender", label: "Blender", icon: "🥤" },
  { key: "food_processor", label: "Food Processor", icon: "🔪" },
  { key: "stand_mixer", label: "Stand Mixer", icon: "🎂" },
  { key: "slow_cooker", label: "Slow Cooker", icon: "🍲" },
  { key: "pressure_cooker", label: "Pressure Cooker", icon: "♨️" },
  { key: "air_fryer", label: "Air Fryer", icon: "🍟" },
  { key: "grill", label: "Grill", icon: "🥩" },
] as const;

const SPECIALTY_OPTIONS = [
  { key: "wok", label: "Wok", icon: "🥘" },
  { key: "dutch_oven", label: "Dutch Oven", icon: "🫕" },
  { key: "cast_iron_skillet", label: "Cast Iron Skillet", icon: "🍳" },
  { key: "steamer", label: "Steamer", icon: "💨" },
] as const;

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i + 1 === current
              ? "w-8 bg-primary"
              : i + 1 < current
                ? "w-2 bg-primary/60"
                : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1: Profile state
  const [state, action, isPending] = useActionState(
    completeOnboarding,
    undefined
  );
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Dietary state
  const [selectedDietary, setSelectedDietary] = useState<Set<string>>(new Set());
  const [exclusionInput, setExclusionInput] = useState("");
  const [exclusions, setExclusions] = useState<string[]>([]);

  // Step 3: Kitchen state
  const [selectedAppliances, setSelectedAppliances] = useState<Set<string>>(new Set());
  const [selectedSpecialty, setSelectedSpecialty] = useState<Set<string>>(new Set());

  // Loading states for steps 2 & 3
  const [isSaving, startTransition] = useTransition();

  // Username validation effect
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username || username.length < 3) {
      setUsernameStatus(username ? "invalid" : "idle");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsername(username);
      setUsernameStatus(result.available ? "available" : "taken");
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  // Transition to step 2 after profile creation
  useEffect(() => {
    if (state && "success" in state && state.success) {
      setStep(2);
    }
  }, [state]);

  function toggleDietary(id: string) {
    setSelectedDietary((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addExclusion() {
    const trimmed = exclusionInput.trim().toLowerCase();
    if (trimmed && !exclusions.includes(trimmed)) {
      setExclusions((prev) => [...prev, trimmed]);
    }
    setExclusionInput("");
  }

  function removeExclusion(item: string) {
    setExclusions((prev) => prev.filter((e) => e !== item));
  }

  function toggleAppliance(key: string) {
    setSelectedAppliances((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSpecialty(key: string) {
    setSelectedSpecialty((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDietaryContinue() {
    startTransition(async () => {
      await updateDietaryPreferences(
        Array.from(selectedDietary),
        exclusions
      );
      setStep(3);
    });
  }

  function handleKitchenFinish() {
    startTransition(async () => {
      const inventory: KitchenInventory = {
        ...defaultKitchenInventory,
        appliances: {
          ...defaultKitchenInventory.appliances,
          ...Object.fromEntries(
            APPLIANCE_OPTIONS.map(({ key }) => [key, selectedAppliances.has(key)])
          ),
        },
        specialty: {
          ...defaultKitchenInventory.specialty,
          ...Object.fromEntries(
            SPECIALTY_OPTIONS.map(({ key }) => [key, selectedSpecialty.has(key)])
          ),
        },
      };
      await updateKitchenInventory(inventory);
      router.push("/feed");
    });
  }

  function handleSkipToFeed() {
    router.push("/feed");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <ProgressDots current={step} total={3} />
        {step === 1 && (
          <>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Flame className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to Simmr</CardTitle>
            <CardDescription>
              Set up your profile to get started. Signing in as {email}
            </CardDescription>
          </>
        )}
        {step === 2 && (
          <>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <Leaf className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Dietary Preferences</CardTitle>
            <CardDescription>
              Help us recommend recipes that match your diet. You can always change these later.
            </CardDescription>
          </>
        )}
        {step === 3 && (
          <>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <ChefHat className="h-7 w-7 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Your Kitchen</CardTitle>
            <CardDescription>
              Tell us what you have so we recommend recipes that work in YOUR kitchen.
            </CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent>
        {/* Step 1: Profile Basics */}
        {step === 1 && (
          <form action={action} className="space-y-4">
            {state?.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="your_username"
                  required
                  minLength={3}
                  maxLength={50}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {usernameStatus === "available" && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {usernameStatus === "taken" && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              {usernameStatus === "taken" && (
                <p className="text-xs text-destructive">Username is taken</p>
              )}
              {usernameStatus === "invalid" && username && (
                <p className="text-xs text-muted-foreground">
                  Min 3 characters, letters, numbers, underscores only
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="Your Name"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio (optional)</Label>
              <Textarea
                id="bio"
                name="bio"
                placeholder="Tell us about your cooking..."
                maxLength={300}
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isPending ||
                usernameStatus === "taken" ||
                usernameStatus === "checking" ||
                usernameStatus === "invalid"
              }
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating profile...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Step 2: Dietary Preferences */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDietary(opt.id)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                    selectedDietary.has(opt.id)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                  {selectedDietary.has(opt.id) && (
                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclusions">Foods to avoid (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="exclusions"
                  value={exclusionInput}
                  onChange={(e) => setExclusionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExclusion();
                    }
                  }}
                  placeholder="e.g., cilantro, mushrooms"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addExclusion}
                  disabled={!exclusionInput.trim()}
                >
                  Add
                </Button>
              </div>
              {exclusions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {exclusions.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeExclusion(item)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(3)}
                disabled={isSaving}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleDietaryContinue}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Kitchen Inventory */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Appliances
              </p>
              <div className="grid grid-cols-2 gap-2">
                {APPLIANCE_OPTIONS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAppliance(key)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                      selectedAppliances.has(key)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="font-medium">{label}</span>
                    {selectedAppliances.has(key) && (
                      <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Specialty Cookware
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SPECIALTY_OPTIONS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSpecialty(key)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                      selectedSpecialty.has(key)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="font-medium">{label}</span>
                    {selectedSpecialty.has(key) && (
                      <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You can add more details like pots, pans, and prep tools in your profile settings.
            </p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleSkipToFeed}
                disabled={isSaving}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleKitchenFinish}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Start cooking"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
