import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { nanoBananaProvider } from "@/lib/ai/providers/nano-banana";
import type { ProviderName, ProviderStatusResult } from "@/lib/ai/types";

type RouteParams = Promise<{ provider: string; taskId: string }>;

/** Map DB status → ProviderStatusResult status */
function toProviderStatus(dbStatus: string): "pending" | "success" | "error" {
  if (dbStatus === "completed")  return "success";
  if (dbStatus === "failed")     return "error";
  if (dbStatus === "processing") return "pending";
  return "pending";
}

const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const IS_DEV           = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";

export async function GET(req: Request, context: { params: RouteParams }) {
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── Look up generation row by generationId (UUID) ──────────────────────
    const { data: generation, error } = await supabaseAdmin
      .from("generations")
      .select("id, tool, tool_category, status, result_url, result_urls, error_message, created_at, completed_at, parameters")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (error || !generation) {
      return NextResponse.json({ success: false, error: "Generation not found" }, { status: 404 });
    }

    // ── For nano-banana: proxy a live status check to the NB API ───────────
    if (provider === "nano-banana") {
      // If already completed/failed in DB, return that without calling NB
      if (generation.status === "completed" || generation.status === "failed") {
        const result: ProviderStatusResult = {
          provider:  "nano-banana",
          taskId:    generation.id,
          status:    toProviderStatus(generation.status),
          url:       generation.result_url ?? undefined,
          error:     generation.error_message ?? undefined,
          metadata: {
            tool:          generation.tool,
            tool_category: generation.tool_category,
            created_at:    generation.created_at,
            completed_at:  generation.completed_at ?? undefined,
          },
        };
        return NextResponse.json({ success: true, data: result });
      }

      // Still processing — ask the NB API directly
      const params = (generation.parameters ?? {}) as Record<string, unknown>;
      const nbTaskId = String(params.nbTaskId ?? "");

      if (!nbTaskId) {
        return NextResponse.json(
          { success: false, error: "No NB task ID stored for this generation" },
          { status: 500 }
        );
      }

      const nbStatus = await nanoBananaProvider.getStatus!(nbTaskId);

      // Persist the result back to DB so future calls are faster
      if (nbStatus.status === "success" && nbStatus.url) {
        await supabaseAdmin
          .from("generations")
          .update({
            status:       "completed",
            result_url:   nbStatus.url,
            result_urls:  [nbStatus.url],
            completed_at: new Date().toISOString(),
          })
          .eq("id", generation.id);
      } else if (nbStatus.status === "error") {
        await supabaseAdmin
          .from("generations")
          .update({
            status:        "failed",
            error_message: nbStatus.error ?? "Generation failed",
          })
          .eq("id", generation.id);
      }

      const result: ProviderStatusResult = {
        ...nbStatus,
        taskId: generation.id,  // expose our generationId, not the internal NB taskId
      };
      return NextResponse.json({ success: true, data: result });
    }

    // ── Default: DB-only status lookup (Kling, etc.) ───────────────────────
    const result: ProviderStatusResult = {
      provider:  provider as ProviderName,
      taskId:    generation.id,
      status:    toProviderStatus(generation.status),
      url:       generation.result_url ?? undefined,
      metadata: {
        tool:          generation.tool,
        tool_category: generation.tool_category,
        created_at:    generation.created_at,
        completed_at:  generation.completed_at ?? undefined,
        result_urls:   generation.result_urls ?? undefined,
        ...(generation.error_message ? { error_message: generation.error_message } : {}),
      },
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
