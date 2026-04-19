/**
 * UGC Studio — Creatify Provider
 *
 * Primary product-to-ad generation engine.
 * Creatify generates UGC-style video ads from a product URL.
 *
 * Flow: product URL → Creatify video ad (async, polling + webhook)
 * API: api.creatify.ai
 * Env: CREATIFY_API_KEY, CREATIFY_API_ID
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload, UGCOutput,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getCreatifyEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// CREATIFY PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const creatifyProvider: ZProvider = {
  providerId:  "creatify",
  modelKey:    "creatify",
  studio:      "ugc",
  displayName: "Creatify",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["url", "text"],
      supportedAspectRatios: ["9:16", "1:1", "16:9"],
      supportedDurations:    [15, 30, 60],
      maxDuration:           60,
      capabilities:          ["product_to_ad", "text_to_video"],
      asyncMode:             "polling+webhook",
      supportsWebhook:       true,
      supportsPolling:       true,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.productUrl && !input.prompt) {
      errors.push("Creatify requires a product URL (productUrl) or script (prompt).");
    }
    if (input.productUrl) {
      try { new URL(input.productUrl); }
      catch { errors.push("Invalid product URL format."); }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const duration  = input.durationSeconds ?? 30;
    const base      = duration <= 15 ? 15 : duration <= 30 ? 20 : 30;
    const identity  = input.identity?.character_id ? 5 : 0;
    return { min: 15, max: 35, expected: base + identity, breakdown: { base, character_id: identity } };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, apiId, baseUrl } = getCreatifyEnv();
    const jobId   = newJobId();
    const duration = input.durationSeconds ?? 30;
    const aspect  = creatifyAspect(input.aspectRatio ?? "9:16");

    const payload: Record<string, unknown> = {
      link:            input.productUrl,
      script:          input.script ?? input.prompt,
      target_platform: aspect,
      video_length:    duration,
    };

    if (input.identity?.character_id) {
      payload.custom_avatar_id = input.identity.character_id;
    }

    const res = await fetch(`${baseUrl}/api/link_to_videos/`, {
      method:  "POST",
      headers: {
        "X-API-ID":  apiId,
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new Error(`Creatify HTTP ${res.status}.`);
    const body   = (await res.json()) as Record<string, unknown>;
    const taskId = String(body.id ?? "");
    if (!taskId) throw new Error("Creatify returned no task ID.");

    const now = new Date();
    return {
      id: jobId, provider: "creatify", modelKey: "creatify",
      studioType: "ugc", status: "pending", externalJobId: taskId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { taskId, duration, platform: aspect, productUrl: input.productUrl },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey, apiId, baseUrl } = getCreatifyEnv();
    const res = await fetch(`${baseUrl}/api/link_to_videos/${externalJobId}/`, {
      headers: { "X-API-ID": apiId, "X-API-KEY": apiKey },
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

    const body   = (await res.json()) as Record<string, unknown>;
    const status = String(body.status ?? "");

    if (status === "done" || status === "succeeded") {
      return { jobId: externalJobId, status: "success", url: String(body.output ?? "") };
    }
    if (status === "error" || status === "failed") {
      return { jobId: externalJobId, status: "error", error: String(body.message ?? "Creatify failed.") };
    }
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(_: string): Promise<void> { /* no cancel endpoint */ },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    const out: UGCOutput = {
      jobId: String(data.id ?? ""), provider: "creatify", modelKey: "creatify",
      status: "success", url: String(data.output ?? ""),
      productUrl: String(data.link ?? ""),
      metadata: { platform: data.target_platform },
    };
    return out;
  },

  async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
    return this.getJobStatus(payload.externalJobId);
  },
};

function creatifyAspect(ratio: string): string {
  const map: Record<string, string> = { "9:16": "9x16", "1:1": "1x1", "16:9": "16x9" };
  return map[ratio] ?? "9x16";
}
