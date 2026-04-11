/**
 * Tool Registry
 *
 * Maps (GenerationMode × ProviderName) → the canonical tool string
 * stored in the `generations.tool` DB column.
 *
 * Rules:
 *  - tool names are lowercase, hyphenated, versioned where possible
 *  - each entry should match the real model/product identifier
 *  - adding a new provider = add one entry here; no other file changes needed
 *  - resolveTool() NEVER returns null → DB NOT NULL constraint is always safe
 */

import type { GenerationMode, ProviderName } from "./types";

// ─── Registry ─────────────────────────────────────────────────────────────────
// Key: mode → provider → tool name (stored in DB)
const TOOL_REGISTRY: Record<GenerationMode, Partial<Record<ProviderName, string>>> = {
  image: {
    "dalle":        "dalle-3",
    "nano-banana":  "nano-banana",
    "ideogram":     "ideogram-v2",
  },
  video: {
    "kling":    "kling-v1",
    "seedance": "seedance-v1",
    "heygen":   "heygen-v2",
  },
  audio: {
    "elevenlabs": "elevenlabs-turbo-v2",
    "kits":        "kits-ai-rvc-v1",
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the canonical tool name for a given mode + provider pair.
 *
 * Falls back to `"${provider}-${mode}"` so the DB NOT NULL constraint
 * is always satisfied — even for providers added before the registry
 * is updated.
 *
 * @example
 *   resolveTool("image", "dalle")        // → "dalle-3"
 *   resolveTool("video", "kling")        // → "kling-v1"
 *   resolveTool("audio", "elevenlabs")   // → "elevenlabs-turbo-v2"
 *   resolveTool("image", "heygen")       // → "heygen-image" (fallback)
 */
export function resolveTool(mode: GenerationMode, provider: ProviderName): string {
  return TOOL_REGISTRY[mode]?.[provider] ?? `${provider}-${mode}`;
}

/**
 * Returns every (mode, provider, tool) triple currently registered.
 * Useful for admin tooling, docs generation, and seeding UI dropdowns.
 */
export function listRegisteredTools(): Array<{
  mode: GenerationMode;
  provider: ProviderName;
  tool: string;
}> {
  const out: ReturnType<typeof listRegisteredTools> = [];
  for (const [mode, providers] of Object.entries(TOOL_REGISTRY) as [GenerationMode, Partial<Record<ProviderName, string>>][]) {
    for (const [provider, tool] of Object.entries(providers) as [ProviderName, string][]) {
      if (tool) out.push({ mode, provider, tool });
    }
  }
  return out;
}
