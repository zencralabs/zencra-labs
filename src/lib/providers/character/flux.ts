/**
 * Character Studio — FLUX Provider (via fal.ai)
 *
 * Primary identity creation engine for Zencra Character Studio.
 * Uses Black Forest Labs FLUX Pro via fal.ai for:
 *   - AI Influencer Builder (new character identity)
 *   - Character Trainer (identity + embedding prep)
 *   - Lookbook (styled variations)
 *   - Hero image generation
 *
 * Every call MUST include identity context (character_id or is_new_character: true).
 * Provider: fal.ai → fal-ai/flux-pro
 * Env: FAL_KEY
 */

import type {
  ZProvider,
  ZProviderInput,
  ZJob,
  ZJobStatus,
  ZProviderResult,
  CreditEstimate,
  ValidationResult,
  ProviderCapabilities,
  WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getFalEnv, FAL_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// FLUX CHARACTER PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const fluxCharacterProvider: ZProvider = {
  providerId:  "fal",
  modelKey:    "flux-character",
  studio:      "character",
  // Official BFL name: FLUX.1 Pro. The Zencra internal key "flux-character" scopes it
  // to the Character Studio context, but the upstream model is FLUX.1 Pro (fal-ai/flux-pro).
  displayName: "FLUX.1 Pro",
  status:      "active",

  // ── Capabilities ────────────────────────────────────────────────────────────
  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:    ["text", "image"],
      supportedAspectRatios:  ["1:1", "4:5", "16:9"],
      capabilities:           ["identity_creation", "look_variation", "photoreal", "consistency"],
      asyncMode:              "polling",
      supportsWebhook:        false,
      supportsPolling:        true,
    };
  },

  // ── Validation ──────────────────────────────────────────────────────────────
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.prompt || input.prompt.trim().length < 5) {
      errors.push("Prompt must be at least 5 characters.");
    }
    if (!input.identity?.character_id) {
      warnings.push(
        "No character_id provided. A new character identity will be created. " +
        "Pass character_id on subsequent calls to maintain consistency."
      );
    }
    if (input.identity?.reference_urls?.length === 0) {
      warnings.push("No reference URLs provided. Consistency scoring will not be available.");
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  // ── Cost Estimate ───────────────────────────────────────────────────────────
  estimateCost(input: ZProviderInput): CreditEstimate {
    // Base: 5 credits. With reference image: +2. With 4:5 or 16:9: +1.
    let base = 5;
    const breakdown: Record<string, number> = { base };

    if (input.imageUrl) {
      breakdown.reference_image = 2;
      base += 2;
    }
    if (input.aspectRatio && input.aspectRatio !== "1:1") {
      breakdown.non_square = 1;
      base += 1;
    }

    return { min: 5, max: 10, expected: base, breakdown };
  },

  // ── Create Job ──────────────────────────────────────────────────────────────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey } = getFalEnv();
    const modelId = FAL_MODEL_IDS.fluxCharacter;
    const jobId   = newJobId();

    // Build fal.ai request payload
    const payload: Record<string, unknown> = {
      prompt:           input.prompt,
      image_size:       aspectToFalSize(input.aspectRatio ?? "1:1"),
      num_inference_steps: 28,
      guidance_scale:   3.5,
      num_images:       1,
      enable_safety_checker: true,
    };

    if (input.imageUrl) {
      payload.image_url = input.imageUrl;  // reference image for consistency
    }
    if (input.seed) {
      payload.seed = input.seed;
    }

    // Submit to fal.ai queue (async)
    const res = await fetch(`https://queue.fal.run/${modelId}`, {
      method:  "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`FLUX character job submission failed (HTTP ${res.status}): ${sanitize(body)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const requestId = String(data.request_id ?? data.requestId ?? "");

    if (!requestId) {
      throw new Error("FLUX character provider returned no request ID.");
    }

    const now = new Date();
    return {
      id:            jobId,
      provider:      "fal",
      modelKey:      "flux-character",
      studioType:    "character",
      status:        "pending",
      externalJobId: requestId,
      createdAt:     now,
      updatedAt:     now,
      identity:      input.identity,
      providerMeta:  { modelId, requestId },
      estimatedCredits: input.estimatedCredits,
    };
  },

  // ── Get Job Status ──────────────────────────────────────────────────────────
  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.fluxCharacter;

    const res = await fetch(
      `https://queue.fal.run/${modelId}/requests/${externalJobId}/status`,
      {
        headers: { "Authorization": `Key ${apiKey}` },
        signal:  AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      return { jobId: externalJobId, status: "error", error: `Status check HTTP ${res.status}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const status = String(data.status ?? "");

    if (status === "COMPLETED") {
      // Fetch the result
      const resultRes = await fetch(
        `https://queue.fal.run/${modelId}/requests/${externalJobId}`,
        { headers: { "Authorization": `Key ${apiKey}` } }
      );
      if (!resultRes.ok) {
        return { jobId: externalJobId, status: "error", error: "Failed to fetch result." };
      }
      const result = (await resultRes.json()) as Record<string, unknown>;
      const images = result.images as Array<{ url: string }> | undefined;
      const url    = images?.[0]?.url;
      return {
        jobId:  externalJobId,
        status: "success",
        url,
        metadata: { seed: result.seed as number | undefined },
      };
    }

    if (status === "FAILED") {
      return { jobId: externalJobId, status: "error", error: "FLUX generation failed." };
    }

    return { jobId: externalJobId, status: "pending" };
  },

  // ── Cancel Job ──────────────────────────────────────────────────────────────
  async cancelJob(externalJobId: string): Promise<void> {
    const { apiKey } = getFalEnv();
    const modelId   = FAL_MODEL_IDS.fluxCharacter;
    await fetch(
      `https://queue.fal.run/${modelId}/requests/${externalJobId}/cancel`,
      { method: "PUT", headers: { "Authorization": `Key ${apiKey}` } }
    ).catch(() => {/* best-effort */});
  },

  // ── Normalize Output ────────────────────────────────────────────────────────
  normalizeOutput(raw: unknown): ZProviderResult {
    const data   = raw as Record<string, unknown>;
    const images = data?.images as Array<{ url: string }> | undefined;
    return {
      jobId:    String(data?.request_id ?? ""),
      provider: "fal",
      modelKey: "flux-character",
      status:   "success",
      url:      images?.[0]?.url,
      seed:     data?.seed as number | undefined,
      metadata: { raw: data },
    };
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────
  async handleWebhook(_payload: WebhookPayload): Promise<ZJobStatus> {
    // fal.ai does not use webhooks for queue results; polling only
    return { jobId: _payload.jobId, status: "pending" };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function aspectToFalSize(ratio: string): string {
  const map: Record<string, string> = {
    "1:1":  "square_hd",
    "4:5":  "portrait_4_3",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
  };
  return map[ratio] ?? "square_hd";
}

function sanitize(raw: string): string {
  // Never expose raw API errors with credential hints
  if (raw.toLowerCase().includes("key") || raw.toLowerCase().includes("auth")) {
    return "Authentication error — check FAL_KEY configuration.";
  }
  return raw.slice(0, 120);
}
