import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import type { ProviderName, ProviderStatusResult } from "@/lib/ai/types";

type RouteParams = Promise<{ provider: string; taskId: string }>;

// Map DB status back to the orchestrator's ProviderStatusResult shape
function toProviderStatus(
  dbStatus: string
): "pending" | "success" | "error" {
  if (dbStatus === "completed")  return "success";
  if (dbStatus === "failed")     return "error";
  if (dbStatus === "processing") return "pending";
  return "pending";
}

const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const IS_DEV           = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";

export async function GET(
  req: Request,
  context: { params: RouteParams }
) {
  try {
    const { provider, taskId } = await context.params;

    if (!provider || !taskId) {
      return NextResponse.json(
        { success: false, error: "Missing provider or taskId" },
        { status: 400 }
      );
    }

    // ── Auth ───────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser && !IS_DEV) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── Query generation from DB ───────────────────────────────────────────
    // taskId is the generation UUID returned when the job was created.
    // We also enforce user ownership so users can't poll each other's jobs.
    const { data: generation, error } = await supabaseAdmin
      .from("generations")
      .select("id, tool, tool_category, status, result_url, result_urls, error_message, created_at, completed_at")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      );
    }

    const result: ProviderStatusResult = {
      provider:  provider as ProviderName,
      taskId:    generation.id,
      status:    toProviderStatus(generation.status),
      url:       generation.result_url ?? undefined,
      metadata: {
        tool:         generation.tool,
        tool_category: generation.tool_category,
        created_at:   generation.created_at,
        completed_at: generation.completed_at ?? undefined,
        result_urls:  generation.result_urls ?? undefined,
        ...(generation.error_message
          ? { error_message: generation.error_message }
          : {}),
      },
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
