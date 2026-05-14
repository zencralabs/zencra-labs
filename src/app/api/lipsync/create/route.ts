// src/app/api/lipsync/create/route.ts

// POST /api/lipsync/create
//
// Full pipeline:
//   auth → validate assets → validate credits → preprocess image → video
//   → debit credits → submit to fal → store metadata → return generation ID
//
// The portrait image is converted to a source MP4 before being sent to
// fal-ai/sync-lipsync/v3 (which requires video_url, not image_url).

import { NextResponse } from "next/server";
import { requireAuthUser }              from "@/lib/supabase/server";
import { supabaseAdmin }                from "@/lib/supabase/admin";
import { getLipSyncCredits }            from "@/lib/lipsync/credits";
import { validateAudioDuration }        from "@/lib/lipsync/validation";
import { prepareSourceVideoFromImage }  from "@/lib/lipsync/prepare-source-video";
import {
  getLipSyncProvider,
  resolveProviderKey,
} from "@/lib/providers/lipsync";
import type { LipSyncQuality } from "@/lib/lipsync/status";
import { checkEntitlement }               from "@/lib/billing/entitlement";
import { StudioDispatchError, dispatchErrorStatus }
                                           from "@/lib/api/studio-dispatch";

export const maxDuration = 120;  // seconds — allows time for preprocessing + submit

const BUCKET        = "lipsync";
const AUDIO_URL_TTL = 7200;      // 2 hours — enough for fal to fetch the audio
const FACE_URL_TTL  = 600;       // 10 minutes — just for preprocessing step

