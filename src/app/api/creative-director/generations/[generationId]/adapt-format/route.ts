/**
 * POST /api/creative-director/generations/[generationId]/adapt-format
 *
 * Generate a format-adapted version of an existing generation.
 * Transforms the prompt for a new aspect ratio/format target.
 *
 * Body: { targetFormat: V1AdaptationTarget, count?: 1-2 }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateAdaptFormat } from "@/lib/creative-director/schemas";
import { adaptFormat, applyFormatAdaptation } from "@/lib/creative-director/format-adapter";
import { normalizedPromptToString } from "@/lib/creative-director/prompt-composer";
import { saveGeneration, updateGenerationStatus } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import { computeTotalGenerationCost } from "@/lib/creative-director/credit-estimator";
import { studioDispatch } from "@/lib/api/studio-dispatch";
import { getClientIp } from "@/lib/security/rate-limit";
import type {
  CreativeGenerationRow,
  NormalizedCreativeRenderPrompt,
} from "@/lib/creative-director/types";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateAdaptFormat(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { targetFormat, count } = validation.data;

  // ── Load source generation ─────────────────────────────────────────────────
  const { data: sourceGen, error: genErr } = await supabaseAdmin
    .from("creative_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (genErr || !sourceGen) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  const source = sourceGen as CreativeGenerationRow;

  // ── Verify project ownership ───────────────────────────────────────────────
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id")
    .eq("id", source.project_id)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // ── Build format adaptation ────────────────────────────────────────────────
  const sourceNormalized =
    source.normalized_prompt as unknown as NormalizedCreativeRenderPrompt;

  if (!sourceNormalized?.promptVersion) {
    return NextResponse.json(
      { error: "Source generation has no normalized prompt" },
      { status: 400 }
    );
  }

  const adaptation = adaptFormat(sourceNormalized, targetFormat);
  const adaptedPrompt = applyFormatAdaptation(adaptation);
  const promptString = normalizedPromptToString(adaptedPrompt);
  const targetAspectRatio = adaptation.targetAspectRatio;

  // ── Reserve credits (80% of base) ─────────────────────────────────────────
  const totalCost = computeTotalGenerationCost(source.model, count, "adaptation");

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id: user.id,
      p_amount: totalCost,
      p_description: `Creative Director — ${count} format adaptation(s) [${targetFormat}] via ${source.provider}`,
    }
  );

  if (creditErr) {
    return NextResponse.json({ error: "Credit deduction failed" }, { status: 500 });
  }

  const creditRow = (creditResult as Array<{ success: boolean }> | null)?.[0];
  if (!creditRow?.success) {
    return NextResponse.json(
      { error: "Insufficient credits", code: "INSUFFICIENT_CREDITS", required: totalCost },
      { status: 402 }
    );
  }

  // ── Insert adaptation generation records ───────────────────────────────────
  const generationRecords: CreativeGenerationRow[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const gen = await saveGeneration({
        project_id: source.project_id,
        concept_id: source.concept_id,
        user_id: user.id,
        generation_type: "adaptation",
        provider: source.provider,
        model: source.model,
        request_payload: { promptString, aspectRatio: targetAspectRatio, targetFormat },
        normalized_prompt: adaptedPrompt as unknown as Record<string, unknown>,
        status: "processing",
        credit_cost: computeTotalGenerationCost(source.model, 1, "adaptation"),
        parent_generation_id: generationId,
        adaptation_target: targetFormat,
      });
      generationRecords.push(gen);
    } catch (err) {
      console.error(`[adapt-format/route] saveGeneration failed for output ${i}:`, err);
    }
  }

  // ── Dispatch directly via studioDispatch (no HTTP hop — avoids auth forwarding issues) ───
  // Credits are already deducted above via spend_credits, so skipCredits=true prevents double-charge.
  const clientIp = getClientIp(req);

  const dispatchResults = await Promise.allSettled(
    generationRecords.map(async (gen) => {
      try {
        const { job, assetId } = await studioDispatch({
          userId:      user.id,
          ip:          clientIp,
          studio:      "image",
          modelKey:    source.model,
          prompt:      promptString,
          aspectRatio: targetAspectRatio,
          skipCredits: true, // CD route already deducted via spend_credits RPC
        });

        const imageUrl = job.result?.url ?? null;
        const status: CreativeGenerationRow["status"] =
          job.status === "pending"  ? "processing" :
          job.status === "success"  ? "completed"  : "failed";

        await updateGenerationStatus(gen.id, status, assetId);
        return { ...gen, status, asset_id: assetId, url: imageUrl };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown dispatch error";
        await updateGenerationStatus(gen.id, "failed", undefined, errMsg);
        return { ...gen, status: "failed", error_message: errMsg };
      }
    })
  );

  const finalGenerations = dispatchResults.map((result, idx) => {
    if (result.status === "fulfilled") return result.value;
    return { ...generationRecords[idx], status: "failed" };
  });

  // ── Log activity (fire-and-forget) ────────────────────────────────────────
  void logActivity(source.project_id, user.id, "adaptation_created", {
    source_generation_id: generationId,
    target_format: targetFormat,
    target_aspect_ratio: targetAspectRatio,
    count,
    credits_spent: totalCost,
  });

  return NextResponse.json({ generations: finalGenerations });
}
