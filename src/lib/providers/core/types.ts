/**
 * Zencra Provider System — Master Types
 *
 * Single source of truth for all provider adapter interfaces,
 * job lifecycle shapes, asset metadata, and shared type contracts.
 *
 * ⚠️  This file is the foundation of /lib/providers/.
 *     Every provider, orchestrator, and hook imports from here.
 *     Do NOT import from /lib/ai/types — those are the legacy system.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO & PHASE
// ─────────────────────────────────────────────────────────────────────────────

/** All studios in Zencra. Drives routing, registry lookup, and credit namespacing. */
export type StudioType =
  | "image"
  | "video"
  | "audio"
  | "character"
  | "ugc"
  | "fcs"            // Future Cinema Studio — isolated from video
  | "lipsync";       // Studio Lip Sync — Sync Labs v3 via fal.ai

/** Phase designation. FCS is always its own lane regardless of launch date. */
export type Phase = 1 | 2 | "fcs";

/** Whether a provider/model is currently usable in production. */
export type ProviderStatus =
  | "active"          // Phase 1 live
  | "coming-soon"     // Phase 2 registered, not callable
  | "deprecated"      // Legacy — hidden from UI, kept in backend
  | "fcs-only";       // Exists only in the FCS namespace

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER FAMILIES
// ─────────────────────────────────────────────────────────────────────────────

/** Identifies the API client / vendor family for each provider. */
export type ProviderFamily =
  | "openai"           // GPT image (gpt-image-1)
  | "nano-banana"      // NanoBanana standard / pro / pro-4k
  | "fal"              // fal.ai (Seedream, Flux Kontext, FLUX character)
  | "byteplus"         // BytePlus ModelArk (Seedance direct API)
  | "kling"            // Kling AI
  | "runway"           // Runway ML
  | "elevenlabs"       // ElevenLabs TTS
  | "kits"             // Kits AI (Phase 2)
  | "flux-bfl"         // Black Forest Labs FLUX (character creation)
  | "stability"        // Stability AI (character refinement)
  | "creatify"         // UGC — product-to-ad
  | "arcads"           // UGC — ad-focused engine
  | "heygen-ugc"       // HeyGen UGC product (avatar-based ads)
  | "heygen-video"     // HeyGen Video Studio (avatar video — separate product)
  | "ltx"              // FCS — legacy LTX direct API (deprecated)
  | "fal-fcs"          // FCS — LTX-2.3 via fal.ai (Phase 1 current)
  | "fal-lipsync"      // Studio Lip Sync — Sync Labs v3 via fal.ai queue
  | "motion-abstract"  // Character motion abstraction (no concrete provider yet)
  | "unknown";         // Phase 2 providers where API vendor is TBD

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY TAGS
// ─────────────────────────────────────────────────────────────────────────────

/** Granular capability tags that drive UI filters, validation, and pricing. */
export type CapabilityTag =
  // ── Image ──────────────────────────────────────────────────────────────────
  | "text_to_image"
  | "image_to_image"
  | "edit"
  | "inpaint"
  | "outpaint"
  | "upscale"
  | "photoreal"
  | "stylized"
  | "consistency"       // identity/style consistency across generations
  | "variation"
  // ── Video ──────────────────────────────────────────────────────────────────
  | "text_to_video"
  | "image_to_video"
  | "start_frame"
  | "end_frame"
  | "motion_control"    // requires reference video + subject image
  | "extend"
  | "cinematic"
  | "fast_mode"
  | "lip_sync"
  | "avatar"
  | "native_audio"      // video generates with embedded audio
  | "multi_shot"        // multi-shot / multi-scene generation
  | "element_control"   // element-level motion or appearance control
  | "reference_video"   // reference video for style / motion transfer
  // ── Audio ──────────────────────────────────────────────────────────────────
  | "text_to_speech"
  | "voice_clone"
  | "dubbing"
  | "translation"
  | "narration"
  | "voice_convert"
  // ── Character ──────────────────────────────────────────────────────────────
  | "identity_creation"
  | "identity_refinement"
  | "scene_expansion"
  | "look_variation"
  | "motion_starter"
  // ── UGC ────────────────────────────────────────────────────────────────────
  | "product_to_ad"
  | "script_to_avatar"
  | "character_to_ugc"
  // ── FCS ────────────────────────────────────────────────────────────────────
  | "cinematic_studio"
  | "long_form"
  // ── Scene orchestration ────────────────────────────────────────────────────
  | "multi_reference";  // accepts imageUrls[] for multi-reference scene composition

/** Input modalities a provider can accept. */
export type InputMode = "text" | "image" | "video" | "audio" | "url";

