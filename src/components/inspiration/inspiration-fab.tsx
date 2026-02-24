"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { InspirationModal } from "./inspiration-modal";

interface InspirationFABProps {
  draftCount: number;
  hasKitchenSetup: boolean;
}

export function InspirationFAB({
  draftCount,
  hasKitchenSetup,
}: InspirationFABProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-4 z-40 md:bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        aria-label="Get inspired"
      >
        <Sparkles className="h-6 w-6" />
        {draftCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {draftCount > 9 ? "9+" : draftCount}
          </span>
        )}
      </button>

      <InspirationModal
        open={showModal}
        onOpenChange={setShowModal}
        hasKitchenSetup={hasKitchenSetup}
        draftCount={draftCount}
      />
    </>
  );
}
