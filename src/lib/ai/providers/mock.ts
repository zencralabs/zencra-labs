/**
 * Mock Provider
 *
 * Placeholder for video and audio modes that are not yet connected to real
 * providers. Returns a structurally correct ProviderGenerateResult so the
 * rest of the pipeline (DB insert, credit deduction, status polling) behaves
 * identically to a real provider response.
 *
 * Rules:
 *   - Do NOT remove this until the real provider is wired up and tested.
 *   - The `isPlaceholder: true` flag lets callers detect mock responses.
 */

import type {
  AiProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderName,
} from "../types";

export const mockProvider: AiProvider = {
  name:           "kling",
  supportedModes: ["video", "audio"],
  isPlaceholder:  true,

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const resolvedProvider =
      (input.metadata?._resolvedProvider as ProviderName | undefined) ??
      (input.mode === "audio" ? "elevenlabs" : "kling");

    return {
      provider: resolvedProvider,
      mode:     input.mode,
      status:   "success",
      url:      "https://placehold.co/1024x1024/1a1a2e/60A5FA?text=Mock+Output",
      metadata: {
        note:             `Mock response — ${resolvedProvider} provider not yet connected`,
        normalizedPrompt: input.normalizedPrompt.transformed,
        isPlaceholder:    true,
      },
    };
  },
};
