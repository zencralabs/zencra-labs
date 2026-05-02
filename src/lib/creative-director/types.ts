/**
 * Creative Director — TypeScript types
 *
 * All interfaces and row types for the AI Creative Director workflow mode.
 * These are shared across lib/, API routes, and the frontend.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ParsedBrief — structured output of brief parsing.
 * Produced by brief-parser.ts using GPT; never contains image prompt text.
 */
export interface ParsedBrief {
  projectType: string;
  subject: string;
  productOrBrand?: string;
  audience?: string;
  platform?: string;
  primaryGoal?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  stylePreset?: string;
  moodTags?: string[];
  textRenderingIntent?: "none" | "minimal" | "ad_text" | "poster_text" | "typography_first";
  realismVsDesign?: number; // 0-1, 0=pure design, 1=pure realism
  colorPreference?: string;
  aspectRatio?: string;
  compositionPreference?: string;
  avoidElements?: string[];
  suggestions?: string[]; // AI suggestions for improving the brief
}

/**
 * CreativeConcept — one of exactly 3 generated creative directions.
 * Each concept differs in layout strategy, visual tone, or typography approach.
 */
export interface CreativeConcept {
  title: string;
  summary: string;
  rationale: string;
  layoutStrategy: string;
  typographyStrategy: string;
  colorStrategy: string;
  visualFocus: string;
  providerRecommendation: {
    provider: string;
    model: string;
    reason: string;
  };
  scores: {
    textAccuracy: number;     // 0-10
    cinematicImpact: number;  // 0-10
    designControl: number;    // 0-10
    speed: number;            // 0-10
  };
  generationBlueprint: {
    cameraStyle?: string;
    compositionRules: string[];
    lightingRules: string[];
    textPlacementRules: string[];
    renderingNotes: string[];
  };
}

/**
 * NormalizedCreativeRenderPrompt — structured prompt object before provider rendering.
 * This is the canonical prompt representation used for generation, variation, and adaptation.
 */
export interface NormalizedCreativeRenderPrompt {
  promptVersion: "v1";
  mode: "creative_director";
  subject: string;
  outputIntent: string;
  stylePreset: string;
  conceptTitle: string;
  visualDescription: string;
  layoutInstructions: string[];
  typographyInstructions: string[];
  textContent: {
    headline?: string;
    subheadline?: string;
    cta?: string;
    renderingIntent: string;
  };
  compositionInstructions: string[];
  lightingInstructions: string[];
  colorInstructions: string[];
  negativeInstructions: string[];
  format: {
    type: string;
    aspectRatio: string;
  };
  providerHints: {
    prioritizeTextAccuracy: boolean;
    prioritizeCinematicRealism: boolean;
    prioritizeSpeed: boolean;
  };
}

/**
 * VariationPrompt — controlled modification specification.
 * Defines what to preserve and what to change for a variation pass.
 */
export interface VariationPrompt {
  variationType: V1VariationType;
  preserve: {
    subject: boolean;
    layoutIntent: boolean;
    textHierarchy: boolean;
    colorFamily: boolean;
  };
  changes: string[];
  strength: "low" | "medium" | "high";
}

/**
 * V1 exposed variation types — exactly 5 types supported in V1.
 */
export type V1VariationType =
  | "premium_pass"
  | "minimal_pass"
  | "cinematic_pass"
  | "text_accuracy_pass"
  | "product_focus_pass";

/**
 * V1 format adaptation targets — 3 formats supported in V1.
 */
export type V1AdaptationTarget = "story" | "square_post" | "banner";

/**
 * FormatAdaptation — layout transform spec for format changes.
 */
export interface FormatAdaptation {
  source: NormalizedCreativeRenderPrompt;
  targetFormat: V1AdaptationTarget;
  targetAspectRatio: string;
  layoutAdjustments: string[];
  compositionShifts: string[];
}

/**
 * CreativeGenerationResult — normalized provider response returned to callers.
 */
