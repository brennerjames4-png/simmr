import { Flame } from "lucide-react";
import Link from "next/link";

export function Logo({ size = "default" }: { size?: "small" | "default" }) {
  return (
    <Link href="/feed" className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-lg bg-primary ${
          size === "small" ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        <Flame
          className={`text-primary-foreground ${
            size === "small" ? "h-4 w-4" : "h-5 w-5"
          }`}
        />
      </div>
      <span
        className={`font-bold tracking-tight ${
          size === "small" ? "text-lg" : "text-xl"
        }`}
      >
        Simmr
      </span>
    </Link>
  );
}
