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
