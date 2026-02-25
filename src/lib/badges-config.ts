export const BADGE_DEFINITIONS = {
  first_recipe: { name: "First Dish", description: "Published your first recipe", icon: "🍳" },
  five_recipes: { name: "Getting Started", description: "Published 5 recipes", icon: "👨‍🍳" },
  twenty_five_recipes: { name: "Home Cook", description: "Published 25 recipes", icon: "🏠" },
  fifty_recipes: { name: "Dedicated Chef", description: "Published 50 recipes", icon: "⭐" },
  hundred_recipes: { name: "Centurion", description: "Published 100 recipes", icon: "💯" },
  three_day_streak: { name: "On a Roll", description: "Cooked 3 days in a row", icon: "🔥" },
  seven_day_streak: { name: "Week Warrior", description: "Cooked 7 days in a row", icon: "📅" },
  thirty_day_streak: { name: "Monthly Master", description: "Cooked 30 days in a row", icon: "🏆" },
  first_skill_mastered: { name: "Skill Unlocked", description: "Mastered your first cooking skill", icon: "🎯" },
  five_skills_mastered: { name: "Multi-Talented", description: "Mastered 5 cooking skills", icon: "🌟" },
  first_meal_plan: { name: "Meal Planner", description: "Generated your first meal plan", icon: "📋" },
  five_cuisines: { name: "World Traveler", description: "Cooked recipes from 5 different cuisines", icon: "🌍" },
  ten_cuisines: { name: "Globe Trotter", description: "Cooked recipes from 10 different cuisines", icon: "✈️" },
  iron_chef_skill: { name: "Iron Chef", description: "Reached Iron Chef tier in any skill", icon: "🏅" },
} as const;

export type BadgeType = keyof typeof BADGE_DEFINITIONS;
