/**
 * Seedance Video Provider — BytePlus ModelArk API
 *
 * Authentication: Bearer token
 *   Env: BYTEPLUS_API_KEY
 *
 * Base URL: https://ark.ap-southeast.bytepluses.com/api/v3
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPPORTED OPERATIONS (Seedance 2.0 / 2.0 Fast)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  text_to_video   POST /contents/generations/tasks
 *  image_to_video  POST /contents/generations/tasks  (image in content array)
 *
 *  Poll status     GET  /contents/generations/tasks/{task_id}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TASK STATUS
 * ─────────────────────────────────────────────────────────────────────────────
 *   queue    → pending
 *   running  → processing
 *   succeed  → done, extract content[0].video_url
 *   failed   → error
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODEL IDS
 * ─────────────────────────────────────────────────────────────────────────────
 *   Standard: dreamina-seedance-2-0-260128  (env: SEEDANCE_MODEL_ID)
 *   Fast:     dreamina-seedance-2-0-fast-260128 (env: SEEDANCE_FAST_MODEL_ID)
 */

import type {
  AiProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderStatusResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL     = "https://ark.ap-southeast.bytepluses.com/api/v3";
const POLL_INTERVAL_MS     = 5_000;
const POLL_TIMEOUT_MS      = 270_000; // 4.5 min

const DEFAULT_MODEL_ID     = "dreamina-seedance-2-0-260128";
const DEFAULT_FAST_MODEL_ID = "dreamina-seedance-2-0-fast-260128";

const SEEDANCE_STATUS = {
  QUEUE:   "queue",
  RUNNING: "running",
  SUCCEED: "succeed",
  FAILED:  "failed",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ASPECT RATIO MAP
// ─────────────────────────────────────────────────────────────────────────────

function arToResolution(ar?: string): string {
  if (ar === "9:16")  return "576x1024";
  if (ar === "1:1")   return "1024x1024";
  return "1024x576"; // 16:9 default
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeError(raw: string, httpStatus: number): string {
  if (httpStatus === 401 || httpStatus === 403)
    return "Authentication error with Seedance API. Please contact support.";
  if (httpStatus === 429)
    return "Seedance rate limit reached — please wait a moment and try again.";
  if (httpStatus >= 500)
    return "The Seedance service is temporarily unavailable. Please try again.";
  const lower = raw.toLowerCase();
  if (lower.includes("credit") || lower.includes("quota") || lower.includes("insufficient"))
    return "Insufficient Seedance API credits. Please top up your BytePlus account.";
  if (lower.includes("content") || lower.includes("policy") || lower.includes("sensitive"))
    return "Content policy violation. Please revise your prompt.";
  return "Generation failed. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.BYTEPLUS_API_KEY ?? "";
  if (!key) throw new Error("BYTEPLUS_API_KEY is not set");
  return key;
}

function getBaseUrl(): string {
  return process.env.SEEDANCE_BASE_URL ?? DEFAULT_BASE_URL;
}

function resolveModelId(input: ProviderGenerateInput): string {
  // If caller passes specific apiModelId in metadata, respect it
  const metaModel = (input.metadata?.apiModelId as string | undefined);
  if (metaModel) return metaModel;
  // Default to standard model (env override supported)
  return process.env.SEEDANCE_MODEL_ID ?? DEFAULT_MODEL_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT — create a generation task
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedanceSubmitResult {
  taskId: string;
}

export async function seedanceSubmit(input: {
  prompt:         string;
  aspectRatio?:   string;
  durationSeconds?: number;
  imageUrl?:      string;
  modelId?:       string;
}): Promise<SeedanceSubmitResult> {
  const apiKey  = getApiKey();
  const apiBase = getBaseUrl();
  const modelId = input.modelId
    ?? process.env.SEEDANCE_MODEL_ID
    ?? DEFAULT_MODEL_ID;

  const resolution = arToResolution(input.aspectRatio);
  const duration   = input.durationSeconds ?? 5;

  // Build content array — text prompt always included
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `${input.prompt}\n\n[resolution: ${resolution}, duration: ${duration}s]`,
    },
  ];

  // Add image for I2V
  if (input.imageUrl) {
    content.unshift({
      type:      "image_url",
      image_url: { url: input.imageUrl },
    });
  }

  const body = {
    model:   modelId,
    content,
  };

  let res: Response;
  try {
    res = await fetch(`${apiBase}/contents/generations/tasks`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(`Seedance network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[seedance] submit failed HTTP ${res.status}: ${text.slice(0, 300)}`);
    throw new Error(sanitizeError(text, res.status));
  }

  let data: Record<string, unknown>;
  try { data = (await res.json()) as Record<string, unknown>; }
  catch { throw new Error("Seedance returned non-JSON submit response"); }

  const taskId = String(data.id ?? "");
  if (!taskId) throw new Error("Seedance did not return a task ID");

  console.log(`[seedance] submitted task=${taskId} model=${modelId}`);
  return { taskId };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CHECK — get the status of a task
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedanceStatusResult {
  status: "pending" | "success" | "error";
  url?:   string;
  error?: string;
}

export async function seedanceCheckStatus(taskId: string): Promise<SeedanceStatusResult> {
  const apiKey  = getApiKey();
  const apiBase = getBaseUrl();

  let res: Response;
  try {
    res = await fetch(`${apiBase}/contents/generations/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept:        "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.warn(`[seedance] status check network error for task=${taskId}:`, err);
    return { status: "pending" }; // transient error, treat as still pending
  }

  if (!res.ok) {
    console.warn(`[seedance] status check HTTP ${res.status} for task=${taskId}`);
    if (res.status === 404) return { status: "error", error: "Task not found" };
    return { status: "pending" };
  }

  let data: Record<string, unknown>;
  try { data = (await res.json()) as Record<string, unknown>; }
  catch { return { status: "pending" }; }

  const taskStatus = String(data.status ?? "");

  if (taskStatus === SEEDANCE_STATUS.SUCCEED) {
    // Extract video URL from content array
    const contentArr = (data.content ?? []) as Array<Record<string, unknown>>;
    const videoItem = contentArr.find(c => c.type === "video");
    const videoUrl = String(videoItem?.video_url ?? "");
    if (!videoUrl) return { status: "error", error: "No video URL in response" };
    console.log(`[seedance] task=${taskId} SUCCEED → ${videoUrl}`);
    return { status: "success", url: videoUrl };
  }

  if (taskStatus === SEEDANCE_STATUS.FAILED) {
    const errorMsg = String(data.error ?? data.message ?? "Generation failed");
    console.error(`[seedance] task=${taskId} FAILED: ${errorMsg.slice(0, 200)}`);
    return { status: "error", error: sanitizeError(errorMsg, 400) };
  }

  // queue or running — still pending
  return { status: "pending" };
}

// ─────────────────────────────────────────────────────────────────────────────
// POLL UNTIL DONE — inline blocking poll (used for single-request routes)
// ─────────────────────────────────────────────────────────────────────────────

async function pollUntilDone(taskId: string): Promise<{ url: string }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const result = await seedanceCheckStatus(taskId);

    if (result.status === "success" && result.url) {
      console.log(`[seedance] task=${taskId} DONE after ${attempt} polls`);
      return { url: result.url };
    }

    if (result.status === "error") {
      throw new Error(result.error ?? "Generation failed");
    }

    console.log(`[seedance] task=${taskId} poll=${attempt} → pending`);
  }

  throw new Error("Seedance generation timed out after 4.5 minutes. Please try again.");
}

// ─────────────────────────────────────────────────────────────────────────────
// AiProvider implementation
// ─────────────────────────────────────────────────────────────────────────────

async function generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
  const modelId = resolveModelId(input);

  // Submit
  const { taskId } = await seedanceSubmit({
    prompt:          input.prompt,
    aspectRatio:     input.aspectRatio,
    durationSeconds: input.durationSeconds,
    imageUrl:        input.imageUrl,
    modelId,
  });

  // Poll
  try {
    const { url } = await pollUntilDone(taskId);
    return {
      provider: "seedance",
      mode:     "video",
      status:   "success",
      url,
      taskId,
    };
  } catch (err) {
    return {
      provider: "seedance",
      mode:     "video",
      status:   "error",
      taskId,
      error:    err instanceof Error ? err.message : String(err),
    };
  }
}

async function getStatus(taskId: string): Promise<ProviderStatusResult> {
  const result = await seedanceCheckStatus(taskId);
  return {
    provider: "seedance",
    taskId,
    status:   result.status,
    url:      result.url,
    error:    result.error,
  };
}

export const seedanceProvider: AiProvider = {
  name:           "seedance",
  supportedModes: ["video"],
  generate,
  getStatus,
};

// Env-configurable model IDs for external reference
export const SEEDANCE_STANDARD_MODEL = process.env.SEEDANCE_MODEL_ID ?? DEFAULT_MODEL_ID;
export const SEEDANCE_FAST_MODEL     = process.env.SEEDANCE_FAST_MODEL_ID ?? DEFAULT_FAST_MODEL_ID;
