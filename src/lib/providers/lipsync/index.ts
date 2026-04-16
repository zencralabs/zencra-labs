// ─────────────────────────────────────────────────────────────────────────────
// Lip Sync — Provider Registry
//
// Single source of truth for all registered lip sync adapters.
// To swap a provider: update standard.ts or pro.ts and change the env vars.
// The UI never needs to change — only the adapter implementation.
// ─────────────────────────────────────────────────────────────────────────────

import { standardAdapter } from "./standard";
import { proAdapter }      from "./pro";
import type { LipSyncProviderAdapter } from "./adapter";
import type { LipSyncQuality }        from "@/lib/lipsync/status";

export type LipSyncProviderKey = "lipsync_standard" | "lipsync_pro";

/** All registered adapters — key = internal provider key */
export const lipSyncProviders: Record<LipSyncProviderKey, LipSyncProviderAdapter> = {
  lipsync_standard: standardAdapter,
  lipsync_pro:      proAdapter,
};

/**
 * Get a provider adapter by its key.
 * Throws if the key is not registered.
 */
export function getLipSyncProvider(key: LipSyncProviderKey): LipSyncProviderAdapter {
  const adapter = lipSyncProviders[key];
  if (!adapter) {
    throw new Error(`Unknown lip sync provider key: ${key}`);
  }
  return adapter;
}

/**
 * Map a user-facing quality mode ("standard" | "pro") → internal provider key.
 */
export function resolveProviderKey(qualityMode: LipSyncQuality): LipSyncProviderKey {
  return qualityMode === "pro" ? "lipsync_pro" : "lipsync_standard";
}

/**
 * Returns the readiness status of both providers.
 * Used by GET /api/lipsync/providers to tell the frontend what's available.
 */
export function getLipSyncProviderStatus(): { standard: boolean; pro: boolean } {
  return {
    standard: standardAdapter.isReady(),
    pro:      proAdapter.isReady(),
  };
}

export type { LipSyncProviderAdapter } from "./adapter";
