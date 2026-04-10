import { NextResponse } from "next/server";
import { generateContent } from "@/lib/ai/orchestrator";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { calculateCredits } from "@/lib/credits/calculate";
import { resolveTool } from "@/lib/ai/tool-registry";
import type { GenerateContentInput } from "@/lib/ai/types";

// Used ONLY in local development when no Bearer token is present.
// In production every request must carry a valid JWT.
const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const IS_DEV = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";

/** Map orchestrator status values → DB CHECK constraint values */
function toDbStatus(
  s: string
): "pending" | "processing" | "completed" | "failed" {
  if (s === "success")    return "completed";
  if (s === "error")      return "failed";
  if (s === "queued")     return "pending";
  if (s === "processing") return "processing";
  return "pending";
}

export async function POST(req: Request) {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);

    // In production: reject unauthenticated requests
    if (!authUser && !IS_DEV) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── 2. Validate input ──────────────────────────────────────────────────
    const body = (await req.json()) as Partial<GenerateContentInput>;

    if (!body.mode || !["image", "video", "audio"].includes(body.mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing mode" },
        { status: 400 }
      );
    }

    if (!body.prompt || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // ── 3. Calculate credit cost ───────────────────────────────────────────
    const creditCost = calculateCredits({
      mode:            body.mode,
      quality:         body.quality ?? "cinematic",
      durationSeconds: body.durationSeconds,
      aspectRatio:     body.aspectRatio,
    });

    // ── 4. Pre-flight: check user has enough credits ───────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    if (profile.credits < creditCost.total) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient credits",
          data: { available: profile.credits, required: creditCost.total },
        },
        { status: 402 }
      );
    }

    // ── 5. Run generation ──────────────────────────────────────────────────
    const result = await generateContent({
      mode:            body.mode,
      prompt:          body.prompt,
      provider:        body.provider,
      quality:         body.quality ?? "cinematic",
      aspectRatio:     body.aspectRatio,
      durationSeconds: body.durationSeconds,
      imageUrl:        body.imageUrl,
      voiceId:         body.voiceId,
      metadata:        body.metadata,
    });

    // ── 6. Persist generation record ───────────────────────────────────────
    const toolName = resolveTool(body.mode, result.provider);

    const { data: generationRow, error: generationError } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id:       userId,
        tool:          toolName,
        tool_category: body.mode,
        prompt:        body.prompt,
        status:        toDbStatus(result.status),
        result_url:    result.url ?? null,
        credits_used:  result.status === "error" ? 0 : creditCost.total,
        parameters:    result.metadata ?? {},
      })
      .select()
      .single();

    if (generationError) {
      return NextResponse.json(
        { success: false, error: generationError.message },
        { status: 500 }
      );
    }

    // ── 7. Deduct credits atomically (only on success) ─────────────────────
    if (result.status !== "error" && creditCost.total > 0) {
      const { data: spendResult, error: spendError } = await supabaseAdmin
        .rpc("spend_credits", {
          p_user_id:       userId,
          p_amount:        creditCost.total,
          p_description:   `${body.mode} generation via ${toolName}`,
          p_generation_id: generationRow.id,
        });

      if (spendError || !spendResult?.[0]?.success) {
        console.error(
          "[generate] spend_credits failed after successful generation:",
          spendError?.message ?? spendResult?.[0]?.error_message,
          { generationId: generationRow.id, userId, cost: creditCost.total }
        );
      }
    }

    // ── 8. Respond ─────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success:    result.status !== "error",
        data:       result,
        generation: generationRow,
        credits: {
          used:      result.status !== "error" ? creditCost.total : 0,
          breakdown: creditCost,
        },
      },
      { status: result.status === "error" ? 400 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
