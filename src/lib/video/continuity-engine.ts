/**
 * Zencra Cinematic Continuity Engine
 *
 * Pure function. No side effects. No DB calls. No provider calls.
 *
 * Receives:
 *   - An ordered array of shot inputs (prompt, frames, motion, continuity flag)
 *   - A globalIdentityContext — all @handles resolved ONCE before this call
 *
 * Returns:
 *   - An ordered array of ShotResolved objects with:
 *       resolved_prompt       — final prompt after 7-step construction
 *       effective_start_frame — carry-forward from previous shot's end_frame
 *                               (overrides manual start_frame unless continuity_disabled)
 *       identity_context      — snapshot of identity contexts used (for DB storage)
 *
 * Continuity precedence rule:
 *   If shot N-1 has end_frame_url AND shot N has continuity_disabled = false:
 *     → shot N's effective_start_frame_url = shot N-1's end_frame_url
 *     → this overrides whatever shot N had in start_frame_url
 *   If shot N has continuity_disabled = true:
 *     → shot N's start_frame_url is used as-is, no carry-forward
 *
 * Prompt construction order (7 steps):
 *   1. Identity anchor        — "Same person. Same face. Same identity as {name}."
 *   2. Shot context prefix    — "Shot {N}:" for shots 2+ (keeps narrative grounded)
 *   3. Core user prompt       — the cleaned, handle-replaced prompt text
 *   4. Transition hint        — shots 2+ only: "Continuing naturally from the previous scene."
 *   5. Motion note            — if camera control is set: brief motion descriptor
 *   6. Quality suffix         — "Cinematic quality, smooth motion, consistent lighting."
 *   7. Negative guard         — (omitted here — handled by per-provider negative_prompt)
 *
 * Steps are omitted when not applicable (no identity, no motion, etc.) to
 * avoid padding prompts with irrelevant language.
 */

import type { InfluencerIdentityContext } from "@/lib/ai-influencer/handle-resolver";
import {
  buildIdentityAnchor,
  injectIdentityIntoPrompt,
} from "@/lib/ai-influencer/handle-resolver";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Raw shot as supplied by the API route before continuity resolution */
export interface ShotInput {
  /** 1-based position in the sequence */
  shot_number: number;
  /** Raw user prompt for this shot (may contain @handles — already cleaned by caller) */
  prompt: string;
  /** User-provided start frame image URL (may be overridden by continuity engine) */
  start_frame_url?: string | null;
  /** User-provided end frame image URL */
  end_frame_url?: string | null;
  /** Camera / motion control settings */
  motion_control?: Record<string, unknown> | null;
  /**
   * When true, frame carry-forward from the previous shot is disabled.
   * The user's explicit start_frame_url is used as-is.
   * Default: false (carry-forward active).
   */
  continuity_disabled?: boolean;
  /**
   * HOW the cut from shot N-1 to this shot happens.
   * Null for shot 1 (no predecessor). Drives transition instruction text.
   */
  transition_type?: "cut_to" | "match_action" | "continue_motion" | null;
  /**
   * WHAT this shot IS in cinematic terms — framing / composition intent.
   * A modifier: never overrides identity or scene core intent.
   * Skipped when transition_type = "continue_motion" to avoid contradictory framing.
   */
  composition_type?: "reveal" | "close_up" | "wide_establishing" | "reaction_shot" | "over_the_shoulder" | null;
}

/**
 * Global identity context — resolved ONCE across all shots before the engine runs.
 * All @handles in all prompts are resolved against this single pass to ensure
 * identity consistency across the full sequence.
 */
export interface GlobalIdentityContext {
  /** All unique influencer contexts resolved across all shot prompts */
  resolvedContexts: InfluencerIdentityContext[];
  /** Quick lookup: handle string → context */
  contextByHandle: Map<string, InfluencerIdentityContext>;
  /** Primary context (first resolved, or null if no handles) */
  primaryContext: InfluencerIdentityContext | null;
}

