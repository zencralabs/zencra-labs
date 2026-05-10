/**
 * Image Studio — BFL Kontext Provider (direct Black Forest Labs API)
 *
 * Black Forest Labs FLUX.1 Kontext [pro] — accessed via BFL API directly.
 * Official model: flux-kontext-pro (https://api.bfl.ai/v1/flux-kontext-pro)
 * This is intentionally separate from the fal-hosted "flux-kontext" provider.
 *
 * Architecture decision (2026-05-10):
 *   - Instant Character (fal.ai)    → influencer candidate generation
 *   - bfl-kontext (direct BFL API)  → Look Pack identity-preserving variation
 *   - flux-kontext (fal.ai)         → Image Studio general context editing
 *
 * Auth: x-key header (NOT Authorization: Key)
 * Async: polling via GET https://api.bfl.ai/v1/get_result?id=<jobId>
 * Input image: accepts URL strings directly — no base64 encoding required
 * Result URL: expires after ~10 minutes — mirror promptly via persistAsset
 *
 * Provider: BFL direct API
 * Env: BFL_API_KEY
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getBflEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// BFL KONTEXT PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const bflKontextProvider: ZProvider = {
  providerId:  "flux-bfl",
  modelKey:    "bfl-kontext",
  studio:      "image",
  displayName: "FLUX.1 Kontext (BFL)",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "image"],
      supportedAspectRatios: ["1:1", "16:9", "9:16", "2:3", "4:5", "3:2", "5:4"],
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
      ? ["BFL Kontext works best with a source image for identity-preserving editing. Proceeding as text-to-image."]
      : [];
    return { valid: errors.length === 0, errors, warnings };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const isEdit = !!input.imageUrl;
    const base   = isEdit ? 5 : 3;
    return {
      min:       3,
      max:       7,
      expected:  base,
      breakdown: { base },
    };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, endpoint } = getBflEnv();
    const jobId = newJobId();

    const payload: Record<string, unknown> = {
      prompt:       input.prompt,
      aspect_ratio: aspectToBfl(input.aspectRatio ?? "1:1"),
      output_format: "jpeg",
      safety_tolerance: 2,
    };

    // BFL accepts URL strings directly as input_image — no base64 needed
    if (input.imageUrl) {
      payload.input_image = input.imageUrl;
    }
    if (input.seed) payload.seed = input.seed;

    const res = await fetch(`https://api.bfl.ai/v1/${endpoint}`, {
      method:  "POST",
      headers: {
        "x-key":        apiKey,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `BFL Kontext submission failed (HTTP ${res.status}): ${errText.slice(0, 200)}`
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    // BFL returns { id, polling_url }
    const requestId = String(data.id ?? data.request_id ?? "");
    if (!requestId) {
      throw new Error("BFL Kontext returned no job ID. Response: " + JSON.stringify(data).slice(0, 200));
    }

    const now = new Date();
    return {
      id:             jobId,
      provider:       "flux-bfl",
      modelKey:       "bfl-kontext",
      studioType:     "image",
      status:         "pending",
      externalJobId:  requestId,
      createdAt:      now,
      updatedAt:      now,
      identity:       input.identity,
      providerMeta:   { endpoint, requestId, hasSourceImage: !!input.imageUrl },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey } = getBflEnv();

    let res: Response;
    try {
      res = await fetch(`https://api.bfl.ai/v1/get_result?id=${encodeURIComponent(externalJobId)}`, {
        headers: { "x-key": apiKey, "Accept": "application/json" },
        signal:  AbortSignal.timeout(15_000),
      });
    } catch (err) {
      return { jobId: externalJobId, status: "error", error: `BFL poll request failed: ${String(err)}` };
    }

    if (!res.ok) {
      return { jobId: externalJobId, status: "error", error: `BFL poll HTTP ${res.status}` };
    }

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      return { jobId: externalJobId, status: "error", error: "BFL poll returned non-JSON response" };
    }

    const status = String(data.status ?? "");

    if (status === "Ready") {
      // BFL result shape: { status: "Ready", result: { sample: "<url>" } }
      const result = data.result as Record<string, unknown> | undefined;
      const url    = typeof result?.sample === "string" ? result.sample : undefined;

      if (!url) {
        return {
          jobId:  externalJobId,
          status: "error",
          error:  "BFL Kontext returned Ready status but no result URL. Response: " +
                  JSON.stringify(data).slice(0, 200),
        };
      }

      return {
        jobId:    externalJobId,
        status:   "success",
        url,
        metadata: { bfl_status: status },
      };
    }

    if (status === "Error" || status === "Failed" || status === "Content Moderated") {
      const errDetail = typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : status;
      return {
        jobId:  externalJobId,
        status: "error",
        error:  `BFL Kontext generation failed: ${errDetail}`,
      };
    }

    // "Pending", "Processing", "Queued", or any other in-progress status
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(_externalJobId: string): Promise<void> {
    // BFL API does not expose a cancel endpoint — no-op
  },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data   = raw as Record<string, unknown>;
    const result = data?.result as Record<string, unknown> | undefined;
    const url    = typeof result?.sample === "string" ? result.sample : undefined;
    return {
      jobId:    String(data?.id ?? ""),
      provider: "flux-bfl",
      modelKey: "bfl-kontext",
      status:   "success",
      url,
    };
  },

  async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
    // BFL does not support webhooks — polling only
    return { jobId: _.jobId, status: "pending" };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Zencra aspect ratio strings to BFL API aspect_ratio format.
 * BFL accepts human-readable strings like "1:1", "16:9", "9:16", etc.
 * Our internal strings already match — pass through with safe fallback.
 */
function aspectToBfl(ratio: string): string {
  const supported = new Set(["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9", "9:21", "4:5", "5:4"]);
  return supported.has(ratio) ? ratio : "1:1";
}
