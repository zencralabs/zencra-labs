import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLipSyncProvider } from "@/lib/providers/lipsync";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  try {
    const { id } = await params;

    const { data: generation, error } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, provider, status, output_url, thumbnail_url, parameters")
      .eq("id", id)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      );
    }

    if (generation.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    if (generation.output_url) {
      return NextResponse.json({
        success: true,
        id: generation.id,
        status: "completed",
        output_url: generation.output_url,
        thumbnail_url: generation.thumbnail_url ?? null,
      });
    }

    const paramsObj = (generation.parameters ?? {}) as Record<string, any>;
    const providerTaskId =
      paramsObj.provider_task_id || paramsObj.fal_request_id || null;

    if (!providerTaskId) {
      return NextResponse.json(
        { success: false, error: "Provider task ID missing" },
        { status: 400 }
      );
    }

    const provider = getLipSyncProvider(generation.provider);

    if (!provider.isReady()) {
      return NextResponse.json(
        { success: false, error: "Lip sync provider not configured" },
        { status: 503 }
      );
    }

    if (!provider.getResult) {
      return NextResponse.json(
        { success: false, error: "Provider does not support getResult" },
        { status: 501 }
      );
    }

    const result = await provider.getResult(providerTaskId);

    if (!result?.videoUrl) {
      return NextResponse.json(
        { success: false, error: "Provider result video URL missing" },
        { status: 502 }
      );
    }

    await supabaseAdmin
      .from("generations")
      .update({
        status: "completed",
        output_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl ?? null,
        parameters: {
          ...paramsObj,
          current_stage: "completed",
          failure_reason: null,
        },
      })
      .eq("id", generation.id);

    return NextResponse.json({
      success: true,
      id: generation.id,
      status: "completed",
      output_url: result.videoUrl,
      thumbnail_url: result.thumbnailUrl ?? null,
    });
  } catch (err) {
    console.error("[lipsync/result]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}