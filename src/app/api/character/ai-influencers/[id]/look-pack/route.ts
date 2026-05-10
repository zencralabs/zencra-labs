/**
 * POST /api/character/ai-influencers/:id/look-pack
 *
 * Step 6B — Look Pack Generation
 *
 * Generates 4 outfit/style variations for a locked influencer using FLUX Kontext
 * (fal-ai/flux-pro/kontext) — an identity-preserving image-to-image provider.
 *
 * IDENTITY CONTRACT: identity_lock_id + canonical_asset_id are MANDATORY.
 * The canonical asset URL is forwarded as the source image for FLUX Kontext.
 *
 * Provider: FLUX Kontext (studio: "image", modelKey: "flux-kontext")
 * This is separate from the generic /packs route which uses instant-character.
 *
 * Request body:
 *   {
 *     identity_lock_id: string,
 *     canonical_asset_id: string
 *   }
 *
 * Response (202):
 *   { success: true, data: { jobs: [{ jobId, externalJobId, status, label }], influencer_id } }
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// BFL Kontext — direct Black Forest Labs API for identity-preserving Look Pack generation.
// Architecture lock (2026-05-10): Look Pack uses direct BFL API, NOT fal-hosted flux-kontext.
//   Instant Character (fal.ai)   → influencer candidate generation
//   bfl-kontext (direct BFL API) → Look Pack identity-preserving variation
//   flux-kontext (fal.ai)        → Image Studio general context editing (unchanged)
//
// Dispatched as studio: "image" so the universal polling engine uses the
// correct status route (/api/studio/jobs/:id/status) and stale threshold.
const LOOK_PACK_MODEL_KEY = "bfl-kontext";
const LOOK_PACK_STUDIO    = "image" as const;

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

  // ── Identity contract enforcement ────────────────────────────────────────────
  const identity_lock_id   = typeof body?.identity_lock_id   === "string" ? body.identity_lock_id   : null;
  const canonical_asset_id = typeof body?.canonical_asset_id === "string" ? body.canonical_asset_id : null;

  if (!identity_lock_id || !canonical_asset_id) {
    return invalidInput("IDENTITY_REQUIRED: identity_lock_id and canonical_asset_id are mandatory for look pack generation");
  }

  // ── Context fetch + validation ───────────────────────────────────────────────
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

  // ── Billing entitlement — image studio (FLUX Kontext) ────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, LOOK_PACK_STUDIO);
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json(
        { success: false, error: (err as StudioDispatchError).message, code: (err as StudioDispatchError).code },
        { status: dispatchErrorStatus((err as StudioDispatchError).code) },
      );
    }
    return serverErr();
  }

  // ── Build look pack prompts (4 variations: Casual, Editorial, Statement, Refined) ──
  const packItems = buildPackPrompt("look-pack", ctx);

  // ── Dispatch all look pack jobs via FLUX Kontext ─────────────────────────────
  const jobs: Array<{
    jobId: string; externalJobId: string | null; status: string; label: string;
  }> = [];

  for (const item of packItems) {
    try {
      const { job } = await studioDispatch({
        userId,
        studio:      LOOK_PACK_STUDIO,
        modelKey:    LOOK_PACK_MODEL_KEY,
        prompt:      item.prompt,
        // canonical asset URL → FLUX Kontext source image for identity consistency
        imageUrl:    item.referenceUrl,
        aspectRatio: item.aspectRatio ?? "2:3",
      });

      // Record in influencer_generation_jobs — satisfies DB constraint:
      // job_type='look-pack' requires identity_lock_id IS NOT NULL AND canonical_asset_id IS NOT NULL
      await supabaseAdmin.from("influencer_generation_jobs").insert({
        influencer_id,
        identity_lock_id,
        canonical_asset_id,
        job_type:          "look-pack",
        status:            job.status,
        external_job_id:   job.externalJobId,
        prompt:            item.prompt,
        pack_label:        item.label,
        model_key:         LOOK_PACK_MODEL_KEY,
        aspect_ratio:      item.aspectRatio ?? "2:3",
        estimated_credits: job.estimatedCredits,
        metadata: { pack_type: "look-pack", label: item.label, provider: "flux-kontext" },
      });

      jobs.push({
        jobId:         job.id,
        externalJobId: job.externalJobId ?? null,
        status:        job.status,
        label:         item.label,
      });
    } catch (err) {
      console.error(`[look-pack] job "${item.label}" dispatch failed:`, err);
    }
  }

  if (jobs.length === 0) return serverErr("All look pack jobs failed to dispatch");

  // ── Trial usage (fire-and-forget) ────────────────────────────────────────────
  if (entitlement.path === "trial" && entitlement.trialEndsAt) {
    void consumeTrialUsage(userId, LOOK_PACK_STUDIO, entitlement.trialEndsAt);
  }

  return accepted({ jobs, influencer_id, job_count: jobs.length, pack_type: "look-pack" });
}
