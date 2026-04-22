/**
 * Format Adapter
 *
 * Transforms a NormalizedCreativeRenderPrompt for 3 target formats.
 * Pure transformation logic — no API calls.
 *
 * V1 format targets:
 *   story       → 9:16  vertical, text top or bottom, hero center
 *   square_post → 1:1   balanced, center composition, text overlay bottom third
 *   banner      → 16:9 or 21:9, horizontal, text left, subject right
 */

import type {
  FormatAdaptation,
  NormalizedCreativeRenderPrompt,
  V1AdaptationTarget,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT SPECS
// ─────────────────────────────────────────────────────────────────────────────

interface FormatSpec {
  aspectRatio: string;
  layoutAdjustments: string[];
  compositionShifts: string[];
}

const FORMAT_SPECS: Record<V1AdaptationTarget, FormatSpec> = {
  story: {
    aspectRatio: "9:16",
    layoutAdjustments: [
      "vertical portrait orientation",
      "tall format composition optimized for mobile stories",
      "text positioned in top third or bottom third safe zone",
      "hero visual element centered vertically in middle third",
      "generous padding on left and right edges",
    ],
    compositionShifts: [
      "vertical stacking of visual elements",
      "avoid placing key content at extreme top or bottom (UI overlap zones)",
      "strong vertical leading lines to guide eye downward",
      "subject fills center of vertical frame",
    ],
  },

  square_post: {
    aspectRatio: "1:1",
    layoutAdjustments: [
      "square format balanced composition",
      "centered focal point for feed compatibility",
      "text overlay in lower third of frame",
      "equal visual weight on all four sides",
      "bold center-anchored subject placement",
    ],
    compositionShifts: [
      "symmetrical or near-symmetrical balance",
      "subject centered or slightly above center",
      "text confined to bottom 30% with sufficient contrast",
      "avoid extreme horizontal or vertical leading lines",
    ],
  },

  banner: {
    aspectRatio: "16:9",
    layoutAdjustments: [
      "wide horizontal landscape format",
      "text and headline left-aligned in left third of frame",
      "primary subject or product positioned in right half",
      "panoramic composition with horizontal flow",
      "ample breathing room in center for visual separation",
    ],
    compositionShifts: [
      "strong left-to-right visual flow",
      "text block in left safe zone for readability",
      "subject anchored to right side or center-right",
      "horizontal leading lines or environment to support panoramic feel",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * adaptFormat — Transform a NormalizedCreativeRenderPrompt for a target format.
 *
 * Returns a FormatAdaptation containing:
 * - The source prompt
 * - The target format and aspect ratio
 * - Layout adjustments (format-specific positioning rules)
 * - Composition shifts (how the framing changes)
 *
 * The caller uses this to construct a new generation by applying the
 * adaptation to produce a modified NormalizedCreativeRenderPrompt.
 */
export function adaptFormat(
  source: NormalizedCreativeRenderPrompt,
  target: V1AdaptationTarget
): FormatAdaptation {
  const spec = FORMAT_SPECS[target];

  return {
    source,
    targetFormat: target,
    targetAspectRatio: spec.aspectRatio,
    layoutAdjustments: spec.layoutAdjustments,
    compositionShifts: spec.compositionShifts,
  };
}

/**
 * applyFormatAdaptation — Apply a FormatAdaptation to produce a new
 * NormalizedCreativeRenderPrompt ready for generation.
 *
 * Replaces format, layout, and composition instructions with format-specific
 * variants. Preserves subject, style, text content, color, and lighting.
 */
export function applyFormatAdaptation(
  adaptation: FormatAdaptation
): NormalizedCreativeRenderPrompt {
  const { source, targetFormat, targetAspectRatio } = adaptation;

  return {
    ...source,

    // Update format
    format: {
      type: source.format.type,
      aspectRatio: targetAspectRatio,
    },

    // Replace layout instructions with format-specific ones
    layoutInstructions: [
      ...adaptation.layoutAdjustments,
      // Preserve any non-positional layout notes from source
      ...source.layoutInstructions.filter(
        (l) => !isPositionalInstruction(l)
      ),
    ],

    // Prepend format-specific composition shifts
    compositionInstructions: [
      ...adaptation.compositionShifts,
      // Keep non-positional composition notes from source
      ...source.compositionInstructions.filter(
        (c) => !isPositionalInstruction(c)
      ),
    ],

    // Tag concept title with format
    conceptTitle: `${source.conceptTitle} — ${formatLabel(targetFormat)}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatLabel(target: V1AdaptationTarget): string {
  const labels: Record<V1AdaptationTarget, string> = {
    story: "Story (9:16)",
    square_post: "Square Post (1:1)",
    banner: "Banner (16:9)",
  };
  return labels[target];
}

/** Returns true if an instruction describes positional/layout placement */
function isPositionalInstruction(instruction: string): boolean {
  const positionalKeywords = [
    "left", "right", "center", "top", "bottom",
    "horizontal", "vertical", "portrait", "landscape",
    "orientation", "align", "position", "anchor",
    "safe zone", "padding", "frame",
  ];
  const lower = instruction.toLowerCase();
  return positionalKeywords.some((kw) => lower.includes(kw));
}
