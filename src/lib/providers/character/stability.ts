/**
 * Character Studio — Stability AI Provider
 *
 * Refinement engine for Zencra Character Studio.
 * Uses Stability AI API for:
 *   - Image-to-image refinement
 *   - Inpainting (masked region editing)
 *   - Outpainting (canvas extension)
 *   - Upscaling
 *   - Controlled variations
 *   - Scene Builder (place character in new scene)
 *
 * All calls require a source image + identity context (character_id).
 * Provider: api.stability.ai
 * Env: STABILITY_API_KEY
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
import { getStabilityEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type StabilityOperation =
  | "image-to-image"      // prompt + source image → new image
  | "inpaint"             // fill masked region
  | "outpaint"            // extend canvas
  | "upscale"             // resolution enhancement
  | "variation"           // style variation of source
  | "scene-builder";      // place character in new scene

const STABILITY_ENDPOINTS: Record<StabilityOperation, string> = {
  "image-to-image": "/v2beta/stable-image/generate/sd3",
  "inpaint":        "/v2beta/stable-image/edit/inpaint",
  "outpaint":       "/v2beta/stable-image/edit/outpaint",
  "upscale":        "/v2beta/stable-image/upscale/conservative",
  "variation":      "/v2beta/stable-image/generate/sd3",
  "scene-builder":  "/v2beta/stable-image/generate/sd3",
};

// ─────────────────────────────────────────────────────────────────────────────
// STABILITY CHARACTER PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const stabilityCharacterProvider: ZProvider = {
  providerId:  "stability",
  modelKey:    "stability-character",
  studio:      "character",
  displayName: "Stability AI",
  status:      "active",

  // ── Capabilities ────────────────────────────────────────────────────────────
  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:    ["image", "text"],
      supportedAspectRatios:  ["1:1", "4:5", "16:9", "9:16"],
      capabilities:           ["identity_refinement", "inpaint", "outpaint", "upscale", "scene_expansion"],
      asyncMode:              "sync",
      supportsWebhook:        false,
      supportsPolling:        false,
    };
  },

  // ── Validation ──────────────────────────────────────────────────────────────
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];

    if (!input.imageUrl) {
      errors.push("Stability AI character operations require a source image (imageUrl).");
    }
    if (!input.identity?.character_id) {
      errors.push(
        "character_id is required for all Stability AI character refinement calls. " +
        "Use FLUX Character first to create an identity."
      );
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  },

  // ── Cost Estimate ───────────────────────────────────────────────────────────
  estimateCost(input: ZProviderInput): CreditEstimate {
    const op = (input.providerParams?.operation as StabilityOperation | undefined) ?? "image-to-image";

    const costMap: Record<StabilityOperation, number> = {
      "image-to-image": 4,
      "inpaint":        5,
      "outpaint":       5,
      "upscale":        6,
      "variation":      4,
      "scene-builder":  5,
    };

    const expected = costMap[op] ?? 5;
    return {
      min:       3,
      max:       8,
      expected,
      breakdown: { base: expected },
    };
  },

  // ── Create Job ──────────────────────────────────────────────────────────────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, baseUrl } = getStabilityEnv();
    const jobId = newJobId();

    const op        = (input.providerParams?.operation as StabilityOperation | undefined) ?? "image-to-image";
    const endpoint  = STABILITY_ENDPOINTS[op];

    // Stability API uses multipart/form-data for image operations
    const form = new FormData();
    form.append("prompt", input.prompt);
    form.append("output_format", "png");

    if (input.imageUrl) {
      // Fetch image and attach as blob
      const imgRes = await fetch(input.imageUrl, { signal: AbortSignal.timeout(20_000) });
      if (!imgRes.ok) throw new Error("Failed to fetch source image for Stability refinement.");
      const blob = await imgRes.blob();
      form.append("image", blob, "source.png");
    }

    if (input.negativePrompt) {
      form.append("negative_prompt", input.negativePrompt);
    }
    if (input.seed) {
      form.append("seed", String(input.seed));
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method:  "POST",
      headers: {
        "Authorization":  `Bearer ${apiKey}`,
        "Accept":         "application/json",
      },
      body:   form,
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      throw new Error(`Stability AI HTTP ${res.status}: ${sanitize(err)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Stability returns base64 image inline (sync response)
    const artifacts = data.artifacts as Array<Record<string, unknown>> | undefined;
    const image = (data.image ?? artifacts?.[0]?.base64) as string | undefined;
    if (!image) {
      throw new Error("Stability AI returned no image data.");
    }

    const now    = new Date();
    const result = normalizeStabilityResult(jobId, image, data);

    return {
      id:            jobId,
      provider:      "stability",
      modelKey:      "stability-character",
      studioType:    "character",
      status:        "success",
      externalJobId: String(data.id ?? jobId),
      createdAt:     now,
      updatedAt:     now,
      completedAt:   now,
      result,
      identity:      input.identity,
      providerMeta:  { operation: op },
      estimatedCredits: input.estimatedCredits,
    };
  },

  // ── Get Job Status — sync provider, always complete ─────────────────────────
  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    // Stability is synchronous — by the time we have an externalJobId, it's done
    return { jobId: externalJobId, status: "success" };
  },

  // ── Cancel Job ──────────────────────────────────────────────────────────────
  async cancelJob(_externalJobId: string): Promise<void> {
    // Sync provider — no cancellation needed
  },

  // ── Normalize Output ────────────────────────────────────────────────────────
  normalizeOutput(raw: unknown): ZProviderResult {
    const data      = raw as Record<string, unknown>;
    const artifacts = data.artifacts as Array<Record<string, unknown>> | undefined;
    const image     = (data.image ?? artifacts?.[0]?.base64) as string | undefined;
    return normalizeStabilityResult(String(data.id ?? ""), image, data);
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────
  async handleWebhook(_payload: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _payload.jobId, status: "success" };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeStabilityResult(
  jobId: string,
  base64Image: string | undefined,
  data: Record<string, unknown>,
): ZProviderResult {
  // Convert base64 to data URL if it doesn't have a prefix
  const url = base64Image
    ? (base64Image.startsWith("data:") ? base64Image : `data:image/png;base64,${base64Image}`)
    : undefined;

  return {
    jobId,
    provider: "stability",
    modelKey: "stability-character",
    status:   "success",
    url,
    seed:     data.seed as number | undefined,
    metadata: { finish_reason: data.finish_reason },
  };
}

function sanitize(raw: string): string {
  if (raw.toLowerCase().includes("api_key") || raw.toLowerCase().includes("authorization")) {
    return "Authentication error — check STABILITY_API_KEY configuration.";
  }
  return raw.slice(0, 120);
}
