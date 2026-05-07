/**
 * src/lib/security/circuit-breaker.ts
 *
 * Zencra Shield — Per-Provider Circuit Breaker (4-State).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  WHY A CIRCUIT BREAKER?                                                  │
 * │                                                                          │
 * │  Provider APIs (Kling, fal.ai, ElevenLabs, OpenAI) can degrade          │
 * │  silently. When a provider is down:                                      │
 * │    • Users lose credits on doomed requests                               │
 * │    • Failed job rows accumulate in the DB                                │
 * │    • Poll loops spin indefinitely (async recovery storms)                │
 * │    • Our provider cost logs show losses, not usage                       │
 * │                                                                          │
 * │  Provider cost asymmetry is the critical insight:                        │
 * │    Even a refunded credit transaction costs us real API dollars.         │
 * │    We absorb the provider cost even when we refund the user.             │
 * │                                                                          │
 * │  The circuit breaker prevents all of this by isolating a failing         │
 * │  provider, allowing the system to route to alternatives or fail          │
 * │  fast with a clear error before the API call is made.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * State machine:
 *
 *   CLOSED ──[error ≥ degraded]──→ DEGRADED ──[stabilized + error ≥ critical]──→ OPEN
 *     │                               │  │                                          │
 *     │                               │  └──[error < recovery]──→ CLOSED           │
 *     │                               │                                             │
 *     └──[catastrophic: 2×min + error ≥ critical, skip DEGRADED]──────────────────→│
 *                                                                                   │
 *                                                              [cooldown elapsed]   │
 *                                                                    ↓              │
 *                                                               HALF_OPEN ←─────────
 *                                                              /         \
 *                                               [N successes]             [any failure]
 *                                                   ↓                         ↓
 *                                                CLOSED                     OPEN
 *
 * States:
 *   CLOSED    — Provider healthy. All requests pass through.
 *   DEGRADED  — Elevated errors but below critical. Traffic still flows.
 *               Alerts fire. Anti-flap stabilization window prevents premature open.
 *   OPEN      — Provider isolated. Requests fail fast (no API call made).
 *               In dry-run/observe: state tracked but requests NOT actually blocked.
 *   HALF_OPEN — Cooldown elapsed. N probe requests allowed; N consecutive successes
 *               required to return to CLOSED. Any failure re-opens.
 *
 * Anti-flapping layers:
 *   1. MIN_REQUESTS_TO_OPEN — minimum sample size before any state change
 *   2. Stabilization window — DEGRADED must persist N seconds before → OPEN
 *   3. Gradual recovery     — N consecutive probe successes before CLOSED
 *
 * In-memory only — state resets on server restart.
 * This is intentional: a restarted server is a fresh probe opportunity.
 * Phase B will add Redis-backed persistence for multi-instance deployments.
 *
 * All state transitions emit SecurityEvents through the event bus.
 */

import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import { logger } from "@/lib/logger";
import type { ProviderEvent, SecurityActionTaken, SecuritySeverity } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — all configurable via env vars (read at call time)
// ─────────────────────────────────────────────────────────────────────────────

/** Default rolling window for error rate calculation (seconds) */
const DEFAULT_WINDOW_SECONDS = 120;

/**
 * Default DEGRADED threshold (0.0–1.0).
 * Above this → CLOSED transitions to DEGRADED. Traffic still flows.
 * Env: CIRCUIT_BREAKER_DEGRADED_THRESHOLD
 */
const DEFAULT_DEGRADED_THRESHOLD = 0.15;

/**
 * Default OPEN threshold (0.0–1.0).
 * Above this + stabilized → DEGRADED transitions to OPEN.
 * Also used as the legacy CIRCUIT_BREAKER_ERROR_THRESHOLD fallback.
 * Env: CIRCUIT_BREAKER_ERROR_THRESHOLD
 */
const DEFAULT_ERROR_THRESHOLD = 0.30;

/**
 * Default recovery threshold (0.0–1.0).
 * Below this while in DEGRADED → de-escalate back to CLOSED.
 * Env: CIRCUIT_BREAKER_RECOVERY_THRESHOLD
 */
const DEFAULT_RECOVERY_THRESHOLD = 0.05;

/**
 * Default stabilization window (seconds).
 * DEGRADED must persist this long before transitioning to OPEN.
 * Prevents a momentary error spike from immediately isolating a provider.
 * Env: CIRCUIT_BREAKER_STABILIZATION_SECONDS
 */
