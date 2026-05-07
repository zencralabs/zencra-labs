/**
 * src/lib/security/circuit-breaker.ts
 *
 * Zencra Shield — Per-Provider Circuit Breaker.
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
 *   CLOSED ────────────────────→ OPEN ──────────────────→ HALF_OPEN
 *   (normal)  error rate > threshold  (isolated)  cooldown elapsed   (probing)
 *      ↑                                                    │
 *      └─────────────────── success ───────────────────────┘
 *                           reset                   OPEN (on failure)
 *
 * States:
 *   CLOSED    — Provider healthy. All requests pass through.
 *   OPEN      — Provider isolated. Requests fail fast (no API call made).
 *               In dry-run: state tracked but requests NOT actually blocked.
 *   HALF_OPEN — Cooldown elapsed. One probe request allowed.
 *               Success → CLOSED (provider recovered).
 *               Failure → OPEN  (provider still degraded).
 *
 * In-memory only — state resets on server restart.
 * This is intentional: a restarted server is a fresh probe opportunity.
 * Phase B will add Redis-backed persistence for multi-instance deployments.
 *
 * All state transitions emit SecurityEvents through the event bus.
 */

import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import { logger } from "@/lib/logger";
import type { ProviderEvent } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — all configurable via env vars (read at call time)
// ─────────────────────────────────────────────────────────────────────────────

