/**
 * src/lib/security/types.ts
 *
 * Zencra Shield — core type system.
 *
 * All security events in the system are typed through this file.
 * Nothing is stringly typed. Every event must carry a mandatory
 * context shape so consumers (Discord, Supabase, logger) have
 * enough information to act without additional DB lookups.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  ShieldMode:   dry-run → observe → enforce                       │
 * │  Severity:     info | warning | critical                         │
 * │  Rule:         enumerated — never a free string                  │
 * │  ActionTaken:  what the system did (always present)              │
 * │  SecurityEvent: discriminated union — one type per rule          │
 * └──────────────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shield Mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global + per-subsystem operating mode.
 *
 * dry-run  — event generated, logged; no enforcement action taken.
 *             Default for all new deployments. Safe to enable on day 1.
 * observe  — event generated, logged, alerted (Discord); no enforcement.
 *             Use to calibrate thresholds before going to enforce.
 * enforce  — event generated, logged, alerted; enforcement action taken
 *             (e.g. request blocked, job cancelled, circuit opened).
 *             Only activate after observe confirms threshold accuracy.
 *
 * Per-subsystem modes inherit from SHIELD_MODE unless overridden via
 * their own env var (VELOCITY_SCORER_MODE, CIRCUIT_BREAKER_MODE, etc.).
 * "inherit" means: read the global SHIELD_MODE at call time.
 */
export type ShieldMode = "dry-run" | "observe" | "enforce";
export type ShieldModeOrInherit = ShieldMode | "inherit";

// ─────────────────────────────────────────────────────────────────────────────
// Severity
// ─────────────────────────────────────────────────────────────────────────────

export type SecuritySeverity = "info" | "warning" | "critical";

// ─────────────────────────────────────────────────────────────────────────────
// Rule names — enumerated, never a free string
// ─────────────────────────────────────────────────────────────────────────────

export type SecurityRule =
  // ── Velocity / rate anomaly rules ──────────────────────────────────────────
  | "velocity.user.burst_60s"           // user exceeded N requests in 60s window
  | "velocity.user.elevated_5min"       // user elevated tier in 5min window
  | "velocity.user.critical_5min"       // user critical tier in 5min window
  | "velocity.user.critical_60min"      // user critical tier in 60min window
  | "velocity.global.burst"             // platform-wide request spike

  // ── Credit / financial anomaly rules ───────────────────────────────────────
  | "credit.burn.warning_per_hour"      // credit burn rate exceeded warning threshold
  | "credit.burn.critical_per_hour"     // credit burn rate exceeded critical threshold
  | "credit.balance.negative"           // user credit balance went negative
  | "credit.refund.anomaly"             // unusual refund pattern detected

  // ── Provider / circuit breaker rules ───────────────────────────────────────
  | "provider.error_rate.warning"       // provider error rate exceeded warning threshold
  | "provider.error_rate.critical"      // provider error rate exceeded critical threshold
  | "provider.circuit.opened"           // circuit breaker tripped — provider isolated
  | "provider.circuit.half_open"        // circuit breaker probing — one trial request
  | "provider.circuit.closed"           // circuit breaker recovered — traffic restored
  | "provider.circuit.degraded"         // circuit in DEGRADED state — partial traffic
  | "provider.circuit.stabilizing"      // circuit stabilizing — degraded window active
  | "provider.circuit.recovering"       // circuit recovering — half-open probe succeeded
  | "provider.timeout.spike"            // provider timeout rate spike

  // ── Webhook / inbound verification rules ───────────────────────────────────
  | "webhook.signature.invalid"         // HMAC signature mismatch on inbound webhook
  | "webhook.signature.missing"         // Inbound webhook has no signature header
  | "webhook.replay.detected"           // Webhook timestamp outside acceptable window

  // ── Admin / privilege rules ─────────────────────────────────────────────────
  | "admin.action.performed"            // Admin performed a privileged action (audit log)
  | "admin.access.denied"              // Admin gate rejected — invalid session or role

  // ── Job / async task rules ─────────────────────────────────────────────────
  | "job.queue.depth_warning"           // Job queue depth exceeded warning threshold
  | "job.stale.detected"                // Job stuck beyond max processing time
  | "job.duplicate.detected"            // Duplicate job submission for same asset

  // ── Entitlement / access rules ─────────────────────────────────────────────
  | "entitlement.plan.exceeded"         // User exceeded plan-level generation quota
  | "entitlement.feature.unauthorized"; // User accessed feature above their plan tier

// ─────────────────────────────────────────────────────────────────────────────
// Action taken — what the system actually did (mode-aware)
// ─────────────────────────────────────────────────────────────────────────────

export type SecurityActionTaken =
  | "logged_only"           // dry-run: event written to log, nothing else
  | "alerted"               // observe: event alerted (Discord) but not enforced
  | "request_blocked"       // enforce: HTTP request rejected (429 / 403)
  | "job_cancelled"         // enforce: async generation job cancelled
  | "provider_isolated"     // enforce: provider removed from active rotation
  | "provider_restored"     // enforce: provider returned to rotation
  | "provider_degraded"     // enforce: provider marked degraded (partial traffic)
  | "credit_deducted"       // enforce: credits deducted (scheduled action)
  | "access_denied"         // enforce: access denied at gate
  | "audit_logged";         // always: written to admin_audit_log (not security_events_log)

