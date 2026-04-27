/**
 * useSequenceState — Cinematic Shot Sequencing State
 *
 * All sequencing logic lives here. VideoStudioShell consumes this hook
 * and passes state down to ShotStack as props.
 *
 * Responsibilities:
 *   - Hold the ordered list of shots (the "stack")
 *   - Track each shot's status (pending / dispatching / generating / done / failed)
 *   - Expose actions: addShot, removeShot, updateShot, reorderShots
 *   - Manage API calls: createSequence, startGeneration, advanceQueue
 *   - Poll each dispatched shot's job via /api/studio/jobs/[jobId]/status
 *   - Call /api/studio/video/sequence/advance when a shot completes
 *
 * This hook does NOT touch VideoStudioShell's existing standard-mode state.
 * It is additive — VideoStudioShell conditionally renders ShotStack using
 * the sequence mode toggle, which is also managed here.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { suggestNextShot } from "@/lib/video/shot-flow-engine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ShotStatus =
  | "pending"      // not yet dispatched
  | "dispatching"  // submitted to generate route, awaiting job creation
  | "generating"   // job created, polling in progress
  | "done"         // generation complete
  | "failed";      // generation failed

// ── Shot relationship types ───────────────────────────────────────────────────

/** HOW the cut from the previous shot to this one happens (shots 2+ only) */
export type TransitionType = "cut_to" | "match_action" | "continue_motion";

/** WHAT this shot IS in cinematic terms — framing / composition intent */
export type CompositionType =
  | "reveal"
  | "close_up"
  | "wide_establishing"
  | "reaction_shot"
  | "over_the_shoulder";

// ─────────────────────────────────────────────────────────────────────────────

export interface SequenceShot {
  /** Stable local ID — not the DB UUID (assigned after create) */
  localId:              string;
  /** DB UUID — set after POST /api/studio/video/sequences */
  dbId?:               string;
  /** 1-based position in the stack */
  shotNumber:          number;
  /** User's raw prompt for this shot */
  prompt:              string;
  /** Optional start frame image URL */
  startFrameUrl?:      string | null;
  /** Optional end frame image URL */
  endFrameUrl?:        string | null;
  /** Camera/motion control settings */
  motionControl?:      Record<string, unknown> | null;
  /** If true, no frame carry-forward from prior shot */
  continuityDisabled:  boolean;
  /**
   * HOW the cut from the previous shot happens.
   * Always null for shot 1 — it has no predecessor.
   * Setting continue_motion automatically forces continuityDisabled = false.
   */
  transitionType?:     TransitionType | null;
  /**
   * WHAT this shot IS in cinematic terms.
   * Optional for all shots. Only one value active at a time.
   * Skipped in prompt construction when transitionType = continue_motion
   * to avoid contradictory framing instructions.
   */
  compositionType?:    CompositionType | null;
  /**
   * True when transitionType / compositionType were pre-filled by the shot flow
   * engine suggestion. Cleared immediately when the user explicitly selects any
   * relationship pill. UI-only — never persisted to DB or sent to the API.
   */
  isSuggested?:        boolean;
  /**
   * Shot duration in seconds (5 or 10). Derived by the shot flow engine based on
   * composition and transition type. Guaranteed non-null — makeShot() seeds the
   * default and addShot() always applies suggestion.duration. Sent to the API as
   * per-shot duration_seconds; falls back to the global durationSeconds if somehow
   * missing at the call site.
   */
  duration:            number;
  /** Current lifecycle status */
  status:              ShotStatus;
  /** Set when dispatched */
  jobId?:              string | null;
  /** Set when generation completes */
  assetId?:            string | null;
  /** Set when generation fails */
  errorMessage?:       string | null;
  /** Resolved prompt — set by API after continuity engine runs */
  resolvedPrompt?:     string | null;
}

export interface SequenceState {
  /** The DB sequence ID — set after the sequence is created */
  sequenceId:     string | null;
  /** Current overall sequence status */
  sequenceStatus: "idle" | "creating" | "generating" | "completed" | "partial" | "failed";
  /** Ordered shots */
  shots:          SequenceShot[];
  /** True when any API call is in flight */
  loading:        boolean;
  /** Top-level error message */
  error:          string | null;
}

