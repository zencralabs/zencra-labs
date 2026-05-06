/**
 * POST /api/creative-director/enhance-text
 *
 * TextNode Prompt Enhancer — Claude-powered cinematic rewrite.
 *
 * Takes raw user text from a TextNode and rewrites it as a concise,
 * cinematic still-image prompt that leads generation intent.
 *
 * Backed by callClaudeEnhancer() in /lib/ai/claudeEnhancer.ts —
 * the single source of truth for all Claude enhancement on Zencra.
 *
 * Rules applied by Claude:
 *   - Preserve the core subject and emotional intent of the input
 *   - Rewrite as a vivid, concrete still-image description
 *   - No motion language ("moving", "flowing", "dynamic" in temporal sense)
 *   - No video language ("scene", "shot sequence", "footage")
 *   - Output one tight phrase or sentence — not a list
 *   - Do not add unrelated elements or expand scope
 *
 * Body:
 *   text  string  required — raw user text to enhance (max 500 chars)
 *
 * Response:
 *   { enhanced: string }
 *
 * Auth: required (user session)
 * Model: claude-haiku-4-5-20251001 (fast, low-cost, on-task)
 * Rate: inherits standard API auth — no extra credit deduction
 */

import { NextResponse }        from "next/server";
import { getAuthUser }         from "@/lib/supabase/server";
import { callClaudeEnhancer }  from "@/lib/ai/claudeEnhancer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT_CHARS = 500;

const SYSTEM_PROMPT = `You are a cinematic image prompt specialist for an AI creative director.

Your task: rewrite the user's raw text into a precise, vivid still-image prompt.

Rules:
- Preserve the core subject and emotional intent exactly
- Output ONE tight phrase or sentence (not a list, not multiple options)
- Use concrete, sensory, visually grounded language
- No motion language ("moving", "flowing", "rushing", "swirling" as ongoing action)
- No temporal language ("as it", "while", "moments before")
- No video terminology ("scene", "sequence", "footage", "frame rate")
- Do not invent new subjects, settings, or elements not implied by the input
- Do not add generic quality words like "stunning", "beautiful", "amazing"
- Output ONLY the enhanced prompt text — no preamble, no explanation, no quotes`;

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const input = text.trim().slice(0, MAX_INPUT_CHARS);

  const result = await callClaudeEnhancer({
    systemPrompt: SYSTEM_PROMPT,
    userInput:    input,
    maxTokens:    200,
    // model defaults to claude-haiku-4-5-20251001 in claudeEnhancer.ts
  });

  if (!result.ok) {
    console.error("[enhance-text] Claude enhancement failed:", result.error);
    return NextResponse.json(
      { error: "Enhancement failed", detail: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ enhanced: result.text });
}
