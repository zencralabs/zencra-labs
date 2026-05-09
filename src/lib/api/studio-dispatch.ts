/**
 * Studio Dispatch — Orchestrator Wrapper for API Routes
 *
 * This is the single entry point all studio generate routes call.
 * It wires together:
 *   - Provider registration (via startup.ts)
 *   - Auth user context
 *   - CreditHooks backed by Supabase
 *   - orchestrator.dispatch()
 *   - Asset metadata persistence (pending → ready on completion)
 *
 * Routes should call studioDispatch() and return its StudioDispatchResult.
 * They must NOT call orchestrator.dispatch() directly.
 *
 * Errors are surfaced as typed StudioDispatchError instances so routes
 * can map them to consistent API error responses.
 */

import { createClient }               from "@supabase/supabase-js";
import { supabaseAdmin }              from "@/lib/supabase/admin";
import { dispatch, pollJobStatus }    from "@/lib/providers/core/orchestrator";
import { buildCreditHooks, buildSupabaseCreditStore, noopCreditHooks }
                                      from "@/lib/credits/hooks";
import { buildAssetMetadata, saveAssetMetadata, updateAssetStatus }
                                      from "@/lib/storage/metadata";
import { mirrorVideoToStorage }       from "@/lib/storage/upload";
import { logProviderCost }            from "@/lib/providers/core/cost-logger";
import { ensureProvidersRegistered }  from "@/lib/providers/startup";
import { validateStudioRequest }      from "@/lib/security/request-validator";
import {
  generateIdempotencyKey,
  checkIdempotency,
  markIdempotencyProcessing,
  markIdempotencyComplete,
  markIdempotencyFailed,
}                                     from "@/lib/security/idempotency";
import { logRequest, startTimer }     from "@/lib/security/request-logger";
// ── Zencra Shield observers (fire-and-forget — never block the dispatch path) ─
import { recordRequest, checkVelocity } from "@/lib/security/velocity-scorer";
import { recordOutcome }                from "@/lib/security/circuit-breaker";
import { recordCreditDebit }            from "@/lib/security/credit-burn-monitor";
import type { ZProviderInput, ZJob, StudioType, IdentityContext, CreditEstimate }
                                      from "@/lib/providers/core/types";
// isDev / DEV_DEMO_USER_ID removed — all callers must supply a real userId

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface StudioDispatchInput {
  /** Authenticated user ID (from Supabase JWT) */
  userId:          string;
  /** Target studio — must match modelKey's registered studio */
  studio:          StudioType;
  /** Registry model key — e.g. "gpt-image-1", "kling-30-omni" */
  modelKey:        string;
  /** Primary generation prompt */
  prompt:          string;
  negativePrompt?: string;
  imageUrl?:          string;
  /** Multi-reference image inputs — provider-agnostic scene orchestration. See ZProviderInput.imageUrls. */
  imageUrls?:         string[];
  endImageUrl?:       string;
  referenceVideoUrl?: string;
  videoUrl?:          string;
  audioUrl?:       string;
  aspectRatio?:    string;
  durationSeconds?: number;
  seed?:           number;
  voiceId?:        string;
  script?:         string;         // UGC
  productUrl?:     string;         // UGC
  identity?:       IdentityContext; // Character Studio
  providerParams?: Record<string, unknown>;
  /** If true, skip credit deduction (admin/preview use only) */
  skipCredits?:    boolean;
  /** Required for FCS routes — passed from hasFCSAccess() check */
  fcsAccessGranted?: boolean;
  /**
   * Client IP address — used for request_logs audit trail.
   * Extract with getClientIp(req) from rate-limit.ts before calling studioDispatch.
   * If omitted, logged as "unknown".
   */
  ip?: string;
}

export interface StudioDispatchResult {
  job:      ZJob;
  /** Asset record ID — written to DB immediately, even for pending async jobs */
  assetId?: string;
}

export type StudioDispatchErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_NOT_ACTIVE"
  | "FEATURE_DISABLED"
  | "VALIDATION_FAILED"
  | "INSUFFICIENT_CREDITS"
  | "JOB_LIMIT_EXCEEDED"
  | "CREDIT_CAP_EXCEEDED"
  // Billing / entitlement codes (Phase 2 billing backend)
  | "SUBSCRIPTION_INACTIVE"
  | "TRIAL_EXHAUSTED"
  | "TRIAL_EXPIRED"
  | "FREE_LIMIT_REACHED"
  | "FCS_NOT_ALLOWED"
  | "SINGLE_USER_VIOLATION"
  | "PROVIDER_ERROR"
  | "SERVER_ERROR";

