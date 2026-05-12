// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer System — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type InfluencerStatus = "draft" | "active" | "archived";

// ── Style category — controls all visual rendering language ───────────────────
export type StyleCategory =
  | "hyper-real"        // photorealistic, camera lens language, natural skin
  | "3d-animation"      // Pixar-quality render, smooth textures, stylized proportions
  | "anime-manga"       // 2D cel-shaded, line art, stylized expressions
  | "fine-art"          // oil painting / watercolor, classical composition
  | "game-concept"      // cinematic concept art, high detail, fantasy/sci-fi
  | "physical-texture"  // clay / wool / fabric / craft material rendering
  | "retro-pixel";      // 8-bit / 16-bit pixel art, retro game aesthetic

export const STYLE_CATEGORY_VALUES: StyleCategory[] = [
  "hyper-real",
  "3d-animation",
  "anime-manga",
  "fine-art",
  "game-concept",
  "physical-texture",
  "retro-pixel",
];

export type AssetType =
  | "candidate"
  | "hero"
  | "look"
  | "scene"
  | "pose"
  | "social"
  | "identity-sheet"
  | "refine";

export type JobType =
  | "generate"
  | "look-pack"
  | "scene-pack"
  | "pose-pack"
  | "social-pack"
  | "identity-sheet"
  | "refine";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// ── Identity signature stubs ──────────────────────────────────────────────────

export interface FaceEmbedding {
  provider: string;        // "stub" | "insightface" | "replicate" | etc.
  version: string;
  data: Record<string, unknown>;
  status: "pending_embedding" | "complete";
}

export interface AppearanceSignature {
  skin_tone?: string;
  face_structure?: string;
  hair?: string;
  eye_area?: string;
  age_range?: string;
  gender?: string;
  appearance_notes?: string;
}

export interface StyleSignature {
  // Style category — the primary visual rendering mode
  category: StyleCategory;
  rendering_style: string;   // e.g. "photorealistic, shot on Sony A7R V, 85mm f/1.4"
  texture_type: string;      // e.g. "real skin pores, fabric weave visible"
  shading_style: string;     // e.g. "realistic lighting, subsurface scattering"
  // Profile-level style data
  fashion_style?: string;
  realism_level?: string;
  mood?: string[];
  platform_intent?: string[];
}

export interface BodySignature {
  build?: string;
  height_estimate?: string;
  gender_presentation?: string;
}

// ── DB row types ──────────────────────────────────────────────────────────────

export interface AIInfluencer {
  id: string;
  user_id: string;
  name: string;           // legacy / internal name field (still in DB)
  handle: string | null;  // e.g. "nova" — stored without @, displayed as @Nova
  display_name: string | null;  // e.g. "Nova"
  status: InfluencerStatus;
  style_category: StyleCategory;
  hero_asset_id: string | null;
  identity_lock_id: string | null;
  thumbnail_url: string | null;
  parent_influencer_id: string | null;  // non-null for siblings created via multi-lock
  tags: string[];                        // e.g. ["Fashion", "Luxury"] — library filter labels
  created_at: string;
  updated_at: string;
}

export interface AIInfluencerProfile {
  id: string;
  influencer_id: string;
  gender: string | null;
  age_range: string | null;
  skin_tone: string | null;
  face_structure: string | null;
  fashion_style: string | null;
  realism_level: string | null;
  mood: string[];
  platform_intent: string[];
  appearance_notes: string | null;
  // Ethnicity/Region — drives culturally-matched naming + facial genetics in prompts
  // e.g. "south-asian-indian", "east-asian", "middle-eastern", "european"
  ethnicity_region: string | null;
  // Mixed heritage blend regions — persisted fix (previously ephemeral frontend-only)
  mixed_blend_regions: string[];
  // Phase A — Advanced Identity Traits (all optional; null/empty = not set)
  species:       string | null;   // SpeciesType
  hair_identity: string | null;   // HairIdentityType
  eye_color:     string | null;   // EyeColorType
  eye_type:      string | null;   // EyeType
  skin_marks:    string[];        // SkinMarkType[] — multi-select
  ear_type:      string | null;   // EarType
  horn_type:     string | null;   // HornType — null = no horns
  created_at: string;
  updated_at: string;
}

