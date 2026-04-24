/**
 * POST /api/studio/fcs/generate
 *
 * Dispatches a Future Cinema Studio (FCS) generation job.
 *
 * PHASE 1 STATUS: FULLY GATED
 *   - ZENCRA_FLAG_FCS_ENABLED must be true (default: false)
 *   - User must have an active Pro or Business subscription with FCS addon
 *   - Model key must be prefixed with "fcs_"
 *   - fcsAccessGranted: true is passed to dispatchFCS() explicitly
 *
 * Billing enforcement is handled by checkEntitlement(), which verifies:
 *   - Subscription is active
 *   - Plan allows FCS (Pro or Business) AND FCS addon is active
 *   - FCS is always blocked on trial — no trial path reaches this handler
 *
 * FCS uses a completely isolated orchestrator (dispatchFCS) and registry.
 * This route is the only FCS entry point — it does NOT go through the main
 * studio orchestrator.
 *
 * Supported models (Phase 1):
 *   fcs_ltx23_director — Cine Director (1080p, 8 s, 24 fps, 60 credits)
 *   fcs_ltx23_pro      — Cine Pro      (720p,  6 s, 24 fps, 45 credits)
 *
 * Resolution, duration, and FPS are fixed per preset — NOT user-configurable.
 * Provider: LTX-2.3 via fal.ai — synchronous, no polling needed.
 *
 * Request body:
 *   { modelKey, prompt, imageUrl?, providerParams? }
 *   modelKey must start with "fcs_"
 *
 * Response:
 *   202 { success: true, data: { jobId, status: "success", url, assetId } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 FEATURE_DISABLED / FCS_NOT_ALLOWED / SUBSCRIPTION_INACTIVE
 *   400 INVALID_INPUT
 *   402 INSUFFICIENT_CREDITS
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { supabaseAdmin }             from "@/lib/supabase/admin";
import { guardStudio }               from "@/lib/api/feature-gate";
import { dispatchFCS, registerFCSProviders, FCSError }
                                     from "@/lib/providers/fcs";
import { buildCreditHooks, buildSupabaseCreditStore }
                                     from "@/lib/credits/hooks";
import { buildAssetMetadata, saveAssetMetadata }
                                     from "@/lib/storage/metadata";
import { checkEntitlement }          from "@/lib/billing/entitlement";
import { StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import {
  accepted, serverErr,
  parseBody, requireField, invalidInput,
} from "@/lib/api/route-utils";
import type { ZProviderInput }       from "@/lib/providers/core/types";
import { checkStudioRateLimit }      from "@/lib/security/rate-limit";
import { assertModelRouteIntegrity, ProviderMismatchError }
                                     from "@/lib/providers/core/model-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ensure FCS providers are registered (idempotent)
registerFCSProviders();

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  // ── Feature gate (kill switch) ───────────────────────────────────────────────
  const gate = guardStudio("fcs");
  if (gate) return gate;

  // ── Billing entitlement (FCS-specific: blocks trial, checks plan + addon) ────
  // checkEntitlement throws FCS_NOT_ALLOWED if:
  //   - user is on trial (always)
  //   - plan is Starter or Creator (fcs_allowed=false)
  //   - plan is Pro/Business but FCS addon not active
  // It throws SUBSCRIPTION_INACTIVE if no active subscription exists.
  try {
    await checkEntitlement(userId, "fcs");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json(
        { success: false, error: err.message, code: err.code },
        { status: dispatchErrorStatus(err.code) }
      );
    }
    console.error("[/api/studio/fcs/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  if (!modelKey!.startsWith("fcs_")) {
    return invalidInput("FCS model keys must start with \"fcs_\".");
  }

  // ── Model integrity ──────────────────────────────────────────────────────────
  try {
    assertModelRouteIntegrity(modelKey!, "fcs");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  const imageUrl       = typeof body!.imageUrl       === "string" ? body!.imageUrl       : undefined;
  const seed           = typeof body!.seed           === "number" ? body!.seed           : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  // ── Credit hooks ─────────────────────────────────────────────────────────────
  const requestId   = crypto.randomUUID();
  const creditStore = buildSupabaseCreditStore(supabaseAdmin);
  const creditHooks = buildCreditHooks({
    provider:  "fal-fcs",
    modelKey:  modelKey!,
    studio:    "fcs",
    store:     creditStore,
  });

  // ── FCS dispatch (isolated orchestrator) ─────────────────────────────────────
  const providerInput: ZProviderInput = {
    requestId,
    userId,
    studioType:  "fcs",
    modelKey:    modelKey!,
    prompt:      prompt!,
    imageUrl,
    seed,
    providerParams,
  };

  try {
    const job = await dispatchFCS(providerInput, {
      fcsAccessGranted: true,
      onCreditReserve:  async (credits) => {
        await creditHooks.reserve(userId, requestId, {
          min: credits, max: credits, expected: credits, breakdown: { base: credits },
        });
      },
      onCreditFinalize: async (credits) => {
        await creditHooks.finalize(userId, requestId, credits);
      },
      onCreditRollback: async () => {
        await creditHooks.rollback(userId, requestId);
      },
    });

    // Persist asset record — FCS is sync, URL is available immediately
    let assetId: string | undefined;
    try {
      const meta = buildAssetMetadata({
        job,
        userId,
        url:         job.result?.url ?? "",
        storagePath: `users/${userId}/fcs/${job.id}`,
        bucket:      "generations",
        status:      job.status === "success" ? "ready" : "pending",
        prompt:      prompt!,
        creditsCost: job.actualCredits ?? job.reservedCredits,
      });
      await saveAssetMetadata(supabaseAdmin, meta);
      assetId = meta.assetId;
    } catch (persistErr) {
      console.error("[/api/studio/fcs/generate] Asset persist failed:", persistErr);
    }

    return accepted({
      jobId:         job.id,
      externalJobId: job.externalJobId,
      status:        job.status,
      url:           job.result?.url,
      assetId,
    });
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      const status = dispatchErrorStatus(err.code);
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    if (err instanceof FCSError) {
      const statusMap: Record<string, number> = {
        ACCESS_DENIED:    403,
        MODEL_NOT_FOUND:  404,
        MODEL_NOT_ACTIVE: 403,
        INVALID_MODEL_KEY:400,
        VALIDATION_FAILED:400,
        PROVIDER_ERROR:   502,
      };
      const status = statusMap[err.code] ?? 500;
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    console.error("[/api/studio/fcs/generate]", err);
    return serverErr();
  }
}