/** Default rolling window for error rate calculation (seconds) */
const DEFAULT_WINDOW_SECONDS = 120;
/** Default error rate threshold (0.0–1.0) above which circuit opens */
const DEFAULT_ERROR_THRESHOLD = 0.30;
/** Cooldown before OPEN → HALF_OPEN transition (ms) */
const COOLDOWN_MS = 60 * 1000; // 1 minute
/** Minimum requests in window before circuit can open */
const MIN_REQUESTS_TO_OPEN = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitStatus {
  providerKey:       string;
  state:             CircuitState;
  errorRatePct:      number;
  totalRequests:     number;
  failedRequests:    number;
  windowSeconds:     number;
  lastOpenedAt:      number | null;
  lastRecoveredAt:   number | null;
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
  state:           CircuitState;
  outcomes:        ProviderOutcome[];
  lastOpenedAt:    number | null;
  lastRecoveredAt: number | null;
  /** Half-open: count of probe requests sent (max 1 before resolving) */
  probesSent:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level in-memory state
// ─────────────────────────────────────────────────────────────────────────────

const _circuits = new Map<string, CircuitBreaker>();

function getOrCreateCircuit(providerKey: string): CircuitBreaker {
  if (!_circuits.has(providerKey)) {
    _circuits.set(providerKey, {
      state:           "CLOSED",
      outcomes:        [],
      lastOpenedAt:    null,
      lastRecoveredAt: null,
      probesSent:      0,
    });
  }
  return _circuits.get(providerKey)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers (read from env at call time — no module-init side effects)
// ─────────────────────────────────────────────────────────────────────────────

function getErrorThreshold(): number {
  const raw = parseFloat(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD ?? "0.30");
  return isNaN(raw) || raw < 0 || raw > 1 ? DEFAULT_ERROR_THRESHOLD : raw;
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
  errorRatePct:    number;
  totalRequests:   number;
  failedRequests:  number;
} {
  if (outcomes.length === 0) {
    return { errorRatePct: 0, totalRequests: 0, failedRequests: 0 };
  }
  const failed        = outcomes.filter((o) => !o.success).length;
  const errorRatePct  = (failed / outcomes.length) * 100;
  return { errorRatePct, totalRequests: outcomes.length, failedRequests: failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Event emission helpers
// ─────────────────────────────────────────────────────────────────────────────

async function emitTransitionEvent(
  providerKey:   string,
  rule:          ProviderEvent["rule"],
  errorRatePct:  number,
  windowSeconds: number,
  reason:        string,
): Promise<void> {
  const mode      = resolveShieldMode();
  const rawMode   = process.env.CIRCUIT_BREAKER_MODE?.trim().toLowerCase();
  const cbMode    = (rawMode === "dry-run" || rawMode === "observe" || rawMode === "enforce")
    ? rawMode : mode;

  const threshold = getErrorThreshold();

  const event: ProviderEvent = {
    rule,
    severity:      rule === "provider.circuit.opened" ? "critical"
                 : rule === "provider.error_rate.critical" ? "critical"
                 : rule === "provider.error_rate.warning" ? "warning"
                 : "info",
    threshold: {
      metric:          "error_rate_pct",
      configuredValue: threshold * 100,
      observedValue:   errorRatePct,
      unit:            "pct",
    },
    actionTaken: rule === "provider.circuit.opened"   ? "provider_isolated"
               : rule === "provider.circuit.closed"   ? "provider_restored"
               : cbMode === "enforce"                  ? "provider_isolated"
               : "alerted",
    actionReason:     reason,
    mode:             cbMode,
    providerKey,
    errorRatePct,
    windowSeconds,
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
 * Returns true if the circuit is CLOSED or HALF_OPEN (probe allowed).
 * Returns false if the circuit is OPEN (provider isolated).
 *
 * In dry-run mode: always returns true — state is tracked but never enforced.
 *
 * Call this BEFORE making a provider API request:
 *   if (!canDispatch(providerKey)) {
 *     return { error: "Provider temporarily unavailable — try another provider" };
 *   }
 */
export function canDispatch(providerKey: string): boolean {
  try {
    const mode    = resolveShieldMode();
    const rawMode = process.env.CIRCUIT_BREAKER_MODE?.trim().toLowerCase();
    const cbMode  = (rawMode === "dry-run" || rawMode === "observe" || rawMode === "enforce")
      ? rawMode : mode;

    // dry-run + observe: track state but never block
    if (cbMode !== "enforce") return true;

    const circuit = getOrCreateCircuit(providerKey);
    const now     = Date.now();

    if (circuit.state === "CLOSED") return true;

    if (circuit.state === "OPEN") {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (circuit.lastOpenedAt && now - circuit.lastOpenedAt >= COOLDOWN_MS) {
        circuit.state       = "HALF_OPEN";
        circuit.probesSent  = 0;
        logger.info("shield/circuit", `Circuit HALF_OPEN — probing ${providerKey}`);
      } else {
        return false; // Still open
      }
    }

    if (circuit.state === "HALF_OPEN") {
      if (circuit.probesSent === 0) {
        circuit.probesSent = 1;
        return true; // Allow one probe request
      }
      // Already sent a probe — wait for outcome
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
 * Updates the rolling window and evaluates circuit state transitions.
 *
 * Fire-and-forget safe — never throws to its caller.
 *
 * Wire-in pattern (studio-dispatch.ts):
 *   try {
 *     const result = await provider.generate(params);
 *     void recordOutcome(providerKey, true);
 *     return result;
 *   } catch (err) {
 *     void recordOutcome(providerKey, false);
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
    const now         = Date.now();
    const circuit     = getOrCreateCircuit(providerKey);
    const windowMs    = getWindowMs();
    const windowSecs  = windowMs / 1000;

    // Record outcome
    circuit.outcomes.push({ ts: now, success });
    pruneOutcomes(circuit, now);

    const { errorRatePct, totalRequests, failedRequests } = calculateErrorRate(circuit.outcomes);
    const threshold = getErrorThreshold();

    logger.info("shield/circuit", `${providerKey} outcome recorded`, {
      success,
      state:        circuit.state,
      errorRatePct: errorRatePct.toFixed(1) + "%",
      totalInWindow: totalRequests,
    });

    // ── HALF_OPEN: probe result ─────────────────────────────────────────────
    if (circuit.state === "HALF_OPEN") {
      if (success) {
        // Provider recovered — reset circuit
        circuit.state           = "CLOSED";
        circuit.probesSent      = 0;
        circuit.lastRecoveredAt = now;
        circuit.outcomes        = []; // Reset window after recovery

        await emitTransitionEvent(
          providerKey,
          "provider.circuit.closed",
          0,
          windowSecs,
          `${providerKey} probe request succeeded. Circuit CLOSED — provider restored to rotation.`,
        );
      } else {
        // Still failing — reopen
        circuit.state        = "OPEN";
        circuit.lastOpenedAt = now;

        await emitTransitionEvent(
          providerKey,
          "provider.circuit.opened",
          errorRatePct,
          windowSecs,
          `${providerKey} probe request failed. Circuit re-OPENED — provider remains isolated.`,
        );
      }
      return;
    }

    // ── CLOSED: evaluate for opening ───────────────────────────────────────
    if (circuit.state === "CLOSED") {
      // Need minimum requests before opening (prevents flapping on single failures)
      if (totalRequests < MIN_REQUESTS_TO_OPEN) return;

      const errorRate = errorRatePct / 100;

      if (errorRate >= threshold) {
        // Error rate critical — open circuit
        circuit.state        = "OPEN";
        circuit.lastOpenedAt = now;

        await emitTransitionEvent(
          providerKey,
          "provider.circuit.opened",
          errorRatePct,
          windowSecs,
          [
            `${providerKey} error rate ${errorRatePct.toFixed(1)}% exceeded threshold ${(threshold * 100).toFixed(0)}%.`,
            `${failedRequests}/${totalRequests} requests failed in ${windowSecs}s window.`,
            `Circuit OPENED — provider isolated from rotation.`,
          ].join(" "),
        );
      } else if (errorRate >= threshold * 0.6) {
        // Warning tier — approaching threshold
        await emitTransitionEvent(
          providerKey,
          "provider.error_rate.warning",
          errorRatePct,
          windowSecs,
          [
            `${providerKey} error rate ${errorRatePct.toFixed(1)}% approaching threshold ${(threshold * 100).toFixed(0)}%.`,
            `${failedRequests}/${totalRequests} requests failed in ${windowSecs}s window.`,
          ].join(" "),
        );
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

    const { errorRatePct, totalRequests } = calculateErrorRate(circuit.outcomes);
    const windowSecs = (getWindowMs()) / 1000;

    return {
      providerKey,
      state:           circuit.state,
      errorRatePct,
      totalRequests,
      failedRequests:  circuit.outcomes.filter((o) => !o.success).length,
      windowSeconds:   windowSecs,
      lastOpenedAt:    circuit.lastOpenedAt,
      lastRecoveredAt: circuit.lastRecoveredAt,
    };
  } catch {
    return {
      providerKey,
      state:           "CLOSED",
      errorRatePct:    0,
      totalRequests:   0,
      failedRequests:  0,
      windowSeconds:   DEFAULT_WINDOW_SECONDS,
      lastOpenedAt:    null,
      lastRecoveredAt: null,
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
