/**
 * Image Studio — Seedream Provider (via fal.ai)
 *
 * ByteDance's Seedream image generation models.
 * All variants use fal.ai as the API gateway (queue endpoint).
 *
 * Models registered:
 *   seedream-v5      → fal-ai/seedream              (Seedream v5 — primary quality t2i)
 *   seedream-v5-lite → fal-ai/seedream/edit          (Seedream v5 Lite — fast t2i only in Phase 1C)
 *   seedream-4-5     → fal-ai/bytedance/seedream/v4.5/text-to-image | /edit (Seedream 4.5 — t2i + edit, 2K/4K quality chips)
 *
 * Phase 1C notes:
 *   - Seedream 4.5 supports both t2i (no image payload) and edit (image_urls[] payload).
 *     Quality maps to fal.ai image_size: "2K"→"auto_2K", "4K"→"auto_4K", "1K"→omitted.
 *   - Seedream v5 Lite is locked to generation-only in Phase 1C (no edit mode).
 *     The underlying fal-ai/seedream/edit endpoint supports image input but we deliberately
 *     do not expose it until a proper edit UX is designed.
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
// CONSTANTS
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
 * Seedream 4.5 quality → fal.ai image_size mapping.
 * "1K" is omitted (provider default resolution).
 * "2K" and "4K" are native fal.ai preset strings honored by the endpoint.
 */
const V45_QUALITY_TO_SIZE: Record<string, string | undefined> = {
  "1K": undefined,      // omit field — provider selects default
  "2K": "auto_2K",
  "4K": "auto_4K",
};

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether this variant supports image-to-image editing.
 * Only Seedream 4.5 (v4-5) exposes edit in Phase 1C.
 * v5-lite's underlying endpoint accepts images but we lock it to t2i here.
 */
function supportsEdit(variant: SeedreamVariant): boolean {
  return variant === "v4-5";
}

