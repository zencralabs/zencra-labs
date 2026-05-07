/**
 * src/lib/security/discord-alerter.ts
 *
 * Zencra Shield — Discord webhook consumer.
 *
 * Sends a structured Discord embed for any SecurityEvent routed through
 * the Event Bus in observe or enforce mode.
 *
 * Design constraints:
 *   - Fire-and-forget: caller awaits but the function never throws.
 *   - Self-contained: embed includes all fields needed to understand the
 *     event without opening a secondary tool (log drain, Supabase, etc.)
 *   - Mode-badged: every embed shows the current shield mode so the on-call
 *     responder knows immediately whether enforcement was applied.
 *   - Env-gated: if DISCORD_SECURITY_WEBHOOK_URL is not set, silently skips.
 *
 * Embed colour coding:
 *   info     → blue   (#5865F2)
 *   warning  → amber  (#FCA028)
 *   critical → red    (#ED4245)
 *
 * Mode badge in embed footer:
 *   [DRY-RUN]  — no enforcement
 *   [OBSERVE]  — alerted, no enforcement
 *   [ENFORCE]  — alerted, enforcement applied
 */

import { logger } from "@/lib/logger";
import type { SecurityEvent, ShieldMode } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Discord embed colour map
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_COLOUR: Record<string, number> = {
  info:     0x5865f2, // Discord blurple
  warning:  0xfca028, // Amber
  critical: 0xed4245, // Discord red
};

const MODE_BADGE: Record<ShieldMode, string> = {
  "dry-run": "🟡 DRY-RUN",
  "observe": "🔵 OBSERVE",
  "enforce": "🔴 ENFORCE",
};

// ─────────────────────────────────────────────────────────────────────────────
// Discord embed builder
// ─────────────────────────────────────────────────────────────────────────────

interface DiscordField {
  name:   string;
  value:  string;
  inline: boolean;
}

function buildFields(event: SecurityEvent, mode: ShieldMode): DiscordField[] {
  const fields: DiscordField[] = [
    {
      name:   "Rule",
      value:  `\`${event.rule}\``,
      inline: true,
    },
    {
      name:   "Severity",
      value:  event.severity.toUpperCase(),
      inline: true,
    },
    {
      name:   "Action Taken",
      value:  `\`${event.actionTaken}\``,
      inline: true,
    },
    {
      name:   "Threshold",
      value:  [
        `**Metric:** \`${event.threshold.metric}\``,
        `**Configured:** ${event.threshold.configuredValue}${event.threshold.unit ? ` ${event.threshold.unit}` : ""}`,
        `**Observed:** ${event.threshold.observedValue}${event.threshold.unit ? ` ${event.threshold.unit}` : ""}`,
      ].join("\n"),
      inline: false,
    },
    {
      name:   "Reason",
      value:  event.actionReason.slice(0, 1024), // Discord field value limit
      inline: false,
    },
  ];

  // Rule-specific context fields
  if ("userId" in event && event.userId) {
    fields.push({ name: "User ID", value: `\`${event.userId}\``, inline: true });
  }
  if ("adminUserId" in event && event.adminUserId) {
    fields.push({ name: "Admin User ID", value: `\`${event.adminUserId}\``, inline: true });
  }
  if ("targetRoute" in event && event.targetRoute) {
    fields.push({ name: "Target Route", value: `\`${event.targetRoute}\``, inline: true });
  }
  if ("providerKey" in event && event.providerKey) {
    fields.push({ name: "Provider", value: `\`${event.providerKey}\``, inline: true });
  }
  if ("errorRatePct" in event) {
    fields.push({ name: "Error Rate", value: `${event.errorRatePct.toFixed(1)}%`, inline: true });
  }
  if ("riskTier" in event && event.riskTier) {
    fields.push({ name: "Risk Tier", value: event.riskTier.toUpperCase(), inline: true });
  }
  if ("windowCounts" in event && event.windowCounts) {
    const wc = event.windowCounts;
    const parts: string[] = [];
    if (wc.per60s  != null) parts.push(`60s: ${wc.per60s}`);
    if (wc.per5min != null) parts.push(`5min: ${wc.per5min}`);
    if (wc.per60min != null) parts.push(`60min: ${wc.per60min}`);
    if (parts.length > 0) {
      fields.push({ name: "Window Counts", value: parts.join(" | "), inline: false });
    }
  }

  return fields;
}

function buildEmbed(event: SecurityEvent, mode: ShieldMode): Record<string, unknown> {
  const ts        = event.timestamp ?? new Date().toISOString();
  const colour    = SEVERITY_COLOUR[event.severity] ?? SEVERITY_COLOUR.info;
  const badge     = MODE_BADGE[mode];
  const titleIcon = event.severity === "critical" ? "🚨" : event.severity === "warning" ? "⚠️" : "ℹ️";

  return {
    title:       `${titleIcon} Zencra Shield Alert`,
    description: `**${event.rule}**`,
    color:       colour,
    fields:      buildFields(event, mode),
    footer: {
      text: `${badge} | ${ts}`,
    },
    timestamp: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendDiscordAlert
 *
 * Sends a structured Discord embed for the given SecurityEvent.
 * Silently skips if DISCORD_SECURITY_WEBHOOK_URL is not configured.
 * Never throws — all errors are caught and logged.
 *
 * Called by the Event Bus (events.ts) in observe + enforce modes.
 * Do not call directly from producers — use emitSecurityEvent() instead.
 */
export async function sendDiscordAlert(
  event: SecurityEvent,
  mode:  ShieldMode,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_SECURITY_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    // Not configured — silent skip in production, debug log in dev
    logger.info(
      "shield/discord",
      "DISCORD_SECURITY_WEBHOOK_URL not set — skipping alert",
      { rule: event.rule }
    );
    return;
  }

  try {
    const payload = {
      username: "Zencra Shield",
      embeds:   [buildEmbed(event, mode)],
    };

    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      // Short timeout — Discord webhook is best-effort, not critical path
      signal:  AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Log Discord's error response body for debugging rate limits etc.
      const body = await res.text().catch(() => "(unreadable)");
      logger.warn("shield/discord", "Discord webhook responded with error", {
        status: res.status,
        body:   body.slice(0, 200),
        rule:   event.rule,
      });
    } else {
      logger.info("shield/discord", "Discord alert sent", {
        rule:  event.rule,
        mode,
      });
    }
  } catch (err) {
    // Network error, timeout, JSON serialisation failure — log and move on
    logger.warn("shield/discord", "Discord alert failed", {
      error: String(err),
      rule:  event.rule,
    });
  }
}
