/**
 * POST /api/webhooks/studio/[provider]
 *
 * Unified webhook receiver for all studio provider async callbacks.
 *
 * Providers route to this endpoint when an async job completes or fails.
 * The [provider] segment identifies the sending provider family so the
 * correct signature verification and payload normalization can be applied.
 *
 * Supported provider slugs (matches ProviderFamily values):
 *   fal       — fal.ai (Seedream, FLUX Kontext, FLUX.2, FLUX Character)
 *   kling     — Kling AI
 *   byteplus  — BytePlus / Volcengine (Seedance)
 *   runway    — Runway (Gen-4.5, Phase 2)
 *   heygen-ugc — HeyGen UGC
 *   creatify  — Creatify
 *   arcads    — Arcads
 *   openai    — OpenAI (gpt-image-1)
 *
 * Webhook registration URLs (set in each provider's dashboard):
 *   https://<domain>/api/webhooks/studio/fal
 *   https://<domain>/api/webhooks/studio/kling
 *   ... etc.
 *
 * Security:
 *   - Each provider has its own HMAC secret env var (see WEBHOOK_SECRETS map below)
 *   - If the secret is not configured, verification is skipped in dev, rejected in prod
 *   - Raw body is always read before any JSON parsing (required for HMAC)
 *
 * Flow:
 *   1. Read raw body
 *   2. Verify provider signature (HMAC or provider-specific scheme)
 *   3. Parse payload
 *   4. Extract externalJobId + status from provider-specific payload shape
 *   5. Look up asset record by externalJobId
 *   6. Route to orchestrator handleWebhook() for provider-specific normalization
 *   7. Update asset record (ready / failed)
 *   8. Return 200 immediately (providers retry on non-2xx)
 *
 * All errors return 200 to prevent provider retry storms — errors are logged.
 */

import type { NextRequest }         from "next/server";
import { supabaseAdmin }            from "@/lib/supabase/admin";
import { ensureProvidersRegistered } from "@/lib/providers/startup";
import { handleWebhook }            from "@/lib/providers/core/orchestrator";
import { updateAssetStatus }        from "@/lib/storage/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK SECRET MAP — one env var per provider
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_SECRETS: Record<string, string | undefined> = {
  fal:            process.env.FAL_WEBHOOK_SECRET,
  kling:          process.env.KLING_WEBHOOK_SECRET,
  byteplus:       process.env.BYTEPLUS_WEBHOOK_SECRET,
  runway:         process.env.RUNWAY_WEBHOOK_SECRET,
  "heygen-ugc":   process.env.HEYGEN_WEBHOOK_SECRET,
  creatify:       process.env.CREATIFY_WEBHOOK_SECRET,
  arcads:         process.env.ARCADS_WEBHOOK_SECRET,
  openai:         process.env.OPENAI_WEBHOOK_SECRET,
  "nano-banana":  process.env.NANO_BANANA_WEBHOOK_SECRET,  // optional — NB doesn't always sign
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

async function verifyHmacSha256(
  body:      string,
  signature: string,
  secret:    string
): Promise<boolean> {
  try {
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["verify"]
    );
    // Signature may be hex-encoded or base64-encoded depending on provider
    const sigBuf = signature.includes("-")
      ? hexToBuffer(signature.replace(/-/g, ""))
      : signature.length === 64
        ? hexToBuffer(signature)
        : base64ToBuffer(signature);
    return crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(body));
  } catch {
    return false;
  }
}

function hexToBuffer(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr.buffer;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const arr    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr.buffer;
}

