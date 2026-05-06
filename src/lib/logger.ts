/**
 * src/lib/logger.ts
 *
 * Structured logger for Zencra Labs server-side code.
 *
 * Behaviour:
 *   - Development  → pretty-print with [LEVEL] prefix to stdout/stderr (same DX as console.log)
 *   - Production   → JSON lines to stdout for log aggregators (BetterStack, Datadog, etc.)
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("route", "user signed in", { userId: "abc" });
 *   logger.warn("rate-limit", "burst threshold hit", { ip: "1.2.3.4" });
 *   logger.error("provider", "fal.ai returned 500", { status: 500, body: "..." });
 *
 * Rules:
 *   - NEVER log raw secrets (API keys, tokens, passwords).
 *   - Truncate any long strings coming from external sources.
 *   - Use logger.debug() for verbose diagnostics — suppressed in production.
 *
 * Integration path:
 *   BetterStack:  set LOG_DRAIN_URL + configure logpipe in src/lib/observability/betterstack.ts
 *   Sentry:       call Sentry.captureException() alongside logger.error()
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";

// Log level hierarchy — debug suppressed in prod
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: number = IS_PROD ? LEVELS.info : LEVELS.debug;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= MIN_LEVEL;
}

function buildEntry(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

function emit(level: LogLevel, entry: Record<string, unknown>): void {
  if (IS_PROD) {
    // JSON lines — structured for log aggregators; errors go to stderr
    const line = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } else {
    // Human-readable dev output
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const tag = `[${(entry.context as string)}]`;
    const msg = `${ts} ${level.toUpperCase().padEnd(5)} ${tag} ${entry.message as string}`;
    const meta = entry.meta as Record<string, unknown> | undefined;

    if (level === "error") {
      meta ? console.error(msg, meta) : console.error(msg);
    } else if (level === "warn") {
      meta ? console.warn(msg, meta) : console.warn(msg);
    } else {
      meta ? console.log(msg, meta) : console.log(msg);
    }
  }
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const entry = buildEntry(level, context, message, meta);
  emit(level, entry);
}

export const logger = {
  debug: (context: string, message: string, meta?: Record<string, unknown>) =>
    log("debug", context, message, meta),
  info: (context: string, message: string, meta?: Record<string, unknown>) =>
    log("info", context, message, meta),
  warn: (context: string, message: string, meta?: Record<string, unknown>) =>
    log("warn", context, message, meta),
  error: (context: string, message: string, meta?: Record<string, unknown>) =>
    log("error", context, message, meta),
};
