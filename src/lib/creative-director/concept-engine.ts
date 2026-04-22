/**
 * Concept Engine
 *
 * Generates exactly 3 distinct creative concept directions from a ParsedBrief.
 * Uses CREATIVE_DIRECTOR_TEXT_MODEL (default: gpt-4o) at temperature 0.7 for
 * creative variation. Each concept differs in layout strategy, visual tone,
 * or typography approach.
 *
 * Supported providers for recommendations: openai, nano-banana, seedream, flux
 */

import OpenAI from "openai";
import type { CreativeConcept, ParsedBrief } from "./types";
import type { BriefParserInput } from "./brief-parser";

// Use CREATIVE_DIRECTOR_TEXT_MODEL env alias — never hardcode model name
const CREATIVE_DIRECTOR_TEXT_MODEL =
  process.env.CREATIVE_DIRECTOR_TEXT_MODEL ?? "gpt-4o";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const CONCEPT_ENGINE_SYSTEM_PROMPT = `You are an expert creative director generating distinct visual concepts for ad campaigns and branded content.

Generate exactly 3 creative concepts based on the provided brief. Each concept MUST differ from the others in at least one of:
- Layout strategy (e.g., centered vs. asymmetric vs. grid-based)
- Visual tone (e.g., minimal vs. bold vs. editorial)
- Typography approach (e.g., text-heavy vs. icon-led vs. image-dominant)

For each concept, recommend one image generation provider from this exact list:
- "openai" — best for: text accuracy, clean ad layouts, product shots with text
- "nano-banana" — best for: luxury brands, high-end editorial, cinematic lifestyle
- "seedream" — best for: fast iteration, social content, lifestyle imagery
- "flux" — best for: editorial fashion, fantasy, streetwear, artistic styles

Return ONLY valid JSON with this exact structure:
{
  "concepts": [
    {
      "title": "string — short, memorable concept name (3-5 words)",
      "summary": "string — 1-2 sentences describing the visual direction",
      "rationale": "string — why this approach fits the brief",
      "layoutStrategy": "string — how elements are arranged spatially",
      "typographyStrategy": "string — how text/type is treated",
      "colorStrategy": "string — color palette and mood approach",
      "visualFocus": "string — main visual hero element",
      "providerRecommendation": {
        "provider": "openai" | "nano-banana" | "seedream" | "flux",
        "model": "string — specific model name",
        "reason": "string — why this provider suits this concept"
      },
      "scores": {
        "textAccuracy": number (0-10),
        "cinematicImpact": number (0-10),
        "designControl": number (0-10),
        "speed": number (0-10)
      },
      "generationBlueprint": {
        "cameraStyle": "string or null",
        "compositionRules": ["string"],
        "lightingRules": ["string"],
        "textPlacementRules": ["string"],
        "renderingNotes": ["string"]
      }
    }
  ]
}

Model name mapping for recommendations:
- openai → "gpt-image-1"
- nano-banana (standard) → "nano-banana-standard"
- nano-banana (pro/luxury) → "nano-banana-pro"
- seedream → "fal-ai/seedream-3"
- flux → "fal-ai/flux-pro/kontext"`;

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateConcepts — Produce exactly 3 concept directions.
 *
 * @param parsedBrief - Structured brief from brief-parser.ts
 * @param briefInput  - Raw brief fields for additional context
 * @returns Array of exactly 3 CreativeConcept objects
 * @throws If OpenAI fails, JSON is invalid, or fewer than 3 concepts returned
 */
