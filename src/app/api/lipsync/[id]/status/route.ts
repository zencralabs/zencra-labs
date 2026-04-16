// GET /api/lipsync/[id]/status
// Returns the current status of a lip sync generation.
// If still processing, also polls the provider and syncs the result to the DB.

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";
import { getLipSyncProvider } from "@/lib/providers/lipsync";
import type { LipSyncProviderKey } from "@/lib/providers/lipsync";
import { isActiveLipSyncStatus } from "@/lib/lipsync/status";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;

  try {
    // ── 1. Load generation ──────────────────────────────────────────────────
    const { data: gen, error: genError } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, status, provider, parameters, output_url, thumbnail_url, credits_used, duration_seconds, quality_mode, aspect_ratio, created_at")
      .eq("id", id)
      .single();

    if (genError || !gen) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (gen.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // ── 2. If terminal, return immediately ─────────────────────────────────
    if (!isActiveLipSyncStatus(gen.status)) {
      return NextResponse.json({
        success:       true,
        id:            gen.id,
        status:        gen.status,
        progress:      gen.status === "completed" ? 100 : undefined,
        output_url:    gen.output_url ?? gen.parameters?.output_url ?? null,
        thumbnail_url: gen.thumbnail_url ?? null,
        failure_reason: gen.parameters?.failure_reason ?? null,
        credits_used:  gen.credits_used,
      });
    }

    // ── 3. If still active, poll provider ──────────────────────────────────
    // NOTE: fal starts jobs as "IN_QUEUE" (mapped to "queued" internally),
    // so we poll both "queued" and "processing" generations.
    const providerKey    = gen.provider as LipSyncProviderKey;
    // Support both legacy key and fal-specific key
    const providerTaskId = (gen.parameters?.fal_request_id ?? gen.parameters?.provider_task_id) as string | undefined;

    if (!providerKey || !providerTaskId) {
      // Incomplete metadata — return current DB status
      return NextResponse.json({
        success: true,
        id:      gen.id,
        status:  gen.status,
        progress: null,
        output_url: null,
        thumbnail_url: null,
        failure_reason: "Missing provider task ID",
      });
    }

    let adapter;
    try {
      adapter = getLipSyncProvider(providerKey);
    } catch {
      return NextResponse.json({
        success: true,
        id:      gen.id,
        status:  gen.status,
        progress: null,
        output_url: null,
        thumbnail_url: null,
        failure_reason: `Unknown provider: ${providerKey}`,
      });
    }

    const pollResult = await adapter.getJobStatus(providerTaskId);

    // ── 4. Sync result to DB if terminal ────────────────────────────────────
    if (pollResult.status === "completed" && pollResult.outputUrl) {
      await supabaseAdmin
        .from("generations")
        .update({
          status:        "completed",
          output_url:    pollResult.outputUrl,
          result_url:    pollResult.outputUrl,
          thumbnail_url: pollResult.thumbnailUrl ?? null,
          completed_at:  new Date().toISOString(),
          parameters: {
            ...gen.parameters,
            current_stage: "finalizing",
            failure_reason: null,
          },
        })
        .eq("id", gen.id);

      return NextResponse.json({
        success:       true,
        id:            gen.id,
        status:        "completed",
        progress:      100,
        stage:         "finalizing",
        output_url:    pollResult.outputUrl,
        thumbnail_url: pollResult.thumbnailUrl ?? null,
        failure_reason: null,
        credits_used:  gen.credits_used,
      });
    }

    if (pollResult.status === "failed") {
      const reason = pollResult.failureReason ?? "Provider error";

      // Refund credits on provider failure
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id:       user.id,
        p_amount:        gen.credits_used,
        p_description:   "Lip Sync refund — provider failed",
        p_generation_id: gen.id,
      });

      await supabaseAdmin
        .from("generations")
        .update({
          status:      "failed",
          credits_used: 0,
          parameters: {
            ...gen.parameters,
            failure_reason: reason,
          },
        })
        .eq("id", gen.id);

      return NextResponse.json({
        success:        true,
        id:             gen.id,
        status:         "failed",
        progress:       null,
        output_url:     null,
        thumbnail_url:  null,
        failure_reason: reason,
        credits_used:   0,
      });
    }

    // Still in progress
    return NextResponse.json({
      success:        true,
      id:             gen.id,
      status:         pollResult.status,
      progress:       pollResult.progress ?? null,
      stage:          pollResult.stage    ?? gen.parameters?.current_stage ?? null,
      output_url:     null,
      thumbnail_url:  null,
      failure_reason: null,
      credits_used:   gen.credits_used,
    });
  } catch (err) {
    console.error("[lipsync/status]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
