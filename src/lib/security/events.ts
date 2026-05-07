/**
 * src/lib/security/events.ts
 *
 * Zencra Shield — Security Event Bus.
 *
 * Single entry point for all security events in the system.
 * Producers call emitSecurityEvent() and know nothing about consumers.
 * Consumers are registered here and each runs in an isolated try-catch —
 * one failing consumer never blocks another or the calling producer.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  Producer → emitSecurityEvent() → [logger, discord, supabase]    │
 * │                                                                  │
 * │  All consumers: fire-and-forget, independent, non-blocking.      │
 * │  Mode gate:     dry-run skips alert+persist; observe skips       │
 * │                 enforcement only; enforce runs everything.        │
 * │  Bypass:        SHIELD_BYPASS_USER_IDS skips per-user events.    │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Adding a new consumer:
 *   1. Import it here.
 *   2. Add a try-catch block inside runConsumers().
 *   3. Apply the correct mode gate (see MODE GATES comment below).
 *   That's it. emitSecurityEvent() callers need zero changes.
 */

import { logger }              from "@/lib/logger";
import { sendDiscordAlert }    from "@/lib/security/discord-alerter";
import { persistSecurityEvent } from "@/lib/security/supabase-persister";
import type { SecurityEvent, ShieldMode } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mode resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads SHIELD_MODE from env. Defaults to "dry-run" if unset or invalid.
 * This is intentionally defensive — an unconfigured system must never
 * silently go to "enforce" mode.
 */
export function resolveShieldMode(): ShieldMode {
  const raw = process.env.SHIELD_MODE?.trim().toLowerCase();
  if (raw === "observe" || raw === "enforce") return raw;
  return "dry-run"; // default — safe
}

/**
 * Returns the set of bypass user IDs from SHIELD_BYPASS_USER_IDS env var.
 * Allows founder/QA accounts to be excluded from enforcement without code changes.
 * Format: comma-separated UUIDs, e.g. "uuid1,uuid2"
 */
function getBypassUserIds(): Set<string> {
  const raw = process.env.SHIELD_BYPASS_USER_IDS ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return new Set(ids);
}

// ─────────────────────────────────────────────────────────────────────────────
// User-scoped bypass check
//
// Events that carry a `userId` field are checked against the bypass set.
// If the user is in the bypass list, the event is still logged at debug level
// (so the audit trail exists) but skipped by all other consumers.
// ─────────────────────────────────────────────────────────────────────────────

function isUserBypassed(event: SecurityEvent): boolean {
  if (!("userId" in event) || !event.userId) return false;
  return getBypassUserIds().has(event.userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE GATES
//
// dry-run:  logger only (info/warn/error by severity)
// observe:  logger + Discord alert + Supabase persist; NO enforcement action
// enforce:  logger + Discord alert + Supabase persist + enforcement action
//
// The enforcement action itself is executed by the PRODUCER (not here) based
// on the mode it received. emitSecurityEvent returns the resolved mode so
// producers can gate their enforcement logic:
//
//   const { mode } = await emitSecurityEvent(event);
//   if (mode === "enforce") {
//     return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
//   }
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Consumer runners — each isolated in try-catch
// ─────────────────────────────────────────────────────────────────────────────

async function runLogger(event: SecurityEvent, mode: ShieldMode): Promise<void> {
  try {
    const meta: Record<string, unknown> = {
      rule:         event.rule,
      severity:     event.severity,
      mode,
      actionTaken:  event.actionTaken,
      actionReason: event.actionReason,
      threshold:    event.threshold,
    };

    // Include user/provider context if present
    if ("userId" in event)      meta.userId      = event.userId;
    if ("adminUserId" in event) meta.adminUserId = event.adminUserId;
    if ("providerKey" in event) meta.providerKey = event.providerKey;

    const context = `shield/${event.rule}`;
    const message = `[${mode.toUpperCase()}] ${event.actionReason}`;

    if (event.severity === "critical") {
      logger.error(context, message, meta);
    } else if (event.severity === "warning") {
      logger.warn(context, message, meta);
    } else {
      logger.info(context, message, meta);
    }
  } catch (err) {
    // Logger consumer failed — emit to stderr directly, never throw
    process.stderr.write(
      `[shield/events] logger consumer failed: ${String(err)}\n`
    );
  }
}

async function runDiscordAlert(event: SecurityEvent, mode: ShieldMode): Promise<void> {
  // Discord alerts are sent in observe + enforce modes only
  if (mode === "dry-run") return;

  try {
    await sendDiscordAlert(event, mode);
  } catch (err) {
    logger.warn("shield/events", "discord consumer failed", { error: String(err) });
  }
}

async function runSupabasePersist(event: SecurityEvent, mode: ShieldMode): Promise<void> {
  // Supabase persistence runs in observe + enforce modes only
  if (mode === "dry-run") return;

  try {
    await persistSecurityEvent(event, mode);
  } catch (err) {
    logger.warn("shield/events", "supabase persist consumer failed", { error: String(err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface EmitResult {
  /** The resolved shield mode at the time of the event */
  mode: ShieldMode;
  /**
   * Whether enforcement should be applied by the producer.
   * True only when mode === "enforce".
   * Producers gate their blocking/cancellation logic on this flag:
   *   const { shouldEnforce } = await emitSecurityEvent(event);
   *   if (shouldEnforce) return NextResponse.json({ error }, { status: 429 });
   */
  shouldEnforce: boolean;
  /** Whether this event was bypassed (user in SHIELD_BYPASS_USER_IDS) */
  bypassed: boolean;
}

/**
 * emitSecurityEvent
 *
 * The single entry point for all Zencra Shield events.
 * Fire-and-forget internally — consumers run concurrently, each isolated.
 * Returns EmitResult so producers know whether to apply enforcement.
 *
 * This function NEVER throws. All errors are caught and logged internally.
 *
 * @example
 *   const { shouldEnforce } = await emitSecurityEvent({
 *     rule: "velocity.user.critical_5min",
 *     severity: "critical",
 *     threshold: { metric: "requests_per_5min", configuredValue: 40, observedValue: 67 },
 *     actionTaken: mode === "enforce" ? "request_blocked" : "alerted",
 *     actionReason: "User exceeded critical velocity threshold in 5min window",
 *     mode: resolvedMode,   // caller resolves mode using resolveShieldMode()
 *     userId: user.id,
 *     windowCounts: { per5min: 67 },
 *     riskTier: "critical",
 *   });
 *   if (shouldEnforce) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 */
export async function emitSecurityEvent(
  event: Omit<SecurityEvent, "timestamp"> & { timestamp?: string }
): Promise<EmitResult> {
  const mode    = resolveShieldMode();
  const bypassed = isUserBypassed(event as SecurityEvent);
  const stamped  = { ...event, timestamp: event.timestamp ?? new Date().toISOString() } as SecurityEvent;

  if (bypassed) {
    // Bypass: log at debug only so the audit trail exists, skip all other consumers
    logger.info(
      `shield/bypass`,
      `[BYPASS] Event skipped for bypassed user — rule=${event.rule}`,
      { rule: event.rule, userId: "userId" in event ? event.userId : undefined }
    );
    return { mode, shouldEnforce: false, bypassed: true };
  }

  // Run all consumers concurrently — errors are isolated inside each runner
  await Promise.allSettled([
    runLogger(stamped, mode),
    runDiscordAlert(stamped, mode),
    runSupabasePersist(stamped, mode),
  ]);

  return {
    mode,
    shouldEnforce: mode === "enforce",
    bypassed: false,
  };
}
