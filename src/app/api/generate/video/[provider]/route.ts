import { NextResponse } from "next/server";

// Extend timeout to 300 s — video generation can take up to 4.5 min
export const maxDuration = 300;

import { getAuthUser }         from "@/lib/supabase/server";
import { supabaseAdmin }       from "@/lib/supabase/admin";
import { klingProvider }       from "@/lib/ai/providers/kling";
import { seedanceProvider }    from "@/lib/ai/providers/seedance";
import type { ProviderName }   from "@/lib/ai/types";
import type { GenerationQuality, AspectRatio } from "@/lib/ai/types";


type RouteParams = Promise<{ provider: string }>;

interface VideoGenerateBody {
  prompt:          string;
  negPrompt?:      string;
  model?:          string;
  duration?:       number;
  aspectRatio?:    string;
  quality?:        string;
  cameraPreset?:   string | null;
  startFrameUrl?:  string;
  endFrameUrl?:    string;
  videoUrl?:       string;
  imageUrl?:       string;
  motionStrength?: number;
  motionArea?:     string;
}

export async function POST(
  req: Request,
  context: { params: RouteParams },
) {
  try {
    const { provider } = await context.params;

    // ── Auth ────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    // ── Validate provider ────────────────────────────────────────────────────
    const supportedProviders = ["kling", "seedance"];
    if (!supportedProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Unsupported provider: ${provider}` },
        { status: 400 },
      );
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = (await req.json()) as VideoGenerateBody;
    const { prompt } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 },
      );
    }

    // ── Determine frame mode / operation ──────────────────────────────────────
    const hasStartAndEnd = !!(body.startFrameUrl && body.endFrameUrl);
    const hasStartOnly   = !!(body.startFrameUrl && !body.endFrameUrl);
    const hasImageRef    = !!(body.imageUrl);
    const hasVideoRef    = !!(body.videoUrl);

    const operationType = hasStartAndEnd ? "start_end"
      : hasStartOnly   ? "start_frame"
      : hasImageRef    ? "image_to_video"
      : hasVideoRef    ? "motion_control"
      : "text_to_video";

    // ── Create DB generation record (pending) ────────────────────────────────
    const { data: genRow, error: genErr } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id:       userId,
        tool:          body.model ?? provider,
        tool_category: "video",
        prompt:        prompt.trim(),
        parameters: {
          negPrompt:      body.negPrompt,
          model:          body.model,
          duration:       body.duration,
          aspectRatio:    body.aspectRatio,
          quality:        body.quality,
          cameraPreset:   body.cameraPreset,
          startFrameUrl:  body.startFrameUrl,
          endFrameUrl:    body.endFrameUrl,
          motionStrength: body.motionStrength,
          motionArea:     body.motionArea,
          operationType,
        },
        status:     "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (genErr || !genRow) {
      console.error("[video-route] DB insert failed:", genErr);
      return NextResponse.json(
        { success: false, error: "Failed to create generation record" },
        { status: 500 },
      );
    }

    const generationId = genRow?.id ?? crypto.randomUUID();

    // ── Select provider and generate (blocking — provider handles polling) ───
    const selectedProvider = provider === "seedance" ? seedanceProvider : klingProvider;

    let videoUrl: string | null = null;
    let providerError: string | null = null;

    try {
      const result = await selectedProvider.generate({
        prompt:          prompt.trim(),
        mode:            "video",
        normalizedPrompt: {
          original:         prompt.trim(),
          transformed:      prompt.trim(),
          negativePrompt:   body.negPrompt,
        },
        quality:          (body.quality ?? "cinematic") as GenerationQuality,
        aspectRatio:      (body.aspectRatio ?? "16:9") as AspectRatio,
        durationSeconds:  body.duration ?? 5,
        imageUrl:         body.startFrameUrl ?? body.imageUrl,
        endImageUrl:      body.endFrameUrl,
        referenceVideoUrl: body.videoUrl,
        videoMode:        body.quality === "pro" ? "pro" : "std",
        cameraControl:    body.cameraPreset ? { type: body.cameraPreset } : undefined,
        operationType,
        metadata: {
          apiModelId:     body.model,
          motionStrength: body.motionStrength,
          motionArea:     body.motionArea,
        },
      });

      if (result.status === "success" && result.url) {
        videoUrl = result.url;
      } else {
        providerError = result.error ?? "Generation failed";
      }
    } catch (err) {
      providerError = err instanceof Error ? err.message : String(err);
    }

    // ── Update DB with result ─────────────────────────────────────────────────
    if (genRow) {
      await supabaseAdmin
        .from("generations")
        .update(videoUrl
          ? {
              status:       "completed",
              result_url:   videoUrl,
              result_urls:  [videoUrl],
              completed_at: new Date().toISOString(),
            }
          : {
              status:        "failed",
              error_message: providerError ?? "Unknown error",
              completed_at:  new Date().toISOString(),
            })
        .eq("id", generationId);
    }

    if (providerError) {
      return NextResponse.json({ success: false, error: providerError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId:  generationId,
      url:     videoUrl,
      status:  "done",
    });

  } catch (err) {
    console.error("[video-route] unhandled error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
