/**
 * Provider Cost Rates — Lean v1
 *
 * Static estimated USD cost per generation, keyed by model_key.
 * Used by logProviderCost() to populate provider_cost_log.provider_cost_usd.
 *
 * All values are estimates based on public pricing pages.
 * cost_basis is always "estimated" in v1 — no provider returns actual
 * billed cost in their generation API response.
 *
 * Update rates here as provider pricing changes. The provider_cost_log
 * stores cost_basis = "estimated" so historical data is always auditable.
 *
 * Provider docs:
 *   fal.ai        — fal.ai/pricing
 *   ElevenLabs    — elevenlabs.io/pricing
 *   Nano Banana   — internal pricing, prepaid credits
 *   OpenAI        — openai.com/api/pricing (gpt-image-1)
 *   Kling         — based on Kuaishou API docs
 *   Seedance      — BytePlus usage pricing
 */

export interface ProviderCostRate {
  providerKey:   string;
  /** Estimated USD cost per successful generation */
  costUsd:       number;
  /** Provider-side units consumed (credits, tokens, etc.) */
  costUnits?:    number;
  /** Unit label for the cost_units field */
  unitLabel?:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COST RATE TABLE
// Key = modelKey as used in provider registry
// ─────────────────────────────────────────────────────────────────────────────

const COST_RATES: Record<string, ProviderCostRate> = {

  // ── OpenAI — GPT Image 1 ──────────────────────────────────────────────────
  // Standard quality: ~$0.04/image, HD: ~$0.08/image (1024×1024)
  "gpt-image-1":            { providerKey: "openai",      costUsd: 0.04 },
  "gpt-image-1-hd":         { providerKey: "openai",      costUsd: 0.08 },

  // ── Nano Banana — Standard + NB2 ─────────────────────────────────────────
  // Prepaid credits — estimated at ~$0.01-0.03/image depending on plan tier
  "nano-banana":            { providerKey: "nano-banana",  costUsd: 0.012 },
  "nano-banana-pro":        { providerKey: "nano-banana",  costUsd: 0.018 },
  "nano-banana-2":          { providerKey: "nano-banana",  costUsd: 0.025 },

  // ── fal.ai — Seedream, Flux, LTX ─────────────────────────────────────────
  // fal.ai charges per-run; prices from their pricing page
  "seedream-3":             { providerKey: "fal",          costUsd: 0.04  },
  "flux-dev":               { providerKey: "fal",          costUsd: 0.025 },
  "flux-schnell":           { providerKey: "fal",          costUsd: 0.003 },
  "flux-pro":               { providerKey: "fal",          costUsd: 0.05  },
  "ltx-video-25":           { providerKey: "fal",          costUsd: 0.10  },
  "ltx-video-23":           { providerKey: "fal",          costUsd: 0.08  },

  // ── ElevenLabs — TTS ─────────────────────────────────────────────────────
  // Subscription quota — track character usage, not USD directly.
  // Flat subscription cost amortised: estimate $0.0002/char
  "eleven-multilingual-v2": { providerKey: "elevenlabs",   costUsd: 0.00024, costUnits: 1, unitLabel: "characters" },
  "eleven-turbo-v2":        { providerKey: "elevenlabs",   costUsd: 0.00015, costUnits: 1, unitLabel: "characters" },
  "eleven-flash-v2-5":      { providerKey: "elevenlabs",   costUsd: 0.00008, costUnits: 1, unitLabel: "characters" },
  "kits-ai-voice-clone":    { providerKey: "elevenlabs",   costUsd: 0.002  }, // Kits AI - rough estimate

  // ── Kling — Video ─────────────────────────────────────────────────────────
  // ~$0.14/5s Standard, ~$0.28/5s Professional (based on Kuaishou docs)
  "kling-30":               { providerKey: "kling",        costUsd: 0.14  }, // 5s std
  "kling-26":               { providerKey: "kling",        costUsd: 0.10  },
  "kling-25":               { providerKey: "kling",        costUsd: 0.06  },
  "kling-motion-control":   { providerKey: "kling",        costUsd: 0.18  },

  // ── BytePlus — Seedance ───────────────────────────────────────────────────
  // BytePlus usage-based; estimate $0.08-0.20/generation
  "seedance-20":            { providerKey: "byteplus",     costUsd: 0.12  },
  "seedance-20-fast":       { providerKey: "byteplus",     costUsd: 0.08  },
  "seedance-15-pro":        { providerKey: "byteplus",     costUsd: 0.10  },

  // ── Runway, HeyGen, Creatify (not yet active) ─────────────────────────────
  "runway-gen4":            { providerKey: "runway",       costUsd: 0.20  },
  "heygen-ugc":             { providerKey: "heygen",       costUsd: 0.50  },
  "creatify-ugc":           { providerKey: "creatify",     costUsd: 0.40  },

  // ── Character Studio providers ────────────────────────────────────────────
  // FLUX character generation via fal.ai (identity creation, lookbook, hero)
  "flux-character":         { providerKey: "fal",          costUsd: 0.05  },
  // Stability AI character refinement (inpaint, outpaint, upscale, scene)
  "stability-character":    { providerKey: "stability",    costUsd: 0.04  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up the estimated cost rate for a given modelKey.
 * Returns null if the model is unknown — caller records cost_basis = "unknown".
 */
export function getCostRate(modelKey: string): ProviderCostRate | null {
  return COST_RATES[modelKey] ?? null;
}

/**
 * Get estimated USD cost for a generation.
 * For video/audio, multiply by duration factor if provided.
 *
 * @param modelKey  — registry model key
 * @param params    — optional { durationSeconds } for video/audio rate scaling
 */
export function estimateProviderCostUsd(
  modelKey:   string,
  params?:    { durationSeconds?: number }
): { costUsd: number; costUnits?: number; unitLabel?: string; providerKey: string; basis: "estimated" | "unknown" } {
  const rate = getCostRate(modelKey);

  if (!rate) {
    return { costUsd: 0, providerKey: "unknown", basis: "unknown" };
  }

  let costUsd = rate.costUsd;

  // Scale video cost by duration — base rate is per 5s; multiply for longer clips
  if (params?.durationSeconds && params.durationSeconds > 5) {
    const durationBlocks = params.durationSeconds / 5;
    costUsd = rate.costUsd * durationBlocks;
  }

  return {
    costUsd:    parseFloat(costUsd.toFixed(6)),
    costUnits:  rate.costUnits,
    unitLabel:  rate.unitLabel,
    providerKey: rate.providerKey,
    basis:      "estimated",
  };
}
