/**
 * POST /api/character/ai-influencers/generate
 *
 * Generates 4–6 candidate images for a new AI influencer.
 * This is the ONLY route that runs without an identity lock.
 * All subsequent generation (packs, refine) requires identity_lock_id.
 *
 * Request body:
 *   {
 *     influencer_id: string,
 *     model_key: string,
 *     candidate_count?: number  (4–6, default 4)
 *   }
 *
 * Response:
 *   202 { success: true, data: { jobs: [...] } }
 */

import { requireAuthUser }   from "@/lib/supabase/server";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                             from "@/lib/api/studio-dispatch";
import { ok, accepted, invalidInput, serverErr, parseBody }
                             from "@/lib/api/route-utils";
import { checkEntitlement, consumeTrialUsage }
                             from "@/lib/billing/entitlement";
import { checkStudioRateLimit } from "@/lib/security/rate-limit";
import { composeInfluencerPrompt } from "@/lib/influencer/pack-prompts";
import type { AIInfluencerProfile, StyleCategory } from "@/lib/influencer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CANDIDATE_COUNT = 4;
const MAX_CANDIDATE_COUNT     = 6;
// fal.ai Instant Character — primary influencer candidate generation engine.
// "flux-character" remains registered as the polling fallback via the character registry.
const DEFAULT_MODEL_KEY       = "instant-character";
const DEFAULT_ASPECT_RATIO    = "2:3";

