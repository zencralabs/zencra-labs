/**
 * Audio Studio — Kits AI Provider (Phase 2 Future Slot)
 *
 * Status: NOT ACTIVE — Phase 2 only.
 * This file registers the Kits AI adapter structure for future wiring.
 * The provider will not be callable until:
 *   1. KITS_API_KEY is configured
 *   2. kitsEnabled feature flag is set to true
 *   3. Model entry in registry flipped to status: "active"
 *
 * Future capabilities:
 *   - Voice conversion (transform audio to different AI voice)
 *   - Voice cloning from sample
 *
 * API: arpeggi.io/api/kits/v1
 * Env: KITS_API_KEY, KITS_BASE_URL
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getKitsEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// KITS AI PROVIDER (Phase 2 stub — structure only)
// ─────────────────────────────────────────────────────────────────────────────

export const kitsProvider: ZProvider = {
  providerId:  "kits",
  modelKey:    "kits-ai",
  studio:      "audio",
  displayName: "Kits AI",
  status:      "coming-soon",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["audio"],
      supportedAspectRatios: [],
      capabilities:          ["voice_convert", "voice_clone"],
      asyncMode:             "polling",
      supportsWebhook:       false,
      supportsPolling:       true,
    };
  },

  validateInput(_input: ZProviderInput): ValidationResult {
    return {
      valid:    false,
      errors:   ["Kits AI is not yet available. Coming in Phase 2."],
      warnings: [],
    };
  },

  estimateCost(_input: ZProviderInput): CreditEstimate {
    return { min: 5, max: 15, expected: 8, breakdown: { base: 8 } };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, baseUrl } = getKitsEnv();
    const jobId               = newJobId();

    if (!input.audioUrl) throw new Error("Kits AI requires a source audio file (audioUrl).");

    // Voice conversion endpoint (Phase 2 — structure placeholder)
    const payload: Record<string, unknown> = {
      sound_file_url: input.audioUrl,
      voice_id:       input.voiceId ?? "default",
    };

    const res = await fetch(`${baseUrl}/conversions`, {
      method:  "POST",
      headers: {
        "X-API-KEY":    apiKey,
        "Content-Type": "application/json",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Kits AI HTTP ${res.status}.`);
    const body   = (await res.json()) as Record<string, unknown>;
    const convId = String(body.id ?? "");
    if (!convId) throw new Error("Kits AI returned no conversion ID.");

    const now = new Date();
    return {
      id: jobId, provider: "kits", modelKey: "kits-ai",
      studioType: "audio", status: "pending", externalJobId: convId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { conversionId: convId },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey, baseUrl } = getKitsEnv();

    const res = await fetch(`${baseUrl}/conversions/${externalJobId}`, {
      headers: { "X-API-KEY": apiKey },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

    const body   = (await res.json()) as Record<string, unknown>;
    const status = String(body.status ?? "");

    if (status === "done" || status === "succeeded") {
      return { jobId: externalJobId, status: "success", url: String(body.output_sound_file_url ?? "") };
    }
    if (status === "failed") {
      return { jobId: externalJobId, status: "error", error: "Kits AI conversion failed." };
    }
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(_: string): Promise<void> { /* best-effort */ },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    return {
      jobId:    String(data.id ?? ""),
      provider: "kits",
      modelKey: "kits-ai",
      status:   "success",
      url:      String(data.output_sound_file_url ?? ""),
    };
  },

  async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _.jobId, status: "pending" };
  },
};
