/**
 * UGC Studio — Arcads Provider
 *
 * Script-driven UGC ad generation — actor-based video ads.
 * Arcads generates video ads using real or AI actors from scripts.
 *
 * Flow: script + actor selection → video ad
 * API: api.arcads.ai
 * Env: ARCADS_API_KEY
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload, UGCOutput,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getArcadsEnv } from "../core/env";

export const arcadsProvider: ZProvider = {
  providerId:  "arcads",
  modelKey:    "arcads",
  studio:      "ugc",
  displayName: "Arcads",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "url"],
      supportedAspectRatios: ["9:16", "1:1"],
      supportedDurations:    [15, 30, 60],
      maxDuration:           60,
      capabilities:          ["script_to_avatar", "product_to_ad"],
      asyncMode:             "polling",
      supportsWebhook:       false,
      supportsPolling:       true,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.script && !input.prompt) {
      errors.push("Arcads requires a script (script or prompt).");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const duration = input.durationSeconds ?? 30;
    const base     = duration <= 15 ? 15 : duration <= 30 ? 20 : 25;
    return { min: 15, max: 30, expected: base, breakdown: { base } };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, baseUrl } = getArcadsEnv();
    const jobId    = newJobId();
    const duration = input.durationSeconds ?? 30;

    const payload: Record<string, unknown> = {
      script:     input.script ?? input.prompt,
      duration:   duration,
      format:     input.aspectRatio === "1:1" ? "square" : "vertical",
      actor_id:   input.providerParams?.actorId,
    };

    if (input.identity?.character_id) {
      payload.custom_avatar_id = input.identity.character_id;
    }

    const res = await fetch(`${baseUrl}/v1/ads`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new Error(`Arcads HTTP ${res.status}.`);
    const body   = (await res.json()) as Record<string, unknown>;
    const taskId = String(body.id ?? body.job_id ?? "");
    if (!taskId) throw new Error("Arcads returned no job ID.");

    const now = new Date();
    return {
      id: jobId, provider: "arcads", modelKey: "arcads",
      studioType: "ugc", status: "pending", externalJobId: taskId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { taskId, duration, format: payload.format },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey, baseUrl } = getArcadsEnv();
    const res = await fetch(`${baseUrl}/v1/ads/${externalJobId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

    const body   = (await res.json()) as Record<string, unknown>;
    const status = String(body.status ?? "");

    if (status === "completed" || status === "done") {
      return { jobId: externalJobId, status: "success", url: String(body.video_url ?? body.output ?? "") };
    }
    if (status === "failed" || status === "error") {
      return { jobId: externalJobId, status: "error", error: "Arcads generation failed." };
    }
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(_: string): Promise<void> { /* no cancel */ },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    const out: UGCOutput = {
      jobId: String(data.id ?? ""), provider: "arcads", modelKey: "arcads",
      status: "success", url: String(data.video_url ?? data.output ?? ""),
      script: String(data.script ?? ""),
      metadata: { format: data.format },
    };
    return out;
  },

  async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _.jobId, status: "pending" };
  },
};
