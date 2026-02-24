import { Badge } from "@/components/ui/badge";
import type { SkillTier } from "@/lib/db/schema";

const tierConfig: Record<
  SkillTier,
  { label: string; className: string }
> = {
  prep_cook: {
    label: "Prep Cook",
    className: "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
  },
  line_cook: {
    label: "Line Cook",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  sous_chef: {
    label: "Sous Chef",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400",
  },
  head_chef: {
    label: "Head Chef",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  },
  iron_chef: {
    label: "Iron Chef",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
};

export function SkillTierBadge({ tier }: { tier: SkillTier }) {
  const config = tierConfig[tier];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export { tierConfig };
