/**
 * POST /api/studio/lipsync/generate
 *
 * Studio Lip Sync — submit a lip sync job via Sync Labs v3 (fal-ai/sync-lipsync/v3).
 *
 * ISOLATION RULES:
 *   - Does NOT use studioDispatch (lipsync has no prompt, different input shape)
 *   - Does NOT use ZProvider / model registry adapter pattern
 *   - Uses proAdapter (src/lib/providers/lipsync/pro.ts) directly
 *   - Completely separate from /api/lipsync/* (legacy system, uses generations table)
 *   - Do NOT mix with Kling Lip Sync (coming-soon placeholder in video registry)
 *
 * Billing:
 *   18 credits/second of output, rounded up to nearest 5s block (min 90cr).
 *   Pro mode = 1.5× multiplier applied here before reserve.
 *   Hard cap: 300 seconds (5 minutes).
 *
 * Request body:
 *   { videoUrl, audioUrl, durationSeconds, aspectRatio?, syncMode?, proMode?, quality? }
 *
 * Response:
 *   202 { success: true, data: { jobId, externalJobId, status: "pending", assetId, estimatedCredits } }
 *
 * Errors:
 *   400 INVALID_INPUT
 *   401 UNAUTHORIZED
 *   402 INSUFFICIENT_CREDITS
 *   403 FEATURE_DISABLED
 *   500 INTERNAL_ERROR
 *   502 PROVIDER_ERROR
 */

import type { NextRequest }          from "next/server";
import { requireAuthUser }           from "@/lib/supabase/server";
import { supabaseAdmin }             from "@/lib/supabase/admin";
import { guardStudio }               from "@/lib/api/feature-gate";
import { checkEntitlement, consumeTrialUsage } from "@/lib/billing/entitlement";
import { checkLipsyncGenerateRateLimit, checkIpStudioRateLimit, getClientIp, checkLipsyncConcurrentLimit }
                                     from "@/lib/security/rate-limit";
