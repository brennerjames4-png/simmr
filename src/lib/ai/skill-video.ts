import { getAnthropicClient } from "./client";
import { getFalClient } from "./fal-client";
import { UTApi } from "uploadthing/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const utapi = new UTApi();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecipeData {
  title: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  steps: Array<{
    instruction: string;
    step_number: number;
    duration_minutes?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Prompt generation — the core of the system
// ---------------------------------------------------------------------------

/**
 * Use Claude to generate an extremely detailed, physically-accurate video
 * prompt for Minimax. This prompt must describe EXACTLY what appears on screen
 * during the specific moment this cooking technique is performed in the recipe.
 *
 * The prompt accounts for:
 * - Exact ingredient quantities visible on screen
 * - Correct physical tool mechanics (spoon size, liquid behavior, gravity)
 * - What's already in the cooking vessel from previous steps
 * - The precise physical transformation happening to the food
 * - Accurate motion physics (how liquids pour, how food reacts to heat, etc.)
 */
async function generateVideoPrompt(
  skillName: string,
  description: string | null,
  recipe: RecipeData | null
): Promise<string> {
  const client = getAnthropicClient();
  if (!client || !recipe) {
    // Fallback to basic prompt when no AI or no recipe context
    return `Close-up cinematic shot of ${skillName.toLowerCase()} technique in a home kitchen. ${description || ""}. Photorealistic, warm natural lighting, clean stainless steel cookware. Only hands and cooking surface visible, no face. No text overlays or watermarks.`;
  }

  try {
    const ingredientList = recipe.ingredients
      .map((i) => `${i.quantity} ${i.unit} ${i.name}`)
      .join("\n  - ");

    const stepList = recipe.steps
      .map(
        (s) =>
          `Step ${s.step_number}: ${s.instruction}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ""}`
      )
      .join("\n");

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You write video prompts for Minimax AI video generation. Output ONLY a plain-text scene description — no markdown, no headers, no bold, no bullet points, no formatting. Just flowing prose describing what the camera sees.

The video is 5 seconds long showing one cooking technique. The TECHNIQUE DESCRIPTION below is your PRIMARY DIRECTIVE — it defines EXACTLY what the video must show. Every element mentioned in the description must be visually present. The recipe provides context for quantities and ingredients.

CRITICAL: Read the technique description word by word. If it says "without stirring initially to develop a crust before breaking apart" then the video MUST show: meat with a developed crust on the bottom, then a hand using a spatula to break/flip it apart revealing the browned crust underneath. Show the RESULT of the technique's key action, not the setup.

REQUIREMENTS FOR YOUR PROMPT:

SCENE STATE: Describe what's already in the pan from previous recipe steps. Use actual ingredient names, colors, and states (browned, softened, translucent, etc.).

QUANTITIES: Match real measurements visually. 2 tablespoons of tomato paste = a small concentrated dollop. 500g ground beef = a pan roughly 3/4 full of meat. 100g butter = about 7 tablespoons worth of melting yellow chunks. Get the visual volume right.

TOOL PHYSICS: When a spoon scoops, the amount on it must match the real measurement. When it transfers to food, gravity pulls it down realistically. When a spatula presses meat, juices release. When liquid pours, it flows and splashes naturally.

FOOD REACTIONS: Oil shimmers when hot. Steam rises from hot surfaces. Meat goes from pink to grey-brown and develops dark crust where it contacts the pan. Onions go from opaque white to translucent. Tomato paste darkens from bright red to rust-brown when it hits hot surface. Butter melts from solid yellow chunks into clear golden liquid. Sauce with gentle small bubbles = simmering; violent large bubbles = boiling.

MOTION: The hand movement must match the technique exactly. Sautéing = quick tossing and stirring. Simmering = stillness with gentle bubbling, maybe occasional gentle stir. Browning = food sitting undisturbed, then being broken/flipped. Describe the specific motion: direction, speed, tool angle.

FORMAT RULES:
- Write 80-120 words of plain flowing prose — no markdown formatting whatsoever
- One continuous 5-second shot, no cuts
- State the camera angle in the first sentence (e.g. "45-degree overhead shot looking into a stainless steel pan")
- Only show hands from wrist down, cooking vessel, and one tool — nothing else
- Warm natural kitchen lighting, clean background
- No text, titles, or watermarks
- Photorealistic, like a real cooking video`,
      messages: [
        {
          role: "user",
          content: `RECIPE: "${recipe.title}"

INGREDIENTS:
  - ${ingredientList}

FULL STEPS:
${stepList}

TECHNIQUE NAME: "${skillName}"
TECHNIQUE DESCRIPTION (THIS IS THE PRIMARY DIRECTIVE — every element here MUST be shown): "${description || skillName}"

Write a plain-text video prompt (no markdown) that shows this EXACT technique being performed in this recipe. The video must visually demonstrate every part of the technique description. Use the recipe's actual ingredient names and quantities.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (textBlock) return textBlock.text.trim();
  } catch (error) {
    console.error("Failed to generate video prompt:", error);
  }

  // Fallback
  return `Close-up cinematic shot of ${skillName.toLowerCase()} technique in a home kitchen. ${description || ""}. Photorealistic, warm natural lighting, clean stainless steel cookware. Only hands and cooking surface visible, no face. No text overlays or watermarks.`;
}

// ---------------------------------------------------------------------------
// AI video generation via Minimax (fal.ai)
// ---------------------------------------------------------------------------

/**
 * Generate a video via Minimax on fal.ai, upload to Uploadthing for
 * permanent storage, and save the URL on the skill record.
 */
async function generateAIVideo(
  skillId: string,
  skillName: string,
  description: string | null,
  recipe: RecipeData | null
): Promise<boolean> {
  const fal = getFalClient();
  if (!fal) {
    console.log("  Skipping video generation: FAL_KEY not configured");
    return false;
  }

  try {
    const prompt = await generateVideoPrompt(skillName, description, recipe);
    console.log(`  Generating AI video for "${skillName}"...`);
    console.log(`  Prompt: ${prompt}`);

    const result = await fal.subscribe("fal-ai/minimax/video-01", {
      input: { prompt, prompt_optimizer: true },
    });

    const videoUrl = (result.data as { video?: { url?: string } })?.video?.url;
    if (!videoUrl) {
      console.error("  AI video generation returned no URL");
      return false;
    }

    // Re-upload to Uploadthing for permanent storage
    const uploaded = await utapi.uploadFilesFromUrl({
      url: videoUrl,
      name: `skill-${skillId}.mp4`,
    });

    if (uploaded.error) {
      console.error("  Failed to upload video:", uploaded.error);
      return false;
    }

    const permanentUrl = uploaded.data.ufsUrl;
    await db
      .update(skills)
      .set({ videoUrl: permanentUrl })
      .where(eq(skills.id, skillId));

    console.log(`  Video stored for "${skillName}": ${permanentUrl}`);
    return true;
  } catch (error) {
    console.error(`  Video generation failed for "${skillName}":`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate an AI cooking technique video for a skill.
 *
 * Pipeline:
 * 1. Claude reads the full recipe and generates a hyper-detailed,
 *    physically-accurate video prompt for the exact moment the
 *    technique is performed
 * 2. Minimax (via fal.ai) generates a 5-second video from the prompt
 * 3. Video is uploaded to Uploadthing for permanent storage
 * 4. Skill record is updated with the video URL
 *
 * This function never throws — errors are logged and swallowed.
 *
 * @param skillId - Database ID of the skill
 * @param skillName - Name of the cooking technique
 * @param description - Optional description of the technique
 * @param recipeContext - Optional recipe title for logging
 * @param recipeData - Full recipe data (ingredients + steps) for prompt generation
 */
export async function generateSkillVideo(
  skillId: string,
  skillName: string,
  description: string | null,
  recipeContext?: string | null,
  recipeData?: RecipeData | null
): Promise<void> {
  try {
    console.log(
      `Generating video for "${skillName}"${recipeContext ? ` (from: ${recipeContext})` : ""}...`
    );

    const success = await generateAIVideo(
      skillId,
      skillName,
      description,
      recipeData ?? null
    );

    if (!success) {
      console.log(`  Could not generate video for "${skillName}"`);
    }
  } catch (error) {
    console.error(`Skill video failed for "${skillName}":`, error);
  }
}
