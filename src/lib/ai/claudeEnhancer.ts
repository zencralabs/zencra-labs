/**
 * claudeEnhancer.ts — Zencra shared Claude text enhancer
 *
 * Single source of truth for all Claude-powered prompt/text enhancement
 * across the Zencra platform.
 *
 * Uses native fetch to call the Anthropic Messages API directly —
 * no SDK dependency required. The ANTHROPIC_API_KEY in .env.local is all
 * that's needed.
 *
 * Architecture rule:
 *   ALL prompt/text enhancement in Zencra must route through this module.
 *   Never call OpenAI for enhancement. Claude is the brain.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   // Basic call
 *   const result = await callClaudeEnhancer({
 *     systemPrompt: "You are a ...",
 *     userInput:    "raw text",
 *     maxTokens:    200,
 *   });
 *   if (result.ok) console.log(result.text);
 *   else           console.error(result.error);
 *
 * ─── MODEL ───────────────────────────────────────────────────────────────────
 *
 *   Default: claude-haiku-4-5-20251001 (fast, low-cost, precision tasks)
 *   Override: pass model param for Sonnet/Opus when needed.
 *
 * ─── API REFERENCE ───────────────────────────────────────────────────────────
 *
 *   POST https://api.anthropic.com/v1/messages
 *   Headers:
 *     x-api-key:         ANTHROPIC_API_KEY
 *     anthropic-version: 2023-06-01
 *     content-type:      application/json
 *   Body:
 *     { model, max_tokens, system, messages: [{ role, content }] }
 *   Response:
 *     { content: [{ type: "text", text: string }] }
 */

const ANTHROPIC_API_URL  = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION  = "2023-06-01";
const DEFAULT_MODEL      = "claude-haiku-4-5-20251001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClaudeEnhancerOptions {
  /** System instruction for Claude */
  systemPrompt: string;
  /** Raw user input text to enhance */
  userInput:    string;
  /** Max output tokens (default: 200) */
  maxTokens?:   number;
  /** Model override (default: claude-haiku-4-5-20251001) */
  model?:       string;
}

export type ClaudeEnhancerResult =
  | { ok: true;  text: string }
  | { ok: false; error: string };

// ─── Core call ────────────────────────────────────────────────────────────────

/**
 * callClaudeEnhancer
 *
 * Calls the Anthropic Messages API with a system prompt + user input.
 * Returns the first text block from Claude's response.
 *
 * Errors are caught and returned as { ok: false, error } rather than thrown —
 * callers decide how to surface them.
 */
export async function callClaudeEnhancer(
  opts: ClaudeEnhancerOptions,
): Promise<ClaudeEnhancerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured" };
  }

  const {
    systemPrompt,
    userInput,
    maxTokens = 200,
    model     = DEFAULT_MODEL,
  } = opts;

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages: [
          { role: "user", content: userInput },
        ],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Claude API fetch failed: ${msg}` };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, error: `Claude API error ${response.status}: ${body}` };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "Claude API returned invalid JSON" };
  }

  // Extract first text block from content array
  const content = (data as { content?: Array<{ type: string; text?: string }> }).content;
  const text = Array.isArray(content)
    ? content.find((b) => b.type === "text")?.text ?? ""
    : "";

  if (!text.trim()) {
    return { ok: false, error: "Claude returned empty enhancement" };
  }

  return { ok: true, text: text.trim() };
}
