/**
 * GET /api/character/ai-influencers/:id/packs
 *
 * Fetches persisted pack assets for a locked influencer from influencer_assets.
 * Used to hydrate the Identity Sheet library on influencer selection — so previously
 * generated sheets appear immediately without requiring a new generation.
 *
 * Query params:
 *   asset_type       — required. e.g. "identity-sheet"
 *   identity_lock_id — required. Scopes results to the active lock.
 *
 * Response:
 *   200 { success: true, data: { assets: [{ url, thumbnail_url, shot_index, label }] } }
 *
 * Assets are ordered by shot_index ascending (shot_index extracted from metadata JSONB).
 */

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
 *
 * IDENTITY SHEET — special execution path:
 *   Uses the sequential growing-memory chain (buildIdentityChain) rather than
 *   parallel dispatch. Each shot awaits the previous shot's confirmed output
 *   before dispatching, so every shot has visual memory of all prior outputs.
 *
 *   The chain is synchronous and server-side — this route stays open for the
 *   full chain duration (up to ~300s for 5 shots). maxDuration = 300 covers
 *   the Vercel Pro server timeout.
 *
 *   The response shape is identical to non-identity-sheet packs for UI
 *   compatibility: jobs array with jobId/externalJobId/status/label.
 *   Completed chain shots will have status="completed" when the response arrives.
 */

import { requireAuthUser }    from "@/lib/supabase/server";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                              from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, parseBody, ok }
                              from "@/lib/api/route-utils";
import { checkEntitlement, consumeTrialUsage }
                              from "@/lib/billing/entitlement";
import { checkStudioRateLimit } from "@/lib/security/rate-limit";
import { getInfluencerContext, InfluencerContextError }
                              from "@/lib/influencer/context-service";
import { buildPackPrompt }    from "@/lib/influencer/pack-prompts";
import { buildIdentityChain, ChainError }
                              from "@/lib/influencer/identity-chain";
import type { PackType }      from "@/lib/influencer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extend Vercel server timeout for identity sheet chain.
 * Sequential 5-shot chain with server-side polling can take 150–300 seconds.
 * Requires Vercel Pro. Standard plan supports max 60s.
 */
export const maxDuration = 300;

const VALID_PACK_TYPES: PackType[] = [
  "identity-sheet", "look-pack", "scene-pack", "pose-pack", "social-pack",
];

