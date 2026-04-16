// POST /api/internal/lipsync/submit
// Internal route: submits a queued generation to its provider.
// Called by cron jobs, queue workers, or after a manual trigger.
// Secured by INTERNAL_API_SECRET — never exposed to the public.

import { NextResponse } from "next/server";
import { supabaseAdmin }               from "@/lib/supabase/admin";
import { getLipSyncProvider }          from "@/lib/providers/lipsync";
import type { LipSyncProviderKey }     from "@/lib/providers/lipsync";
import { prepareSourceVideoFromImage } from "@/lib/lipsync/prepare-source-video";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const BUCKET          = "lipsync";
const AUDIO_URL_TTL   = 7200;
const FACE_URL_TTL    = 600;

export async function POST(req: Request) {
  // ── Secret guard ─────────────────────────────────────────────────────────
  const auth = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || auth !== INTERNAL_SECRET) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { generation_id } = await req.json() as { generation_id?: string };

  if (!generation_id) {
    return NextResponse.json({ success: false, error: "generation_id required" }, { status: 400 });
  }

  const { data: gen, error: genError } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, status, provider, duration_seconds, aspect_ratio, parameters")
    .eq("id", generation_id)
    .single();

  if (genError || !gen) {
    return NextResponse.json({ success: false, error: "Generation not found" }, { status: 404 });
  }

  if (gen.status !== "queued") {
    return NextResponse.json({ success: false, error: `Generation is not queued (status: ${gen.status})` }, { status: 409 });
  }

  const providerKey = gen.provider as LipSyncProviderKey;
  let adapter;
  try {
    adapter = getLipSyncProvider(providerKey);
  } catch {
    return NextResponse.json({ success: false, error: `Unknown provider: ${providerKey}` }, { status: 503 });
  }

  if (!adapter.isReady()) {
    return NextResponse.json({ success: false, error: "Provider not configured" }, { status: 503 });
  }

  // Load asset storage paths
  const { data: inputs } = await supabaseAdmin
    .from("generation_inputs")
    .select("role, asset_id")
    .eq("generation_id", generation_id);

  const faceInputId  = inputs?.find(i => i.role === "source_face")?.asset_id;
  const audioInputId = inputs?.find(i => i.role === "source_audio")?.asset_id;

  const [faceAsset, audioAsset] = await Promise.all([
    faceInputId  ? supabaseAdmin.from("assets").select("storage_path").eq("id", faceInputId).single()  : null,
    audioInputId ? supabaseAdmin.from("assets").select("storage_path").eq("id", audioInputId).single() : null,
  ]);

  if (!faceAsset?.data?.storage_path || !audioAsset?.data?.storage_path) {
    return NextResponse.json({ success: false, error: "Asset files not found" }, { status: 422 });
  }

  const [faceSign, audioSign] = await Promise.all([
    supabaseAdmin.storage.from(BUCKET).createSignedUrl(faceAsset.data.storage_path,  FACE_URL_TTL),
    supabaseAdmin.storage.from(BUCKET).createSignedUrl(audioAsset.data.storage_path, AUDIO_URL_TTL),
  ]);

  if (!faceSign.data?.signedUrl || !audioSign.data?.signedUrl) {
    return NextResponse.json({ success: false, error: "Failed to generate signed URLs" }, { status: 500 });
  }

  const audioDuration  = gen.duration_seconds ?? gen.parameters?.audio_duration_seconds ?? 0;
  const aspectRatio    = (gen.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1";

  // Preprocess: face image → source video (reuse cached URL if available)
  let sourceVideoUrl = gen.parameters?.source_video_url as string | undefined;
  if (!sourceVideoUrl) {
    const sv = await prepareSourceVideoFromImage({
      faceSignedUrl: faceSign.data.signedUrl,
      audioDuration,
      aspectRatio,
    });
    sourceVideoUrl = sv.videoUrl;
  }

  try {
    const result = await adapter.submitJob({
      generationId:    gen.id,
      videoUrl:        sourceVideoUrl,
      audioUrl:        audioSign.data.signedUrl,
      aspectRatio,
      durationSeconds: audioDuration,
      syncMode:        (gen.parameters?.sync_mode ?? "cut_off") as "cut_off",
    });

    await supabaseAdmin
      .from("generations")
      .update({
        status:     "processing",
        parameters: {
          ...gen.parameters,
          source_video_url:  sourceVideoUrl,
          provider_task_id:  result.providerTaskId,
          fal_request_id:    result.providerTaskId,
          fal_status_url:    result.statusUrl   ?? null,
          fal_response_url:  result.responseUrl ?? null,
          fal_cancel_url:    result.cancelUrl   ?? null,
          current_stage:     "submitted_to_provider",
          failure_reason:    null,
        },
      })
      .eq("id", generation_id);

    return NextResponse.json({ success: true, providerTaskId: result.providerTaskId });
  } catch (err) {
    await supabaseAdmin
      .from("generations")
      .update({ status: "failed", parameters: { ...gen.parameters, failure_reason: String(err) } })
      .eq("id", generation_id);

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Provider error" },
      { status: 502 }
    );
  }
}
