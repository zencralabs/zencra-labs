/**
 * Nano Banana Provider — Async Task-Based Image Generation
 *
 * NanoBananaAPI.ai is task-based (async):
 *   1. POST generation request  → response: { code, msg, data: { taskId } }
 *   2. Poll GET record-info?taskId= until taskStatus is terminal
 *   3. Extract imageUrl from the completed task body
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIRMED ENDPOINTS  (verified from docs.nanobananaapi.ai)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Standard  POST  {base}/api/v1/nanobanana/generate
 *             body: { type, prompt, numImages, callBackUrl, imageUrls? }
 *
 *   Pro       POST  {base}/api/v1/nanobanana/generate-pro
 *             body: { prompt, resolution, callBackUrl, aspectRatio?, imageUrls? }
 *
 *   Task      GET   {base}/api/v1/nanobanana/record-info?taskId={taskId}
 *             resp: { data: { taskStatus: 0|1|2|3, imageUrl: string } }
 *             taskStatus: 0=GENERATING, 1=SUCCESS, 2=CREATE_TASK_FAILED, 3=GENERATE_FAILED
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUBMIT RESPONSE SHAPE (both endpoints)
 * ─────────────────────────────────────────────────────────────────────────────
 *   { code: 200, msg: "success", data: { taskId: "task_..." } }
 *   → taskId lives at body.data.taskId, NOT body.taskId
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TYPE STRINGS (exact spelling from official API docs — preserve as-is)
 * ─────────────────────────────────────────────────────────────────────────────
 *   "TEXTTOIAMGE"   text-to-image
 *   "IMAGETOIAMGE"  image-to-image
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO NANO BANANA 2
 * ─────────────────────────────────────────────────────────────────────────────
 * This file never routes to "Nano Banana 2" endpoints or models.
 * NB2 must be enabled via explicit env flag (NANO_BANANA_ENABLE_V2=true)
 * in a separate provider file if ever needed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT VARIABLES
 * ─────────────────────────────────────────────────────────────────────────────
 *   NANO_BANANA_API_KEY          Required.
 *   NANO_BANANA_API_BASE_URL     Required. Confirmed: https://api.nanobananaapi.ai
 *   NANO_BANANA_CALLBACK_URL     Optional. Polling is primary; API still requires
 *                                the field. Defaults to {SITE_URL}/api/nb-callback.
 */

import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMED ENDPOINT PATHS
// ─────────────────────────────────────────────────────────────────────────────

