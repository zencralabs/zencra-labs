/**
 * src/lib/security/velocity-scorer.ts
 *
 * Zencra Shield — Creator-Aware Velocity Scoring Engine.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  WHY "CREATOR-AWARE"?                                                    │
 * │                                                                          │
 * │  Zencra users are cinematic creators. They legitimately:                 │
 * │    • Generate 3–8 variations rapidly when iterating on a scene           │
 * │    • Retry the same prompt with small edits during creative flow         │
 * │    • Burst-generate across a short session then stop to review           │
 * │    • Produce multi-shot sequences for Future Cinema Studio               │
 * │    • Run high-volume rendering for long-form projects                    │
 * │                                                                          │
 * │  Naïve rate limiting would punish exactly the users who bring the most   │
 * │  value. This engine scores PATTERN, not just raw count.                  │
 * │                                                                          │
 * │  Creator patterns (low risk):                                            │
 * │    burst_then_pause   — several requests, then silence (review time)     │
 * │    model_iteration    — same model/studio repeated (refining a concept)  │
 * │    sequential_session — organic timing with natural variance             │
 * │                                                                          │
 * │  Suspicious patterns (elevated risk):                                    │
 * │    uniform_interval   — clock-like spacing (scripted)                    │
 * │    model_spray        — many different models/studios in rapid sequence  │
 * │    no_pause           — sustained high frequency with no review gaps     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Architecture:
 *   - Module-level in-memory state (Map per userId)
 *   - Timestamps stored in a ring buffer per user (capped at MAX_WINDOW_EVENTS)
 *   - Pattern detection runs on each scoring call — O(n) over the window
 *   - No external dependencies — pure Node.js
 *   - checkVelocity() is fire-and-forget safe: never throws to its caller
 *
 * Persistence:
 *   In-memory only. State is lost on server restart — intentional.
 *   Long-running abuse is caught by the 60min window before restart.
 *   Persistent scoring is a Phase B feature (Redis-backed sliding window).
 *
 * Mode behaviour:
 *   dry-run  — score computed, event emitted, NO enforcement
 *   observe  — score computed, event emitted + Discord alert, NO enforcement
 *   enforce  — score computed, event emitted, shouldEnforce=true returned
 *              (caller decides to block or cancel based on this flag)
 */

import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import { logger } from "@/lib/logger";
import type { VelocityEvent } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — all configurable via env vars (read at call time, not module init)
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_60S_MS   = 60 * 1000;
const WINDOW_5MIN_MS  = 5 * 60 * 1000;
const WINDOW_60MIN_MS = 60 * 60 * 1000;

/** Maximum events stored per user — ring buffer cap. Prevents unbounded memory. */
const MAX_WINDOW_EVENTS = 500;

/** Minimum gap between requests (ms) that we consider "natural" creator pause. */
const CREATOR_PAUSE_THRESHOLD_MS = 8000; // 8 seconds

/**
 * Minimum model concentration ratio for "model_iteration" pattern.
 * 0.7 = 70% of recent requests used the same model → creative iteration.
 */
const MODEL_ITERATION_RATIO = 0.70;

/**
 * Coefficient of variation threshold for "uniform_interval" detection.
 * Low CV = suspiciously regular timing = scripted.
 * 0.15 = 15% variation is the threshold below which we flag as suspicious.
 */
const UNIFORM_INTERVAL_CV_THRESHOLD = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskTier = "normal" | "elevated" | "critical";

/**
 * Creator pattern classification.
 *
 * These patterns inform the risk tier — they don't replace it.
 * A high count with a creator pattern = lower effective risk.
 * A moderate count with an abuse pattern = elevated effective risk.
 */
export type CreatorPattern =
  | "burst_then_pause"   // Healthy cinematic iteration — high frequency, then review gap
  | "model_iteration"    // Same model/studio focused — concept refinement
  | "sequential_session" // Organic timing with natural variance — normal creative flow
  | "uniform_interval"   // Clock-like spacing — likely scripted
  | "model_spray"        // Many models/studios in rapid succession — API probing
  | "sustained_high"     // No pause, no concentration — sustained abuse signal
  | "unknown";           // Insufficient data to classify

