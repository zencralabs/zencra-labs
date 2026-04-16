// POST /api/webhooks/lipsync
// Receives async callbacks from lip sync providers when a job completes or fails.
// Each provider sends a different payload — normalize it here.
//
// Security: verify the request using the provider's signature header.
// Set LIPSYNC_WEBHOOK_SECRET in env to enable HMAC verification.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WEBHOOK_SECRET = process.env.LIPSYNC_WEBHOOK_SECRET ?? "";

/** Simple HMAC-SHA256 verification helper (provider-agnostic) */
async function verifyHmac(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder   = new TextEncoder();
    const keyData   = encoder.encode(secret);
    const msgData   = encoder.encode(body);
    const key       = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBuffer = hexToBuffer(signature);
    return crypto.subtle.verify("HMAC", key, sigBuffer, msgData);
  } catch {
    return false;
  }
}

function hexToBuffer(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr.buffer;
}

export async function POST(req: Request) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-lipsync-signature") ?? req.headers.get("x-signature") ?? "";

  // ── Signature verification (skip if secret not configured) ───────────────
  if (WEBHOOK_SECRET) {
    const valid = await verifyHmac(rawBody, signature, WEBHOOK_SECRET);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // ── Normalize provider payload ────────────────────────────────────────────
  // Each provider sends different field names — map them to our internal schema.
  //
  // Common patterns:
  //   HeyGen:      { event: "avatar_video.success", data: { video_id, video_url } }
  //   ElevenLabs:  { event: "dubbing.completed", data: { dubbing_id, status } }
  //   Generic:     { task_id, status, output_url, thumbnail_url, error }

  const providerTaskId: string =
    (payload.task_id as string)    ??
    (payload.video_id as string)   ??
    (payload.dubbing_id as string) ??
    ((payload.data as Record<string, unknown>)?.video_id as string) ??
    ((payload.data as Record<string, unknown>)?.dubbing_id as string) ??
    "";

  const rawStatus: string =
    (payload.status as string) ??
    (payload.event  as string) ??
    "";

  const outputUrl: string | null =
    (payload.output_url as string)  ??
    (payload.video_url  as string)  ??
    ((payload.data as Record<string, unknown>)?.video_url as string) ??
    null;

  const thumbnailUrl: string | null =
    (payload.thumbnail_url as string) ??
    ((payload.data as Record<string, unknown>)?.thumbnail_url as string) ??
    null;

  const failureReason: string | null =
    (payload.error as string) ??
    (payload.message as string) ??
    null;

  if (!providerTaskId) {
    console.warn("[webhook/lipsync] No task ID found in payload:", payload);
    return NextResponse.json({ success: true, note: "No task ID — ignored" });
  }

  // ── Resolve internal status ───────────────────────────────────────────────
  const isCompleted = rawStatus.includes("completed") || rawStatus.includes("success") || rawStatus.includes("dubbed");
  const isFailed    = rawStatus.includes("failed")    || rawStatus.includes("error");

  // ── Find the generation by provider task ID ───────────────────────────────
  const { data: generations } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, credits_used, parameters")
    .eq("tool_category", "lipsync")
    .contains("parameters", { provider_task_id: providerTaskId })
    .limit(1);

  const gen = generations?.[0];
  if (!gen) {
    console.warn("[webhook/lipsync] No generation found for task ID:", providerTaskId);
    return NextResponse.json({ success: true, note: "Generation not found — ignored" });
  }

  // ── Update the generation ────────────────────────────────────────────────
  if (isCompleted && outputUrl) {
    await supabaseAdmin.from("generations").update({
      status:        "completed",
      output_url:    outputUrl,
      result_url:    outputUrl,
      thumbnail_url: thumbnailUrl,
      completed_at:  new Date().toISOString(),
      parameters: {
        ...gen.parameters,
        current_stage:  "finalizing",
        failure_reason: null,
      },
    }).eq("id", gen.id);

    return NextResponse.json({ success: true, generationId: gen.id, status: "completed" });
  }

  if (isFailed) {
    const reason = failureReason ?? "Provider error";
    await supabaseAdmin.rpc("refund_credits", {
      p_user_id:       gen.user_id,
      p_amount:        gen.credits_used,
      p_description:   "Lip Sync refund — provider webhook failure",
      p_generation_id: gen.id,
    });
    await supabaseAdmin.from("generations").update({
      status:       "failed",
      credits_used: 0,
      parameters:   { ...gen.parameters, failure_reason: reason },
    }).eq("id", gen.id);

    return NextResponse.json({ success: true, generationId: gen.id, status: "failed" });
  }

  // Unknown status — log and ack
  console.info("[webhook/lipsync] Unknown status received:", { rawStatus, providerTaskId });
  return NextResponse.json({ success: true, note: "Status not actionable — acknowledged" });
}
