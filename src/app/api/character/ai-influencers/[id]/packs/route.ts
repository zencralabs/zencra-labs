/**
 * POST /api/character/ai-influencers/:id/packs
 *
 * Generates a content pack for a locked influencer.
 * IDENTITY CONTRACT: identity_lock_id + canonical_asset_id are MANDATORY.
 * Returns 400 IDENTITY_REQUIRED if either is absent.
 *
 * Pack types: identity-sheet | look-pack | scene-pack | pose-pack | social-pack
 *
 * Request body:
 *   {
 *     pack_type: PackType,
 *     identity_lock_id: string,
 *     canonical_asset_id: string,
 *     model_key?: string
 *   }
 *
 * Response:
 *   202 { success: true, data: { jobs: [...], pack_type } }
 */

import { requireAuthUser }    from "@/lib/supabase/server";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                              from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, parseBody }
                              from "@/lib/api/route-utils";
import { checkEntitlement, consumeTrialUsage }
                              from "@/lib/billing/entitlement";
import { checkStudioRateLimit } from "@/lib/security/rate-limit";
import { getInfluencerContext, InfluencerContextError }
                              from "@/lib/influencer/context-service";
import { buildPackPrompt }    from "@/lib/influencer/pack-prompts";
import type { PackType }      from "@/lib/influencer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PACK_TYPES: PackType[] = [
  "identity-sheet", "look-pack", "scene-pack", "pose-pack", "social-pack",
];

const DEFAULT_MODEL_KEY = "nb-standard";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  // ── LAYER 1: Identity contract enforcement ───────────────────────────────────
  const identity_lock_id   = typeof body?.identity_lock_id   === "string" ? body.identity_lock_id   : null;
  const canonical_asset_id = typeof body?.canonical_asset_id === "string" ? body.canonical_asset_id : null;

  if (!identity_lock_id || !canonical_asset_id) {
    return invalidInput("IDENTITY_REQUIRED: identity_lock_id and canonical_asset_id are mandatory for pack generation");
  }

  const pack_type = typeof body?.pack_type === "string" ? body.pack_type as PackType : null;
  if (!pack_type || !VALID_PACK_TYPES.includes(pack_type)) {
    return invalidInput(`pack_type must be one of: ${VALID_PACK_TYPES.join(", ")}`);
  }

  const modelKey = typeof body?.model_key === "string" ? body.model_key : DEFAULT_MODEL_KEY;

  // ── LAYER 2: Context fetch + validation ──────────────────────────────────────
  let ctx: Awaited<ReturnType<typeof getInfluencerContext>>;
  try {
    ctx = await getInfluencerContext(influencer_id, userId, identity_lock_id);
  } catch (err) {
    if (err instanceof InfluencerContextError) {
      return Response.json(
        { success: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return serverErr();
  }

  // ── Billing entitlement ──────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "character");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json(
        { success: false, error: (err as StudioDispatchError).message, code: (err as StudioDispatchError).code },
        { status: dispatchErrorStatus((err as StudioDispatchError).code) },
      );
    }
    return serverErr();
  }

  // ── Build pack prompts ────────────────────────────────────────────────────────
  const packItems = buildPackPrompt(pack_type, ctx);

  // ── Dispatch all pack jobs ────────────────────────────────────────────────────
  const jobs: Array<{
    jobId: string; externalJobId: string | null; status: string; label: string;
  }> = [];

  for (const item of packItems) {
    try {
      const { job } = await studioDispatch({
        userId,
        studio:      "character",
        modelKey,
        prompt:      item.prompt,
        imageUrl:    item.referenceUrl,    // canonical asset URL for identity consistency
        aspectRatio: item.aspectRatio ?? "1:1",
        identity:    {
          character_id:   influencer_id,
          reference_urls: item.referenceUrl ? [item.referenceUrl] : [],
        },
      });

      // Record in influencer_generation_jobs
      await supabaseAdmin.from("influencer_generation_jobs").insert({
        influencer_id,
        identity_lock_id,
        canonical_asset_id,       // snapshot at dispatch time
        job_type:          pack_type,
        status:            job.status,
        external_job_id:   job.externalJobId,
        prompt:            item.prompt,
        pack_label:        item.label,
        model_key:         modelKey,
        aspect_ratio:      item.aspectRatio ?? "1:1",
        estimated_credits: job.estimatedCredits,
        metadata:          { pack_type, label: item.label },
      });

      jobs.push({
        jobId:         job.id,
        externalJobId: job.externalJobId ?? null,
        status:        job.status,
        label:         item.label,
      });
    } catch (err) {
      console.error(`[packs] job "${item.label}" dispatch failed:`, err);
    }
  }

  if (jobs.length === 0) return serverErr("All pack jobs failed to dispatch");

  // ── Trial usage (fire-and-forget) ────────────────────────────────────────────
  if (entitlement.path === "trial" && entitlement.trialEndsAt) {
    void consumeTrialUsage(userId, "character", entitlement.trialEndsAt);
  }

  return accepted({ jobs, pack_type, influencer_id, job_count: jobs.length });
}
