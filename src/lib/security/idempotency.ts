/**
 * Generation idempotency layer.
 *
 * Prevents double-charges when clients retry on timeout or network error.
 *
 * How it works:
 *   1. Before dispatching a generation, call checkIdempotency(key).
 *      - If a completed row exists and is within TTL → return cached result
 *      - If a processing row exists → return 409 (still running)
 *      - If nothing exists → proceed and call markProcessing(key, userId)
 *   2. On generation success → call markComplete(key, assetId, jobId, resultUrl)
 *   3. On generation failure → call markFailed(key)
 *
 * Key derivation:
 *   SHA256(userId + ":" + modelKey + ":" + sha256(prompt) + ":" + floor(now/300)*300)
 *   The 300-second (5-minute) time bucket means identical retries within
 *   5 minutes of each other share the same idempotency key.
 *
 * Table: public.generation_idempotency (created in migration 025)
 * TTL:   5 minutes (expires_at column)
 */

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const IDEMPOTENCY_WINDOW_S = 300; // 5 minutes

/**
 * Generate a stable idempotency key for a generation request.
 * Two requests with identical user + model + prompt within the 5-minute window
 * will produce the same key and be treated as duplicates.
 */
export function generateIdempotencyKey(
  userId:   string,
  modelKey: string,
  prompt:   string,
): string {
  // Floor timestamp to nearest 5-minute bucket
  const bucket = Math.floor(Date.now() / 1000 / IDEMPOTENCY_WINDOW_S) * IDEMPOTENCY_WINDOW_S;

  const raw = `${userId}:${modelKey}:${prompt}:${bucket}`;
  return createHash("sha256").update(raw).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type IdempotencyCheckResult =
  | { outcome: "proceed" }
  | { outcome: "duplicate_complete"; assetId: string | null; jobId: string | null; resultUrl: string | null }
  | { outcome: "duplicate_processing" }
  | { outcome: "error"; message: string };  // DB error — caller should proceed (fail open)

// ─────────────────────────────────────────────────────────────────────────────
// CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether this key has already been seen within its TTL.
 *
 * Returns:
 *   "proceed"              → No live record found. Safe to dispatch.
 *   "duplicate_complete"   → Previous run finished. Return cached result.
 *   "duplicate_processing" → Previous run still in progress. Return 409.
 *   "error"                → DB lookup failed. Caller should fail open (proceed).
 */
export async function checkIdempotency(
  idempotencyKey: string,
): Promise<IdempotencyCheckResult> {
  const { data, error } = await supabaseAdmin
    .from("generation_idempotency")
    .select("status, asset_id, job_id, result_url, expires_at")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // PGRST116 = no rows found — this is the happy path (new request)
      return { outcome: "proceed" };
    }
    // Unexpected DB error — fail open so we never block legitimate requests
    console.error("[idempotency] check error:", error.message);
    return { outcome: "error", message: error.message };
  }

  if (!data) {
    return { outcome: "proceed" };
  }

  // Check TTL manually (Postgres partial index handles this too, but double-check)
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt <= Date.now()) {
    // Expired row — treat as fresh
    return { outcome: "proceed" };
  }

  if (data.status === "completed") {
    return {
      outcome:   "duplicate_complete",
      assetId:   data.asset_id   ?? null,
      jobId:     data.job_id     ?? null,
      resultUrl: data.result_url ?? null,
    };
  }

  if (data.status === "processing") {
    return { outcome: "duplicate_processing" };
  }

  // Failed status — allow retry
  return { outcome: "proceed" };
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a "processing" row to claim this key.
 * Call immediately before dispatching to the provider.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING so concurrent retries don't error.
 */
export async function markIdempotencyProcessing(
  idempotencyKey: string,
  userId:         string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("generation_idempotency")
    .insert({
      idempotency_key: idempotencyKey,
      user_id:         userId,
      status:          "processing",
    })
    .select()
    .maybeSingle();   // suppress 409 on concurrent insert

  if (error && error.code !== "23505") {
    // 23505 = unique_violation — another concurrent request claimed it first, that's fine
    console.error("[idempotency] markProcessing error:", error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK COMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update an existing "processing" row to "completed" once generation finishes.
 * Stores assetId, jobId, and resultUrl for future duplicate responses.
 */
export async function markIdempotencyComplete(
  idempotencyKey: string,
  assetId:        string | null,
  jobId:          string | null,
  resultUrl:      string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("generation_idempotency")
    .update({ status: "completed", asset_id: assetId, job_id: jobId, result_url: resultUrl })
    .eq("idempotency_key", idempotencyKey);

  if (error) {
    console.error("[idempotency] markComplete error:", error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK FAILED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a "processing" row to "failed" when dispatch errors out.
 * A failed key is treated as expired — future retries can proceed.
 */
export async function markIdempotencyFailed(
  idempotencyKey: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("generation_idempotency")
    .update({ status: "failed" })
    .eq("idempotency_key", idempotencyKey);

  if (error) {
    console.error("[idempotency] markFailed error:", error.message);
  }
}
