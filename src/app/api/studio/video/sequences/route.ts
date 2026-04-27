/**
 * /api/studio/video/sequences
 *
 * CRUD for video sequence records.
 *
 * GET    — list all sequences for the authenticated user
 * POST   — create a new sequence (with initial shots)
 * PATCH  — update sequence metadata or status
 * DELETE — soft-delete a sequence (sets sequence_status = 'deleted') [future]
 *
 * This route manages the structure of sequences and shots only.
 * Dispatching generation is handled by /api/studio/video/sequence/generate.
 *
 * Response shapes:
 *   GET    200 { success: true, data: { sequences: SequenceRow[] } }
 *   POST   201 { success: true, data: { sequence: SequenceRow } }
 *   PATCH  200 { success: true, data: { sequence: SequenceRow } }
 */

import { NextResponse }     from "next/server";
import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import {
  ok,
  apiErr,
  invalidInput,
  serverErr,
  parseBody,
} from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET — list sequences
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "20", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0",  10), 0);

  const { data, error } = await supabaseAdmin
    .from("video_sequences")
    .select(`
      *,
      video_shots (
        id, shot_number, shot_status, resolved_prompt,
        start_frame_url, end_frame_url, job_id, asset_id, error_message
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[sequences GET] DB error:", error.message);
    return serverErr("Failed to load sequences");
  }

  return ok({ sequences: data ?? [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — create sequence + initial shots
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const parsed = await parseBody(req);
  if (parsed.parseError) return parsed.parseError;
  const body = parsed.body;

  const VALID_TRANSITION_TYPES  = ["cut_to", "match_action", "continue_motion"] as const;
  const VALID_COMPOSITION_TYPES = [
    "reveal", "close_up", "wide_establishing", "reaction_shot", "over_the_shoulder",
  ] as const;

  const { title, description, model_id, aspect_ratio, duration_seconds, shots } = body as {
    title?:           string;
    description?:     string;
    model_id:         string;
    aspect_ratio?:    string;
    duration_seconds?: number;
    shots?: Array<{
      shot_number:         number;
      prompt:              string;
      start_frame_url?:    string | null;
      end_frame_url?:      string | null;
      motion_control?:     Record<string, unknown> | null;
      continuity_disabled?: boolean;
      transition_type?:    string | null;
      composition_type?:   string | null;
    }>;
  };

  if (!model_id) return invalidInput("model_id is required");
  if (!shots || shots.length === 0) return invalidInput("At least one shot is required");
  if (shots.length > 10) return invalidInput("Maximum 10 shots per sequence");

  // Validate shot numbers are sequential from 1
  const sortedShots = [...shots].sort((a, b) => a.shot_number - b.shot_number);
  for (let i = 0; i < sortedShots.length; i++) {
    const s = sortedShots[i];
    if (s.shot_number !== i + 1) {
      return invalidInput("Shot numbers must be sequential starting from 1");
    }
    if (!s.prompt?.trim()) {
      return invalidInput(`Shot ${i + 1} is missing a prompt`);
    }
    // First shot cannot have a transition type — it has no predecessor
    if (s.shot_number === 1 && s.transition_type) {
      return invalidInput("Shot 1 cannot have a transition_type — it has no predecessor");
    }
    // Validate enum values if present
    if (s.transition_type && !VALID_TRANSITION_TYPES.includes(s.transition_type as typeof VALID_TRANSITION_TYPES[number])) {
      return invalidInput(`Invalid transition_type "${s.transition_type}" for shot ${s.shot_number}`);
    }
    if (s.composition_type && !VALID_COMPOSITION_TYPES.includes(s.composition_type as typeof VALID_COMPOSITION_TYPES[number])) {
      return invalidInput(`Invalid composition_type "${s.composition_type}" for shot ${s.shot_number}`);
    }
  }

  // Create sequence
  const { data: sequence, error: seqErr } = await supabaseAdmin
    .from("video_sequences")
    .insert({
      user_id:          userId,
      title:            title?.trim() ?? null,
      description:      description?.trim() ?? null,
      model_id,
      aspect_ratio:     aspect_ratio ?? "16:9",
      duration_seconds: duration_seconds ?? 5,
      sequence_status:  "draft",
      total_shots:      sortedShots.length,
      completed_shots:  0,
    })
    .select()
    .single();

  if (seqErr || !sequence) {
    console.error("[sequences POST] create error:", seqErr?.message);
    return serverErr("Failed to create sequence");
  }

  // Create shots
  const shotInserts = sortedShots.map(s => ({
    sequence_id:          sequence.id,
    user_id:              userId,
    shot_number:          s.shot_number,
    prompt:               s.prompt.trim(),
    start_frame_url:      s.start_frame_url  ?? null,
    end_frame_url:        s.end_frame_url    ?? null,
    motion_control:       s.motion_control   ?? null,
    continuity_disabled:  s.continuity_disabled ?? false,
    // Relationship types — clean API mapping: snake_case in ↔ snake_case DB
    transition_type:      s.transition_type  ?? null,
    composition_type:     s.composition_type ?? null,
    shot_status:          "pending",
  }));

  const { data: createdShots, error: shotsErr } = await supabaseAdmin
    .from("video_shots")
    .insert(shotInserts)
    .select();

  if (shotsErr) {
    console.error("[sequences POST] shots insert error:", shotsErr.message);
    // Clean up orphaned sequence
    await supabaseAdmin.from("video_sequences").delete().eq("id", sequence.id);
    return serverErr("Failed to create shots");
  }

  return NextResponse.json(
    { success: true, data: { sequence: { ...sequence, video_shots: createdShots } } },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — update sequence metadata or status
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const parsedPatch = await parseBody(req);
  if (parsedPatch.parseError) return parsedPatch.parseError;
  const body = parsedPatch.body;

  const { sequence_id, title, description, sequence_status } = body as {
    sequence_id:      string;
    title?:           string;
    description?:     string;
    sequence_status?: string;
  };

  if (!sequence_id) return invalidInput("sequence_id is required");

  const updates: Record<string, unknown> = {};
  if (title           !== undefined) updates.title           = title?.trim() ?? null;
  if (description     !== undefined) updates.description     = description?.trim() ?? null;
  if (sequence_status !== undefined) updates.sequence_status = sequence_status;

  if (Object.keys(updates).length === 0) return invalidInput("No fields to update");

  const { data, error } = await supabaseAdmin
    .from("video_sequences")
    .update(updates)
    .eq("id", sequence_id)
    .eq("user_id", userId)   // ownership check
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return apiErr("JOB_NOT_FOUND", "Sequence not found", 404);
    }
    console.error("[sequences PATCH] update error:", error?.message);
    return serverErr("Failed to update sequence");
  }

  return ok({ sequence: data });
}