export class StudioDispatchError extends Error {
  readonly code: StudioDispatchErrorCode;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: StudioDispatchErrorCode,
    cause?: unknown
  ) {
    super(message);
    this.name = "StudioDispatchError";
    this.code  = code;
    this.cause = cause;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2A PROTECTION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum simultaneous queued/processing jobs a single user may have. */
const MAX_CONCURRENT_JOBS        = 3;

/**
 * Maximum credits any single generation may cost (worst-case estimate).
 * Guards against misconfigured providers draining a user's balance in one call.
 */
const MAX_CREDITS_PER_GENERATION = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a generation request through the full Zencra pipeline.
 *
 * Flow:
 *  1. Ensure providers registered
 *  2. Build ZProviderInput
 *  3. Build CreditHooks (or noop for skipCredits)
 *  4. Call orchestrator.dispatch()
 *  5. Build AssetMetadata + persist to DB
 *  6. Return job + assetId
 *
 * Throws StudioDispatchError on all failure paths.
 */
export async function studioDispatch(
  input: StudioDispatchInput
): Promise<StudioDispatchResult> {
  // Step 1 — ensure all providers are registered (idempotent)
  ensureProvidersRegistered();

  const requestId = crypto.randomUUID();
  const userId    = input.userId || "";
  const clientIp  = input.ip    || "unknown";
  const route     = `/api/studio/${input.studio}/generate`;
  const elapsed   = startTimer();

  // Step 1.1 — request validation
  // Validates model key (must exist in registry + be active), aspect ratio allowlist,
  // and prompt length (3–2000 chars). Fast + synchronous — no DB calls.
  const validation = validateStudioRequest({
    modelKey:    input.modelKey,
    prompt:      input.prompt,
    aspectRatio: input.aspectRatio,
  });

  if (!validation.valid) {
    void logRequest({
      userId,
      ip:        clientIp,
      route,
      modelKey:  input.modelKey,
      studio:    input.studio,
      status:    "invalid",
      errorCode: "VALIDATION_FAILED",
      durationMs: elapsed(),
    });
    // Return the validation 400 response directly as an error
    throw new StudioDispatchError(
      "Request validation failed",
      "VALIDATION_FAILED",
      validation.response,
    );
  }

  // Step 1.2 — idempotency check
  // Prevents double-charges when clients retry on timeout or network error.
  // Key = SHA256(userId + modelKey + prompt) bucketed to 5-minute window.
  const idempotencyKey = generateIdempotencyKey(userId, input.modelKey, input.prompt);
  const idempotencyResult = await checkIdempotency(idempotencyKey);

  if (idempotencyResult.outcome === "duplicate_complete") {
    // Previous identical request completed — return the cached result directly.
    // IMPORTANT: do NOT throw here. Throwing causes routes' catch blocks to call
    // dispatchErrorStatus("VALIDATION_FAILED") → 400, discarding the cached data.
    // Instead, construct a synthetic ZJob from the stored values and return normally
    // so the route's success path delivers the cached result to the client.
    void logRequest({
      userId,
      ip:        clientIp,
      route,
      modelKey:  input.modelKey,
      studio:    input.studio,
      status:    "success",
      errorCode: "IDEMPOTENT_REPLAY",
      assetId:   idempotencyResult.assetId ?? undefined,
      durationMs: elapsed(),
    });

    const replayJobId = idempotencyResult.jobId ?? crypto.randomUUID();
    const cachedJob: ZJob = {
      id:          replayJobId,
      provider:    "openai",        // placeholder — not used for dispatch routing on replay
      modelKey:    input.modelKey,
      studioType:  input.studio,
      status:      "success",
      createdAt:   new Date(),
      updatedAt:   new Date(),
      completedAt: new Date(),
      result: idempotencyResult.resultUrl
        ? {
            jobId:    replayJobId,
            provider: "openai",
            modelKey: input.modelKey,
            status:   "success",
            url:      idempotencyResult.resultUrl,
          }
        : undefined,
    };

    return {
      job:     cachedJob,
      assetId: idempotencyResult.assetId ?? undefined,
    };
  }

  if (idempotencyResult.outcome === "duplicate_processing") {
    void logRequest({
      userId,
      ip:        clientIp,
      route,
      modelKey:  input.modelKey,
      studio:    input.studio,
      status:    "failed",
      errorCode: "DUPLICATE_IN_FLIGHT",
      durationMs: elapsed(),
    });
    throw new StudioDispatchError(
      "A generation with the same parameters is already in progress. Please wait.",
      "JOB_LIMIT_EXCEEDED",
    );
  }

  // Mark as processing before dispatch — race-safe via ON CONFLICT DO NOTHING
  if (idempotencyResult.outcome === "proceed") {
    await markIdempotencyProcessing(idempotencyKey, userId);
  }

  // Step 1.5 — concurrent job cap
  // Reject if the user already has MAX_CONCURRENT_JOBS in-flight.
  // Checked before credit estimation to avoid unnecessary DB reads.
  if (!input.skipCredits) {
    const { count, error: countErr } = await supabaseAdmin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["queued", "processing"]);

    if (!countErr && (count ?? 0) >= MAX_CONCURRENT_JOBS) {
      throw new StudioDispatchError(
        `You have ${MAX_CONCURRENT_JOBS} active generations. Wait for one to finish to continue.`,
        "JOB_LIMIT_EXCEEDED"
      );
    }
  }

  // ── Shield: record request for velocity window (before dispatch, never awaited) ─
  // This records the request timestamp + studio/model context so the velocity
  // scorer has accurate sliding-window counts. Fire-and-forget — never blocks.
  if (!input.skipCredits) {
    try { recordRequest(userId, input.studio, input.modelKey); } catch { /* silent */ }
  }

  // Step 2 — build ZProviderInput
  const providerInput: ZProviderInput = {
    requestId,
    userId,
    studioType:      input.studio,
    modelKey:        input.modelKey,
    prompt:          input.prompt ?? "",
    negativePrompt:  input.negativePrompt,
    imageUrl:           input.imageUrl,
    imageUrls:          input.imageUrls,
    endImageUrl:        input.endImageUrl,
    referenceVideoUrl:  input.referenceVideoUrl,
    videoUrl:           input.videoUrl,
    audioUrl:        input.audioUrl,
    aspectRatio:     input.aspectRatio as ZProviderInput["aspectRatio"],
    durationSeconds: input.durationSeconds,
    seed:            input.seed,
    voiceId:         input.voiceId,
    script:          input.script,
    productUrl:      input.productUrl,
    identity:        input.identity,
    providerParams:  input.providerParams,
  };

  // Step 3 — build credit hooks
  const creditHooks = input.skipCredits
    ? noopCreditHooks
    : buildCreditHooks({
        provider:  "unknown",   // orchestrator resolves real family from modelKey
        modelKey:  input.modelKey,
        studio:    input.studio,
        store:     buildSupabaseCreditStore(supabaseAdmin),
      });

  // Step 3.5 — per-generation credit cap
  // Estimate the worst-case cost before dispatch. If it exceeds the cap,
  // reject immediately without touching the credit balance or the provider.
  if (!input.skipCredits) {
    let costEstimate: CreditEstimate;
    try {
      costEstimate = await creditHooks.estimate(providerInput);
    } catch {
      // Estimation failure is non-fatal — skip the cap check rather than blocking
      costEstimate = { min: 0, max: 0, expected: 0, breakdown: {} };
    }
    if (costEstimate.max > MAX_CREDITS_PER_GENERATION) {
      throw new StudioDispatchError(
        `Estimated cost (${costEstimate.max} credits) exceeds the per-generation limit of ${MAX_CREDITS_PER_GENERATION} credits.`,
        "CREDIT_CAP_EXCEEDED"
      );
    }
  }

  // Step 4 — dispatch through orchestrator
  let job: ZJob;
  try {
    job = await dispatch(providerInput, {
      creditHooks,
      skipCreditCheck: input.skipCredits ?? false,
      fcsAccessGranted: input.fcsAccessGranted,
    });
    // Shield: record successful provider outcome for circuit breaker
    void recordOutcome(input.modelKey, true).catch(() => {});
  } catch (err) {
    // Shield: record failed provider outcome for circuit breaker
    void recordOutcome(input.modelKey, false).catch(() => {});
    // Mark idempotency key as failed so retries can proceed
    void markIdempotencyFailed(idempotencyKey);
    // Log the failed attempt
    void logRequest({
      userId,
      ip:        clientIp,
      route,
      modelKey:  input.modelKey,
      studio:    input.studio,
      status:    "failed",
      errorCode: err instanceof Error && "code" in err
        ? (err as { code: string }).code
        : "PROVIDER_ERROR",
      durationMs: elapsed(),
    });
    throw mapOrchestratorError(err);
  }

  // Step 5 — persist asset record
  //
  // FATAL for async jobs (status === "pending"): polling uses the asset record
  // to track state. If it's never written, every poll returns 404 and the job
  // is lost from the user's perspective even though the provider succeeded.
  //
  // NON-FATAL for sync jobs (status === "success" | "error"): the generation
  // result is already in-hand; a DB failure is unfortunate but the user has
  // their image. Log and continue so the response still reaches the client.
  let assetId: string | undefined;
  const isAsyncJob = job.status === "pending";

  if (isAsyncJob) {
    // Throw — callers must handle this and surface it as a generation failure
    assetId = await persistAsset(job, input, userId);
  } else {
    try {
      assetId = await persistAsset(job, input, userId);
    } catch (persistErr) {
      console.error("[studioDispatch] Asset persist failed (non-fatal for sync job):", persistErr);
    }
  }

  // ── Provider cost logging for sync providers ─────────────────────────────
  // Async providers (pending status) are logged in the job status polling route
  // when they first resolve. Sync providers (LTX, FCS) complete here — log now.
  if (job.status === "success" || job.status === "error") {
    void logProviderCost({
      assetId:        assetId,
      modelKey:       input.modelKey,
      studio:         input.studio,
      userId:         userId || undefined,
      status:         job.status === "success" ? "success" : "failed",
      failureReason:  job.status === "error" ? (job.result?.error as string | undefined) : undefined,
      generationParams: {
        ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
        ...(input.aspectRatio     ? { aspectRatio:     input.aspectRatio }     : {}),
      },
    });
  }

  // ── Idempotency completion ─────────────────────────────────────────────────
  // Mark the key as completed so duplicate retries return the cached result.
  // For async jobs, assetId is always set (persistAsset is fatal for async).
  const resultUrl = job.result?.url ?? null;
  void markIdempotencyComplete(
    idempotencyKey,
    assetId ?? null,
    job.id,
    typeof resultUrl === "string" ? resultUrl : null,
  );

  // ── Request audit log ─────────────────────────────────────────────────────
  void logRequest({
    userId,
    ip:           clientIp,
    route,
    modelKey:     input.modelKey,
    studio:       input.studio,
    status:       job.status === "success" ? "success" : (job.status === "error" ? "failed" : "success"),
    creditsUsed:  job.actualCredits ?? job.reservedCredits ?? undefined,
    assetId:      assetId,
    durationMs:   elapsed(),
  });

  // ── Shield: velocity check (fire-and-forget) ──────────────────────────────
  // Scores the rolling window and emits a SecurityEvent if thresholds crossed.
  // In dry-run/observe: emits event only — never blocks generation or response.
  if (!input.skipCredits) {
    void checkVelocity(userId, input.studio, input.modelKey).catch(() => {});
  }

  // ── Shield: credit burn monitor (fire-and-forget) ─────────────────────────
  // Records the credit deduction in the rolling-hour window.
  // creditsBalance is not fetched here to avoid an extra DB round-trip;
  // negative-balance monitoring is deferred to Phase B (Redis-backed state).
  if (!input.skipCredits) {
    const creditsUsed = job.actualCredits ?? job.reservedCredits;
    if (creditsUsed && creditsUsed > 0) {
      void recordCreditDebit(userId, creditsUsed, undefined).catch(() => {});
    }
  }

  return { job, assetId };
}

