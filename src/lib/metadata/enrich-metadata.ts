/**
 * Enrich Metadata — Orchestrator
 *
 * Takes a completed asset's generation_metadata, runs the prompt parser,
 * and persists the resulting EnrichedMetadata to the `assets` table.
 *
 * Called fire-and-forget from saveAssetMetadata().
 * Never throws — errors are swallowed to avoid disrupting generation flow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationMetadata, EnrichedMetadata } from "./types";
import { parsePrompt } from "./prompt-parser";

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHMENT SCHEMA VERSION
// ─────────────────────────────────────────────────────────────────────────────

/** Bump this when the enrichment output shape changes (triggers backfill detection). */
const ENRICHMENT_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENRICHMENT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build EnrichedMetadata from GenerationMetadata.
 * Currently uses deterministic prompt parsing (V1).
 * Future versions may add AI-based enrichment here.
 */
export function buildEnrichedMetadata(
  genMeta: GenerationMetadata
): EnrichedMetadata {
  const parsed = parsePrompt(genMeta.prompt);

  return {
    ...parsed,
    version: ENRICHMENT_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist EnrichedMetadata to the assets table.
 * Writes enriched_metadata, metadata_enriched_at, and metadata_version.
 * Never mutates generation_metadata.
 */
async function persistEnrichedMetadata(
  supabase:        SupabaseClient,
  assetId:         string,
  enrichedMeta:    EnrichedMetadata
): Promise<void> {
  const { error } = await supabase
    .from("assets")
    .update({
      enriched_metadata:    enrichedMeta,
      metadata_enriched_at: new Date().toISOString(),
      metadata_version:     enrichedMeta.version,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(`[enrich-metadata] persist failed for ${assetId}: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRE-AND-FORGET ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrich and persist metadata for an asset — fire-and-forget.
 *
 * Call this after saveAssetMetadata() resolves:
 *   void enrichAndPersist(supabase, assetId, genMeta);
 *
 * Never throws. All errors are logged to console only.
 * Does not block the generation response.
 */
export async function enrichAndPersist(
  supabase: SupabaseClient,
  assetId:  string,
  genMeta:  GenerationMetadata
): Promise<void> {
  try {
    if (!genMeta.prompt) {
      // Nothing to parse — skip enrichment silently
      return;
    }

    const enrichedMeta = buildEnrichedMetadata(genMeta);
    await persistEnrichedMetadata(supabase, assetId, enrichedMeta);
  } catch (err) {
    // Swallow — enrichment is non-critical and must never surface to users
    console.error("[enrich-metadata] enrichment failed (non-blocking):", err);
  }
}
