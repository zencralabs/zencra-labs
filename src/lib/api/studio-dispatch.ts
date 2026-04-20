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
import { ensureProvidersRegistered }  from "@/lib/providers/startup";
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

  // Step 2 — build ZProviderInput
  const providerInput: ZProviderInput = {
    requestId,
    userId,
    studioType:      input.studio,
    modelKey:        input.modelKey,
    prompt:          input.prompt ?? "",
    negativePrompt:  input.negativePrompt,
    imageUrl:           input.imageUrl,
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
  } catch (err) {
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
): Promise<{ status: string; url?: string; error?: string }> {
  ensureProvidersRegistered();

  try {
    const jobStatus = await pollJobStatus(modelKey, externalJobId);

    if (jobStatus.status === "success" && jobStatus.url) {
      // Mirror temp provider URLs (e.g. NB's tempfile.aiquickdraw.com) to
      // Supabase Storage so the gallery always uses our own CDN.
      const persistentUrl = await mirrorImageToStorage(jobStatus.url, assetId);
      await updateAssetStatus(supabaseAdmin, assetId, "ready", persistentUrl);
      return {
        status: "success",
        url:    persistentUrl,
      };
    } else if (jobStatus.status === "error") {
      // Persist the error reason so it survives page refreshes.
      // errorMessage is trimmed to 500 chars to avoid oversized DB writes.
      const errorMsg = (jobStatus.error ?? "Generation failed")
        .trim()
        .slice(0, 500);
      await updateAssetStatus(supabaseAdmin, assetId, "failed", undefined, errorMsg);
    }

    return {
      status: jobStatus.status,
      url:    jobStatus.url,
      error:  jobStatus.error,
    };
  } catch (err) {
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
    FCS_NOT_ALLOWED:        403,
    SINGLE_USER_VIOLATION:  403,
    PROVIDER_ERROR:         502,
    SERVER_ERROR:           500,
  };
  return map[code] ?? 500;
}