export interface CreativeGenerationResult {
  id: string;
  projectId: string;
  conceptId?: string;
  provider: string;
  model: string;
  status: "queued" | "processing" | "completed" | "failed";
  assets: Array<{
    url: string;
    width?: number;
    height?: number;
    mimeType?: string;
  }>;
  creditCost: number;
  variationType?: string;
  adaptationTarget?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB ROW TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CreativeProjectRow {
  id: string;
  user_id: string;
  title: string;
  project_type: string;
  brand_name?: string;
  audience?: string;
  platform?: string;
  status: string;
  selected_concept_id?: string;
  cover_asset_id?: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreativeBriefRow {
  id: string;
  project_id: string;
  original_input?: string;
  goal?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  additional_copy_notes?: string;
  project_type?: string;
  style_preset?: string;
  mood_tags: string[];
  visual_intensity?: string;
  text_rendering_intent?: string;
  realism_vs_design?: number;
  color_preference?: string;
  aspect_ratio?: string;
  reference_assets: unknown[];
  advanced_settings: Record<string, unknown>;
  // {} = not yet parsed (brief saved before concept generation).
  // Populated by the concepts route after parseBrief() succeeds.
  // Always an object — use Object.keys(parsed_brief_json).length === 0 to detect unparsed.
  // Callers must never rely on this field before concept generation completes.
  parsed_brief_json: Record<string, unknown>;
  concepting_session_key?: string;
  created_at: string;
  updated_at: string;
}

export interface CreativeConceptRow {
  id: string;
  project_id: string;
  brief_id?: string;
  concept_index: number;
  title: string;
  summary: string;
  rationale?: string;
  layout_strategy?: string;
  typography_strategy?: string;
  color_strategy?: string;
  recommended_provider?: string;
  recommended_model?: string;
  recommended_use_case?: string;
  scores: Record<string, number>;
  concept_payload: Record<string, unknown>;
  is_selected: boolean;
  created_at: string;
}

export interface CreativeGenerationRow {
  id: string;
  project_id: string;
  concept_id?: string;
  user_id: string;
  generation_type: string;
  provider: string;
  model: string;
  request_payload: Record<string, unknown>;
  normalized_prompt: Record<string, unknown>;
  asset_id?: string;
  status: string;
  credit_cost: number;
  parent_generation_id?: string;
  variation_type?: string;
  adaptation_target?: string;
  idempotency_key?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  /** Links this generation to a project_sessions row (project system) */
  session_id?: string;
  /** Phase A — links this generation to a creative_directions row */
  direction_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVE DIRECTOR v2 — DIRECTION LAYER TYPES
// Scope: Image Studio only. Still images only. No video/motion logic.
// ─────────────────────────────────────────────────────────────────────────────

export type SceneEnergy =
  | "static"
  | "walking-pose"
  | "action-pose"
  | "dramatic-still";

export type ColorPalette =
  | "warm"
  | "cool"
  | "cinematic"
  | "neon"
  | "desaturated"
  | "vivid"
  | "monochrome";

export type LightingStyle =
  | "dramatic"
  | "soft"
  | "golden-hour"
  | "neon"
  | "overcast"
  | "studio"
  | "practical";

export type ShotType =
  | "close"
  | "medium"
  | "wide"
  | "extreme-wide"
  | "macro"
  | "aerial";

export type CameraLens = "24mm" | "35mm" | "50mm" | "85mm" | "135mm";

export type CameraAngle =
  | "eye-level"
  | "low"
  | "high"
  | "dutch"
  | "top-down"
  | "worms-eye";

export type DirectionElementType = "subject" | "world" | "object" | "atmosphere";

/**
 * DirectionMode — generation behaviour at dispatch time.
 *
 * "explore"  direction not locked — loose prompt, free creative exploration,
 *            no identity enforcement, outputs not campaign-consistent.
 *
 * "locked"   direction committed — strict prompt, identity lock enforced,
 *            campaign-ready outputs. Enables Generate button fully in UI.
 *
 * Derived at the generate route from direction.is_locked; never stored
 * separately. The mode is snapshotted into scene_snapshot for fast reload.
 */
export type DirectionMode = "explore" | "locked";

export interface CreativeDirectionRow {
  id: string;
  user_id: string;
  project_id?: string;
  session_id?: string;
  concept_id?: string;
  name?: string;
  is_locked: boolean;
  model_key?: string;
  /**
   * scene_snapshot — denormalized JSON of full direction state.
   * Written fire-and-forget by the generate route (and lock route).
   * Shape: { mode, elements, refinements, snapshot_at }
   * Used for fast UI reload, undo/redo foundation, FCS compatibility.
   */
  scene_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DirectionRefinementsRow {
  id: string;
  direction_id: string;
  tone_intensity?: number;       // 0–100
  color_palette?: ColorPalette | string;
  lighting_style?: LightingStyle | string;
  shot_type?: ShotType | string;
  lens?: CameraLens | string;
  camera_angle?: CameraAngle | string;
  scene_energy?: SceneEnergy | string;
  identity_lock: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectionElementRow {
  id: string;
  direction_id: string;
  type: DirectionElementType;
  label: string;
  asset_url?: string;
  weight: number;                // 0–1
  position: number;
  created_at: string;
}

/** Full direction with its refinements and elements — used for prompt building */
export interface DirectionWithContext {
  direction: CreativeDirectionRow;
  refinements: DirectionRefinementsRow | null;
  elements: DirectionElementRow[];
}

export interface CreativeActivityRow {
  id: string;
  project_id: string;
  user_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT & UTILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** All event types tracked in creative_activity_log */
export type CreativeEventType =
  | "project_created"
  | "brief_created"
  | "brief_updated"
  | "concepts_generated"
  | "concept_selected"
  | "generation_queued"
  | "generation_completed"
  | "generation_failed"
  | "variation_created"
  | "adaptation_created"
  | "project_forked"
  | "generation_forked";

/** Credit cost breakdown for the Creative Director workflow */
export interface CDCreditEstimate {
  concepting: number;          // always 1 cr
  generationPerOutput: number; // provider-based
  totalForFourOutputs: number; // concepting + 4 * generationPerOutput
  variationPerOutput: number;  // 75% of base generation cost
  adaptationPerOutput: number; // 80% of base generation cost
}

/** Provider routing decision — deterministic, no randomness */
export interface CDProviderDecision {
  provider: string;
  model: string;
  reason: string;
}
