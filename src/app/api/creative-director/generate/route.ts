/**
 * POST /api/creative-director/generate
 *
 * Creative Director v2 — direction-aware image generation.
 * Scope: Image Studio only. Still images only. No video / motion.
 *
 * Flow:
 * 1. Load direction — must exist, belong to user, and be locked (is_locked=true)
 * 2. Load direction_refinements (nullable — still builds prompt without them)
 * 3. Load direction_elements
 * 4. Build enriched prompt via buildDirectionPrompt()
 * 5. Select provider — use direction.model_key if locked, else selectCreativeProvider()
 * 6. Reserve credits via spend_credits RPC
 * 7. Insert creative_generation records with direction_id
 * 8. Call studioDispatch with skipCredits=true (credits already deducted)
 * 9. Update generation status + return results
 *
 * Body:
 *   directionId     string   required
 *   count           number   1–4, default 1
 *   aspectRatio     string   optional (e.g. "16:9"), default "1:1"
 *   providerOverride string  optional — override provider selection
 *   modelOverride    string  optional — override model key
 *   idempotencyKey  string   optional
 *   session_id      string   optional
 */

import { NextResponse }         from "next/server";
import { getAuthUser }          from "@/lib/supabase/server";
import { supabaseAdmin }        from "@/lib/supabase/admin";
import { buildDirectionPrompt } from "@/lib/creative-director/direction-prompt";
import { selectCreativeProvider } from "@/lib/creative-director/provider-router";
import { computeTotalGenerationCost } from "@/lib/creative-director/credit-estimator";
import { saveGeneration, updateGenerationStatus } from "@/lib/creative-director/save-history";
import { studioDispatch }       from "@/lib/api/studio-dispatch";
import { getClientIp }          from "@/lib/security/rate-limit";
import type {
  CreativeDirectionRow,
  DirectionRefinementsRow,
  DirectionElementRow,
  CreativeGenerationRow,
} from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Body validation helpers ───────────────────────────────────────────────────
const VALID_COUNTS   = [1, 2, 3, 4] as const;
const DEFAULT_ASPECT = "1:1";

function clampCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, Math.round(n)));
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    directionId,
    count:            rawCount,
    aspectRatio:      rawAspect,
    providerOverride,
    modelOverride,
    idempotencyKey,
    session_id,
  } = body as Record<string, unknown>;

  if (!directionId || typeof directionId !== "string") {
    return NextResponse.json({ error: "directionId is required" }, { status: 400 });
  }

  const count       = clampCount(rawCount ?? 1);
  const aspectRatio = typeof rawAspect === "string" ? rawAspect : DEFAULT_ASPECT;

  // ── Idempotency check ──────────────────────────────────────────────────────
  if (idempotencyKey && typeof idempotencyKey === "string") {
    const { data: existingGen } = await supabaseAdmin
      .from("creative_generations")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingGen) {
      return NextResponse.json({ generations: [existingGen], idempotent: true });
    }
  }

  // ── Load direction ─────────────────────────────────────────────────────────
  const { data: direction, error: dirErr } = await supabaseAdmin
    .from("creative_directions")
    .select("*")
    .eq("id", directionId)
    .single();

  if (dirErr || !direction) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  const dir = direction as CreativeDirectionRow;

  if (dir.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!dir.is_locked) {
    return NextResponse.json(
      { error: "Direction must be locked before generating. Lock the direction first." },
      { status: 422 }
    );
  }

  // ── Verify direction belongs to a project owned by user ───────────────────
  if (dir.project_id) {
    const { data: proj, error: projErr } = await supabaseAdmin
      .from("creative_projects")
      .select("id")
      .eq("id", dir.project_id)
      .eq("user_id", user.id)
      .single();

    if (projErr || !proj) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  // ── Load refinements (nullable) ────────────────────────────────────────────
  const { data: refinementsRow } = await supabaseAdmin
    .from("direction_refinements")
    .select("*")
    .eq("direction_id", directionId)
    .single();

  const refinements = (refinementsRow as DirectionRefinementsRow | null) ?? null;

  // ── Load elements ─────────────────────────────────────────────────────────
  const { data: elementsRows } = await supabaseAdmin
    .from("direction_elements")
    .select("*")
    .eq("direction_id", directionId)
    .order("position", { ascending: true });

  const elements = (elementsRows ?? []) as DirectionElementRow[];

  // ── Build enriched prompt ─────────────────────────────────────────────────
  const promptString = buildDirectionPrompt(dir, refinements, elements);

  // ── Select provider ────────────────────────────────────────────────────────
  // If direction has a locked model_key, honour it. Otherwise fall back to
  // selectCreativeProvider with optional caller overrides.
  const effectiveModelKey = (modelOverride as string | undefined) ?? dir.model_key ?? undefined;

  const providerDecision = selectCreativeProvider({
    providerOverride: providerOverride as string | undefined,
    modelOverride:    effectiveModelKey,
    // No brief/concept signals — direction already carries creative intent
    textRenderingIntent: undefined,
    realismVsDesign:     undefined,
    stylePreset:         undefined,
    projectType:         "image",
    conceptRecommendation: null,
  });

  // ── Reserve credits ────────────────────────────────────────────────────────
  const totalCost = computeTotalGenerationCost(providerDecision.model, count, "base");

  const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
    "spend_credits",
    {
      p_user_id:    user.id,
      p_amount:     totalCost,
      p_description: `Creative Director — ${count} image(s) via ${providerDecision.provider}`,
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
      typeof idempotencyKey !== "string" ? undefined :
      count === 1 ? idempotencyKey        : `${idempotencyKey}_${i}`;

    try {
      const gen = await saveGeneration({
        project_id:   dir.project_id ?? "",
        concept_id:   dir.concept_id ?? undefined,
        direction_id: directionId,
        user_id:      user.id,
        generation_type: "base",
        provider:     providerDecision.provider,
        model:        providerDecision.model,
        request_payload: {
          promptString,
          aspectRatio,
          count,
          directionId,
        },
        normalized_prompt: { directionPrompt: promptString },
        status:            "processing",
        credit_cost:       computeTotalGenerationCost(providerDecision.model, 1, "base"),
        idempotency_key:   iKey,
        session_id:        typeof session_id === "string" ? session_id : undefined,
      });
      generationRecords.push(gen);
    } catch (err) {
      console.error(`[cd/generate] saveGeneration failed for output ${i}:`, err);
    }
  }

  // ── Dispatch via studioDispatch ───────────────────────────────────────────
  // Credits already deducted above → skipCredits=true prevents double-charge.
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
          aspectRatio,
          skipCredits: true,
        });

        const status: CreativeGenerationRow["status"] =
          job.status === "pending"  ? "processing" :
          job.status === "success"  ? "completed"  : "failed";

        await updateGenerationStatus(gen.id, status, assetId);
        return { ...gen, status, asset_id: assetId, url: job.result?.url ?? null };
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

  // ── Update project last_activity ───────────────────────────────────────────
  if (dir.project_id) {
    void supabaseAdmin
      .from("creative_projects")
      .update({
        status:           "generated",
        last_activity_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq("id", dir.project_id);
  }

  return NextResponse.json({ generations: finalGenerations });
}
