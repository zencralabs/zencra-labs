/**
 * src/lib/security/credit-burn-monitor.ts
 *
 * Zencra Shield — Per-User Credit Burn Rate Monitor.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  WHY CREDIT BURN RATE?                                                   │
 * │                                                                          │
 * │  Credit burn rate is a stronger abuse signal than request count.         │
 * │                                                                          │
 * │  A cinematic creator doing rapid image iterations burns:                 │
 * │    5 cr × 8 iterations = 40 cr in a burst session                        │
 * │  An abuser scripted-generating premium video at scale burns:             │
 * │    200 cr × 20 parallel jobs = 4,000 cr/hr                               │
 * │                                                                          │
 * │  Credit burn rate catches:                                               │
 * │    • Compromised accounts used for premium model abuse                  │
 * │    • Exploitation of entitlement bugs that bypass credit gates           │
 * │    • Negative balance exploitation (credits going below zero)            │
 * │    • Billing system errors causing unbounded credit grants               │
 * │                                                                          │
 * │  Credit burn rate is LESS sensitive to legitimate creator patterns:      │
 * │    • A creator burning 200 cr/hr on image generation is a power user     │
 * │    • An account burning 5,000 cr/hr on video generation is anomalous     │
 * │                                                                          │
 * │  Thresholds are set conservatively (default 500 warn / 2000 critical)   │
 * │  and designed to be calibrated during the observe phase.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Architecture:
 *   - Module-level in-memory Map: userId → debit event timestamps+amounts
 *   - Rolling 1-hour window (matches CREDIT_BURN_WARNING/CRITICAL_PER_HOUR)
 *   - recordCreditDebit() called after successful credit deduction
 *   - Emits SecurityEvent at warning and critical thresholds
 *   - Silent-fail: never blocks the credit deduction path
 *
 * In-memory only — resets on server restart (intentional for Phase A).
 * Phase B: persist to Redis for multi-instance deployments.
 */

