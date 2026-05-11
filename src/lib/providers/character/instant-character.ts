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
    const falEnv     = getFalEnv();
    const { apiKey } = falEnv;
    const modelId    = FAL_MODEL_IDS.instantCharacter;
    const jobId      = newJobId();

    // ── Resolve image_url ──────────────────────────────────────────────────────
    // fal-ai/instant-character REQUIRES image_url on every request.
    // There is no text-only (prompt-only) mode for this model.
    //
    // Resolution order:
    //   1. input.imageUrl — canonical locked portrait (identity pass, Look Pack)
    //   2. falEnv.instantCharacterSeedUrl — neutral default for initial casting
    //
    // INSTANT_CHARACTER_SEED_IMAGE_URL must be set in .env.local / Vercel env.
    // Point it to a publicly accessible neutral portrait in Supabase public storage
    // (or any public CDN reachable from fal.ai servers — no auth headers allowed).
    const resolvedImageUrl = input.imageUrl ?? falEnv.instantCharacterSeedUrl;
    if (!resolvedImageUrl) {
      throw new Error(
        "[instant-character] image_url is required but neither input.imageUrl nor " +
        "INSTANT_CHARACTER_SEED_IMAGE_URL is set. " +
        "Add INSTANT_CHARACTER_SEED_IMAGE_URL to .env.local pointing to a public neutral portrait."
      );
    }

    console.log(
      `[instant-character] image_url resolved: ${input.imageUrl ? "input (identity)" : "seed (initial casting)"} → ${resolvedImageUrl.slice(0, 80)}`
    );

    // Build fal.ai Instant Character request payload.
    // Required: prompt, image_url, image_size.
    // Optional: guidance_scale, num_inference_steps, num_images, seed, negative_prompt.
    const payload: Record<string, unknown> = {
      prompt:                input.prompt,
      image_url:             resolvedImageUrl,   // REQUIRED by fal-ai/instant-character
      image_size:            aspectToFalSize(input.aspectRatio ?? "2:3"),
      guidance_scale:        5.0,
      num_inference_steps:   28,
      num_images:            1,
      enable_safety_checker: true,
    };

    if (input.negativePrompt) {
      payload.negative_prompt = input.negativePrompt;
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
      // originalPayload is persisted in studio_meta._pMeta via buildAssetMetadata.
      // At poll time, getJobStatus() reads it back and POSTs to response_url to
      // retrieve the result — fal-ai/instant-character does not embed URLs in status.
      providerMeta:  { modelId, requestId, originalPayload: payload },
      estimatedCredits: input.estimatedCredits,
    };
  },

  // ── Get Job Status ──────────────────────────────────────────────────────────
  async getJobStatus(externalJobId: string, providerMeta?: Record<string, unknown>): Promise<ZJobStatus> {
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
      // ── Extract image URL from statusData — NO secondary fetch ──────────────────
      //
      // fal-ai/instant-character embeds the completed output directly inside
      // the status response payload. Attempting a second fetch to response_url
      // returns HTTP 422 ("Field required: image_url") because that endpoint
      // re-invokes the model rather than retrieving stored output.
      //
      // This provider MUST read the result from statusData only.
      // Never add a fallback fetch here for Instant Character.
      //
      // extractImages() checks all known fal.ai embedding shapes:
      //   { images: [{ url }] }                     — top-level array (most common)
      //   { output: { images: [{ url }] } }          — wrapped in output
      //   { data:   { images: [{ url }] } }          — wrapped in data
      //   { result: { images: [{ url }] } }          — wrapped in result
      //   { image:  { url } }                        — single image object
      //   { output_url: "https://..." }              — direct URL string
      //   { url:        "https://..." }              — bare URL string
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

      // ── Embedded extraction returned nothing — POST to response_url ────────────
      //
      // fal-ai/instant-character does NOT embed the image URL in the status payload.
      // The completed output is only accessible by POSTing the original generation
      // payload to the response_url included in the status response.
      //
      // This is different from other fal.ai models that support GET to response_url.
      // For instant-character, a GET returns HTTP 422 ("Field required: image_url")
      // because it re-invokes the model rather than retrieving stored output.
      //
      // The originalPayload was persisted in studio_meta._pMeta at job creation time
      // and is passed here via providerMeta from the polling chain.
      const responseUrl      = statusData.response_url as string | undefined;
      const originalPayload  = providerMeta?.originalPayload as Record<string, unknown> | undefined;

      console.log(
        `[instant-character] embedded extraction failed — trying response_url POST. ` +
        `responseUrl=${responseUrl ? "present" : "missing"} ` +
        `originalPayload=${originalPayload ? "present" : "missing"} ` +
        `statusData keys=${Object.keys(statusData).join(",")}`
      );

      if (responseUrl && originalPayload) {
        try {
          const resultRes = await fetch(responseUrl, {
            method:  "POST",
            headers: {
              "Authorization": `Key ${apiKey}`,
              "Content-Type":  "application/json",
            },
            body:   JSON.stringify(originalPayload),
            signal: AbortSignal.timeout(30_000),
          });

          if (!resultRes.ok) {
            const body = await resultRes.text();
            console.error(
              `[instant-character] response_url POST failed: HTTP ${resultRes.status} — ${body.slice(0, 300)}`
            );
          } else {
            const resultData = (await resultRes.json()) as Record<string, unknown>;
            console.log(
              `[instant-character] response_url POST success — ` +
              `top-level keys=${Object.keys(resultData).join(",")} ` +
              (process.env.NODE_ENV !== "production" ? JSON.stringify(resultData).slice(0, 500) : "(production)")
            );
            const fromResult = extractImages(resultData);
            if (fromResult.url) {
              console.log(
                `[instant-character] job completed (response_url): requestId=${externalJobId} url=${fromResult.url.slice(0, 80)}`
              );
              return {
                jobId:    externalJobId,
                status:   "success",
                url:      fromResult.url,
                metadata: { seed: fromResult.seed },
              };
            }
            console.error(
              `[instant-character] response_url POST returned no image URL. resultData keys=${Object.keys(resultData).join(",")}`
            );
          }
        } catch (postErr) {
          console.error(`[instant-character] response_url POST threw:`, postErr);
        }
      }

      // All extraction paths exhausted.
      console.error(
        `[instant-character] COMPLETED but no image URL found via embedded or response_url POST. ` +
        `requestId=${externalJobId} statusData keys=${Object.keys(statusData).join(",")}`
      );
      return {
        jobId:  externalJobId,
        status: "error",
        error:  "Generation completed but image URL was not found in the response payload. Check server logs.",
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
 * fal-ai/instant-character embeds the completed output directly in the
 * status response (no secondary fetch needed or supported).
 *
 * Known shapes checked, in order:
 *   { images: [{ url }], seed }                   — top-level array (most common)
 *   { output: { images: [{ url }], seed } }        — wrapped in output object
 *   { data:   { images: [{ url }], seed } }        — wrapped in data object
 *   { result: { images: [{ url }], seed } }        — wrapped in result object
 *   { image:  { url } }                            — single image object
 *   { output_url: "https://..." }                  — direct URL string (some models)
 *   { url:        "https://..." }                  — bare URL string (some models)
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

    // Shape 1: { images: [{ url }] }
    const images = candidate.images as Array<{ url: string }> | undefined;
    const arrayUrl = images?.[0]?.url;
    if (arrayUrl && typeof arrayUrl === "string") {
      return { url: arrayUrl, seed: candidate.seed as number | undefined };
    }

    // Shape 2: { image: { url } }
    const image = candidate.image as { url: string } | undefined;
    if (image?.url && typeof image.url === "string") {
      return { url: image.url, seed: candidate.seed as number | undefined };
    }

    // Shape 3: { output_url: "https://..." } or { url: "https://..." }
    // Some fal.ai models return a bare string URL at the top level.
    for (const key of ["output_url", "url", "image_url", "file_url"] as const) {
      const directUrl = candidate[key];
      if (typeof directUrl === "string" && directUrl.startsWith("http")) {
        return { url: directUrl, seed: candidate.seed as number | undefined };
      }
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
