/**
 * Metadata Engine — Types
 *
 * Two layers:
 *   GenerationMetadata — raw provenance, written once at asset creation
 *   EnrichedMetadata   — derived cinematic data, written async after creation
 *
 * Designed cross-studio: image, video, audio, character, FCS.
 * Studio-specific fields are optional and additive.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GENERATION METADATA — source of truth, never overwritten
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationMetadata {
  // ── Core identity ──────────────────────────────────────────────────────────
  prompt:           string;
  negative_prompt?: string;
  provider:         string;
  model_key:        string;
  studio:           "image" | "video" | "audio" | "character" | "ugc" | "fcs";
  input_mode:       "text_to_image" | "image_to_image" | "text_to_video" |
                    "image_to_video" | "text_to_audio" | "text_to_speech" |
                    "text_to_music" | "ugc" | "fcs" | string;

  // ── Image / Video dimensions ───────────────────────────────────────────────
  aspect_ratio?:    string;
  width?:           number;
  height?:          number;
  output_format?:   string;   // "jpg" | "png" | "webp" | "mp4" | "wav" | etc.

  // ── Video / Audio specific ────────────────────────────────────────────────
  duration_seconds?: number;
  fps?:              number;

  // ── Generation parameters ─────────────────────────────────────────────────
  seed?:             number | null;
  inference_steps?:  number | null;
  quality?:          string;   // "1K" | "2K" | "4K" | "standard" | "hd" etc.

  // ── Cost ──────────────────────────────────────────────────────────────────
  credits_used?:     number;
  generation_time_ms?: number;

  // ── References ────────────────────────────────────────────────────────────
  provider_job_id?:     string;
  reference_asset_ids?: string[];
  source_asset_id?:     string | null;

  // ── Audio specific ────────────────────────────────────────────────────────
  voice_id?:         string;
  script_length?:    number;

  // ── Character / FCS specific ─────────────────────────────────────────────
  character_id?:     string;
  soul_id?:          string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHED METADATA — derived, written async, additive only
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichedMetadata {
  // ── Cinematic ─────────────────────────────────────────────────────────────
  camera?:       string;          // e.g. "Full-frame digital"
  lens?:         string;          // e.g. "85mm portrait"
  lighting?:     string;          // e.g. "soft key light"

  // ── Arrays — may have multiple matches ────────────────────────────────────
  mood?:         string[];        // e.g. ["moody", "dramatic"]
  style_tags?:   string[];        // e.g. ["photorealistic", "cinematic"]
  composition?:  string[];        // e.g. ["medium shot", "centered"]
  color_tone?:   string[];        // e.g. ["cool blue", "neon highlights"]

  // ── Summary ───────────────────────────────────────────────────────────────
  shot_type?:        string;      // e.g. "medium shot"
  visual_summary?:   string;      // short prose summary

  // ── System ────────────────────────────────────────────────────────────────
  confidence?:   number;          // 0–1, how confident the parser is
  version:       number;          // schema version, currently 1
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET DETAILS RESPONSE — shape returned by /api/assets/[assetId]/details
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetDetailsResponse {
  asset: {
    id:          string;
    studio:      string;
    status:      string;
    url:         string | null;
    prompt:      string | null;
    model_key:   string;
    provider:    string;
    aspect_ratio?: string | null;
    credits_cost?: number | null;
    created_at:  string;
    error_message?: string | null;
  };
  generation_metadata: GenerationMetadata | null;
  enriched_metadata:   EnrichedMetadata   | null;
}
