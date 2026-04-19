/**
 * Image Studio — FLUX.1 Kontext Provider (via fal.ai)
 *
 * Black Forest Labs FLUX.1 Kontext [pro] — context-aware image editing model.
 * Official name: "FLUX.1 Kontext" (BFL branding).
 * fal.ai endpoint: fal-ai/flux-pro/kontext
 *
 * Specializes in:
 *   - Text-guided image editing with context preservation
 *   - Style transfer with identity consistency
 *   - Image-to-image transformations
 *
 * Provider: fal.ai → fal-ai/flux-pro/kontext
 * Env: FAL_KEY
 * Async: polling (fal.ai queue)
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getFalEnv, FAL_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// FLUX KONTEXT PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const fluxKontextProvider: ZProvider = {
  providerId:  "fal",
  modelKey:    "flux-kontext",
  studio:      "image",
  displayName: "FLUX.1 Kontext",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "image"],
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
      capabilities:          ["text_to_image", "image_to_image", "edit", "consistency"],
      asyncMode:             "polling",
      supportsWebhook:       false,
      supportsPolling:       true,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.prompt || input.prompt.trim().length < 3) {
      errors.push("Prompt must be at least 3 characters.");
    }
    // Kontext is most powerful with a source image — warn but don't block
    const warnings = !input.imageUrl
      ? ["FLUX.1 Kontext works best with a source image for context-aware editing. Proceeding as text-to-image."]
      : [];
    return { valid: errors.length === 0, errors, warnings };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const isEdit = !!input.imageUrl;
    const base   = isEdit ? 5 : 3;
    const extra  = input.providerParams?.steps === "high" ? 2 : 0;
    return {
      min:       3,
      max:       7,
      expected:  base + extra,
      breakdown: { base, high_steps: extra },
    };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.fluxKontext;
    const jobId     = newJobId();

    const payload: Record<string, unknown> = {
      prompt:      input.prompt,
      image_size:  aspectToFalSize(input.aspectRatio ?? "1:1"),
      num_images:  1,
      output_format: "jpeg",
      enable_safety_checker: true,
    };

    if (input.imageUrl) {
      payload.image_url = input.imageUrl;  // source image for editing context
    }
    if (input.seed) payload.seed = input.seed;
    if (input.negativePrompt) payload.negative_prompt = input.negativePrompt;

    const res = await fetch(`https://queue.fal.run/${modelId}`, {
      method:  "POST",
      headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`FLUX.1 Kontext submission failed (HTTP ${res.status}): ${err.slice(0, 100)}`);
    }

    const data      = (await res.json()) as Record<string, unknown>;
    const requestId = String(data.request_id ?? data.requestId ?? "");
    if (!requestId) throw new Error("FLUX.1 Kontext returned no request ID.");

    const now = new Date();
    return {
      id: jobId, provider: "fal", modelKey: "flux-kontext",
      studioType: "image", status: "pending", externalJobId: requestId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { modelId, requestId, hasSourceImage: !!input.imageUrl },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.fluxKontext;

    const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${externalJobId}/status`, {
      headers: { "Authorization": `Key ${apiKey}` },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!statusRes.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${statusRes.status}` };

    const data   = (await statusRes.json()) as Record<string, unknown>;
    const status = String(data.status ?? "");

    if (status === "COMPLETED") {
      const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${externalJobId}`, {
        headers: { "Authorization": `Key ${apiKey}` },
      });
      if (!resultRes.ok) return { jobId: externalJobId, status: "error", error: "Failed to fetch result." };
      const result = (await resultRes.json()) as Record<string, unknown>;
      const images = result.images as Array<{ url: string }> | undefined;
      return {
        jobId: externalJobId, status: "success",
        url: images?.[0]?.url,
        metadata: { seed: result.seed, has_nsfw_concepts: result.has_nsfw_concepts },
      };
    }
    if (status === "FAILED") return { jobId: externalJobId, status: "error", error: "FLUX.1 Kontext generation failed." };
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(externalJobId: string): Promise<void> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.fluxKontext;
    await fetch(`https://queue.fal.run/${modelId}/requests/${externalJobId}/cancel`, {
      method: "PUT", headers: { "Authorization": `Key ${apiKey}` },
    }).catch(() => {});
  },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data   = raw as Record<string, unknown>;
    const images = data?.images as Array<{ url: string }> | undefined;
    return {
      jobId: String(data?.request_id ?? ""), provider: "fal", modelKey: "flux-kontext",
      status: "success", url: images?.[0]?.url, seed: data?.seed as number | undefined,
    };
  },

  async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _.jobId, status: "pending" };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function aspectToFalSize(ratio: string): string {
  const map: Record<string, string> = {
    "1:1":  "square_hd",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:5":  "portrait_4_3",
  };
  return map[ratio] ?? "square_hd";
}
