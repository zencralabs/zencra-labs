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
import { parseBrief } from "@/lib/creative-director/brief-parser";
import { saveBrief, updateBrief } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";
import type { CreativeBriefRow } from "@/lib/creative-director/types";

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
  const proj = project as {
    project_type: string;
    brand_name?: string;
    audience?: string;
    platform?: string;
  };

  // Build brief parser input from project + body
  const parserInput = {
    projectType: proj.project_type,
    brandName: proj.brand_name ?? undefined,
    audience: proj.audience ?? undefined,
    platform: proj.platform ?? undefined,
    goal: input.goal,
    headline: input.headline,
    subheadline: input.subheadline,
    cta: input.cta,
    additionalNotes: input.additionalCopyNotes,
    stylePreset: input.stylePreset,
    moodTags: input.moodTags,
    visualIntensity: input.visualIntensity,
    textRenderingIntent: input.textRenderingIntent,
    realismVsDesign: input.realismVsDesign,
    colorPreference: input.colorPreference,
  };

  // Run brief parsing
  let parsedBrief;
  try {
    parsedBrief = await parseBrief(parserInput);
  } catch (err) {
    console.error(`[brief/route] parseBrief failed for project ${projectId}:`, err);
    return NextResponse.json({ error: "Brief parsing failed" }, { status: 502 });
  }

  // Check for existing brief
  const { data: existingBriefs } = await supabaseAdmin
    .from("creative_briefs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const existingBriefId = (existingBriefs?.[0] as { id?: string } | undefined)?.id;

  const briefData = {
    project_id: projectId,
    goal: input.goal,
    headline: input.headline,
    subheadline: input.subheadline,
    cta: input.cta,
    additional_copy_notes: input.additionalCopyNotes,
    project_type: proj.project_type,
    style_preset: input.stylePreset,
    mood_tags: input.moodTags ?? [],
    visual_intensity: input.visualIntensity,
    text_rendering_intent: input.textRenderingIntent,
    realism_vs_design: input.realismVsDesign,
    color_preference: input.colorPreference,
    aspect_ratio: input.aspectRatio,
    reference_assets: (input.referenceAssets ?? []) as unknown[],
    advanced_settings: (input.advancedSettings ?? {}) as Record<string, unknown>,
    parsed_brief_json: parsedBrief as unknown as Record<string, unknown>,
    original_input: input.originalInput,
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

  return NextResponse.json({ brief, parsedBrief });
}
