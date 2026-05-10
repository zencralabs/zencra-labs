/**
 * Zencra Master Model Registry
 *
 * Single source of truth for every model across all studios and phases.
 *
 * Four distinct naming fields per entry:
 *   providerBrand  — official vendor/brand name (e.g. "Black Forest Labs")
 *   displayName    — official model display name shown in UI (e.g. "FLUX.1 Kontext")
 *   key            — Zencra-internal routing key — safe for code, never shown raw to users
 *   apiModelId     — exact upstream model ID / endpoint string sent to the provider API
 *
 * Rules:
 *   - Every model that exists in Zencra must have an entry here
 *   - No model may be called without appearing in this registry
 *   - Phase 2 models exist as coming-soon entries — they are NOT callable
 *   - Deprecated models remain with status "deprecated"
 *   - FCS models are in a separate namespace (fcs_*)
 *   - Never let a Zencra alias replace the real upstream model name in apiModelId
 */

import type {
  StudioType,
  Phase,
  ProviderStatus,
  ProviderFamily,
  CapabilityTag,
  InputMode,
  AspectRatio,
  AsyncMode,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY ENTRY SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelRegistryEntry {
  // ── Naming (four distinct fields — all required for active models) ──────────
  /** Zencra-internal routing key. Used in code, API routes, and ZProvider.modelKey. */
  key: string;
  /** Official vendor or brand name (e.g. "Black Forest Labs", "Kling AI"). */
  providerBrand: string;
  /** Official upstream model display name — exactly as the vendor names it. */
  displayName: string;
  /** Exact API model ID / endpoint string sent in API calls. Must not be a Zencra alias. */
  apiModelId: string;

  // ── Studio & routing ───────────────────────────────────────────────────────
  studio: StudioType;
  providerFamily: ProviderFamily;
  description: string;

  // ── Phase & status ─────────────────────────────────────────────────────────
  phase: Phase;
  status: ProviderStatus;

  // ── Display ────────────────────────────────────────────────────────────────
  badge?: string;
  badgeColor?: string;

  // ── Capabilities ───────────────────────────────────────────────────────────
  capabilities: CapabilityTag[];
  supportedInputModes: InputMode[];
  supportedAspectRatios: AspectRatio[];

  // ── Video / audio ─────────────────────────────────────────────────────────
  supportedDurations?: number[];
  maxDuration?: number;

  // ── Integration ────────────────────────────────────────────────────────────
  asyncMode: AsyncMode;
  supportsWebhook: boolean;
  supportsPolling: boolean;

  // ── Credit placeholders ────────────────────────────────────────────────────
  estimatedCostRange?: string;
  creditMultiplier?: number;

  // ── UI hints ───────────────────────────────────────────────────────────────
  uiHidden?: boolean;
  comingSoonLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: ModelRegistryEntry[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // IMAGE STUDIO — Phase 1 Active
  // ══════════════════════════════════════════════════════════════════════════

  {
    key:            "gpt-image-1",
    providerBrand:  "OpenAI",
    displayName:    "GPT Image",
    apiModelId:     "gpt-image-1",
    studio:         "image",
    providerFamily: "openai",
    description:    "OpenAI's flagship image generation model — photoreal, precise instruction following",
    phase:          1,
    status:         "active",
    badge:          "GPT",
    badgeColor:     "#10A37F",
    capabilities:   ["text_to_image", "image_to_image", "edit", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "4–8 credits",
    creditMultiplier:   2,
  },

  {
    key:            "gpt-image-2",
    providerBrand:  "OpenAI",
    displayName:    "GPT Image 2",
    // apiModelId must match the exact string OpenAI's API accepts.
    // Override at runtime via GPT_IMAGE_2_MODEL_ID env var once confirmed.
    apiModelId:     "gpt-image-2",
    studio:         "image",
    providerFamily: "openai",
    description:    "OpenAI's next-generation image model — enhanced quality, richer creative control",
    phase:          1,
    status:         "active",
    badge:          "GPT",
    badgeColor:     "#10A37F",
    capabilities:   ["text_to_image", "image_to_image", "edit", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "4–10 credits",
    creditMultiplier:   2,
  },

  // ── Nano Banana ────────────────────────────────────────────────────────────
  // Vendor API: api.nanobananaapi.ai
  // Endpoints:
  //   Standard → POST /api/v1/nanobanana/generate   (type: "TEXTTOIAMGE" — confirmed typo)
  //   Pro      → POST /api/v1/nanobanana/generate-pro
  //   Task     → GET  /api/v1/nanobanana/record-info?taskId=
  // apiModelId stores the endpoint path — Nano Banana has no separate "model ID" field in the request

  {
    key:            "nano-banana-standard",
    providerBrand:  "Nano Banana",
    displayName:    "Nano Banana",
    apiModelId:     "/api/v1/nanobanana/generate",
    studio:         "image",
    providerFamily: "nano-banana",
    description:    "Fast stylized generation — text/image to image, up to 14 references",
    phase:          1,
    status:         "active",
    badge:          "FAST",
    badgeColor:     "#F59E0B",
    capabilities:   ["text_to_image", "image_to_image", "stylized"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
      "4:1", "4:3", "4:5", "5:4", "8:1",
      "9:16", "16:9", "21:9",
    ],
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "2 credits",
    creditMultiplier:   1,
  },

  {
    key:            "nano-banana-pro",
    providerBrand:  "Nano Banana",
    displayName:    "Nano Banana Pro",
    apiModelId:     "/api/v1/nanobanana/generate-pro",
    studio:         "image",
    providerFamily: "nano-banana",
    description:    "High-resolution output — 1K / 2K / 4K, text/image to image",
    phase:          1,
    status:         "active",
    badge:          "PRO",
    badgeColor:     "#8B5CF6",
    capabilities:   ["text_to_image", "image_to_image", "stylized", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
      "4:1", "4:3", "4:5", "5:4", "8:1",
      "9:16", "16:9", "21:9",
    ],
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "2–8 credits",
    creditMultiplier:   1.5,
  },

  {
    key:            "nano-banana-2",
    providerBrand:  "Nano Banana",
    displayName:    "Nano Banana 2",
    apiModelId:     "/api/v1/nanobanana/generate-v2",
    studio:         "image",
    providerFamily: "nano-banana",
    description:    "Second-generation Nano Banana — improved quality, up to 4K, multi-reference",
    phase:          1,
    status:         "active",
    badge:          "NEW",
    badgeColor:     "#06B6D4",
    capabilities:   ["text_to_image", "image_to_image", "stylized", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
      "4:1", "4:3", "4:5", "5:4", "8:1",
      "9:16", "16:9", "21:9",
    ],
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "2–8 credits",
    creditMultiplier:   1.5,
  },

  // ── Seedream (via fal.ai) ──────────────────────────────────────────────────
  // fal.ai endpoints:
  //   fal-ai/seedream       → Seedream v5 text-to-image (primary quality model)
  //   fal-ai/seedream/edit  → Seedream v5 edit / image-to-image (Lite fast+edit tier)
  //   fal-ai/seedream/v4.5  → Seedream 4.5 legacy (DB inactive, provider registered for error routing)
  // ByteDance / Dreamina brand — served through fal.ai queue

  {
    key:            "seedream-v5",
    providerBrand:  "ByteDance / Dreamina",
    displayName:    "Seedream v5",
    apiModelId:     "fal-ai/seedream",
    studio:         "image",
    providerFamily: "fal",
    description:    "ByteDance's flagship image model — cinematic, richly detailed text-to-image",
    phase:          1,
    status:         "active",
    badge:          "HOT",
    badgeColor:     "#EF4444",
    capabilities:   ["text_to_image", "photoreal", "cinematic"],
    supportedInputModes:   ["text"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "13–17 credits",
    creditMultiplier:   1.5,
  },

  {
    key:            "seedream-v5-lite",
    providerBrand:  "ByteDance / Dreamina",
    displayName:    "Seedream Lite",
    apiModelId:     "fal-ai/seedream/edit",
    studio:         "image",
    providerFamily: "fal",
    description:    "Seedream v5 edit tier — fast generation and image-to-image editing",
    phase:          1,
    status:         "active",
    badge:          "EDIT",
    badgeColor:     "#06B6D4",
    capabilities:   ["text_to_image", "image_to_image", "edit", "fast_mode"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "6–10 credits",
    creditMultiplier:   1,
  },

  {
    // Seedream 4.5 — active text-to-image + image editing via fal.ai queue.
    // Correct endpoint: fal-ai/bytedance/seedream/v4.5 (NOT fal-ai/seedream/v4.5 — that 404s).
    // Supports 2K (auto_2K) and 4K (auto_4K) native output. Edit mode via image_urls[] param.
    key:            "seedream-4-5",
    providerBrand:  "ByteDance / Dreamina",
    displayName:    "Seedream 4.5",
    apiModelId:     "fal-ai/bytedance/seedream/v4.5",
    studio:         "image",
    providerFamily: "fal",
    description:    "Text-to-image + image editing · 2K & 4K native resolution · 10 cr base",
    phase:          1,
    status:         "active",
    uiHidden:       false,
    capabilities:   ["text_to_image", "image_to_image", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
  },

  // ── FLUX.1 Kontext (via fal.ai) ────────────────────────────────────────────
  // Official brand: Black Forest Labs
  // Official model name: FLUX.1 Kontext [pro]
  // fal.ai endpoint: fal-ai/flux-pro/kontext

  {
    key:            "flux-kontext",
    providerBrand:  "Black Forest Labs",
    displayName:    "FLUX.1 Kontext",
    apiModelId:     "fal-ai/flux-pro/kontext",
    studio:         "image",
    providerFamily: "fal",
    description:    "Black Forest Labs context-aware image editing — style transfer, inpainting, consistency",
    phase:          1,
    status:         "active",
    badge:          "EDIT",
    badgeColor:     "#C6FF00",
    capabilities:   ["text_to_image", "image_to_image", "edit", "consistency"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "3–6 credits",
    creditMultiplier:   1.5,
  },

  // ── Image Phase 2 — Coming Soon ────────────────────────────────────────────

  // FLUX.2 — registered as coming-soon. Backend wired to switch from FLUX.1 when activated.
  // fal.ai endpoint TBD when FLUX.2 [pro] is publicly listed.
  {
    key:            "flux-2-image",
    providerBrand:  "Black Forest Labs",
    displayName:    "FLUX.2",
    apiModelId:     "fal-ai/flux-2/dev",      // placeholder — update when BFL publishes endpoint
    studio:         "image",
    providerFamily: "fal",
    description:    "Next-generation Black Forest Labs model — successor to FLUX.1 Kontext",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_image", "image_to_image", "edit", "consistency", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "TBD",
    creditMultiplier:   2,
    comingSoonLabel: "Coming Phase 2",
  },

  // FLUX.2 Max — highest tier. Registered as coming-soon until BFL publishes the endpoint.
  // fal.ai endpoint TBD. Update FAL_MODEL_FLUX_2_MAX env var when available.
  {
    key:            "flux-2-max",
    providerBrand:  "Black Forest Labs",
    displayName:    "FLUX.2 Max",
    apiModelId:     "fal-ai/flux-2-ultra",    // placeholder — update when BFL publishes endpoint
    studio:         "image",
    providerFamily: "fal",
    description:    "Black Forest Labs FLUX.2 Max — highest generation tier, maximum quality output",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_image", "image_to_image", "edit", "consistency", "photoreal"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "TBD",
    creditMultiplier:   2.5,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "grok-imagine-image",
    providerBrand:  "xAI",
    displayName:    "Grok Imagine",
    apiModelId:     "aurora",               // xAI's image model (Aurora)
    studio:         "image",
    providerFamily: "unknown",
    description:    "xAI's Grok image generation model",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_image", "photoreal"],
    supportedInputModes:   ["text"],
    supportedAspectRatios: ["1:1", "16:9", "9:16"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "topaz-upscale-image",
    providerBrand:  "Topaz Labs",
    displayName:    "Topaz Gigapixel AI",
    apiModelId:     "topaz-gigapixel",      // TBD when API available
    studio:         "image",
    providerFamily: "unknown",
    description:    "AI-powered image upscaling with detail enhancement",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["upscale"],
    supportedInputModes:   ["image"],
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    comingSoonLabel: "Coming Phase 2",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // VIDEO STUDIO — Phase 1 Active
  // ══════════════════════════════════════════════════════════════════════════

  // ── Kling AI ───────────────────────────────────────────────────────────────
  // Official brand: Kling AI (by Kuaishou)
  // API: api.klingai.com
  // Auth: accessKeyId:accessKeySecret → HS256 JWT
  // Model ID format: kling-v{major}[-omni]
  //   Kling Video 3.0       → kling-v3
  //   Kling Video 3.0 Omni  → kling-v3-omni
  //   Kling 2.5 Turbo       → kling-v2-5  (deprecated)
  //   Kling 2.6             → kling-v2-6  (deprecated)

  {
    key:            "kling-30-omni",
    providerBrand:  "Kling AI",
    displayName:    "Kling Video 3.0 Omni",
    apiModelId:     "kling-v3-omni",
    studio:         "video",
    providerFamily: "kling",
    description:    "Kling's most capable model — photorealistic generation with native audio and full feature set",
    phase:          1,
    status:         "active",
    badge:          "OMNI",
    badgeColor:     "#0EA5A0",
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame", "cinematic", "native_audio"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "10–18 credits",
    creditMultiplier:   1.5,
  },

  {
    key:            "kling-30",
    providerBrand:  "Kling AI",
    displayName:    "Kling Video 3.0",
    apiModelId:     "kling-v3",
    studio:         "video",
    providerFamily: "kling",
    description:    "Flagship cinematic model — best motion quality, extend support, text/image to video",
    phase:          1,
    status:         "active",
    badge:          "HOT",
    badgeColor:     "#0EA5A0",
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame", "cinematic", "extend"],
    supportedInputModes:   ["text", "image", "video"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "10–16 credits",
    creditMultiplier:   1.2,
  },

  {
    key:            "kling-motion-control",
    providerBrand:  "Kling AI",
    displayName:    "Kling Motion Control",
    apiModelId:     "kling-v3",             // same base model as 3.0; endpoint path distinguishes operation
    studio:         "video",
    providerFamily: "kling",
    description:    "Animate a subject with a reference motion video — precise character motion transfer",
    phase:          1,
    status:         "active",
    badge:          "MOTION",
    badgeColor:     "#6366F1",
    capabilities:   ["image_to_video", "motion_control"],
    supportedInputModes:   ["image", "video"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "12–20 credits",
    creditMultiplier:   1.8,
  },

  // ── Seedance (BytePlus ModelArk / Volcengine) ──────────────────────────────
  // Official brand: BytePlus / Volcengine (powered by Dreamina/Seedance)
  // API: ark.ap-southeast.bytepluses.com/api/v3 (OpenAI-compat chat completions)
  // Seedance 2.0 Fast is a platform speed tier of Seedance 2.0, not a separate family.

  {
    key:            "seedance-20",
    providerBrand:  "BytePlus / Volcengine",
    displayName:    "Seedance 2.0",
    apiModelId:     "dreamina-seedance-2-0-260128",
    studio:         "video",
    providerFamily: "byteplus",
    description:    "High-quality cinematic video — text/image to video, first+last frame support",
    phase:          1,
    status:         "active",
    badge:          "NEW",
    badgeColor:     "#A855F7",
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "10–14 credits",
    creditMultiplier:   1,
  },

  {
    // NOTE: Seedance 2.0 Fast is a BytePlus platform speed tier (endpoint label),
    // not a separate upstream model family. The displayName reflects this.
    key:            "seedance-20-fast",
    providerBrand:  "BytePlus / Volcengine",
    displayName:    "Seedance 2.0 Fast",
    apiModelId:     "dreamina-seedance-2-0-fast-260128",
    // displayName note: "Fast" is the BytePlus platform endpoint tier label for this model family.
    // apiModelId preserves the exact upstream model string — "fast" is not dropped from the endpoint.
    studio:         "video",
    providerFamily: "byteplus",
    description:    "Speed-optimized tier of Seedance 2.0 — same family, faster throughput",
    phase:          1,
    status:         "active",
    badge:          "FAST",
    badgeColor:     "#10B981",
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame", "fast_mode"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "8–12 credits",
    creditMultiplier:   0.8,
  },

  {
    key:            "seedance-15",
    providerBrand:  "BytePlus / Volcengine",
    displayName:    "Seedance 1.5 Pro",
    apiModelId:     "",                   // MUST be set via SEEDANCE_15_MODEL_ID env var
    studio:         "video",
    providerFamily: "byteplus",
    description:    "1080p capable — text/image to video, first+last frame, 4–12s range",
    phase:          1,
    status:         "active",
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [4, 8, 12],
    maxDuration:     12,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "10–16 credits",
    creditMultiplier:   1.2,
  },

  // ── Kling 2.6 ─────────────────────────────────────────────────────────────

  {
    key:            "kling-26",
    providerBrand:  "Kling AI",
    displayName:    "Kling 2.6",
    apiModelId:     "kling-v2-6",
    studio:         "video",
    providerFamily: "kling",
    description:    "Enhanced scene coherence and character fidelity",
    phase:          1,
    status:         "active",
    uiHidden:       false,
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "extend"],
    supportedInputModes:   ["text", "image", "video"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
  },

  // ── Kling 2.5 Turbo ───────────────────────────────────────────────────────

  {
    key:            "kling-25",
    providerBrand:  "Kling AI",
    displayName:    "Kling 2.5 Turbo",
    apiModelId:     "kling-v2-5",
    studio:         "video",
    providerFamily: "kling",
    description:    "Fast and reliable — ideal for quick iterations",
    phase:          1,
    status:         "active",
    uiHidden:       false,
    capabilities:   ["text_to_video", "image_to_video", "start_frame", "end_frame"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
  },

  // ── Video Phase 1 — Coming Soon (Runway confirmed) ─────────────────────────

  {
    key:            "runway-gen45",
    providerBrand:  "Runway",
    displayName:    "Gen-4.5",
    apiModelId:     "gen4_turbo",          // Runway API model string for Gen-4 Turbo / Gen-4.5
    studio:         "video",
    providerFamily: "runway",
    description:    "Runway Gen-4.5 — professional-grade AI video generation and editing",
    phase:          1,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#F59E0B",
    capabilities:   ["text_to_video", "image_to_video", "cinematic"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16"],
    supportedDurations: [5, 10],
    maxDuration:     10,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
    comingSoonLabel: "Coming Soon",
  },

  // ── Video Phase 2 — Coming Soon ────────────────────────────────────────────

  {
    key:            "veo-32",
    providerBrand:  "Google DeepMind",
    displayName:    "Google Veo 3.2",
    apiModelId:     "veo-3.0-generate-preview",
    // displayName note: product plan uses "Google Veo 3.2"; apiModelId is the current preview endpoint
    // and will be updated when Google publishes the finalized veo-3.2 model string.
    studio:         "video",
    providerFamily: "unknown",
    description:    "Google Veo — advanced AI video with native audio generation",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_video", "image_to_video", "native_audio"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16"],
    supportedDurations: [5, 8],
    maxDuration:     8,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "sora-2",
    providerBrand:  "OpenAI",
    displayName:    "Sora 2",
    apiModelId:     "sora-2",              // TBD — OpenAI has not published API model string
    studio:         "video",
    providerFamily: "unknown",
    description:    "OpenAI Sora — next-generation world-simulation video model",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#8B5CF6",
    capabilities:   ["text_to_video", "image_to_video", "cinematic"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10, 20],
    maxDuration:     20,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "ugc-creator-video",
    providerBrand:  "TBD",
    displayName:    "UGC Creator",
    apiModelId:     "",
    studio:         "video",
    providerFamily: "unknown",
    description:    "AI-generated UGC-style video for ads and social content",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_video", "avatar"],
    supportedInputModes:   ["text"],
    supportedAspectRatios: ["9:16", "1:1"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "grok-imagine-video",
    providerBrand:  "xAI",
    displayName:    "Grok Video",
    apiModelId:     "",                    // TBD when xAI publishes video model
    studio:         "video",
    providerFamily: "unknown",
    description:    "xAI video generation model",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_video"],
    supportedInputModes:   ["text"],
    supportedAspectRatios: ["16:9", "9:16"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "luma-ai",
    providerBrand:  "Luma AI",
    displayName:    "Dream Machine",
    apiModelId:     "dream-machine",
    studio:         "video",
    providerFamily: "unknown",
    description:    "Luma AI Dream Machine — photorealistic world-simulation video",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#64748B",
    capabilities:   ["text_to_video", "image_to_video"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16"],
    supportedDurations: [5],
    maxDuration:     5,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "wan-27",
    providerBrand:  "Wan (Alibaba)",
    displayName:    "Wan 2.7",
    apiModelId:     "wan2.7",              // fal.ai or direct endpoint TBD
    studio:         "video",
    providerFamily: "unknown",
    description:    "Wan 2.7 — advanced open-source video generation model",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_video", "image_to_video"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "minimax-hailuo-23",
    providerBrand:  "MiniMax",
    displayName:    "Hailuo 2.3",
    apiModelId:     "video-01",            // MiniMax API model ID for Hailuo
    studio:         "video",
    providerFamily: "unknown",
    description:    "MiniMax Hailuo — high-fidelity video with strong temporal consistency",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["text_to_video", "image_to_video"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  {
    key:            "topaz-upscale-video",
    providerBrand:  "Topaz Labs",
    displayName:    "Topaz Video AI",
    apiModelId:     "topaz-video-ai",      // TBD when API available
    studio:         "video",
    providerFamily: "unknown",
    description:    "Topaz Video AI — AI-powered video upscaling and enhancement",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["upscale"],
    supportedInputModes:   ["video"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIO STUDIO
  // ══════════════════════════════════════════════════════════════════════════

  {
    key:            "elevenlabs",
    providerBrand:  "ElevenLabs",
    displayName:    "ElevenLabs",
    apiModelId:     "eleven_turbo_v2",     // default; studio quality uses eleven_multilingual_v2
    studio:         "audio",
    providerFamily: "elevenlabs",
    description:    "Industry-leading text-to-speech — natural voices, multilingual",
    phase:          1,
    status:         "active",
    capabilities:   ["text_to_speech", "voice_clone", "narration", "dubbing"],
    supportedInputModes:   ["text", "audio"],
    supportedAspectRatios: [],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "3–6 credits",
    creditMultiplier:   1,
  },

  {
    key:            "kits-ai",
    providerBrand:  "Kits AI",
    displayName:    "Kits AI",
    apiModelId:     "kits-voice-convert-v1",
    studio:         "audio",
    providerFamily: "kits",
    description:    "AI voice conversion and cloning",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["voice_convert", "voice_clone"],
    supportedInputModes:   ["audio"],
    supportedAspectRatios: [],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    comingSoonLabel: "Coming Phase 2",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHARACTER STUDIO — Phase 1 Backend Prep (UI not yet built)
  // ══════════════════════════════════════════════════════════════════════════

  {
    // fal.ai Instant Character — primary influencer candidate generation engine.
    // User-facing label is NOT "Instant Character" — exposed only through Character Studio
    // UI copy. This entry drives routing + Activity Center display only.
    key:            "instant-character",
    providerBrand:  "fal.ai",
    displayName:    "Instant Character",
    apiModelId:     "fal-ai/instant-character",
    studio:         "character",
    providerFamily: "fal",
    description:    "fal.ai Instant Character — consistent identity portrait generation for AI Influencer Builder",
    phase:          1,
    status:         "active",
    badge:          "IDENTITY",
    badgeColor:     "#C6FF00",
    capabilities:   ["identity_creation", "look_variation", "photoreal", "consistency"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "4:5", "2:3", "9:16"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "8 credits",
    creditMultiplier:   1,
  },

  {
    // FLUX.1 Pro via fal.ai — fallback identity creation engine
    // displayName is "FLUX.1 Pro" (official BFL name) but internally labeled "FLUX Character"
    // for Zencra UI context. The apiModelId is the real upstream endpoint.
    key:            "flux-character",
    providerBrand:  "Black Forest Labs",
    displayName:    "FLUX.1 Pro",
    apiModelId:     "fal-ai/flux-pro",
    studio:         "character",
    providerFamily: "fal",
    description:    "Black Forest Labs FLUX.1 Pro — primary identity creation engine",
    phase:          1,
    status:         "active",
    badge:          "IDENTITY",
    badgeColor:     "#C6FF00",
    capabilities:   ["identity_creation", "look_variation", "photoreal", "consistency"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["1:1", "4:5", "16:9"],
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "5–10 credits",
    creditMultiplier:   2,
  },

  {
    key:            "stability-character",
    providerBrand:  "Stability AI",
    displayName:    "Stable Diffusion 3",
    apiModelId:     "sd3-large-turbo",     // Stability v2beta endpoint uses SD3
    studio:         "character",
    providerFamily: "stability",
    description:    "Stability AI SD3 — character refinement, inpainting, outpainting, upscaling",
    phase:          1,
    status:         "active",
    badge:          "REFINE",
    badgeColor:     "#6366F1",
    capabilities:   ["identity_refinement", "inpaint", "outpaint", "upscale", "scene_expansion"],
    supportedInputModes:   ["image", "text"],
    supportedAspectRatios: ["1:1", "4:5", "16:9", "9:16"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "3–8 credits",
    creditMultiplier:   1.5,
  },

  {
    key:            "motion-abstraction",
    providerBrand:  "TBD",
    displayName:    "Motion",
    apiModelId:     "",                    // resolved at runtime via MOTION_PROVIDER env
    studio:         "character",
    providerFamily: "motion-abstract",
    description:    "Image-to-video motion generation — provider resolved at launch via MOTION_PROVIDER env",
    phase:          1,
    status:         "active",
    badge:          "MOTION",
    badgeColor:     "#F59E0B",
    capabilities:   ["motion_starter", "image_to_video"],
    supportedInputModes:   ["image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [3, 5],
    maxDuration:     5,
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "8–12 credits",
    creditMultiplier:   1,
  },

  {
    key:            "speaking-avatar-future",
    providerBrand:  "TBD",
    displayName:    "Speaking Avatar",
    apiModelId:     "",
    studio:         "character",
    providerFamily: "unknown",
    description:    "HeyGen-style speaking avatar layer — future integration",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["avatar", "lip_sync"],
    supportedInputModes:   ["image", "audio", "text"],
    supportedAspectRatios: ["16:9", "9:16"],
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    comingSoonLabel: "Coming Soon",
  },

  {
    key:            "realtime-human-future",
    providerBrand:  "TBD",
    displayName:    "Real-Time Human",
    apiModelId:     "",
    studio:         "character",
    providerFamily: "unknown",
    description:    "Tavus-style real-time digital human layer — future integration",
    phase:          2,
    status:         "coming-soon",
    badge:          "SOON",
    badgeColor:     "#374151",
    capabilities:   ["avatar"],
    supportedInputModes:   ["text", "audio"],
    supportedAspectRatios: ["16:9", "9:16"],
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    comingSoonLabel: "Coming Soon",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // UGC STUDIO — Phase 1 Active
  // ══════════════════════════════════════════════════════════════════════════

  {
    key:            "creatify",
    providerBrand:  "Creatify",
    displayName:    "Creatify",
    apiModelId:     "link_to_videos",      // Creatify API endpoint label
    studio:         "ugc",
    providerFamily: "creatify",
    description:    "Product URL to UGC ad video — primary ad generation engine",
    phase:          1,
    status:         "active",
    badge:          "ADS",
    badgeColor:     "#F97316",
    capabilities:   ["product_to_ad", "text_to_video"],
    supportedInputModes:   ["url", "text"],
    supportedAspectRatios: ["9:16", "1:1", "16:9"],
    supportedDurations: [15, 30, 60],
    maxDuration:     60,
    asyncMode:       "polling+webhook",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "15–30 credits",
    creditMultiplier:   3,
  },

  {
    key:            "arcads",
    providerBrand:  "Arcads",
    displayName:    "Arcads",
    apiModelId:     "/v1/ads",             // Arcads API endpoint path
    studio:         "ugc",
    providerFamily: "arcads",
    description:    "Script-driven UGC ad generation — actor-based video ads",
    phase:          1,
    status:         "active",
    badge:          "UGC",
    badgeColor:     "#EC4899",
    capabilities:   ["script_to_avatar", "product_to_ad"],
    supportedInputModes:   ["text", "url"],
    supportedAspectRatios: ["9:16", "1:1"],
    supportedDurations: [15, 30, 60],
    maxDuration:     60,
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "15–25 credits",
    creditMultiplier:   2.5,
  },

  {
    key:            "heygen-ugc",
    providerBrand:  "HeyGen",
    displayName:    "HeyGen",
    apiModelId:     "/v2/video/generate",  // HeyGen API endpoint path
    studio:         "ugc",
    providerFamily: "heygen-ugc",
    description:    "Avatar-based UGC — script to talking-head video ad",
    phase:          1,
    status:         "active",
    badge:          "AVATAR",
    badgeColor:     "#8B5CF6",
    capabilities:   ["script_to_avatar", "avatar", "character_to_ugc"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    supportedDurations: [15, 30, 60, 120],
    maxDuration:     120,
    asyncMode:       "polling",
    supportsWebhook: true,
    supportsPolling: true,
    estimatedCostRange: "20–40 credits",
    creditMultiplier:   3.5,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FUTURE CINEMA STUDIO — Completely Isolated Namespace (fcs_*)
  // ══════════════════════════════════════════════════════════════════════════
  // LTX Video API is one-call synchronous response (sync mode).
  // The API returns the video URL directly; no polling/webhook needed.
  // asyncMode: "sync" is the correct designation.

  {
    key:            "fcs_ltx-v095",
    providerBrand:  "Lightricks",
    displayName:    "LTX Video 0.9.5",
    apiModelId:     "ltx-video-0.9.5",
    studio:         "fcs",
    providerFamily: "ltx",
    description:    "Lightricks LTX Video — latest stable release for Future Cinema Studio",
    phase:          "fcs",
    status:         "fcs-only",
    badge:          "FCS",
    badgeColor:     "#7C3AED",
    capabilities:   ["text_to_video", "image_to_video", "cinematic_studio", "long_form"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10, 20, 30],
    maxDuration:     30,
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "TBD",
    creditMultiplier:   5,
  },

  {
    key:            "fcs_ltx-v091",
    providerBrand:  "Lightricks",
    displayName:    "LTX Video 0.9.1",
    apiModelId:     "ltx-video-0.9.1",
    studio:         "fcs",
    providerFamily: "ltx",
    description:    "Lightricks LTX Video — previous stable release",
    phase:          "fcs",
    status:         "fcs-only",
    badge:          "FCS",
    badgeColor:     "#7C3AED",
    capabilities:   ["text_to_video", "image_to_video", "cinematic_studio"],
    supportedInputModes:   ["text", "image"],
    supportedAspectRatios: ["16:9", "9:16"],
    supportedDurations: [5, 10, 20],
    maxDuration:     20,
    asyncMode:       "sync",
    supportsWebhook: false,
    supportsPolling: false,
    estimatedCostRange: "TBD",
    creditMultiplier:   4,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LIP SYNC STUDIO — Phase 1 Active
  // ══════════════════════════════════════════════════════════════════════════

  // ── Sync Labs v3 (via fal.ai queue) ────────────────────────────────────────
  // Completely separate from the existing /api/lipsync/* (legacy) system.
  // Uses the LipSyncProviderAdapter in src/lib/providers/lipsync/pro.ts directly.
  // No studioDispatch, no ZProvider — its own dedicated generate + status routes.
  {
    key:            "sync-lipsync-v3",
    providerBrand:  "Sync Labs",
    displayName:    "Sync v3",
    apiModelId:     "fal-ai/sync-lipsync/v3",
    studio:         "lipsync",
    providerFamily: "fal-lipsync",
    description:    "Sync Labs v3 lip sync — sync audio to any video face via fal.ai queue",
    phase:          1,
    status:         "active",
    badge:          "SYNC",
    badgeColor:     "#6366F1",
    capabilities:   ["lip_sync"],
    supportedInputModes:   ["video", "audio"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedDurations: [5, 10, 15, 20, 25, 30, 60, 90, 120, 180, 240, 300],
    maxDuration:     300,   // 5 minutes hard cap
    asyncMode:       "polling",
    supportsWebhook: false,
    supportsPolling: true,
    estimatedCostRange: "90–540 credits",
    creditMultiplier:   1,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a model entry by its key. */
export function getModel(key: string): ModelRegistryEntry | undefined {
  return MODEL_REGISTRY.find(m => m.key === key);
}

/** Get all active (callable) models for a studio. */
export function getActiveModels(studio: StudioType): ModelRegistryEntry[] {
  return MODEL_REGISTRY.filter(m => m.studio === studio && m.status === "active");
}

/** Get all visible models for a studio (active + coming-soon, no deprecated, no uiHidden). */
export function getVisibleModels(studio: StudioType): ModelRegistryEntry[] {
  return MODEL_REGISTRY.filter(
    m => m.studio === studio && !m.uiHidden && m.status !== "deprecated"
  );
}

/** Get all models for a phase (useful for admin views). */
export function getModelsByPhase(phase: Phase): ModelRegistryEntry[] {
  return MODEL_REGISTRY.filter(m => m.phase === phase);
}

/** Get all deprecated models (for migration / admin reference). */
export function getDeprecatedModels(): ModelRegistryEntry[] {
  return MODEL_REGISTRY.filter(m => m.status === "deprecated");
}

/** Get all FCS models (separate namespace). */
export function getFCSModels(): ModelRegistryEntry[] {
  return MODEL_REGISTRY.filter(m => m.studio === "fcs");
}

/** Check if a model key exists and is active (callable). */
export function isModelActive(key: string): boolean {
  const m = getModel(key);
  return !!m && m.status === "active";
}

/** Check if a model key is in the FCS namespace. */
export function isFCSModel(key: string): boolean {
  return key.startsWith("fcs_");
}

/** Look up the exact apiModelId for a given model key. */
export function getApiModelId(key: string): string | undefined {
  return getModel(key)?.apiModelId;
}

/** Look up the providerBrand for a given model key. */
export function getProviderBrand(key: string): string | undefined {
  return getModel(key)?.providerBrand;
}
