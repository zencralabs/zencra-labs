import type {
  GenerationMode,
  GenerationQuality,
  AspectRatio,
  CreditBreakdown,
} from "@/lib/ai/types";

export type CreditCalcInput = {
  mode: GenerationMode;
  quality?: GenerationQuality;
  durationSeconds?: number;
  aspectRatio?: AspectRatio;
};

function getBaseCredits(mode: GenerationMode): number {
  switch (mode) {
    case "image": return 2;
    case "video": return 10;
    case "audio": return 3;
    default:      return 0;
  }
}

function getQualityModifier(quality: GenerationQuality | undefined): number {
  switch (quality) {
    case "draft":     return 0;
    case "cinematic": return 1;
    case "studio":    return 3;
    default:          return 1; // cinematic is default
  }
}

/**
 * Single source of truth for credit cost calculation.
 * Used by both /api/credits/estimate and /api/generate.
 */
export function calculateCredits(input: CreditCalcInput): CreditBreakdown {
  const base = getBaseCredits(input.mode);
  const modifiers: Record<string, number> = {};

  const qualityModifier = getQualityModifier(input.quality);
  if (qualityModifier > 0) {
    modifiers.quality = qualityModifier;
  }

  // Video: each additional 5s block beyond the first costs 1 extra credit
  if (
    input.mode === "video" &&
    input.durationSeconds &&
    input.durationSeconds > 5
  ) {
    modifiers.duration = Math.ceil((input.durationSeconds - 5) / 5);
  }

  const total =
    base + Object.values(modifiers).reduce((sum, v) => sum + v, 0);

  return { base, modifiers, total };
}
