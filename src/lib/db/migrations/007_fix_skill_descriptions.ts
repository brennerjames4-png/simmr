import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Fixing skill descriptions to be generic...");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const skills = await sql`SELECT id, name, tier, category, description FROM skills ORDER BY name`;
  console.log(`Found ${skills.length} skills to update`);

  const skillList = skills.map((s) => `- ${s.name} (${s.tier}, ${s.category}): "${s.description}"`).join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Rewrite each skill description to be GENERIC — describing the cooking technique itself, NOT referencing any specific dish, recipe, ingredient, or meal. Each description should be one sentence, under 200 characters, and explain what the technique IS in general cooking terms.

Current skills:
${skillList}

Return a JSON array with "name" and "description" for each:
[{"name": "Skill Name", "description": "Generic description"}]

Return ONLY the JSON array.`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) {
    console.error("No text response from AI");
    return;
  }

  let cleaned = textBlock.text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const updates: { name: string; description: string }[] = JSON.parse(cleaned);

  for (const update of updates) {
    await sql`UPDATE skills SET description = ${update.description} WHERE name = ${update.name}`;
    console.log(`  Updated: ${update.name} → ${update.description}`);
  }

  console.log("Done!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
