/**
 * Kling Video Provider — Real async task-based video generation
 *
 * Authentication: JWT signed with HMAC-SHA256
 *   KLING_API_KEY format: "accessKeyId:accessKeySecret"
 *   If no colon, the value is used directly as a Bearer token.
 *
 * Base URL: KLING_BASE_URL (default: https://api.klingai.com)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *   POST /v1/videos/text2video          — submit Text-to-Video task
 *   POST /v1/videos/image2video         — submit Image-to-Video task
 *   GET  /v1/videos/text2video/{id}     — poll T2V status
 *   GET  /v1/videos/image2video/{id}    — poll I2V status
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TASK STATUS (from Kling API)
 * ─────────────────────────────────────────────────────────────────────────────
 *   submitted  → just received
 *   processing → generating
 *   succeed    → done — extract data.task_result.videos[0].url
 *   failed     → error — read data.task_status_msg
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODEL NAME MAP  (catalog ID → Kling API model_name)
 * ─────────────────────────────────────────────────────────────────────────────
 *   kling-25       → kling-v2-5
 *   kling-26       → kling-v2-6
 *   kling-30       → kling-v3
 *   kling-30-omni  → kling-v3  (same model, Omni=motion control mode)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODE ROUTING
 * ─────────────────────────────────────────────────────────────────────────────
 *   input.imageUrl present   → Image-to-Video  (/v1/videos/image2video)
 *   input.imageUrl absent    → Text-to-Video   (/v1/videos/text2video)
 *
 * Caller passes klingModel via input.metadata.klingModel (catalog model ID).
 * Duration via input.durationSeconds (5 or 10).
 * Aspect ratio via input.aspectRatio (16:9 | 9:16 | 1:1 only for T2V).
 */

import { createHmac } from "crypto";
import type { AiProvider, ProviderGenerateInput, ProviderGenerateResult } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://api.klingai.com";
const POLL_INTERVAL_MS = 5_000;    // 5 s between polls
const POLL_TIMEOUT_MS  = 270_000;  // 4.5 min — safely under Vercel maxDuration=300

