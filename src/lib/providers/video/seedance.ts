/**
 * Video Studio — Seedance Provider (BytePlus ModelArk)
 *
 * Three distinct model entries:
 *   seedance-20       → Seedance 2.0          (apiModelId: dreamina-seedance-2-0-260128)
 *   seedance-20-fast  → Seedance 2.0 Fast     (apiModelId: dreamina-seedance-2-0-fast-260128)
 *                       NOTE: "Fast" is the BytePlus platform endpoint tier label. apiModelId preserves it exactly.
 *   seedance-15       → Seedance 1.5 Pro       (apiModelId: set via SEEDANCE_15_MODEL_ID — no default)
 *
 * Provider: BytePlus ModelArk API (ark.ap-southeast.bytepluses.com)
 * Async: polling (no webhook support)
 * Env: BYTEPLUS_API_KEY, SEEDANCE_MODEL_ID, SEEDANCE_FAST_MODEL_ID, SEEDANCE_15_MODEL_ID
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getBytePlusEnv, SEEDANCE_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type SeedanceVariant = "v20" | "v20fast" | "v15";

const MODEL_KEY_TO_VARIANT: Record<string, SeedanceVariant> = {
  "seedance-20":      "v20",
  "seedance-20-fast": "v20fast",
  "seedance-15":      "v15",
};

const VARIANT_TO_MODEL_ID: Record<SeedanceVariant, string> = {
  v20:     SEEDANCE_MODEL_IDS.v20,
  v20fast: SEEDANCE_MODEL_IDS.v20Fast,
  v15:     SEEDANCE_MODEL_IDS.v15,
};

const VARIANT_DURATIONS: Record<SeedanceVariant, number[]> = {
  v20:     [5, 10],
  v20fast: [5, 10],
  v15:     [4, 8, 12],
};

const VARIANT_MAX_DURATION: Record<SeedanceVariant, number> = {
  v20: 10, v20fast: 10, v15: 12,
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEDANCE PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function buildSeedanceProvider(modelKey: string, displayName: string): ZProvider {
  const variant   = MODEL_KEY_TO_VARIANT[modelKey] ?? "v20";
  const getModelId = () => VARIANT_TO_MODEL_ID[variant];

  return {
    providerId:  "byteplus",
    modelKey,
    studio:      "video",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   ["text", "image"],
        supportedAspectRatios: ["16:9", "9:16", "1:1"],
        supportedDurations:    VARIANT_DURATIONS[variant],
        maxDuration:           VARIANT_MAX_DURATION[variant],
        capabilities:          ["text_to_video", "image_to_video", "start_frame", "end_frame",
                                ...(variant === "v20fast" ? ["fast_mode" as const] : [])],
        asyncMode:             "polling",
        supportsWebhook:       false,
        supportsPolling:       true,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      if (!input.prompt || input.prompt.trim().length < 3) {
        errors.push("Prompt is required.");
      }
      // Seedance 1.5 requires explicit model ID
      if (variant === "v15" && !getModelId()) {
        errors.push(
          "Seedance 1.5 Pro requires SEEDANCE_15_MODEL_ID to be set. " +
          "Find the ID in Volcengine console → ARK → Models → Seedance 1.5."
        );
      }
      const validDurations = VARIANT_DURATIONS[variant];
      const duration       = input.durationSeconds;
      if (duration && !validDurations.includes(duration)) {
        errors.push(
          `Invalid duration ${duration}s. Valid options for ${displayName}: ${validDurations.join(", ")}s.`
        );
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(input: ZProviderInput): CreditEstimate {
      const duration     = input.durationSeconds ?? 5;
      const base         = variant === "v20fast" ? 8 : 10;
      const durationCost = duration > 5 ? Math.ceil((duration - 5) / 5) * 2 : 0;
      const hd           = variant === "v15" ? 2 : 0;
      const expected     = base + durationCost + hd;
      return {
        min:       8,
        max:       18,
        expected,
        breakdown: { base, duration: durationCost, hd_1080p: hd },
      };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey, baseUrl } = getBytePlusEnv();
      const modelId             = getModelId();
      const jobId               = newJobId();

      if (!modelId) {
        throw new Error(
          `${displayName} model ID is not configured. ` +
          `Set ${variant === "v15" ? "SEEDANCE_15_MODEL_ID" : variant === "v20fast" ? "SEEDANCE_FAST_MODEL_ID" : "SEEDANCE_MODEL_ID"} in environment.`
        );
      }

      const duration = input.durationSeconds ?? (VARIANT_DURATIONS[variant][0]);
      const aspect   = input.aspectRatio ?? "16:9";

      // BytePlus ModelArk API — compatible with OpenAI-style chat completions format
      const messages: Record<string, unknown>[] = [];

      // Image content (start frame)
      if (input.imageUrl) {
        messages.push({
          role:    "user",
          content: [{ type: "image_url", image_url: { url: input.imageUrl } }],
        });
      }

      // End frame (image_tail)
      if (input.endImageUrl) {
        messages.push({
          role:    "user",
          content: [{ type: "image_url", image_url: { url: input.endImageUrl } }],
        });
      }

      messages.push({
        role:    "user",
        content: [{ type: "text", text: input.prompt }],
      });

      const payload: Record<string, unknown> = {
        model:    modelId,
        messages,
        stream:   false,
        parameters: {
          duration: String(duration),
          aspect_ratio: aspect,
        },
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Seedance API HTTP ${res.status}: ${err.slice(0, 120)}`);
      }

      const body   = (await res.json()) as Record<string, unknown>;
      const taskId = extractSeedanceTaskId(body);
      if (!taskId) throw new Error("Seedance returned no task ID.");

      const now = new Date();
      return {
        id: jobId, provider: "byteplus", modelKey,
        studioType: "video", status: "pending", externalJobId: taskId,
        createdAt: now, updatedAt: now, identity: input.identity,
        providerMeta: { modelId, taskId, duration, aspect },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { apiKey, baseUrl } = getBytePlusEnv();
      const modelId             = getModelId();

      const res = await fetch(`${baseUrl}/tasks/${modelId}/${externalJobId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal:  AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };

      const body   = (await res.json()) as Record<string, unknown>;
      const task   = (body.data ?? body) as Record<string, unknown>;
      const status = String(task.task_status ?? task.status ?? "");

      if (status === "succeeded" || status === "success" || status === "SUCCEEDED") {
        const videoUrl = extractSeedanceVideoUrl(task);
        return { jobId: externalJobId, status: "success", url: videoUrl };
      }
      if (status === "failed" || status === "FAILED") {
        return { jobId: externalJobId, status: "error", error: "Seedance generation failed." };
      }
      return { jobId: externalJobId, status: "pending" };
    },

    async cancelJob(_: string): Promise<void> { /* BytePlus has no cancel endpoint */ },

    normalizeOutput(raw: unknown): ZProviderResult {
      const data = raw as Record<string, unknown>;
      return {
        jobId: String(data.id ?? ""), provider: "byteplus", modelKey,
        status: "success", url: extractSeedanceVideoUrl(data),
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

// Official BytePlus / Volcengine model display names.
// "Seedance 2.0 Fast" matches the Zencra product plan. The apiModelId ("dreamina-seedance-2-0-fast-260128")
// is the exact upstream endpoint string — "fast" is preserved there regardless of UI label.
export const seedance20Provider     = buildSeedanceProvider("seedance-20",      "Seedance 2.0");
export const seedance20FastProvider = buildSeedanceProvider("seedance-20-fast", "Seedance 2.0 Fast");
export const seedance15Provider     = buildSeedanceProvider("seedance-15",      "Seedance 1.5 Pro");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractSeedanceTaskId(body: Record<string, unknown>): string {
  const data = (body.data ?? body) as Record<string, unknown>;
  return String(data.task_id ?? data.taskId ?? body.task_id ?? body.id ?? "");
}

function extractSeedanceVideoUrl(task: Record<string, unknown>): string | undefined {
  const result = task.task_result ?? task.result;
  if (typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    const videos = r.videos as Array<{ url?: string }> | undefined;
    if (videos?.[0]?.url) return videos[0].url;
    return String(r.video_url ?? r.url ?? "") || undefined;
  }
  return undefined;
}
