/**
 * POST /api/creative-director/concepts/[conceptId]/generate
 *
 * Generate rendered images for a selected creative concept.
 *
 * Flow:
 * 1. Check idempotency (idempotencyKey on creative_generations)
 * 2. Load concept + project + brief from DB
 * 3. Select provider via selectCreativeProvider()
 * 4. Compose normalized prompt via composeNormalizedPrompt()
 * 5. Convert to string via normalizedPromptToString()
 * 6. Reserve credits (spend_credits RPC)
 * 7. Insert creative_generation records (status="processing")
 * 8. Call /api/studio/image/generate for each output (reuses existing stack)
 * 9. Update generation records with asset_id and status
 * 10. Return { generations }
 *
 * Body: { count: 1-4, aspectRatio?, providerOverride?, modelOverride?, idempotencyKey? }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateGenerateRender } from "@/lib/creative-director/schemas";
import { composeNormalizedPrompt, normalizedPromptToString } from "@/lib/creative-director/prompt-composer";
import { selectCreativeProvider } from "@/lib/creative-director/provider-router";
import { saveGeneration, updateGenerationStatus } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import { computeTotalGenerationCost } from "@/lib/creative-director/credit-estimator";
import { studioDispatch } from "@/lib/api/studio-dispatch";
import { getClientIp } from "@/lib/security/rate-limit";
import type {
  CreativeBriefRow,
  CreativeConceptRow,
  CreativeGenerationRow,
  NormalizedCreativeRenderPrompt,
  ParsedBrief,
} from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conceptId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conceptId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateGenerateRender(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const {
    count,
    aspectRatio,
    providerOverride,
    modelOverride,
    idempotencyKey,
    referenceImages,
    blendMode,
    locks,
    session_id,
  } = validation.data;

  // ── Idempotency check ──────────────────────────────────────────────────────
  if (idempotencyKey) {
    const { data: existingGen } = await supabaseAdmin
      .from("creative_generations")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingGen) {
      return NextResponse.json({
        generations: [existingGen],
        idempotent: true,
      });
    }
  }

  // ── Load concept ───────────────────────────────────────────────────────────
  const { data: concept, error: conceptErr } = await supabaseAdmin
    .from("creative_concepts")
    .select("*")
    .eq("id", conceptId)
    .single();

  if (conceptErr || !concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const typedConcept = concept as CreativeConceptRow;

  // ── Verify project ownership ───────────────────────────────────────────────
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id, project_type, brand_name, audience, platform, status")
    .eq("id", typedConcept.project_id)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── Load brief ─────────────────────────────────────────────────────────────
  const { data: briefs } = await supabaseAdmin
    .from("creative_briefs")
    .select("*")
    .eq("project_id", typedConcept.project_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const brief = (briefs?.[0] as CreativeBriefRow | undefined) ?? null;
  const parsedBriefJson = (brief?.parsed_brief_json ?? {}) as Partial<ParsedBrief>;
  const proj = project as {
    project_type: string;
    brand_name?: string;
    audience?: string;
    platform?: string;
  };

  // Reconstruct ParsedBrief from stored data
  const parsedBrief: ParsedBrief = {
    projectType: proj.project_type,
    subject: String(parsedBriefJson.subject ?? proj.brand_name ?? "product"),
    productOrBrand: parsedBriefJson.productOrBrand,
    audience: parsedBriefJson.audience,
    platform: parsedBriefJson.platform,
    primaryGoal: parsedBriefJson.primaryGoal,
    headline: brief?.headline ?? parsedBriefJson.headline,
    subheadline: brief?.subheadline ?? parsedBriefJson.subheadline,
    cta: brief?.cta ?? parsedBriefJson.cta,
    stylePreset: brief?.style_preset ?? parsedBriefJson.stylePreset,
    moodTags: (brief?.mood_tags as string[]) ?? parsedBriefJson.moodTags ?? [],
    textRenderingIntent:
      (brief?.text_rendering_intent as ParsedBrief["textRenderingIntent"]) ??
      parsedBriefJson.textRenderingIntent,
    realismVsDesign: brief?.realism_vs_design ?? parsedBriefJson.realismVsDesign,
    colorPreference: brief?.color_preference ?? parsedBriefJson.colorPreference,
    aspectRatio: aspectRatio ?? brief?.aspect_ratio ?? parsedBriefJson.aspectRatio ?? "1:1",
    compositionPreference: parsedBriefJson.compositionPreference,
    avoidElements: parsedBriefJson.avoidElements ?? [],
    suggestions: parsedBriefJson.suggestions ?? [],
  };

  // ── Select provider ────────────────────────────────────────────────────────
  const providerDecision = selectCreativeProvider({
    textRenderingIntent: parsedBrief.textRenderingIntent,
    realismVsDesign: parsedBrief.realismVsDesign,
    stylePreset: parsedBrief.stylePreset ?? undefined,
    projectType: parsedBrief.projectType,
    providerOverride,
    modelOverride,
    conceptRecommendation:
      typedConcept.recommended_provider
        ? {
            provider: typedConcept.recommended_provider,
            model: typedConcept.recommended_model ?? "",
            reason: typedConcept.recommended_use_case ?? "",
          }
        : null,
  });

  // ── Compose normalized prompt ──────────────────────────────────────────────
  const conceptPayload = typedConcept.concept_payload as Record<string, unknown> | null;
  const creativeConceptForPrompt = conceptPayload?.title
    ? (conceptPayload as unknown as Parameters<typeof composeNormalizedPrompt>[0])
    : {
        title: typedConcept.title,
        summary: typedConcept.summary,
        rationale: typedConcept.rationale ?? "",
        layoutStrategy: typedConcept.layout_strategy ?? "",
        typographyStrategy: typedConcept.typography_strategy ?? "",
        colorStrategy: typedConcept.color_strategy ?? "",
        visualFocus: "",
        providerRecommendation: {
          provider: typedConcept.recommended_provider ?? "openai",
          model: typedConcept.recommended_model ?? "gpt-image-1",
          reason: typedConcept.recommended_use_case ?? "",
        },
        scores: typedConcept.scores as {
          textAccuracy: number;
          cinematicImpact: number;
          designControl: number;
          speed: number;
        },
        generationBlueprint: {
          compositionRules: [],
          lightingRules: [],
          textPlacementRules: [],
          renderingNotes: [],
        },
      };

  const effectiveAspectRatio = aspectRatio ?? brief?.aspect_ratio ?? "1:1";
  const normalizedPrompt: NormalizedCreativeRenderPrompt = composeNormalizedPrompt(
    creativeConceptForPrompt as Parameters<typeof composeNormalizedPrompt>[0],
    parsedBrief,
    effectiveAspectRatio
  );
  const promptString = normalizedPromptToString(normalizedPrompt);

  // ── Reserve credits ────────────────────────────────────────────────────────
  const totalCost = computeTotalGenerationCost(providerDecision.model, count, "base");

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id: user.id,
      p_amount: totalCost,
      p_description: `Creative Director — ${count} render(s) via ${providerDecision.provider}`,
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

  // ── Queue generation records ───────────────────────────────────────────────
  const generationRecords: CreativeGenerationRow[] = [];

  for (let i = 0; i < count; i++) {
    const iKey =
      count === 1
        ? (idempotencyKey ?? undefined)
        : idempotencyKey
          ? `${idempotencyKey}_${i}`
          : undefined;

    try {
      const gen = await saveGeneration({
        project_id: typedConcept.project_id,
        concept_id: conceptId,
        user_id: user.id,
        generation_type: "base",
        provider: providerDecision.provider,
        model: providerDecision.model,
        request_payload: {
          promptString,
          aspectRatio: effectiveAspectRatio,
          count,
          ...(blendMode ? { blendMode } : {}),
          ...(locks ? { locks } : {}),
        },
        normalized_prompt: normalizedPrompt as unknown as Record<string, unknown>,
        status: "processing",
        credit_cost: computeTotalGenerationCost(providerDecision.model, 1, "base"),
        idempotency_key: iKey,
        session_id: session_id ?? undefined,
      });
      generationRecords.push(gen);
    } catch (err) {
      console.error(`[concepts/generate] saveGeneration failed for output ${i}:`, err);
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
          modelKey:    providerDecision.model,
          prompt:      promptString,
          aspectRatio: effectiveAspectRatio,
          // Pass first reference image as imageUrl (GPT Image edit mode)
          ...(referenceImages && referenceImages.length > 0
            ? { imageUrl: referenceImages[0].url }
            : {}),
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

  // ── Update project status ──────────────────────────────────────────────────
  await supabaseAdmin
    .from("creative_projects")
    .update({
      status: "generated",
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", typedConcept.project_id);

  // ── Log activity (fire-and-forget) ────────────────────────────────────────
  void logActivity(typedConcept.project_id, user.id, "generation_queued", {
    concept_id: conceptId,
    count,
    provider: providerDecision.provider,
    model: providerDecision.model,
    credits_spent: totalCost,
  });

  return NextResponse.json({ generations: finalGenerations });
}
