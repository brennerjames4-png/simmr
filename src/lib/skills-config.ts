import type { SkillTier } from "@/lib/db/schema";

/**
 * Mastery thresholds — how many times a user must practice
 * a skill (via publishing recipes) before it's fully mastered.
 * Easier skills unlock faster, harder skills require more reps.
 */
export const MASTERY_THRESHOLDS: Record<SkillTier, number> = {
  prep_cook: 2,   // two recipes
  line_cook: 4,   // four recipes
  sous_chef: 6,   // six recipes
  head_chef: 10,  // ten recipes
  iron_chef: 16,  // sixteen recipes
};