const KLING_STATUS = {
  SUBMITTED:  "submitted",
  PROCESSING: "processing",
  SUCCEED:    "succeed",
  FAILED:     "failed",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MODEL MAP
// ─────────────────────────────────────────────────────────────────────────────

/** Maps catalog IDs → Kling API model_name strings */
const CATALOG_TO_API_MODEL: Record<string, string> = {
  "kling-25":      "kling-v2-5",
  "kling-26":      "kling-v2-6",
  "kling-30":      "kling-v3",
  "kling-30-omni": "kling-v3",
};

const DEFAULT_KLING_MODEL = "kling-v3";

// ─────────────────────────────────────────────────────────────────────────────
// JWT AUTH
// ─────────────────────────────────────────────────────────────────────────────

function base64urlEncode(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Creates a Kling-compatible JWT from the API key.
 *
 * KLING_API_KEY format:
 *   - "accessKeyId:accessKeySecret"  → creates a signed JWT (standard Kling format)
 *   - plain token (no colon)         → used directly as Bearer token
 */
function getAuthToken(apiKey: string): string {
  const colonIdx = apiKey.indexOf(":");
  if (colonIdx === -1) return apiKey; // plain bearer token

  const id     = apiKey.slice(0, colonIdx);
  const secret = apiKey.slice(colonIdx + 1);
  const now    = Math.floor(Date.now() / 1000);

  const header  = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify({
    iss: id,
    exp: now + 1800, // 30 min validity
    nbf: now - 5,    // allow 5 s clock skew
  }));

  const sig = base64urlEncode(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest()
  );

  return `${header}.${payload}.${sig}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeError(raw: string, httpStatus: number): string {
  if (httpStatus === 401 || httpStatus === 403)
    return "Authentication error with Kling API. Please contact support.";
  if (httpStatus === 429)
    return "Kling rate limit reached — please wait a moment and try again.";
  if (httpStatus >= 500)
    return "The Kling service is temporarily unavailable. Please try again.";
  const lower = raw.toLowerCase();
  if (lower.includes("credit") || lower.includes("quota") || lower.includes("insufficient"))
    return "Insufficient Kling API credits. Please top up your Kling account.";
  if (lower.includes("content") || lower.includes("policy") || lower.includes("sensitive"))
    return "Content policy violation. Please revise your prompt.";
  if (lower.includes("model"))
    return "The selected Kling model is temporarily unavailable. Try Kling 3.0.";
  return "Video generation failed. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────────────────────

async function pollUntilDone(
  taskId:      string,
  statusPath:  string,
  apiBase:     string,
  token:       string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let res: Response;
    try {
      res = await fetch(`${apiBase}${statusPath}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept:        "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.warn(
        `[kling] poll attempt=${attempt} task=${taskId} network error:`,
        err instanceof Error ? err.message : String(err),
      );
      continue;
    }

    if (!res.ok) {
      console.warn(`[kling] poll attempt=${attempt} task=${taskId} HTTP ${res.status}`);
      if (res.status === 404) throw new Error("Kling task not found. Please try again.");
      continue;
    }

    let body: Record<string, unknown>;
    try { body = (await res.json()) as Record<string, unknown>; }
    catch {
      console.warn(`[kling] poll attempt=${attempt} task=${taskId} non-JSON response`);
      continue;
    }

    const data       = (body.data ?? body) as Record<string, unknown>;
    const taskStatus = String(data.task_status ?? "");

    if (taskStatus === KLING_STATUS.SUCCEED) {
      console.log(`[kling] task=${taskId} SUCCEED after ${attempt} polls`);
      return data;
    }

    if (taskStatus === KLING_STATUS.FAILED) {
      const reason = String(data.task_status_msg ?? "generation failed");
      console.error(`[kling] task=${taskId} FAILED: ${reason.slice(0, 200)}`);
      throw new Error(sanitizeError(reason, 400));
    }

    // submitted / processing / unknown — keep polling
    console.log(`[kling] task=${taskId} status=${taskStatus} attempt=${attempt} — waiting`);
  }

  throw new Error("Video generation timed out after 4.5 minutes. Please try again or use a shorter duration.");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const klingProvider: AiProvider = {
  name:           "kling",
  supportedModes: ["video"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    // ── 1. Env vars ──────────────────────────────────────────────────────────
    const apiKey  = process.env.KLING_API_KEY;
    const apiBase = (process.env.KLING_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

    if (!apiKey) {
      throw Object.assign(
        new Error("Kling video generation is not available right now. Please try again later."),
        { code: "PROVIDER_NOT_CONFIGURED" },
      );
    }

    const token = getAuthToken(apiKey);

    // ── 2. Resolve model and mode ────────────────────────────────────────────
    const catalogModelId = String(input.metadata?.klingModel ?? "kling-30");
    const apiModel       = CATALOG_TO_API_MODEL[catalogModelId] ?? DEFAULT_KLING_MODEL;
    const isImageToVideo = !!(input.imageUrl);

    // Duration: Kling accepts "5" or "10" as strings
    const rawDuration    = input.durationSeconds ?? 5;
    const duration       = rawDuration >= 10 ? "10" : "5";

    console.log(
      `[kling] generating: mode=${isImageToVideo ? "i2v" : "t2v"}` +
      ` model=${apiModel} duration=${duration}s` +
      ` ar=${input.aspectRatio ?? "16:9"}`,
    );

    // ── 3. Build payload ─────────────────────────────────────────────────────
    let submitPath:       string;
    let statusPathPrefix: string;
    let payload:          Record<string, unknown>;

    if (isImageToVideo) {
      submitPath       = "/v1/videos/image2video";
      statusPathPrefix = "/v1/videos/image2video";

      payload = {
        model_name:      apiModel,
        image:           input.imageUrl,
        prompt:          input.normalizedPrompt.transformed,
        negative_prompt: input.normalizedPrompt.negativePrompt ?? "",
        cfg_scale:       0.5,
        mode:            "std",
        duration,
      };

    } else {
      // Text-to-video — aspect ratio only applies here
      submitPath       = "/v1/videos/text2video";
      statusPathPrefix = "/v1/videos/text2video";

      const ar = input.aspectRatio;
      const aspectRatio =
        ar === "16:9" || ar === "9:16" || ar === "1:1" ? ar : "16:9";

      payload = {
        model_name:      apiModel,
        prompt:          input.normalizedPrompt.transformed,
        negative_prompt: input.normalizedPrompt.negativePrompt ?? "",
        cfg_scale:       0.5,
        mode:            "std",
        aspect_ratio:    aspectRatio,
        duration,
      };
    }

    // ── 4. Submit task ───────────────────────────────────────────────────────
    let submitRes: Response;
    try {
      submitRes = await fetch(`${apiBase}${submitPath}`, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        body:   JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new Error(
        `Failed to reach Kling API: ${err instanceof Error ? err.message : "network error"}`
      );
    }

    let submitBody: Record<string, unknown>;
    try { submitBody = (await submitRes.json()) as Record<string, unknown>; }
    catch { throw new Error("Kling API returned an unreadable response. Please try again."); }

    if (!submitRes.ok || Number(submitBody.code) !== 0) {
      const errMsg = String(submitBody.message ?? submitBody.error ?? "submission failed");
      console.error(`[kling] submit failed HTTP ${submitRes.status}:`, errMsg.slice(0, 200));
      throw new Error(sanitizeError(errMsg, submitRes.status));
    }

    const taskData = (submitBody.data ?? {}) as Record<string, unknown>;
    const taskId   = String(taskData.task_id ?? "");

    if (!taskId) {
      throw new Error("Kling did not return a task ID. Please try again.");
    }

    console.log(`[kling] task submitted: id=${taskId} model=${apiModel}`);

    // ── 5. Poll until done ───────────────────────────────────────────────────
    const resultData = await pollUntilDone(
      taskId,
      `${statusPathPrefix}/${taskId}`,
      apiBase,
      token,
    );

    // ── 6. Extract video URL ─────────────────────────────────────────────────
    const taskResult = (resultData.task_result ?? {}) as Record<string, unknown>;
    const videos     = (taskResult.videos ?? []) as Array<Record<string, unknown>>;
    const videoUrl   = String(videos[0]?.url ?? "");

    if (!videoUrl) {
      throw new Error("Kling returned success but did not include a video URL.");
    }

    return {
      provider: "kling",
      mode:     "video",
      status:   "success",
      url:      videoUrl,
      metadata: {
        taskId,
        klingModel:    apiModel,
        catalogModel:  catalogModelId,
        durationUsed:  Number(duration),
        isImageToVideo,
      },
    };
  },
};
