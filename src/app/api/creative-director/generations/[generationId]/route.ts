/**
 * GET /api/creative-director/generations/[generationId]
 *
 * Return generation status and linked asset info.
 * Verifies user owns the parent project before returning data.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CreativeGenerationRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ generationId: string }>;
}

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { generationId } = await params;

  // Load generation
  const { data: generation, error: genErr } = await supabaseAdmin
    .from("creative_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (genErr || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  const gen = generation as CreativeGenerationRow;

  // Verify user owns the parent project (ownership check)
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id")
    .eq("id", gen.project_id)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // Load linked asset info if available
  let asset = null;
  if (gen.asset_id) {
    const { data: assetData } = await supabaseAdmin
      .from("assets")
      .select("id, url, width, height, mime_type, created_at")
      .eq("id", gen.asset_id)
      .single();

    asset = assetData;
  }

  return NextResponse.json({ generation: gen, asset });
}
