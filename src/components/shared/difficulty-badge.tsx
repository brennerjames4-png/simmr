import { Badge } from "@/components/ui/badge";

const difficultyConfig = {
  beginner: { label: "Beginner", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  intermediate: { label: "Intermediate", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  advanced: { label: "Advanced", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  expert: { label: "Expert", className: "bg-red-500/10 text-red-500 border-red-500/20" },
} as const;

export function DifficultyBadge({
  difficulty,
}: {
  difficulty: keyof typeof difficultyConfig;
}) {
  const config = difficultyConfig[difficulty];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
