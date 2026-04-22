/**
 * GET /api/assets/[assetId]/details
 *
 * Returns structured metadata for a single asset.
 * Caller must own the asset (user_id check).
 *
 * Response: { asset, generation_metadata, enriched_metadata }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { AssetDetailsResponse } from "@/lib/metadata/types";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await context.params;
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  // ── DB query ──────────────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, studio, status, url, prompt, model_key, provider, aspect_ratio, credits_cost, created_at, error_message, user_id, generation_metadata, enriched_metadata"
    )
    .eq("id", assetId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  if (data.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Build response ────────────────────────────────────────────────────────
  const response: AssetDetailsResponse = {
    asset: {
      id:            data.id,
      studio:        data.studio,
      status:        data.status,
      url:           data.url ?? null,
      prompt:        data.prompt ?? null,
      model_key:     data.model_key,
      provider:      data.provider,
      aspect_ratio:  data.aspect_ratio ?? null,
      credits_cost:  data.credits_cost ?? null,
      created_at:    data.created_at,
      error_message: data.error_message ?? null,
    },
    generation_metadata: data.generation_metadata ?? null,
    enriched_metadata:   data.enriched_metadata   ?? null,
  };

  return NextResponse.json(response);
}
