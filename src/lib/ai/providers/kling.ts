/**
 * Kling Video Provider — Full operation support
 *
 * Authentication: JWT signed with HMAC-SHA256
 *   KLING_API_KEY format: "accessKeyId:accessKeySecret"
 *   If no colon, used directly as a Bearer token.
 *
 * Base URL: KLING_BASE_URL (default: https://api.klingai.com)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPPORTED OPERATIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  text_to_video     POST /v1/videos/text2video
 *  image_to_video    POST /v1/videos/image2video       (start frame only)
 *  start_frame       POST /v1/videos/image2video       (start frame only)
 *  start_end_frame   POST /v1/videos/image2video       (image + image_tail)
 *  extend_video      POST /v1/videos/video-extend/create
 *  lip_sync          POST /v1/videos/lip-sync/create
 *
 *  Poll T2V:         GET  /v1/videos/text2video/{id}
 *  Poll I2V:         GET  /v1/videos/image2video/{id}
 *  Poll Extend:      GET  /v1/videos/video-extend/{id}
 *  Poll LipSync:     GET  /v1/videos/lip-sync/{id}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TASK STATUS
 * ─────────────────────────────────────────────────────────────────────────────
 *   submitted  → received
 *   processing → generating
 *   succeed    → done, extract data.task_result.videos[0].url
 *   failed     → error, read data.task_status_msg
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODEL MAP
 * ─────────────────────────────────────────────────────────────────────────────
 *   kling-25      → kling-v2-5
 *   kling-26      → kling-v2-6
 *   kling-30      → kling-v3
 */

