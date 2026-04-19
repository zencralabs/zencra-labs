/**
 * UGC Studio — HeyGen UGC Provider
 *
 * Avatar-based UGC ad generation engine (DISTINCT from HeyGen video studio).
 * This provider handles ad creation workflows via HeyGen's video generation API.
 * The Video Studio HeyGen entry (heygen-avatar) covers standalone avatar videos;
 * this entry (heygen-ugc) covers UGC-style ad campaigns from scripts.
 *
 * Flow: script + avatar selection → UGC ad video
 * API: api.heygen.com/v2
 * Env: HEYGEN_UGC_API_KEY
 *
 * Auth: Bearer token via X-Api-Key header
 * Async: polling (webhook available but not required)
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload, UGCOutput,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getHeyGenUGCEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// HEYGEN UGC PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const heygenUGCProvider: ZProvider = {
  providerId:  "heygen-ugc",
  modelKey:    "heygen-ugc",
  studio:      "ugc",
  displayName: "HeyGen UGC",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text"],
      supportedAspectRatios: ["9:16", "1:1", "16:9"],
      supportedDurations:    [15, 30, 60],
      maxDuration:           60,
      capabilities:          ["script_to_avatar", "character_to_ugc"],
      asyncMode:             "polling+webhook",
      supportsWebhook:       true,
      supportsPolling:       true,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.script && !input.prompt) {
      errors.push("HeyGen UGC requires a script (script or prompt).");
    }
    if (input.script && input.script.length > 3000) {
      errors.push("Script exceeds 3,000 character limit for HeyGen UGC.");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const duration  = input.durationSeconds ?? 30;
    const base      = duration <= 15 ? 20 : duration <= 30 ? 28 : 40;
    const avatarExtra = input.providerParams?.avatarId ? 5 : 0;
    return {
      min:       20,
      max:       45,
      expected:  base + avatarExtra,
      breakdown: { base, avatar_custom: avatarExtra },
    };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey, baseUrl } = getHeyGenUGCEnv();
    const jobId    = newJobId();
    const duration = input.durationSeconds ?? 30;
    const script   = input.script ?? input.prompt ?? "";

    // ── Build avatar object ──────────────────────────────────────────────────
    // Use custom avatar if identity or providerParams specify one.
    // Falls back to a known default talking-head avatar ID.
    const avatarId   = (input.providerParams?.avatarId as string | undefined)
                    ?? (input.identity?.character_id)
                    ?? "default";
    const voiceId    = (input.providerParams?.voiceId as string | undefined)
                    ?? (input.voiceId)
                    ?? undefined;

    const avatarObj: Record<string, unknown> = {
      avatar_id: avatarId,
      type:      "talking_head",
    };

    const voiceObj: Record<string, unknown> = voiceId
      ? { type: "text", input_text: script, voice_id: voiceId }
      : { type: "text", input_text: script };

    const payload: Record<string, unknown> = {
      video_inputs: [
        {
          character: avatarObj,
          voice:     voiceObj,
          background: { type: "color", value: "#000000" },
        },
      ],
      dimension:  heygenDimension(input.aspectRatio ?? "9:16"),
      duration,
      test:       false,
    };

    // Pass identity custom avatar override
    if (input.identity?.character_id && avatarId !== input.identity.character_id) {
      avatarObj.avatar_id = input.identity.character_id;
    }

    const res = await fetch(`${baseUrl}/v2/video/generate`, {
      method:  "POST",
      headers: {
        "X-Api-Key":    apiKey,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("HeyGen UGC authentication error. Check HEYGEN_UGC_API_KEY.");
      if (res.status === 400) {
        const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(`HeyGen UGC validation error: ${String(errBody.message ?? "bad request")}`);
      }
      throw new Error(`HeyGen UGC HTTP ${res.status}.`);
    }

    const body   = (await res.json()) as Record<string, unknown>;
    const data   = (body.data ?? body) as Record<string, unknown>;
    const taskId = String(data.video_id ?? data.id ?? "");
    if (!taskId) throw new Error("HeyGen UGC returned no video ID.");

    const now = new Date();
    return {
      id: jobId, provider: "heygen-ugc", modelKey: "heygen-ugc",
      studioType: "ugc", status: "pending", externalJobId: taskId,
      createdAt: now, updatedAt: now, identity: input.identity,
      providerMeta: { videoId: taskId, duration, avatarId, voiceId },
      estimatedCredits: input.estimatedCredits,
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const { apiKey, baseUrl } = getHeyGenUGCEnv();
    const res = await fetch(`${baseUrl}/v1/video_status.get?video_id=${externalJobId}`, {
      headers: { "X-Api-Key": apiKey, "Accept": "application/json" },
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

    const body   = (await res.json()) as Record<string, unknown>;
    const data   = (body.data ?? body) as Record<string, unknown>;
    const status = String(data.status ?? "");

    if (status === "completed" || status === "success") {
      return { jobId: externalJobId, status: "success", url: String(data.video_url ?? "") };
    }
    if (status === "failed" || status === "error") {
      return {
        jobId: externalJobId,
        status: "error",
        error: String(data.error ?? data.message ?? "HeyGen UGC generation failed."),
      };
    }
    // "processing" | "pending" | "waiting" → still in flight
    return { jobId: externalJobId, status: "pending" };
  },

  async cancelJob(_: string): Promise<void> { /* HeyGen has no cancel endpoint */ },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    const out: UGCOutput = {
      jobId:    String(data.id ?? data.video_id ?? ""),
      provider: "heygen-ugc",
      modelKey: "heygen-ugc",
      status:   "success",
      url:      String(data.video_url ?? ""),
      avatar:   String(data.avatar_id ?? ""),
      script:   String(data.script ?? ""),
      metadata: { dimension: data.dimension, duration: data.duration },
    };
    return out;
  },

  async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
    // HeyGen sends a webhook when video completes — delegate to polling
    return this.getJobStatus(payload.externalJobId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function heygenDimension(ratio: string): Record<string, number> {
  const map: Record<string, Record<string, number>> = {
    "9:16":  { width: 720,  height: 1280 },
    "1:1":   { width: 720,  height: 720  },
    "16:9":  { width: 1280, height: 720  },
  };
  return map[ratio] ?? map["9:16"];
}