import { proAdapter }                from "@/lib/providers/lipsync/pro";
import { StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import {
  accepted, invalidInput, serverErr, parseBody, requireField,
} from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Credit constants
// ─────────────────────────────────────────────────────────────────────────────

const CREDITS_PER_SECOND  = 18;  // 18cr/s
const BLOCK_SECONDS       = 5;   // round up to nearest 5s
const MIN_CREDITS         = 90;  // 5s × 18cr/s
const MAX_DURATION_SEC    = 300; // 5 minutes hard cap
const PRO_MODE_MULTIPLIER = 1.5;

/** Calculate credit cost for a given duration. */
function calcCredits(durationSeconds: number, proMode: boolean): number {
  const blocks = Math.ceil(durationSeconds / BLOCK_SECONDS);
  const base   = Math.max(blocks * BLOCK_SECONDS * CREDITS_PER_SECOND, MIN_CREDITS);
  return proMode ? Math.ceil(base * PRO_MODE_MULTIPLIER) : base;
}

export async function POST(req: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  // S3-B-2: Stricter per-user limit for lipsync (2/min) — jobs are long-running and provider-expensive.
  const rateLimitError = await checkLipsyncGenerateRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  const clientIp = getClientIp(req);
  const ipRateLimitError = await checkIpStudioRateLimit(clientIp);
  if (ipRateLimitError) return ipRateLimitError;

  // S3-C: Concurrent job cap — max 1 active lipsync job per user.
  const concurrentError = await checkLipsyncConcurrentLimit(userId);
  if (concurrentError) return concurrentError;

  // ── Feature gate ────────────────────────────────────────────────────────────
  const gate = guardStudio("lipsync");
  if (gate) return gate;

  // ── Provider readiness ──────────────────────────────────────────────────────
  if (!proAdapter.isReady()) {
    return Response.json(
      { success: false, error: "Lip Sync Studio is not configured on this server.", code: "FEATURE_DISABLED" },
      { status: 403 }
    );
  }

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "lipsync");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/lipsync/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: videoUrl, fieldError: vuErr } = requireField(body!, "videoUrl");
  if (vuErr) return vuErr;

  const { value: audioUrl, fieldError: auErr } = requireField(body!, "audioUrl");
  if (auErr) return auErr;

  const { value: durRaw, fieldError: dErr } = requireField(body!, "durationSeconds");
  if (dErr) return dErr;

  const durationSeconds = Number(durRaw);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > MAX_DURATION_SEC) {
    return invalidInput(`durationSeconds must be between 1 and ${MAX_DURATION_SEC}.`);
  }

  const aspectRatio = typeof body!.aspectRatio === "string" ? body!.aspectRatio as "16:9" | "9:16" | "1:1" : "16:9";
  const syncMode    = typeof body!.syncMode    === "string" ? body!.syncMode    as "cut_off" | "loop" | "bounce" | "silence" | "remap" : "cut_off";
  const proMode     = body!.proMode === true;
  const quality     = typeof body!.quality === "string" ? body!.quality : "720p"; // "720p" | "1080p"

  // ── Credit estimation & reserve ─────────────────────────────────────────────
  const estimatedCredits = calcCredits(durationSeconds, proMode);

  // Reserve credits before calling provider
  const billingUserId = entitlement.billingUserId;
  const { error: reserveErr } = await supabaseAdmin.rpc("spend_credits", {
    p_user_id:     billingUserId,
    p_amount:      estimatedCredits,
    p_description: `Lip Sync Studio reserve — sync-lipsync-v3 ${durationSeconds}s${proMode ? " (Pro)" : ""}`,
  });
  if (reserveErr) {
    if (reserveErr.message?.includes("Insufficient")) {
      return Response.json({ success: false, error: "Insufficient credits for this job.", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }
    console.error("[/api/studio/lipsync/generate] spend_credits failed:", reserveErr.message);
    return serverErr();
  }

  // ── Submit to Sync Labs v3 ──────────────────────────────────────────────────
  const jobId     = crypto.randomUUID();
  const generationId = jobId; // use same ID for simplicity

  let submitResult: Awaited<ReturnType<typeof proAdapter.submitJob>>;
  try {
    submitResult = await proAdapter.submitJob({
      generationId,
      videoUrl:        videoUrl!,
      audioUrl:        audioUrl!,
      aspectRatio,
      durationSeconds,
      syncMode,
    });
  } catch (err) {
    console.error("[/api/studio/lipsync/generate] submitJob failed:", err);

    // Refund the reserved credits on submit failure
    void supabaseAdmin.rpc("refund_credits", {
      p_user_id:     billingUserId,
      p_amount:      estimatedCredits,
      p_description: `Lip Sync Studio refund — submit failed [${jobId}]`,
    });

    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to submit lip sync job.", code: "PROVIDER_ERROR" },
      { status: 502 }
    );
  }

  // ── Persist to assets table ─────────────────────────────────────────────────
  const assetId = crypto.randomUUID();
  const { error: insertErr } = await supabaseAdmin.from("assets").insert({
    id:              assetId,
    job_id:          jobId,
    user_id:         userId,
    studio:          "lipsync",
    provider:        "fal-lipsync",
    model_key:       "sync-lipsync-v3",
    external_job_id: submitResult.providerTaskId,
    status:          "pending",
    mime_type:       "video/mp4",
    url:             "",
    storage_path:    "",
    bucket:          "assets",
    duration_seconds: durationSeconds,
    aspect_ratio:     aspectRatio,
    credits_cost:     estimatedCredits,
    studio_meta: {
      syncMode,
      proMode,
      quality,
      statusUrl:   submitResult.statusUrl   ?? null,
      responseUrl: submitResult.responseUrl ?? null,
      cancelUrl:   submitResult.cancelUrl   ?? null,
    },
    generation_metadata: {
      videoUrl,
      audioUrl,
      durationSeconds,
      aspectRatio,
      syncMode,
      proMode,
      quality,
    },
  });

  if (insertErr) {
    console.error("[/api/studio/lipsync/generate] asset insert failed:", insertErr.message);

    // Refund credits — job can't be tracked so we can't poll
    void supabaseAdmin.rpc("refund_credits", {
      p_user_id:     billingUserId,
      p_amount:      estimatedCredits,
      p_description: `Lip Sync Studio refund — asset persist failed [${jobId}]`,
    });

    return serverErr();
  }

  // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
  if (entitlement.path === "trial" && entitlement.trialEndsAt) {
    void consumeTrialUsage(userId, "lipsync", entitlement.trialEndsAt);
  }

  return accepted({
    jobId,
    externalJobId:     submitResult.providerTaskId,
    status:            "pending",
    assetId,
    estimatedCredits,
  });
}
