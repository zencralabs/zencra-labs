/**
 * src/lib/security/event-deduplicator.ts
 *
 * Zencra Shield — Event Deduplication and Noise Suppression.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  WHY DEDUPLICATION?                                                      │
 * │                                                                          │
 * │  Without dedup, a single noisy event source produces unbounded alerts:  │
 * │    • A failing provider → 1 circuit.opened + 200 circuit.opened/hr     │
 * │    • A scripted abuser → 1 velocity alert + 1 per request afterward    │
 * │    • A billing anomaly → 1 per credit debit (could be hundreds/min)    │
 * │                                                                          │
 * │  Alert storms cause two failure modes:                                  │
 * │    1. Discord webhook rate-limiting → alerts stop delivering            │
 * │    2. On-call engineers mute/ignore the channel → alerts stop mattering │
 * │                                                                          │
 * │  This module applies cooldown windows per (rule, actor) key so that:   │
 * │    • The FIRST event in any window always delivers                      │
 * │    • Subsequent identical events are suppressed                         │
 * │    • When the window expires, one aggregated summary delivers           │
 * │    • A severity escalation (warning → critical) bypasses the window    │
 * │      immediately regardless of how recently the last event fired        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Consumer contract:
 *   - Supabase persister: receives EVERY raw event (forensic integrity)
 *   - Structured logger:  receives EVERY raw event
 *   - Discord alerter:    gated by this deduplicator
 *       → max 1 alert per cooldown window per (rule, actor) key
 *       → +1 aggregated summary when cooldown expires with suppressed count > 0
 *       → immediate escalation bypass when severity increases
 *
 * Cooldown windows (hardcoded Phase A; env-configurable in Phase B):
 *   critical → 2 minutes    (high signal, shorter window)
 *   warning  → 5 minutes
 *   info     → 10 minutes
 *
 * Actor key resolution (most specific wins):
 *   userId      → u:{userId}
 *   providerKey → p:{providerKey}
 *   adminUserId → a:{adminUserId}
 *   (none)      → global
 *
 * In-memory only — resets on server restart (intentional Phase A).
 * Phase B: persist dedup state to Redis for multi-instance deployments.
 *
 * Store capped at MAX_STORE_ENTRIES to prevent unbounded memory growth.
 * Eviction is insertion-order FIFO (Map iteration order in V8).
 */

import type { SecurityEvent, SecuritySeverity } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Cooldown per severity level (ms). Phase B: read from env vars. */
const COOLDOWN_MS: Record<SecuritySeverity, number> = {
  critical:  2 * 60 * 1000,  // 2 minutes
  warning:   5 * 60 * 1000,  // 5 minutes
  info:     10 * 60 * 1000,  // 10 minutes
};

/** Numeric rank for severity comparison (higher = more severe) */
const SEVERITY_RANK: Record<SecuritySeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

/**
 * Maximum number of (rule, actor) keys tracked simultaneously.
 * Guards against unbounded Map growth in long-lived serverless instances.
 * Oldest keys are evicted FIFO when the cap is reached.
 */
const MAX_STORE_ENTRIES = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeduplicatorEntry {
  /** Timestamp of the last Discord-visible emission for this key */
  lastEmittedAt:   number;
  /** Severity level of the last emitted event (determines cooldown length) */
  lastSeverity:    SecuritySeverity;
  /** Number of events suppressed since last emission */
  suppressedCount: number;
}

export type DeduplicationAction =
  /** First occurrence or cooldown expired (no prior suppressions) — emit normally */
  | "emit"
  /** In cooldown, same or lower severity — skip this event for Discord */
  | "suppress"
  /**
   * Cooldown expired and events were suppressed during it.
   * Emit this event with a "+N suppressed" note so the channel gets one
   * consolidated catch-up alert instead of a burst.
   */
  | "emit_aggregated"
  /**
   * Severity escalated (e.g., warning → critical) during an active cooldown.
   * Bypass the window and emit immediately — critical signals must not wait.
   * Includes the suppressed count for context.
   */
  | "emit_escalated";

