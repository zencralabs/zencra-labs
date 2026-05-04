/**
 * POST /api/creative-director/enhance-text
 *
 * TextNode Prompt Enhancer — AI-powered cinematic rewrite.
 *
 * Takes raw user text from a TextNode and rewrites it as a concise,
 * cinematic still-image prompt that leads generation intent.
 *
 * Rules applied by the model:
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
 * Model: gpt-4o-mini (fast, low-cost, on-task — same key as rest of platform)
 * Rate: inherits standard API auth — no extra credit deduction
 */

import OpenAI        from "openai";
import { NextResponse } from "next/server";
import { getAuthUser }  from "@/lib/supabase/server";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model:      "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: input },
      ],
    });

    const enhanced = (completion.choices[0]?.message?.content ?? "").trim();

    if (!enhanced) {
      return NextResponse.json({ error: "Enhancement produced no output" }, { status: 500 });
    }

    return NextResponse.json({ enhanced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[enhance-text] OpenAI call failed:", msg);
    return NextResponse.json({ error: "Enhancement failed", detail: msg }, { status: 500 });
  }
}
