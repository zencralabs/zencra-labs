export type GenerationMode = "image" | "video" | "audio";
export type GenerationQuality = "draft" | "cinematic" | "studio";

export type GenerationStatus =
  | "queued"
  | "pending"
  | "processing"
  | "success"
  | "error"
  | "failed";

export type ProviderName =
  | "dalle"
  | "kling"
  | "elevenlabs"
  | "kits"
  | "nano-banana"
  | "ideogram"
  | "seedance"
  | "heygen";

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:5";

export type CreditBreakdown = {
  base: number;
  modifiers: Record<string, number>;
  total: number;
};

// ── Camera control (shared between input types) ───────────────────────────────

export type CameraControlInput = {
  type: string;                        // "simple" | preset name
  config?: Record<string, number>;     // only for type="simple"
};

// ── Main generation input (caller → orchestrator) ─────────────────────────────

export type GenerateContentInput = {
  mode:              GenerationMode;
  provider?:         ProviderName;
  prompt:            string;
  quality?:          GenerationQuality;
  aspectRatio?:      AspectRatio;
  durationSeconds?:  number;

  // Image inputs
  imageUrl?:         string;  // start frame / I2V image
  endImageUrl?:      string;  // end frame (image_tail)

  // Video inputs
  sourceVideoId?:    string;  // DB generation ID for extend / lip-sync
  sourceVideoUrl?:   string;  // direct URL for extend / lip-sync

  // Motion / reference inputs
  referenceVideoUrl?: string; // motion reference video

  // Audio inputs
  audioUrl?:         string;
  voiceId?:          string;

  // Provider-specific controls
  videoMode?:        "std" | "pro";   // Kling quality mode
  cameraControl?:    CameraControlInput;
  operationType?:    string;          // explicit operation hint

  metadata?:         Record<string, unknown>;
};

export type NormalizedPrompt = {
  original:       string;
  transformed:    string;
  negativePrompt?: string;
  metadata?:      Record<string, unknown>;
};

// ── Provider input (orchestrator → provider) ──────────────────────────────────

export type ProviderGenerateInput = {
  prompt:            string;
  mode:              GenerationMode;
  normalizedPrompt:  NormalizedPrompt;
  quality:           GenerationQuality;
  aspectRatio?:      AspectRatio;
  durationSeconds?:  number;

  // Image inputs
  imageUrl?:         string;
  endImageUrl?:      string;

  // Video inputs
  sourceVideoId?:    string;
  sourceVideoUrl?:   string;

  // Motion / reference
  referenceVideoUrl?: string;

  // Audio
  audioUrl?:         string;
  voiceId?:          string;

  // Provider controls
  videoMode?:        "std" | "pro";
  cameraControl?:    CameraControlInput;
  operationType?:    string;

  metadata?:         Record<string, unknown>;
};

// ── Provider result ───────────────────────────────────────────────────────────

export type ProviderGenerateResult = {
  provider:  ProviderName;
  mode:      GenerationMode;
  status:    "success" | "pending" | "error";
  url?:      string;
  taskId?:   string;
  mimeType?: string;
  error?:    string;
  metadata?: Record<string, unknown>;
};

export type ProviderStatusResult = {
  provider: ProviderName;
  taskId:   string;
  status:   "pending" | "success" | "error";
  url?:     string;
  error?:   string;
  metadata?: Record<string, unknown>;
};

export type AiProvider = {
  name:            ProviderName;
  supportedModes:  GenerationMode[];
  isPlaceholder?:  boolean;
  generate:        (input: ProviderGenerateInput) => Promise<ProviderGenerateResult>;
  getStatus?:      (taskId: string) => Promise<ProviderStatusResult>;
};

// ── Route shapes ──────────────────────────────────────────────────────────────

export type RouteGenerationResponse = {
  success: boolean;
  data?:   ProviderGenerateResult;
  error?:  string;
};

export type RouteStatusResponse = {
  success: boolean;
  data?:   ProviderStatusResult;
  error?:  string;
};

// ── Credit types ──────────────────────────────────────────────────────────────

export type CreditEstimateInput = {
  mode:            GenerationMode;
  quality?:        GenerationQuality;
  durationSeconds?: number;
  aspectRatio?:    AspectRatio;
  metadata?:       Record<string, unknown>;
};

export type CreditEstimateResult = CreditBreakdown;
