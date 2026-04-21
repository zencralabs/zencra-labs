"use client";

/**
 * TurnstileWidget — Cloudflare Turnstile CAPTCHA widget.
 *
 * Loads the Turnstile script once per page (singleton pattern) and
 * renders the challenge widget inside a container div. Uses explicit
 * rendering so we have full callback control.
 *
 * Props:
 *   siteKey    — NEXT_PUBLIC_TURNSTILE_SITE_KEY from env
 *   onSuccess  — called with the token once verification passes
 *   onExpire   — called when the token expires (user must re-verify)
 *   onError    — called when Turnstile fails to load / challenge errors
 *   resetKey   — changing this value forces a full re-challenge
 *                (pass `${authMode}-${method}` so switching tabs resets)
 *
 * Design:
 *   - theme: dark — matches Zencra dark UI
 *   - appearance: interaction-only — widget is invisible in most cases;
 *     a challenge overlay only appears when Cloudflare decides one is needed.
 *     The token is still generated silently in the background.
 *   - Falls back to a visible "Retry" button if the script fails to load.
 */

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// ── Global Turnstile type ──────────────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  appearance?: "always" | "execute" | "interaction-only";
  size?: "normal" | "compact" | "flexible";
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /**
   * Changing this value tears down and re-renders the widget, issuing a
   * fresh challenge. Pass `${authMode}-${method}` so switching between
   * Login/Signup or Email/Phone forces users to re-verify.
   */
  resetKey?: string;
}

// ── Script loading singleton ───────────────────────────────────────────────────
// Only inject the Turnstile script once even if multiple TurnstileWidget
// instances mount at the same time.

let scriptState: "idle" | "loading" | "ready" | "error" = "idle";
const pendingCallbacks: Array<(ok: boolean) => void> = [];

function loadScript(onDone: (ok: boolean) => void): void {
  if (scriptState === "ready")  { onDone(true);  return; }
  if (scriptState === "error")  { onDone(false); return; }

  pendingCallbacks.push(onDone);

  if (scriptState === "loading") return;
  scriptState = "loading";

  const script = document.createElement("script");
  script.src  = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;

  script.onload = () => {
    scriptState = "ready";
    pendingCallbacks.splice(0).forEach(cb => cb(true));
  };
  script.onerror = () => {
    scriptState = "error";
    pendingCallbacks.splice(0).forEach(cb => cb(false));
  };

  document.head.appendChild(script);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TurnstileWidget({
  siteKey,
  onSuccess,
  onExpire,
  onError,
  resetKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!siteKey) return; // env key not configured — stay silent

    let mounted = true;
    setLoadErr(false);

    function renderWidget() {
      if (!mounted || !containerRef.current || !window.turnstile) return;

      // Tear down any previous widget in this container
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
      // Clear stale DOM content (e.g. previous iframe)
      containerRef.current.innerHTML = "";

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme:   "dark",
        appearance: "interaction-only",  // invisible unless challenge is needed
        size:       "flexible",
        callback: (token) => {
          if (mounted) onSuccess(token);
        },
        "expired-callback": () => {
          if (mounted) onExpire?.();
        },
        "error-callback": () => {
          if (mounted) {
            onError?.();
            // Do NOT set loadErr here — this is a challenge error (e.g. network
            // hiccup mid-challenge). The widget self-resets in that case.
          }
        },
      });
    }

    loadScript((ok) => {
      if (!mounted) return;
      if (!ok) {
        setLoadErr(true);
        return;
      }
      renderWidget();
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current) {
        try { window.turnstile?.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  // retryCount + resetKey are intentional — they force widget re-init
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, resetKey, retryCount]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // The container is always in the DOM so Turnstile can anchor its iframe.
  // When appearance="interaction-only" it takes no visual space unless challenged.

  if (loadErr) {
    return (
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            8,
        padding:        "8px 12px",
        borderRadius:   8,
        background:     "rgba(239,68,68,0.07)",
        border:         "1px solid rgba(239,68,68,0.15)",
      }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          CAPTCHA failed to load
        </span>
        <button
          type="button"
          onClick={() => {
            // Reset script state so we retry loading
            scriptState = "idle";
            setRetryCount(c => c + 1);
          }}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          4,
            background:   "none",
            border:       "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding:      "3px 8px",
            color:        "rgba(255,255,255,0.55)",
            fontSize:     11,
            cursor:       "pointer",
          }}
        >
          <RefreshCw size={11} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        // Turnstile interaction-only mode is invisible until a challenge fires.
        // We don't add padding/border so it takes no visual space in normal cases.
        width: "100%",
      }}
    />
  );
}
