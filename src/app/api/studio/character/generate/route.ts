/**
 * POST /api/studio/character/generate
 *
 * Dispatches a character generation job through the provider orchestrator.
 * Feature-flagged: requires Character Studio to be enabled.
 *
 * Supported models (Phase 1, flag-gated):
 *   flux-character (FLUX.1 Pro via fal.ai)
 *   stability-character (Stable Diffusion 3)
 *
 * Character generation always carries an optional IdentityContext — used to
 * link the output to a persistent digital human (character_id / soul_id).
 * If character_id is provided, it is stored in the asset record for
 * cross-studio reference and consistency tracking.
 *
 * Request body:
 *   { modelKey, prompt, imageUrl?, aspectRatio?, negativePrompt?, seed?,
 *     identity?: { character_id?, soul_id?, reference_urls? }, providerParams? }
 *
 * Response:
 *   202 { success: true, data: { jobId, status, url?, assetId, estimatedCredits } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 FEATURE_DISABLED
 *   400 INVALID_INPUT
 *   402 INSUFFICIENT_CREDITS
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { guardStudio }               from "@/lib/api/feature-gate";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, parseBody, requireField }
                                     from "@/lib/api/route-utils";
import type { IdentityContext }      from "@/lib/providers/core/types";
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
  const gate = guardStudio("character");
  if (gate) return gate;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "character");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/character/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  // ── Model integrity ──────────────────────────────────────────────────────────
  try {
    assertModelRouteIntegrity(modelKey!, "character");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  const imageUrl       = typeof body!.imageUrl       === "string" ? body!.imageUrl       : undefined;
  const aspectRatio    = typeof body!.aspectRatio    === "string" ? body!.aspectRatio    : undefined;
  const negativePrompt = typeof body!.negativePrompt === "string" ? body!.negativePrompt : undefined;
  const seed           = typeof body!.seed           === "number" ? body!.seed           : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  // Identity context — validate structure if provided
  let identity: IdentityContext | undefined;
  if (body!.identity && typeof body!.identity === "object") {
    const raw = body!.identity as Record<string, unknown>;
    identity = {
      character_id:   typeof raw.character_id   === "string" ? raw.character_id   : undefined,
      soul_id:        typeof raw.soul_id         === "string" ? raw.soul_id         : undefined,
      reference_urls: Array.isArray(raw.reference_urls)
        ? (raw.reference_urls as unknown[]).filter(u => typeof u === "string") as string[]
        : undefined,
    };
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      studio:        "character",
      modelKey:      modelKey!,
      prompt:        prompt!,
      imageUrl,
      aspectRatio,
      negativePrompt,
      seed,
      identity,
      providerParams,
    });

    // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
    // character maps to the "images" trial category (resolveTrialCategory)
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "character", entitlement.trialEndsAt);
    }

    return accepted({
      jobId:            job.id,
      externalJobId:    job.externalJobId,
      status:           job.status,
      url:              job.result?.url,
      assetId,
      identity:         job.identity,
      estimatedCredits: job.estimatedCredits,
    });
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      const status = dispatchErrorStatus(err.code);
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    console.error("[/api/studio/character/generate]", err);
    return serverErr();
  }
}
