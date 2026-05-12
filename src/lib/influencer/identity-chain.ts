// ─────────────────────────────────────────────────────────────────────────────
// Identity Chain Service
//
// Implements the Zencra Identity Engine sequential growing-memory chain.
//
// Locked architectural rules enforced here:
//   CHAIN RULE 1 — Growing Memory Chain (NOT previous-shot-only)
//     Shot 1: [canonical]
//     Shot 2: [canonical, shot1]
//     Shot 3: [canonical, shot1, shot2]
//     Shot 4: [canonical, shot1, shot2, shot3]
//     Shot 5: [canonical, shot1, shot2, shot3, shot4]
//     Cap: 5 total references. Canonical is ALWAYS ref[0].
//
//   CHAIN RULE 2 — Canonical URL must be permanent (Supabase Storage) before
//     chain starts. If canonical is on a provider CDN (fal.ai, etc.), mirror
//     it first. If mirror fails → throw CHAIN_CANONICAL_UNAVAILABLE hard error.
//     NEVER silently fall back to provider URL — that is silent identity corruption.
//
//   CHAIN RULE 3 — 9 metadata fields written to influencer_assets for every shot:
//     shot_index, chain_position, reference_chain_urls, canonical_asset_id,
//     identity_lock_id, provider, model_key, prompt_used, chain_session_id
//
// This service is platform infrastructure — not an AI Influencer feature.
// It powers AI Influencer, Character Studio, Creative Director, FCS, Video Studio.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID }               from "crypto";
import { supabaseAdmin }            from "@/lib/supabase/admin";
import {
  studioDispatch,
  pollAndUpdateJob,
  StudioDispatchError,
}                                   from "@/lib/api/studio-dispatch";
import { mirrorCandidateToStorage } from "@/lib/storage/upload";
import type { PackPromptItem }      from "@/lib/influencer/types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum references per shot. Canonical + prior outputs, capped at 5. */
const MAX_REFERENCES = 5;

/** Substring present in all Supabase Storage public URLs. */
const SUPABASE_DOMAIN = "supabase.co";

// ── Error class ───────────────────────────────────────────────────────────────

export class ChainError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ChainError";
    this.code = code;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IdentityChainInput {
  /** Authenticated user ID */
  userId:             string;
  /** Influencer whose identity sheet is being built */
  influencer_id:      string;
  /** Active identity lock for this influencer */
  identity_lock_id:   string;
  /** Canonical asset ID — anchors the chain and identifies the face lock */
  canonical_asset_id: string;
  /**
   * Canonical asset URL — may be a provider CDN or Supabase Storage URL.
   * resolveCanonicalUrl() upgrades it to a permanent Supabase URL before
   * the chain begins (CHAIN RULE 2).
   */
  canonical_url:      string;
  /** Identity sheet shot definitions — from buildIdentitySheetPrompts() */
  shots:              PackPromptItem[];
  /** Provider model key — e.g. "instant-character", "seedream-v5" */
  modelKey:           string;
}

export interface ChainShotResult {
  /** Internal job ID from studioDispatch */
  jobId:         string;
  /** Provider-issued external job ID (for status polling by clients) */
  externalJobId: string | null;
  /** Job status at time of chain return */
  status:        string;
  /** Shot label — e.g. "Front Portrait" */
  label:         string;
  /** 0-based position in the chain */
  shot_index:    number;
  /**
   * Confirmed permanent Supabase Storage URL for this shot.
   * Populated ONLY when status === "completed" and pollAndUpdateJob returned
   * a confirmed URL. Carried in the packs route response so the UI can hydrate
   * directly without re-polling shots that are already complete when the chain returns.
   * undefined = shot was dispatched but did not reach confirmed status before chain end.
   */
  url?:          string;
}

export interface IdentityChainResult {
  /** All shots dispatched — completed shots have status="completed" */
  shots:            ChainShotResult[];
  /**
   * UUID shared by all shots in this identity sheet run.
   * This is the root of the FCS continuity tree for this run.
   * Stored on every influencer_assets record for future graph reconstruction.
   */
  chain_session_id: string;
}

// ── Canonical URL resolver — CHAIN RULE 2 ────────────────────────────────────

