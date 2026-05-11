/**
 * Character Studio — Instant Character Provider (via fal.ai)
 *
 * Primary identity creation engine for AI Influencer candidate generation.
 * Uses fal.ai Instant Character for:
 *   - Consistent portrait generation from text descriptors
 *   - AI Influencer Builder candidate batch (4–6 images)
 *   - Photorealistic and stylised identity modes
 *
 * All calls are async (polling). No webhooks — fal.ai queue only.
 * Provider: fal.ai → fal-ai/instant-character
 * Env: FAL_KEY
 *
 * Design rules:
 *   - Never expose "fal.ai", "Instant Character", or model IDs to the UI.
 *   - All user-facing labels go through the Character Studio UI layer.
 *   - Credit cost: 8 credits per image (flat). No add-ons for AR/style.
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
// CREDIT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_CREDIT_COST = 8;

// ─────────────────────────────────────────────────────────────────────────────
// INSTANT CHARACTER PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const instantCharacterProvider: ZProvider = {
  providerId:  "fal",
  modelKey:    "instant-character",
  studio:      "character",
  // User-facing label is managed by the Character Studio UI layer.
  // This displayName is internal only (used in Activity Center / job cards).
  displayName: "Instant Character",
  status:      "active",

  // ── Capabilities ────────────────────────────────────────────────────────────
  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:    ["text", "image"],
      supportedAspectRatios:  ["1:1", "4:5", "2:3", "9:16"],
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
        "No character_id provided. Pass character_id on subsequent calls for consistency."
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  // ── Cost Estimate ───────────────────────────────────────────────────────────
  estimateCost(_input: ZProviderInput): CreditEstimate {
    return {
      min:       BASE_CREDIT_COST,
      max:       BASE_CREDIT_COST,
      expected:  BASE_CREDIT_COST,
      breakdown: { base: BASE_CREDIT_COST },
    };
  },

  // ── Create Job ──────────────────────────────────────────────────────────────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey } = getFalEnv();
    const modelId    = FAL_MODEL_IDS.instantCharacter;
    const jobId      = newJobId();

    // Build fal.ai Instant Character request payload.
    // The model accepts: prompt, image_size, guidance_scale, num_inference_steps,
    //   num_images, seed, negative_prompt, and optionally reference_image_url.
    const payload: Record<string, unknown> = {
      prompt:               input.prompt,
      image_size:           aspectToFalSize(input.aspectRatio ?? "2:3"),
      guidance_scale:       5.0,
      num_inference_steps:  28,
      num_images:           1,
      enable_safety_checker: true,
    };

    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt;
    }
    if (input.imageUrl) {
      // Reference image for identity consistency on refined calls
      payload.reference_image_url = input.imageUrl;
    }
    if (input.seed) {
      payload.seed = input.seed;
    }

    // Submit to fal.ai queue (async — returns request_id immediately)
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
      throw new Error(
        `Instant Character job submission failed (HTTP ${res.status}): ${sanitize(body)}`
      );
    }

    const data       = (await res.json()) as Record<string, unknown>;
    const requestId  = String(data.request_id ?? data.requestId ?? "");

    if (!requestId) {
      throw new Error("Instant Character provider returned no request ID.");
    }

    console.log(
      `[instant-character] job submitted: requestId=${requestId} model=${modelId}`
    );

    const now = new Date();
    return {
      id:            jobId,
      provider:      "fal",
      modelKey:      "instant-character",
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
    const modelId    = FAL_MODEL_IDS.instantCharacter;

    // Poll status endpoint
    const statusRes = await fetch(
      `https://queue.fal.run/${modelId}/requests/${externalJobId}/status`,
      {
        headers: { "Authorization": `Key ${apiKey}` },
        signal:  AbortSignal.timeout(15_000),
      },
    );

    if (!statusRes.ok) {
      return {
        jobId:  externalJobId,
        status: "error",
        error:  `Status check HTTP ${statusRes.status}`,
      };
    }

    const statusData = (await statusRes.json()) as Record<string, unknown>;
    const status     = String(statusData.status ?? "");

    // ── Diagnostic: log every poll (full body on COMPLETED so we see the shape) ──
    if (status === "COMPLETED") {
      console.log(
        `[instant-character] poll status=COMPLETED requestId=${externalJobId} — full statusData:`,
        process.env.NODE_ENV !== "production" ? JSON.stringify(statusData).slice(0, 2000) : "(production)"
      );
    } else {
      console.log(`[instant-character] poll status=${status} requestId=${externalJobId}`);
    }

    if (status === "COMPLETED") {
      // ── Step 1: Try to extract the image URL directly from statusData ───────────
      // fal.ai often embeds the full result inside the status response payload.
      // Instant Character specifically returns 422 on a second fetch of response_url,
      // which means the output is already here — no second request needed.
      //
      // Check all known embedding locations:
      //   statusData.images            — top-level (most common)
      //   statusData.output.images     — wrapped in output object
      //   statusData.data.images       — wrapped in data object
      //   statusData.result.images     — wrapped in result object
      const embedded = extractImages(statusData);
      if (embedded.url) {
        console.log(
          `[instant-character] job completed (embedded): requestId=${externalJobId} url=${embedded.url.slice(0, 80)}`
        );
        return {
          jobId:    externalJobId,
          status:   "success",
          url:      embedded.url,
          metadata: { seed: embedded.seed },
        };
      }

      // ── Step 2: Fall back to second fetch if result not embedded ────────────────
      // Try response_url first (fal.ai recommended), then bare constructed URL.
      const responseUrl =
        typeof statusData.response_url === "string" && statusData.response_url
          ? statusData.response_url
          : `https://queue.fal.run/${modelId}/requests/${externalJobId}`;

      const resultRes = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${apiKey}` },
        signal:  AbortSignal.timeout(15_000),
      });

      if (!resultRes.ok) {
        const body = await resultRes.text().catch(() => "");
        console.error(
          `[instant-character] result fetch failed: HTTP ${resultRes.status} url=${responseUrl} body=${body.slice(0, 300)}`
        );
        return {
          jobId:  externalJobId,
          status: "error",
          error:  `Failed to fetch completed result (HTTP ${resultRes.status})`,
        };
      }

      const result = (await resultRes.json()) as Record<string, unknown>;
      console.log(
        `[instant-character] result fetch keys=${Object.keys(result).join(",")}`,
        process.env.NODE_ENV !== "production"
          ? JSON.stringify(result).slice(0, 500)
          : ""
      );

      // Try all known shapes from the fetched result too
      const fetched = extractImages(result);
      if (!fetched.url) {
        console.error(
          `[instant-character] no URL in result — statusData keys=${Object.keys(statusData).join(",")} result keys=${Object.keys(result).join(",")}`
        );
        return {
          jobId:  externalJobId,
          status: "error",
          error:  "No image URL in completed result.",
        };
      }

      console.log(
        `[instant-character] job completed (fetched): requestId=${externalJobId} url=${fetched.url.slice(0, 80)}`
      );
      return {
        jobId:    externalJobId,
        status:   "success",
        url:      fetched.url,
        metadata: { seed: fetched.seed },
      };
    }

    if (status === "FAILED" || status === "ERROR") {
      // fal.ai may put the reason in .error, .detail, or .error_message
      const reason =
        (statusData.error         as string | undefined) ??
        (statusData.detail        as string | undefined) ??
        (statusData.error_message as string | undefined) ??
        "Instant Character generation failed.";
      console.error(
        `[instant-character] job failed: requestId=${externalJobId} reason=${reason}`
      );
      return {
        jobId:  externalJobId,
        status: "error",
        error:  sanitize(reason),
      };
    }

    // IN_QUEUE, IN_PROGRESS, or unknown — still pending
    return { jobId: externalJobId, status: "pending" };
  },

  // ── Cancel Job ──────────────────────────────────────────────────────────────
  async cancelJob(externalJobId: string): Promise<void> {
    const { apiKey } = getFalEnv();
    const modelId    = FAL_MODEL_IDS.instantCharacter;
    await fetch(
      `https://queue.fal.run/${modelId}/requests/${externalJobId}/cancel`,
      {
        method:  "PUT",
        headers: { "Authorization": `Key ${apiKey}` },
      },
    ).catch(() => { /* best-effort */ });
  },

  // ── Normalize Output ────────────────────────────────────────────────────────
  normalizeOutput(raw: unknown): ZProviderResult {
    const data   = raw as Record<string, unknown>;
    const images = data?.images as Array<{ url: string }> | undefined;
    return {
      jobId:    String(data?.request_id ?? ""),
      provider: "fal",
      modelKey: "instant-character",
      status:   "success",
      url:      images?.[0]?.url,
      seed:     data?.seed as number | undefined,
      metadata: { raw: data },
    };
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────
  // fal.ai queue does not push webhooks — polling only.
  async handleWebhook(_payload: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _payload.jobId, status: "pending" };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Zencra aspect ratio keys to fal.ai image_size strings.
 * fal.ai uses named presets; "portrait_4_3" (768×1024) is the closest to 2:3.
 */
function aspectToFalSize(ratio: string): string {
  const map: Record<string, string> = {
    "1:1":  "square_hd",
    "4:5":  "portrait_4_3",
    "2:3":  "portrait_4_3",    // closest available portrait preset
    "9:16": "portrait_16_9",
    "4:3":  "landscape_4_3",
    "16:9": "landscape_16_9",
  };
  return map[ratio] ?? "portrait_4_3";
}

/**
 * Extract the image URL and seed from any known fal.ai result shape.
 *
 * fal.ai embeds completed results differently per model:
 *   - Top-level:   { images: [{ url }], seed }
 *   - output wrap: { output: { images: [{ url }], seed } }
 *   - data wrap:   { data:   { images: [{ url }], seed } }
 *   - result wrap: { result: { images: [{ url }], seed } }
 *
 * Returns { url: undefined, seed: undefined } if nothing is found.
 */
function extractImages(data: Record<string, unknown>): { url: string | undefined; seed: number | undefined } {
  // Unwrap one level if needed
  const candidates: Record<string, unknown>[] = [
    data,
    data.output  as Record<string, unknown> ?? {},
    data.data    as Record<string, unknown> ?? {},
    data.result  as Record<string, unknown> ?? {},
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const images = candidate.images as Array<{ url: string }> | undefined;
    const url    = images?.[0]?.url;
    if (url) {
      return { url, seed: candidate.seed as number | undefined };
    }
    // Some models return a single `image` object (not array)
    const image = candidate.image as { url: string } | undefined;
    if (image?.url) {
      return { url: image.url, seed: candidate.seed as number | undefined };
    }
  }

  return { url: undefined, seed: undefined };
}

/**
 * Sanitize raw provider error strings — never surface credential hints.
 */
function sanitize(raw: string): string {
  if (raw.toLowerCase().includes("key") || raw.toLowerCase().includes("auth")) {
    return "Authentication error — check FAL_KEY configuration.";
  }
  return raw.slice(0, 200);
}
