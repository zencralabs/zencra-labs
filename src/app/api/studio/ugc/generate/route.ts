/**
 * POST /api/studio/ugc/generate
 *
 * Dispatches a UGC (User-Generated Content) ad generation job.
 * Feature-flagged: requires UGC Studio to be enabled via ZENCRA_FLAG_UGC_ENABLED.
 *
 * Supported models (Phase 1, flag-gated):
 *   creatify  — URL-to-video UGC ads
 *   arcads    — avatar-driven ad generation
 *   heygen-ugc — HeyGen avatar video engine
 *
 * UGC generation always involves either a script or a product URL.
 * modelKey determines which provider handles the request.
 *
 * Request body:
 *   { modelKey, prompt, script?, productUrl?, imageUrl?,
 *     aspectRatio?, durationSeconds?, providerParams? }
 *
 *   prompt     — overall direction / ad concept
 *   script     — spoken script for avatar-based UGC
 *   productUrl — product page URL for link-to-video providers (Creatify)
 *
 * Response:
 *   202 { success: true, data: { jobId, externalJobId, status, assetId, estimatedCredits } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 FEATURE_DISABLED
 *   400 INVALID_INPUT — modelKey required; prompt or script required
 *   402 INSUFFICIENT_CREDITS
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { guardStudio }               from "@/lib/api/feature-gate";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import { accepted, serverErr, invalidInput, parseBody, requireField }
                                     from "@/lib/api/route-utils";
import { checkStudioRateLimit }      from "@/lib/security/rate-limit";
import { checkEntitlement, consumeTrialUsage }
                                     from "@/lib/billing/entitlement";
import { assertModelRouteIntegrity, ProviderMismatchError }
                                     from "@/lib/providers/core/model-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  // ── Feature gate ────────────────────────────────────────────────────────────
  const gate = guardStudio("ugc");
  if (gate) return gate;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "ugc");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/ugc/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  // ── Model integrity ──────────────────────────────────────────────────────────
  try {
    assertModelRouteIntegrity(modelKey!, "ugc");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  // UGC requires either a prompt or a script — at least one must be present
  const prompt     = typeof body!.prompt     === "string" ? body!.prompt.trim()     : "";
  const script     = typeof body!.script     === "string" ? body!.script.trim()     : undefined;
  const productUrl = typeof body!.productUrl === "string" ? body!.productUrl.trim() : undefined;

  if (!prompt && !script) {
    return invalidInput("UGC generation requires either \"prompt\" or \"script\".");
  }

  const imageUrl       = typeof body!.imageUrl       === "string" ? body!.imageUrl       : undefined;
  const aspectRatio    = typeof body!.aspectRatio    === "string" ? body!.aspectRatio    : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  let durationSeconds: number | undefined;
  if (body!.durationSeconds !== undefined) {
    const d = Number(body!.durationSeconds);
    if (Number.isFinite(d) && d > 0) durationSeconds = d;
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      studio:          "ugc",
      modelKey:        modelKey!,
      prompt:          prompt || (script ?? ""),
      script,
      productUrl,
      imageUrl,
      aspectRatio,
      durationSeconds,
      providerParams,
    });

    // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
    // ugc maps to the "videos" trial category (resolveTrialCategory)
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "ugc", entitlement.trialEndsAt);
    }

    return accepted({
      jobId:            job.id,
      externalJobId:    job.externalJobId,
      status:           job.status,
      url:              job.result?.url,
      assetId,
      estimatedCredits: job.estimatedCredits,
    });
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      const status = dispatchErrorStatus(err.code);
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    console.error("[/api/studio/ugc/generate]", err);
    return serverErr();
  }
}