export interface SequenceActions {
  addShot:         (prompt?: string) => void;
  removeShot:      (localId: string) => void;
  updateShot:      (localId: string, patch: Partial<SequenceShot>) => void;
  moveShot:        (fromIndex: number, toIndex: number) => void;
  clearSequence:   () => void;
  startGeneration: (modelId: string, aspectRatio: string, durationSeconds: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeLocalId(): string {
  return `shot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeShot(shotNumber: number, prompt = ""): SequenceShot {
  return {
    localId:             makeLocalId(),
    shotNumber,
    prompt,
    continuityDisabled:  false,
    transitionType:      null,
    compositionType:     null,
    duration:            DEFAULT_SHOT_DURATION,
    status:              "pending",
  };
}

/** Renumber shots so shotNumber is always 1-based sequential */
function renumber(shots: SequenceShot[]): SequenceShot[] {
  return shots.map((s, i) => ({ ...s, shotNumber: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// POLL INTERVAL
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS    = 5_000;
const POLL_MAX_RETRIES    = 54;  // ~4.5 min at 5s intervals
const DEFAULT_SHOT_DURATION = 5; // seconds — fallback when engine returns no suggestion

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSequenceState(accessToken: string | null) {
  const [state, setState] = useState<SequenceState>({
    sequenceId:     null,
    sequenceStatus: "idle",
    shots:          [makeShot(1)],  // start with one empty shot
    loading:        false,
    error:          null,
  });

  // Track active polling timers — keyed by jobId
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pollCounts = useRef<Map<string, number>>(new Map());

  // ── Local mutation helpers ────────────────────────────────────────────────

  const patchShot = useCallback((localId: string, patch: Partial<SequenceShot>) => {
    setState(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.localId === localId ? { ...s, ...patch } : s),
    }));
  }, []);

  const patchShotByJobId = useCallback((jobId: string, patch: Partial<SequenceShot>) => {
    setState(prev => ({
      ...prev,
      shots: prev.shots.map(s => s.jobId === jobId ? { ...s, ...patch } : s),
    }));
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const addShot = useCallback((prompt = "") => {
    setState(prev => {
      // Ask the shot flow engine for a suggestion based on the current stack.
      // Shot 1 (empty stack) returns null/null with confidence 0 — no suggestion applied.
      const suggestion = suggestNextShot(prev.shots);
      const hasSuggestion =
        suggestion.transitionType !== null || suggestion.compositionType !== null;

      const newShot: SequenceShot = {
        ...makeShot(prev.shots.length + 1, prompt),
        // Apply suggestion only for shots 2+ (shot 1 has no predecessor)
        ...(prev.shots.length > 0 && hasSuggestion
          ? {
              transitionType:  suggestion.transitionType,
              compositionType: suggestion.compositionType,
              isSuggested:     true,
              duration:        suggestion.duration,
            }
          : {}),
      };

      return { ...prev, shots: renumber([...prev.shots, newShot]) };
    });
  }, []);

  const removeShot = useCallback((localId: string) => {
    setState(prev => {
      if (prev.shots.length <= 1) return prev; // keep at least one
      const next = prev.shots.filter(s => s.localId !== localId);
      return { ...prev, shots: renumber(next) };
    });
  }, []);

  const updateShot = useCallback((localId: string, patch: Partial<SequenceShot>) => {
    const userChangedRelationship =
      patch.transitionType !== undefined || patch.compositionType !== undefined;

    const safePatch: Partial<SequenceShot> = {
      ...patch,
      // Guard: continue_motion requires frame continuity — force continuityDisabled off.
      // Belt-and-suspenders; the UI also prevents the contradiction.
      ...(patch.transitionType === "continue_motion" ? { continuityDisabled: false } : {}),
      // Clear the suggested flag the moment the user explicitly picks any relationship.
      // Once dismissed, suggestions are not re-applied for this shot.
      ...(userChangedRelationship ? { isSuggested: false } : {}),
    };
    patchShot(localId, safePatch);
  }, [patchShot]);

  const moveShot = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      if (fromIndex === toIndex) return prev;
      const next = [...prev.shots];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, shots: renumber(next) };
    });
  }, []);

  const clearSequence = useCallback(() => {
    // Cancel all polls
    for (const timer of pollTimers.current.values()) clearTimeout(timer);
    pollTimers.current.clear();
    pollCounts.current.clear();

    setState({
      sequenceId:     null,
      sequenceStatus: "idle",
      shots:          [makeShot(1)],
      loading:        false,
      error:          null,
    });
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────

  const pollJob = useCallback(async (
    jobId:      string,
    shotLocalId: string,
    sequenceId: string,
    shotDbId:   string,
  ) => {
    if (!accessToken) return;

    const attempts = (pollCounts.current.get(jobId) ?? 0) + 1;
    pollCounts.current.set(jobId, attempts);

    if (attempts > POLL_MAX_RETRIES) {
      patchShotByJobId(jobId, { status: "failed", errorMessage: "Generation timed out" });
      return;
    }

    try {
      const res  = await fetch(`/api/studio/jobs/${jobId}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json() as { data?: { status: string; url?: string; assetId?: string } };
      const jobStatus = json.data?.status ?? "";

      if (jobStatus === "done" || jobStatus === "success") {
        const assetId = json.data?.assetId ?? null;
        patchShotByJobId(jobId, { status: "done", assetId });

        // Advance the sequence queue
        try {
          await fetch("/api/studio/video/sequence/advance", {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:  `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              sequence_id: sequenceId,
              shot_id:     shotDbId,
              job_result:  "done",
              asset_id:    assetId,
            }),
          });
        } catch {
          // advance is best-effort — don't block UI
        }

        return; // stop polling
      }

      if (jobStatus === "failed" || jobStatus === "error") {
        // Extract provider error message from status response if available
        const providerError = (json.data as Record<string, unknown> | undefined)?.error_message
          ?? (json.data as Record<string, unknown> | undefined)?.error
          ?? "Generation failed";
        const shotErrorMsg = typeof providerError === "string" ? providerError : "Generation failed";

        patchShotByJobId(jobId, { status: "failed", errorMessage: shotErrorMsg });

        // Report failure to advance route so queue moves forward + error is persisted
        try {
          await fetch("/api/studio/video/sequence/advance", {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:  `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              sequence_id:   sequenceId,
              shot_id:       shotDbId,
              job_result:    "failed",
              error_message: shotErrorMsg,
            }),
          });
        } catch {
          // best-effort
        }

        return; // stop polling
      }

