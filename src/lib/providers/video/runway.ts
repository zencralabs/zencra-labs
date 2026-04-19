/**
 * Video Studio — Runway Gen-4.5 Provider
 *
 * Status: COMING SOON (Phase 1 — not yet active)
 *
 * This adapter is registered in the model registry as coming-soon.
 * The provider is included here for future-ready structure only.
 * It will NOT be callable through the orchestrator until:
 *   1. RUNWAY_API_KEY is set in environment
 *   2. The model entry is flipped to status: "active" in registry.ts
 *   3. The feature flag ZENCRA_FLAG_RUNWAY is set to true
 *
 * API: api.runwayml.com
 * Async: polling + webhook
 * Env: RUNWAY_API_KEY, RUNWAY_BASE_URL
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getRunwayEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// RUNWAY GEN-4.5 PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const runwayGen45Provider: ZProvider = {
  providerId:  "runway",
  modelKey:    "runway-gen45",
  studio:      "video",
  displayName: "Runway Gen-4.5",
  status:      "coming-soon",  // flip to "active" at launch

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "image"],
      supportedAspectRatios: ["16:9", "9:16"],
      supportedDurations:    [5, 10],
      maxDuration:           10,
      capabilities:          ["text_to_video", "image_to_video", "cinematic"],
      asyncMode:             "polling+webhook",
      supportsWebhook:       true,
      supportsPolling:       true,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    errors.push("Runway Gen-4.5 is coming soon and is not yet available for generation.");
    return { valid: false, errors, warnings: [] };
  },

  estimateCost(_input: ZProviderInput): CreditEstimate {
    const duration = _input.durationSeconds ?? 5;
    const base     = 12;
    const extra    = duration > 5 ? 4 : 0;
    return {
      min:       12,
      max:       20,
      expected:  base + extra,
      breakdown: { base, duration_extra: extra },
    };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, baseUrl } = getRunwayEnv();
    const jobId               = newJobId();
    const duration            = input.durationSeconds ?? 5;
    const ratio               = input.aspectRatio ?? "16:9";

    const payload: Record<string, unknown> = {
      model:       "gen4_turbo",
      promptText:  input.prompt,
      duration:    duration,
      ratio:       ratio === "16:9" ? "1280:720" : ratio === "9:16" ? "720:1280" : "1280:720",
    };

    if (input.imageUrl) {
      payload.promptImage = input.imageUrl;
    }

    const res = await fetch(`${baseUrl}/v1/image_to_video`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Runway API HTTP ${res.status}: ${err.slice(0, 100)}`);
    }

    const body   = (await res.json()) as Record<string, unknown>;
    const taskId = String(body.id ?? "");
    if (!taskId) throw new Error("Runway returned no task ID.");

    const now = new Date();
    return {
      id: jobId, provider: "runway", modelKey: "runway-gen45",
      studioType: "video", status: "pending", externalJobId: taskId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { taskId, duration, ratio },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey, baseUrl } = getRunwayEnv();

    const res = await fetch(`${baseUrl}/v1/tasks/${externalJobId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

    const body   = (await res.json()) as Record<string, unknown>;
    const status = String(body.status ?? "");

    if (status === "SUCCEEDED") {
      const output = body.output as string[] | undefined;
      return { jobId: externalJobId, status: "success", url: output?.[0] };
    }
    if (status === "FAILED") {
      return { jobId: externalJobId, status: "error", error: String(body.failure ?? "Runway generation failed.") };
    }
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(externalJobId: string): Promise<void> {
    const { apiKey, baseUrl } = getRunwayEnv();
    await fetch(`${baseUrl}/v1/tasks/${externalJobId}/cancel`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    }).catch(() => {});
  },

  normalizeOutput(raw: unknown): ZProviderResult {
    const body   = raw as Record<string, unknown>;
    const output = body.output as string[] | undefined;
    return {
      jobId: String(body.id ?? ""), provider: "runway", modelKey: "runway-gen45",
      status: "success", url: output?.[0],
    };
  },

  async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
    const data   = payload.raw as Record<string, unknown>;
    const status = String(data.status ?? "");
    if (status === "SUCCEEDED") {
      const output = data.output as string[] | undefined;
      return { jobId: payload.jobId, status: "success", url: output?.[0] };
    }
    if (status === "FAILED") return { jobId: payload.jobId, status: "error", error: "Runway failed." };
    return { jobId: payload.jobId, status: "pending" };
  },
};