// ─────────────────────────────────────────────────────────────────────────────
// Mandatory threshold context
//
// Every SecurityEvent MUST include threshold context so consumers
// (Discord embed, Supabase row, logger) have self-contained information.
// No consumer should need to do a secondary lookup to understand an event.
// ─────────────────────────────────────────────────────────────────────────────

export interface ThresholdContext {
  /** The measurable metric being tracked (e.g. "requests_per_5min", "error_rate_pct") */
  metric: string;
  /** The threshold value configured in the system (from env var or constant) */
  configuredValue: number;
  /** The actual observed value that triggered this event */
  observedValue: number;
  /** Unit for human readability in alerts (e.g. "req/5min", "credits/hr", "pct") */
  unit?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base event shape — all SecurityEvent variants extend this
// ─────────────────────────────────────────────────────────────────────────────

interface SecurityEventBase {
  /** Which rule triggered this event — determines consumer behaviour */
  rule: SecurityRule;
  /** Severity tier — controls Discord colour, Supabase urgency field */
  severity: SecuritySeverity;
  /** Threshold that was crossed — mandatory, not optional */
  threshold: ThresholdContext;
  /** What the system did in response (mode-aware) */
  actionTaken: SecurityActionTaken;
  /** Human-readable reason for the action — appears in Discord + audit log */
  actionReason: string;
  /** Shield mode active at the time of the event */
  mode: ShieldMode;
  /** ISO timestamp — set by emitSecurityEvent() if not provided */
  timestamp?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SecurityEvent — discriminated union by rule
//
// Each variant carries rule-specific context fields in addition to the base.
// The `rule` field is the discriminant — consumers can narrow on it.
// ─────────────────────────────────────────────────────────────────────────────

export interface VelocityEvent extends SecurityEventBase {
  rule:
    | "velocity.user.burst_60s"
    | "velocity.user.elevated_5min"
    | "velocity.user.critical_5min"
    | "velocity.user.critical_60min"
    | "velocity.global.burst";
  userId:      string;
  windowCounts: {
    per60s?:   number;
    per5min?:  number;
    per60min?: number;
  };
  riskTier: "normal" | "elevated" | "critical";
}

export interface CreditEvent extends SecurityEventBase {
  rule:
    | "credit.burn.warning_per_hour"
    | "credit.burn.critical_per_hour"
    | "credit.balance.negative"
    | "credit.refund.anomaly";
  userId:        string;
  creditsUsed:   number;
  creditsBalance: number;
  planId?:       string;
}

export interface ProviderEvent extends SecurityEventBase {
  rule:
    | "provider.error_rate.warning"
    | "provider.error_rate.critical"
    | "provider.circuit.opened"
    | "provider.circuit.half_open"
    | "provider.circuit.closed"
    | "provider.circuit.degraded"
    | "provider.circuit.stabilizing"
    | "provider.circuit.recovering"
    | "provider.timeout.spike";
  providerKey:          string;
  errorRatePct:         number;
  windowSeconds:        number;
  consecutiveErrors?:   number;
  consecutiveSuccesses?: number;
  degradedDurationSec?:  number;
}

export interface WebhookEvent extends SecurityEventBase {
  rule:
    | "webhook.signature.invalid"
    | "webhook.signature.missing"
    | "webhook.replay.detected";
  providerKey:    string;
  webhookEventId?: string;
  timestampDeltaMs?: number;
}

export interface AdminEvent extends SecurityEventBase {
  rule: "admin.action.performed" | "admin.access.denied";
  adminUserId:  string;
  targetRoute:  string;
  /** Additional context specific to the action (e.g. { waitlistUserId: "..." }) */
  actionMeta?:  Record<string, unknown>;
}

export interface JobEvent extends SecurityEventBase {
  rule:
    | "job.queue.depth_warning"
    | "job.stale.detected"
    | "job.duplicate.detected";
  jobId?:       string;
  userId?:      string;
  studioType?:  string;
  queueDepth?:  number;
  staleAgeMs?:  number;
}

export interface EntitlementEvent extends SecurityEventBase {
  rule: "entitlement.plan.exceeded" | "entitlement.feature.unauthorized";
  userId:       string;
  planId:       string;
  featureKey:   string;
  requiredPlan?: string;
}

/** Top-level discriminated union — narrow on `rule` or the variant type */
export type SecurityEvent =
  | VelocityEvent
  | CreditEvent
  | ProviderEvent
  | WebhookEvent
  | AdminEvent
  | JobEvent
  | EntitlementEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Admin Audit Log entry (separate from SecurityEvent — lower noise)
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminAuditEntry {
  adminUserId:  string;
  targetRoute:  string;
  method:       string;
  actionMeta?:  Record<string, unknown>;
  timestamp?:   string;
}
