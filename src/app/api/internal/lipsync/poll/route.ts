// POST /api/internal/lipsync/poll
// Internal route: polls the provider for all in-flight lip sync generations
// and syncs their status to the database. Called by a cron job.
// Secured by INTERNAL_API_SECRET.

import { NextResponse } from "next/server";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { getLipSyncProvider } from "@/lib/providers/lipsync";
import type { LipSyncProviderKey } from "@/lib/providers/lipsync";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const MAX_BATCH_SIZE  = 20; // poll at most 20 at once per invocation

export async function POST(req: Request) {
  const auth = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || auth !== INTERNAL_SECRET) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Optionally: poll a specific generation only
  const body = await req.json().catch(() => ({})) as { generation_id?: string };

  // Poll both "queued" (fal IN_QUEUE) and "processing" (fal IN_PROGRESS) generations
  let query = supabaseAdmin
    .from("generations")
    .select("id, user_id, status, provider, credits_used, parameters")
    .eq("tool_category", "lipsync")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (body.generation_id) {
    query = query.eq("id", body.generation_id) as typeof query;
  }

  const { data: generations, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!generations?.length) {
    return NextResponse.json({ success: true, polled: 0, results: [] });
  }

  const results = await Promise.allSettled(
    generations.map(async gen => {
      const providerKey    = gen.provider as LipSyncProviderKey;
      // Support both fal-specific key and legacy key
      const providerTaskId = (gen.parameters?.fal_request_id ?? gen.parameters?.provider_task_id) as string;

      if (!providerKey || !providerTaskId) {
        return { id: gen.id, skipped: true, reason: "missing provider task id" };
      }

      const adapter = getLipSyncProvider(providerKey);
      if (!adapter.isReady()) {
        return { id: gen.id, skipped: true, reason: "provider not ready" };
      }

      const poll = await adapter.getJobStatus(providerTaskId);

      if (poll.status === "completed" && poll.outputUrl) {
        await supabaseAdmin.from("generations").update({
          status:        "completed",
          output_url:    poll.outputUrl,
          result_url:    poll.outputUrl,
          thumbnail_url: poll.thumbnailUrl ?? null,
          completed_at:  new Date().toISOString(),
          parameters: { ...gen.parameters, current_stage: "finalizing", failure_reason: null },
        }).eq("id", gen.id);
        return { id: gen.id, status: "completed" };
      }

      if (poll.status === "failed") {
        const reason = poll.failureReason ?? "Provider error";
        await supabaseAdmin.rpc("refund_credits", {
          p_user_id:       gen.user_id,
          p_amount:        gen.credits_used,
          p_description:   "Lip Sync refund — provider failed (poll)",
          p_generation_id: gen.id,
        });
        await supabaseAdmin.from("generations").update({
          status:       "failed",
          credits_used: 0,
          parameters:   { ...gen.parameters, failure_reason: reason },
        }).eq("id", gen.id);
        return { id: gen.id, status: "failed", reason };
      }

      // Still processing — update stage if provided
      if (poll.stage) {
        await supabaseAdmin.from("generations").update({
          parameters: { ...gen.parameters, current_stage: poll.stage },
        }).eq("id", gen.id);
      }

      return { id: gen.id, status: poll.status, progress: poll.progress };
    })
  );

  const polled = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { id: generations[i].id, error: String(r.reason) }
  );

  return NextResponse.json({ success: true, polled: generations.length, results: polled });
}