/** Aspect ratios supported across all studios. */
export type AspectRatio =
  | "1:1" | "16:9" | "9:16" | "4:5" | "21:9"
  | "4:3" | "3:4" | "2:3" | "3:2" | "5:4"
  | "4:1" | "1:4" | "8:1" | "1:8";

/** How a provider handles the generation lifecycle. */
export type AsyncMode = "sync" | "polling" | "webhook" | "polling+webhook";

// ─────────────────────────────────────────────────────────────────────────────
// JOB LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

/** All possible states of a generation job. */
export type GenerationJobStatus =
  | "queued"
  | "pending"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

/** Full job lifecycle object — created at orchestrator entry, updated throughout. */
export interface ZJob {
  id: string;                      // Zencra internal job ID
  provider: ProviderFamily;
  modelKey: string;                // key from MODEL_REGISTRY
  studioType: StudioType;
  status: GenerationJobStatus;
  externalJobId?: string;          // provider's own task/job ID

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Output
  result?: ZProviderResult;
  error?: string;

  // Credit tracking
  estimatedCredits?: CreditEstimate;
  reservedCredits?: number;
  actualCredits?: number;

  // Identity context (Character Studio)
  identity?: IdentityContext;

  // Provider-specific raw metadata
  providerMeta?: Record<string, unknown>;
}

/** Lightweight status update returned by polling / webhook handlers. */
export interface ZJobStatus {
  jobId: string;
  status: GenerationJobStatus;
  url?: string;
  urls?: string[];
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identity-first context required for all Character Studio generation.
 * Must propagate to Image Studio, Video Studio, and Audio Studio
 * when generating with a selected character.
 */
export interface IdentityContext {
  character_id?: string;   // persistent digital human ID
  soul_id?: string;        // soul (voice + personality + style) ID
  reference_urls?: string[]; // reference images for consistency scoring
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/** Credit estimate produced before a provider call is executed. */
export interface CreditEstimate {
  min: number;
  max: number;
  expected: number;
  breakdown: Record<string, number>;
}

/** Ledger entry written after job completes (success or failure). */
export interface CreditLedgerEntry {
  userId: string;
  jobId: string;
  studioType: StudioType;
  provider: ProviderFamily;
  modelKey: string;
  estimated: CreditEstimate;
  actual: number;
  status: "success" | "error" | "refunded";
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER INPUT / OUTPUT CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

/** Normalized input — orchestrator → provider. */
export interface ZProviderInput {
  // Core
  requestId: string;
  userId: string;
  studioType: StudioType;
  modelKey: string;

  // Prompt
  prompt: string;
  negativePrompt?: string;

  // Media inputs
  imageUrl?: string;
  endImageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  referenceVideoUrl?: string;

  /**
   * Multi-reference image inputs — provider-agnostic scene orchestration.
   *
   * Ordered by semantic priority:
   *   imageUrls[0] → primary subject / identity reference
   *   imageUrls[1] → scene / style reference
   *
   * Phase 1C: gpt-image-2 is the first active consumer (max 2).
   * Future consumers: Flux Kontext, Seedream, Nano Banana, Runway image systems.
   * All providers that support multi-reference editing read this field.
   *
   * Future evolution path (do NOT build yet):
   *   references?: Array<{ url: string; role: "subject" | "style" | "scene" | "lighting" | "wardrobe" }>
   *   When role-aware routing is needed, migrate imageUrls[] → references[].
   *   imageUrls[] stays as the compact form for providers that don't need roles.
   */
  imageUrls?: string[];

  // Generation parameters
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  seed?: number;

  // Audio specific
  voiceId?: string;

  // Identity context (Character Studio + cross-studio)
  identity?: IdentityContext;

  // UGC specific
  productUrl?: string;
  script?: string;

  // Provider model override (if caller wants a specific variant)
  providerModelId?: string;

  // Arbitrary provider-specific params
  providerParams?: Record<string, unknown>;

  // Pre-computed credit estimate (from orchestrator reserve step)
  estimatedCredits?: CreditEstimate;

  // Lip sync provider selection.
  // Default: "fal" (current active integration).
  // "kling" is reserved for future activation — no routing to Kling lip sync yet.
  lipSyncProvider?: "fal" | "kling";

  // ── Kling 3.0 Omni exclusive fields ─────────────────────────────────────────
  // These fields are ONLY valid on model "kling-30-omni".
  // The Kling provider validateInput() will reject them on any other model.

  /**
   * Multi-shot storyboard mode. When true, multiPrompt[] drives generation.
   * Sends multi_shot: true + multi_prompt[] to the Kling API.
   * Replaces the single prompt field for multi-scene storytelling.
   */
  multiShot?: boolean;