/**
 * Resolve the canonical asset URL to a guaranteed-permanent Supabase Storage URL.
 *
 * Rules:
 *   1. URL already contains "supabase.co" → it is permanent, return as-is
 *   2. URL is on a provider CDN (fal.ai, fal.media, etc.) → mirror to Supabase Storage
 *   3. Mirror succeeds → return the permanent Supabase URL
 *   4. Mirror fails (returned URL still contains provider domain) → HARD FAILURE
 *
 * NEVER silently return a provider CDN URL from this function. The chain must
 * start only from a URL that will remain accessible indefinitely. Provider CDN
 * URLs are temporary; using one as the canonical reference would corrupt every
 * downstream shot once the URL expires.
 */
async function resolveCanonicalUrl(
  url:     string,
  assetId: string,
): Promise<string> {
  // Already permanent — Supabase Storage URL
  if (url.includes(SUPABASE_DOMAIN)) return url;

  // Provider CDN URL — mirror to Supabase Storage first
  console.info(
    `[identity-chain] resolveCanonicalUrl: provider CDN detected, mirroring to Supabase Storage`,
  );

  const mirrored = await mirrorCandidateToStorage(url, assetId);

  // Verify the mirror actually produced a permanent URL
  if (mirrored.includes(SUPABASE_DOMAIN)) {
    console.info(
      `[identity-chain] resolveCanonicalUrl: mirrored → ${mirrored.slice(0, 80)}`,
    );
    return mirrored;
  }

  // mirrorCandidateToStorage is non-fatal by design — it fell back to the
  // original provider URL. That is unacceptable for chain canonical anchoring.
  // Fail hard here so the UI can show a retry, rather than silently corrupting
  // every shot in the chain with a temporary URL.
  throw new ChainError(
    `Canonical URL could not be resolved to a permanent Supabase Storage URL. ` +
    `Provider CDN URL: ${url.slice(0, 100)}. ` +
    `The identity chain requires a permanent URL before it can begin. ` +
    `Please retry — the image will be mirrored to Zencra Storage on the next attempt.`,
    "CHAIN_CANONICAL_UNAVAILABLE",
  );
}

// ── Main chain builder ────────────────────────────────────────────────────────

/**
 * Build the identity sheet via a sequential growing-memory chain.
 *
 * Architecture:
 *   For each shot (in order):
 *     1. Build the growing reference array: [canonical, ...all prior confirmed outputs]
 *     2. Dispatch the shot via studioDispatch (creates pending asset record)
 *     3. Record in influencer_generation_jobs
 *     4. Server-side poll via pollAndUpdateJob — AWAIT COMPLETION before next shot
 *     5. On confirmed output: accumulate permanent URL into reference list
 *     6. Insert influencer_assets record with all 9 chain metadata fields (RULE 3)
 *
 * The server-side poll (step 4) is what makes memory accumulation possible.
 * Without awaiting each shot, Shot 2 cannot reference Shot 1's actual output.
 *
 * Fatal errors (billing failures, canonical unavailable): throw — caller handles
 * Non-fatal errors (individual shot dispatch/poll failures): log and continue chain
 *
 * NOTE: This is a long-running operation. The calling route must export
 *   `export const maxDuration = 300` to survive on Vercel Pro.
 */
