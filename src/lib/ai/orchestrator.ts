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
 * Provider dispatch table (update when new providers are wired up):
 *   image  + dalle      → dalleProvider     (REAL – OpenAI DALL-E 3)
 *   image  + nano-banana → mockProvider     (PLACEHOLDER)
 *   image  + ideogram    → mockProvider     (PLACEHOLDER)
 *   video  + *           → mockProvider     (PLACEHOLDER)
 *   audio  + *           → mockProvider     (PLACEHOLDER)
 *
 * Credit deduction and DB persistence are NOT done here.
 * They live in /api/generate/route.ts so they stay transactional with auth.
 */

import { normalizePrompt }  from "./prompt-transform";
import { resolveProvider }  from "./routing";
import { dalleProvider }   from "./providers/dalle";
import { mockProvider }    from "./providers/mock";
import type {
  AiProvider,
  GenerateContentInput,
  ProviderGenerateResult,
  ProviderName,
} from "./types";

// ── Provider dispatch ─────────────────────────────────────────────────────────

/**
 * Returns the provider implementation for a given mode + resolved provider name.
 * Add entries here as real providers are connected.
 */
function getProvider(mode: string, providerName: ProviderName): AiProvider {
  if (mode === "image" && providerName === "dalle") return dalleProvider;
  // All other combinations are placeholders until their providers are wired up
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

    // 1. Resolve provider (throws if provider is not allowed for this mode)
    const providerName = resolveProvider(input.mode, input.provider);

    // 2. Normalize + transform the prompt (mode-specific framing, whitespace, etc.)
    const normalizedPrompt = normalizePrompt(input);

    // 3. Get the provider implementation
    const provider = getProvider(input.mode, providerName);

    // 4. Call the provider
    const result = await provider.generate({
      prompt:          normalizedPrompt.transformed,
      mode:            input.mode,
      normalizedPrompt,
      quality:         input.quality ?? "cinematic",
      aspectRatio:     input.aspectRatio,
      durationSeconds: input.durationSeconds,
      imageUrl:        input.imageUrl,
      voiceId:         input.voiceId,
      // Pass the resolved provider name so mock providers can return the
      // correct `provider` field without coupling to routing logic.
      metadata:        { ...input.metadata, _resolvedProvider: providerName },
    });

    // 5. Guarantee the `provider` field always matches what routing resolved.
    //    Real providers set this themselves, but mocks derive it from metadata.
    //    This line is a safety net — it costs nothing and prevents drift.
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