      // Still in progress — schedule next poll
      const timer = setTimeout(() => {
        void pollJob(jobId, shotLocalId, sequenceId, shotDbId);
      }, POLL_INTERVAL_MS);
      pollTimers.current.set(jobId, timer);

    } catch {
      // Network error — retry
      const timer = setTimeout(() => {
        void pollJob(jobId, shotLocalId, sequenceId, shotDbId);
      }, POLL_INTERVAL_MS);
      pollTimers.current.set(jobId, timer);
    }
  }, [accessToken, patchShotByJobId]);

  // ── Start generation ──────────────────────────────────────────────────────

  const startGeneration = useCallback(async (
    modelId:         string,
    aspectRatio:     string,
    durationSeconds: number,
  ) => {
    if (!accessToken) return;

    const shots = state.shots;
    if (shots.some(s => !s.prompt.trim())) {
      setState(prev => ({ ...prev, error: "All shots must have a prompt before generating" }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, sequenceStatus: "creating" }));

    try {
      // Step 1 — Create sequence + shots
      const createRes = await fetch("/api/studio/video/sequences", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model_id:         modelId,
          aspect_ratio:     aspectRatio,
          duration_seconds: durationSeconds,
          shots: shots.map(s => ({
            shot_number:          s.shotNumber,
            prompt:               s.prompt.trim(),
            start_frame_url:      s.startFrameUrl   ?? null,
            end_frame_url:        s.endFrameUrl     ?? null,
            motion_control:       s.motionControl   ?? null,
            continuity_disabled:  s.continuityDisabled,
            transition_type:      s.transitionType  ?? null,
            composition_type:     s.compositionType ?? null,
            duration_seconds:     s.duration        ?? durationSeconds,
          })),
        }),
      });

      const createJson = await createRes.json() as {
        data?: { sequence: { id: string; video_shots: Array<{ id: string; shot_number: number }> } };
        error?: string;
      };

      if (!createRes.ok || !createJson.data?.sequence) {
        throw new Error(createJson.error ?? "Failed to create sequence");
      }

      const { sequence } = createJson.data;
      const sequenceId   = sequence.id;

      // Map DB shot IDs back to localIds
      const dbShotMap = new Map<number, string>(
        sequence.video_shots.map(s => [s.shot_number, s.id])
      );

      setState(prev => ({
        ...prev,
        sequenceId,
        sequenceStatus: "generating",
        shots: prev.shots.map(s => ({
          ...s,
          dbId: dbShotMap.get(s.shotNumber),
        })),
      }));

      // Step 2 — Dispatch generation
      const genRes = await fetch("/api/studio/video/sequence/generate", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sequence_id: sequenceId }),
      });

      const genJson = await genRes.json() as {
        data?: {
          shots: Array<{
            id:          string;
            shot_number: number;
            jobId:       string | null;
            assetId:     string | null;
            status:      string;
          }>;
        };
        error?: string;
      };

      if (!genRes.ok || !genJson.data) {
        throw new Error(genJson.error ?? "Failed to start generation");
      }

      // Update shot statuses + start polling dispatched shots
      setState(prev => ({
        ...prev,
        loading: false,
        shots: prev.shots.map(s => {
          const dispatched = genJson.data!.shots.find(d => d.shot_number === s.shotNumber);
          if (!dispatched) return s;
          return {
            ...s,
            status:  dispatched.status as ShotStatus,
            jobId:   dispatched.jobId,
            assetId: dispatched.assetId,
          };
        }),
      }));

      // Start polling for each dispatched shot (those with a jobId)
      for (const dispatched of genJson.data.shots) {
        if (!dispatched.jobId) continue;
        const shot = shots.find(s => s.shotNumber === dispatched.shot_number);
        if (!shot) continue;
        const dbId = dbShotMap.get(dispatched.shot_number) ?? "";

        const timer = setTimeout(() => {
          void pollJob(dispatched.jobId!, shot.localId, sequenceId, dbId);
        }, POLL_INTERVAL_MS);
        pollTimers.current.set(dispatched.jobId, timer);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setState(prev => ({
        ...prev,
        loading:        false,
        error:          msg,
        sequenceStatus: "failed",
      }));
    }
  }, [accessToken, state.shots, pollJob]);

  return {
    state,
    actions: {
      addShot,
      removeShot,
      updateShot,
      moveShot,
      clearSequence,
      startGeneration,
    } satisfies SequenceActions,
  };
}
