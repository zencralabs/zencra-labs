/**
 * DALL-E 3 / GPT Image 1.5 Provider
 * Calls OpenAI's image generation endpoint synchronously.
 * Env: OPENAI_API_KEY
 */
import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

export const dalleProvider: AiProvider = {
  name:           "dalle",
  supportedModes: ["image"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    // Map quality → size
    const size = input.quality === "studio" ? "1792x1024"
               : input.aspectRatio === "9:16" ? "1024x1792"
               : "1024x1024";

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        model:           "dall-e-3",
        prompt:          input.normalizedPrompt.transformed,
        n:               1,
        size,
        quality:         input.quality === "studio" ? "hd" : "standard",
        response_format: "url",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg = String((body?.error as Record<string, unknown>)?.message ?? "OpenAI error");
      if (msg.includes("content_policy")) throw new Error("Prompt was flagged by content policy. Please revise and try again.");
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      throw new Error("Image generation failed. Please try again.");
    }

    const url = ((body.data as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.url as string;
    if (!url) throw new Error("No image URL returned. Please try again.");

    return { provider: "dalle", mode: "image", status: "success", url };
  },
};