import { createHmac } from "crypto";
import type {
  AiProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL   = "https://api.klingai.com";
const POLL_INTERVAL_MS   = 5_000;
const POLL_TIMEOUT_MS    = 270_000; // 4.5 min — safely under Vercel maxDuration=300

const KLING_STATUS = {
  SUBMITTED:  "submitted",
  PROCESSING: "processing",
  SUCCEED:    "succeed",
  FAILED:     "failed",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MODEL MAP
// ─────────────────────────────────────────────────────────────────────────────

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

function getAuthToken(apiKey: string): string {
  const colonIdx = apiKey.indexOf(":");
  if (colonIdx === -1) return apiKey; // plain bearer token

  const id     = apiKey.slice(0, colonIdx);
  const secret = apiKey.slice(colonIdx + 1);
  const now    = Math.floor(Date.now() / 1000);

  const header  = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify({
    iss: id,
    exp: now + 1800,
    nbf: now - 5,
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
    return "The selected model is temporarily unavailable. Try a different model.";
  if (lower.includes("video") && lower.includes("not found"))
    return "Source video not found. Please check your video selection.";
  return "Generation failed. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────────────────────

async function pollUntilDone(
  taskId:     string,
  statusPath: string,
  apiBase:    string,
  token:      string,
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

    console.log(`[kling] task=${taskId} status=${taskStatus} attempt=${attempt}`);
  }

  throw new Error("Video generation timed out after 4.5 minutes. Please try again.");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT + POLL HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function submitAndPoll(opts: {
  apiBase:      string;
  token:        string;
  submitPath:   string;
  statusPath:   string;
  payload:      Record<string, unknown>;
  operationTag: string;
}): Promise<Record<string, unknown>> {
  const { apiBase, token, submitPath, statusPath, payload, operationTag } = opts;

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
      `Failed to reach Kling API (${operationTag}): ${err instanceof Error ? err.message : "network error"}`
    );
  }

  let submitBody: Record<string, unknown>;
  try { submitBody = (await submitRes.json()) as Record<string, unknown>; }
  catch { throw new Error("Kling API returned an unreadable response. Please try again."); }

  if (!submitRes.ok || Number(submitBody.code) !== 0) {
    const errMsg = String(submitBody.message ?? submitBody.error ?? "submission failed");
    console.error(`[kling] ${operationTag} submit failed HTTP ${submitRes.status}:`, errMsg.slice(0, 200));
    throw new Error(sanitizeError(errMsg, submitRes.status));
  }

  const taskData = (submitBody.data ?? {}) as Record<string, unknown>;
  const taskId   = String(taskData.task_id ?? "");

  if (!taskId) throw new Error("Kling did not return a task ID. Please try again.");

  console.log(`[kling] ${operationTag} task submitted: id=${taskId}`);

  return await pollUntilDone(taskId, `${statusPath}/${taskId}`, apiBase, token);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT VIDEO URL FROM RESULT
// ─────────────────────────────────────────────────────────────────────────────

function extractVideoUrl(resultData: Record<string, unknown>): string {
  const taskResult = (resultData.task_result ?? {}) as Record<string, unknown>;
  const videos     = (taskResult.videos ?? []) as Array<Record<string, unknown>>;
  return String(videos[0]?.url ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA CONTROL BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildCameraControl(
  input: ProviderGenerateInput,
): Record<string, unknown> | undefined {
  const cc = input.cameraControl;
  if (!cc) return undefined;

  if (cc.type === "simple" && cc.config) {
    return {
      camera_control: {
        type:   "simple",
        config: cc.config,
      },
    };
  }

  // Preset types (down_back, forward_up, etc.) — no config needed
  return { camera_control: { type: cc.type } };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION: TEXT TO VIDEO
// ─────────────────────────────────────────────────────────────────────────────

async function generateTextToVideo(
  input:    ProviderGenerateInput,
  apiBase:  string,
  token:    string,
  apiModel: string,
): Promise<ProviderGenerateResult> {
  const duration    = (input.durationSeconds ?? 5) >= 10 ? "10" : "5";
  const ar          = input.aspectRatio;
  const aspectRatio = (ar === "16:9" || ar === "9:16" || ar === "1:1") ? ar : "16:9";
  const mode        = input.videoMode ?? "std";

  const payload: Record<string, unknown> = {
    model_name:      apiModel,
    prompt:          input.normalizedPrompt.transformed,
    negative_prompt: input.normalizedPrompt.negativePrompt ?? "",
    cfg_scale:       0.5,
    mode,
    aspect_ratio:    aspectRatio,
    duration,
    ...buildCameraControl(input),
  };

  console.log(`[kling] T2V: model=${apiModel} duration=${duration}s ar=${aspectRatio} mode=${mode}`);

  const resultData = await submitAndPoll({
    apiBase,
    token,
    submitPath:   "/v1/videos/text2video",
    statusPath:   "/v1/videos/text2video",
    payload,
    operationTag: "T2V",
  });

  const videoUrl = extractVideoUrl(resultData);
  if (!videoUrl) throw new Error("Kling returned success but did not include a video URL.");

  return {
    provider: "kling",
    mode:     "video",
    status:   "success",
    url:      videoUrl,
    metadata: {
      taskId:       String((resultData as Record<string,unknown>).task_id ?? ""),
      klingModel:   apiModel,
      durationUsed: Number(duration),
      aspectRatio,
      operation:    "text_to_video",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION: IMAGE TO VIDEO (start frame / start+end frame)
// ─────────────────────────────────────────────────────────────────────────────

async function generateImageToVideo(
  input:    ProviderGenerateInput,
  apiBase:  string,
  token:    string,
  apiModel: string,
): Promise<ProviderGenerateResult> {
  if (!input.imageUrl) {
    throw new Error("A start frame image is required for Image-to-Video generation.");
  }

  const duration   = (input.durationSeconds ?? 5) >= 10 ? "10" : "5";
  const mode       = input.videoMode ?? "std";
  const hasEndFrame = !!(input.endImageUrl);
  const operation  = hasEndFrame ? "start_end_frame" : "image_to_video";

  const payload: Record<string, unknown> = {
    model_name:      apiModel,
    image:           input.imageUrl,
    prompt:          input.normalizedPrompt.transformed,
    negative_prompt: input.normalizedPrompt.negativePrompt ?? "",
    cfg_scale:       0.5,
    mode,
    duration,
    ...buildCameraControl(input),
  };

  if (hasEndFrame) {
    payload.image_tail = input.endImageUrl;
  }

  console.log(
    `[kling] I2V: model=${apiModel} duration=${duration}s mode=${mode}` +
    ` endFrame=${hasEndFrame} camera=${!!input.cameraControl}`
  );

  const resultData = await submitAndPoll({
    apiBase,
    token,
    submitPath:   "/v1/videos/image2video",
    statusPath:   "/v1/videos/image2video",
    payload,
    operationTag: hasEndFrame ? "I2V+EndFrame" : "I2V",
  });

  const videoUrl = extractVideoUrl(resultData);
  if (!videoUrl) throw new Error("Kling returned success but did not include a video URL.");

  return {
    provider: "kling",
    mode:     "video",
    status:   "success",
    url:      videoUrl,
    metadata: {
      taskId:       String((resultData as Record<string,unknown>).task_id ?? ""),
      klingModel:   apiModel,
      durationUsed: Number(duration),
      operation,
      hasEndFrame,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION: VIDEO EXTENSION
// ─────────────────────────────────────────────────────────────────────────────

async function generateVideoExtend(
  input:    ProviderGenerateInput,
  apiBase:  string,
  token:    string,
  apiModel: string,
): Promise<ProviderGenerateResult> {
  const videoId  = String(input.metadata?.klingTaskId ?? input.sourceVideoId ?? "");
  const videoUrl = input.sourceVideoUrl ?? "";

  if (!videoId && !videoUrl) {
    throw new Error("A source video is required for Video Extension. Please select an existing video.");
  }

  const duration = (input.durationSeconds ?? 5) >= 10 ? "10" : "5";

  const payload: Record<string, unknown> = {
    model_name: apiModel,
    duration,
  };
  if (videoId)  payload.video_id  = videoId;
  if (videoUrl) payload.video_url = videoUrl;
  if (input.normalizedPrompt.transformed) {
    payload.prompt = input.normalizedPrompt.transformed;
  }

  console.log(`[kling] Extend: model=${apiModel} videoId=${videoId || "(url)"} duration=${duration}s`);

  const resultData = await submitAndPoll({
    apiBase,
    token,
    submitPath:   "/v1/videos/video-extend/create",
    statusPath:   "/v1/videos/video-extend",
    payload,
    operationTag: "Extend",
  });

  const videoOutUrl = extractVideoUrl(resultData);
  if (!videoOutUrl) throw new Error("Kling returned success but did not include a video URL.");

  return {
    provider: "kling",
    mode:     "video",
    status:   "success",
    url:      videoOutUrl,
    metadata: {
      taskId:      String((resultData as Record<string,unknown>).task_id ?? ""),
      klingModel:  apiModel,
      operation:   "extend_video",
      sourceVideoId: videoId || undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION: LIP SYNC
// ─────────────────────────────────────────────────────────────────────────────

async function generateLipSync(
  input:    ProviderGenerateInput,
  apiBase:  string,
  token:    string,
  apiModel: string,
): Promise<ProviderGenerateResult> {
  const videoId  = String(input.metadata?.klingTaskId ?? input.sourceVideoId ?? "");
  const videoUrl = input.sourceVideoUrl ?? "";

  if (!videoId && !videoUrl) {
    throw new Error("A source video with a visible face is required for Lip Sync.");
  }

  const audioType = input.audioUrl ? "audio_upload" : "ai_tts";

  const audioPayload: Record<string, unknown> = { type: audioType };
  if (audioType === "audio_upload" && input.audioUrl) {
    audioPayload.audio_url = input.audioUrl;
  } else if (audioType === "ai_tts") {
    if (input.voiceId) audioPayload.voice_id = input.voiceId;
    if (input.normalizedPrompt.transformed) {
      audioPayload.voice_text = input.normalizedPrompt.transformed;
    }
  }

  const inputPayload: Record<string, unknown> = {};
  if (videoId)  inputPayload.video_id  = videoId;
  if (videoUrl) inputPayload.video_url = videoUrl;

  const payload: Record<string, unknown> = {
    model_name: apiModel,
    input:      inputPayload,
    audio:      audioPayload,
  };

  console.log(`[kling] LipSync: model=${apiModel} videoId=${videoId || "(url)"} audioType=${audioType}`);

  const resultData = await submitAndPoll({
    apiBase,
    token,
    submitPath:   "/v1/videos/lip-sync/create",
    statusPath:   "/v1/videos/lip-sync",
    payload,
    operationTag: "LipSync",
  });

  const videoOutUrl = extractVideoUrl(resultData);
  if (!videoOutUrl) throw new Error("Kling returned success but did not include a video URL.");

  return {
    provider: "kling",
    mode:     "video",
    status:   "success",
    url:      videoOutUrl,
    metadata: {
      taskId:     String((resultData as Record<string,unknown>).task_id ?? ""),
      klingModel: apiModel,
      operation:  "lip_sync",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION ROUTER
// ─────────────────────────────────────────────────────────────────────────────

function resolveOperation(input: ProviderGenerateInput): string {
  // Explicit override from caller
  if (input.operationType) return input.operationType;

  // Infer from inputs
  if (input.sourceVideoId || input.sourceVideoUrl) {
    const meta = input.metadata ?? {};
    if (meta.operation === "lip_sync") return "lip_sync";
    return "extend_video";
  }
  if (input.imageUrl) return "image_to_video";
  return "text_to_video";
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const klingProvider: AiProvider = {
  name:           "kling",
  supportedModes: ["video"],

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    // 1. Env vars
    const apiKey  = process.env.KLING_API_KEY;
    const apiBase = (process.env.KLING_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

    if (!apiKey) {
      throw Object.assign(
        new Error("Kling video generation is not available right now. Please try again later."),
        { code: "PROVIDER_NOT_CONFIGURED" },
      );
    }

    const token = getAuthToken(apiKey);

    // 2. Resolve model
    const catalogModelId = String(input.metadata?.klingModel ?? "kling-30");
    const apiModel       = CATALOG_TO_API_MODEL[catalogModelId] ?? DEFAULT_KLING_MODEL;

    // 3. Route to correct operation
    const operation = resolveOperation(input);

    switch (operation) {
      case "text_to_video":
        return generateTextToVideo(input, apiBase, token, apiModel);

      case "image_to_video":
      case "start_frame":
      case "start_end_frame":
        return generateImageToVideo(input, apiBase, token, apiModel);

      case "extend_video":
        return generateVideoExtend(input, apiBase, token, apiModel);

      case "lip_sync":
        return generateLipSync(input, apiBase, token, apiModel);

      default:
        // Fallback to T2V
        console.warn(`[kling] unknown operation="${operation}", falling back to T2V`);
        return generateTextToVideo(input, apiBase, token, apiModel);
    }
  },
};