  /**
   * Per-shot prompt + duration array for multi-shot generation.
   * Only used when multiShot === true.
   * Each entry maps to one scene in the storyboard output.
   * duration is in seconds (must match Kling's allowed values: 5 or 10).
   */
  multiPrompt?: Array<{ prompt: string; duration: number }>;

  /**
   * Multiple reference image inputs (image_list[]).
   * Base64-encoded strings or HTTPS URLs — normalized to base64 before dispatch.
   * Enables: multi-reference I2I, style blending, character + scene stacking.
   * The Kling API determines per-image role from position and count.
   * Kling constraint: max varies by usage mode (standard: ≤3, with reference video: ≤2).
   */
  imageList?: string[];

  /**
   * Element IDs for element control (element_list[]).
   * References Kling's element library — numeric IDs from the Kling console.
   * Enables: character persistence, object/background injection.
   * Kling constraint: max 2 elements per generation.
   */
  elementList?: number[];

  /**
   * Reference video inputs for style/motion transfer (video_list[]).
   * Each entry has a URL and a refer_type:
   *   "feature" — camera motion / feature reference (style/motion transfer)
   *   "base"    — scene continuation / next-shot generation
   * Kling constraint: max 1 reference video. Only on Omni, blocked in 4K.
   */
  videoList?: Array<{ videoUrl: string; referType: "feature" | "base" }>;
}

/** Normalized output — provider → orchestrator. */
export interface ZProviderResult {
  jobId: string;
  provider: ProviderFamily;
  modelKey: string;
  status: GenerationJobStatus;

  // Output
  url?: string;
  urls?: string[];
  thumbnailUrl?: string;

  // Audio / video properties
  durationMs?: number;