import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import { logger } from "@/lib/logger";
import type { CreditEvent } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_1HR_MS = 60 * 60 * 1000;
const MAX_DEBIT_EVENTS = 200; // Ring buffer cap per user

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DebitEvent {
  ts:          number;  // Date.now()
  creditsUsed: number;  // Credit amount deducted (positive number)
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

const _userDebits = new Map<string, DebitEvent[]>();

function pruneDebits(userId: string, now: number): DebitEvent[] {
  const events = _userDebits.get(userId) ?? [];
  const cutoff  = now - WINDOW_1HR_MS;
  const fresh   = events.filter((e) => e.ts >= cutoff);
  const capped  = fresh.length > MAX_DEBIT_EVENTS
    ? fresh.slice(fresh.length - MAX_DEBIT_EVENTS)
    : fresh;
  _userDebits.set(userId, capped);
  return capped;
}

function sumDebits(events: DebitEvent[]): number {
  return events.reduce((sum, e) => sum + e.creditsUsed, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────────────────────

function getThresholds(): { warning: number; critical: number } {
  const warning  = parseInt(process.env.CREDIT_BURN_WARNING_PER_HOUR  ?? "500",  10);
  const critical = parseInt(process.env.CREDIT_BURN_CRITICAL_PER_HOUR ?? "2000", 10);
  return { warning, critical };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier tracking (to avoid spamming identical events)
// ─────────────────────────────────────────────────────────────────────────────

/** Track the last emitted tier per user to avoid redundant events */
const _lastEmittedTier = new Map<string, "warning" | "critical">();

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * recordCreditDebit
 *
 * Records a credit deduction for the given user and checks burn rate thresholds.
 * Emits a SecurityEvent if warning or critical threshold is crossed.
 *
 * Call this AFTER a successful credit deduction in the generation pipeline.
 * Fire-and-forget safe — never throws, never blocks generation.
 *
 * Wire-in pattern (studio-dispatch.ts or hooks.ts):
 *   void recordCreditDebit(userId, creditsDeducted, creditsBalance, planId).catch(() => {});
 *
 * @param userId          - Authenticated user ID
 * @param creditsUsed     - Number of credits deducted in this transaction (positive)
 * @param creditsBalance  - User's credit balance AFTER this deduction
 * @param planId          - User's current plan ID (for context in alerts)
 */
export async function recordCreditDebit(
  userId:         string,
  creditsUsed:    number,
  /** User's balance after deduction. Pass undefined if not known at call site. */
  creditsBalance: number | undefined,
  planId?:        string,
): Promise<void> {
  // Treat undefined balance as unknown — skip the negative-balance check.
  // Full balance-aware monitoring requires a DB round-trip; deferred to Phase B.
  if (creditsBalance === undefined) creditsBalance = 0;
  try {
    const now    = Date.now();
    const events = pruneDebits(userId, now);

    // Record this deduction
    events.push({ ts: now, creditsUsed });
    _userDebits.set(userId, events);

    // Recalculate rolling-hour burn
    const burnPerHour = sumDebits(pruneDebits(userId, now));

    const { warning, critical } = getThresholds();
    const mode                   = resolveShieldMode();

    // Negative balance check — always emit regardless of burn rate (billing anomaly)
    if (creditsBalance < 0) {
      const event: CreditEvent = {
        rule:          "credit.balance.negative",
        severity:      "critical",
        threshold: {
          metric:          "credits_balance",
          configuredValue: 0,
          observedValue:   creditsBalance,
          unit:            "cr",
        },
        actionTaken:   mode === "enforce" ? "credit_deducted" : "alerted",
        actionReason:  `User credit balance is negative (${creditsBalance} cr). Possible billing anomaly or entitlement gate failure.`,
        mode,
        userId,
        creditsUsed,
        creditsBalance,
        planId,
      };

      void emitSecurityEvent(event).catch((err) => {
        logger.warn("shield/credit", "emitSecurityEvent (negative balance) failed", { error: String(err) });
      });
      return; // Already alerted — no need to also check burn rate
    }

    // Determine burn tier
    const newTier: "warning" | "critical" | null =
      burnPerHour >= critical ? "critical" :
      burnPerHour >= warning  ? "warning"  : null;

    if (!newTier) {
      // Below all thresholds — clear any previous tier tracking
      _lastEmittedTier.delete(userId);
      return;
    }

    // Avoid spamming: only emit if tier changed or escalated
    const lastTier = _lastEmittedTier.get(userId);
    if (lastTier === newTier) return; // Same tier — skip
    if (lastTier === "critical" && newTier === "warning") return; // De-escalation — skip

    _lastEmittedTier.set(userId, newTier);

    const rule: CreditEvent["rule"] = newTier === "critical"
      ? "credit.burn.critical_per_hour"
      : "credit.burn.warning_per_hour";

    const threshold = newTier === "critical" ? critical : warning;

    const event: CreditEvent = {
      rule,
      severity:      newTier,
      threshold: {
        metric:          "credits_per_hour",
        configuredValue: threshold,
        observedValue:   burnPerHour,
        unit:            "cr/hr",
      },
      actionTaken:   "alerted",
      actionReason: [
        `User credit burn rate ${burnPerHour} cr/hr exceeded ${newTier} threshold ${threshold} cr/hr.`,
        `Last deduction: ${creditsUsed} cr.`,
        `Current balance: ${creditsBalance} cr.`,
        planId ? `Plan: ${planId}.` : "",
      ].filter(Boolean).join(" "),
      mode,
      userId,
      creditsUsed,
      creditsBalance,
      planId,
    };

    void emitSecurityEvent(event).catch((err) => {
      logger.warn("shield/credit", "emitSecurityEvent failed", { error: String(err) });
    });

  } catch (err) {
    logger.warn("shield/credit", "recordCreditDebit threw unexpectedly", {
      error: String(err),
      userId,
    });
  }
}

/**
 * getCreditBurnState (diagnostic only)
 *
 * Returns the current burn rate for a user without recording a new deduction.
 * Use for admin diagnostics and Shield Center UI in Phase B.
 */
export function getCreditBurnState(userId: string): {
  burnPerHour:    number;
  debitCount:     number;
  lastDebitAt:    number | null;
} {
  try {
    const now    = Date.now();
    const events = pruneDebits(userId, now);
    const last   = events.length > 0 ? events[events.length - 1].ts : null;
    return {
      burnPerHour: sumDebits(events),
      debitCount:  events.length,
      lastDebitAt: last,
    };
  } catch {
    return { burnPerHour: 0, debitCount: 0, lastDebitAt: null };
  }
}
