import { fal } from "@fal-ai/client";

let configured = false;

export function getFalClient(): typeof fal | null {
  if (!process.env.FAL_KEY) return null;

  if (!configured) {
    fal.config({ credentials: process.env.FAL_KEY });
    configured = true;
  }

  return fal;
}
