/**
 * Prompt Composer
 *
 * Pure transformation module — no API calls.
 * Converts a selected CreativeConcept + ParsedBrief into a
 * NormalizedCreativeRenderPrompt, and from there into a final
 * provider-ready string for image generation APIs.
 */

import type {
  CreativeConcept,
  NormalizedCreativeRenderPrompt,
  ParsedBrief,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE NORMALIZED PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * composeNormalizedPrompt — Build a structured NormalizedCreativeRenderPrompt
 * from a selected concept and its parsed brief.
 *
 * This is the canonical intermediate representation. All downstream
 * operations (variation, adaptation, provider string) operate on this.
 */
export function composeNormalizedPrompt(
  concept: CreativeConcept,
  brief: ParsedBrief,
  aspectRatio: string
): NormalizedCreativeRenderPrompt {
  const textIntent = brief.textRenderingIntent ?? "minimal";
  const stylePreset = brief.stylePreset ?? concept.colorStrategy ?? "contemporary";

  // Determine provider hints from concept scores and brief intent
  const prioritizeTextAccuracy =
    textIntent === "ad_text" ||
    textIntent === "poster_text" ||
    textIntent === "typography_first";

  const prioritizeCinematicRealism =
    concept.scores.cinematicImpact >= 7 || (brief.realismVsDesign ?? 0) >= 0.7;

  const prioritizeSpeed = concept.scores.speed >= 8;

  // Build layout instructions from concept's layout strategy
  const layoutInstructions = buildLayoutInstructions(concept, brief);

  // Build typography instructions
  const typographyInstructions = buildTypographyInstructions(concept, brief);

  // Build composition instructions from blueprint
  const compositionInstructions = [
    ...concept.generationBlueprint.compositionRules,
    ...(brief.compositionPreference ? [brief.compositionPreference] : []),
  ];

  // Build lighting instructions from blueprint
  const lightingInstructions = concept.generationBlueprint.lightingRules;

  // Build color instructions
  const colorInstructions = buildColorInstructions(concept, brief);

  // Build negative instructions from avoidElements
  const negativeInstructions = buildNegativeInstructions(concept, brief);

  return {
    promptVersion: "v1",
    mode: "creative_director",
    subject: brief.subject,
    outputIntent: brief.primaryGoal ?? `${brief.projectType} for ${brief.platform ?? "digital media"}`,
    stylePreset,
    conceptTitle: concept.title,
    visualDescription: `${concept.summary}. ${concept.visualFocus}`,
    layoutInstructions,
    typographyInstructions,
    textContent: {
      headline: brief.headline ?? undefined,
      subheadline: brief.subheadline ?? undefined,
      cta: brief.cta ?? undefined,
      renderingIntent: textIntent,
    },
    compositionInstructions,
    lightingInstructions,
    colorInstructions,
    negativeInstructions,
    format: {
      type: brief.projectType,
      aspectRatio,
    },
    providerHints: {
      prioritizeTextAccuracy,
      prioritizeCinematicRealism,
      prioritizeSpeed,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE PROMPT TO STRING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizedPromptToString — Convert a NormalizedCreativeRenderPrompt into
 * a single string suitable for image generation APIs.
 *
 * Ordering:
 * 1. Subject + visual description
 * 2. Style preset
 * 3. Layout instructions
 * 4. Lighting instructions
 * 5. Color instructions
 * 6. Typography + text content
 * 7. Composition instructions
 * 8. Rendering notes (from concept blueprint, if embedded)
 * 9. Negative suffix (--no format)
 */
export function normalizedPromptToString(
  normalized: NormalizedCreativeRenderPrompt
): string {
  const parts: string[] = [];

  // Subject and visual description
  parts.push(normalized.subject);
  if (normalized.visualDescription) {
    parts.push(normalized.visualDescription);
  }

  // Style
  if (normalized.stylePreset) {
    parts.push(`${normalized.stylePreset} style`);
  }

  // Layout
  if (normalized.layoutInstructions.length > 0) {
    parts.push(normalized.layoutInstructions.join(", "));
  }

  // Lighting
  if (normalized.lightingInstructions.length > 0) {
    parts.push(normalized.lightingInstructions.join(", "));
  }

  // Color
  if (normalized.colorInstructions.length > 0) {
    parts.push(normalized.colorInstructions.join(", "));
  }

  // Text content — only include if intent requires it
  const { textContent } = normalized;
  if (
    textContent.renderingIntent !== "none" &&
    (textContent.headline || textContent.cta)
  ) {
    const textParts: string[] = [];
    if (textContent.headline) {
      textParts.push(`headline text: "${textContent.headline}"`);
    }
    if (textContent.subheadline) {
      textParts.push(`subheadline: "${textContent.subheadline}"`);
    }
    if (textContent.cta) {
      textParts.push(`CTA: "${textContent.cta}"`);
    }
    if (textParts.length > 0) {
      parts.push(textParts.join(", "));
    }
  }

  // Typography instructions
  if (normalized.typographyInstructions.length > 0) {
    parts.push(normalized.typographyInstructions.join(", "));
  }

  // Composition instructions
  if (normalized.compositionInstructions.length > 0) {
    parts.push(normalized.compositionInstructions.join(", "));
  }

  // Assemble positive prompt
  const positivePrompt = parts.filter(Boolean).join(". ");

  // Negative suffix
  const negatives = normalized.negativeInstructions;
  if (negatives.length > 0) {
    return `${positivePrompt} --no ${negatives.join(", ")}`;
  }

  return positivePrompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildLayoutInstructions(
  concept: CreativeConcept,
  _brief: ParsedBrief
): string[] {
  const instructions: string[] = [];

  if (concept.layoutStrategy) {
    instructions.push(concept.layoutStrategy);
  }

  // Camera style from blueprint
  if (concept.generationBlueprint.cameraStyle) {
    instructions.push(concept.generationBlueprint.cameraStyle);
  }

  return instructions;
}

function buildTypographyInstructions(
  concept: CreativeConcept,
  brief: ParsedBrief
): string[] {
  const instructions: string[] = [];

  if (concept.typographyStrategy) {
    instructions.push(concept.typographyStrategy);
  }

  // Add text placement rules from blueprint
  const placementRules = concept.generationBlueprint.textPlacementRules;
  if (placementRules.length > 0) {
    instructions.push(...placementRules);
  }

  // Reinforce text accuracy when intent requires it
  if (
    brief.textRenderingIntent === "ad_text" ||
    brief.textRenderingIntent === "poster_text" ||
    brief.textRenderingIntent === "typography_first"
  ) {
    instructions.push("legible text, high contrast typography, clean font rendering");
  }

  return instructions;
}

function buildColorInstructions(
  concept: CreativeConcept,
  brief: ParsedBrief
): string[] {
  const instructions: string[] = [];

  if (concept.colorStrategy) {
    instructions.push(concept.colorStrategy);
  }

  if (brief.colorPreference) {
    instructions.push(brief.colorPreference);
  }

  if (brief.moodTags && brief.moodTags.length > 0) {
    instructions.push(`${brief.moodTags.join(", ")} mood`);
  }

  return instructions;
}

function buildNegativeInstructions(
  _concept: CreativeConcept,
  brief: ParsedBrief
): string[] {
  const negatives: string[] = [
    "blurry",
    "watermark",
    "ugly",
    "distorted",
    "low quality",
  ];

  // Add brief-specified elements to avoid
  if (brief.avoidElements && brief.avoidElements.length > 0) {
    negatives.push(...brief.avoidElements);
  }

  return negatives;
}
