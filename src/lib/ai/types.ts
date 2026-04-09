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

export type GenerateContentInput = {
  mode: GenerationMode;
  provider?: ProviderName;
  prompt: string;
  quality?: GenerationQuality;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  imageUrl?: string;
  voiceId?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedPrompt = {
  original: string;
  transformed: string;
  negativePrompt?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderGenerateInput = {
  mode: GenerationMode;
  prompt: string;
  normalizedPrompt: NormalizedPrompt;
  quality: GenerationQuality;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  imageUrl?: string;
  voiceId?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderGenerateResult = {
  provider: ProviderName;
  mode: GenerationMode;
  status: "success" | "pending" | "error";
  url?: string;
  taskId?: string;
  mimeType?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderStatusResult = {
  provider: ProviderName;
  taskId: string;
  status: "pending" | "success" | "error";
  url?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type AiProvider = {
  name: ProviderName;
  supportedModes: GenerationMode[];
  isPlaceholder?: boolean;
  generate: (input: ProviderGenerateInput) => Promise<ProviderGenerateResult>;
  getStatus?: (taskId: string) => Promise<ProviderStatusResult>;
};

export type RouteGenerationResponse = {
  success: boolean;
  data?: ProviderGenerateResult;
  error?: string;
};

export type RouteStatusResponse = {
  success: boolean;
  data?: ProviderStatusResult;
  error?: string;
};

export type CreditEstimateInput = {
  mode: GenerationMode;
  quality?: GenerationQuality;
  durationSeconds?: number;
  aspectRatio?: AspectRatio;
  metadata?: Record<string, unknown>;
};

export type CreditEstimateResult = CreditBreakdown;git add src/lib/ai/types.ts
git commit -m "feat: add AI types foundation"
