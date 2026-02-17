"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { completeOnboarding, checkUsername } from "@/actions/auth";
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
import { Flame, Check, X, Loader2 } from "lucide-react";

export function OnboardingForm({ email }: { email: string }) {
  const [state, action, isPending] = useActionState(
    completeOnboarding,
    undefined
  );
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Flame className="h-7 w-7 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome to Simmr</CardTitle>
        <CardDescription>
          Set up your profile to get started. Signing in as {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            {isPending ? "Creating profile..." : "Join the cult"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