export async function generateConcepts(
  parsedBrief: ParsedBrief,
  briefInput: BriefParserInput
): Promise<CreativeConcept[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = buildConceptPrompt(parsedBrief, briefInput);

  const response = await client.chat.completions.create({
    model: CREATIVE_DIRECTOR_TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CONCEPT_ENGINE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("[concept-engine] No content in OpenAI response");
  }

  let parsed: { concepts?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { concepts?: unknown[] };
  } catch {
    throw new Error("[concept-engine] Failed to parse JSON response from OpenAI");
  }

  if (!Array.isArray(parsed.concepts)) {
    throw new Error("[concept-engine] Response missing 'concepts' array");
  }

  if (parsed.concepts.length < 3) {
    throw new Error(
      `[concept-engine] Expected 3 concepts, got ${parsed.concepts.length}`
    );
  }

  // Validate and normalize each concept, slice to exactly 3
  const concepts = parsed.concepts.slice(0, 3).map((raw, idx) =>
    normalizeConcept(raw, idx)
  );

  return concepts;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildConceptPrompt(brief: ParsedBrief, input: BriefParserInput): string {
  return `Generate 3 creative concepts for this brief:

PROJECT TYPE: ${brief.projectType}
SUBJECT: ${brief.subject}
BRAND/PRODUCT: ${brief.productOrBrand ?? input.brandName ?? "not specified"}
AUDIENCE: ${brief.audience ?? input.audience ?? "not specified"}
PLATFORM: ${brief.platform ?? input.platform ?? "not specified"}
PRIMARY GOAL: ${brief.primaryGoal ?? "not specified"}

COPY:
- Headline: ${brief.headline ?? "none"}
- Subheadline: ${brief.subheadline ?? "none"}
- CTA: ${brief.cta ?? "none"}
- Text rendering intent: ${brief.textRenderingIntent ?? "minimal"}

VISUAL DIRECTION:
- Style preset: ${brief.stylePreset ?? "not specified"}
- Mood tags: ${brief.moodTags?.join(", ") ?? "none"}
- Realism vs Design (0=design, 1=realism): ${brief.realismVsDesign ?? 0.5}
- Color preference: ${brief.colorPreference ?? "not specified"}
- Composition: ${brief.compositionPreference ?? "not specified"}
- Avoid: ${brief.avoidElements?.join(", ") ?? "nothing specified"}

AI SUGGESTIONS FROM BRIEF ANALYSIS:
${brief.suggestions?.map((s) => `- ${s}`).join("\n") ?? "none"}

Generate 3 DISTINCT concepts — each must take a clearly different creative direction.`;
}

function normalizeConcept(raw: unknown, _idx: number): CreativeConcept {
  // Cast with reasonable defaults for any missing fields
  const c = raw as Record<string, unknown>;

  const blueprint = (c.generationBlueprint as Record<string, unknown> | undefined) ?? {};
  const scores = (c.scores as Record<string, unknown> | undefined) ?? {};
  const providerRec =
    (c.providerRecommendation as Record<string, unknown> | undefined) ?? {};

  return {
    title: String(c.title ?? "Untitled Concept"),
    summary: String(c.summary ?? ""),
    rationale: String(c.rationale ?? ""),
    layoutStrategy: String(c.layoutStrategy ?? ""),
    typographyStrategy: String(c.typographyStrategy ?? ""),
    colorStrategy: String(c.colorStrategy ?? ""),
    visualFocus: String(c.visualFocus ?? ""),
    providerRecommendation: {
      provider: String(providerRec.provider ?? "openai"),
      model: String(providerRec.model ?? "gpt-image-1"),
      reason: String(providerRec.reason ?? ""),
    },
    scores: {
      textAccuracy: Number(scores.textAccuracy ?? 5),
      cinematicImpact: Number(scores.cinematicImpact ?? 5),
      designControl: Number(scores.designControl ?? 5),
      speed: Number(scores.speed ?? 5),
    },
    generationBlueprint: {
      cameraStyle: blueprint.cameraStyle != null
        ? String(blueprint.cameraStyle)
        : undefined,
      compositionRules: asStringArray(blueprint.compositionRules),
      lightingRules: asStringArray(blueprint.lightingRules),
      textPlacementRules: asStringArray(blueprint.textPlacementRules),
      renderingNotes: asStringArray(blueprint.renderingNotes),
    },
  };
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map(String);
}
