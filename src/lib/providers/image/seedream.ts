/**
 * Image Studio — Seedream Provider (via fal.ai)
 *
 * ByteDance's Seedream image generation models.
 * Both variants use fal.ai as the API gateway.
 *
 * Models registered:
 *   seedream-v5   → fal-ai/seedream-3 (Seedream v5)
 *   seedream-4-5  → fal-ai/seedream-v4-5 (Seedream 4.5)
 *
 * Async: fal.ai queue (polling)
 * Env: FAL_KEY
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getFalEnv, FAL_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FACTORY
// ─────────────────────────────────────────────────────────────────────────────

type SeedreamVariant = "v5" | "v4-5";

const VARIANT_TO_MODEL_ID: Record<SeedreamVariant, string> = {
  "v5":  FAL_MODEL_IDS.seedreamV5,
  "v4-5": FAL_MODEL_IDS.seedream45,
};

const MODEL_KEY_TO_VARIANT: Record<string, SeedreamVariant> = {
  "seedream-v5":   "v5",
  "seedream-4-5":  "v4-5",
};

const FAL_ASPECT_MAP: Record<string, string> = {
  "1:1":  "square",
  "16:9": "landscape_16_9",
  "9:16": "portrait_9_16",
  "4:5":  "portrait_4_5",
};

function buildSeedreamProvider(modelKey: string, displayName: string): ZProvider {
  const variant = MODEL_KEY_TO_VARIANT[modelKey] ?? "v5";
  const falModelId = () => VARIANT_TO_MODEL_ID[variant];

  return {
    providerId:  "fal",
    modelKey,
    studio:      "image",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   ["text"],
        supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
        capabilities:          ["text_to_image", "photoreal", "cinematic"],
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
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(_input: ZProviderInput): CreditEstimate {
      const base = variant === "v5" ? 5 : 3;
      return { min: 2, max: 6, expected: base, breakdown: { base } };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey } = getFalEnv();
      const jobId     = newJobId();
      const modelId   = falModelId();

      const payload: Record<string, unknown> = {
        prompt:           input.prompt,
        aspect_ratio:     FAL_ASPECT_MAP[input.aspectRatio ?? "1:1"] ?? "square",
        num_images:       1,
        enable_safety_checker: true,
      };
      if (input.negativePrompt) payload.negative_prompt = input.negativePrompt;
      if (input.seed)           payload.seed = input.seed;

      const res = await fetch(`https://queue.fal.run/${modelId}`, {
        method:  "POST",
        headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(30_000),
      });

      if (!res.ok) throw new Error(`Seedream (${variant}) submission HTTP ${res.status}.`);
      const data      = (await res.json()) as Record<string, unknown>;
      const requestId = String(data.request_id ?? data.requestId ?? "");
      if (!requestId) throw new Error("Seedream returned no request ID.");

      const now = new Date();
      return {
        id: jobId, provider: "fal", modelKey,
        studioType: "image", status: "pending", externalJobId: requestId,
        createdAt: now, updatedAt: now, identity: input.identity,
        providerMeta: { modelId, requestId, variant },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { apiKey } = getFalEnv();
      const modelId   = falModelId();

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
        return { jobId: externalJobId, status: "success", url: images?.[0]?.url, metadata: { seed: result.seed } };
      }
      if (status === "FAILED") return { jobId: externalJobId, status: "error", error: "Seedream generation failed." };
      return { jobId: externalJobId, status: "pending" };
    },

    async cancelJob(externalJobId: string): Promise<void> {
      const { apiKey } = getFalEnv();
      const modelId   = falModelId();
      await fetch(`https://queue.fal.run/${modelId}/requests/${externalJobId}/cancel`, {
        method: "PUT", headers: { "Authorization": `Key ${apiKey}` },
      }).catch(() => {});
    },

    normalizeOutput(raw: unknown): ZProviderResult {
      const data   = raw as Record<string, unknown>;
      const images = data?.images as Array<{ url: string }> | undefined;
      return {
        jobId: String(data?.request_id ?? ""), provider: "fal", modelKey,
        status: "success", url: images?.[0]?.url, seed: data?.seed as number | undefined,
      };
    },

    async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
      return { jobId: _.jobId, status: "pending" };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

export const seedreamV5Provider  = buildSeedreamProvider("seedream-v5",  "Seedream v5");
export const seedream45Provider  = buildSeedreamProvider("seedream-4-5", "Seedream 4.5");
