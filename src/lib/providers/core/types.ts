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
  | "long_form";

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