const EP = {
  standard: "/api/v1/nanobanana/generate",
  pro:      "/api/v1/nanobanana/generate-pro",
  task:     "/api/v1/nanobanana/record-info",   // GET ?taskId=  (query param)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMED API VALUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exact type strings from official API docs.
 * "IAMGE" spelling is intentional — do NOT correct it.
 */
const NB_TYPE = {
  text:  "TEXTTOIAMGE",
  image: "IMAGETOIAMGE",
} as const;

/** taskStatus numeric codes from record-info endpoint */
const TASK_STATUS = {
  GENERATING:          0,
  SUCCESS:             1,
  CREATE_TASK_FAILED:  2,
  GENERATE_FAILED:     3,
} as const;

/** Resolution strings for the pro endpoint */
const NB_RESOLUTION: Record<NbOutputSize, "1K" | "2K" | "4K"> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG LAYER
// ─────────────────────────────────────────────────────────────────────────────

export type NbVariant    = "standard" | "edit" | "pro" | "pro-4k";
export type NbOutputSize = "1k" | "2k" | "4k";

interface NbModelConfig {
  displayName: string;
  badge: string;
  endpoint: "standard" | "pro";
  requestType: (typeof NB_TYPE)[keyof typeof NB_TYPE] | null;
  enabled: boolean;
  allowedSizes: NbOutputSize[] | null;
  fixedSize?: NbOutputSize;
  requiresSourceImage: boolean;
  pricingMeta: { credits1k?: number; credits2k?: number; credits4k?: number };
}

export const NB_MODEL_CONFIG: Record<NbVariant, NbModelConfig> = {
  "standard": {
    displayName:         "Nano Banana",
    badge:               "Fast",
    endpoint:            "standard",
    requestType:         NB_TYPE.text,
    enabled:             true,
    allowedSizes:        null,
    requiresSourceImage: false,
    pricingMeta:         { credits1k: 2 },
  },
  "edit": {
    displayName:         "Nano Banana Edit",
    badge:               "Edit",
    endpoint:            "standard",
    requestType:         NB_TYPE.image,
    enabled:             true,
    allowedSizes:        null,
    requiresSourceImage: true,
    pricingMeta:         { credits1k: 2 },
  },
  "pro": {
    displayName:         "Nano Banana Pro",
    badge:               "Pro",
    endpoint:            "pro",
    requestType:         null,
    enabled:             true,
    allowedSizes:        ["1k", "2k"],
    requiresSourceImage: false,
    pricingMeta:         { credits1k: 2, credits2k: 4 },
  },
  "pro-4k": {
    displayName:         "Nano Banana Pro 4K",
    badge:               "4K",
    endpoint:            "pro",
    requestType:         null,
    enabled:             true,
    allowedSizes:        ["4k"],
    fixedSize:           "4k",
    requiresSourceImage: false,
    pricingMeta:         { credits4k: 8 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function resolveProResolution(variant: NbVariant, quality: string): "1K" | "2K" | "4K" {
  const cfg = NB_MODEL_CONFIG[variant];
  if (cfg.fixedSize) return NB_RESOLUTION[cfg.fixedSize];
  if (quality === "studio") return "2K";
  return "1K";
}

/** Sanitize: never expose raw provider internals to end users */
function sanitizeError(raw: string, status: number): string {
  const lower = raw.toLowerCase();
  if (lower.includes("model") || lower.includes("quota") || lower.includes("imagen") ||
      lower.includes("google") || lower.includes("gemini")) {
    return "Generation failed. Please try again or select a different style.";
  }
  if (status === 401 || status === 403) return "Authentication error. Please contact support.";
  if (status === 429)                   return "Too many requests — please wait a moment.";
  if (status >= 500)                    return "The generation service is temporarily unavailable.";
  return "Generation failed. Please try again.";
}

// pollUntilDone removed — polling now done client-side via the status endpoint

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS — used by both generate() and getStatus()
// ─────────────────────────────────────────────────────────────────────────────

function getEnvVars() {
  const apiKey  = process.env.NANO_BANANA_API_KEY;
  const apiBase = process.env.NANO_BANANA_API_BASE_URL
               ?? process.env.NANO_BANANA_API_URL
               ?? "https://api.nanobananaapi.ai";
  return { apiKey, apiBase };
}

/**
 * Check a single NB task status (one HTTP call, no polling loop).
 * Returns the raw `data` object from record-info.
 */
async function checkTaskOnce(
  taskId:  string,
  apiBase: string,
  apiKey:  string,
): Promise<{ taskStatus: number; imageUrl?: string; errMsg?: string }> {
  const res = await fetch(`${apiBase}${EP.task}?taskId=${encodeURIComponent(taskId)}`, {
    headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`NB status check HTTP ${res.status}`);
  }

  const body = (await res.json()) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;

  return {
    taskStatus: Number(data.taskStatus ?? data.status ?? -1),
    imageUrl:   String(
      data.imageUrl ??
      data.image_url ??
      (Array.isArray(data.imageUrls) ? data.imageUrls[0] : undefined) ??
      ""
    ) || undefined,
    errMsg: String(data.errMsg ?? data.message ?? data.error ?? "") || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const nanoBananaProvider: AiProvider = {
  name:           "nano-banana",
  supportedModes: ["image"],

  // ── generate() — ASYNC: submit job only, return taskId immediately ──────────
  //
  // Why async? Nano Banana generation takes 15–90 s. Serverless function
  // timeouts (10 s on Vercel Hobby, 60 s on Pro) would kill the polling loop
  // before the image is ready, causing "Generation failed" even though the
  // image was actually created. Instead we:
  //   1. Submit the job → get taskId (fast, <2 s)
  //   2. Return { status: "pending", taskId } immediately
  //   3. Let the client poll /api/generate/status/nano-banana/{generationId}
  //      which calls getStatus() below (single check, no long loop)
  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const { apiKey, apiBase } = getEnvVars();
    const callbackUrl = process.env.NANO_BANANA_CALLBACK_URL
                     ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://zencralabs.com"}/api/nb-callback`;

    if (!apiKey) {
      throw Object.assign(
        new Error("Nano Banana is not available right now. Please try another model."),
        { code: "PROVIDER_NOT_CONFIGURED" }
      );
    }

    // ── Variant config ───────────────────────────────────────────────────────
    const variant = (input.metadata?.nbVariant as NbVariant | undefined) ?? "standard";
    const cfg     = NB_MODEL_CONFIG[variant];

    if (!cfg?.enabled) throw new Error(`Nano Banana variant "${variant}" is not available.`);
    if (String(variant).includes("2")) throw new Error("Unsupported generation variant.");

    // ── Input validation ─────────────────────────────────────────────────────
    const sourceImageUrl = input.imageUrl ?? (input.metadata?.nbImageUrl as string | undefined);

    if (cfg.requiresSourceImage && !sourceImageUrl) {
      throw new Error("Nano Banana Edit requires a source image. Please upload one first.");
    }
    if (!cfg.requiresSourceImage && sourceImageUrl && cfg.endpoint === "standard") {
      throw new Error("Source image cannot be used with text-to-image. Use Nano Banana Edit instead.");
    }
    if (cfg.endpoint === "pro" && cfg.allowedSizes) {
      const res = resolveProResolution(variant, input.quality ?? "cinematic");
      if (!cfg.allowedSizes.includes(res.toLowerCase() as NbOutputSize)) {
        throw new Error(
          `${cfg.displayName} does not support ${res}. ` +
          `Allowed: ${cfg.allowedSizes.map((s) => s.toUpperCase()).join(", ")}`
        );
      }
    }

    // ── Build payload ────────────────────────────────────────────────────────
    let endpointPath: string;
    let payload: Record<string, unknown>;

    if (cfg.endpoint === "standard") {
      endpointPath = EP.standard;
      payload = {
        type:        cfg.requestType!,
        prompt:      input.normalizedPrompt.transformed,
        numImages:   1,
        callBackUrl: callbackUrl,
      };
      if (sourceImageUrl) payload.imageUrls = [sourceImageUrl];
    } else {
      endpointPath = EP.pro;
      const resolution = resolveProResolution(variant, input.quality ?? "cinematic");
      payload = {
        prompt:      input.normalizedPrompt.transformed,
        resolution,
        callBackUrl: callbackUrl,
      };
      if (input.aspectRatio) payload.aspectRatio = input.aspectRatio;
    }

    // ── Submit job ───────────────────────────────────────────────────────────
    console.log(`[nano-banana] submit variant=${variant} endpoint=${endpointPath}` +
      (payload.type ? ` type=${payload.type}` : ` resolution=${payload.resolution}`));

    let submitRes: Response;
    try {
      submitRes = await fetch(`${apiBase}${endpointPath}`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
        body:   JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "network error";
      console.error(`[nano-banana] submit network error variant=${variant}:`, msg);
      throw new Error("Could not reach the generation service. Please try again.");
    }

    let submitBody: Record<string, unknown>;
    try { submitBody = (await submitRes.json()) as Record<string, unknown>; }
    catch {
      if (!submitRes.ok) throw new Error(sanitizeError("non-json", submitRes.status));
      throw new Error("Unexpected response from generation service.");
    }

    if (!submitRes.ok) {
      const rawMsg = String(submitBody?.msg ?? submitBody?.message ?? submitBody?.error ?? "unknown");
      console.error(`[nano-banana] submit HTTP=${submitRes.status} variant=${variant}:`, rawMsg.slice(0, 200));
      throw new Error(sanitizeError(rawMsg, submitRes.status));
    }

    // ── Extract taskId ───────────────────────────────────────────────────────
    const data   = (submitBody?.data ?? {}) as Record<string, unknown>;
    const taskId = String(data?.taskId ?? data?.task_id ?? submitBody?.taskId ?? "");

    if (!taskId) {
      console.error("[nano-banana] no taskId in submit response:", JSON.stringify(submitBody).slice(0, 300));
      throw new Error("Generation accepted but no task ID returned. Please try again.");
    }

    console.log(`[nano-banana] task=${taskId} variant=${variant} submitted — returning pending`);

    // ── Return pending immediately (client will poll) ────────────────────────
    return {
      provider: "nano-banana",
      mode:     "image",
      status:   "pending",
      taskId,
      metadata: { variant, quality: input.quality, nbTaskId: taskId },
    };
  },

  // ── getStatus() — single NB API check, called by the status route ──────────
  async getStatus(taskId: string): Promise<import("../types").ProviderStatusResult> {
    const { apiKey, apiBase } = getEnvVars();

    if (!apiKey) {
      return { provider: "nano-banana", taskId, status: "error", error: "Provider not configured." };
    }

    try {
      const { taskStatus, imageUrl, errMsg } = await checkTaskOnce(taskId, apiBase, apiKey);

      if (taskStatus === TASK_STATUS.SUCCESS) {
        if (!imageUrl) {
          return { provider: "nano-banana", taskId, status: "error",
            error: "Generation completed but returned no image URL." };
        }
        console.log(`[nano-banana] getStatus task=${taskId} SUCCESS url=${imageUrl.slice(0, 80)}`);
        return { provider: "nano-banana", taskId, status: "success", url: imageUrl };
      }

      if (taskStatus === TASK_STATUS.CREATE_TASK_FAILED || taskStatus === TASK_STATUS.GENERATE_FAILED) {
        const reason = errMsg ?? "Generation failed";
        console.error(`[nano-banana] getStatus task=${taskId} FAILED status=${taskStatus}: ${reason}`);
        return { provider: "nano-banana", taskId, status: "error",
          error: sanitizeError(reason, 400) };
      }

      // 0 = still generating (or unknown)
      console.log(`[nano-banana] getStatus task=${taskId} status=${taskStatus} — still pending`);
      return { provider: "nano-banana", taskId, status: "pending" };

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Status check failed";
      console.error(`[nano-banana] getStatus task=${taskId} error:`, msg);
      return { provider: "nano-banana", taskId, status: "error", error: msg };
    }
  },
};
