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
// POLLING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3_000;    // 3 s between polls
const POLL_TIMEOUT_MS  = 120_000;  // give up after 2 min

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

/**
 * Poll record-info?taskId= until terminal state.
 *
 * taskStatus codes (confirmed from docs):
 *   0 = GENERATING   (keep polling)
 *   1 = SUCCESS      (extract imageUrl)
 *   2 = CREATE_TASK_FAILED
 *   3 = GENERATE_FAILED
 */
async function pollUntilDone(
  taskId:  string,
  apiBase: string,
  apiKey:  string,
  variant: NbVariant,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt    = 0;

  while (Date.now() < deadline) {
    attempt++;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await fetch(`${apiBase}${EP.task}?taskId=${encodeURIComponent(taskId)}`, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
        signal:  AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.warn(`[nano-banana] poll attempt=${attempt} task=${taskId} network:`,
        err instanceof Error ? err.message : String(err));
      continue;
    }

    if (!pollRes.ok) {
      console.warn(`[nano-banana] poll attempt=${attempt} task=${taskId} HTTP ${pollRes.status}`);
      if (pollRes.status === 404) throw new Error("Generation task not found. Please try again.");
      continue;
    }

    let body: Record<string, unknown>;
    try { body = (await pollRes.json()) as Record<string, unknown>; }
    catch { console.warn(`[nano-banana] poll non-JSON attempt=${attempt} task=${taskId}`); continue; }

    // taskStatus lives inside body.data
    const data       = (body.data ?? body) as Record<string, unknown>;
    const taskStatus = Number(data.taskStatus ?? data.status ?? -1);

    if (taskStatus === TASK_STATUS.SUCCESS) {
      console.log(`[nano-banana] task=${taskId} variant=${variant} SUCCESS after ${attempt} polls`);
      return data;
    }
    if (taskStatus === TASK_STATUS.CREATE_TASK_FAILED || taskStatus === TASK_STATUS.GENERATE_FAILED) {
      const reason = String(data.errMsg ?? data.message ?? data.error ?? "task failed");
      console.error(`[nano-banana] task=${taskId} variant=${variant} FAILED status=${taskStatus}: ${reason.slice(0, 200)}`);
      throw new Error(sanitizeError(reason, 400));
    }

    // status 0 = still generating; anything unrecognised → keep polling
    console.log(`[nano-banana] task=${taskId} status=${taskStatus} attempt=${attempt} — waiting`);
  }

  throw new Error("Generation timed out after 2 minutes. Please try again.");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const nanoBananaProvider: AiProvider = {
  name:           "nano-banana",
  supportedModes: ["image"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const startTime = Date.now();

    // ── 1. Env vars ──────────────────────────────────────────────────────────
    const apiKey      = process.env.NANO_BANANA_API_KEY;
    // Base URL is a known constant — env var is optional override only
    const apiBase     = process.env.NANO_BANANA_API_BASE_URL
                     ?? process.env.NANO_BANANA_API_URL   // legacy alias
                     ?? "https://api.nanobananaapi.ai";
    const callbackUrl = process.env.NANO_BANANA_CALLBACK_URL
                     ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://zencralabs.com"}/api/nb-callback`;

    if (!apiKey) {
      throw Object.assign(
        new Error("Nano Banana is not available right now. Please try another model."),
        { code: "PROVIDER_NOT_CONFIGURED" }
      );
    }

    // ── 2. Variant config ────────────────────────────────────────────────────
    const variant = (input.metadata?.nbVariant as NbVariant | undefined) ?? "standard";
    const cfg     = NB_MODEL_CONFIG[variant];

    if (!cfg?.enabled) throw new Error(`Nano Banana variant "${variant}" is not available.`);

    // NB2 guard — must never route here
    if (String(variant).includes("2")) throw new Error("Unsupported generation variant.");

    // ── 3. Input validation ──────────────────────────────────────────────────
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

    // ── 4. Build payload ─────────────────────────────────────────────────────
    let endpointPath: string;
    let payload: Record<string, unknown>;

    if (cfg.endpoint === "standard") {
      endpointPath = EP.standard;
      payload = {
        type:        cfg.requestType!,   // "TEXTTOIAMGE" or "IMAGETOIAMGE"
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

    // ── 5. Submit job ────────────────────────────────────────────────────────
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
      if (msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("timeout")) {
        throw new Error("Could not reach the generation service. Please try again.");
      }
      throw new Error("Could not reach the generation service. Check your connection.");
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

    // ── 6. Extract taskId — lives at body.data.taskId ────────────────────────
    const data   = (submitBody?.data ?? {}) as Record<string, unknown>;
    const taskId = String(data?.taskId ?? data?.task_id ?? submitBody?.taskId ?? "");

    if (!taskId) {
      console.error("[nano-banana] no taskId in submit response:", JSON.stringify(submitBody).slice(0, 300));
      throw new Error("Generation accepted but no task ID returned. Please try again.");
    }

    console.log(`[nano-banana] task=${taskId} variant=${variant} polling...`);

    // ── 7. Poll until done ───────────────────────────────────────────────────
    const taskData = await pollUntilDone(taskId, apiBase, apiKey, variant);

    // ── 8. Extract image URL — field is `imageUrl` (singular) ────────────────
    const imageUrl = String(
      taskData.imageUrl  ??
      taskData.image_url ??
      (Array.isArray(taskData.imageUrls) ? taskData.imageUrls[0] : undefined) ??
      ""
    );

    if (!imageUrl) {
      console.error(`[nano-banana] task=${taskId} completed but no imageUrl:`,
        JSON.stringify(taskData).slice(0, 400));
      throw new Error("Generation completed but no image was returned. Please try again.");
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[nano-banana] task=${taskId} variant=${variant} done latency=${latencyMs}ms`);

    // ── 9. Return ────────────────────────────────────────────────────────────
    return {
      provider: "nano-banana",
      mode:     "image",
      status:   "success",
      url:      imageUrl,
      metadata: {
        variant,
        quality:  input.quality,
        latencyMs,
        taskId,
      },
    };
  },
};