// ── Mock candidate URLs ───────────────────────────────────────────────────────
// Used as a fallback when all provider dispatch attempts fail (e.g. provider
// not yet live in this environment). Lets the full candidate UI be tested
// end-to-end without a working AI provider.
// Remove this block once the character image provider is operational.
// Dedicated influencer placeholder images (360×480 portrait, dark gradient).
// These live in public/mock/influencers/ — NOT homepage hero assets.
const MOCK_CANDIDATE_URLS = [
  "/mock/influencers/candidate-01.jpg",
  "/mock/influencers/candidate-02.jpg",
  "/mock/influencers/candidate-03.jpg",
  "/mock/influencers/candidate-04.jpg",
];

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const influencer_id = typeof body?.influencer_id === "string" ? body.influencer_id : null;
  if (!influencer_id) return invalidInput("influencer_id is required");

  const candidateCount = Math.min(
    typeof body?.candidate_count === "number" ? body.candidate_count : DEFAULT_CANDIDATE_COUNT,
    MAX_CANDIDATE_COUNT,
  );
  const modelKey    = typeof body?.model_key    === "string" ? body.model_key    : DEFAULT_MODEL_KEY;
  const aspectRatio = typeof body?.aspect_ratio === "string" ? body.aspect_ratio : DEFAULT_ASPECT_RATIO;
  // Mixed/Blended heritage regions — forwarded to prompt composer when ≥2 regions selected.
  const mixedBlendRegions: string[] = Array.isArray(body?.mixed_blend_regions)
    ? (body.mixed_blend_regions as unknown[]).filter((r): r is string => typeof r === "string")
    : [];

  // ── Verify influencer ownership ─────────────────────────────────────────────
  const { data: influencer, error: infErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, name, style_category, tags")
    .eq("id", influencer_id)
    .eq("user_id", userId)
    .single();

  if (infErr || !influencer) return invalidInput("Influencer not found");

  // ── Fetch profile ────────────────────────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("ai_influencer_profiles")
    .select("*")
    .eq("influencer_id", influencer_id)
    .single();

  // Resolve the profile fallback shape for when no profile row exists yet.
  // composeInfluencerPrompt will still produce a valid cinematic prompt from
  // the style category alone — all identity fields are optional.
  const safeProfile = (profile ?? {
    id: "", influencer_id, gender: null, age_range: null, skin_tone: null,
    face_structure: null, fashion_style: null, realism_level: "photorealistic",
    mood: [], platform_intent: [], appearance_notes: null,
    created_at: "", updated_at: "",
  }) as AIInfluencerProfile;

  const styleCategory = (influencer.style_category ?? "hyper-real") as StyleCategory;
  const rosterTags    = Array.isArray((influencer as Record<string, unknown>).tags)
    ? (influencer as Record<string, unknown>).tags as string[]
    : [];

  // ── Billing entitlement ──────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "character");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json(
        { success: false, error: err.message, code: err.code },
        { status: dispatchErrorStatus(err.code) },
      );
    }
    return serverErr();
  }

  // ── Dispatch candidate generation jobs ───────────────────────────────────────
  const jobs: Array<{ jobId: string; externalJobId: string | null; status: string }> = [];

  for (let i = 0; i < candidateCount; i++) {
    try {
      // Compose a cinematic prompt for this candidate.
      // Each candidate gets a different persona energy variant (same style DNA,
      // different personality direction — casting diversity, not random strangers).
      // image_url is NOT sent for initial casting (Option A: pre-lock = diversity mode).
      // reference_image_url is only used post-lock in pack generation.
      const composed = composeInfluencerPrompt({
        profile:          safeProfile,
        styleCategory,
        rosterTags,
        candidateIndex:   i,
        candidateCount,
        mixedBlendRegions: mixedBlendRegions.length >= 2 ? mixedBlendRegions : undefined,
      });

      // Append [c:N/M] idempotency suffix so the dedup layer (keyed on
      // userId+modelKey+prompt+5-min bucket) treats each candidate as a
      // distinct job — even if two candidates share similar prose.
      const candidatePrompt = candidateCount > 1
        ? `${composed.prompt} [c:${i + 1}/${candidateCount}]`
        : composed.prompt;

      // Dev logging — prompt visible in terminal, never in UI or DB UI layer
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[instant-character] candidate ${i + 1}/${candidateCount} prompt:`,
          candidatePrompt,
        );
        console.log(
          `[instant-character] candidate ${i + 1}/${candidateCount} style: ${styleCategory} | tags: [${rosterTags.join(", ")}]`,
        );
      }

      const { job, assetId } = await studioDispatch({
        userId,
        studio:         "character",
        modelKey,
        prompt:         candidatePrompt,
        negativePrompt: composed.negativePrompt,
        aspectRatio,
        identity:       { character_id: influencer_id },
      });

      // Record job in influencer_generation_jobs
      // asset_job_id links this row to the generations asset record so the
      // polling route and Activity Center can look up the canonical asset.
      await supabaseAdmin.from("influencer_generation_jobs").insert({
        influencer_id,
        identity_lock_id:  null,  // no lock yet — this is candidate generation
        canonical_asset_id: null,
        job_type:          "generate",
        status:            job.status,
        external_job_id:   job.externalJobId,
        prompt:            composed.prompt,  // base prompt without idempotency suffix
        pack_label:        `Candidate ${i + 1}`,
        model_key:         modelKey,
        aspect_ratio:      aspectRatio,
        estimated_credits: job.estimatedCredits,
        metadata:          { candidate_index: i, asset_job_id: assetId ?? null },
      });

      jobs.push({
        jobId:         job.id,
        externalJobId: job.externalJobId ?? null,
        status:        job.status,
      });
    } catch (err) {
      console.error(`[generate] candidate ${i + 1} dispatch failed:`, err);
      // Continue — partial batch is better than full failure
    }
  }

  if (jobs.length === 0) {
    // ── Mock fallback — provider not live yet ─────────────────────────────────
    // All real dispatch attempts failed (most likely: model not registered in
    // character studio or provider API key not configured). Return mock image
    // URLs so the full candidate selection UI can be tested end-to-end.
    // The canvas will surface these as real candidates — selection + lock flow
    // works identically. Remove this block once the provider is operational.
    console.warn("[generate] All real dispatch attempts failed — returning mock candidates for UI testing.");
    return accepted({
      jobs:            [],
      influencer_id,
      candidate_count: 0,
      mock_candidates: MOCK_CANDIDATE_URLS.slice(0, candidateCount),
    });
  }

  // ── Trial usage (fire-and-forget) ────────────────────────────────────────────
  if (entitlement.path === "trial" && entitlement.trialEndsAt) {
    void consumeTrialUsage(userId, "character", entitlement.trialEndsAt);
  }

  return accepted({ jobs, influencer_id, candidate_count: jobs.length });
}
