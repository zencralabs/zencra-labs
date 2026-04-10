/**
 * DALL-E 3 Provider
 *
 * Implements the AiProvider interface for OpenAI DALL-E 3 image generation.
 *
 * Mapping rules:
 *   quality:      draft|cinematic → "standard"   studio → "hd"
 *   aspectRatio:  1:1  → 1024x1024 (default)
 *                 16:9 → 1792x1024
 *                 9:16 → 1024x1792
 *                 4:5  → 1024x1024 (DALL-E 3 has no 4:5 size, falls back to square)
 *
 * Credit cost is NOT managed here — it lives in /api/generate/route.ts
 * via calculateCredits() + spend_credits RPC. This file is pure provider I/O.
 *
 * API cost reference (for margin tracking):
 *   standard 1024x1024 → $0.040/image
 *   hd       1024x1024 → $0.080/image
 *   hd       1792x1024 → $0.120/image
 *   hd       1024x1792 → $0.120/image
 */

import OpenAI from "openai";
import type {
  AiProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from "../types";

// Instantiated lazily per request — Next.js edge/serverless safe.
// The key is validated at runtime; missing key → OpenAI SDK throws on first call.
const getClient = (() => {
  let client: OpenAI | null = null;
  return () => {
    if (!client) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return client;
  };
})();

// ── Mapping helpers ───────────────────────────────────────────────────────────

type DalleQuality = "standard" | "hd";
type DalleSize    = "1024x1024" | "1792x1024" | "1024x1792";

function toDalleQuality(quality: string): DalleQuality {
  return quality === "studio" ? "hd" : "standard";
}

function toDalleSize(aspectRatio?: string): DalleSize {
  switch (aspectRatio) {
    case "16:9": return "1792x1024";
    case "9:16": return "1024x1792";
    default:     return "1024x1024";  // 1:1 and 4:5 both fall back to square
  }
}

// ── Provider implementation ───────────────────────────────────────────────────

export const dalleProvider: AiProvider = {
  name:           "dalle",
  supportedModes: ["image"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const dalleQuality = toDalleQuality(input.quality);
    const dalleSize    = toDalleSize(input.aspectRatio);

    // Use the transformed prompt from prompt-transform.ts (adds cinematic
    // framing, removes whitespace). DALL-E 3 doesn't support a separate
    // negative_prompt param, so we rely on positive framing only.
    const prompt = input.normalizedPrompt.transformed;

    try {
      const openai   = getClient();
      const response = await openai.images.generate({
        model:           "dall-e-3",
        prompt,
        quality:         dalleQuality,
        size:            dalleSize,
        response_format: "url",
        n:               1,           // DALL-E 3 only supports n=1
      });

      const imageData = response.data?.[0];
      const url       = imageData?.url;

      if (!url) {
        return {
          provider: "dalle",
          mode:     "image",
          status:   "error",
          error:    "DALL-E 3 returned no image URL",
        };
      }

      return {
        provider: "dalle",
        mode:     "image",
        status:   "success",
        url,
        mimeType: "image/png",
        metadata: {
          model:          "dall-e-3",
          quality:        dalleQuality,
          size:           dalleSize,
          // DALL-E 3 sometimes rewrites the prompt for safety/clarity.
          // Storing the revised prompt helps with debugging and audit logs.
          revised_prompt: imageData.revised_prompt ?? null,
        },
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "DALL-E 3 generation failed";

      // Surface OpenAI error codes for structured error handling upstream
      const openaiError = err as { code?: string; status?: number };
      return {
        provider: "dalle",
        mode:     "image",
        status:   "error",
        error:    message,
        metadata: {
          openai_code:   openaiError.code   ?? null,
          openai_status: openaiError.status ?? null,
        },
      };
    }
  },
};
