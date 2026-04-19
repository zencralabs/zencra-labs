/**
 * Image Studio — FLUX.2 Provider (coming-soon, Phase 2)
 *
 * Official brand: Black Forest Labs
 * Official model name: FLUX.2 (exact variant TBD when BFL publishes)
 * fal.ai endpoint: fal-ai/flux-2/dev (placeholder — update FAL_MODEL_FLUX_2 env var when live)
 *
 * Status: coming-soon — NOT active in Phase 1.
 *   - Registered in the provider registry so the orchestrator can return
 *     MODEL_NOT_ACTIVE instead of PROVIDER_NOT_REGISTERED
 *   - validateInput() immediately returns an error if called
 *   - No live generation is routed to FLUX.2 until status is flipped to "active"
 *
 * Switching from FLUX.1 → FLUX.2:
 *   1. Update FAL_MODEL_FLUX_2 env var with the real BFL endpoint
 *   2. Change status in MODEL_REGISTRY from "coming-soon" → "active"
 *   3. No adapter code changes needed — the factory is fully wired
 *
 * Structure mirrors flux-kontext.ts exactly — same fal.ai queue pattern,
 * same input fields, same output normalization. Backend is ready to switch.
 *
 * Env: FAL_KEY, FAL_MODEL_FLUX_2 (optional override)
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getFalEnv, FAL_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// FLUX.2 PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const flux2Provider: ZProvider = {
  providerId:  "fal",
  modelKey:    "flux-2-image",
  studio:      "image",
  // Official BFL display name — update when BFL finalizes the variant name (e.g. "FLUX.2 Kontext")
  displayName: "FLUX.2",
  status:      "coming-soon",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "image"],
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
      capabilities:          ["text_to_image", "image_to_image", "edit", "consistency", "photoreal"],
      asyncMode:             "polling",
      supportsWebhook:       false,
      supportsPolling:       true,
    };
  },

  validateInput(_input: ZProviderInput): ValidationResult {
    // FLUX.2 is not active — always fail validation so the orchestrator rejects the call
    return {
      valid:    false,
      errors:   ["FLUX.2 is not yet available. It will be activated in Phase 2."],
      warnings: [],
    };
  },

  estimateCost(_input: ZProviderInput): CreditEstimate {
    // Placeholder credit range — update when BFL publishes pricing
    return { min: 4, max: 12, expected: 6, breakdown: { base: 6 } };
  },

  // ── CREATE JOB — mirrors FLUX.1 Kontext exactly (fal.ai queue pattern) ────
  // This code is ready to run; it will only be called once status is "active".
  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.flux2;
    const jobId     = newJobId();

    const payload: Record<string, unknown> = {
      prompt:                input.prompt,
      image_size:            aspectToFalSize(input.aspectRatio ?? "1:1"),
      num_images:            1,
      output_format:         "jpeg",
      enable_safety_checker: true,
    };

    if (input.imageUrl)       payload.image_url        = input.imageUrl;
    if (input.seed)           payload.seed             = input.seed;
    if (input.negativePrompt) payload.negative_prompt  = input.negativePrompt;

    const res = await fetch(`https://queue.fal.run/${modelId}`, {
      method:  "POST",
      headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`FLUX.2 submission failed (HTTP ${res.status}): ${err.slice(0, 100)}`);
    }

    const data      = (await res.json()) as Record<string, unknown>;
    const requestId = String(data.request_id ?? data.requestId ?? "");
    if (!requestId) throw new Error("FLUX.2 returned no request ID.");

    const now = new Date();
    return {
      id: jobId, provider: "fal", modelKey: "flux-2-image",
      studioType: "image", status: "pending", externalJobId: requestId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { modelId, requestId, hasSourceImage: !!input.imageUrl },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.flux2;

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
        metadata: { seed: result.seed },
      };
    }
    if (status === "FAILED") return { jobId: externalJobId, status: "error", error: "FLUX.2 generation failed." };
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(externalJobId: string): Promise<void> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.flux2;
    await fetch(`https://queue.fal.run/${modelId}/requests/${externalJobId}/cancel`, {
      method: "PUT", headers: { "Authorization": `Key ${apiKey}` },
    }).catch(() => {});
  },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data   = raw as Record<string, unknown>;
    const images = data?.images as Array<{ url: string }> | undefined;
    return {
      jobId: String(data?.request_id ?? ""), provider: "fal", modelKey: "flux-2-image",
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
