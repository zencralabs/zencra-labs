import { normalizePrompt } from "./prompt-transform";
import { resolveProvider } from "./routing";
import type {
  GenerateContentInput,
  ProviderGenerateResult,
} from "./types";

export async function generateContent(
  input: GenerateContentInput
): Promise<ProviderGenerateResult> {
  try {
    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new Error("Prompt is required");
    }

    const provider = resolveProvider(input.mode, input.provider);

    const normalized = normalizePrompt(input);

    // TEMP: mock response (we will replace with real providers next)
    return {
      provider,
      mode: input.mode,
      status: "success",
      url: "https://example.com/mock-output",
      metadata: {
        note: "Mock response — provider not yet connected",
        normalizedPrompt: normalized,
      },
    };
  } catch (error: any) {
    return {
      provider: input.provider || "dalle",
      mode: input.mode,
      status: "error",
      error: error.message || "Unknown error",
    };
  }
}
