/**
 * model-display-names.ts
 *
 * Single source of truth for user-facing model display names.
 * Maps internal model keys (as stored in DB / provider routing) to
 * human-readable labels shown in the UI.
 *
 * Rules:
 *  - This file is client-safe: no Node.js imports, no server-only deps.
 *  - Never mutate MODEL_DISPLAY_NAMES at runtime.
 *  - All new models MUST be added here before shipping any UI that shows them.
 *  - Internal keys (e.g. seedream-v5-lite) must NOT be added as display entries;
 *    they are billing-only and must never surface in user-facing UI.
 */

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // ── OpenAI GPT Image ───────────────────────────────────────────────────────
  "dalle3":               "GPT Image 1.5",  // safety net — internal UI model ID; must never reach URL/display raw
  "gpt-image-1":          "GPT Image 1.5",  // legacy DB alias → same display
  "gpt-image-1.5":        "GPT Image 1.5",
  "gpt-image-2":          "GPT Image 2",

  // ── Nano Banana ───────────────────────────────────────────────────────────
  "nano-banana-standard": "Nano Banana",
  "nano-banana-pro":      "Nano Banana Pro",
  "nano-banana-2":        "Nano Banana 2",

  // ── Seedream (ByteDance) ──────────────────────────────────────────────────
  "seedream-v5":          "Seedream v5 Lite",
  "seedream-4-5":         "Seedream 4.5",
  // Note: seedream-v5-lite is intentionally omitted — internal/billing key only

  // ── FLUX ──────────────────────────────────────────────────────────────────
  "flux-kontext":         "FLUX Kontext",

  // ── Kling (Kuaishou) ──────────────────────────────────────────────────────
  "kling-30":             "Kling 3.0",
  "kling-30-omni":        "Kling 3.0 Omni",
  "kling-26":             "Kling 2.6",
  "kling-25":             "Kling 2.5 Turbo",

  // ── Seedance (ByteDance) ──────────────────────────────────────────────────
  "seedance-20":          "Seedance 2.0",
  "seedance-20-fast":     "Seedance 2.0 Fast",  // NOT "Express"
  "seedance-15":          "Seedance 1.5 Pro",

  // ── Audio / Lip Sync ─────────────────────────────────────────────────────
  "elevenlabs":           "ElevenLabs v3",
  "elevenlabs-premium":   "ElevenLabs v3 Premium",
  "sync-lipsync-v3":      "Studio Lip Sync",    // NOT "Sync Lip Sync v3"

  // ── Creative Director (Workflow) ─────────────────────────────────────────
  "reference-stack-render": "Creative Director",

  // ── Zencra FCS (LTX) ─────────────────────────────────────────────────────
  "fcs_ltx23_pro":        "Cine Pro",
  "fcs_ltx23_director":   "Cine Director",
} as const;

/**
 * Returns the user-facing display name for a given internal model key.
 *
 * Falls back to the raw key if no mapping is found — this ensures the UI
 * never silently breaks when a new model ships before its display name is
 * registered here.
 *
 * @param modelKey - Internal model key (e.g. "gpt-image-1", "seedream-4-5")
 * @returns Human-readable label safe for display in any UI surface
 */
export function getDisplayModelName(modelKey: string | null | undefined): string {
  if (!modelKey) return "";
  return MODEL_DISPLAY_NAMES[modelKey] ?? modelKey;
}

export { MODEL_DISPLAY_NAMES };
