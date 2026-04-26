// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer System — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type InfluencerStatus = "draft" | "active" | "archived";

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
}

export interface StyleSignature {
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
  name: string;
  status: InfluencerStatus;
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
