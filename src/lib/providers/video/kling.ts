/**
 * Video Studio — Kling AI Provider
 *
 * Three distinct model entries — each registered separately:
 *
 *   kling-30-omni         → Kling Video 3.0 Omni  (apiModelId: kling-v3-omni)
 *   kling-30              → Kling Video 3.0        (apiModelId: kling-v3)
 *   kling-motion-control  → Kling Motion Control   (apiModelId: kling-v3, endpoint path distinguishes operation)
 *
 * Deprecated (kept in backend, hidden from UI):
 *   kling-26 → kling-v2-6 (no new adapter; handled by legacy /lib/ai/providers/kling.ts)
 *   kling-25 → kling-v2-5 (no new adapter; handled by legacy /lib/ai/providers/kling.ts)
 *
 * Async: polling + webhook
 * Auth: KLING_API_KEY (format: "accessKeyId:accessKeySecret" → JWT signed HS256)
 * Env: KLING_API_KEY, KLING_BASE_URL
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getKlingEnv, KLING_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// KLING AUTH — JWT signing for API key format "accessKeyId:accessKeySecret"
// ─────────────────────────────────────────────────────────────────────────────

async function buildKlingAuthHeader(): Promise<string> {
  const { apiKey } = getKlingEnv();

  // If key is already a Bearer token (no colon), use directly
  if (!apiKey.includes(":")) return `Bearer ${apiKey}`;

  // Otherwise generate a JWT (HS256) from "accessKeyId:accessKeySecret"
  const [accessKeyId, accessKeySecret] = apiKey.split(":");

  const header  = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now     = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: accessKeyId, exp: now + 1800, nbf: now - 5 })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const encoder    = new TextEncoder();
  const keyData    = encoder.encode(accessKeySecret);
  const data       = encoder.encode(`${header}.${payload}`);
  const cryptoKey  = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature  = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const sigB64     = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `Bearer ${header}.${payload}.${sigB64}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KLING PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

type KlingModelEntry = {
  modelKey:    string;
  displayName: string;
  apiModelId:  string;
  isMotionControl: boolean;
};

// Official Kling AI display names — as branded by Kuaishou.
// apiModelId matches the exact model string sent to api.klingai.com.
const KLING_MODELS: KlingModelEntry[] = [
  { modelKey: "kling-30-omni",        displayName: "Kling Video 3.0 Omni",  apiModelId: KLING_MODEL_IDS.omni,          isMotionControl: false },
  { modelKey: "kling-30",             displayName: "Kling Video 3.0",        apiModelId: KLING_MODEL_IDS.v30,           isMotionControl: false },
  { modelKey: "kling-motion-control", displayName: "Kling Motion Control",   apiModelId: KLING_MODEL_IDS.motionControl, isMotionControl: true  },
];

function buildKlingProvider(entry: KlingModelEntry): ZProvider {
  const { modelKey, displayName, apiModelId, isMotionControl } = entry;

  return {
    providerId:  "kling",
    modelKey,
    studio:      "video",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      // Capability maps confirmed from official Kling API docs (2026-04-27).
      //
      // kling-v3 (motion control):
      //   image + video input only; std/pro modes; 5–10s durations
      //
      // kling-v3 (standard):
      //   text + image to video; start/end frame; element control; multi-shot;
      //   motion control in std/pro (NOT 4k); duration 3–15s
      //
      // kling-v3-omni:
      //   same as kling-v3 EXCEPT: no motion control at all;
      //   reference video (std/pro, 3–10s only, blocked in 4k)
      if (isMotionControl) {
        return {
          supportedInputModes:   ["image", "video"],
          supportedAspectRatios: ["16:9", "9:16", "1:1"],
          supportedDurations:    [5, 10],
          maxDuration:           10,
          capabilities:          ["image_to_video", "motion_control"],
          asyncMode:             "polling+webhook",
          supportsWebhook:       true,
          supportsPolling:       true,
        };
      }
      if (modelKey === "kling-30-omni") {
        return {
          supportedInputModes:   ["text", "image"],
          supportedAspectRatios: ["16:9", "9:16", "1:1"],
          supportedDurations:    [5, 10],
          maxDuration:           15,
          capabilities:          [
            "text_to_video", "image_to_video", "start_frame", "end_frame",
            "multi_shot", "element_control", "reference_video", "cinematic",
            // motion_control intentionally absent for omni
          ],
          asyncMode:       "polling+webhook",
          supportsWebhook: true,
          supportsPolling: true,
        };
      }
      // kling-v3 standard
      return {
        supportedInputModes:   ["text", "image"],
        supportedAspectRatios: ["16:9", "9:16", "1:1"],
        supportedDurations:    [5, 10],
        maxDuration:           15,
        capabilities:          [
          "text_to_video", "image_to_video", "start_frame", "end_frame",
          "multi_shot", "element_control", "motion_control", "cinematic",
        ],
        asyncMode:       "polling+webhook",
        supportsWebhook: true,
        supportsPolling: true,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      const mode = (input.providerParams?.videoMode as string | undefined) ?? "std";

      if (!input.prompt || input.prompt.trim().length < 3) {
        errors.push("Prompt is required.");
      }

      // ── Motion Control rules (kling-v3 only, std/pro only) ──────────────────
      if (isMotionControl) {
        if (!input.imageUrl) {
          errors.push("Kling Motion Control requires a subject image (imageUrl).");
        }
        if (!input.referenceVideoUrl) {
          errors.push("Kling Motion Control requires a reference motion video (referenceVideoUrl).");
        }
      }

      // ── Motion Control blocked on omni entirely ──────────────────────────────
      if (!isMotionControl && modelKey === "kling-30-omni" && input.referenceVideoUrl) {
        errors.push("Motion Control is not supported on Kling 3.0 Omni. Use Kling 3.0 Standard.");
      }

      // ── Motion Control blocked in 4k mode (kling-v3 standard) ───────────────
      if (!isMotionControl && modelKey === "kling-30" && mode === "4k" && input.referenceVideoUrl) {
        errors.push("Motion Control is not available in 4K mode. Use Standard or Pro.");
      }

      // ── Omni reference video: std/pro only, 3–10s max ───────────────────────
      if (modelKey === "kling-30-omni" && input.referenceVideoUrl) {
        if (mode === "4k") {
          errors.push("Reference video is not supported in 4K mode on Kling 3.0 Omni.");
        }
        const duration = input.durationSeconds ?? 5;
        if (duration > 10) {
          errors.push("Reference video on Kling 3.0 Omni supports a maximum of 10 seconds.");
        }
      }

      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(input: ZProviderInput): CreditEstimate {
      const duration     = input.durationSeconds ?? 5;
      const base         = 10;
      const durationCost = duration > 5 ? Math.ceil((duration - 5) / 5) * 3 : 0;
      const motionExtra  = isMotionControl ? 5 : 0;
      const omniExtra    = modelKey === "kling-30-omni" ? 2 : 0;
      const expected     = base + durationCost + motionExtra + omniExtra;
      return {
        min:       10,
        max:       22,
        expected,
        breakdown: { base, duration: durationCost, motion_control: motionExtra, omni: omniExtra },
      };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { baseUrl } = getKlingEnv();
      const authHeader  = await buildKlingAuthHeader();
      const jobId       = newJobId();
      const duration    = input.durationSeconds ?? 5;
      const aspect      = klingAspect(input.aspectRatio ?? "16:9");

      let endpoint: string;
      let payload: Record<string, unknown>;

      // Scene Audio — native cinematic ambience.
      // Forwarded from providerParams.nativeAudio (set by VideoStudioShell when audioMode === "scene").
      // Kling API field: sound_generation (bool). Not supported on Motion Control mode.
      // Note: requires "Sound Generation" resource pack enabled in the Kling console.
      const enableSoundGeneration = !isMotionControl && input.providerParams?.nativeAudio === true;
      console.log("[kling] nativeAudio requested:", enableSoundGeneration, "| isMotionControl:", isMotionControl, "| raw providerParams.nativeAudio:", input.providerParams?.nativeAudio);

      if (isMotionControl) {
        // Motion Control: image + reference video
        // sound_generation intentionally omitted — not supported in motion control mode.
        endpoint = "/v1/videos/image2video";
        payload  = {
          model_name:           apiModelId,
          prompt:               input.prompt,
          image:                input.imageUrl,
          motion_video_url:     input.referenceVideoUrl,
          duration:             String(duration),
          aspect_ratio:         aspect,
          mode:                 "std",
        };
      } else if (input.imageUrl) {
        // Image-to-video (start frame + optional end frame)
        endpoint = "/v1/videos/image2video";
        payload  = {
          model_name:   apiModelId,
          prompt:       input.prompt,
          image:        input.imageUrl,
          duration:     String(duration),
          aspect_ratio: aspect,
          mode:         (input.providerParams?.videoMode as string) ?? "std",
          ...(input.endImageUrl ? { tail_image: input.endImageUrl } : {}),
          ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
          ...(enableSoundGeneration ? { sound_generation: true } : {}),
        };
      } else {
        // Text-to-video
        endpoint = "/v1/videos/text2video";
        payload  = {
          model_name:   apiModelId,
          prompt:       input.prompt,
          duration:     String(duration),
          aspect_ratio: aspect,
          mode:         (input.providerParams?.videoMode as string) ?? "std",
          ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
          ...(enableSoundGeneration ? { sound_generation: true } : {}),
        };
      }

      console.log("[kling] dispatching to", endpoint, "| sound_generation in payload:", "sound_generation" in payload, "| model:", apiModelId);
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method:  "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        console.error(`[kling] dispatch HTTP ${res.status} — raw:`, sanitize(err));
        throw new Error(`Kling API HTTP ${res.status}: ${sanitize(err)}`);
      }

      const rawText = await res.text();
      const body      = JSON.parse(rawText) as Record<string, unknown>;
      const taskId    = extractKlingTaskId(body);
      if (!taskId) throw new Error("Kling returned no task ID.");

      // Encode the dispatch endpoint type so getJobStatus uses the matching
      // status URL. Kling Singapore has no generic /tasks/ endpoint — each
      // operation type has its own status path:
      //   text2video → GET /v1/videos/text2video/{taskId}
      //   image2video → GET /v1/videos/image2video/{taskId}
      const endpointType = endpoint.includes("image2video") ? "i2v" : "t2v";
      const compoundId   = `${endpointType}|${taskId}`;

      const now = new Date();
      return {
        id: jobId, provider: "kling", modelKey,
        studioType: "video", status: "pending", externalJobId: compoundId,
        createdAt: now, updatedAt: now, identity: input.identity,
        providerMeta: { apiModelId, taskId, endpointType, duration, aspect },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { baseUrl } = getKlingEnv();
      const authHeader  = await buildKlingAuthHeader();

      // Decode compound ID: "t2v|<taskId>" or "i2v|<taskId>"
      // Legacy IDs (no pipe) are treated as text2video.
      const [endpointType, rawTaskId] = externalJobId.includes("|")
        ? externalJobId.split("|", 2)
        : ["t2v", externalJobId];

      const statusPath = endpointType === "i2v"
        ? `/v1/videos/image2video/${rawTaskId}`
        : `/v1/videos/text2video/${rawTaskId}`;

      const res = await fetch(`${baseUrl}${statusPath}`, {
        headers: { "Authorization": authHeader },
        signal:  AbortSignal.timeout(30_000),
      });

      // Non-2xx HTTP → hard provider error
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[kling] status HTTP ${res.status} for ${externalJobId}:`, errText.slice(0, 500));
        return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };
      }

      const rawText = await res.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        console.error(`[kling] status JSON parse failed for ${externalJobId}:`, rawText.slice(0, 200));
        return { jobId: externalJobId, status: "error", error: "Malformed status response from Kling." };
      }

      // Kling wraps all responses in { code, data }. code !== 0 means API-level error.
      const code = typeof body.code === "number" ? body.code : -1;
      if (code !== 0) {
        const msg = String(body.message ?? body.msg ?? "Unknown Kling error");
        console.error(`[kling] status code ${code} for ${externalJobId}: ${msg}`);
        // Non-zero code on a status poll usually means the task ID is invalid or expired.
        // Do NOT map to "error" yet — return pending so the caller retries a few times.
        // If it persists, the timeout guard in the status route will auto-fail it.
        return { jobId: externalJobId, status: "pending" };
      }

      const task   = (body.data ?? body) as Record<string, unknown>;
      const status = String(task.task_status ?? task.status ?? "");

      if (status === "succeed" || status === "completed") {
        // Extract URL — handle multiple Kling response shapes:
        //   { task_result: { videos: [{ url }] } }   ← primary (v3)
        //   { works: [{ resource: { resource_list: [{ resource_url }] } }] }  ← legacy
        const result = task.task_result as Record<string, unknown> | undefined;
        let url: string | undefined =
          (result?.videos as Array<{ url: string }> | undefined)?.[0]?.url;

        if (!url) {
          // Legacy / fallback shape
          const works = task.works as Array<Record<string, unknown>> | undefined;
          const resList = works?.[0]?.resource as Record<string, unknown> | undefined;
          url = (resList?.resource_list as Array<{ resource_url: string }> | undefined)?.[0]?.resource_url;
        }

        if (!url) {
          console.error(`[kling] status succeed but no video URL extracted for ${externalJobId}. Full task:`, JSON.stringify(task).slice(0, 800));
          return { jobId: externalJobId, status: "error", error: "Kling returned success but no video URL was found." };
        }

        return { jobId: externalJobId, status: "success", url };
      }

      if (status === "failed") {
        const failMsg = String(task.task_status_msg ?? task.status_msg ?? "Kling generation failed.");
        console.error(`[kling] status failed for ${externalJobId}: ${failMsg}`);
        return { jobId: externalJobId, status: "error", error: failMsg };
      }

      // submitted | processing | queued → keep polling
      return { jobId: externalJobId, status: "pending" };
    },

    async cancelJob(externalJobId: string): Promise<void> {
      const { baseUrl } = getKlingEnv();
      const authHeader  = await buildKlingAuthHeader();
      // Strip compound prefix if present
      const rawTaskId = externalJobId.includes("|")
        ? externalJobId.split("|", 2)[1]
        : externalJobId;
      await fetch(`${baseUrl}/v1/videos/tasks/${rawTaskId}`, {
        method: "DELETE", headers: { "Authorization": authHeader },
      }).catch(() => {});
    },

    normalizeOutput(raw: unknown): ZProviderResult {
      const body  = raw as Record<string, unknown>;
      const task  = (body.data ?? body) as Record<string, unknown>;
      const works = task.task_result as Record<string, unknown> | undefined;
      const url   = (works?.videos as Array<{ url: string }> | undefined)?.[0]?.url;
      return {
        jobId: String(task.task_id ?? ""), provider: "kling", modelKey,
        status: "success", url,
      };
    },

    async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
      const data   = payload.raw as Record<string, unknown>;
      const status = String(data.task_status ?? "");
      if (status === "succeed" || status === "completed") {
        const task = (data.data ?? data) as Record<string, unknown>;
        const works = task.task_result as Record<string, unknown> | undefined;
        const url   = (works?.videos as Array<{ url: string }> | undefined)?.[0]?.url;
        return { jobId: payload.jobId, status: "success", url };
      }
      if (status === "failed") return { jobId: payload.jobId, status: "error", error: "Kling failed." };
      return { jobId: payload.jobId, status: "pending" };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

export const kling30OmniProvider        = buildKlingProvider(KLING_MODELS[0]);
export const kling30Provider            = buildKlingProvider(KLING_MODELS[1]);
export const klingMotionControlProvider = buildKlingProvider(KLING_MODELS[2]);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function klingAspect(ratio: string): string {
  const map: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
  return map[ratio] ?? "16:9";
}

function extractKlingTaskId(body: Record<string, unknown>): string {
  // Kling response shapes observed across API versions:
  //   { data: { task_id: "..." } }           ← primary (current docs)
  //   { data: { taskId: "..." } }            ← camelCase variant
  //   { data: { id: "..." } }                ← alternative wrapper
  //   { data: { task: { id: "..." } } }      ← nested task object
  //   { task_id: "..." }                     ← flat (older versions)
  const data = (body.data ?? body) as Record<string, unknown>;
  const nested = data.task as Record<string, unknown> | undefined;
  return String(
    data.task_id  ??
    data.taskId   ??
    data.id       ??
    nested?.id    ??
    body.task_id  ??
    ""
  );
}

function sanitize(raw: string): string {
  if (raw.toLowerCase().includes("secret") || raw.toLowerCase().includes("token")) {
    return "Authentication error — check KLING_API_KEY configuration.";
  }
  return raw.slice(0, 120);
}
