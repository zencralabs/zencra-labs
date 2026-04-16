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
      .select("id, user_id, provider, status, output_url, parameters")
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

    const paramsObj = (generation.parameters ?? {}) as Record<string, any>;
    const providerTaskId =
      paramsObj.provider_task_id || paramsObj.fal_request_id || null;

    if (!providerTaskId) {
      return NextResponse.json({
        success: true,
        id: generation.id,
        status: generation.status,
        progress: null,
        stage: paramsObj.current_stage ?? null,
        output_url: generation.output_url ?? null,
        failure_reason: paramsObj.failure_reason ?? null,
      });
    }

    const provider = getLipSyncProvider(generation.provider);

    if (!provider.isReady()) {
      return NextResponse.json(
        { success: false, error: "Lip sync provider not configured" },
        { status: 503 }
      );
    }

    const providerStatus = await provider.getJobStatus(providerTaskId);

    let mappedStatus: "queued" | "processing" | "completed" | "failed" =
      "processing";
    let currentStage = paramsObj.current_stage ?? "processing";

    if (providerStatus.status === "queued") {
      mappedStatus = "queued";
      currentStage = "queued_on_provider";
    } else if (providerStatus.status === "processing") {
      mappedStatus = "processing";
      currentStage = "syncing_audio";
    } else if (providerStatus.status === "completed") {
      mappedStatus = generation.output_url ? "completed" : "processing";
      currentStage = generation.output_url ? "completed" : "fetching_result";
    } else if (providerStatus.status === "failed") {
      mappedStatus = "failed";
      currentStage = "failed";
    }

    await supabaseAdmin
      .from("generations")
      .update({
        status: mappedStatus,
        parameters: {
          ...paramsObj,
          current_stage: currentStage,
          failure_reason:
            providerStatus.failureReason ?? paramsObj.failure_reason ?? null,
        },
      })
      .eq("id", generation.id);

    return NextResponse.json({
      success: true,
      id: generation.id,
      status: mappedStatus,
      provider_status: providerStatus.status,
      progress: providerStatus.progress ?? null,
      stage: currentStage,
      output_url: generation.output_url ?? null,
      failure_reason:
        providerStatus.failureReason ?? paramsObj.failure_reason ?? null,
    });
  } catch (err) {
    console.error("[lipsync/status]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}