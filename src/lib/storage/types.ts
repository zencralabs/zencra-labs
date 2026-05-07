/**
 * Storage Types — Asset Metadata Schema
 *
 * Every file stored by Zencra Studios carries AssetMetadata.
 * Metadata is written to Supabase alongside the storage path and is
 * used for: gallery display, credit reconciliation, character linking,
 * and generation provenance tracking.
 *
 * Schema is intentionally additive — fields marked optional will be
 * populated as studios mature. The shape is stable at the top level;
 * studio-specific details live in the typed sub-objects.
 */

import type { StudioType } from "../providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED METADATA TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Status of the stored asset */
export type AssetStatus = "pending" | "processing" | "ready" | "failed" | "deleted";

/** MIME type families used across studios */
export type AssetMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "video/mp4"
  | "video/webm"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/ogg"
  | string;

// ─────────────────────────────────────────────────────────────────────────────
// ASSET METADATA — ROOT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetMetadata {
  // ── Identifiers ────────────────────────────────────────────────────────────
  /** Zencra internal asset ID (UUID) */
  assetId:         string;
  /** Job ID that produced this asset */
  jobId:           string;
  /** User who triggered the generation */
  userId:          string;

  // ── Studio & Provider ──────────────────────────────────────────────────────
  studio:          StudioType;
  provider:        string;
  modelKey:        string;
  /** Provider-assigned external job/task ID */
  externalJobId?:  string;

  // ── Character / Identity context ──────────────────────────────────────────
  /**
   * Character Studio character ID — present when asset was generated
   * from or for a specific character. Links asset to character gallery.
   */
  character_id?:   string;
  /**
   * Soul ID — voice/persona layer identifier. Present when audio or
   * video was generated with a specific soul configuration.
   */
  soul_id?:        string;
  /** Reference images used in the generation (image-to-video, etc.) */
  reference_urls?: string[];

  // ── Asset Properties ───────────────────────────────────────────────────────
  status:          AssetStatus;
  mimeType:        AssetMimeType;
  /** Public URL (Supabase storage public URL) */
  url:             string;
  /** Internal Supabase storage path (bucket/path) */
  storagePath:     string;
  /** Storage bucket name */
  bucket:          string;
  /** File size in bytes */
  sizeBytes?:      number;

  // ── Generation Parameters ─────────────────────────────────────────────────
  prompt?:         string;
  aspectRatio?:    string;
  /** Duration in seconds (video / audio) */
  durationSeconds?: number;
  /** Duration in milliseconds (audio — ElevenLabs returns ms) */
  durationMs?:     number;
  creditsCost?:    number;

  // ── Studio-specific extensions ────────────────────────────────────────────
  image?:          ImageAssetMeta;
  video?:          VideoAssetMeta;
  audio?:          AudioAssetMeta;
  character?:      CharacterAssetMeta;
  ugc?:            UGCAssetMeta;
  fcs?:            FCSAssetMeta;

  // ── Metadata Engine ───────────────────────────────────────────────────────
  /**
   * Raw generation provenance — written once at asset creation.
   * Stored in the generation_metadata JSONB column.
   */
  generationMetadata?: import("../metadata/types").GenerationMetadata;

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:       Date;
  updatedAt:       Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO-SPECIFIC SUB-TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageAssetMeta {
  width?:       number;
  height?:      number;
  quality?:     "draft" | "standard" | "hd";
  editMode?:    boolean;
  /** Seed used for generation (reproducibility) */
  seed?:        number;
}

export interface VideoAssetMeta {
  width?:       number;
  height?:      number;
  fps?:         number;
  durationSec?: number;
  /** Source image URL (image-to-video) */
  sourceImageUrl?: string;
  /** Motion control reference video URL */
  referenceVideoUrl?: string;
  format?:      string;
}

export interface AudioAssetMeta {
  /** ElevenLabs / Kits AI voice ID */
  voiceId?:     string;
  modelId?:     string;
  quality?:     "standard" | "studio";
  charCount?:   number;
}

export interface CharacterAssetMeta {
  /** Generation tool used within Character Studio */
  tool?:        "image_gen" | "motion" | "voice_clone" | "lipsync";
  fluxModel?:   string;
  stabilityOp?: string;
  motionProvider?: string;
}

