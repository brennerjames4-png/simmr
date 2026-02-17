import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, posts } from "./schema";
import "dotenv/config";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });

  console.log("Seeding database...");

  // Create admin user (password: admin - stored as plain hash for dev only)
  const [adminUser] = await db
    .insert(users)
    .values({
      username: "admin",
      displayName: "Chef Admin",
      email: "admin@simmr.app",
      passwordHash: "admin",
      bio: "The original Simmr chef. Building the cult, one dish at a time.",
    })
    .onConflictDoNothing()
    .returning();

  if (!adminUser) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  console.log("Created admin user:", adminUser.id);

  // Create demo posts
  const demoPosts = [
    {
      userId: adminUser.id,
      title: "Midnight Ramen",
      description:
        "Rich tonkotsu broth simmered for 12 hours. Topped with chashu, soft-boiled egg, nori, and spring onions. The kind of bowl that changes your whole week.",
      recipeNotes:
        "The secret is patience. Low and slow with the pork bones. Don't rush the broth.",
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80",
      tags: ["ramen", "japanese", "soup", "comfort-food"],
      cookTime: 720,
      difficulty: "advanced" as const,
      servings: 4,
      aiTip: "For an even richer broth, split the pork bones before simmering to release more collagen.",
    },
    {
      userId: adminUser.id,
      title: "Sourdough Loaf #47",
      description:
        "Finally nailed the ear. 78% hydration, cold ferment for 16 hours. The crumb is open but not too wild.",
      recipeNotes:
        "Fed the starter 12 hours before mixing. Bulk ferment at room temp for 5 hours with stretch and folds every 30 min.",
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
      tags: ["sourdough", "bread", "baking", "fermentation"],
      cookTime: 60,
      difficulty: "intermediate" as const,
      servings: 1,
      aiTip: "Score at a 30-degree angle with a swift motion for a better ear. A razor blade works better than a knife.",
    },
    {
      userId: adminUser.id,
      title: "Backyard Smash Burgers",
      description:
        "Double patty, American cheese, pickles, special sauce. Sometimes the simple things are the best things.",
      recipeNotes:
        "Use 80/20 ground beef. Ball loosely, smash hard on a screaming hot flat surface. Don't touch it until the edges are crispy.",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
      tags: ["burgers", "grilling", "american", "quick"],
      cookTime: 15,
      difficulty: "beginner" as const,
      servings: 2,
      aiTip: "Place the cheese on the patty and cover with a dome for 30 seconds - the steam melts it perfectly.",
    },
    {
      userId: adminUser.id,
      title: "Thai Green Curry from Scratch",
      description:
        "Made the paste in the mortar and pestle. Lemongrass, galangal, Thai basil, kaffir lime leaves. The real deal.",
      recipeNotes:
        "Pound the paste in order: hard ingredients first (lemongrass, galangal), then softer ones (chilies, garlic, shallots). Fry the paste in coconut cream until the oil splits.",
      imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80",
      tags: ["thai", "curry", "spicy", "from-scratch"],
      cookTime: 45,
      difficulty: "intermediate" as const,
      servings: 4,
      aiTip: "Fry the curry paste until you see oil pooling on the surface - this blooms the aromatics and deepens the flavor.",
    },
    {
      userId: adminUser.id,
      title: "Pasta Aglio e Olio",
      description:
        "The ultimate 4-ingredient pasta. Garlic, olive oil, chili flakes, parsley. Proof that restraint is a superpower in cooking.",
      recipeNotes:
        "Slice garlic thin, cook low and slow in good olive oil. Reserve a full cup of pasta water. Toss everything together off heat.",
      imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80",
      tags: ["pasta", "italian", "quick", "minimalist"],
      cookTime: 20,
      difficulty: "beginner" as const,
      servings: 2,
      aiTip: "The starchy pasta water is your sauce base. Add it gradually while tossing vigorously to create an emulsion.",
    },
  ];

  await db.insert(posts).values(demoPosts);

  console.log(`Created ${demoPosts.length} demo posts`);
  console.log("Seed complete!");
}

seed().catch(console.error);