const DEFAULT_STABILIZATION_SECONDS = 30;

/**
 * Default consecutive probe successes required to return to CLOSED.
 * Gradual recovery: N successes in HALF_OPEN before provider is restored.
 * Env: CIRCUIT_BREAKER_PROBES_TO_RECOVER
 */
const DEFAULT_PROBES_TO_RECOVER = 3;

/** Cooldown before OPEN → HALF_OPEN transition (ms) */
const COOLDOWN_MS = 60 * 1000; // 1 minute

/** Minimum requests in window before circuit can change state */
const MIN_REQUESTS_TO_OPEN = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CircuitState = "CLOSED" | "DEGRADED" | "OPEN" | "HALF_OPEN";

export interface CircuitStatus {
  providerKey:          string;
  state:                CircuitState;
  errorRatePct:         number;
  totalRequests:        number;
  failedRequests:       number;
  windowSeconds:        number;
  lastOpenedAt:         number | null;
  lastDegradedAt:       number | null;
  lastRecoveredAt:      number | null;
  /** Current consecutive probe successes in HALF_OPEN */
  consecutiveSuccesses: number;
  /** How long the provider has been in DEGRADED state (seconds) */
  degradedDurationSec:  number;
  /** Probes required to recover (config value at time of query) */
  probesToRecover:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-request outcome stored in the rolling window
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderOutcome {
  ts:      number;  // Date.now()
  success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-provider circuit state
// ─────────────────────────────────────────────────────────────────────────────

interface CircuitBreaker {
  state:                CircuitState;
  outcomes:             ProviderOutcome[];
  lastOpenedAt:         number | null;
  lastDegradedAt:       number | null;
  lastRecoveredAt:      number | null;
  /**
   * HALF_OPEN: count of probe requests currently in-flight.
   * 0 = allow next probe. 1 = awaiting outcome.
   */
  probesSent:           number;
  /** HALF_OPEN: count of consecutive successful probes */
  consecutiveSuccesses: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level in-memory state
// ─────────────────────────────────────────────────────────────────────────────

const _circuits = new Map<string, CircuitBreaker>();

function getOrCreateCircuit(providerKey: string): CircuitBreaker {
  if (!_circuits.has(providerKey)) {
    _circuits.set(providerKey, {
      state:                "CLOSED",
      outcomes:             [],
      lastOpenedAt:         null,
      lastDegradedAt:       null,
      lastRecoveredAt:      null,
      probesSent:           0,
      consecutiveSuccesses: 0,
    });
  }
  return _circuits.get(providerKey)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers (read from env at call time — no module-init side effects)
// ─────────────────────────────────────────────────────────────────────────────

function getDegradedThreshold(): number {
  const raw = parseFloat(process.env.CIRCUIT_BREAKER_DEGRADED_THRESHOLD ?? "0.15");
  return isNaN(raw) || raw < 0 || raw > 1 ? DEFAULT_DEGRADED_THRESHOLD : raw;
}

function getErrorThreshold(): number {
  const raw = parseFloat(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD ?? "0.30");
  return isNaN(raw) || raw < 0 || raw > 1 ? DEFAULT_ERROR_THRESHOLD : raw;
}

function getRecoveryThreshold(): number {
  const raw = parseFloat(process.env.CIRCUIT_BREAKER_RECOVERY_THRESHOLD ?? "0.05");
  return isNaN(raw) || raw < 0 || raw > 1 ? DEFAULT_RECOVERY_THRESHOLD : raw;
}

function getStabilizationMs(): number {
  const raw = parseInt(process.env.CIRCUIT_BREAKER_STABILIZATION_SECONDS ?? "30", 10);
  const secs = isNaN(raw) || raw < 0 ? DEFAULT_STABILIZATION_SECONDS : raw;
  return secs * 1000;
}

function getProbesToRecover(): number {
  const raw = parseInt(process.env.CIRCUIT_BREAKER_PROBES_TO_RECOVER ?? "3", 10);
  return isNaN(raw) || raw < 1 ? DEFAULT_PROBES_TO_RECOVER : raw;
}

function getWindowMs(): number {
  const raw = parseInt(process.env.CIRCUIT_BREAKER_WINDOW_SECONDS ?? "120", 10);
  const secs = isNaN(raw) || raw < 10 ? DEFAULT_WINDOW_SECONDS : raw;
  return secs * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Window pruning
// ─────────────────────────────────────────────────────────────────────────────

function pruneOutcomes(circuit: CircuitBreaker, now: number): void {
  const windowMs = getWindowMs();
  const cutoff   = now - windowMs;
  circuit.outcomes = circuit.outcomes.filter((o) => o.ts >= cutoff);
}

// ─────────────────────────────────────────────────────────────────────────────
// Error rate calculation
// ─────────────────────────────────────────────────────────────────────────────

function calculateErrorRate(outcomes: ProviderOutcome[]): {
  errorRatePct:   number;
  totalRequests:  number;
  failedRequests: number;
} {
  if (outcomes.length === 0) {
    return { errorRatePct: 0, totalRequests: 0, failedRequests: 0 };
  }
  const failed       = outcomes.filter((o) => !o.success).length;
  const errorRatePct = (failed / outcomes.length) * 100;
  return { errorRatePct, totalRequests: outcomes.length, failedRequests: failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// CB mode resolution — per-subsystem override
// ─────────────────────────────────────────────────────────────────────────────

function resolveCbMode(): "dry-run" | "observe" | "enforce" {
  const global = resolveShieldMode();
  const raw    = process.env.CIRCUIT_BREAKER_MODE?.trim().toLowerCase();
  if (raw === "dry-run" || raw === "observe" || raw === "enforce") return raw;
  return global;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event emission helpers
// ─────────────────────────────────────────────────────────────────────────────

function severityForRule(rule: ProviderEvent["rule"]): SecuritySeverity {
  switch (rule) {
    case "provider.circuit.opened":
    case "provider.error_rate.critical":
      return "critical";
    case "provider.circuit.degraded":
    case "provider.circuit.stabilizing":
    case "provider.error_rate.warning":
    case "provider.timeout.spike":
      return "warning";
    default:
      return "info";
  }
}

function actionForRule(
  rule:   ProviderEvent["rule"],
  cbMode: "dry-run" | "observe" | "enforce",
): SecurityActionTaken {
  switch (rule) {
    case "provider.circuit.opened":
      return cbMode === "enforce" ? "provider_isolated" : "alerted";
    case "provider.circuit.closed":
      return cbMode === "enforce" ? "provider_restored" : "alerted";
    case "provider.circuit.degraded":
    case "provider.circuit.stabilizing":
      return cbMode === "enforce" ? "provider_degraded" : "alerted";
    default:
      return cbMode !== "dry-run" ? "alerted" : "logged_only";
  }
}

async function emitTransitionEvent(params: {
  providerKey:           string;
  rule:                  ProviderEvent["rule"];
  errorRatePct:          number;
  windowSeconds:         number;
  reason:                string;
  consecutiveErrors?:    number;
  consecutiveSuccesses?: number;
  degradedDurationSec?:  number;
}): Promise<void> {
  const cbMode    = resolveCbMode();
  const threshold = getErrorThreshold();

  const event: ProviderEvent = {
    rule:          params.rule,
    severity:      severityForRule(params.rule),
    threshold: {
      metric:          "error_rate_pct",
      configuredValue: threshold * 100,
      observedValue:   params.errorRatePct,
      unit:            "pct",
    },
    actionTaken:          actionForRule(params.rule, cbMode),
    actionReason:         params.reason,
    mode:                 cbMode,
    providerKey:          params.providerKey,
    errorRatePct:         params.errorRatePct,
    windowSeconds:        params.windowSeconds,
    consecutiveErrors:    params.consecutiveErrors,
    consecutiveSuccesses: params.consecutiveSuccesses,
    degradedDurationSec:  params.degradedDurationSec,
  };

  void emitSecurityEvent(event).catch((err) => {
    logger.warn("shield/circuit", "emitSecurityEvent failed", { error: String(err) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * canDispatch
 *
 * Returns true if requests should be sent to this provider.
 *
 * CLOSED   → always true
 * DEGRADED → always true (traffic still flows; degraded ≠ isolated)
 * OPEN     → false (in enforce mode) — triggers HALF_OPEN when cooldown elapsed
 * HALF_OPEN → true for one probe at a time; false while awaiting outcome
 *
 * In dry-run/observe mode: always returns true — state is tracked but never enforced.
 *
 * Call this BEFORE making a provider API request:
 *   if (!canDispatch(providerKey)) {
 *     return { error: "Provider temporarily unavailable — try another provider" };
 *   }
 */
export function canDispatch(providerKey: string): boolean {
  try {
    const cbMode = resolveCbMode();

    // dry-run + observe: track state but never block
    if (cbMode !== "enforce") return true;

    const circuit = getOrCreateCircuit(providerKey);
    const now     = Date.now();

    // CLOSED and DEGRADED — traffic flows freely
    if (circuit.state === "CLOSED" || circuit.state === "DEGRADED") return true;

    if (circuit.state === "OPEN") {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (circuit.lastOpenedAt && now - circuit.lastOpenedAt >= COOLDOWN_MS) {
        circuit.state                = "HALF_OPEN";
        circuit.probesSent           = 0;
        circuit.consecutiveSuccesses = 0;
        logger.info("shield/circuit", `Circuit HALF_OPEN — probing ${providerKey}`, {
          openedAt: circuit.lastOpenedAt,
          elapsed:  now - circuit.lastOpenedAt,
        });
        // Fall through to HALF_OPEN check
      } else {
        return false; // Still in cooldown
      }
    }

    if (circuit.state === "HALF_OPEN") {
      if (circuit.probesSent === 0) {
        // Allow the next probe request
        circuit.probesSent = 1;
        return true;
      }
      // Probe in-flight — await outcome
      return false;
    }

    return true;
  } catch (err) {
    logger.warn("shield/circuit", "canDispatch threw", { error: String(err), providerKey });
    return true; // Fail open — never block on circuit breaker error
  }
}

/**
 * recordOutcome
 *
 * Called AFTER a provider API request completes (success or failure).
 * Updates the rolling window and evaluates state transitions.
 *
 * Fire-and-forget safe — never throws to its caller.
 *
 * Wire-in pattern (studio-dispatch.ts):
 *   try {
 *     const result = await provider.generate(params);
 *     void recordOutcome(providerKey, true).catch(() => {});
 *     return result;
 *   } catch (err) {
 *     void recordOutcome(providerKey, false).catch(() => {});
 *     throw err;
 *   }
 *
 * @param providerKey - Registry key for the provider (e.g. "kling-30")
 * @param success     - true = request succeeded; false = request failed
 */
export async function recordOutcome(
  providerKey: string,
  success:     boolean,
): Promise<void> {
  try {
    const now        = Date.now();
    const circuit    = getOrCreateCircuit(providerKey);
    const windowMs   = getWindowMs();
    const windowSecs = windowMs / 1000;

    // Record and prune
    circuit.outcomes.push({ ts: now, success });
    pruneOutcomes(circuit, now);

    const { errorRatePct, totalRequests, failedRequests } = calculateErrorRate(circuit.outcomes);
    const errorRate       = errorRatePct / 100;
    const criticalThresh  = getErrorThreshold();
    const degradedThresh  = getDegradedThreshold();
    const recoveryThresh  = getRecoveryThreshold();
    const probesToRecover = getProbesToRecover();

    logger.info("shield/circuit", `${providerKey} outcome recorded`, {
      success,
      state:         circuit.state,
      errorRatePct:  errorRatePct.toFixed(1) + "%",
      totalInWindow: totalRequests,
    });

    // ── HALF_OPEN: probe result ───────────────────────────────────────────────
    if (circuit.state === "HALF_OPEN") {
      if (success) {
        circuit.consecutiveSuccesses += 1;
        circuit.probesSent            = 0; // Ready for next probe

        if (circuit.consecutiveSuccesses >= probesToRecover) {
          // Enough consecutive successes — restore provider
          circuit.state                = "CLOSED";
          circuit.consecutiveSuccesses = 0;
          circuit.lastRecoveredAt      = now;
          circuit.outcomes             = []; // Fresh window after recovery

          await emitTransitionEvent({
            providerKey,
            rule:                "provider.circuit.closed",
            errorRatePct:        0,
            windowSeconds:       windowSecs,
            consecutiveSuccesses: probesToRecover,
            reason: [
              `${providerKey} completed ${probesToRecover} consecutive successful probes.`,
              `Circuit CLOSED — provider restored to full rotation.`,
            ].join(" "),
          });
        } else {
          // Progress toward recovery — not there yet
          await emitTransitionEvent({
            providerKey,
            rule:                "provider.circuit.recovering",
            errorRatePct,
            windowSeconds:       windowSecs,
            consecutiveSuccesses: circuit.consecutiveSuccesses,
            reason: [
              `${providerKey} probe ${circuit.consecutiveSuccesses}/${probesToRecover} succeeded.`,
              `Remaining in HALF_OPEN — ${probesToRecover - circuit.consecutiveSuccesses} more needed to recover.`,
            ].join(" "),
          });
        }
      } else {
        // Probe failed — re-open
        circuit.state                = "OPEN";
        circuit.lastOpenedAt         = now;
        circuit.consecutiveSuccesses = 0;
        circuit.probesSent           = 0;

        await emitTransitionEvent({
          providerKey,
          rule:          "provider.circuit.opened",
          errorRatePct,
          windowSeconds: windowSecs,
          reason: [
            `${providerKey} probe request failed (error rate ${errorRatePct.toFixed(1)}%).`,
            `Circuit re-OPENED — provider remains isolated.`,
          ].join(" "),
        });
      }
      return;
    }

    // ── DEGRADED: re-evaluate each outcome ───────────────────────────────────
    if (circuit.state === "DEGRADED") {
      // Not enough samples to make a call
      if (totalRequests < MIN_REQUESTS_TO_OPEN) return;

      const degradedDurationMs  = circuit.lastDegradedAt ? now - circuit.lastDegradedAt : 0;
      const degradedDurationSec = Math.floor(degradedDurationMs / 1000);
      const stabilized          = degradedDurationMs >= getStabilizationMs();

      if (errorRate < recoveryThresh) {
        // Error rate has recovered — de-escalate back to CLOSED
        circuit.state          = "CLOSED";
        circuit.lastRecoveredAt = now;
        circuit.lastDegradedAt  = null;

        await emitTransitionEvent({
          providerKey,
          rule:               "provider.circuit.closed",
          errorRatePct,
          windowSeconds:      windowSecs,
          degradedDurationSec,
          reason: [
            `${providerKey} error rate dropped to ${errorRatePct.toFixed(1)}% (recovery threshold ${(recoveryThresh * 100).toFixed(0)}%).`,
            `Provider self-healed in DEGRADED — circuit CLOSED without full open.`,
          ].join(" "),
        });

      } else if (errorRate >= criticalThresh) {
        if (stabilized) {
          // Stabilization window elapsed + still critical → open circuit
          circuit.state        = "OPEN";
          circuit.lastOpenedAt = now;

          await emitTransitionEvent({
            providerKey,
            rule:               "provider.circuit.opened",
            errorRatePct,
            windowSeconds:      windowSecs,
            degradedDurationSec,
            reason: [
              `${providerKey} error rate ${errorRatePct.toFixed(1)}% exceeded critical threshold ${(criticalThresh * 100).toFixed(0)}%.`,
              `Provider was in DEGRADED for ${degradedDurationSec}s (stabilization window elapsed).`,
              `Circuit OPENED — provider isolated from rotation.`,
            ].join(" "),
          });
        } else {
          // Anti-flap: still inside stabilization window — hold in DEGRADED
          await emitTransitionEvent({
            providerKey,
            rule:               "provider.circuit.stabilizing",
            errorRatePct,
            windowSeconds:      windowSecs,
            degradedDurationSec,
            reason: [
              `${providerKey} error rate ${errorRatePct.toFixed(1)}% is critical but stabilization window not yet elapsed`,
              `(${degradedDurationSec}s / ${getStabilizationMs() / 1000}s).`,
              `Holding DEGRADED — traffic still flows, monitoring for sustained degradation.`,
            ].join(" "),
          });
        }
      }
      // else: errorRate between recovery and critical → remain DEGRADED (no event)
      return;
    }

    // ── CLOSED: evaluate for DEGRADED or immediate OPEN ──────────────────────
    if (circuit.state === "CLOSED") {
      if (totalRequests < MIN_REQUESTS_TO_OPEN) return;

      // Catastrophic fast-path: skip DEGRADED if error rate is critical with 2× sample minimum
      if (errorRate >= criticalThresh && totalRequests >= MIN_REQUESTS_TO_OPEN * 2) {
        circuit.state        = "OPEN";
        circuit.lastOpenedAt = now;

        await emitTransitionEvent({
          providerKey,
          rule:          "provider.circuit.opened",
          errorRatePct,
          windowSeconds: windowSecs,
          reason: [
            `${providerKey} catastrophic failure: error rate ${errorRatePct.toFixed(1)}% exceeded critical threshold`,
            `${(criticalThresh * 100).toFixed(0)}% with ${totalRequests} samples.`,
            `Fast-path: CLOSED → OPEN (skipped DEGRADED). Provider isolated.`,
          ].join(" "),
        });
        return;
      }

      if (errorRate >= degradedThresh) {
        // Enter DEGRADED — traffic still flows, stabilization clock starts
        circuit.state          = "DEGRADED";
        circuit.lastDegradedAt = now;

        await emitTransitionEvent({
          providerKey,
          rule:          "provider.circuit.degraded",
          errorRatePct,
          windowSeconds: windowSecs,
          reason: [
            `${providerKey} error rate ${errorRatePct.toFixed(1)}% exceeded degraded threshold ${(degradedThresh * 100).toFixed(0)}%.`,
            `${failedRequests}/${totalRequests} requests failed in ${windowSecs}s window.`,
            `Circuit DEGRADED — traffic still flows. Monitoring for escalation.`,
          ].join(" "),
        });
        return;
      }

      if (errorRate >= degradedThresh * 0.6) {
        // Approaching degraded threshold — warning only, no state change
        await emitTransitionEvent({
          providerKey,
          rule:          "provider.error_rate.warning",
          errorRatePct,
          windowSeconds: windowSecs,
          reason: [
            `${providerKey} error rate ${errorRatePct.toFixed(1)}% approaching degraded threshold ${(degradedThresh * 100).toFixed(0)}%.`,
            `${failedRequests}/${totalRequests} requests failed in ${windowSecs}s window.`,
          ].join(" "),
        });
      }
    }

  } catch (err) {
    logger.warn("shield/circuit", "recordOutcome threw unexpectedly", {
      error: String(err),
      providerKey,
      success,
    });
  }
}

/**
 * getCircuitStatus (diagnostic only)
 *
 * Returns current circuit state for a provider.
 * Use for admin diagnostics and Shield Center UI in Phase B.
 */
export function getCircuitStatus(providerKey: string): CircuitStatus {
  try {
    const circuit     = getOrCreateCircuit(providerKey);
    const now         = Date.now();
    pruneOutcomes(circuit, now);

    const { errorRatePct, totalRequests, failedRequests } = calculateErrorRate(circuit.outcomes);
    const windowSecs         = getWindowMs() / 1000;
    const degradedDurationMs = circuit.lastDegradedAt ? now - circuit.lastDegradedAt : 0;

    return {
      providerKey,
      state:                circuit.state,
      errorRatePct,
      totalRequests,
      failedRequests,
      windowSeconds:        windowSecs,
      lastOpenedAt:         circuit.lastOpenedAt,
      lastDegradedAt:       circuit.lastDegradedAt,
      lastRecoveredAt:      circuit.lastRecoveredAt,
      consecutiveSuccesses: circuit.consecutiveSuccesses,
      degradedDurationSec:  Math.floor(degradedDurationMs / 1000),
      probesToRecover:      getProbesToRecover(),
    };
  } catch {
    return {
      providerKey,
      state:                "CLOSED",
      errorRatePct:         0,
      totalRequests:        0,
      failedRequests:       0,
      windowSeconds:        DEFAULT_WINDOW_SECONDS,
      lastOpenedAt:         null,
      lastDegradedAt:       null,
      lastRecoveredAt:      null,
      consecutiveSuccesses: 0,
      degradedDurationSec:  0,
      probesToRecover:      DEFAULT_PROBES_TO_RECOVER,
    };
  }
}

/**
 * getAllCircuitStatuses (diagnostic only)
 *
 * Returns status for all tracked providers.
 * Use for admin panel showing provider health overview.
 */
export function getAllCircuitStatuses(): CircuitStatus[] {
  const statuses: CircuitStatus[] = [];
  for (const providerKey of _circuits.keys()) {
    statuses.push(getCircuitStatus(providerKey));
  }
  return statuses;
}

/**
 * resetCircuit (testing only)
 *
 * Clears state for a specific provider so it can be tested from CLOSED.
 * Never call in production.
 */
export function resetCircuit(providerKey: string): void {
  _circuits.delete(providerKey);
}

/**
 * clearAllCircuits (testing only)
 *
 * Resets entire circuit store. Never call in production.
 */
export function clearAllCircuits(): void {
  _circuits.clear();
}
