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
 *   fal        — fal.ai (Seedream, FLUX Kontext, FLUX.2, FLUX Character)
 *   kling      — Kling AI
 *   byteplus   — BytePlus / Volcengine (Seedance)
 *   runway     — Runway (Gen-4.5, Phase 2)
 *   heygen-ugc — HeyGen UGC
 *   creatify   — Creatify
 *   arcads     — Arcads
 *   openai     — OpenAI (gpt-image-2)
 *   nano-banana — Nano Banana Pro
 *
 * Webhook registration URLs (set in each provider's dashboard):
 *   https://<domain>/api/webhooks/studio/fal
 *   https://<domain>/api/webhooks/studio/kling
 *   ... etc.
 *
 * Security:
 *   Signature verification is delegated to src/lib/security/webhook-signatures.ts.
 *   The verifier is provider-agnostic — the route never handles raw HMAC logic.
 *   Mode is controlled by WEBHOOK_ENFORCEMENT_MODE (dry-run / observe / enforce).
 *
 * Flow:
 *   1. Read raw body (required for HMAC — must precede JSON parsing)
 *   2. Verify provider signature via verifyWebhookSignature()
 *   3. In enforce mode: return 401 if !shouldProceed
 *      In permissive mode: log and continue regardless
 *   4. Parse payload JSON
 *   5. Extract externalJobId + status from provider-specific payload shape
 *   6. Look up asset record by externalJobId
 *   7. Route to orchestrator handleWebhook() for provider-specific normalization
 *   8. Update asset record (ready / failed)
 *   9. Return 200 immediately (providers retry on non-2xx)
 *
 * All errors return 200 to prevent provider retry storms — errors are logged.
 */

import type { NextRequest }            from "next/server";
import { supabaseAdmin }               from "@/lib/supabase/admin";
import { ensureProvidersRegistered }    from "@/lib/providers/startup";
import { handleWebhook }               from "@/lib/providers/core/orchestrator";
import { updateAssetStatus }           from "@/lib/storage/metadata";
import { logger }                      from "@/lib/logger";
import { verifyWebhookSignature }      from "@/lib/security/webhook-signatures";
import { checkWebhookRateLimit }       from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// S3-F-2: IN-MEMORY WEBHOOK IDEMPOTENCY DEDUP
// ─────────────────────────────────────────────────────────────────────────────
// Module-level Map — survives across requests in the same Node.js process.
// Key: "<externalJobId>:<provider>", value: timestamp of first-seen.
// TTL: 10 minutes — covers all realistic provider retry windows.
// On cache hit within TTL, return 200 immediately (idempotent — safe for providers).
// Periodic cleanup runs every 500 calls to prevent unbounded growth.

const WEBHOOK_DEDUP_CACHE = new Map<string, number>();
const DEDUP_TTL_MS        = 10 * 60 * 1000; // 10 minutes
let   dedupCallCount      = 0;

function checkAndRegisterDedup(externalJobId: string, provider: string): boolean {
  const key     = `${externalJobId}:${provider}`;
  const now     = Date.now();
  const lastSeen = WEBHOOK_DEDUP_CACHE.get(key);

  if (lastSeen !== undefined && now - lastSeen < DEDUP_TTL_MS) {
    return true; // duplicate — caller should return 200 immediately
  }

  WEBHOOK_DEDUP_CACHE.set(key, now);

  // Periodic cleanup — evict entries older than TTL
  if (++dedupCallCount % 500 === 0) {
    for (const [k, ts] of WEBHOOK_DEDUP_CACHE) {
      if (now - ts >= DEDUP_TTL_MS) WEBHOOK_DEDUP_CACHE.delete(k);
    }
  }

  return false; // first time — caller should proceed
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
  raw:      Record<string, unknown>,
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
        src.taskId    ?? src.task_id    ?? src.recordId  ?? src.record_id  ??
        raw.taskId    ?? raw.task_id    ?? raw.recordId  ?? raw.record_id  ?? ""
      );
      if (!id) return null;

      const taskStatusNum = Number(src.taskStatus ?? src.task_status ?? raw.taskStatus ?? -1);
      const taskStatusStr = String(src.status ?? raw.status ?? "").toUpperCase();

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
  externalJobId: string,
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
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;

  ensureProvidersRegistered();

  // ── S3-F-3: Per-provider rate limit (generous — never block legitimate retries) ──
  // 120 req/60s per provider slug. Degrades gracefully — RPC errors never block.
  const webhookRateLimited = await checkWebhookRateLimit(provider);
  if (webhookRateLimited) return webhookRateLimited;

  // ── 1. Read raw body (required for HMAC — must precede JSON parsing) ──────────
  const rawBody = await req.text();

  logger.info(`webhook/studio/${provider}`, "Webhook received", {
    provider,
    bodyLength: rawBody.length,
    preview:    rawBody.slice(0, 200),
  });

  // ── 2. Verify provider signature ──────────────────────────────────────────────
  // All verification logic lives in webhook-signatures.ts.
  // This route never touches raw HMAC — it only reads the result.
  const verification = await verifyWebhookSignature(provider, rawBody, req.headers);

  logger.info(`webhook/studio/${provider}`, "Signature verification result", {
    outcome:         verification.outcome,
    shouldProceed:   verification.shouldProceed,
    webhookEventId:  verification.webhookEventId,
    timestampDeltaMs: verification.timestampDeltaMs,
  });

  // ── S3-F-1: Block unsupported providers in enforce mode ──────────────────────
  // outcome=unsupported means webhook-signatures.ts has no verifier for this
  // provider slug. In permissive (dry-run / observe) mode shouldProceed is already
  // true so this block is unreachable. In enforce mode we close the gap explicitly:
  // an unknown slug should not be silently passed through — it may be a spoofed path.
  {
    const enforcementMode = process.env.WEBHOOK_ENFORCEMENT_MODE ?? "observe";
    if (enforcementMode === "enforce" && verification.outcome === "unsupported") {
      logger.warn(`webhook/studio/${provider}`, "Unsupported provider blocked in enforce mode", { provider });
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // ── 3. Mode gate ──────────────────────────────────────────────────────────────
  // In permissive (dry-run / observe) mode: shouldProceed is always true.
  // In enforce mode: invalid/missing/replay signatures are blocked here.
  if (!verification.shouldProceed) {
    logger.warn(`webhook/studio/${provider}`, "Webhook blocked by signature enforcement", {
      outcome:  verification.outcome,
      provider,
    });
    // Return 401 in enforce mode — providers with valid signatures will not retry
    // because 401 signals a permanent misconfiguration, not a transient error.
    // Providers with bad signatures should not be encouraged to retry.
    return new Response("Unauthorized", { status: 401 });
  }

  // ── 4. Parse payload ──────────────────────────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    logger.error(`webhook/studio/${provider}`, "Invalid JSON payload", {
      provider,
      bodyLength: rawBody.length,
    });
    return new Response("ok", { status: 200 });
  }

  // ── 5. Normalize payload ──────────────────────────────────────────────────────
  const normalized = normalizePayload(provider, raw);
  if (!normalized) {
    logger.warn(`webhook/studio/${provider}`, "Could not extract jobId from payload", {
      provider,
      rawKeys: Object.keys(raw),
    });
    return new Response("ok", { status: 200 });
  }

  // ── 6. Still pending — nothing to do yet ──────────────────────────────────────
  if (normalized.status === "pending") {
    logger.info(`webhook/studio/${provider}`, "Webhook status pending — no action", {
      externalJobId: normalized.externalJobId,
    });
    return new Response("ok", { status: 200 });
  }

  // ── S3-F-2: Idempotency dedup — ignore duplicate terminal webhooks ────────────
  // Providers retry on non-2xx and occasionally send duplicate success/failure
  // callbacks. We register the (externalJobId, provider) pair on first receipt;
  // a second arrival within the 10-minute TTL window is a no-op (return 200).
  // This guard runs after pending-status early-return so only terminal events are
  // deduplicated — intermediate status pings fall through normally.
  if (checkAndRegisterDedup(normalized.externalJobId, provider)) {
    logger.info(`webhook/studio/${provider}`, "Duplicate webhook ignored (dedup cache hit)", {
      externalJobId: normalized.externalJobId,
    });
    return new Response("ok", { status: 200 });
  }

  // ── 7. Look up asset record ───────────────────────────────────────────────────
  const asset = await getAssetByExternalJobId(normalized.externalJobId);
  if (!asset) {
    logger.warn(`webhook/studio/${provider}`, "No asset found for externalJobId", {
      externalJobId: normalized.externalJobId,
      provider,
    });
    return new Response("ok", { status: 200 });
  }

  // ── 8. Route to provider's handleWebhook for normalization ───────────────────
  try {
    await handleWebhook(asset.model_key, {
      provider:      provider as import("@/lib/providers/core/types").ProviderFamily,
      jobId:         normalized.externalJobId,
      externalJobId: normalized.externalJobId,
      status:        normalized.status as import("@/lib/providers/core/types").GenerationJobStatus,
      raw,
    });
  } catch (webhookErr) {
    logger.error(`webhook/studio/${provider}`, "handleWebhook error", {
      error:         String(webhookErr),
      externalJobId: normalized.externalJobId,
      modelKey:      asset.model_key,
    });
    // Continue — still update asset record even if provider hook throws
  }

  // ── 9. Update asset record ────────────────────────────────────────────────────
  try {
    const newStatus = normalized.status === "success" ? "ready" : "failed";
    await updateAssetStatus(supabaseAdmin, asset.id, newStatus, normalized.url);
  } catch (updateErr) {
    logger.error(`webhook/studio/${provider}`, "Asset update failed", {
      error:   String(updateErr),
      assetId: asset.id,
    });
  }

  logger.info(`webhook/studio/${provider}`, "Webhook processed successfully", {
    externalJobId:  normalized.externalJobId,
    status:         normalized.status,
    assetId:        asset.id,
    signatureOutcome: verification.outcome,
  });

  // Always return 200 — providers retry on non-2xx
  return new Response("ok", { status: 200 });
}
