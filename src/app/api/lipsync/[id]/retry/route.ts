// POST /api/lipsync/[id]/retry
// Re-submits a failed lip sync generation to the provider.
// Uses the same assets and settings as the original — no new credit charge.
// Only allowed when status === "failed".

import { NextResponse } from "next/server";
import { requireAuthUser }              from "@/lib/supabase/server";
import { supabaseAdmin }                from "@/lib/supabase/admin";
import { getLipSyncCredits }            from "@/lib/lipsync/credits";
import { getLipSyncProvider }           from "@/lib/providers/lipsync";
import type { LipSyncProviderKey }      from "@/lib/providers/lipsync";
import type { LipSyncQuality }          from "@/lib/lipsync/status";
import { prepareSourceVideoFromImage }  from "@/lib/lipsync/prepare-source-video";

export const maxDuration = 120;

const BUCKET        = "lipsync";
const AUDIO_URL_TTL = 7200;   // fal needs long-lived audio URL
const FACE_URL_TTL  = 600;    // short-lived — just for preprocessing

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;

  try {
    // ── 1. Load original generation ─────────────────────────────────────────
    const { data: gen, error: genError } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, status, provider, quality_mode, duration_seconds, aspect_ratio, credits_used, parameters")
      .eq("id", id)
      .single();

    if (genError || !gen) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      );
    }

    if (gen.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    if (gen.status !== "failed") {
      return NextResponse.json(
        { success: false, error: `Cannot retry a generation with status '${gen.status}'` },
        { status: 409 }
      );
    }

    // ── 2. Verify provider is ready ─────────────────────────────────────────
    const providerKey = gen.provider as LipSyncProviderKey;
    let adapter;
    try {
      adapter = getLipSyncProvider(providerKey);
    } catch {
      return NextResponse.json(
        { success: false, error: `Provider '${providerKey}' not registered` },
        { status: 503 }
      );
    }

    if (!adapter.isReady()) {
      return NextResponse.json(
        { success: false, error: "Provider not configured" },
        { status: 503 }
      );
    }

    // ── 3. Load original assets ─────────────────────────────────────────────
    const { data: inputs } = await supabaseAdmin
      .from("generation_inputs")
      .select("role, asset_id, assets(storage_path)")
      .eq("generation_id", id);

    const faceInput  = inputs?.find((i) => i.role === "source_face");
    const audioInput = inputs?.find((i) => i.role === "source_audio");

    if (!faceInput?.asset_id || !audioInput?.asset_id) {
      return NextResponse.json(
        { success: false, error: "Original assets not found — cannot retry" },
        { status: 422 }
      );
    }

    // Load storage paths from the asset records
    const { data: faceAsset }  = await supabaseAdmin.from("assets").select("storage_path").eq("id", faceInput.asset_id).single();
    const { data: audioAsset } = await supabaseAdmin.from("assets").select("storage_path").eq("id", audioInput.asset_id).single();

    if (!faceAsset?.storage_path || !audioAsset?.storage_path) {
      return NextResponse.json(
        { success: false, error: "Asset files not found in storage" },
        { status: 422 }
      );
    }

    // ── 4. Check user has credits for retry (re-charge) ────────────────────
    const qualityMode       = gen.quality_mode as LipSyncQuality ?? "standard";
    const audioDuration     = gen.duration_seconds ?? gen.parameters?.audio_duration_seconds ?? 0;
    const creditsRequired   = getLipSyncCredits({ qualityMode, durationSeconds: audioDuration });

    const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("id", user.id).single();

    if (!profile || profile.credits < creditsRequired) {
      return NextResponse.json(
        {
          success: false,
          error:   "Insufficient credits for retry",
          data:    { available: profile?.credits ?? 0, required: creditsRequired },
        },
        { status: 402 }
      );
    }

    // ── 5. Debit credits ────────────────────────────────────────────────────
    await supabaseAdmin.rpc("spend_credits", {
      p_user_id:       user.id,
      p_amount:        creditsRequired,
      p_description:   `Lip Sync retry (${qualityMode}, ${audioDuration}s)`,
      p_generation_id: gen.id,
    });

    // ── 6. Reset generation status ──────────────────────────────────────────
    await supabaseAdmin
      .from("generations")
      .update({
        status:      "queued",
        credits_used: creditsRequired,
        parameters: {
          ...gen.parameters,
          failure_reason: null,
          current_stage:  "submitting",
        },
      })
      .eq("id", id);

    // ── 7. Generate fresh signed URLs ───────────────────────────────────────
    const [faceSign, audioSign] = await Promise.all([
      supabaseAdmin.storage.from(BUCKET).createSignedUrl(faceAsset.storage_path,  FACE_URL_TTL),
      supabaseAdmin.storage.from(BUCKET).createSignedUrl(audioAsset.storage_path, AUDIO_URL_TTL),
    ]);

    if (!faceSign.data?.signedUrl || !audioSign.data?.signedUrl) {
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id:       user.id,
        p_amount:        creditsRequired,
        p_description:   "Lip Sync refund — retry asset URL generation failed",
        p_generation_id: gen.id,
      });
      await supabaseAdmin.from("generations").update({ status: "failed" }).eq("id", id);
      return NextResponse.json(
        { success: false, error: "Failed to generate asset signed URLs for retry" },
        { status: 500 }
      );
    }

    // ── 8. Re-run preprocessing: face image → source MP4 video ─────────────
    // fal-ai/sync-lipsync/v3 requires a video_url, not an image URL.
    // On retry we always redo preprocessing to get a fresh source video URL.
    let sourceVideoUrl = gen.parameters?.source_video_url as string | undefined;

    try {
      const sourceVideo = await prepareSourceVideoFromImage({
        faceSignedUrl: faceSign.data.signedUrl,
        audioDuration,
        aspectRatio:   (gen.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1",
      });
      sourceVideoUrl = sourceVideo.videoUrl;
    } catch (prepErr) {
      // If preprocessing fails, try using the cached source video URL from previous run
      if (!sourceVideoUrl) {
        await supabaseAdmin.rpc("refund_credits", {
          p_user_id:       user.id,
          p_amount:        creditsRequired,
          p_description:   "Lip Sync refund — retry preprocessing failed",
          p_generation_id: gen.id,
        });
        await supabaseAdmin.from("generations").update({ status: "failed" }).eq("id", id);
        const msg = prepErr instanceof Error ? prepErr.message : "Preprocessing failed";
        return NextResponse.json(
          { success: false, error: `Source video preprocessing failed: ${msg}` },
          { status: 500 }
        );
      }
      console.warn("[lipsync/retry] preprocessing failed, reusing cached source video URL:", prepErr);
    }

    // ── 9. Re-submit to provider ────────────────────────────────────────────
    let submitResult: { providerTaskId: string; statusUrl?: string; responseUrl?: string; cancelUrl?: string };
    try {
      const result = await adapter.submitJob({
        generationId:    gen.id,
        videoUrl:        sourceVideoUrl!,
        audioUrl:        audioSign.data.signedUrl,
        aspectRatio:     (gen.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1",
        durationSeconds: audioDuration,
        syncMode:        (gen.parameters?.sync_mode ?? "cut_off") as "cut_off",
      });
      submitResult = result;
    } catch (submitErr) {
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id:       user.id,
        p_amount:        creditsRequired,
        p_description:   "Lip Sync refund — retry provider submission failed",
        p_generation_id: gen.id,
      });
      await supabaseAdmin.from("generations").update({
        status:     "failed",
        parameters: { ...gen.parameters, failure_reason: String(submitErr) },
      }).eq("id", id);
      return NextResponse.json(
        { success: false, error: `Provider error on retry: ${submitErr instanceof Error ? submitErr.message : submitErr}` },
        { status: 502 }
      );
    }

    // ── 10. Update with new fal metadata ────────────────────────────────────
    await supabaseAdmin
      .from("generations")
      .update({
        status:     "processing",
        parameters: {
          ...gen.parameters,
          source_video_url:  sourceVideoUrl,
          provider_task_id:  submitResult.providerTaskId,
          fal_request_id:    submitResult.providerTaskId,
          fal_status_url:    submitResult.statusUrl   ?? null,
          fal_response_url:  submitResult.responseUrl ?? null,
          fal_cancel_url:    submitResult.cancelUrl   ?? null,
          failure_reason:    null,
          current_stage:     "submitted_to_provider",
        },
      })
      .eq("id", id);

    return NextResponse.json({
      success:       true,
      generation_id: gen.id,
      status:        "processing",
      credits_used:  creditsRequired,
    });
  } catch (err) {
    console.error("[lipsync/retry]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
