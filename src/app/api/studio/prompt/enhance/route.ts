/**
 * POST /api/studio/prompt/enhance
 *
 * AI-powered prompt enhancement for Zencra studios.
 * Takes a rough user prompt and returns a detailed, model-aware,
 * cinematically rich version using OpenAI gpt-4o-mini (fast, cheap,
 * uses the same key already powering image generation).
 *
 * No credits are consumed — this is a free UX utility, not a generation.
 *
 * Request body:
 *   {
 *     prompt:      string           — the raw prompt to enhance (required)
 *     studioType:  "image"|"video"  — controls system prompt style (required)
 *     modelHint?:  string           — registry model ID for tone tuning (optional)
 *   }
 *
 * Response 200:
 *   { enhancedPrompt: string }
 *
 * Errors:
 *   401  UNAUTHORIZED   — missing/invalid Bearer token
 *   400  INVALID_INPUT  — missing prompt or studioType
 *   500  SERVER_ERROR   — OpenAI API error
 */

import OpenAI                                    from "openai";
import { requireAuthUser }                       from "@/lib/supabase/server";
import { invalidInput, serverErr, parseBody, requireField }
                                                 from "@/lib/api/route-utils";
import { NextResponse }                          from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Runtime key check ────────────────────────────────────────────────────────
if (!process.env.OPENAI_API_KEY) {
  console.error("[prompt-enhance] OPENAI_API_KEY is NOT set — prompt enhancement will fail");
} else {
  console.log("[prompt-enhance] OPENAI_API_KEY present ✓ (length:", process.env.OPENAI_API_KEY.length, ")");
}

// ── System prompts by studio type ────────────────────────────────────────────

const IMAGE_SYSTEM =
  `You are a professional AI image prompt engineer. Your job is to take a rough, casual prompt from a user and rewrite it into a rich, detailed, technically excellent image generation prompt.

Rules:
- Preserve the user's core subject, scene, and intent exactly — never change what they want to create
- Add visual detail: lighting type, mood, color palette, texture, composition, depth of field
- Add photographic or artistic style if not already specified: photography style, film stock, art movement, or medium
- Add quality/rendering cues: "hyperrealistic", "cinematic", "editorial photography", "digital painting", etc. — only what fits
- Output ONLY the enhanced prompt — no explanation, no prefix, no quotes, no commentary
- Keep the result between 40 and 160 words
- Write in natural English, not a comma-separated tag list
- Do not include NSFW content`;

const VIDEO_SYSTEM =
  `You are a professional AI video prompt engineer. Your job is to take a rough, casual prompt from a user and rewrite it into a rich, detailed prompt optimised for AI video generation.

Rules:
- Preserve the user's core subject, scene, and intent exactly — never change what they want to create
- Add camera motion: dolly, pan, orbit, tracking shot, crane, handheld, static lock-off, etc.
- Add physical motion: how subjects, elements, and the environment move and behave
- Add cinematic quality: lighting, atmosphere, colour grade, visual style
- Add lens/format cues: focal length, depth of field, film grain if appropriate
- Output ONLY the enhanced prompt — no explanation, no prefix, no quotes, no commentary
- Keep the result between 40 and 140 words
- Write in natural English; comma-separated phrases for motion descriptors are fine
- Do not include NSFW content`;

// ── Model-specific context hints ─────────────────────────────────────────────

function modelContext(modelHint: string, studioType: string): string {
  if (studioType === "image") {
    if (modelHint.startsWith("nano-banana-2")) {
      return "\n\nModel note: This prompt targets Nano Banana 2. Use dense, grounded visual language — specific lighting setups, material surfaces, photographic detail. Avoid abstract metaphors.";
    }
    if (modelHint.startsWith("nano-banana")) {
      return "\n\nModel note: This prompt targets Nano Banana. Clear subject/scene descriptions with strong visual language. Include mood, lighting direction, and compositional framing.";
    }
    if (modelHint === "dalle3" || modelHint.includes("gpt-image")) {
      return "\n\nModel note: This prompt targets GPT Image 1. It follows detailed natural-language instructions closely. Be descriptive and specific.";
    }
    if (modelHint.includes("seedream")) {
      return "\n\nModel note: This prompt targets Seedream. Rich scene composition with emotional tone, colour palette, and artistic style references.";
    }
  }
  if (studioType === "video") {
    if (modelHint.startsWith("kling")) {
      return "\n\nModel note: This prompt targets Kling. Kling excels at physically accurate motion. Describe subject movement, camera path, and environmental physics precisely. Use strong motion verbs.";
    }
    if (modelHint.startsWith("seedance")) {
      return "\n\nModel note: This prompt targets Seedance. Emphasise fluid, continuous motion arcs, environment dynamics, and cinematographic flow.";
    }
  }
  return "";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  void user;

  // ── Parse body ────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody<{
    prompt:      string;
    studioType:  string;
    modelHint?:  string;
  }>(req);
  if (parseError) return parseError;

  const b = body as { prompt: string; studioType: string; modelHint?: string };

  const { value: rawPrompt, fieldError: promptErr } = requireField(b as Record<string, unknown>, "prompt");
  if (promptErr) return promptErr;

  const { value: studioType, fieldError: typeErr } = requireField(b as Record<string, unknown>, "studioType");
  if (typeErr) return typeErr;

  const modelHint = (b.modelHint ?? "").trim();

  if (rawPrompt.length > 2000) return invalidInput("prompt too long (max 2000 chars)");
  if (!["image", "video"].includes(studioType)) {
    return invalidInput("studioType must be 'image' or 'video'");
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const baseSystem = studioType === "video" ? VIDEO_SYSTEM : IMAGE_SYSTEM;
  const system     = baseSystem + modelContext(modelHint, studioType);

  // ── Call OpenAI gpt-4o-mini ───────────────────────────────────────────────
  // Uses the same OPENAI_API_KEY already powering image generation — no new key needed.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return serverErr("OPENAI_API_KEY is not configured");

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model:      "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: `Enhance this prompt:\n\n${rawPrompt}` },
      ],
    });

    const enhanced = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!enhanced) {
      console.error("[prompt-enhance] OpenAI returned empty content", completion);
      return serverErr("Prompt enhancement returned empty result");
    }

    console.log("[prompt-enhance] success — enhanced prompt length:", enhanced.length);
    return NextResponse.json({ enhancedPrompt: enhanced }, { status: 200 });

  } catch (err: unknown) {
    // Surface OpenAI error details fully in server logs
    const status  = (err as { status?: number })?.status;
    const message = (err as { message?: string })?.message ?? String(err);
    console.error("[prompt-enhance] OpenAI error", "status:", status, "message:", message, err);
    return serverErr(`Prompt enhancement failed: ${message}`);
  }
}
