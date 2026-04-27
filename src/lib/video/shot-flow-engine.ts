/**
 * Shot Flow Engine v3.5 — Cinematic Standard Duration Modulation
 *
 * Pure function. No side effects. No DB calls. No randomness.
 *
 * Observes the existing shot stack and proposes the most cinematically
 * coherent transitionType, compositionType, and duration for the NEXT shot.
 *
 * Principle:
 *   - User remains final authority. This layer proposes, never decides.
 *   - Suggestions are pre-filled and immediately overridable.
 *   - No prompt text is touched. No continuity engine is modified.
 *   - No backend changes. No generation pipeline coupling.
 *
 * Input:
 *   The existing SequenceShot array BEFORE the new shot is added.
 *   Uses only: shotNumber, transitionType, compositionType, continuityDisabled.
 *   Prompt text and identity context are intentionally ignored.
 *
 * Output:
 *   {
 *     transitionType:  TransitionType | null,
 *     compositionType: CompositionType | null,
 *     duration:        number,   // suggested shot duration in seconds
 *     confidence:      number    // 0–1
 *   }
 *
 * Confidence scale (v2/v3):
 *   0.85 = strong continuity rule (continue_motion dominance)
 *   0.75 = repetition breaker (composition or transition repeat)
 *   0.70 = rhythm break (tight-to-wide, reveal timing)
 *   0.60 = normal cinematic pattern (opening, wide→detail, close→reaction)
 *   0.40 = default fallback
 *   0.00 = no suggestion (empty sequence)
 *
 * Duration scale (v3.5 — Cinematic Standard):
 *   3s  — compressed quick beat (repetition compression only)
 *   5s  — standard shot (connective, tight, emotional)
 *   8s  — reserved for future medium-expanded shots (not used in v3.5)
 *   12s — long breathing shot (reveal, wide establishing)
 *
 * Duration rules (applied after transition/composition is resolved):
 *   Rule 1: continue_motion | match_action         →  5  (connective, stay controlled)
 *   Rule 2: last 3 shots same tight comp           →  3  (repetition compression — one expressive exception)
 *   Rule 3: reveal | wide_establishing             → 12  (breathing room to land)
 *   Rule 4: close_up | reaction_shot | OTS         →  5  (emotional beat, stay focused)
 *   Rule 5: default                                →  5
 *
 * Tight compositions (eligible for Rule 2 compression):
 *   close_up, reaction_shot, over_the_shoulder
 *   NOT: wide_establishing, reveal
 *
 * Rule priority order (first match wins):
 *   1  Continue Motion protection    (conf 0.85, dur 5)
 *   2a Composition repetition break  (conf 0.75, dur per contrast result)
 *   2b Transition repetition break   (conf 0.75, dur 5)
 *   3  Tight-to-wide rhythm          (conf 0.70, dur 12)
 *   4  No-reveal rhythm break        (conf 0.70, dur 12, requires ≥3 shots)
 *   5  Wide-to-detail                (conf 0.60, dur 5)
 *   6  Close-up → reaction           (conf 0.60, dur 5)
 *   7  Opening logic                 (conf 0.60, dur 5, shots.length === 1)
 *   8  Fallback                      (conf 0.40, dur 5)
 *
 * Future-ready slots (not built):
 *   feedbackScore?: number   — user acceptance rate per rule
 *   userOverride?:  boolean  — track when suggestion was overridden
 */

