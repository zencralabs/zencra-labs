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
