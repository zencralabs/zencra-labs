/**
 * POST /api/creative-director/generations/[generationId]/regenerate
 *
 * Re-run an existing generation using its stored request_payload.
 * Preserves the same provider, model, prompt, and aspect ratio.
 * Deducts credits at the base generation rate.
 *
 * Returns { generationId, generation } — generationId is the new record's ID.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saveGeneration, updateGenerationStatus } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import { computeTotalGenerationCost } from "@/lib/creative-director/credit-estimator";
import type { CreativeGenerationRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ generationId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { generationId } = await params;

  // ── Load parent generation ─────────────────────────────────────────────────
  const { data: parentGen, error: genErr } = await supabaseAdmin
    .from("creative_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (genErr || !parentGen) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  const parent = parentGen as CreativeGenerationRow;

  // ── Verify project ownership ───────────────────────────────────────────────
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id")
    .eq("id", parent.project_id)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // ── Extract stored payload ─────────────────────────────────────────────────
  const payload = (parent.request_payload ?? {}) as {
    promptString?: string;
    aspectRatio?: string;
    blendMode?: string;
    locks?: Record<string, unknown>;
  };

  const promptString = payload.promptString ?? "";
  const aspectRatio = payload.aspectRatio ?? "1:1";

  if (!promptString) {
    return NextResponse.json(
      { error: "Parent generation has no stored prompt — cannot regenerate" },
      { status: 400 }
    );
  }

  // ── Reserve credits (same as base) ────────────────────────────────────────
  const creditCost = computeTotalGenerationCost(parent.model, 1, "base");

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id: user.id,
      p_amount: creditCost,
      p_description: `Creative Director — regenerate via ${parent.provider}`,
    }
  );

  if (creditErr) {
    return NextResponse.json({ error: "Credit deduction failed" }, { status: 500 });
  }

  const creditRow = (creditResult as Array<{ success: boolean }> | null)?.[0];
  if (!creditRow?.success) {
    return NextResponse.json(
      { error: "Insufficient credits", code: "INSUFFICIENT_CREDITS", required: creditCost },
      { status: 402 }
    );
  }

  // ── Insert new generation record ───────────────────────────────────────────
  let newGen: CreativeGenerationRow;

  try {
    newGen = await saveGeneration({
      project_id:           parent.project_id,
      concept_id:           parent.concept_id,
      user_id:              user.id,
      generation_type:      "base",
      provider:             parent.provider,
      model:                parent.model,
      request_payload:      parent.request_payload as Record<string, unknown>,
      normalized_prompt:    parent.normalized_prompt as Record<string, unknown>,
      status:               "processing",
      credit_cost:          creditCost,
      parent_generation_id: generationId,
    });
  } catch (err) {
    console.error("[regenerate/route] saveGeneration failed:", err);
    // Refund on record-save failure
    await supabaseAdmin.rpc("refund_credits", {
      p_user_id:     user.id,
      p_amount:      creditCost,
      p_description: "Creative Director — regenerate refund (record save failed)",
    });
    return NextResponse.json({ error: "Failed to create generation record" }, { status: 500 });
  }

  // ── Dispatch to image generation stack ────────────────────────────────────
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const authHeader = req.headers.get("authorization") ?? "";

  try {
    const genRes = await fetch(`${siteUrl}/api/studio/image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        modelKey:    parent.model,
        prompt:      promptString,
        aspectRatio,
        ...(payload.blendMode ? { blendMode: payload.blendMode } : {}),
        ...(payload.locks     ? { locks:     payload.locks     } : {}),
      }),
    });

    if (!genRes.ok) {
      const errBody = await genRes.text();
      throw new Error(`Studio dispatch failed (${genRes.status}): ${errBody}`);
    }

    const genData = (await genRes.json()) as {
      data?: { assetId?: string };
    };

    const assetId = genData.data?.assetId;
    const status: CreativeGenerationRow["status"] = assetId ? "completed" : "failed";
    await updateGenerationStatus(newGen.id, status, assetId);

    // Log activity (fire-and-forget)
    void logActivity(parent.project_id, user.id, "generation_queued", {
      parent_generation_id: generationId,
      new_generation_id:    newGen.id,
      regenerate:           true,
      credits_spent:        creditCost,
    });

    return NextResponse.json({
      generationId: newGen.id,
      generation:   { ...newGen, status, asset_id: assetId },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown dispatch error";
    await updateGenerationStatus(newGen.id, "failed", undefined, errMsg);
    return NextResponse.json({
      generationId: newGen.id,
      generation:   { ...newGen, status: "failed", error_message: errMsg },
    });
  }
}
