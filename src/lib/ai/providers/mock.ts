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
 *   - Provider name in the result is set dynamically from the resolved
 *     provider passed via metadata._resolvedProvider (set by orchestrator).
 */

import type {
  AiProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderName,
} from "../types";

export const mockProvider: AiProvider = {
  // `name` here is a nominal label. The actual provider name returned in
  // results is set from metadata._resolvedProvider (injected by orchestrator).
  name:           "kling",
  supportedModes: ["video", "audio"],
  isPlaceholder:  true,

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    // The orchestrator stamps the resolved provider name onto metadata so the
    // mock can return the correct `provider` field without hard-coding it here.
    const resolvedProvider =
      (input.metadata?._resolvedProvider as ProviderName | undefined) ??
      (input.mode === "audio" ? "elevenlabs" : "kling");

    return {
      provider: resolvedProvider,
      mode:     input.mode,
      status:   "success",
      url:      `https://example.com/mock-${input.mode}-output`,
      metadata: {
        note:             `Mock response — ${resolvedProvider} provider not yet connected`,
        normalizedPrompt: input.normalizedPrompt.transformed,
        isPlaceholder:    true,
      },
    };
  },
};