export interface UGCAssetMeta {
  /** Avatar / actor ID used */
  avatarId?:    string;
  /** Source product URL (Creatify) */
  productUrl?:  string;
  /** Script text */
  script?:      string;
  format?:      string;
  platform?:    string;
}

export interface FCSAssetMeta {
  apiVersion?:  string;
  ltxVersion?:  string;
  frameCount?:  number;
  fps?:         number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE RECORD — DATABASE ROW TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape written to `assets` table in Supabase.
 * Matches the AssetMetadata structure but serialized for DB insert.
 *
 * Column groups:
 *   Core identifiers       — always written at creation
 *   Studio & provider      — generation source
 *   Character / identity   — character studio links
 *   Asset properties       — storage, MIME, URL
 *   Generation parameters  — prompt, AR, duration, credits
 *   Project ownership      — project/session/concept links + ownership layer
 *   User flags             — is_favorite, is_featured
 *   Publishing             — visibility, slug
 *   Workspace              — Business-plan team ownership (Phase 4)
 *   Metadata engine        — generation provenance + enrichment
 *   Async recovery         — polling, stale detection
 *   Timestamps             — created/updated/completed
 */
export interface AssetRecord {
  // ── Core identifiers ───────────────────────────────────────────────────────
  id:              string;
  job_id:          string;
  user_id:         string;

  // ── Studio & provider ──────────────────────────────────────────────────────
  studio:          string;
  provider:        string;
  model_key:       string;
  external_job_id?: string;

  // ── Character / identity ───────────────────────────────────────────────────
  character_id?:   string;
  soul_id?:        string;
  reference_urls?: string[];

  // ── Asset properties ───────────────────────────────────────────────────────
  status:          string;
  mime_type:       string;
  url:             string;
  storage_path:    string;
  bucket:          string;
  size_bytes?:     number;
  audio_detected?: boolean | null;

  // ── Generation parameters ─────────────────────────────────────────────────
  prompt?:         string;
  aspect_ratio?:   string;
  duration_seconds?: number;
  credits_cost?:   number;

  // ── Project ownership ─────────────────────────────────────────────────────
  /**
   * FK → projects (standard) or resolved via concept_id → creative_projects (creative).
   * Use owner_project_type to determine which table project_id points to.
   */
  project_id?:         string | null;
  session_id?:         string | null;
  concept_id?:         string | null;
  /**
   * Discriminator for project_id. Values: 'standard' | 'creative' | future types.
   * NULL = no project ownership assigned (personal/unlinked asset).
   * Intentionally unconstrained — enum grows without migration.
   */
  owner_project_type?: string | null;

  // ── User flags ─────────────────────────────────────────────────────────────
  /** User-set favourite flag (personal preference). */
  is_favorite?:    boolean;
  /**
   * Editorial/platform curation flag. Set by admin only.
   * Distinct from is_favorite. Surfaces asset in homepage/featured galleries.
   */
  is_featured?:    boolean;

  // ── Publishing ─────────────────────────────────────────────────────────────
  /** Visibility scope: 'private' | 'public' | 'project'. Default: 'private'. */
  visibility?:     string;
  /**
   * URL-safe permalink slug for public asset pages (/p/[slug]).
   * NULL = no permalink assigned. Assigned by Phase 3 publishing routes.
   */
  slug?:           string | null;

  // ── Workspace (Phase 4) ────────────────────────────────────────────────────
  /**
   * FK → workspaces for Business-plan team asset ownership.
   * NULL = personal asset. No RLS enforcement yet.
   */
  workspace_id?:   string | null;

  // ── Studio-specific meta ───────────────────────────────────────────────────
  studio_meta:          Record<string, unknown>;

  // ── Metadata engine ────────────────────────────────────────────────────────
  generation_metadata?: Record<string, unknown> | null;
  enriched_metadata?:   Record<string, unknown> | null;
  metadata_enriched_at?: string | null;
  metadata_version?:    number | null;

  // ── Error state ────────────────────────────────────────────────────────────
  error_message?:       string | null;

  // ── Timestamps ────────────────────────────────────────────────────────────
  created_at:           string;
  updated_at:           string;
  completed_at?:        string | null;
}