export async function buildIdentityChain(
  input: IdentityChainInput,
): Promise<IdentityChainResult> {
  const {
    userId,
    influencer_id,
    identity_lock_id,
    canonical_asset_id,
    canonical_url,
    shots,
    modelKey,
  } = input;

  // ── CHAIN RULE 2 — resolve canonical to permanent URL before chain starts ──
  const permanentCanonicalUrl = await resolveCanonicalUrl(
    canonical_url,
    canonical_asset_id,
  );

  // ── chain_session_id — UUID shared by all shots in this run ───────────────
  // This is the continuity tree root for FCS and future character timeline graphs.
  // Stored on every influencer_assets record created by this chain (CHAIN RULE 3).
  const chain_session_id = randomUUID();

  console.info(
    `[identity-chain] Starting chain — ` +
    `influencer: ${influencer_id}, shots: ${shots.length}, ` +
    `model: ${modelKey}, session: ${chain_session_id}`,
  );

  // ── CHAIN RULE 1 — growing reference list ─────────────────────────────────
  // Canonical is always ref[0]. Confirmed shot outputs are appended after each
  // successful poll. The list grows: [c] → [c,s1] → [c,s1,s2] → …
  // Capped at MAX_REFERENCES (5) before each dispatch.
  const confirmedUrls: string[] = [permanentCanonicalUrl];

  const completedShots: ChainShotResult[] = [];

  for (let shotIndex = 0; shotIndex < shots.length; shotIndex++) {
    const shot = shots[shotIndex];

    // CHAIN RULE 1 — build reference array for this shot
    // Canonical is always ref[0]; prior confirmed outputs follow (cap at 5 total)
    const referenceChainUrls = confirmedUrls.slice(0, MAX_REFERENCES);

    console.info(
      `[identity-chain] Shot ${shotIndex + 1}/${shots.length} — ` +
      `"${shot.label}" — refs: ${referenceChainUrls.length}`,
    );

    // ── Dispatch this shot ──────────────────────────────────────────────────
    let dispatchResult: Awaited<ReturnType<typeof studioDispatch>>;
    try {
      dispatchResult = await studioDispatch({
        userId,
        studio:      "character",
        modelKey,
        prompt:      shot.prompt,
        // Primary reference — canonical is always first
        imageUrl:    referenceChainUrls[0],
        // Full growing chain — for providers that support multi-reference
        // (Phase 1: instant-character uses imageUrl only; imageUrls is forwarded
        //  for future providers like bfl-kontext that support growing references)
        imageUrls:   referenceChainUrls,
        aspectRatio: shot.aspectRatio ?? "1:1",
        identity: {
          character_id:   influencer_id,
          reference_urls: referenceChainUrls,
        },
      });
    } catch (err) {
      if (err instanceof StudioDispatchError) {
        // Billing and account errors are fatal for the entire chain.
        // User must resolve them (or wait for provider recovery) before retrying.
        //
        // PROVIDER_CREDIT_EXHAUSTED: provider account wallet empty (not user's fault).
        //   The chain must still stop — every subsequent shot will fail identically.
        //   The StudioDispatchError already carries the sanitized user-facing message.
        //
        // INSUFFICIENT_CREDITS: user's own Zencra wallet empty.
        //   User must top up before retrying.
        if (
          err.code === "PROVIDER_CREDIT_EXHAUSTED" ||
          err.code === "INSUFFICIENT_CREDITS"       ||
          err.code === "SUBSCRIPTION_INACTIVE"      ||
          err.code === "TRIAL_EXHAUSTED"             ||
          err.code === "TRIAL_EXPIRED"               ||
          err.code === "FREE_LIMIT_REACHED"
        ) {
          console.error(
            `[identity-chain] Fatal error on shot ${shotIndex + 1}: ${err.code}`,
          );
          throw err;
        }
      }
      // Belt-and-suspenders: catch provider-side credit exhaustion that may arrive
      // as PROVIDER_ERROR if mapOrchestratorError did not reclassify it.
      // NB Pro signals balance exhaustion via HTTP 200 + body code 402.
      // We never want to continue the chain when the provider account is empty —
      // every subsequent shot will fail identically, burning user wait time.
      if (err instanceof StudioDispatchError && err.code === "PROVIDER_ERROR") {
        const lowerMsg = (err.message ?? "").toLowerCase();
        if (
          lowerMsg.includes("insufficient credits") ||
          lowerMsg.includes("credits are insufficient") ||
          lowerMsg.includes("please top up") ||
          lowerMsg.includes("top up") ||
          (lowerMsg.includes("credit") && lowerMsg.includes("balance"))
        ) {
          console.error(
            `[identity-chain] Shot ${shotIndex + 1} — provider account balance exhausted ` +
            `(detected in PROVIDER_ERROR message). Stopping chain.`,
          );
          throw new ChainError(
            `Provider account has insufficient credits: ${err.message}. ` +
            `Please top up the provider account balance and retry the identity sheet.`,
            "CHAIN_PROVIDER_BALANCE_EXHAUSTED",
          );
        }
      }
      // Non-billing dispatch errors — skip this shot, continue chain
      console.error(
        `[identity-chain] Shot ${shotIndex + 1} dispatch failed (non-fatal):`, err,
      );
      continue;
    }

    const { job, assetId } = dispatchResult;

    // ── Record in influencer_generation_jobs ──────────────────────────────
    // Written at dispatch time. Chain metadata fields (session, position) are
    // stored in the job's metadata JSONB column for traceability.
    await supabaseAdmin.from("influencer_generation_jobs").insert({
      influencer_id,
      identity_lock_id,
      canonical_asset_id,
      job_type:          "identity-sheet",
      status:            job.status,
      external_job_id:   job.externalJobId,
      prompt:            shot.prompt,
      pack_label:        shot.label,
      model_key:         modelKey,
      aspect_ratio:      shot.aspectRatio ?? "1:1",
      estimated_credits: job.estimatedCredits,
      metadata: {
        pack_type:       "identity-sheet",
        label:           shot.label,
        chain_session_id,
        shot_index:      shotIndex,
        chain_position:  `shot-${shotIndex + 1}`,
      },
    }).then(
      () => {},
      (err: unknown) => {
        // Non-fatal — job record is for traceability only; chain continues
        console.warn(`[identity-chain] influencer_generation_jobs insert failed:`, err);
      },
    );

    // Track shot in results (pre-poll status)
    completedShots.push({
      jobId:         job.id,
      externalJobId: job.externalJobId ?? null,
      status:        job.status,
      label:         shot.label,
      shot_index:    shotIndex,
    });

    // ── Server-side poll — CHAIN RULE 1 ──────────────────────────────────────
    // Await the shot's completion before dispatching the next shot.
    // This is the critical mechanism: without it, Shot 2 has no confirmed
    // output URL to reference, and the growing memory chain cannot accumulate.
    if (!job.externalJobId || !assetId) {
      console.warn(
        `[identity-chain] Shot ${shotIndex + 1} missing externalJobId or assetId — ` +
        `skipping poll, chain reference will not accumulate for this shot.`,
      );
      continue;
    }

    try {
      const pollResult = await pollAndUpdateJob(
        modelKey,
        job.externalJobId,
        assetId,
      );

      if (pollResult.status === "success" && pollResult.url) {
        const confirmedUrl = pollResult.url;

        // CHAIN RULE 1 — accumulate confirmed permanent URL for next shot
        confirmedUrls.push(confirmedUrl);

        // Update tracked shot to confirmed-complete with permanent URL
        const lastShot = completedShots[completedShots.length - 1];
        lastShot.status = "completed";
        lastShot.url    = confirmedUrl;

        console.info(
          `[identity-chain] Shot ${shotIndex + 1} confirmed. ` +
          `Chain refs: ${confirmedUrls.length}/${MAX_REFERENCES}`,
        );

        // ── CHAIN RULE 3 — write influencer_assets record with all 9 fields ──
        // Created AFTER poll confirms a permanent URL (not at dispatch time),
        // so url is always the Supabase Storage URL returned by pollAndUpdateJob.
        await supabaseAdmin.from("influencer_assets").insert({
          influencer_id,
          asset_type:    "identity-sheet",
          url:           confirmedUrl,
          thumbnail_url: confirmedUrl,
          is_hero:       false,
          identity_lock_id,
          metadata: {
            // CHAIN RULE 3 — all 9 required fields (written once, never overwritten)
            shot_index:           shotIndex,
            chain_position:       `shot-${shotIndex + 1}`,
            reference_chain_urls: referenceChainUrls,   // exact URLs used at dispatch
            canonical_asset_id,
            identity_lock_id,
            provider:             "fal-ai",
            model_key:            modelKey,
            prompt_used:          shot.prompt,
            chain_session_id,
          },
        }).then(
          () => {},
          (err: unknown) => {
            // Non-fatal — asset record failure does not stop chain
            // URL is still confirmed and accumulated into references
            console.warn(
              `[identity-chain] influencer_assets insert failed for shot ${shotIndex + 1}:`, err,
            );
          },
        );

      } else {
        // Poll returned non-success (failed, timeout, etc.)
        // This shot's output is not accumulated — chain continues without it
        console.warn(
          `[identity-chain] Shot ${shotIndex + 1} poll returned status: ` +
          `"${pollResult.status}"${pollResult.error ? ` — ${pollResult.error}` : ""}. ` +
          `Continuing chain without this output in references.`,
        );
      }
    } catch (pollErr) {
      // Poll threw — continue chain, this shot will not contribute to references
      console.error(
        `[identity-chain] Shot ${shotIndex + 1} poll failed (non-fatal):`, pollErr,
      );
    }
  }

  // Chain requires at least one dispatched shot to be considered successful
  if (completedShots.length === 0) {
    throw new ChainError(
      "Identity chain produced no shots — all dispatches failed. " +
      "Check provider availability and credit balance.",
      "CHAIN_ALL_SHOTS_FAILED",
    );
  }

  const confirmedCount = completedShots.filter(s => s.status === "completed").length;
  console.info(
    `[identity-chain] Chain complete — session: ${chain_session_id}, ` +
    `dispatched: ${completedShots.length}/${shots.length}, ` +
    `confirmed: ${confirmedCount}/${completedShots.length}`,
  );

  return { shots: completedShots, chain_session_id };
}