  // Generation metadata
  seed?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

/** UGC normalized output — extends ZProviderResult with ad-specific fields. */
export interface UGCOutput extends ZProviderResult {
  avatar?: string;
  script?: string;
  productUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CAPABILITY SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCapabilities {
  supportedInputModes: InputMode[];
  supportedAspectRatios: AspectRatio[];
  supportedDurations?: number[];
  maxDuration?: number;
  capabilities: CapabilityTag[];
  asyncMode: AsyncMode;
  supportsWebhook: boolean;
  supportsPolling: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK
// ─────────────────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  provider: ProviderFamily;
  jobId: string;
  externalJobId: string;
  status: GenerationJobStatus;
  raw: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every provider in /lib/providers must implement this interface.
 *
 * No provider may be called directly from business logic or UI routes.
 * All calls go through the orchestrator in core/orchestrator.ts.
 *
 * Required methods:
 *   createJob()      — submit generation to provider, return ZJob
 *   getJobStatus()   — single status poll (no internal loops)
 *   cancelJob()      — attempt cancellation (best-effort)
 *   normalizeOutput()— convert provider raw response to ZProviderResult
 *   estimateCost()   — credit estimate before any API call
 *   handleWebhook()  — process inbound provider webhook
 *
 * Optional methods:
 *   validateInput()  — pre-flight validation before job creation
 *   getCapabilities()— programmatic capability query
 *   prepareAssets()  — upload/pre-process assets before generation
 */
export interface ZProvider {
  // Identity
  readonly providerId: ProviderFamily;
  readonly modelKey: string;
  readonly studio: StudioType;
  readonly displayName: string;
  readonly status: ProviderStatus;

  // ── Required ────────────────────────────────────────────────────────────────
  createJob(input: ZProviderInput): Promise<ZJob>;
  getJobStatus(externalJobId: string): Promise<ZJobStatus>;
  cancelJob(externalJobId: string): Promise<void>;
  normalizeOutput(raw: unknown): ZProviderResult;
  estimateCost(input: ZProviderInput): CreditEstimate;
  handleWebhook(payload: WebhookPayload): Promise<ZJobStatus>;

  // ── Optional ────────────────────────────────────────────────────────────────
  validateInput?(input: ZProviderInput): ValidationResult;
  getCapabilities?(): ProviderCapabilities;
  prepareAssets?(input: ZProviderInput): Promise<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// KLING MULTI-ELEMENTS EDITING — TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
//
// Multi-Elements is a SESSION-BASED video editing workflow.
// It is COMPLETELY SEPARATE from standard generation (ZProvider / ZJob).
// It uses its own endpoint family on the Kling API:
//
//   POST /v1/videos/multi-elements/init-selection    — init video for editing
//   POST /v1/videos/multi-elements/add-selection     — mark frame region by points
//   POST /v1/videos/multi-elements/delete-selection  — unmark a frame region
//   POST /v1/videos/multi-elements/clear-selection   — clear all selections
//   POST /v1/videos/multi-elements/preview-selection — preview masked regions
//   POST /v1/videos/multi-elements                   — create editing task
//   GET  /v1/videos/multi-elements/{id}              — poll task (single)
//   GET  /v1/videos/multi-elements                   — list tasks
//
// ⚠️  DO NOT use these types in ZProviderInput, ZJob, or studio-dispatch.
// ⚠️  DO NOT mix into text-to-video or image-to-video pipelines.
//
// Service adapter: src/lib/providers/video/kling-multi-elements.ts
// API route stub:  src/app/api/studio/video/multi-elements/route.ts
// Activation gate: KLING_MULTI_ELEMENTS_ENABLED env var (must be "true")
// ─────────────────────────────────────────────────────────────────────────────

/** Point coordinate in normalized [0, 1] space for region selection. */
export interface KlingSelectionPoint {
  /** X coordinate [0, 1]; 0 = left edge of frame. */
  x: number;
  /** Y coordinate [0, 1]; 0 = top edge of frame. */
  y: number;
}

/** Edit operation type for a Multi-Elements task. */
export type KlingEditMode = "addition" | "swap" | "removal";

/**
 * Body for POST /v1/videos/multi-elements/init-selection.
 * One of video_id or video_url is required (mutually exclusive).
 */
export interface KlingMultiElementsInitBody {
  /**
   * ID of a Kling-generated video (generated within last 30 days).
   * Mutually exclusive with video_url.
   */
  video_id?: string;
  /**
   * URL of an uploaded video (.mp4 / .mov only).
   * Constraints: 2–5s or 7–10s duration, 720px–2160px resolution, 24/30/60 fps.
   * Mutually exclusive with video_id.
   */
  video_url?: string;
}

/** Session metadata returned from init-selection. */
export interface KlingMultiElementsSession {
  session_id:           string; // anchor for all subsequent selection operations
  normalized_video:     string; // URL of the pre-processed video
  fps:                  number;
  width:                number;
  height:               number;
  total_frame:          number;
  original_duration:    number; // ms
  final_unit_deduction: string; // credit deduction estimate
}

/**
 * Body for add-selection and delete-selection.
 * Max 10 distinct frames per session; only 1 frame per request.
 */
export interface KlingSelectionAreaBody {
  session_id:  string;
  frame_index: number;              // 0-based frame index
  /** Click coordinates [0, 1]. Up to 10 points per frame. */
  points:      KlingSelectionPoint[];
}

/** RLE-encoded binary mask for one selected region. */
export interface KlingRleMask {
  object_id: number;
  rle_mask: {
    size:   [number, number]; // [height, width]
    counts: string;           // RLE-encoded mask string
  };
}

/** Returned in data.res from add/delete selection. */
export interface KlingSelectionAreaResult {
  frame_index:   number;
  rle_mask_list: KlingRleMask[];
}

/**
 * One image reference for Multi-Elements task creation.
 * Images must be pre-cropped — the Kling API does NOT perform cropping.
 */
export interface KlingElementImage {
  /**
   * Raw base64 string (no data: prefix) or HTTPS URL.
   * Formats: .jpg / .jpeg / .png. Min 300px. Max 10MB. Aspect ratio 1:2.5–2.5:1.
   */
  image: string;
}

/**
 * Body for POST /v1/videos/multi-elements — create editing task.
 * Requires a session_id from init-selection with at least one selection marked.
 */
export interface KlingMultiElementsTaskBody {
  session_id:       string;
  /** addition = add element | swap = replace element | removal = remove element */
  edit_mode:        KlingEditMode;
  /**
   * Cropped reference images.
   *   addition: 1–2 images required
   *   swap:     1 image required
   *   removal:  not required (omit)
   */
  image_list?:      KlingElementImage[];
  /**
   * Positive prompt (max 2,500 chars).
   * Reference tokens: <<<video_1>>> for source video, <<<image_1>>> for reference image.
   * Recommended prompt templates:
   *   addition: "Using the context of <<<video_1>>>, seamlessly add [x] from <<<image_1>>>"
   *   swap:     "swap [x] from <<<image_1>>> for [x] from <<<video_1>>>"
   *   removal:  "Delete [x] from <<<video_1>>>"
   */
  prompt:           string;
  negative_prompt?: string;
  /** Default: kling-v1-6 */
  model_name?:      string;
  /** Default: std */
  mode?:            "std" | "pro";
  /** Default: 5. Only 5s and 10s are supported. */
  duration?:        5 | 10;
  watermark_info?:  { enabled: boolean };
  callback_url?:    string;
  external_task_id?: string;
}

/** Single task shape from GET /v1/videos/multi-elements/{id} */
export interface KlingMultiElementsTask {
  task_id:          string;
  /** submitted | processing | succeed | failed */
  task_status:      string;
  task_status_msg?: string;
  task_info?:       { external_task_id?: string };
  task_result?:     { videos?: Array<{ url: string }> };
}