// "nano-banana-pro-identity" is the primary post-lock identity sheet provider.
// It routes through Nano Banana Pro's multi-reference generative conditioning,
// enabling the growing-memory chain to meaningfully accumulate across all 5 shots.
//
// To revert to single-reference instant-character (Identity Sheet v1):
//   const DEFAULT_MODEL_KEY = "instant-character";
const DEFAULT_MODEL_KEY = "nano-banana-pro-identity";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  // ── Query params ─────────────────────────────────────────────────────────────
  const url          = new URL(req.url);
  const asset_type   = url.searchParams.get("asset_type");
  const identity_lock_id = url.searchParams.get("identity_lock_id");

  if (!asset_type || !identity_lock_id) {
    return invalidInput("asset_type and identity_lock_id are required");
  }

  // ── Ownership check — confirm influencer belongs to this user ───────────────
  const { data: influencer, error: influencerErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id")
    .eq("id", influencer_id)
    .single();

  if (influencerErr || !influencer) {
    return Response.json({ success: false, error: "Influencer not found" }, { status: 404 });
  }
  if (influencer.user_id !== userId) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // ── Fetch from influencer_assets ─────────────────────────────────────────────
  // metadata->shot_index is an integer stored as JSONB. Ordering by it numerically
  // requires casting through text; this is safe because shot_index is always 0-4.
  const { data: assets, error: assetsErr } = await supabaseAdmin
    .from("influencer_assets")
    .select("url, thumbnail_url, metadata")
    .eq("influencer_id", influencer_id)
    .eq("identity_lock_id", identity_lock_id)
    .eq("asset_type", asset_type)
    .order("created_at", { ascending: true });

  if (assetsErr) {
    console.error("[packs/GET] influencer_assets query failed:", assetsErr);
    return serverErr("Failed to fetch pack assets");
  }

  // Map to client shape — derive shot_index + label from metadata
  type AssetRow = {
    url: string;
    thumbnail_url: string;
    metadata: Record<string, unknown> | null;
  };
  const mapped = (assets as AssetRow[]).map((a) => {
    const meta       = a.metadata ?? {};
    const shot_index = typeof meta.shot_index === "number" ? meta.shot_index : null;
    const label      = shot_index !== null ? `Shot ${shot_index + 1}` : "Identity Shot";
    return {
      url:           a.url,
      thumbnail_url: a.thumbnail_url ?? a.url,
      shot_index,
      label,
    };
  });

  // Sort by shot_index ascending (nulls last)
  mapped.sort((a, b) => {
    if (a.shot_index === null && b.shot_index === null) return 0;
    if (a.shot_index === null) return 1;
    if (b.shot_index === null) return -1;
    return a.shot_index - b.shot_index;
  });

  return ok({ assets: mapped });
}

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

  // ── Trial usage (fire-and-forget — same for both execution paths) ─────────────
  const maybeConsumeTrialUsage = () => {
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "character", entitlement.trialEndsAt);
    }
  };

  // ── IDENTITY SHEET — sequential growing-memory chain ─────────────────────────
  // All other pack types use the parallel dispatch loop below.
  // Identity sheet uses buildIdentityChain() which:
  //   1. Resolves canonical URL to permanent Supabase Storage URL (or fails hard)
  //   2. Dispatches shots sequentially, awaiting each before the next
  //   3. Accumulates confirmed outputs as references: [c]→[c,s1]→[c,s1,s2]→…
  //   4. Writes all 9 chain metadata fields to influencer_assets per shot
  if (pack_type === "identity-sheet") {
    try {
      const chainResult = await buildIdentityChain({
        userId,
        influencer_id,
        identity_lock_id,
        canonical_asset_id,
        canonical_url: ctx.canonical_asset.url,
        shots:         packItems,
        modelKey,
      });

      maybeConsumeTrialUsage();

      // Map chain shots to the standard jobs response shape.
      // Shots are already completed by the time the chain returns, so the client
      // receives completed job IDs and can link assets without polling.
      const jobs = chainResult.shots.map(s => ({
        jobId:         s.jobId,
        externalJobId: s.externalJobId,
        status:        s.status,
        label:         s.label,
        // Confirmed permanent URL — only present on completed shots.
        // UI should extract this directly instead of calling pollJobForUrl
        // when chain_mode === true (avoids redundant polling for completed shots).
        ...(s.url ? { url: s.url } : {}),
      }));

      return ok({
        jobs,
        pack_type,
        influencer_id,
        job_count:        jobs.length,
        chain_session_id: chainResult.chain_session_id,
        chain_mode:       true,
      });

    } catch (err) {
      // ChainError — canonical unavailable or all shots failed
      if (err instanceof ChainError) {
        if (err.code === "CHAIN_CANONICAL_UNAVAILABLE") {
          return Response.json(
            {
              success: false,
              error:   err.message,
              code:    "CHAIN_CANONICAL_UNAVAILABLE",
              hint:    "The canonical image needs to be saved to Zencra Storage before generating an identity sheet. Please retry.",
            },
            { status: 409 },
          );
        }
        return serverErr(err.message);
      }
      // StudioDispatchError from billing — surface the code to the client
      if (err instanceof StudioDispatchError) {
        return Response.json(
          { success: false, error: err.message, code: err.code },
          { status: dispatchErrorStatus(err.code) },
        );
      }
      console.error("[packs] identity-sheet chain failed:", err);
      return serverErr("Identity sheet generation failed");
    }
  }

  // ── Parallel dispatch — all non-identity-sheet pack types ────────────────────
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

  maybeConsumeTrialUsage();

  return accepted({ jobs, pack_type, influencer_id, job_count: jobs.length });
}
