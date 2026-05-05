/**
 * Kling Multi-Elements Editing — Standalone Service Adapter
 *
 * ⚠️  THIS IS NOT A ZProvider. Do NOT pass through studio-dispatch, ZJob,
 *     or any standard generation pipeline. Multi-Elements Editing is a
 *     completely separate stateful workflow with its own session lifecycle.
 *
 * ⚠️  THIS IS A BACKEND PREP STUB — Phase 2 activation required.
 *     All functions are defined with correct types and signatures.
 *     All functions throw KLING_MULTI_ELEMENTS_DISABLED until the feature
 *     flag KLING_MULTI_ELEMENTS_ENABLED=true is set in Vercel env vars.
 *     No generation can occur in production from this file today.
 *
 * Pricing status: NOT LOCKED — no credits are charged by this stub.
 *   Before activating, lock exact per-operation credit costs in:
 *     - supabase/migrations/ (new row in credit_model_costs)
 *     - hooks.ts estimate() function
 *   Do not activate without confirmed pricing.
 *
 * ── Kling Multi-Elements Editing vs Kling 3.0 Omni ──────────────────────────
 * These are two completely different Kling systems:
 *
 *   Kling 3.0 Omni Advanced Generation:
 *     - Endpoint: /v1/videos/omni-video
 *     - Single stateless API call (like all other providers)
 *     - Handled in kling.ts / buildKlingProvider / ZProvider pipeline
 *     - Features: multi_shot, image_list[], element_list[], video_list[]
 *
 *   Kling Multi-Elements Editing (THIS FILE):
 *     - 7 stateful endpoints, session-based workflow
 *     - Completely separate from any ZProvider or studio-dispatch flow
 *     - Session must be initialized, selections made, task created, then polled
 *     - No model-level capability flag — it is a platform workflow, not a model feature
 *
 * ── Multi-Elements Session Flow ──────────────────────────────────────────────
 *   1. initSession()       → create editing session from video ID or URL
 *   2. addSelection()      → mark region to include (returns RLE masks)
 *   3. deleteSelection()   → mark region to exclude (optional)
 *   4. previewSelection()  → preview composed mask before task (optional)
 *   5. createTask()        → submit the editing task (async)
 *   6. pollTask()          → poll task status until succeed/failed
 *   7. listTasks()         → list all tasks for a session (utility)
 *
 * ── Kling API Endpoints ──────────────────────────────────────────────────────
 *   POST   /v1/videos/multi-elements/session/create
 *   POST   /v1/videos/multi-elements/selection/add
 *   POST   /v1/videos/multi-elements/selection/delete
 *   GET    /v1/videos/multi-elements/selection/preview
 *   POST   /v1/videos/multi-elements/task/create
 *   GET    /v1/videos/multi-elements/task/{task_id}
 *   GET    /v1/videos/multi-elements/tasks  (list)
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 *   Same KLING_API_KEY JWT pattern as kling.ts (HS256 from accessKeyId:accessKeySecret).
 *   Imports buildKlingAuthHeader from kling.ts when activated.
 *   Base URL: KLING_BASE_URL (same as standard Kling provider).
 *
 * ── Feature Gate ─────────────────────────────────────────────────────────────
 *   All exported functions check process.env.KLING_MULTI_ELEMENTS_ENABLED === "true"
 *   at call time. If not set, they throw immediately with a clear error.
 *   The API route /api/studio/video/multi-elements also returns 503 until enabled.
 *
 * ── Registry Flag ────────────────────────────────────────────────────────────
 *   multiElements?: boolean is defined in VideoModelCapabilities but is always
 *   false on all model entries. It is NOT a per-model generation capability.
 *   It is a platform-level workflow flag, intentionally separate.
 */

