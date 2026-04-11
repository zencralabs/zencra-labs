/**
 * Mock Provider — returns a placeholder response for unconnected providers.
 * Never used in production for real generation.
 */
import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

export const mockProvider: AiProvider = {
  name: "dalle",          // placeholder — overridden by orchestrator return value
  supportedModes: ["image", "video", "audio"],
  isPlaceholder: true,

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const resolvedProvider = (input.metadata?._resolvedProvider as string) ?? "mock";
    return {
      provider: resolvedProvider as ProviderGenerateResult["provider"],
      mode:     input.mode,
      status:   "success",
      url:      "https://placehold.co/1024x1024/1a1a2e/60A5FA?text=Mock+Output",
      metadata: { note: "Mock provider — wire a real provider for this mode/variant" },
    };
  },
};
