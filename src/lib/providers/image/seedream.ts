/**
 * Image Studio — Seedream Provider (via fal.ai)
 *
 * ByteDance's Seedream image generation models.
 * All variants use fal.ai as the API gateway.
 *
 * Models registered:
 *   seedream-v5      → fal-ai/seedream        (Seedream v5 — primary quality t2i)
 *   seedream-v5-lite → fal-ai/seedream/edit   (Seedream v5 — fast + image editing)
 *   seedream-4-5     → fal-ai/seedream/v4.5   (Seedream 4.5 — legacy, DB inactive)
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

type SeedreamVariant = "v5" | "v5-lite" | "v4-5";

const VARIANT_TO_MODEL_ID: Record<SeedreamVariant, string> = {
  "v5":      FAL_MODEL_IDS.seedreamV5,
  "v5-lite": FAL_MODEL_IDS.seedreamV5Lite,
  "v4-5":    FAL_MODEL_IDS.seedream45,
};

const MODEL_KEY_TO_VARIANT: Record<string, SeedreamVariant> = {
  "seedream-v5":      "v5",
  "seedream-v5-lite": "v5-lite",
  "seedream-4-5":     "v4-5",
};

const FAL_ASPECT_MAP: Record<string, string> = {
  "1:1":  "square",
  "16:9": "landscape_16_9",
  "9:16": "portrait_9_16",
  "4:5":  "portrait_4_5",
};

/**
 * Whether this variant supports image-to-image editing (fal.ai /edit endpoint).
 * v5-lite routes to fal-ai/seedream/edit which accepts an `image_url` payload field.
 */
function isEditVariant(variant: SeedreamVariant): boolean {
  return variant === "v5-lite";
}

function buildSeedreamProvider(modelKey: string, displayName: string): ZProvider {
  const variant    = MODEL_KEY_TO_VARIANT[modelKey] ?? "v5";
  const falModelId = () => VARIANT_TO_MODEL_ID[variant];
  const isEdit     = isEditVariant(variant);

  return {
    providerId:  "fal",
    modelKey,
    studio:      "image",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   isEdit ? ["text", "image"] : ["text"],
        supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
        capabilities:          isEdit
          ? ["text_to_image", "image_to_image", "edit", "fast_mode"]
          : ["text_to_image", "photoreal", "cinematic"],
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
      // Edit variant requires an input image
      if (isEdit && !input.imageUrl) {
        errors.push("Seedream Lite requires an input image for editing.");
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(_input: ZProviderInput): CreditEstimate {
      const base = variant === "v5" ? 15 : variant === "v5-lite" ? 8 : 10;
      return { min: base - 2, max: base + 2, expected: base, breakdown: { base } };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey } = getFalEnv();
      const jobId      = newJobId();
      const modelId    = falModelId();

      const payload: Record<string, unknown> = {
        prompt:                input.prompt,
        aspect_ratio:          FAL_ASPECT_MAP[input.aspectRatio ?? "1:1"] ?? "square",
        num_images:            1,
        enable_safety_checker: true,
      };

      // Edit variant: attach the source image
      if (isEdit && input.imageUrl) {
        payload.image_url = input.imageUrl;
      }

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
      const modelId    = falModelId();

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
      const modelId    = falModelId();
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

/** Seedream v5 — primary high-quality text-to-image (fal-ai/seedream) */
export const seedreamV5Provider     = buildSeedreamProvider("seedream-v5",      "Seedream v5");

/** Seedream v5 Lite — fast + image editing (fal-ai/seedream/edit) */
export const seedreamV5LiteProvider = buildSeedreamProvider("seedream-v5-lite", "Seedream Lite");

/**
 * Seedream 4.5 — legacy model (fal-ai/seedream/v4.5)
 * DB row is inactive — provider registered so orchestrator returns MODEL_INACTIVE,
 * not PROVIDER_NOT_REGISTERED.
 */
export const seedream45Provider     = buildSeedreamProvider("seedream-4-5",     "Seedream 4.5");
