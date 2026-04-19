/**
 * Storage Metadata — Asset Metadata Builder Utilities
 *
 * Converts raw ZJob/ZProviderResult into typed AssetMetadata.
 * Handles Supabase insert/upsert for the assets table.
 *
 * Usage (server action after job completes):
 *   const meta = buildAssetMetadata({ job, url, userId, prompt, storagePath, ... });
 *   await saveAssetMetadata(supabase, meta);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetMetadata, AssetRecord, AssetStatus, AssetMimeType,
  ImageAssetMeta, VideoAssetMeta, AudioAssetMeta,
  CharacterAssetMeta, UGCAssetMeta, FCSAssetMeta,
} from "./types";
import type { ZJob } from "../providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER INPUT
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildAssetMetadataInput {
  job:          ZJob;
  userId:       string;
  url:          string;
  storagePath:  string;
  bucket:       string;
  mimeType?:    AssetMimeType;
  prompt?:      string;
  sizeBytes?:   number;
  creditsCost?: number;
  /** Override status (defaults to "ready") */
  status?:      AssetStatus;
  /** Studio-specific extension fields */
  studioMeta?: {
    image?:     ImageAssetMeta;
    video?:     VideoAssetMeta;
    audio?:     AudioAssetMeta;
    character?: CharacterAssetMeta;
    ugc?:       UGCAssetMeta;
    fcs?:       FCSAssetMeta;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a new asset ID (UUID v4 via Web Crypto — edge-compatible) */
export function newAssetId(): string {
  return crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// MIME TYPE INFERENCE
// ─────────────────────────────────────────────────────────────────────────────

/** Infer MIME type from studio if not explicitly provided */
function inferMimeType(job: ZJob, provided?: AssetMimeType): AssetMimeType {
  if (provided) return provided;
  switch (job.studioType) {
    case "image":     return "image/png";
    case "video":
    case "fcs":       return "video/mp4";
    case "audio":     return "audio/mpeg";
    case "character": return "image/png"; // character images default to PNG
    case "ugc":       return "video/mp4";
    default:          return "image/png";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fully typed AssetMetadata object from a completed ZJob.
 * Call this after the provider returns a success URL.
 */
export function buildAssetMetadata(input: BuildAssetMetadataInput): AssetMetadata {
  const { job, userId, url, storagePath, bucket, prompt, sizeBytes, creditsCost, studioMeta } = input;
  const now = new Date();

  return {
    assetId:        newAssetId(),
    jobId:          job.id,
    userId,
    studio:         job.studioType,
    provider:       job.provider,
    modelKey:       job.modelKey,
    externalJobId:  job.externalJobId,

    // Identity context — propagated from job if set
    character_id:   job.identity?.character_id,
    soul_id:        job.identity?.soul_id,
    reference_urls: job.identity?.reference_urls,

    status:         input.status ?? "ready",
    mimeType:       inferMimeType(job, input.mimeType),
    url,
    storagePath,
    bucket,
    sizeBytes,

    prompt,
    aspectRatio:    (job.providerMeta?.aspectRatio as string | undefined)
                 ?? (job.providerMeta?.platform as string | undefined),
    durationSeconds: (job.providerMeta?.duration as number | undefined),
    creditsCost,

    // Studio-specific extensions
    image:     studioMeta?.image,
    video:     studioMeta?.video,
    audio:     studioMeta?.audio,
    character: studioMeta?.character,
    ugc:       studioMeta?.ugc,
    fcs:       studioMeta?.fcs,

    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/** Serialize AssetMetadata → AssetRecord for Supabase insert */
export function toAssetRecord(meta: AssetMetadata): AssetRecord {
  const studioMeta: Record<string, unknown> = {};
  if (meta.image)     studioMeta.image     = meta.image;
  if (meta.video)     studioMeta.video     = meta.video;
  if (meta.audio)     studioMeta.audio     = meta.audio;
  if (meta.character) studioMeta.character = meta.character;
  if (meta.ugc)       studioMeta.ugc       = meta.ugc;
  if (meta.fcs)       studioMeta.fcs       = meta.fcs;

  return {
    id:              meta.assetId,
    job_id:          meta.jobId,
    user_id:         meta.userId,
    studio:          meta.studio,
    provider:        meta.provider,
    model_key:       meta.modelKey,
    external_job_id: meta.externalJobId,
    character_id:    meta.character_id,
    soul_id:         meta.soul_id,
    reference_urls:  meta.reference_urls,
    status:          meta.status,
    mime_type:       meta.mimeType,
    url:             meta.url,
    storage_path:    meta.storagePath,
    bucket:          meta.bucket,
    size_bytes:      meta.sizeBytes,
    prompt:          meta.prompt,
    aspect_ratio:    meta.aspectRatio,
    duration_seconds: meta.durationSeconds,
    credits_cost:    meta.creditsCost,
    studio_meta:     studioMeta,
    created_at:      meta.createdAt.toISOString(),
    updated_at:      meta.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist an asset metadata record to Supabase.
 * Upserts on id to handle retry scenarios.
 */
export async function saveAssetMetadata(
  supabase: SupabaseClient,
  meta:     AssetMetadata
): Promise<void> {
  const record = toAssetRecord(meta);
  const { error } = await supabase
    .from("assets")
    .upsert(record, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to save asset metadata: ${error.message}`);
  }
}

/**
 * Update an existing asset record's status and URL (e.g., when polling completes).
 */
export async function updateAssetStatus(
  supabase: SupabaseClient,
  assetId:  string,
  status:   AssetStatus,
  url?:     string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (url) patch.url = url;

  const { error } = await supabase
    .from("assets")
    .update(patch)
    .eq("id", assetId);

  if (error) {
    throw new Error(`Failed to update asset status: ${error.message}`);
  }
}

/**
 * Fetch an asset record by job ID (for polling status lookups).
 */
export async function getAssetByJobId(
  supabase: SupabaseClient,
  jobId:    string
): Promise<AssetRecord | null> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (error) return null;
  return data as AssetRecord;
}

/**
 * Fetch all assets for a character_id (character gallery query).
 */
export async function getAssetsByCharacterId(
  supabase:    SupabaseClient,
  characterId: string,
  userId:      string,
  limit = 50
): Promise<AssetRecord[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("character_id", characterId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as AssetRecord[];
}

/**
 * Fetch all assets for a user + studio combination.
 */
export async function getUserAssets(
  supabase: SupabaseClient,
  userId:   string,
  studio?:  string,
  limit = 100
): Promise<AssetRecord[]> {
  let query = supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (studio) {
    query = query.eq("studio", studio);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as AssetRecord[];
}