export interface DeduplicationDecision {
  /** What the Discord alerter should do with this event */
  action:          DeduplicationAction;
  /**
   * Number of events that were suppressed before this emission.
   * Non-zero only for "emit_aggregated" and "emit_escalated".
   * Callers use this to add a "+N suppressed" note to the Discord embed.
   */
  suppressedCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

const _store = new Map<string, DeduplicatorEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a stable dedup key from a SecurityEvent.
 * Key = "{rule}::{actor}" where actor is the most specific identity available.
 *
 * Same rule + same actor → same cooldown bucket.
 * Different actors always track independently (a provider outage doesn't merge
 * with a user velocity event even if the rule is similar).
 */
function buildDeduplicatorKey(event: SecurityEvent): string {
  const actor =
    ("userId"      in event && event.userId)      ? `u:${event.userId}`      :
    ("providerKey" in event && event.providerKey) ? `p:${event.providerKey}` :
    ("adminUserId" in event && event.adminUserId) ? `a:${event.adminUserId}` :
    "global";

  return `${event.rule}::${actor}`;
}

/**
 * Evict the oldest entry when the store reaches its cap.
 * Map iteration order in V8 is insertion order, so the first key is oldest.
 */
function maybeEvict(): void {
  if (_store.size < MAX_STORE_ENTRIES) return;
  const oldestKey = _store.keys().next().value;
  if (oldestKey) _store.delete(oldestKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * checkEventDeduplication
 *
 * Determines whether a SecurityEvent should be forwarded to Discord.
 * Updates the in-memory dedup store as a side effect.
 *
 * Call this INSIDE the Discord consumer, NOT at the event bus level.
 * Supabase and the structured logger must receive every raw event
 * regardless of this decision.
 *
 * Always returns a decision — never throws (fails open with "emit").
 *
 * Wire-in pattern (discord-alerter.ts):
 *   const decision = checkEventDeduplication(event);
 *   if (decision.action === "suppress") return;
 *   const embed = buildEmbed(event, mode, decision);
 *   await sendToWebhook(embed);
 */
export function checkEventDeduplication(event: SecurityEvent): DeduplicationDecision {
  try {
    const key   = buildDeduplicatorKey(event);
    const now   = Date.now();
    const entry = _store.get(key);

    // ── First occurrence ──────────────────────────────────────────────────────
    if (!entry) {
      maybeEvict();
      _store.set(key, {
        lastEmittedAt:   now,
        lastSeverity:    event.severity,
        suppressedCount: 0,
      });
      return { action: "emit", suppressedCount: 0 };
    }

    const cooldownMs = COOLDOWN_MS[entry.lastSeverity];
    const elapsed    = now - entry.lastEmittedAt;
    const newRank    = SEVERITY_RANK[event.severity];
    const lastRank   = SEVERITY_RANK[entry.lastSeverity];
    const escalating = newRank > lastRank;

    // ── Cooldown expired ──────────────────────────────────────────────────────
    // Emit (with aggregated context if events were suppressed during cooldown).
    if (elapsed >= cooldownMs) {
      const suppressed = entry.suppressedCount;
      _store.set(key, {
        lastEmittedAt:   now,
        lastSeverity:    event.severity,
        suppressedCount: 0,
      });
      return {
        action:          suppressed > 0 ? "emit_aggregated" : "emit",
        suppressedCount: suppressed,
      };
    }

    // ── Severity escalated within cooldown ────────────────────────────────────
    // warning → critical must bypass the cooldown immediately.
    // Operators need to know the situation worsened even if a recent alert fired.
    if (escalating) {
      const suppressed = entry.suppressedCount;
      _store.set(key, {
        lastEmittedAt:   now,
        lastSeverity:    event.severity,  // update to new (higher) severity
        suppressedCount: 0,
      });
      return { action: "emit_escalated", suppressedCount: suppressed };
    }

    // ── In cooldown, no escalation — suppress ─────────────────────────────────
    entry.suppressedCount += 1;
    _store.set(key, entry);
    return { action: "suppress", suppressedCount: 0 };

  } catch {
    // Dedup logic failure — fail open so legitimate alerts still reach Discord
    return { action: "emit", suppressedCount: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getDeduplicatorStats — diagnostic only
 *
 * Returns a snapshot of all active dedup keys and their suppression counts.
 * Use for admin dashboards and Shield Center in Phase B.
 */
export function getDeduplicatorStats(): Array<{
  key:             string;
  suppressedCount: number;
  lastEmittedAt:   number;
  lastSeverity:    SecuritySeverity;
}> {
  return Array.from(_store.entries()).map(([key, entry]) => ({
    key,
    suppressedCount: entry.suppressedCount,
    lastEmittedAt:   entry.lastEmittedAt,
    lastSeverity:    entry.lastSeverity,
  }));
}

/**
 * resetDeduplicatorKey — for testing only
 *
 * Clears the dedup state for a specific key so it emits again immediately.
 * Pass the full key string ("{rule}::{actor}") or call with a rule prefix
 * to clear all matching keys.
 */
export function resetDeduplicatorKey(key: string): void {
  _store.delete(key);
}

/**
 * clearDeduplicatorStore — for testing only
 *
 * Resets the entire dedup store. Never call in production.
 */
export function clearDeduplicatorStore(): void {
  _store.clear();
}