/** Returns the signature header for each provider (provider-specific header names) */
function getSignatureHeader(provider: string, req: NextRequest): string {
  switch (provider) {
    case "fal":        return req.headers.get("x-fal-signature")     ?? "";
    case "kling":      return req.headers.get("x-kling-signature")   ?? "";
    case "byteplus":   return req.headers.get("x-byteplus-signature") ?? "";
    case "runway":     return req.headers.get("x-runway-signature")  ?? "";
    case "creatify":   return req.headers.get("x-creatify-signature") ?? "";
    case "arcads":     return req.headers.get("x-arcads-signature")  ?? "";
    case "heygen-ugc": return req.headers.get("x-heygen-signature")  ?? "";
    default:           return req.headers.get("x-signature")         ?? "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOAD NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedWebhookPayload {
  externalJobId: string;
  status:        "success" | "error" | "pending";
  url?:          string;
  error?:        string;
  modelKey?:     string;
  raw:           Record<string, unknown>;
}

/** Extract the canonical fields from each provider's webhook payload shape */
function normalizePayload(
  provider: string,
  raw:      Record<string, unknown>
): NormalizedWebhookPayload | null {
  switch (provider) {

    // ── fal.ai ──────────────────────────────────────────────────────────────
    // Shape: { request_id, status: "COMPLETED"|"FAILED", payload: { images?, video? } }
    case "fal": {
      const id     = String(raw.request_id ?? raw.requestId ?? "");
      const status = String(raw.status ?? "").toUpperCase();
      if (!id) return null;
      const payload = (raw.payload ?? raw) as Record<string, unknown>;
      const images  = payload.images as Array<{ url: string }> | undefined;
      const videoUrl = payload.video_url ?? payload.url;
      return {
        externalJobId: id,
        status: status === "COMPLETED" ? "success" : status === "FAILED" ? "error" : "pending",
        url:    images?.[0]?.url ?? (typeof videoUrl === "string" ? videoUrl : undefined),
        raw,
      };
    }

    // ── Kling AI ─────────────────────────────────────────────────────────────
    // Shape: { task_id, task_status: "succeed"|"failed"|"processing", task_result: { videos: [{url}] } }
    case "kling": {
      const id     = String(raw.task_id ?? "");
      const status = String(raw.task_status ?? "");
      if (!id) return null;
      const result = raw.task_result as Record<string, unknown> | undefined;
      const videos = result?.videos as Array<{ url: string }> | undefined;
      return {
        externalJobId: id,
        status: status === "succeed" ? "success" : status === "failed" ? "error" : "pending",
        url:    videos?.[0]?.url,
        raw,
      };
    }

    // ── BytePlus / Seedance ───────────────────────────────────────────────────
    // Shape: { id, status: "Success"|"Fail"|"InQueue"|"Running", output: { video_url } }
    case "byteplus": {
      const id     = String(raw.id ?? raw.task_id ?? "");
      const status = String(raw.status ?? "");
      if (!id) return null;
      const output = raw.output as Record<string, unknown> | undefined;
      return {
        externalJobId: id,
        status: status === "Success" ? "success" : status === "Fail" ? "error" : "pending",
        url:    typeof output?.video_url === "string" ? output.video_url : undefined,
        raw,
      };
    }

    // ── Runway ───────────────────────────────────────────────────────────────
    // Shape: { id, status: "SUCCEEDED"|"FAILED"|"RUNNING", output: [url] }
    case "runway": {
      const id     = String(raw.id ?? "");
      const status = String(raw.status ?? "").toUpperCase();
      if (!id) return null;
      const output = raw.output as string[] | undefined;
      return {
        externalJobId: id,
        status: status === "SUCCEEDED" ? "success" : status === "FAILED" ? "error" : "pending",
        url:    output?.[0],
        raw,
      };
    }

    // ── HeyGen UGC ───────────────────────────────────────────────────────────
    // Shape: { video_id, status: "completed"|"failed"|"processing", video_url? }
    case "heygen-ugc": {
      const id     = String(raw.video_id ?? raw.request_id ?? "");
      const status = String(raw.status ?? "");
      if (!id) return null;
      return {
        externalJobId: id,
        status: status === "completed" ? "success" : status === "failed" ? "error" : "pending",
        url:    typeof raw.video_url === "string" ? raw.video_url : undefined,
        raw,
      };
    }

    // ── Creatify ─────────────────────────────────────────────────────────────
    // Shape: { id, status: "done"|"error"|"pending", output_url? }
    case "creatify": {
      const id     = String(raw.id ?? "");
      const status = String(raw.status ?? "");
      if (!id) return null;
      return {
        externalJobId: id,
        status: status === "done" ? "success" : status === "error" ? "error" : "pending",
        url:    typeof raw.output_url === "string" ? raw.output_url : undefined,
        raw,
      };
    }

    // ── Arcads ───────────────────────────────────────────────────────────────
    // Shape: { ad_id, status: "completed"|"failed", video_url? }
    case "arcads": {
      const id     = String(raw.ad_id ?? raw.id ?? "");
      const status = String(raw.status ?? "");
      if (!id) return null;
      return {
        externalJobId: id,
        status: status === "completed" ? "success" : status === "failed" ? "error" : "pending",
        url:    typeof raw.video_url === "string" ? raw.video_url : undefined,
        raw,
      };
    }

    // ── Nano Banana ──────────────────────────────────────────────────────────
    // NB sends a callback when the task completes. The shape mirrors the
    // record-info poll response. We accept multiple known shapes:
    //   { taskId, taskStatus, imageUrl }         — standard shape
    //   { data: { taskId, taskStatus, imageUrl } } — nested
    //   { taskId, status: "SUCCESS", imageUrl }  — string status variant
    case "nano-banana": {
      // Unwrap nested data if present
      const src = (
        raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
          ? raw.data
          : raw
      ) as Record<string, unknown>;

      const id = String(
        src.taskId    ?? src.task_id    ?? src.recordId  ?? src.record_id ??
        raw.taskId    ?? raw.task_id    ?? raw.recordId  ?? raw.record_id ?? ""
      );
      if (!id) return null;

      const taskStatusNum = Number(src.taskStatus ?? src.task_status ?? raw.taskStatus ?? -1);
      const taskStatusStr = String(src.status ?? raw.status ?? "").toUpperCase();

      // Extract image URL — same logic as getJobStatus polling
      const pickUrl = (s: Record<string, unknown>): string | undefined => {
        if (typeof s.imageUrl  === "string" && s.imageUrl)  return s.imageUrl;
        if (typeof s.image_url === "string" && s.image_url) return s.image_url;
        if (typeof s.imagUrl   === "string" && s.imagUrl)   return s.imagUrl;
        if (typeof s.url       === "string" && s.url)       return s.url;
        if (Array.isArray(s.images)    && typeof s.images[0]    === "string") return s.images[0] as string;
        if (Array.isArray(s.imageUrls) && typeof s.imageUrls[0] === "string") return s.imageUrls[0] as string;
        return undefined;
      };
      const imageUrl = pickUrl(src) ?? pickUrl(raw as Record<string, unknown>);

      const isSuccess = taskStatusNum === 1 || taskStatusStr === "SUCCESS" || taskStatusStr === "COMPLETED";
      const isFailed  = taskStatusNum === 2 || taskStatusNum === 3 ||
                        taskStatusStr === "FAILED" || taskStatusStr === "ERROR";

      return {
        externalJobId: id,
        status:        isSuccess ? "success" : isFailed ? "error" : "pending",
        url:           imageUrl,
        raw,
      };
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET LOOKUP BY EXTERNAL JOB ID
// ─────────────────────────────────────────────────────────────────────────────

async function getAssetByExternalJobId(
  externalJobId: string
): Promise<{ id: string; model_key: string; studio: string; user_id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("id, model_key, studio, user_id")
    .eq("external_job_id", externalJobId)
    .single();

  if (error || !data) return null;
  return data as { id: string; model_key: string; studio: string; user_id: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req:     NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
  const { provider } = await params;
  const isDev        = process.env.NODE_ENV === "development";

  ensureProvidersRegistered();

  // ── Read raw body (must happen before any other body reads for HMAC) ─────────
  const rawBody = await req.text();

  // ── Immediate hit log — confirms webhook is reachable ────────────────────────
  console.log(
    `[webhook/studio/${provider}] HIT — method=POST ` +
    `bodyLen=${rawBody.length} ` +
    `body=${rawBody.slice(0, 600)}`
  );

  // ── Signature verification ───────────────────────────────────────────────────
  const secret    = WEBHOOK_SECRETS[provider];
  const signature = getSignatureHeader(provider, req);

  if (secret) {
    const valid = await verifyHmacSha256(rawBody, signature, secret);
    if (!valid) {
      console.warn(`[webhook/studio/${provider}] Invalid signature — rejecting`);
      // Return 200 to prevent provider retry; log the failure
      return new Response("ok", { status: 200 });
    }
  } else if (!isDev) {
    // In production a missing secret means the provider was never secured — reject.
    // Return 200 so providers don't retry-storm, but log as an error for alerting.
    console.error(`[webhook/studio/${provider}] SECURITY: No webhook secret configured — rejecting unauthenticated webhook in production`);
    return new Response("ok", { status: 200 });
  }

  // ── Parse payload ────────────────────────────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    console.error(`[webhook/studio/${provider}] Invalid JSON payload`);
    return new Response("ok", { status: 200 });
  }

  // ── Normalize payload ────────────────────────────────────────────────────────
  const normalized = normalizePayload(provider, raw);
  if (!normalized) {
    console.warn(`[webhook/studio/${provider}] Could not extract jobId from payload`, raw);
    return new Response("ok", { status: 200 });
  }

  // ── Still pending — nothing to do yet ────────────────────────────────────────
  if (normalized.status === "pending") {
    return new Response("ok", { status: 200 });
  }

  // ── Look up asset record ─────────────────────────────────────────────────────
  const asset = await getAssetByExternalJobId(normalized.externalJobId);
  if (!asset) {
    console.warn(`[webhook/studio/${provider}] No asset found for externalJobId: ${normalized.externalJobId}`);
    return new Response("ok", { status: 200 });
  }

  // ── Route to provider's handleWebhook for normalization ──────────────────────
  try {
    await handleWebhook(asset.model_key, {
      provider:      provider as import("@/lib/providers/core/types").ProviderFamily,
      jobId:         normalized.externalJobId,
      externalJobId: normalized.externalJobId,
      status:        normalized.status as import("@/lib/providers/core/types").GenerationJobStatus,
      raw,
    });
  } catch (webhookErr) {
    console.error(`[webhook/studio/${provider}] handleWebhook error:`, webhookErr);
    // Continue — still update asset record even if provider hook throws
  }

  // ── Update asset record ──────────────────────────────────────────────────────
  try {
    const newStatus = normalized.status === "success" ? "ready" : "failed";
    await updateAssetStatus(supabaseAdmin, asset.id, newStatus, normalized.url);
  } catch (updateErr) {
    console.error(`[webhook/studio/${provider}] Asset update failed:`, updateErr);
  }

  console.info(`[webhook/studio/${provider}] Processed: ${normalized.externalJobId} → ${normalized.status}`);
  return new Response("ok", { status: 200 });
}
