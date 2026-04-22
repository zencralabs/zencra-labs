/**
 * POST /api/creative-director/generations/[generationId]/variation
 *
 * Generate controlled variations of an existing generation.
 * Variations preserve subject/concept identity while modifying specific aspects.
 *
 * Body: { variationType: V1VariationType, count: 1-2 }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateVariation } from "@/lib/creative-director/schemas";
import { buildVariationPrompt, applyVariationToPrompt } from "@/lib/creative-director/variation-engine";
import { normalizedPromptToString } from "@/lib/creative-director/prompt-composer";
import { saveGeneration, updateGenerationStatus } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import { computeTotalGenerationCost } from "@/lib/creative-director/credit-estimator";
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

  const validation = validateVariation(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { variationType, count } = validation.data;

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

  // ── Build variation prompt ─────────────────────────────────────────────────
  const baseNormalized =
    parent.normalized_prompt as unknown as NormalizedCreativeRenderPrompt;

  if (!baseNormalized?.promptVersion) {
    return NextResponse.json(
      { error: "Parent generation has no normalized prompt" },
      { status: 400 }
    );
  }

  const variationSpec = buildVariationPrompt(baseNormalized, variationType);
  const variedPrompt = applyVariationToPrompt(baseNormalized, variationSpec);
  const promptString = normalizedPromptToString(variedPrompt);
  const aspectRatio = baseNormalized.format?.aspectRatio ?? "1:1";

  // ── Reserve credits (75% of base) ─────────────────────────────────────────
  const totalCost = computeTotalGenerationCost(parent.model, count, "variation");

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id: user.id,
      p_amount: totalCost,
      p_description: `Creative Director — ${count} variation(s) [${variationType}] via ${parent.provider}`,
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

  // ── Insert variation generation records ────────────────────────────────────
  const generationRecords: CreativeGenerationRow[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const gen = await saveGeneration({
        project_id: parent.project_id,
        concept_id: parent.concept_id,
        user_id: user.id,
        generation_type: "variation",
        provider: parent.provider,
        model: parent.model,
        request_payload: { promptString, aspectRatio, variationType },
        normalized_prompt: variedPrompt as unknown as Record<string, unknown>,
        status: "processing",
        credit_cost: computeTotalGenerationCost(parent.model, 1, "variation"),
        parent_generation_id: generationId,
        variation_type: variationType,
      });
      generationRecords.push(gen);
    } catch (err) {
      console.error(`[variation/route] saveGeneration failed for output ${i}:`, err);
    }
  }

  // ── Dispatch to existing image generation stack ───────────────────────────
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const authHeader = req.headers.get("authorization") ?? "";

  const dispatchResults = await Promise.allSettled(
    generationRecords.map(async (gen) => {
      try {
        const genRes = await fetch(`${siteUrl}/api/studio/image/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            modelKey: parent.model,
            prompt: promptString,
            aspectRatio,
          }),
        });

        if (!genRes.ok) {
          throw new Error(`Studio dispatch failed (${genRes.status})`);
        }

        const genData = (await genRes.json()) as {
          data?: { assetId?: string };
        };

        const assetId = genData.data?.assetId;
        const status = assetId ? "completed" : "failed";
        await updateGenerationStatus(gen.id, status, assetId);
        return { ...gen, status, asset_id: assetId };
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Unknown dispatch error";
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
  void logActivity(parent.project_id, user.id, "variation_created", {
    parent_generation_id: generationId,
    variation_type: variationType,
    count,
    credits_spent: totalCost,
  });

  return NextResponse.json({ generations: finalGenerations });
}
