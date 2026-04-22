/**
 * Brief Parser
 *
 * Converts raw user brief fields into a structured ParsedBrief JSON object.
 * Uses CREATIVE_DIRECTOR_TEXT_MODEL (env var, default: "gpt-4o") with
 * response_format: json_object.
 *
 * Rules:
 * - Never generates image prompts — only parses creative intent
 * - Uses low temperature (0.3) for consistent, deterministic parsing
 * - Returns a ParsedBrief that feeds into concept-engine.ts
 */

import OpenAI from "openai";
import type { ParsedBrief } from "./types";

// Use CREATIVE_DIRECTOR_TEXT_MODEL env alias — never hardcode model name
const CREATIVE_DIRECTOR_TEXT_MODEL =
  process.env.CREATIVE_DIRECTOR_TEXT_MODEL ?? "gpt-4o";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const BRIEF_PARSER_SYSTEM_PROMPT = `You are an expert creative strategist and art director.
Your job is to analyze a creative brief and return a structured JSON object.

Rules:
- Return ONLY valid JSON, no other text
- Never generate image prompts yet
- Infer missing fields conservatively
- If text is heavy, set textRenderingIntent appropriately
- moodTags should be 1-4 single words (e.g. "bold", "elegant", "energetic")
- realismVsDesign: 0 = pure graphic design, 1 = photorealistic

Required JSON structure:
{
  "projectType": string,
  "subject": string,
  "productOrBrand": string | null,
  "audience": string | null,
  "platform": string | null,
  "primaryGoal": string | null,
  "headline": string | null,
  "subheadline": string | null,
  "cta": string | null,
  "stylePreset": string | null,
  "moodTags": string[],
  "textRenderingIntent": "none" | "minimal" | "ad_text" | "poster_text" | "typography_first",
  "realismVsDesign": number,
  "colorPreference": string | null,
  "compositionPreference": string | null,
  "avoidElements": string[],
  "suggestions": string[]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface BriefParserInput {
  projectType: string;
  brandName?: string;
  audience?: string;
  platform?: string;
  goal?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  additionalNotes?: string;
  stylePreset?: string;
  moodTags?: string[];
  visualIntensity?: string;
  textRenderingIntent?: string;
  realismVsDesign?: number;
  colorPreference?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseBrief — Convert raw brief fields into a structured ParsedBrief.
 *
 * Calls OpenAI with response_format: json_object to guarantee parseable output.
 * Throws on API failure or unparseable JSON.
 */
export async function parseBrief(input: BriefParserInput): Promise<ParsedBrief> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = `Parse this creative brief:

Project Type: ${input.projectType}
Brand/Product: ${input.brandName ?? "not specified"}
Audience: ${input.audience ?? "not specified"}
Platform: ${input.platform ?? "not specified"}
Goal: ${input.goal ?? "not specified"}
Headline: ${input.headline ?? "not specified"}
Subheadline: ${input.subheadline ?? "not specified"}
CTA: ${input.cta ?? "not specified"}
Style Preset: ${input.stylePreset ?? "not specified"}
Mood Tags (user selected): ${input.moodTags?.join(", ") ?? "not specified"}
Visual Intensity: ${input.visualIntensity ?? "not specified"}
Text Rendering: ${input.textRenderingIntent ?? "not specified"}
Realism vs Design (0-1): ${input.realismVsDesign ?? "not specified"}
Color Preference: ${input.colorPreference ?? "not specified"}
Additional Notes: ${input.additionalNotes ?? "none"}

Return a structured ParsedBrief JSON.`;

  const response = await client.chat.completions.create({
    model: CREATIVE_DIRECTOR_TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: BRIEF_PARSER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("[brief-parser] No content in OpenAI response");
  }

  try {
    return JSON.parse(raw) as ParsedBrief;
  } catch {
    throw new Error("[brief-parser] Failed to parse JSON response from OpenAI");
  }
}
