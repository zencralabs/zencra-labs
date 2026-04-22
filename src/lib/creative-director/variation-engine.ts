/**
 * Variation Engine
 *
 * Builds controlled variation prompts for the 5 V1 variation types.
 * All variations preserve the core subject/concept identity.
 * Pure transformation logic — no API calls.
 *
 * V1 variation types:
 *   premium_pass      — elevated polish, refined materials
 *   minimal_pass      — reduced clutter, more negative space
 *   cinematic_pass    — cinematic lighting, dramatic angle, filmic grade
 *   text_accuracy_pass — stronger text contrast, cleaner readability
 *   product_focus_pass — center product, remove distractions
 */

import type {
  NormalizedCreativeRenderPrompt,
  V1VariationType,
  VariationPrompt,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// VARIATION DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface VariationDefinition {
  preserve: VariationPrompt["preserve"];
  changes: string[];
  strength: VariationPrompt["strength"];
}

const VARIATION_DEFINITIONS: Record<V1VariationType, VariationDefinition> = {
  premium_pass: {
    preserve: {
      subject: true,
      layoutIntent: true,
      textHierarchy: true,
      colorFamily: false, // Allow color refinement
    },
    changes: [
      "increase material polish and surface quality",
      "refine textures with premium finish",
      "add elegant contrast and tonal depth",
      "elevate brand perception with luxury aesthetic",
      "enhance lighting quality for sophisticated feel",
    ],
    strength: "medium",
  },

  minimal_pass: {
    preserve: {
      subject: true,
      layoutIntent: true,
      textHierarchy: true,
      colorFamily: true,
    },
    changes: [
      "reduce visual clutter and secondary elements",
      "increase negative space and breathing room",
      "simplify background and supporting graphics",
      "strip to essential elements only",
      "clean, uncluttered composition",
    ],
    strength: "medium",
  },

  cinematic_pass: {
    preserve: {
      subject: true,
      layoutIntent: false, // Allow dramatic recomposition
      textHierarchy: true,
      colorFamily: false, // Allow filmic color grade
    },
    changes: [
      "cinematic lighting with dramatic shadows",
      "wide angle or dramatic camera perspective",
      "filmic color grade with cinematic color science",
      "depth of field with intentional bokeh",
      "movie-quality atmosphere and volumetric light",
    ],
    strength: "high",
  },

  text_accuracy_pass: {
    preserve: {
      subject: true,
      layoutIntent: true,
      textHierarchy: true,
      colorFamily: true,
    },
    changes: [
      "stronger contrast between text and background",
      "cleaner, uncluttered area behind text elements",
      "more readable typographic hierarchy",
      "improved legibility at small sizes",
      "sharper text rendering with clear outlines",
    ],
    strength: "low",
  },

  product_focus_pass: {
    preserve: {
      subject: true,
      layoutIntent: false, // Re-center on product
      textHierarchy: true,
      colorFamily: false,
    },
    changes: [
      "center product as the undisputed visual hero",
      "remove background distractions and competing elements",
      "clean studio-quality product lighting",
      "product occupies primary focal zone",
      "minimal background to maximize product emphasis",
    ],
    strength: "medium",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildVariationPrompt — Create a VariationPrompt spec for the given type.
 * This is the specification object; use applyVariationToPrompt to get the
 * modified NormalizedCreativeRenderPrompt.
 */
export function buildVariationPrompt(
  base: NormalizedCreativeRenderPrompt,
  variationType: V1VariationType
): VariationPrompt {
  const definition = VARIATION_DEFINITIONS[variationType];
  return {
    variationType,
    preserve: definition.preserve,
    changes: definition.changes,
    strength: definition.strength,
  };
}

/**
 * applyVariationToPrompt — Apply a VariationPrompt to a base prompt,
 * returning a new NormalizedCreativeRenderPrompt.
 *
 * Subject and concept identity are always preserved.
 * Modifications are additive: variation changes are prepended to the
 * relevant instruction arrays.
 */
export function applyVariationToPrompt(
  base: NormalizedCreativeRenderPrompt,
  variation: VariationPrompt
): NormalizedCreativeRenderPrompt {
  const varType = variation.variationType;
  const definition = VARIATION_DEFINITIONS[varType];

  // Build variation-specific overrides
  const compositionOverrides: string[] = [];
  const lightingOverrides: string[] = [];
  const colorOverrides: string[] = [];
  const layoutOverrides: string[] = [];
  const typographyOverrides: string[] = [];

  // Distribute the variation changes to appropriate instruction arrays
  for (const change of variation.changes) {
    const lower = change.toLowerCase();

    if (
      lower.includes("lighting") ||
      lower.includes("shadow") ||
      lower.includes("light")
    ) {
      lightingOverrides.push(change);
    } else if (
      lower.includes("color") ||
      lower.includes("grade") ||
      lower.includes("tonal") ||
      lower.includes("palette")
    ) {
      colorOverrides.push(change);
    } else if (
      lower.includes("text") ||
      lower.includes("typograph") ||
      lower.includes("readab") ||
      lower.includes("legib") ||
      lower.includes("hierarchy")
    ) {
      typographyOverrides.push(change);
    } else if (
      lower.includes("composition") ||
      lower.includes("camera") ||
      lower.includes("angle") ||
      lower.includes("bokeh") ||
      lower.includes("depth")
    ) {
      compositionOverrides.push(change);
    } else {
      layoutOverrides.push(change);
    }
  }

  // Build the modified prompt
  return {
    ...base,

    // Tag with variation context
    conceptTitle: `${base.conceptTitle} — ${varTypeLabel(varType)}`,

    // Layout: preserve if flagged, otherwise prepend overrides
    layoutInstructions: variation.preserve.layoutIntent
      ? [...layoutOverrides, ...base.layoutInstructions]
      : [...layoutOverrides],

    // Typography: preserve hierarchy, prepend text overrides
    typographyInstructions: variation.preserve.textHierarchy
      ? [...typographyOverrides, ...base.typographyInstructions]
      : typographyOverrides,

    // Composition: merge overrides
    compositionInstructions:
      compositionOverrides.length > 0
        ? [...compositionOverrides, ...base.compositionInstructions]
        : base.compositionInstructions,

    // Lighting: always prepend variation lighting
    lightingInstructions:
      lightingOverrides.length > 0
        ? [...lightingOverrides, ...base.lightingInstructions]
        : base.lightingInstructions,

    // Color: preserve family if flagged
    colorInstructions: variation.preserve.colorFamily
      ? [...colorOverrides, ...base.colorInstructions]
      : colorOverrides.length > 0
        ? colorOverrides
        : base.colorInstructions,

    // Strengthen or relax negative instructions based on strength
    negativeInstructions: buildVariedNegatives(base, variation),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function varTypeLabel(varType: V1VariationType): string {
  const labels: Record<V1VariationType, string> = {
    premium_pass: "Premium",
    minimal_pass: "Minimal",
    cinematic_pass: "Cinematic",
    text_accuracy_pass: "Text Clarity",
    product_focus_pass: "Product Focus",
  };
  return labels[varType];
}

function buildVariedNegatives(
  base: NormalizedCreativeRenderPrompt,
  variation: VariationPrompt
): string[] {
  const negatives = [...base.negativeInstructions];

  // Type-specific negative additions
  switch (variation.variationType) {
    case "minimal_pass":
      negatives.push("cluttered", "busy", "overcrowded", "excessive elements");
      break;
    case "cinematic_pass":
      negatives.push("flat lighting", "studio white background", "commercial look");
      break;
    case "text_accuracy_pass":
      negatives.push("illegible text", "overlapping text", "low contrast text");
      break;
    case "product_focus_pass":
      negatives.push("distracting background", "competing elements", "busy scene");
      break;
    case "premium_pass":
      negatives.push("cheap", "plastic", "low quality materials");
      break;
  }

  return negatives;
}