export async function POST(req: Request) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  // Must run before body parsing, asset loading, credit deduction, and provider
  // submission. Blocks free-tier users (paid-only), trial-expired users,
  // users with inactive subscriptions, and trial-exhausted users.
  try {
    await checkEntitlement(user!.id, "lipsync");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: dispatchErrorStatus(err.code) }
      );
    }
    console.error("[lipsync/create] entitlement check failed:", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }

  try {
    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json() as {
      source_face_asset_id?:  string;
      source_audio_asset_id?: string;
      quality_mode?:          LipSyncQuality;
      duration_seconds?:      number;
      aspect_ratio?:          string;
    };

    const {
      source_face_asset_id,
      source_audio_asset_id,
      quality_mode   = "pro",     // default to pro (fal-backed tier)
      duration_seconds,
      aspect_ratio   = "9:16",
    } = body;

    if (!source_face_asset_id || !source_audio_asset_id) {
      return NextResponse.json(
        { success: false, error: "source_face_asset_id and source_audio_asset_id are required" },
        { status: 400 }
      );
    }

    if (!["standard", "pro"].includes(quality_mode)) {
      return NextResponse.json(
        { success: false, error: "quality_mode must be 'standard' or 'pro'" },
        { status: 400 }
      );
    }

    if (!["9:16", "16:9", "1:1"].includes(aspect_ratio)) {
      return NextResponse.json(
        { success: false, error: "aspect_ratio must be '9:16', '16:9', or '1:1'" },
        { status: 400 }
      );
    }

    const typedAspectRatio = aspect_ratio as "9:16" | "16:9" | "1:1";

    // ── 3. Verify provider is ready ──────────────────────────────────────────
    const providerKey = resolveProviderKey(quality_mode);
    const provider    = getLipSyncProvider(providerKey);

    if (!provider.isReady()) {
      return NextResponse.json(
        { success: false, error: "Lip sync provider not configured — coming soon" },
        { status: 503 }
      );
    }

    // ── 4. Load + verify asset ownership ────────────────────────────────────
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("assets")
      .select("id, asset_type, storage_path, duration_seconds, user_id")
      .in("id", [source_face_asset_id, source_audio_asset_id]);

    if (assetsError) {
      return NextResponse.json(
        { success: false, error: assetsError.message },
        { status: 500 }
      );
    }

    const faceAsset  = assets?.find(a => a.id === source_face_asset_id);
    const audioAsset = assets?.find(a => a.id === source_audio_asset_id);

    if (!faceAsset || faceAsset.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Face asset not found or access denied" },
        { status: 404 }
      );
    }

    if (!audioAsset || audioAsset.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Audio asset not found or access denied" },
        { status: 404 }
      );
    }

    // ── 5. Validate audio duration ───────────────────────────────────────────
    const audioDuration = duration_seconds ?? audioAsset.duration_seconds ?? 0;
    const durVal = validateAudioDuration(audioDuration);
    if (!durVal.valid) {
      return NextResponse.json(
        { success: false, error: durVal.error },
        { status: 422 }
      );
    }

    // ── 6. Calculate credits ─────────────────────────────────────────────────
    const creditsRequired = getLipSyncCredits({
      qualityMode:     quality_mode,
      durationSeconds: audioDuration,
    });

    // ── 7. Check user balance ────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    if (profile.credits < creditsRequired) {
      return NextResponse.json(
        {
          success: false,
          error:   "Insufficient credits",
          code:    "INSUFFICIENT_CREDITS",
          data:    { available: profile.credits, required: creditsRequired },
        },
        { status: 402 }
      );
    }

    // ── 8. Generate signed URL for face image (short TTL — preprocessing only) ──
    const { data: faceSign, error: faceSignErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(faceAsset.storage_path, FACE_URL_TTL);

    if (faceSignErr || !faceSign?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to generate face image signed URL" },
        { status: 500 }
      );
    }

    // ── 9. Preprocess: portrait image → source MP4 video ────────────────────
    //
    // fal-ai/sync-lipsync/v3 requires video_url, not an image URL.
    // This step creates a still-image video from the portrait.
    let sourceVideo: Awaited<ReturnType<typeof prepareSourceVideoFromImage>>;
    try {
      sourceVideo = await prepareSourceVideoFromImage({
        faceSignedUrl: faceSign.signedUrl,
        audioDuration,
        aspectRatio:   typedAspectRatio,
      });
    } catch (prepErr) {
      const msg = prepErr instanceof Error ? prepErr.message : "Preprocessing failed";
      console.error("[lipsync/create] prepareSourceVideoFromImage failed:", msg);
      return NextResponse.json(
        { success: false, error: `Source video preprocessing failed: ${msg}` },
        { status: 500 }
      );
    }

    // ── 10. Create generation row (status: queued) ───────────────────────────
    const generationId = crypto.randomUUID();

    const { data: generation, error: genError } = await supabaseAdmin
      .from("generations")
      .insert({
        id:               generationId,
        user_id:          user.id,
        tool:             providerKey,
        tool_category:    "lipsync",
        prompt:           "",           // lipsync has no text prompt
        provider:         providerKey,
        engine:           "fal-ai/sync-lipsync/v3",
        quality_mode:     quality_mode,
        duration_seconds: audioDuration,
        aspect_ratio:     aspect_ratio,
        status:           "queued",
        credits_used:     creditsRequired,
        parameters: {
          generation_type:        "lipsync",
          input_kind:             "face_image",
          audio_kind:             "upload",
          source_face_asset_id,
          source_audio_asset_id,
          source_video_url:       sourceVideo.videoUrl,
          source_video_location:  sourceVideo.storageLocation,
          sync_mode:              "cut_off",
          current_stage:          "queued",
          failure_reason:         null,
          fal_request_id:         null,
          fal_status_url:         null,
          fal_response_url:       null,
          fal_cancel_url:         null,
        },
      })
      .select("id, status, credits_used")
      .single();

    if (genError) {
      return NextResponse.json(
        { success: false, error: genError.message },
        { status: 500 }
      );
    }

    // ── 11. Link assets as generation_inputs ─────────────────────────────────
    await supabaseAdmin.from("generation_inputs").insert([
      { generation_id: generationId, asset_id: source_face_asset_id,  role: "source_face"  },
      { generation_id: generationId, asset_id: source_audio_asset_id, role: "source_audio" },
    ]);

    // ── 12. Debit credits (before provider submission) ───────────────────────
    const { error: spendError } = await supabaseAdmin.rpc("spend_credits", {
      p_user_id:       user.id,
      p_amount:        creditsRequired,
      p_description:   `Lip Sync ${quality_mode} (${audioDuration}s)`,
      p_generation_id: generationId,
    });

    if (spendError) {
      console.error("[lipsync/create] spend_credits failed:", spendError.message);
      await supabaseAdmin
        .from("generations")
        .update({
          status:     "failed",
          parameters: { failure_reason: "credit_deduction_failed" },
        })
        .eq("id", generationId);
      return NextResponse.json(
        { success: false, error: "Credit deduction failed — please try again" },
        { status: 500 }
      );
    }

    // ── 13. Generate signed URL for audio (long TTL — fal needs to fetch it) ─
    const { data: audioSign, error: audioSignErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(audioAsset.storage_path, AUDIO_URL_TTL);

    if (audioSignErr || !audioSign?.signedUrl) {
      // Refund + fail
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id:       user.id,
        p_amount:        creditsRequired,
        p_description:   "Lip Sync refund — failed to generate audio URL",
        p_generation_id: generationId,
      });
      await supabaseAdmin.from("generations").update({ status: "failed" }).eq("id", generationId);
      return NextResponse.json(
        { success: false, error: "Failed to generate audio signed URL" },
        { status: 500 }
      );
    }

    // ── 14. Submit to fal ────────────────────────────────────────────────────
    let submitResult: Awaited<ReturnType<typeof provider.submitJob>>;
    try {
      submitResult = await provider.submitJob({
        generationId,
        videoUrl:        sourceVideo.videoUrl,   // preprocessed source video
        audioUrl:        audioSign.signedUrl,    // signed URL to uploaded audio
        aspectRatio:     typedAspectRatio,
        durationSeconds: audioDuration,
        syncMode:        "cut_off",
      });
    } catch (submitErr) {
      // Provider rejected — refund and fail
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id:       user.id,
        p_amount:        creditsRequired,
        p_description:   "Lip Sync refund — provider submission failed",
        p_generation_id: generationId,
      });
      const errMsg = submitErr instanceof Error ? submitErr.message : "Provider error";
      await supabaseAdmin
        .from("generations")
        .update({
          status:     "failed",
          parameters: { failure_reason: errMsg },
        })
        .eq("id", generationId);
      return NextResponse.json(
        { success: false, error: `Provider error: ${errMsg}` },
        { status: 502 }
      );
    }

    // ── 15. Update generation with fal metadata ───────────────────────────────
    await supabaseAdmin
      .from("generations")
      .update({
        status:     "processing",
        parameters: {
          generation_type:        "lipsync",
          input_kind:             "face_image",
          audio_kind:             "upload",
          source_face_asset_id,
          source_audio_asset_id,
          source_video_url:       sourceVideo.videoUrl,
          source_video_location:  sourceVideo.storageLocation,
          sync_mode:              "cut_off",
          current_stage:          "submitted_to_provider",
          failure_reason:         null,
          // fal-specific metadata — used by polling/status routes
          provider_task_id:       submitResult.providerTaskId,
          fal_request_id:         submitResult.providerTaskId,
          fal_status_url:         submitResult.statusUrl    ?? null,
          fal_response_url:       submitResult.responseUrl  ?? null,
          fal_cancel_url:         submitResult.cancelUrl    ?? null,
        },
      })
      .eq("id", generationId);

    // ── 16. Respond ───────────────────────────────────────────────────────────
    return NextResponse.json({
      success:          true,
      generation_id:    generationId,
      status:           "processing",
      credits_reserved: generation!.credits_used,
    });
  } catch (err) {
    console.error("[lipsync/create]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}