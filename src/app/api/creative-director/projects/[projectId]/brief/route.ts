/**
 * POST /api/creative-director/projects/[projectId]/brief
 *
 * Create or update the brief for a project.
 * Runs parseBrief() to generate structured parsed_brief_json.
 * If a brief already exists for the project, updates it.
 * Returns { brief, parsedBrief }.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateBriefInput } from "@/lib/creative-director/schemas";
import { saveBrief, updateBrief } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import type { CreativeBriefRow } from "@/lib/creative-director/types";

// Note: parseBrief() is intentionally NOT called here.
// The brief route is responsible only for persisting raw brief fields.
// parseBrief() (OpenAI call) runs exclusively in the concepts route,
// right before concept generation. This prevents a hard OpenAI dependency
// on every brief save and removes the "Brief parsing failed" 502 blocker.

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

  // Verify project ownership
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id, project_type, brand_name, audience, platform")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBriefInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const input = validation.data;

  // Check for existing brief
  const { data: existingBriefs } = await supabaseAdmin
    .from("creative_briefs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const existingBriefId = (existingBriefs?.[0] as { id?: string } | undefined)?.id;

  // parsed_brief_json is populated by the concepts route after parseBrief() succeeds.
  // We do NOT call parseBrief() here — brief save must never depend on OpenAI.
  // Preserve any existing parsed_brief_json by not overwriting it unless needed.
  const briefData = {
    project_id: projectId,
    goal: input.goal,
    headline: input.headline,
    subheadline: input.subheadline,
    cta: input.cta,
    additional_copy_notes: input.additionalCopyNotes,
    style_preset: input.stylePreset,
    mood_tags: input.moodTags ?? [],
    visual_intensity: input.visualIntensity,
    text_rendering_intent: input.textRenderingIntent,
    realism_vs_design: input.realismVsDesign,
    color_preference: input.colorPreference,
    aspect_ratio: input.aspectRatio,
    reference_assets: (input.referenceAssets ?? []) as unknown[],
    advanced_settings: (input.advancedSettings ?? {}) as Record<string, unknown>,
    original_input: input.originalInput,
    // parsed_brief_json is intentionally omitted here.
    // saveBrief defaults it to {} as a sentinel; the concepts route overwrites it with real data.
  };

  let brief: CreativeBriefRow;
  let isUpdate = false;

  try {
    if (existingBriefId) {
      brief = await updateBrief(existingBriefId, briefData);
      isUpdate = true;
    } else {
      brief = await saveBrief(briefData);
    }
  } catch (err) {
    console.error(`[brief/route] Save brief failed:`, err);
    return NextResponse.json({ error: "Failed to save brief" }, { status: 500 });
  }

  // Log activity (fire-and-forget)
  void logActivity(
    projectId,
    user.id,
    isUpdate ? "brief_updated" : "brief_created",
    { brief_id: brief.id }
  );

  return NextResponse.json({ brief });
}