function buildSeedreamProvider(modelKey: string, displayName: string): ZProvider {
  const variant    = MODEL_KEY_TO_VARIANT[modelKey] ?? "v5";
  const falModelId = () => VARIANT_TO_MODEL_ID[variant];
  const canEdit    = supportsEdit(variant);

  return {
    providerId:  "fal",
    modelKey,
    studio:      "image",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   canEdit ? ["text", "image"] : ["text"],
        supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
        capabilities: canEdit
          ? ["text_to_image", "image_to_image", "edit", "photoreal"]
          : variant === "v5-lite"
            ? ["text_to_image", "fast_mode"]
            : ["text_to_image", "photoreal", "cinematic"],
        asyncMode:       "polling",
        supportsWebhook: false,
        supportsPolling: true,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      if (!input.prompt || input.prompt.trim().length < 3) {
        errors.push("Prompt must be at least 3 characters.");
      }
      // v4-5 edit mode: image is optional (absence = t2i). No validation failure needed.
      // v5 / v5-lite: never accept image input in Phase 1C.
      if (!canEdit && input.imageUrl) {
        errors.push(`${displayName} does not support image input in this version.`);
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(input: ZProviderInput): CreditEstimate {
      let base: number;
      if (variant === "v5")      base = 15;
      else if (variant === "v5-lite") base = 8;
      else {
        // v4-5: base 10 cr (1K). Quality multipliers applied by credit engine.
        // Edit jobs cost the same as t2i (no surcharge).
        base = 10;
      }
      return { min: base - 2, max: base + 4, expected: base, breakdown: { base } };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey } = getFalEnv();
      const jobId      = newJobId();
      const isEditJob  = canEdit && !!input.imageUrl;
      // v4-5: select the correct fal endpoint by operation type.
      // fal.ai requires the /text-to-image or /edit suffix — the bare base path 404s.
      const modelId = variant === "v4-5"
        ? (isEditJob ? FAL_MODEL_IDS.seedream45Edit : FAL_MODEL_IDS.seedream45)
        : falModelId();

      // Safe diagnostic: confirm actual fal.ai model ID in runtime logs.
      console.info(`[seedream] variant=${variant} model=${modelId} mode=${isEditJob ? "edit" : "t2i"}`);

      const payload: Record<string, unknown> = {
        prompt:                input.prompt,
        aspect_ratio:          FAL_ASPECT_MAP[input.aspectRatio ?? "1:1"] ?? "square",
        num_images:            1,
        enable_safety_checker: true,
      };

      // ── Seedream 4.5: edit path ────────────────────────────────────────────
      // Edit is detected by the presence of an input image.
      // The v4.5 endpoint uses `image_urls` (array), NOT `image_url` (singular).
      if (isEditJob && input.imageUrl) {
        payload.image_urls = [input.imageUrl];
      }

      // ── Seedream 4.5: quality → image_size ────────────────────────────────
      // "2K" → "auto_2K", "4K" → "auto_4K", "1K" → omit (provider default).
      if (variant === "v4-5") {
        const quality  = input.providerParams?.quality as string | undefined;
        const imageSize = quality ? V45_QUALITY_TO_SIZE[quality] : undefined;
        if (imageSize) payload.image_size = imageSize;
      }

      if (input.negativePrompt) payload.negative_prompt = input.negativePrompt;
      if (input.seed)           payload.seed = input.seed;

      const submitUrl = `https://queue.fal.run/${modelId}`;
      if (variant === "v4-5") {
        console.info(`[seedream-45] SUBMIT url=${submitUrl}`);
        console.info(`[seedream-45] SUBMIT payload=${JSON.stringify({ ...payload, image_urls: payload.image_urls ? "[redacted-count:" + (payload.image_urls as unknown[]).length + "]" : undefined })}`);
      }

      const res = await fetch(submitUrl, {
        method:  "POST",
        headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60_000), // increased from 30s — fal queue can be slow to ack
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "<unreadable>");
        if (variant === "v4-5") {
          console.error(`[seedream-45] SUBMIT FAILED status=${res.status} body=${body.slice(0, 500)}`);
        }
        throw new Error(`Seedream (${variant}) submission HTTP ${res.status}: ${body.slice(0, 300)}`);
      }

      const data      = (await res.json()) as Record<string, unknown>;
      if (variant === "v4-5") {
        console.info(`[seedream-45] SUBMIT OK response=${JSON.stringify(data)}`);
      }
      const requestId = String(data.request_id ?? data.requestId ?? "");
      if (!requestId) throw new Error("Seedream returned no request ID.");

      // ── v4-5: store fal.ai's own polling URLs in externalJobId ───────────────
      // fal.ai returns status_url and response_url in the submit response.
      // These are the authoritative polling URLs — use them directly rather than
      // constructing from modelId (which now includes the /text-to-image or /edit suffix
      // and may not map cleanly to the status/result URL pattern).
      // Encoded as "{requestId}|{statusUrl}|{responseUrl}" for retrieval in getJobStatus.
      let externalJobId = requestId;
      if (variant === "v4-5") {
        const falStatusUrl   = typeof data.status_url   === "string" ? data.status_url   : "";
        const falResponseUrl = typeof data.response_url === "string" ? data.response_url : "";
        console.info(`[seedream-45] SUBMIT URLs status=${falStatusUrl || "(not-in-response)"} response=${falResponseUrl || "(not-in-response)"}`);
        if (falStatusUrl && falResponseUrl) {
          externalJobId = `${requestId}|${falStatusUrl}|${falResponseUrl}`;
          console.info(`[seedream-45] SUBMIT encoded-job-id=${externalJobId.slice(0, 120)}`);
        }
      }

      const now = new Date();
      return {
        id: jobId, provider: "fal", modelKey,
        studioType: "image", status: "pending", externalJobId,
        createdAt: now, updatedAt: now, identity: input.identity,
        providerMeta: {
          modelId,
          requestId,
          variant,
          generationMode: isEditJob ? "image-edit" : "text-to-image",
        },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { apiKey } = getFalEnv();
      const modelId    = falModelId();

      // ── Parse encoded externalJobId (v4-5 encodes fal URLs at submit time) ──
      // Format: "{requestId}" (legacy/other variants)
      // or     "{requestId}|{statusUrl}|{responseUrl}" (v4-5 with stored fal URLs)
      const parts              = externalJobId.split("|");
      const rawRequestId       = parts[0];
      const storedStatusUrl    = parts[1] ?? "";
      const storedResponseUrl  = parts[2] ?? "";

      // Use fal.ai's own URLs when available; fall back to manual construction.
      const statusUrl = storedStatusUrl  || `https://queue.fal.run/${modelId}/requests/${rawRequestId}/status`;
      const resultUrl = storedResponseUrl || `https://queue.fal.run/${modelId}/requests/${rawRequestId}`;

      if (variant === "v4-5") {
        console.info(`[seedream-45] POLL url=${statusUrl}`);
        console.info(`[seedream-45] POLL METHOD GET stored=${!!storedStatusUrl}`);
      }

      const statusRes = await fetch(
        statusUrl,
        { headers: { "Authorization": `Key ${apiKey}` }, signal: AbortSignal.timeout(15_000) },
      );
      if (!statusRes.ok) {
        const errBody    = await statusRes.text().catch(() => "<unreadable>");
        const allowHdr   = statusRes.headers.get("allow") ?? statusRes.headers.get("Allow") ?? "not-set";
        if (variant === "v4-5") {
          console.error(`[seedream-45] POLL FAILED status=${statusRes.status} allow=${allowHdr} body=${errBody.slice(0, 400)}`);
        }
        return { jobId: externalJobId, status: "error", error: `HTTP ${statusRes.status}: ${errBody.slice(0, 200)}` };
      }

      const data   = (await statusRes.json()) as Record<string, unknown>;
      const status = String(data.status ?? "");

      if (variant === "v4-5") {
        console.info(`[seedream-45] POLL RESPONSE status=${status} raw=${JSON.stringify(data).slice(0, 200)}`);
      }

      if (status === "COMPLETED") {
        if (variant === "v4-5") {
          console.info(`[seedream-45] RESULT URL ${resultUrl}`);
        }
        const resultRes = await fetch(
          resultUrl,
          { headers: { "Authorization": `Key ${apiKey}` } },
        );
        if (!resultRes.ok) {
          const resErrBody = await resultRes.text().catch(() => "<unreadable>");
          if (variant === "v4-5") {
            console.error(`[seedream-45] RESULT FAILED status=${resultRes.status} body=${resErrBody.slice(0, 300)}`);
          }
          return { jobId: externalJobId, status: "error", error: "Failed to fetch result." };
        }
        const result = (await resultRes.json()) as Record<string, unknown>;
        if (variant === "v4-5") {
          console.info(`[seedream-45] RESULT OK keys=${Object.keys(result).join(",")}`);
        }
        const images = result.images as Array<{ url: string }> | undefined;
        return {
          jobId: externalJobId, status: "success",
          url: images?.[0]?.url,
          metadata: { seed: result.seed },
        };
      }

      if (status === "FAILED") {
        const failReason = String((data as Record<string, unknown>).error ?? (data as Record<string, unknown>).detail ?? "Seedream generation failed.");
        if (variant === "v4-5") {
          console.error(`[seedream-45] JOB FAILED reason=${failReason}`);
        }
        return { jobId: externalJobId, status: "error", error: `Seedream generation failed: ${failReason}` };
      }

      return { jobId: externalJobId, status: "pending" };
    },

    async cancelJob(externalJobId: string): Promise<void> {
      const { apiKey } = getFalEnv();
      const modelId    = falModelId();
      // Parse encoded externalJobId — cancel always uses the raw request ID.
      const rawRequestId = externalJobId.split("|")[0];
      await fetch(`https://queue.fal.run/${modelId}/requests/${rawRequestId}/cancel`, {
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

/**
 * Seedream v5 Lite — fast text-to-image (fal-ai/seedream/edit).
 * Phase 1C: generation only. Image input is intentionally blocked at the provider level.
 * The underlying endpoint supports edit but we do not expose it until a proper UX is designed.
 */
export const seedreamV5LiteProvider = buildSeedreamProvider("seedream-v5-lite", "Seedream Lite");

/**
 * Seedream 4.5 — text-to-image + image editing.
 * t2i → fal-ai/bytedance/seedream/v4.5/text-to-image
 * edit → fal-ai/bytedance/seedream/v4.5/edit
 * Native quality tiers: 1K (base), 2K (auto_2K), 4K (auto_4K).
 * Edit mode activated automatically when an input image is provided.
 */
export const seedream45Provider     = buildSeedreamProvider("seedream-4-5",     "Seedream 4.5");
