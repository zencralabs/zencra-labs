// GET  /api/lipsync/[id]   — fetch a single lip sync generation
// DELETE /api/lipsync/[id] — soft-delete (mark cancelled, keep DB row)

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;

  const { data: gen, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, status, provider, quality_mode, duration_seconds, aspect_ratio, output_url, thumbnail_url, credits_used, parameters, created_at, completed_at")
    .eq("id", id)
    .single();

  if (error || !gen) {
    return NextResponse.json(
      { success: false, error: "Generation not found" },
      { status: 404 }
    );
  }

  if (gen.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, generation: gen });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;

  // Verify ownership
  const { data: gen, error: fetchError } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, status, credits_used, parameters")
    .eq("id", id)
    .single();

  if (fetchError || !gen) {
    return NextResponse.json(
      { success: false, error: "Generation not found" },
      { status: 404 }
    );
  }

  if (gen.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  // Mark as cancelled (soft-delete keeps audit trail)
  const { error: updateError } = await supabaseAdmin
    .from("generations")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id });
}
