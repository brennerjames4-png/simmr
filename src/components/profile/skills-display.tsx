"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SkillTierBadge, tierConfig } from "@/components/profile/skill-tier-badge";
import { Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { UserSkillWithDetails } from "@/queries/skills";
import type { SkillTier, SkillCategory } from "@/lib/db/schema";
import { MASTERY_THRESHOLDS } from "@/lib/skills-config";
import { formatDistanceToNow } from "date-fns";

const categoryConfig: Record<SkillCategory, { label: string }> = {
  technique: { label: "Techniques" },
  knife_work: { label: "Knife Work" },
  baking_pastry: { label: "Baking & Pastry" },
  specialty: { label: "Specialty" },
};

const categoryOrder: SkillCategory[] = [
  "technique",
  "knife_work",
  "baking_pastry",
  "specialty",
];

const tierOrder: Record<SkillTier, number> = {
  prep_cook: 0,
  line_cook: 1,
  sous_chef: 2,
  head_chef: 3,
  iron_chef: 4,
};

interface SkillsDisplayProps {
  skills: UserSkillWithDetails[];
  isOwner: boolean;
}

export function SkillsDisplay({ skills, isOwner }: SkillsDisplayProps) {
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <p className="text-muted-foreground">
          {isOwner
            ? "No skills yet. Publish a recipe to start earning skills!"
            : "No skills earned yet."}
        </p>
      </div>
    );
  }

  const masteredSkills = skills.filter((s) => s.mastered);
  const inProgressSkills = skills.filter((s) => !s.mastered);

  // Group by category
  const groupSkills = (list: UserSkillWithDetails[]) => {
    const grouped = new Map<SkillCategory, UserSkillWithDetails[]>();
    for (const skill of list) {
      if (!grouped.has(skill.category)) grouped.set(skill.category, []);
      grouped.get(skill.category)!.push(skill);
    }
    for (const [, skillList] of grouped) {
      skillList.sort(
        (a, b) => (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0)
      );
    }
    return grouped;
  };

  const masteredGrouped = groupSkills(masteredSkills);
  const inProgressGrouped = groupSkills(inProgressSkills);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="text-center">
          <p className="font-bold text-lg">{masteredSkills.length}</p>
          <p className="text-muted-foreground">Mastered</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">{inProgressSkills.length}</p>
          <p className="text-muted-foreground">In Progress</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {(Object.keys(tierConfig) as SkillTier[]).map((tier) => {
            const count = skills.filter((s) => s.tier === tier).length;
            if (count === 0) return null;
            return (
              <div key={tier} className="flex items-center gap-1">
                <span className="text-xs font-medium">{count}</span>
                <SkillTierBadge tier={tier} />
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* In Progress Skills */}
      {inProgressSkills.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">In Progress</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgressSkills
              .sort((a, b) => {
                const aProgress = a.practiceCount / MASTERY_THRESHOLDS[a.tier];
                const bProgress = b.practiceCount / MASTERY_THRESHOLDS[b.tier];
                return bProgress - aProgress;
              })
              .map((skill) => {
                const threshold = MASTERY_THRESHOLDS[skill.tier];
                const progress = Math.min(skill.practiceCount / threshold, 1);
                return (
                  <Card key={skill.id} className="p-4 space-y-2">
                    {/* Video display disabled */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">{skill.name}</h3>
                      <SkillTierBadge tier={skill.tier} />
                    </div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground">
                        {skill.description}
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {skill.practiceCount} / {threshold} recipes
                        </span>
                        <span className="font-medium">
                          {Math.round(progress * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Started{" "}
                        {formatDistanceToNow(new Date(skill.earnedAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {skill.postId && (
                        <Link
                          href={`/post/${skill.postId}`}
                          className="text-primary hover:underline truncate ml-2"
                        >
                          Latest recipe
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Mastered Skills */}
      {masteredSkills.length > 0 && (
        <div className="space-y-4">
          {inProgressSkills.length > 0 && <Separator />}
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Mastered
          </h2>
          {categoryOrder.map((cat) => {
            const catSkills = masteredGrouped.get(cat);
            if (!catSkills || catSkills.length === 0) return null;
            const catConfig = categoryConfig[cat];

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {catConfig.label}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catSkills.map((skill) => (
                    <Card key={skill.id} className="p-4 space-y-2 border-green-500/20">
                      {skill.videoUrl && (
                        <div className="rounded-md overflow-hidden aspect-video bg-muted -mx-4 -mt-4 mb-2">
                          <video
                            src={skill.videoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          {skill.name}
                        </h3>
                        <SkillTierBadge tier={skill.tier} />
                      </div>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Mastered{" "}
                          {skill.masteredAt
                            ? formatDistanceToNow(new Date(skill.masteredAt), {
                                addSuffix: true,
                              })
                            : formatDistanceToNow(new Date(skill.earnedAt), {
                                addSuffix: true,
                              })}
                        </span>
                        {skill.postId && skill.postTitle && (
                          <Link
                            href={`/post/${skill.postId}`}
                            className="text-primary hover:underline truncate ml-2"
                          >
                            {skill.postTitle}
                          </Link>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