// ─────────────────────────────────────────────────────────────────────────────
// POLL AND UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll a pending async job for its current status and update the asset record.
 * Called by the job status route handler.
 *
 * Returns the updated job status. Does not throw — errors are returned
 * as status: "error" payloads.
 */
/**
 * Mirror an external image URL to Supabase Storage so the gallery
 * never depends on provider-side temp URLs.
 *
 * Applies to any URL from a known-ephemeral domain (e.g. tempfile.aiquickdraw.com).
 * Returns the permanent Supabase CDN URL on success, or the original URL as a
 * fallback if the upload fails (so polling still resolves).
 */
async function mirrorImageToStorage(
  externalUrl: string,
  assetId:     string,
): Promise<string> {
  const TEMP_DOMAINS = ["tempfile.aiquickdraw.com", "aiquickdraw.com"];
  const isTempUrl = TEMP_DOMAINS.some((d) => externalUrl.includes(d));
  if (!isTempUrl) return externalUrl; // nothing to mirror

  try {
    const imgRes = await fetch(externalUrl);
    if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`);

    const buffer      = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext         = contentType.includes("png") ? "png" : "jpg";
    const storagePath = `nb-generations/${assetId}.${ext}`;

    const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const storageClient    = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await storageClient.storage
      .from("generations")
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data } = storageClient.storage.from("generations").getPublicUrl(storagePath);
    console.log(`[pollAndUpdateJob] mirrored NB image → ${data.publicUrl}`);
    return data.publicUrl;
  } catch (err) {
    // Non-fatal: log the failure and fall back to the original temp URL
    console.error(`[pollAndUpdateJob] mirrorImageToStorage failed, using temp URL:`, err);
    return externalUrl;
  }
}

export async function pollAndUpdateJob(
  modelKey:      string,
  externalJobId: string,
  assetId:       string
): Promise<{ status: string; url?: string; error?: string; audioDetected?: boolean | null }> {
  ensureProvidersRegistered();

  try {
    const jobStatus = await pollJobStatus(modelKey, externalJobId);

    if (jobStatus.status === "success" && jobStatus.url) {
      // ── Kling video: mirror to Supabase Storage (permanent URL) ──────────────
      // Kling CDN URLs are signed and expire. Download + re-upload every
      // completed Kling job so the gallery URL never breaks.
      let persistentUrl  = jobStatus.url;
      let audioDetected: boolean | null = null;

      if (modelKey.startsWith("kling")) {
        // mirrorVideoToStorage now returns { url, audioDetected } — destructure both
        const mirrored = await mirrorVideoToStorage(jobStatus.url, assetId);
        persistentUrl  = mirrored.url;
        audioDetected  = mirrored.audioDetected;
      } else {
        // Mirror temp provider images (e.g. NB's tempfile.aiquickdraw.com)
        persistentUrl = await mirrorImageToStorage(jobStatus.url, assetId);
      }

      // audioDetected is persisted alongside status so the gallery
      // can show the correct AudioBadge state after a page refresh.
      await updateAssetStatus(supabaseAdmin, assetId, "ready", persistentUrl, undefined, audioDetected);
      console.log(`[pollAndUpdateJob] asset=${assetId} status=ready audioDetected=${audioDetected}`);
      // Shield: provider recovered successfully — record outcome for circuit breaker
      void recordOutcome(modelKey, true).catch(() => {});
      return {
        status: "success",
        url:    persistentUrl,
        audioDetected,
      };
    } else if (jobStatus.status === "error") {
      // Persist the error reason so it survives page refreshes.
      // errorMessage is trimmed to 500 chars to avoid oversized DB writes.
      const errorMsg = (jobStatus.error ?? "Generation failed")
        .trim()
        .slice(0, 500);
      await updateAssetStatus(supabaseAdmin, assetId, "failed", undefined, errorMsg);
      // Shield: provider job failed — record outcome for circuit breaker
      void recordOutcome(modelKey, false).catch(() => {});
    }

    return {
      status: jobStatus.status,
      url:    jobStatus.url,
      error:  jobStatus.error,
    };
  } catch (err) {
    // Shield: polling threw — treat as provider failure for circuit breaker
    void recordOutcome(modelKey, false).catch(() => {});
    return {
      status: "error",
      error:  err instanceof Error ? err.message : "Polling failed.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

async function persistAsset(
  job:    ZJob,
  input:  StudioDispatchInput,
  userId: string
): Promise<string> {
  // Sync providers (LTX, etc.) return a URL immediately in the job result.
  // Async providers (Kling, Seedance, etc.) return pending — URL comes via polling.
  const resultUrl   = job.result?.url ?? "";
  const isCompleted = job.status === "success" && !!resultUrl;

  const meta = buildAssetMetadata({
    job,
    userId,
    url:          resultUrl,
    // storagePath and bucket are set to provider-generated placeholders.
    // Final Supabase Storage paths are written during asset finalization (Phase 3).
    storagePath:  `users/${userId}/generations/${job.id}`,
    bucket:       "generations",
    status:       isCompleted ? "ready" : "pending",
    prompt:       input.prompt,
    creditsCost:  job.actualCredits ?? job.reservedCredits,
  });

  await saveAssetMetadata(supabaseAdmin, meta);
  return meta.assetId;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR MAPPING
// ─────────────────────────────────────────────────────────────────────────────

function mapOrchestratorError(err: unknown): StudioDispatchError {
  // First: check OrchestratorError.code for precise mapping
  if (err instanceof Error && "code" in err) {
    const oe = err as Error & { code: string };
    switch (oe.code) {
      case "MODEL_NOT_FOUND":
      case "PROVIDER_NOT_REGISTERED":
        return new StudioDispatchError(oe.message, "MODEL_NOT_FOUND", err);
      case "MODEL_NOT_ACTIVE":
        return new StudioDispatchError(oe.message, "MODEL_NOT_ACTIVE", err);
      case "STUDIO_DISABLED":
        return new StudioDispatchError(oe.message, "FEATURE_DISABLED", err);
      case "VALIDATION_FAILED":
        return new StudioDispatchError(oe.message, "VALIDATION_FAILED", err);
      case "CREDIT_RESERVE_FAILED":
        return new StudioDispatchError(oe.message, "INSUFFICIENT_CREDITS", err);
      case "FCS_ACCESS_DENIED":
        return new StudioDispatchError(oe.message, "FEATURE_DISABLED", err);
      case "DRY_RUN":
        // Dry-run mode — treat as a non-fatal feature-disabled gate for test purposes
        return new StudioDispatchError(oe.message, "FEATURE_DISABLED", err);
      case "PROVIDER_ERROR":
        return new StudioDispatchError(oe.message, "PROVIDER_ERROR", err);
    }
  }

  // Fallback: heuristic message matching
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("not found") || msg.includes("not registered")) {
      return new StudioDispatchError(msg, "MODEL_NOT_FOUND", err);
    }
    if (msg.includes("not active") || msg.includes("coming-soon")) {
      return new StudioDispatchError(msg, "MODEL_NOT_ACTIVE", err);
    }
    if (msg.includes("disabled") || (msg.includes("studio") && msg.includes("flag"))) {
      return new StudioDispatchError(msg, "FEATURE_DISABLED", err);
    }
    if (msg.includes("validation") || msg.includes("VALIDATION")) {
      return new StudioDispatchError(msg, "VALIDATION_FAILED", err);
    }
    if (msg.includes("Insufficient credits") || msg.includes("credit")) {
      return new StudioDispatchError(msg, "INSUFFICIENT_CREDITS", err);
    }
    if (msg.includes("HTTP") || msg.includes("provider") || msg.includes("upstream")) {
      return new StudioDispatchError(msg, "PROVIDER_ERROR", err);
    }
  }

  return new StudioDispatchError(
    "An unexpected error occurred during generation.",
    "SERVER_ERROR",
    err
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP RESPONSE MAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a StudioDispatchError code to an HTTP status code.
 * Used by route handlers to return the right HTTP status.
 */
export function dispatchErrorStatus(code: StudioDispatchErrorCode): number {
  const map: Record<StudioDispatchErrorCode, number> = {
    MODEL_NOT_FOUND:        404,
    MODEL_NOT_ACTIVE:       403,
    FEATURE_DISABLED:       403,
    VALIDATION_FAILED:      400,
    INSUFFICIENT_CREDITS:   402,
    JOB_LIMIT_EXCEEDED:     429,
    CREDIT_CAP_EXCEEDED:    400,
    // Billing / entitlement
    SUBSCRIPTION_INACTIVE:  403,
    TRIAL_EXHAUSTED:        402,
    TRIAL_EXPIRED:          402,
    FREE_LIMIT_REACHED:     403,
    FCS_NOT_ALLOWED:        403,
    SINGLE_USER_VIOLATION:  403,
    PROVIDER_ERROR:         502,
    SERVER_ERROR:           500,
  };
  return map[code] ?? 500;
}
