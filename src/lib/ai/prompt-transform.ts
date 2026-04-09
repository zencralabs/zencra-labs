import type {
  GenerateContentInput,
  GenerationMode,
  NormalizedPrompt,
} from "./types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildImagePrompt(prompt: string): string {
  return normalizeWhitespace(prompt);
}

function buildVideoPrompt(prompt: string): string {
  return normalizeWhitespace(
    `${prompt}. Cinematic motion, strong composition, smooth camera movement, detailed lighting, filmic atmosphere.`
  );
}

function buildAudioPrompt(prompt: string): string {
  return normalizeWhitespace(
    `${prompt}. Clean vocal delivery, professional voice clarity, natural pacing, studio-quality audio.`
  );
}

function buildNegativePrompt(mode: GenerationMode): string | undefined {
  switch (mode) {
    case "image":
      return "blurry, distorted, low quality, extra limbs, malformed hands, artifacts, watermark, text";
    case "video":
      return "flicker, jitter, warped motion, low quality, artifacts, watermark, broken anatomy";
    case "audio":
      return "distortion, clipping, background noise, low clarity, robotic artifacts";
    default:
      return undefined;
  }
}

function transformPromptByMode(
  mode: GenerationMode,
  prompt: string
): string {
  switch (mode) {
    case "image":
      return buildImagePrompt(prompt);
    case "video":
      return buildVideoPrompt(prompt);
    case "audio":
      return buildAudioPrompt(prompt);
    default:
      return normalizeWhitespace(prompt);
  }
}

export function normalizePrompt(input: GenerateContentInput): NormalizedPrompt {
  const original = normalizeWhitespace(input.prompt);
  const transformed = transformPromptByMode(input.mode, original);
  const negativePrompt = buildNegativePrompt(input.mode);

  return {
    original,
    transformed,
    negativePrompt,
    metadata: {
      mode: input.mode,
      quality: input.quality ?? "cinematic",
      aspectRatio: input.aspectRatio ?? null,
      durationSeconds: input.durationSeconds ?? null,
    },
  };
}