export interface IdentityLock {
  id: string;
  influencer_id: string;
  canonical_asset_id: string;
  reference_asset_ids: string[];
  face_embedding: FaceEmbedding;
  appearance_signature: AppearanceSignature;
  style_signature: StyleSignature;
  body_signature: BodySignature;
  identity_strength_score: number;
  locked_at: string;
  created_at: string;
}

export interface InfluencerAsset {
  id: string;
  influencer_id: string;
  identity_lock_id: string | null;
  job_id: string | null;
  asset_type: AssetType;
  url: string;
  thumbnail_url: string | null;
  is_hero: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InfluencerGenerationJob {
  id: string;
  influencer_id: string;
  identity_lock_id: string | null;
  canonical_asset_id: string | null;
  job_type: JobType;
  status: JobStatus;
  external_job_id: string | null;
  prompt: string | null;
  pack_label: string | null;
  provider: string | null;
  model_key: string | null;
  aspect_ratio: string | null;
  result_urls: string[];
  estimated_credits: number | null;
  credits_consumed: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Phase A — Advanced Identity Trait constants ───────────────────────────────
// Single source of truth for all Phase A option values.
// Used by: frontend dropdowns/chips, backend validation, prompt composer.

export const SPECIES_OPTIONS = [
  "human",
  "elf",
  "alien",
  "animal-inspired",
  "insect-inspired",
] as const;
export type SpeciesType = typeof SPECIES_OPTIONS[number];

export const HAIR_IDENTITY_OPTIONS = [
  "long-hair",
  "short-hair",
  "bald",
  "punk-style",
  "afro-style",
  "fur",
] as const;
export type HairIdentityType = typeof HAIR_IDENTITY_OPTIONS[number];

export const EYE_COLOR_OPTIONS = [
  "black",
  "grey",
  "green",
  "brown",
  "blue",
  "amber",
  "honey-brown",
  "dark-brown",
] as const;
export type EyeColorType = typeof EYE_COLOR_OPTIONS[number];

export const EYE_TYPE_OPTIONS = [
  "human-eyes",
  "glowing-eyes",
  "reptile-eyes",
  "robotic-eyes",
  "blind-eyes",
  "mixed-eyes",
] as const;
export type EyeType = typeof EYE_TYPE_OPTIONS[number];

export const SKIN_MARK_OPTIONS = [
  "freckles",
  "birthmarks",
  "scars",
  "pigmentation",
  "wrinkled-skin",
  "albinism",
] as const;
export type SkinMarkType = typeof SKIN_MARK_OPTIONS[number];

export const EAR_TYPE_OPTIONS = [
  "human-ears",
  "elf-ears",
  "winged-ears",
  "alien-ears",
] as const;
export type EarType = typeof EAR_TYPE_OPTIONS[number];

export const HORN_TYPE_OPTIONS = [
  "small-horns",
  "large-horns",
] as const;
export type HornType = typeof HORN_TYPE_OPTIONS[number];

// ── Context type returned by getInfluencerContext() ───────────────────────────

export interface InfluencerContext {
  influencer: AIInfluencer;
  profile: AIInfluencerProfile;
  identity_lock: IdentityLock;
  canonical_asset: InfluencerAsset;
}

// ── Pack prompt output ────────────────────────────────────────────────────────

export interface PackPromptItem {
  label: string;               // e.g. "Casual", "Urban Golden Hour"
  prompt: string;
  aspectRatio?: string;        // defaults to "1:1" if omitted
  referenceUrl?: string;       // canonical_asset URL for image-guided generation
}

export type PackType =
  | "identity-sheet"
  | "look-pack"
  | "scene-pack"
  | "pose-pack"
  | "social-pack";
