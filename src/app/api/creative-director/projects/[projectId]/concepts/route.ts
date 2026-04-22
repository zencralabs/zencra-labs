/**
 * POST /api/creative-director/projects/[projectId]/concepts
 *
 * Generate exactly 3 creative concept directions for a project.
 *
 * Idempotency: if sessionKey matches creative_briefs.concepting_session_key,
 * returns existing concepts without charging credits.
 *
 * Flow:
 * 1. Check idempotency (sessionKey)
 * 2. Deduct 0.5 credits via spend_credits RPC
 * 3. Refresh parsedBrief from brief fields
 * 4. Generate exactly 3 concepts via generateConcepts()
 * 5. Save concepts to DB + store sessionKey for idempotency
 * 6. Log activity
 * 7. Return { concepts, parsedBrief, estimatedGenerationCredits }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateGenerateConcepts } from "@/lib/creative-director/schemas";
import { parseBrief } from "@/lib/creative-director/brief-parser";
import { generateConcepts } from "@/lib/creative-director/concept-engine";
import { saveConcepts, updateBrief } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import { getConceptingCost, estimateCredits } from "@/lib/creative-director/credit-estimator";
import { selectCreativeProvider } from "@/lib/creative-director/provider-router";
import type { CreativeBriefRow, CreativeConceptRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Verify project ownership and load project + brief
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id, project_type, brand_name, audience, platform")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Load the most recent brief
  const { data: briefs } = await supabaseAdmin
    .from("creative_briefs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const brief = (briefs?.[0] as CreativeBriefRow | undefined) ?? null;

  if (!brief) {
    return NextResponse.json(
      { error: "No brief found for this project. Create a brief first." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const validation = validateGenerateConcepts(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { sessionKey } = validation.data;

  // ── Idempotency check ──────────────────────────────────────────────────────
  if (sessionKey && brief.concepting_session_key === sessionKey) {
    const { data: existingConcepts } = await supabaseAdmin
      .from("creative_concepts")
      .select("*")
      .eq("project_id", projectId)
      .order("concept_index", { ascending: true });

    if (existingConcepts && existingConcepts.length > 0) {
      const defaultProvider = selectCreativeProvider({
        textRenderingIntent: brief.text_rendering_intent ?? undefined,
        realismVsDesign: brief.realism_vs_design ?? undefined,
        stylePreset: brief.style_preset ?? undefined,
        projectType: (project as { project_type: string }).project_type,
      });
      const estimate = estimateCredits(defaultProvider, 1);

      return NextResponse.json({
        concepts: existingConcepts,
        parsedBrief: brief.parsed_brief_json,
        estimatedGenerationCredits: estimate,
        idempotent: true,
      });
    }
  }

  // ── Deduct concepting credits ──────────────────────────────────────────────
  const conceptingCost = getConceptingCost();

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id: user.id,
      p_amount: conceptingCost,
      p_description: "Creative Director — concept generation (3 concepts)",
    }
  );

  if (creditErr) {
    console.error("[concepts/route] spend_credits RPC error:", creditErr.message);
    return NextResponse.json({ error: "Credit deduction failed" }, { status: 500 });
  }

  const creditRow = (creditResult as Array<{ success: boolean; error_message?: string }> | null)?.[0];
  if (!creditRow?.success) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        code: "INSUFFICIENT_CREDITS",
        required: conceptingCost,
      },
      { status: 402 }
    );
  }

  // ── Build brief parser input ───────────────────────────────────────────────
  const proj = project as {
    project_type: string;
    brand_name?: string;
    audience?: string;
    platform?: string;
  };

  const parserInput = {
    projectType: proj.project_type,
    brandName: proj.brand_name ?? undefined,
    audience: proj.audience ?? undefined,
    platform: proj.platform ?? undefined,
    goal: brief.goal ?? undefined,
    headline: brief.headline ?? undefined,
    subheadline: brief.subheadline ?? undefined,
    cta: brief.cta ?? undefined,
    additionalNotes: brief.additional_copy_notes ?? undefined,
    stylePreset: brief.style_preset ?? undefined,
    moodTags: (brief.mood_tags as string[]) ?? undefined,
    visualIntensity: brief.visual_intensity ?? undefined,
    textRenderingIntent: brief.text_rendering_intent ?? undefined,
    realismVsDesign: brief.realism_vs_design ?? undefined,
    colorPreference: brief.color_preference ?? undefined,
  };

  // ── Parse brief + generate concepts ───────────────────────────────────────
  let parsedBrief;
  let concepts;

  try {
    parsedBrief = await parseBrief(parserInput);
    concepts = await generateConcepts(parsedBrief, parserInput);
  } catch (err) {
    // Refund credits on failure
    await supabaseAdmin.rpc("refund_credits", {
      p_user_id: user.id,
      p_amount: conceptingCost,
      p_description: "Creative Director — concept generation refund (failed)",
    });

    console.error("[concepts/route] generateConcepts failed:", err);
    return NextResponse.json(
      { error: "Concept generation failed. Credits refunded." },
      { status: 502 }
    );
  }

  // ── Save concepts to DB ────────────────────────────────────────────────────
  let savedConcepts: CreativeConceptRow[];

  try {
    savedConcepts = await saveConcepts(
      concepts.map((concept, idx) => ({
        project_id: projectId,
        brief_id: brief.id,
        concept_index: idx,
        title: concept.title,
        summary: concept.summary,
        rationale: concept.rationale,
        layout_strategy: concept.layoutStrategy,
        typography_strategy: concept.typographyStrategy,
        color_strategy: concept.colorStrategy,
        recommended_provider: concept.providerRecommendation.provider,
        recommended_model: concept.providerRecommendation.model,
        recommended_use_case: concept.providerRecommendation.reason,
        scores: concept.scores as Record<string, number>,
        concept_payload: concept as unknown as Record<string, unknown>,
        is_selected: false,
      }))
    );
  } catch (err) {
    console.error("[concepts/route] saveConcepts failed:", err);
    return NextResponse.json(
      { error: "Failed to save concepts" },
      { status: 500 }
    );
  }

  // ── Update brief with sessionKey + refreshed parsedBrief ──────────────────
  try {
    await updateBrief(brief.id, {
      parsed_brief_json: parsedBrief as unknown as Record<string, unknown>,
      concepting_session_key: sessionKey ?? undefined,
    });
  } catch (err) {
    console.error("[concepts/route] updateBrief failed:", err);
  }

  // ── Update project status to "concepted" ──────────────────────────────────
  await supabaseAdmin
    .from("creative_projects")
    .update({
      status: "concepted",
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  // ── Build credit estimate for generation ──────────────────────────────────
  const defaultProvider = selectCreativeProvider({
    textRenderingIntent: parsedBrief.textRenderingIntent,
    realismVsDesign: parsedBrief.realismVsDesign,
    stylePreset: parsedBrief.stylePreset ?? undefined,
    projectType: parsedBrief.projectType,
  });
  const estimatedGenerationCredits = estimateCredits(defaultProvider, 1);

  // ── Log activity (fire-and-forget) ────────────────────────────────────────
  void logActivity(projectId, user.id, "concepts_generated", {
    concept_count: savedConcepts.length,
    credits_spent: conceptingCost,
  });

  return NextResponse.json({
    concepts: savedConcepts,
    parsedBrief,
    estimatedGenerationCredits,
  });
}