import type {
  KlingMultiElementsInitBody,
  KlingMultiElementsSession,
  KlingSelectionAreaBody,
  KlingSelectionAreaResult,
  KlingMultiElementsTaskBody,
  KlingMultiElementsTask,
} from "../core/types";
import { getKlingEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GATE
// ─────────────────────────────────────────────────────────────────────────────

const DISABLED_ERROR =
  "Kling Multi-Elements Editing is not yet activated. " +
  "Set KLING_MULTI_ELEMENTS_ENABLED=true in Vercel env vars and lock pricing " +
  "in credit_model_costs before enabling.";

function assertMultiElementsEnabled(): void {
  if (process.env.KLING_MULTI_ELEMENTS_ENABLED !== "true") {
    throw new Error(DISABLED_ERROR);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — reuse Kling JWT pattern
// ─────────────────────────────────────────────────────────────────────────────

async function buildAuthHeader(): Promise<string> {
  const { apiKey } = getKlingEnv();
  if (!apiKey.includes(":")) return `Bearer ${apiKey}`;
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

async function klingPost<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl } = getKlingEnv();
  const auth = await buildAuthHeader();
  const res = await fetch(`${baseUrl}${path}`, {
    method:  "POST",
    headers: { "Authorization": auth, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Kling Multi-Elements HTTP ${res.status}: ${txt.slice(0, 120)}`);
  }
  const json = await res.json() as { code: number; message?: string; data: T };
  if (json.code !== 0) throw new Error(`Kling Multi-Elements error ${json.code}: ${json.message ?? "unknown"}`);
  return json.data;
}

async function klingGet<T>(path: string): Promise<T> {
  const { baseUrl } = getKlingEnv();
  const auth = await buildAuthHeader();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Authorization": auth },
    signal:  AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Kling Multi-Elements HTTP ${res.status}: ${txt.slice(0, 120)}`);
  }
  const json = await res.json() as { code: number; message?: string; data: T };
  if (json.code !== 0) throw new Error(`Kling Multi-Elements error ${json.code}: ${json.message ?? "unknown"}`);
  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 1 — Init Session
// POST /v1/videos/multi-elements/session/create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a Multi-Elements editing session from a video.
 * Must be called before any selection or task operations.
 *
 * @param body - video_id (Kling video ID) or video_url (HTTPS URL to video)
 * @returns KlingMultiElementsSession — includes session_id, normalized_video,
 *          fps, width, height, total_frame, original_duration, final_unit_deduction
 */
export async function initMultiElementsSession(
  body: KlingMultiElementsInitBody,
): Promise<KlingMultiElementsSession> {
  assertMultiElementsEnabled();
  console.log("[kling-multi-elements] initSession — video_id:", body.video_id ?? "(url)", "video_url:", body.video_url ?? "(none)");
  return klingPost<KlingMultiElementsSession>("/v1/videos/multi-elements/session/create", body);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 2 — Add Selection
// POST /v1/videos/multi-elements/selection/add
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a foreground selection point to a session frame.
 * Points mark regions to INCLUDE in the edit.
 * Returns RLE-encoded segmentation masks for selected objects.
 *
 * RLE mask format: { size: [height, width], counts: string }
 * Decode: pycocotools RLE / standard COCO RLE
 *
 * @param body - session_id, frame_index (0-based), points[] — [{x,y}] in pixel space
 */
export async function addMultiElementsSelection(
  body: KlingSelectionAreaBody,
): Promise<KlingSelectionAreaResult> {
  assertMultiElementsEnabled();
  console.log("[kling-multi-elements] addSelection — session:", body.session_id, "frame:", body.frame_index, "points:", body.points.length);
  return klingPost<KlingSelectionAreaResult>("/v1/videos/multi-elements/selection/add", body);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 3 — Delete Selection
// POST /v1/videos/multi-elements/selection/delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a background selection point to exclude regions from the edit.
 * Points mark regions to EXCLUDE (typically called after addSelection
 * to refine the mask boundary).
 *
 * @param body - same shape as addSelection
 */
export async function deleteMultiElementsSelection(
  body: KlingSelectionAreaBody,
): Promise<KlingSelectionAreaResult> {
  assertMultiElementsEnabled();
  console.log("[kling-multi-elements] deleteSelection — session:", body.session_id, "frame:", body.frame_index);
  return klingPost<KlingSelectionAreaResult>("/v1/videos/multi-elements/selection/delete", body);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 4 — Preview Selection
// GET /v1/videos/multi-elements/selection/preview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview the composed selection mask for a session frame before task creation.
 * Optional but recommended for UI confirmation before committing a task.
 *
 * @param sessionId - the active session_id
 * @param frameIndex - the frame to preview
 */
export async function previewMultiElementsSelection(
  sessionId: string,
  frameIndex: number,
): Promise<KlingSelectionAreaResult> {
  assertMultiElementsEnabled();
  const qs = `?session_id=${encodeURIComponent(sessionId)}&frame_index=${frameIndex}`;
  console.log("[kling-multi-elements] previewSelection — session:", sessionId, "frame:", frameIndex);
  return klingGet<KlingSelectionAreaResult>(`/v1/videos/multi-elements/selection/preview${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 5 — Create Task
// POST /v1/videos/multi-elements/task/create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit the Multi-Elements editing task for generation.
 * Requires an active session with at least one selection committed.
 *
 * edit_mode:
 *   "addition" — add new elements described by image_list / prompt
 *   "swap"     — replace selected region with new element
 *   "removal"  — remove selected region
 *
 * ⚠️  Pricing: NOT LOCKED — do not activate without confirmed credits per mode.
 *
 * @param body - full task body including session_id, edit_mode, prompt, etc.
 */
export async function createMultiElementsTask(
  body: KlingMultiElementsTaskBody,
): Promise<KlingMultiElementsTask> {
  assertMultiElementsEnabled();
  console.log("[kling-multi-elements] createTask — session:", body.session_id, "mode:", body.edit_mode, "model:", body.model_name ?? "(default)");
  return klingPost<KlingMultiElementsTask>("/v1/videos/multi-elements/task/create", body);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 6 — Poll Task
// GET /v1/videos/multi-elements/task/{task_id}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll a Multi-Elements task for status and result.
 * Call repeatedly until task_status === "succeed" or "failed".
 *
 * Successful result shape: task_result.videos[0].url
 *
 * @param taskId - the task_id returned by createMultiElementsTask
 */
export async function pollMultiElementsTask(
  taskId: string,
): Promise<KlingMultiElementsTask> {
  assertMultiElementsEnabled();
  return klingGet<KlingMultiElementsTask>(`/v1/videos/multi-elements/task/${encodeURIComponent(taskId)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION 7 — List Tasks
// GET /v1/videos/multi-elements/tasks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all Multi-Elements tasks, optionally filtered by session.
 * Utility function for dashboard / debug use.
 *
 * @param sessionId - optional filter by session_id
 */
export async function listMultiElementsTasks(
  sessionId?: string,
): Promise<KlingMultiElementsTask[]> {
  assertMultiElementsEnabled();
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return klingGet<KlingMultiElementsTask[]>(`/v1/videos/multi-elements/tasks${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — Feature flag check (for route-level gate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when KLING_MULTI_ELEMENTS_ENABLED=true.
 * Used by the API route to decide whether to return 503 or proceed.
 */
export function isMultiElementsEnabled(): boolean {
  return process.env.KLING_MULTI_ELEMENTS_ENABLED === "true";
}