export interface VelocityScore {
  userId:       string;
  per60s:       number;
  per5min:      number;
  per60min:     number;
  riskTier:     RiskTier;
  creatorPattern: CreatorPattern;
  /** True only when mode=enforce AND riskTier=critical */
  shouldEnforce: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-request event stored in the sliding window
// ─────────────────────────────────────────────────────────────────────────────

interface RequestEvent {
  ts:          number; // Date.now() at request time
  studioType:  string; // "image" | "video" | "audio" | "fcs" | etc.
  modelKey:    string; // e.g. "gpt-image-2", "kling-30", "elevenlabs-v3"
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level in-memory state
// ─────────────────────────────────────────────────────────────────────────────

/** Ring buffer of recent requests per user */
const _userEvents = new Map<string, RequestEvent[]>();

/**
 * Prune events outside the 60-minute window and enforce the ring buffer cap.
 * Called before every read operation.
 */
function pruneUserEvents(userId: string, now: number): RequestEvent[] {
  const events = _userEvents.get(userId) ?? [];
  const cutoff  = now - WINDOW_60MIN_MS;
  // Keep only events within the 60min window
  const fresh   = events.filter((e) => e.ts >= cutoff);
  // Enforce cap (drop oldest if over limit)
  const capped  = fresh.length > MAX_WINDOW_EVENTS
    ? fresh.slice(fresh.length - MAX_WINDOW_EVENTS)
    : fresh;
  _userEvents.set(userId, capped);
  return capped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Window count helpers
// ─────────────────────────────────────────────────────────────────────────────

function countInWindow(events: RequestEvent[], windowMs: number, now: number): number {
  const cutoff = now - windowMs;
  return events.filter((e) => e.ts >= cutoff).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coefficient of variation: stddev / mean.
 * Low CV = uniform spacing = suspicious.
 */
function coefficientOfVariation(intervals: number[]): number {
  if (intervals.length < 3) return 1; // Not enough data — assume varied (normal)
  const mean   = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return 0;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Detect the creator pattern from recent events (5min window).
 *
 * Priority order: burst_then_pause > model_iteration > uniform_interval >
 *                 model_spray > sustained_high > sequential_session > unknown
 */
function detectPattern(events: RequestEvent[], now: number): CreatorPattern {
  // Need at least 4 events in 5min for meaningful pattern detection
  const recent5min = events.filter((e) => e.ts >= now - WINDOW_5MIN_MS);
  if (recent5min.length < 4) return "sequential_session";

  const sorted    = [...recent5min].sort((a, b) => a.ts - b.ts);
  const intervals = sorted.slice(1).map((e, i) => e.ts - sorted[i].ts);

  // ── burst_then_pause detection ────────────────────────────────────────────
  // Pattern: several requests close together, then a gap >= CREATOR_PAUSE_THRESHOLD_MS
  // The gap must exist AFTER the burst (user is reviewing their output)
  const lastTs  = sorted[sorted.length - 1].ts;
  const sinceLast = now - lastTs;
  if (sinceLast >= CREATOR_PAUSE_THRESHOLD_MS && recent5min.length >= 3) {
    // User generated then stopped — they're reviewing. Classic creative flow.
    return "burst_then_pause";
  }

  // ── uniform_interval detection ────────────────────────────────────────────
  // Scripted requests come at very regular intervals — low coefficient of variation
  const cv = coefficientOfVariation(intervals);
  if (cv < UNIFORM_INTERVAL_CV_THRESHOLD && intervals.length >= 5) {
    return "uniform_interval";
  }

  // ── model_iteration detection ────────────────────────────────────────────
  // User is focusing on one model — they're iterating on a creative concept
  const modelCounts = new Map<string, number>();
  for (const e of recent5min) {
    modelCounts.set(e.modelKey, (modelCounts.get(e.modelKey) ?? 0) + 1);
  }
  const maxModelCount = Math.max(...modelCounts.values());
  const modelConcentration = maxModelCount / recent5min.length;
  if (modelConcentration >= MODEL_ITERATION_RATIO) {
    return "model_iteration";
  }

  // ── model_spray detection ─────────────────────────────────────────────────
  // Many unique models in a short time — API probing behaviour
  const uniqueModels = modelCounts.size;
  if (uniqueModels >= 5 && recent5min.length <= 10) {
    return "model_spray";
  }

  // ── sustained_high detection ──────────────────────────────────────────────
  // High frequency across the full 5min window with no pauses
  const maxInterval = Math.max(...intervals);
  if (maxInterval < CREATOR_PAUSE_THRESHOLD_MS && recent5min.length >= 12) {
    return "sustained_high";
  }

  return "sequential_session";
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk tier resolution — pattern-adjusted
//
// Raw count thresholds are read from env at call time.
// Pattern context adjusts the effective risk:
//   • Creator patterns (burst_then_pause, model_iteration) → reduce effective risk
//     by applying a multiplier that requires higher counts to reach warning/critical
//   • Abuse patterns (uniform_interval, model_spray, sustained_high) → lower the
//     threshold, so fewer requests trigger the same tier
// ─────────────────────────────────────────────────────────────────────────────

function readThresholds(): { warning: number; critical: number } {
  const warning  = parseInt(process.env.VELOCITY_WARNING_PER_5MIN  ?? "20", 10);
  const critical = parseInt(process.env.VELOCITY_CRITICAL_PER_5MIN ?? "40", 10);
  return { warning, critical };
}

/**
 * Pattern-adjusted multiplier for effective threshold.
 *
 * Multiplier > 1 = creator pattern = needs MORE requests to reach same tier.
 * Multiplier < 1 = abuse pattern  = FEWER requests needed to reach same tier.
 *
 * Examples with warning=20, critical=40:
 *   burst_then_pause:  warning=30, critical=60  (generous — almost certainly legit)
 *   model_iteration:   warning=28, critical=56  (generous — creative refinement)
 *   sequential_session: warning=20, critical=40 (baseline)
 *   sustained_high:     warning=16, critical=32 (tighter — no pauses is suspicious)
 *   model_spray:        warning=12, critical=24 (tight — probing behaviour)
 *   uniform_interval:   warning=10, critical=20 (tightest — scripted)
 */
const PATTERN_MULTIPLIER: Record<CreatorPattern, number> = {
  burst_then_pause:    1.5,
  model_iteration:     1.4,
  sequential_session:  1.0,
  unknown:             1.0,
  sustained_high:      0.8,
  model_spray:         0.6,
  uniform_interval:    0.5,
};

function resolveRiskTier(
  per5min:  number,
  pattern:  CreatorPattern,
): RiskTier {
  const { warning, critical } = readThresholds();
  const m = PATTERN_MULTIPLIER[pattern];

  const effectiveWarning  = Math.round(warning  * m);
  const effectiveCritical = Math.round(critical * m);

  if (per5min >= effectiveCritical) return "critical";
  if (per5min >= effectiveWarning)  return "elevated";
  return "normal";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * recordRequest
 *
 * Called BEFORE a generation is dispatched.
 * Records the request in the sliding window so the next scoring call
 * has accurate counts. Fire-and-forget safe — never throws.
 *
 * @param userId     - Authenticated user ID
 * @param studioType - "image" | "video" | "audio" | "fcs" etc.
 * @param modelKey   - The specific model being used (for pattern detection)
 */
export function recordRequest(
  userId:      string,
  studioType:  string,
  modelKey:    string,
): void {
  try {
    const now    = Date.now();
    const events = pruneUserEvents(userId, now);
    events.push({ ts: now, studioType, modelKey });
    _userEvents.set(userId, events);
  } catch (err) {
    logger.warn("shield/velocity", "recordRequest threw", { error: String(err), userId });
  }
}

/**
 * checkVelocity
 *
 * Scores a user's recent request velocity and emits a SecurityEvent if
 * any threshold is crossed. Returns a VelocityScore with full context.
 *
 * Fire-and-forget safe — never throws. On error, returns a safe default
 * (normal tier, no enforcement) so the caller's generation path is unaffected.
 *
 * Wire-in pattern (studio-dispatch.ts):
 *   void checkVelocity(userId, studioType, modelKey).catch(() => {});
 *
 * Caller enforcement pattern:
 *   const score = await checkVelocity(userId, studioType, modelKey);
 *   if (score.shouldEnforce) return blockResponse();
 *   // else: continue generation regardless
 *
 * @param userId     - Authenticated user ID
 * @param studioType - Studio type for pattern context
 * @param modelKey   - Model key for pattern context
 */
export async function checkVelocity(
  userId:     string,
  studioType: string,
  modelKey:   string,
): Promise<VelocityScore> {
  const safeDefault: VelocityScore = {
    userId,
    per60s:         0,
    per5min:        0,
    per60min:       0,
    riskTier:       "normal",
    creatorPattern: "unknown",
    shouldEnforce:  false,
  };

  try {
    const now     = Date.now();
    const events  = pruneUserEvents(userId, now);

    // Window counts
    const per60s   = countInWindow(events, WINDOW_60S_MS,   now);
    const per5min  = countInWindow(events, WINDOW_5MIN_MS,  now);
    const per60min = countInWindow(events, WINDOW_60MIN_MS, now);

    // Creator pattern (5min window is most signal-rich)
    const creatorPattern = detectPattern(events, now);

    // Pattern-adjusted risk tier
    const riskTier = resolveRiskTier(per5min, creatorPattern);

    // Resolve mode for this subsystem
    const globalMode = resolveShieldMode();
    const rawMode    = process.env.VELOCITY_SCORER_MODE?.trim().toLowerCase();
    const mode       = (rawMode === "dry-run" || rawMode === "observe" || rawMode === "enforce")
      ? rawMode
      : globalMode;

    const { warning, critical } = readThresholds();
    const m                     = PATTERN_MULTIPLIER[creatorPattern];
    const effectiveThreshold    = riskTier === "critical"
      ? Math.round(critical * m)
      : Math.round(warning  * m);

    const score: VelocityScore = {
      userId,
      per60s,
      per5min,
      per60min,
      riskTier,
      creatorPattern,
      shouldEnforce: mode === "enforce" && riskTier === "critical",
    };

    // Only emit events at elevated or critical — normal is silent
    if (riskTier !== "normal") {
      const rule: VelocityEvent["rule"] = riskTier === "critical"
        ? "velocity.user.critical_5min"
        : "velocity.user.elevated_5min";

      const event: VelocityEvent = {
        rule,
        severity:     riskTier === "critical" ? "critical" : "warning",
        threshold: {
          metric:          "requests_per_5min",
          configuredValue: effectiveThreshold,
          observedValue:   per5min,
          unit:            "req/5min",
        },
        actionTaken:  mode === "enforce" && riskTier === "critical" ? "request_blocked" : "alerted",
        actionReason: [
          `User exceeded velocity threshold in 5min window.`,
          `Pattern: ${creatorPattern} (multiplier: ${m}x).`,
          `Effective threshold: ${effectiveThreshold} req/5min.`,
          `Observed: ${per5min} req/5min.`,
          `Studio: ${studioType}, Model: ${modelKey}.`,
        ].join(" "),
        mode,
        userId,
        windowCounts: { per60s, per5min, per60min },
        riskTier,
      };

      // Non-blocking emit — don't await inside the critical dispatch path
      void emitSecurityEvent(event).catch((err) => {
        logger.warn("shield/velocity", "emitSecurityEvent failed", { error: String(err) });
      });
    }

    return score;

  } catch (err) {
    logger.warn("shield/velocity", "checkVelocity threw unexpectedly", {
      error: String(err),
      userId,
    });
    return safeDefault;
  }
}

/**
 * getVelocityState (diagnostic only — not for production gating)
 *
 * Returns the current in-memory window counts for a user without
 * recording a new request or emitting events.
 * Use for admin diagnostics and Shield Center UI in Phase B.
 */
export function getVelocityState(userId: string): {
  per60s: number;
  per5min: number;
  per60min: number;
  eventCount: number;
} {
  try {
    const now    = Date.now();
    const events = pruneUserEvents(userId, now);
    return {
      per60s:     countInWindow(events, WINDOW_60S_MS,   now),
      per5min:    countInWindow(events, WINDOW_5MIN_MS,  now),
      per60min:   countInWindow(events, WINDOW_60MIN_MS, now),
      eventCount: events.length,
    };
  } catch {
    return { per60s: 0, per5min: 0, per60min: 0, eventCount: 0 };
  }
}
