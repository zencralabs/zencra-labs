/**
 * Character Studio — Motion Provider Abstraction
 *
 * Abstract motion generation layer for Character Studio.
 * The concrete provider behind this abstraction is NOT hardcoded yet —
 * it will be selected at launch based on quality evaluation.
 *
 * Responsibilities:
 *   - image-to-video motion generation (character image → short motion clip)
 *   - async job lifecycle (polling + webhook)
 *   - normalized output compatible with ZProvider contract
 *
 * Future concrete providers may include:
 *   - Kling Motion Control (if licensed separately for character use)
 *   - Runway Gen-4.5 (image-to-video)
 *   - Seedance 2.0 (image-to-video)
 *   - A dedicated character animation model
 *
 * DO NOT hardcode a single provider here.
 * Wire the concrete adapter via MOTION_PROVIDER env var at launch.
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

// ─────────────────────────────────────────────────────────────────────────────
// MOTION ADAPTER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The motion abstraction delegates to a concrete MotionAdapter at runtime.
 * Concrete adapters implement this lighter interface.
 */
export interface MotionAdapter {
  adapterName: string;
  submitJob(
    imageUrl: string,
    prompt: string,
    durationSeconds: number,
    aspectRatio: string,
  ): Promise<{ externalJobId: string; metadata?: Record<string, unknown> }>;
  pollStatus(externalJobId: string): Promise<{
    status: "pending" | "processing" | "success" | "error";
    url?: string;
    error?: string;
  }>;
  cancel(externalJobId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME ADAPTER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter registry — wire concrete adapters here at launch.
 * Key = adapter name (matches MOTION_PROVIDER env var).
 */
const _adapters = new Map<string, MotionAdapter>();

export function registerMotionAdapter(adapter: MotionAdapter): void {
  _adapters.set(adapter.adapterName, adapter);
}

function resolveAdapter(): MotionAdapter | undefined {
  const name = process.env.MOTION_PROVIDER ?? "";
  if (name && _adapters.has(name)) {
    return _adapters.get(name);
  }
  // Return first registered adapter if no explicit selection
  return _adapters.values().next().value;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTION ABSTRACTION PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const motionProvider: ZProvider = {
  providerId:  "motion-abstract",
  modelKey:    "motion-abstraction",
  studio:      "character",
  displayName: "Motion",
  status:      "active",

  // ── Capabilities ────────────────────────────────────────────────────────────
  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:    ["image"],
      supportedAspectRatios:  ["16:9", "9:16", "1:1"],
      supportedDurations:     [3, 5],
      maxDuration:            5,
      capabilities:           ["motion_starter", "image_to_video"],
      asyncMode:              "polling",
      supportsWebhook:        true,
      supportsPolling:        true,
    };
  },

  // ── Validation ──────────────────────────────────────────────────────────────
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];

    if (!input.imageUrl) {
      errors.push("Motion generation requires a character image (imageUrl).");
    }
    if (!input.identity?.character_id) {
      errors.push("character_id is required for Motion Starter — identity must be established first.");
    }

    const adapter = resolveAdapter();
    if (!adapter) {
      errors.push(
        "No motion adapter is registered. " +
        "Set MOTION_PROVIDER env var and register a concrete MotionAdapter."
      );
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  },

  // ── Cost Estimate ───────────────────────────────────────────────────────────
  estimateCost(input: ZProviderInput): CreditEstimate {
    const duration = input.durationSeconds ?? 5;
    const base     = 8;
    const durationExtra = duration > 3 ? Math.ceil((duration - 3) / 2) * 2 : 0;
    const expected = base + durationExtra;

    return {
      min:       8,
      max:       14,
      expected,
      breakdown: { base, duration_extra: durationExtra },
    };
  },

  // ── Create Job ──────────────────────────────────────────────────────────────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    const adapter = resolveAdapter();
    if (!adapter) {
      throw new Error(
        "Motion provider not configured. " +
        "Register a MotionAdapter and set MOTION_PROVIDER env var."
      );
    }

    const jobId   = newJobId();
    const duration = input.durationSeconds ?? 5;
    const aspect  = input.aspectRatio ?? "16:9";

    const { externalJobId, metadata } = await adapter.submitJob(
      input.imageUrl!,
      input.prompt,
      duration,
      aspect,
    );

    const now = new Date();
    return {
      id:            jobId,
      provider:      "motion-abstract",
      modelKey:      "motion-abstraction",
      studioType:    "character",
      status:        "pending",
      externalJobId,
      createdAt:     now,
      updatedAt:     now,
      identity:      input.identity,
      providerMeta:  { adapter: adapter.adapterName, ...metadata },
      estimatedCredits: input.estimatedCredits,
    };
  },

  // ── Get Job Status ──────────────────────────────────────────────────────────
  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    const adapter = resolveAdapter();
    if (!adapter) {
      return {
        jobId:  externalJobId,
        status: "error",
        error:  "Motion adapter not configured.",
      };
    }

    const result = await adapter.pollStatus(externalJobId);
    return {
      jobId:  externalJobId,
      status: result.status,
      url:    result.url,
      error:  result.error,
    };
  },

  // ── Cancel Job ──────────────────────────────────────────────────────────────
  async cancelJob(externalJobId: string): Promise<void> {
    const adapter = resolveAdapter();
    if (adapter) {
      await adapter.cancel(externalJobId).catch(() => {/* best-effort */});
    }
  },

  // ── Normalize Output ────────────────────────────────────────────────────────
  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    return {
      jobId:    String(data.jobId ?? ""),
      provider: "motion-abstract",
      modelKey: "motion-abstraction",
      status:   "success",
      url:      String(data.url ?? ""),
      metadata: { adapter: data.adapter },
    };
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────
  async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
    // Delegate to adapter's polling check since we don't know the concrete shape
    return this.getJobStatus(payload.externalJobId);
  },
};