import type { TransitionType, CompositionType, SequenceShot } from "@/hooks/useSequenceState";

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ShotSuggestion {
  transitionType:  TransitionType | null;
  compositionType: CompositionType | null;
  /** Suggested shot duration in seconds (3 | 5 | 12). 8 is reserved for v4. */
  duration:        number;
  /** 0–1. Higher = stronger pattern match. */
  confidence:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NULL SUGGESTION (used for edge cases)
// ─────────────────────────────────────────────────────────────────────────────

const NO_SUGGESTION: ShotSuggestion = {
  transitionType:  null,
  compositionType: null,
  duration:        5,
  confidence:      0,
};

// ─────────────────────────────────────────────────────────────────────────────
// TIGHT COMPOSITION SET
//
// Compositions eligible for repetition compression (Rule 2).
// wide_establishing and reveal are intentionally excluded — those should
// never compress; they need space to breathe.
// ─────────────────────────────────────────────────────────────────────────────

const TIGHT_COMPOSITIONS = new Set<CompositionType>([
  "close_up",
  "reaction_shot",
  "over_the_shoulder",
]);

// ─────────────────────────────────────────────────────────────────────────────
// DURATION HELPER (v3.5 — Cinematic Standard)
//
// Derives the suggested shot duration (seconds) from the resolved composition,
// transition type, and prior shot stack. Called at every return site after
// the suggestion is known. Input array is never mutated.
//
// Rule priority (first match wins):
//   1. continue_motion | match_action  →  5  (connective, stay controlled)
//   2. last 3 shots same tight comp   →  3  (repetition compression)
//   3. reveal | wide_establishing     → 12  (breathing room)
//   4. close_up | reaction_shot | OTS →  5  (emotional beat)
//   5. default                        →  5
//
// 8s is reserved for future medium-expanded shots and does not appear here.
// ─────────────────────────────────────────────────────────────────────────────

function durationFor(
  compositionType: CompositionType | null,
  transitionType:  TransitionType | null,
  shots:           readonly SequenceShot[],
): number {
  // Rule 1 — Connective transitions: stay controlled, never drag
  if (transitionType === "continue_motion" || transitionType === "match_action") return 5;

  // Rule 2 — Repetition compression (the one expressive exception)
  //
  // If the last 3 shots in the stack all share the same tight composition,
  // the sequence is in a dense visual rhythm. Compress the next shot to 3s
  // so the beat tightens before the inevitable release.
  //
  // Guards:
  //   - shots.length >= 3 (need at least 3 prior shots to establish the pattern)
  //   - anchor composition must be non-null (null = "no comp set", not a pattern)
  //   - anchor must be in TIGHT_COMPOSITIONS (wide/reveal excluded)
  //   - all 3 must share the same comp (partial matches do not qualify)
  if (shots.length >= 3) {
    const last3  = shots.slice(-3);
    const anchor = last3[0].compositionType ?? null;
    if (
      anchor != null &&
      TIGHT_COMPOSITIONS.has(anchor) &&
      last3.every(s => (s.compositionType ?? null) === anchor)
    ) {
      return 3;
    }
  }

  // Rule 3 — Breathing shots: need room to land
  if (compositionType === "reveal" || compositionType === "wide_establishing") return 12;

  // Rule 4 — Tight emotional beats: focused, not extended
  if (compositionType !== null && TIGHT_COMPOSITIONS.has(compositionType)) return 5;

  // Rule 5 — Default
  return 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITION CONTRAST MAP
//
// When the same composition repeats twice in a row, look up the contrast
// pair here. Compositions absent from this map fall through to later rules.
// ─────────────────────────────────────────────────────────────────────────────

const COMPOSITION_CONTRAST: Partial<Record<CompositionType, CompositionType>> = {
  close_up:          "wide_establishing",
  reaction_shot:     "wide_establishing",
  wide_establishing: "close_up",
  reveal:            "reaction_shot",
  // over_the_shoulder: not mapped — falls through to later rules
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the current shot stack, suggest the most cinematically coherent
 * transition and composition type for the next shot to be added.
 *
 * Deterministic — same input always produces same output.
 * Called once when a new shot is created; never re-run on edits.
 * Input array is never mutated.
 */
export function suggestNextShot(shots: readonly SequenceShot[]): ShotSuggestion {
  // Edge case: empty sequence — shot 1 has no predecessor, no transition to suggest
  if (shots.length === 0) return NO_SUGGESTION;

  const prev       = shots[shots.length - 1];
  const secondLast = shots.length >= 2 ? shots[shots.length - 2] : null;

  // ── Rule 1 — Continue Motion protection ──────────────────────────────────────
  //
  // Highest priority. If the previous shot uses Continue Motion, the next must
  // also continue it. Composition changes would fight the unbroken movement and
  // produce a visual contradiction in the generation prompt.
  //
  // Confidence raised to 0.85 — strongest signal in the engine.
  if (prev.transitionType === "continue_motion") {
    return {
      transitionType:  "continue_motion",
      compositionType: null,
      duration:        durationFor(null, "continue_motion", shots),
      confidence:      0.85,
    };
  }

  // ── Rule 2a — Composition repetition breaker ──────────────────────────────────
  //
  // If the last two shots share the same non-null composition type, the sequence
  // is developing a visual rut. Inject a contrast composition to restore rhythm.
  //
  // Only fires when:
  //   - At least 2 shots exist
  //   - Both compositions are non-null (null means "no composition set" — not a pattern)
  //   - The shared composition has a defined contrast in COMPOSITION_CONTRAST
  const prevComp = prev.compositionType ?? null;   // normalize undefined → null
  if (
    secondLast !== null &&
    prevComp !== null &&
    prevComp === secondLast.compositionType
  ) {
    const contrast = COMPOSITION_CONTRAST[prevComp];
    if (contrast !== undefined) {
      return {
        transitionType:  "cut_to",
        compositionType: contrast,
        duration:        durationFor(contrast, "cut_to", shots),
        confidence:      0.75,
      };
    }
    // No contrast defined for this composition — fall through
  }

  // ── Rule 2b — Transition repetition breaker ───────────────────────────────────
  //
  // If the last two shots both use cut_to, suggest match_action to vary the rhythm.
  // If the last two shots both use match_action, suggest cut_to.
  //
  // Guards:
  //   - Both shots must have non-null transitionTypes (shot 1 never does)
  //   - match_action implies continuity across BOTH shots — if either has
  //     continuityDisabled, the suggestion would create a contradiction
  if (secondLast !== null) {
    const lastT       = prev.transitionType;
    const secondLastT = secondLast.transitionType;

    if (
      lastT === "cut_to" &&
      secondLastT === "cut_to" &&
      !prev.continuityDisabled &&
      !secondLast.continuityDisabled
    ) {
      return {
        transitionType:  "match_action",
        compositionType: null,
        duration:        durationFor(null, "match_action", shots),
        confidence:      0.75,
      };
    }

    if (lastT === "match_action" && secondLastT === "match_action") {
      return {
        transitionType:  "cut_to",
        compositionType: null,
        duration:        durationFor(null, "cut_to", shots),
        confidence:      0.75,
      };
    }
  }

  // ── Rule 3 — Tight-to-wide rhythm ────────────────────────────────────────────
  //
  // After two consecutive close-up emotional shots (close_up then reaction_shot),
  // the audience needs space to breathe. A wide establishing shot provides it.
  //
  // This overrides the default close_up → reaction_shot chain (Rule 6), which
  // would otherwise create a third consecutive tight framing.
  if (
    secondLast !== null &&
    prev.compositionType === "close_up" &&
    secondLast.compositionType === "reaction_shot"
  ) {
    return {
      transitionType:  "cut_to",
      compositionType: "wide_establishing",
      duration:        durationFor("wide_establishing", "cut_to", shots),
      confidence:      0.70,
    };
  }

  // ── Rule 4 — No-reveal rhythm break ──────────────────────────────────────────
  //
  // Once a sequence has established 3+ shots without a reveal, suggest one.
  // The ≥3 guard ensures the reveal appears as a deliberate mid-sequence
  // device rather than immediately after the opening shot.
  //
  // Confidence 0.70 — lower than repetition breaking (0.75) but higher than
  // normal patterns (0.60), so it fires after urgent corrections but before
  // routine suggestions.
  if (shots.length >= 3) {
    const revealUsed = shots.some(s => s.compositionType === "reveal");
    if (!revealUsed) {
      return {
        transitionType:  "cut_to",
        compositionType: "reveal",
        duration:        durationFor("reveal", "cut_to", shots),
        confidence:      0.70,
      };
    }
  }

  // ── Rule 5 — Wide → Detail ───────────────────────────────────────────────────
  //
  // After a wide establishing shot, pull into detail. The audience has context;
  // now give them intimacy. Standard cinematic language.
  //
  // Confidence reduced from v1's 0.8 → 0.60 (normal pattern tier).
  if (prev.compositionType === "wide_establishing") {
    return {
      transitionType:  "cut_to",
      compositionType: "close_up",
      duration:        durationFor("close_up", "cut_to", shots),
      confidence:      0.60,
    };
  }

  // ── Rule 6 — Close-Up → Reaction ─────────────────────────────────────────────
  //
  // After a tight close-up, the natural follow is a reaction shot.
  // Classic shot-reverse-shot. Only reaches here when Rule 3 did not fire
  // (i.e., the shot before prev was not a reaction_shot).
  //
  // Confidence reduced from v1's 0.8 → 0.60 (normal pattern tier).
  if (prev.compositionType === "close_up") {
    return {
      transitionType:  "cut_to",
      compositionType: "reaction_shot",
      duration:        durationFor("reaction_shot", "cut_to", shots),
      confidence:      0.60,
    };
  }

  // ── Rule 7 — Opening logic ────────────────────────────────────────────────────
  //
  // For the second shot in a sequence, no composition-specific rule has matched.
  // Default to close_up — moves in from wherever shot 1 left off.
  //
  // Confidence reduced from v1's 0.8 → 0.60 (normal pattern tier).
  if (shots.length === 1) {
    return {
      transitionType:  "cut_to",
      compositionType: "close_up",
      duration:        durationFor("close_up", "cut_to", shots),
      confidence:      0.60,
    };
  }

  // ── Rule 8 — Default fallback ─────────────────────────────────────────────────
  //
  // No pattern detected. Suggest a plain cut with no composition preset,
  // letting the user choose their own framing.
  return {
    transitionType:  "cut_to",
    compositionType: null,
    duration:        durationFor(null, "cut_to", shots),
    confidence:      0.40,
  };
}
