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
import { checkStudioRateLimit, checkConcurrentInfluencerJobsLimit } from "@/lib/security/rate-limit";
import { composeInfluencerPrompt } from "@/lib/influencer/pack-prompts";
import { selectInfluencerSeed, seedResolutionLabel } from "@/lib/influencer/seed-selector";
import type { AIInfluencerProfile, StyleCategory } from "@/lib/influencer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CANDIDATE_COUNT = 4;
const MAX_CANDIDATE_COUNT     = 6;
// Nano Banana Pro (character studio alias) — initial casting engine.
// True text-to-image: candidate faces are driven by the prompt, not seed image DNA.
// Same async polling architecture as Seedream V5, lower cost: 12 cr vs 15 cr/candidate.
// To roll back to Seedream V5: change this to "seedream-v5-identity".
// To revert to Instant Character (i2i): change this to "instant-character".
const DEFAULT_MODEL_KEY       = "nano-banana-pro-casting";
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

  // ── S3-D: Concurrent job cap ──────────────────────────────────────────────
  const concurrentLimitError = await checkConcurrentInfluencerJobsLimit(userId);
  if (concurrentLimitError) return concurrentLimitError;

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

  // Body Architecture — transient casting params (not persisted to DB).
  const bodyType  = typeof body?.body_type  === "string" ? body.body_type  : undefined;
  const leftArm   = typeof body?.left_arm   === "string" ? body.left_arm   : undefined;
  const rightArm  = typeof body?.right_arm  === "string" ? body.right_arm  : undefined;
  const leftLeg   = typeof body?.left_leg   === "string" ? body.left_leg   : undefined;
  const rightLeg  = typeof body?.right_leg  === "string" ? body.right_leg  : undefined;
  const skinArt: string[] = Array.isArray(body?.skin_art)
    ? (body.skin_art as unknown[]).filter((s): s is string => typeof s === "string")
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
        profile:           safeProfile,
        styleCategory,
        rosterTags,
        candidateIndex:    i,
        candidateCount,
        mixedBlendRegions: mixedBlendRegions.length >= 2 ? mixedBlendRegions : undefined,
        bodyType,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        skinArt:           skinArt.length > 0 ? skinArt : undefined,
      });

      // Append [c:N/M] idempotency suffix so the dedup layer (keyed on
      // userId+modelKey+prompt+5-min bucket) treats each candidate as a
      // distinct job — even if two candidates share similar prose.
      const candidatePrompt = candidateCount > 1
        ? `${composed.prompt} [c:${i + 1}/${candidateCount}]`
        : composed.prompt;

      // ── Demographic seed selection ─────────────────────────────────────────
      // Each candidate gets a seed matched to the profile's gender + ethnicity.
      // This replaces the single global INSTANT_CHARACTER_SEED_IMAGE_URL seed
      // which caused all candidates to inherit the same woman's facial DNA.
      const demographicSeed = selectInfluencerSeed(safeProfile, i);

      // Dev logging — prompt + seed visible in terminal, never in UI or DB
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[character-casting] candidate ${i + 1}/${candidateCount} prompt:`,
          candidatePrompt,
        );
        console.log(
          `[character-casting] candidate ${i + 1}/${candidateCount} style: ${styleCategory} | tags: [${rosterTags.join(", ")}]`,
        );
        console.log(
          `[character-casting] candidate ${i + 1}/${candidateCount} ${seedResolutionLabel(safeProfile, i, demographicSeed)}`,
        );
      } else {
        // Production: log seed resolution label only (not the URL)
        console.log(
          `[character-casting] candidate ${i + 1}/${candidateCount} ${seedResolutionLabel(safeProfile, i, demographicSeed)}`,
        );
      }

      const { job, assetId } = await studioDispatch({
        userId,
        studio:         "character",
        modelKey,
        prompt:         candidatePrompt,
        negativePrompt: composed.negativePrompt,
        aspectRatio,
        // No imageUrl: seedream-v5-identity is pure text-to-image.
        // Demographic seeds (seed-selector.ts) are still resolved for logging
        // but not sent to the provider. They will be used post-lock when
        // Instant Character handles reference-based pack generation.
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
