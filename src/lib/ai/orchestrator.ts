/**
 * AI Orchestrator
 *
 * Single entry point for all generation requests. Responsibilities:
 *   1. Validate prompt
 *   2. Resolve provider (mode + optional caller override)
 *   3. Normalize and transform the prompt via prompt-transform
 *   4. Dispatch to the correct provider implementation
 *   5. Return a ProviderGenerateResult (caller handles DB + credits)
 *
 * Provider dispatch table:
 *   image  + dalle        → dalleProvider        (REAL – OpenAI DALL-E 3)
 *   image  + nano-banana  → nanoBananaProvider   (REAL – async/poll)
 *   audio  + elevenlabs   → elevenLabsProvider   (REAL – TTS)
 *   audio  + kits         → kitsProvider         (REAL – voice conversion)
 *   video  + *            → mockProvider         (PLACEHOLDER)
 *   *      + *            → mockProvider         (PLACEHOLDER)
 *
 * Credit deduction and DB persistence are NOT done here.
 * They live in /api/generate/route.ts so they stay transactional with auth.
 */

import { normalizePrompt }    from "./prompt-transform";
import { resolveProvider }    from "./routing";
import { dalleProvider }      from "./providers/dalle";
import { elevenLabsProvider } from "./providers/elevenlabs";
import { kitsProvider }       from "./providers/kits";
import { nanoBananaProvider } from "./providers/nano-banana";
import { mockProvider }       from "./providers/mock";
import type {
  AiProvider,
  GenerateContentInput,
  ProviderGenerateResult,
  ProviderName,
} from "./types";

// ── Provider dispatch ─────────────────────────────────────────────────────────

function getProvider(mode: string, providerName: ProviderName): AiProvider {
  if (mode === "image" && providerName === "dalle")        return dalleProvider;
  if (mode === "image" && providerName === "nano-banana")  return nanoBananaProvider;
  if (mode === "audio" && providerName === "elevenlabs")   return elevenLabsProvider;
  if (mode === "audio" && providerName === "kits")         return kitsProvider;
  return mockProvider;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateContent(
  input: GenerateContentInput
): Promise<ProviderGenerateResult> {
  try {
    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new Error("Prompt is required");
    }

    const providerName     = resolveProvider(input.mode, input.provider);
    const normalizedPrompt = normalizePrompt(input);
    const provider         = getProvider(input.mode, providerName);

    const result = await provider.generate({
      prompt:          normalizedPrompt.transformed,
      mode:            input.mode,
      normalizedPrompt,
      quality:         input.quality ?? "cinematic",
      aspectRatio:     input.aspectRatio,
      durationSeconds: input.durationSeconds,
      imageUrl:        input.imageUrl,
      audioUrl:        input.audioUrl,
      voiceId:         input.voiceId,
      metadata:        { ...input.metadata, _resolvedProvider: providerName },
    });

    return { ...result, provider: providerName };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      provider: input.provider ?? resolveProvider(input.mode, undefined),
      mode:     input.mode,
      status:   "error",
      error:    message,
    };
  }
}