/** Shot after continuity resolution — ready to be handed to shot-generator */
export interface ShotResolved {
  shot_number: number;
  /** Final constructed prompt — safe to pass directly to studioDispatch */
  resolved_prompt: string;
  /**
   * Effective start frame URL after continuity carry-forward.
   * May differ from the original start_frame_url if carry-forward applied.
   */
  effective_start_frame_url: string | null;
  /** End frame URL (unchanged — used as carry-forward input for next shot) */
  end_frame_url: string | null;
  /** Motion control (unchanged, passed through for dispatch) */
  motion_control: Record<string, unknown> | null;
  /**
   * Identity contexts active for this shot — stored in video_shots.identity_context
   * for debugging multi-character scenes later.
   */
  identity_context: InfluencerIdentityContext[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal motion descriptor for prompt enrichment (avoids long camera jargon) */
function motionDescriptor(mc: Record<string, unknown> | null | undefined): string | null {
  if (!mc) return null;
  const type = String(mc.type ?? "");
  if (type === "simple") return "with smooth controlled camera movement";
  if (type === "down_back")          return "with a pull-back camera motion";
  if (type === "forward_up")         return "with a push-in camera motion";
  if (type === "right_turn_forward") return "with a right arc camera motion";
  if (type === "left_turn_forward")  return "with a left arc camera motion";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// Handle pattern for stripping @mentions from prompt body (Fix 2)
const HANDLE_STRIP_RE = /@([a-zA-Z][a-zA-Z0-9_]{0,30})/g;

/**
 * Apply continuity rules and build resolved prompts for all shots.
 *
 * Pure function — same inputs always produce same outputs.
 * Caller is responsible for:
 *   1. Resolving all @handles across all shots ONCE before calling this
 *   2. Persisting the returned resolved_prompt / identity_context to DB
 *   3. Passing effective_start_frame_url + resolved_prompt to shot-generator
 */
export function applyContinuity(
  shots: ShotInput[],
  globalCtx: GlobalIdentityContext,
): ShotResolved[] {
  const resolved: ShotResolved[] = [];

  for (let i = 0; i < shots.length; i++) {
    const shot     = shots[i];
    const isFirst  = i === 0;
    const prevShot = isFirst ? null : resolved[i - 1];

    // ── Frame continuity ──────────────────────────────────────────────────────
    //
    // Precedence: previous shot's end_frame overrides this shot's start_frame,
    // UNLESS the user explicitly disabled continuity for this shot.

    let effectiveStartFrame: string | null = shot.start_frame_url ?? null;
    const hasFrameContinuity =
      !isFirst && !shot.continuity_disabled && !!prevShot?.end_frame_url;

    if (hasFrameContinuity) {
      effectiveStartFrame = prevShot!.end_frame_url!;
    }

    // ── Identity contexts active for this shot ────────────────────────────────
    //
    // All contexts from global resolution are available to every shot.
    // (All @handles were resolved from the union of all shot prompts.)
    const activeContexts = globalCtx.resolvedContexts;
    const primaryCtx     = globalCtx.primaryContext;

    // Fix 3: identity is only active for this shot when continuity is NOT disabled.
    // continuity_disabled = true means the shot is intentionally standalone —
    // no frame carry-forward AND no identity enforcement.
    const hasIdentity = !!primaryCtx && !shot.continuity_disabled;

    // ── Prompt construction ───────────────────────────────────────────────────
    //
    // Step order:
    //   1. Identity anchor        (if hasIdentity)
    //   2. Composition note       (modifier — if set AND not continue_motion)
    //   3. Shot prefix + core     (cleaned prompt, handles stripped)
    //   4. Transition instruction (replaces generic hint — type-specific language)
    //   5. Motion descriptor      (if motion_control set)
    //   6. Motion+identity bridge (if hasIdentity AND motionNote)
    //   7. Quality suffix

    const parts: string[] = [];

    // Step 1 — Identity anchor
    // Gated on hasIdentity (continuity_disabled shorts this out — Fix 3)
    if (hasIdentity) {
      parts.push(buildIdentityAnchor(primaryCtx!.displayName));
    }

    // Step 2 — Composition note (modifier, not dominant)
    // Skipped when transition_type = "continue_motion": "keep moving exactly as before"
    // contradicts reframing instructions like "wide establishing" or "close-up".
    // The motion takes precedence; composition is deferred.
    const compositionType = shot.composition_type ?? null;
    const skipComposition = shot.transition_type === "continue_motion";
    if (compositionType && !skipComposition) {
      const COMPOSITION_TEXT: Record<string, string> = {
        reveal:             "Reveal shot.",
        close_up:           "Close-up — tight framing on subject.",
        wide_establishing:  "Wide establishing shot — full environment, subject small in frame.",
        reaction_shot:      "Reaction shot — capture the subject's emotional response to the previous moment.",
        over_the_shoulder:  "Over-the-shoulder shot — frame subject from behind another character or foreground element.",
      };
      const compositionNote = COMPOSITION_TEXT[compositionType];
      if (compositionNote) parts.push(compositionNote);
    }

    // Step 3 — Shot prefix + core prompt (handles stripped — Fix 2)
    HANDLE_STRIP_RE.lastIndex = 0;
    const corePrompt = shot.prompt.trim().replace(
      HANDLE_STRIP_RE,
      (_match, name: string) => {
        const ctx = globalCtx.contextByHandle.get(name.toLowerCase());
        return ctx ? ctx.displayName : _match;
      },
    );

    if (!isFirst) {
      parts.push(`Shot ${shot.shot_number}: ${corePrompt}`);
    } else {
      parts.push(corePrompt);
    }

    // Step 4 — Transition instruction
    // For shots 2+: type-specific language replaces the generic "Continuing naturally…".
    // When no transition_type is set, fall back to the generic hint — but only when
    // there's something to be continuous about (identity or frame carry-forward).
    if (!isFirst) {
      const transitionType = shot.transition_type ?? null;
      if (transitionType === "cut_to") {
        parts.push(
          "Hard cut from the previous shot. Maintain overall visual consistency unless otherwise specified.",
        );
      } else if (transitionType === "match_action") {
        parts.push(
          "Match action cut — continue the exact motion and timing from where the previous shot ended.",
        );
      } else if (transitionType === "continue_motion") {
        parts.push(
          "Direct continuation. Unbroken camera movement and action from the previous shot. Do not reset position or momentum.",
        );
      } else if (hasIdentity || hasFrameContinuity) {
        // No explicit transition type set — inject generic hint only when continuity is meaningful
        parts.push(
          "Continuing naturally from the previous scene. Maintain consistent character appearance, environment, and visual style.",
        );
      }
    }

    // Step 5 — Motion descriptor (if camera control specified)
    const motionNote = motionDescriptor(shot.motion_control);
    if (motionNote) {
      parts.push(`Filmed ${motionNote}.`);
    }

    // Step 6 — Motion + identity bridge
    // When identity enforcement and camera motion are both active, the model
    // can prioritize one over the other. The bridge phrase keeps both stable.
    if (hasIdentity && motionNote) {
      parts.push(
        "Maintain facial consistency during motion. Avoid identity drift or distortion.",
      );
    }

    // Step 7 — Quality suffix
    parts.push("Cinematic quality, smooth motion, consistent lighting.");

    const resolvedPrompt = parts.join(" ");

    // ── Assemble resolved shot ────────────────────────────────────────────────

    resolved.push({
      shot_number:               shot.shot_number,
      resolved_prompt:           resolvedPrompt,
      effective_start_frame_url: effectiveStartFrame,
      end_frame_url:             shot.end_frame_url ?? null,
      motion_control:            shot.motion_control ?? null,
      identity_context:          activeContexts,
    });
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY — extract all unique @handles from multiple prompts in one pass
// ─────────────────────────────────────────────────────────────────────────────

/** Returns all unique lowercase handle strings found across an array of prompts */
export function extractHandlesFromShots(prompts: string[]): string[] {
  const HANDLE_PATTERN = /@([a-zA-Z][a-zA-Z0-9_]{0,30})/g;
  const seen = new Set<string>();
  for (const prompt of prompts) {
    HANDLE_PATTERN.lastIndex = 0;
    for (const m of prompt.matchAll(HANDLE_PATTERN)) {
      seen.add(m[1].toLowerCase());
    }
  }
  return [...seen];
}
