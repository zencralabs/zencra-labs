/**
 * GET  /api/creative-director/characters
 * List the authenticated user's characters (Soul IDs).
 *
 * POST /api/creative-director/characters
 * Create a new character + generate a Soul ID.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateCharacterBody {
  name: string;
  appearancePrompt: string;
  visualStyle?: "cinematic" | "realistic" | "anime";
  voiceProfile?: string;
  personalityTraits?: Record<string, unknown>;
  visualReferenceUrl?: string;
}

// ── GET — list characters ──────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[characters/GET] DB error:", error);
    return NextResponse.json({ error: "Failed to load characters" }, { status: 500 });
  }

  return NextResponse.json({ characters: data ?? [] });
}

// ── POST — create character ────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as CreateCharacterBody;

  if (!b.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!b.appearancePrompt?.trim()) {
    return NextResponse.json({ error: "appearancePrompt is required" }, { status: 400 });
  }

  // Generate a unique Soul ID
  const soulId = `soul_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabaseAdmin
    .from("characters")
    .insert({
      user_id:              user.id,
      name:                 b.name.trim(),
      soul_id:              soulId,
      appearance_prompt:    b.appearancePrompt.trim(),
      visual_style:         b.visualStyle ?? "cinematic",
      voice_profile:        b.voiceProfile ?? null,
      personality_traits:   b.personalityTraits ?? {},
      visual_reference_url: b.visualReferenceUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[characters/POST] DB error:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }

  return NextResponse.json({ character: data }, { status: 201 });
}
