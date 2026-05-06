/**
 * GET /api/jobs/pending
 *
 * Returns all active (in-flight) generation jobs for the authenticated user.
 * Used by the client-side job recovery engine on page load / login to
 * re-attach polling loops for jobs that survived a refresh or tab reopen.
 *
 * ─── Sources queried ──────────────────────────────────────────────────────────
 *
 *   assets table    — status = "pending"  (image, video, audio, character, ugc, fcs)
 *   generations table — status ∈ {queued, processing}  (lipsync only)
 *
 * ─── Response ────────────────────────────────────────────────────────────────
 *
 *   200 { success: true, data: PendingJobDescriptor[] }
 *   401 UNAUTHORIZED
 *
 * ─── Performance ─────────────────────────────────────────────────────────────
 *
 *   Both queries are indexed on user_id + status.
 *   We cap at 50 rows per source — a user should never have more than a handful
 *   of genuinely pending jobs at once.
 */

import type { NextRequest } from "next/server";
import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, unauthorized } from "@/lib/api/route-utils";
import { getModel }         from "@/lib/providers/core/registry";
import { normalizeAssetDbStatus } from "@/lib/jobs/job-status-normalizer";
import type { PendingJobDescriptor } from "@/lib/jobs/job-recovery";
import type { StudioType } from "@/lib/providers/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maximum jobs returned per source to keep the response bounded. */
const MAX_PER_SOURCE = 50;

/** Prompt truncation length for display in the drawer. */
const PROMPT_MAX_CHARS = 120;

function truncatePrompt(p: string | null | undefined): string {
  if (!p) return "";
  return p.length > PROMPT_MAX_CHARS ? p.slice(0, PROMPT_MAX_CHARS) + "…" : p;
}

function resolveModelLabel(modelKey: string): string {
  return getModel(modelKey)?.displayName ?? modelKey;
}

export async function GET(req: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  const descriptors: PendingJobDescriptor[] = [];

  // ── Source 1: assets table (all studios except lipsync) ────────────────────
  try {
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("assets")
      .select("id, job_id, studio, model_key, prompt, credits_cost, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(MAX_PER_SOURCE);

    if (!assetsError && assets) {
      for (const asset of assets) {
        const createdAt = String(asset.created_at ?? "");
        const ageMs     = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
        const studio    = (asset.studio ?? "image") as StudioType;
        const modelKey  = String(asset.model_key ?? "");

        descriptors.push({
          jobId:      String(asset.job_id),
          assetId:    String(asset.id),
          studio,
          modelKey,
          modelLabel: resolveModelLabel(modelKey),
          prompt:     truncatePrompt(asset.prompt as string | null),
          status:     normalizeAssetDbStatus("pending", ageMs),
          creditCost: typeof asset.credits_cost === "number" ? asset.credits_cost : undefined,
          createdAt,
        });
      }
    }
  } catch (err) {
    // Log but don't fail the entire request — LipSync source still runs
    console.error("[jobs/pending] assets query failed:", err);
  }

  // ── Source 2: generations table (lipsync only) ─────────────────────────────
  // LipSync uses its own table ("generations") and a separate status endpoint.
  // We recover these alongside asset-based jobs so the drawer shows everything.
  try {
    const { data: gens, error: gensError } = await supabaseAdmin
      .from("generations")
      .select("id, status, quality_mode, credits_used, created_at")
      .eq("user_id", userId)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(MAX_PER_SOURCE);

    if (!gensError && gens) {
      for (const gen of gens) {
        const createdAt = String(gen.created_at ?? "");
        const ageMs     = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
        const rawStatus = String(gen.status ?? "queued");
        const status    = rawStatus === "queued" ? "queued"
                        : rawStatus === "processing" ? "processing"
                        : ageMs <= 30_000 ? "queued" : "processing";

        // LipSync has no fixed model_key — use quality_mode as the identifier
        const qualityMode = String(gen.quality_mode ?? "pro");
        const modelKey    = `lipsync_${qualityMode}`;
        const modelLabel  = qualityMode === "standard" ? "Lip Sync Standard" : "Lip Sync Pro";

        descriptors.push({
          // For lipsync, the polling route uses the generation row ID (not job_id)
          jobId:      String(gen.id),
          assetId:    String(gen.id),  // same — lipsync uses gen ID as the job reference
          studio:     "lipsync",
          modelKey,
          modelLabel,
          prompt:     "",  // lipsync has no text prompt
          status,
          creditCost: typeof gen.credits_used === "number" ? gen.credits_used : undefined,
          createdAt,
        });
      }
    }
  } catch (err) {
    console.error("[jobs/pending] generations (lipsync) query failed:", err);
  }

  return ok({ data: descriptors });
}
