"use client";

/**
 * PrivatePreviewGate
 *
 * Wraps the public homepage during private preview. Behaviour:
 *
 *   1. If NEXT_PUBLIC_ZENCRA_PREVIEW_GATE !== "true"
 *      → render children immediately, no state, no effect, zero flicker.
 *
 *   2. If flag is "true" AND localStorage['zencra_private_preview_access'] === 'granted'
 *      → render children immediately via lazy useState initializer.
 *        (runs synchronously on client before first paint — no flash)
 *
 *   3. Otherwise → show full-screen Zencra-branded preview gate.
 *
 * To disable the gate: set NEXT_PUBLIC_ZENCRA_PREVIEW_GATE=false in .env.
 * The gate never appears on /studio/*, /dashboard/*, /auth/*, /admin/*.
 */

import { useState, type ReactNode } from "react";

// ── ENV flag check — evaluated once at module load ────────────────────────────
const GATE_ENABLED = process.env.NEXT_PUBLIC_ZENCRA_PREVIEW_GATE === "true";

// ── LocalStorage keys ─────────────────────────────────────────────────────────
const LS_ACCESS_KEY = "zencra_private_preview_access";   // value: "granted"
const LS_ACCESS_AT  = "zencra_private_preview_at";       // value: Date.now() string

// ── Safe localStorage read (guards against SSR + privacy modes) ──────────────
function isAlreadyGranted(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(LS_ACCESS_KEY) === "granted"
    );
  } catch {
    return false;
  }
}

// ── Grant & persist ───────────────────────────────────────────────────────────
function persistGrant(): void {
  try {
    localStorage.setItem(LS_ACCESS_KEY, "granted");
    localStorage.setItem(LS_ACCESS_AT,  String(Date.now()));
  } catch {
    // Private browsing mode may block writes — degrade gracefully
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE UI
// ─────────────────────────────────────────────────────────────────────────────

function GateScreen({ onGranted }: { onGranted: () => void }) {
  const [code,       setCode]       = useState("");
  const [email,      setEmail]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res  = await fetch("/api/preview-access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accessCode: trimmed, email: email.trim() || undefined }),
      });
      const json = await res.json() as { ok: boolean; error?: string };

      if (json.ok) {
        persistGrant();
        onGranted();
      } else {
        setErrorMsg(json.error ?? "Invalid preview code. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full overflow-hidden relative flex items-center justify-center px-6"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#050509",
        color: "#fff",
      }}
    >
      {/* ── Background glow layers ────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-160px",
          left: "-160px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(217,70,239,0.20) 0%, transparent 70%)",
          filter: "blur(140px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-160px",
          right: "-160px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)",
          filter: "blur(150px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, transparent 42%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position:       "relative",
          zIndex:         10,
          width:          "100%",
          maxWidth:       "760px",
          border:         "1px solid rgba(255,255,255,0.14)",
          background:     "rgba(255,255,255,0.055)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:      "0 0 80px rgba(168,85,247,0.18)",
          padding:        "40px 32px",
        }}
        // responsive padding handled inline — no Tailwind breakpoints needed
      >
        {/* Badge */}
        <div
          style={{
            display:       "inline-flex",
            alignItems:    "center",
            border:        "1px solid rgba(255,255,255,0.15)",
            background:    "rgba(255,255,255,0.06)",
            padding:       "8px 16px",
            fontSize:      "13px",
            fontWeight:    600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.70)",
          }}
        >
          Private Preview
        </div>

        {/* Title */}
        <h1
          style={{
            marginTop:     "32px",
            fontSize:      "clamp(48px, 8vw, 82px)",
            lineHeight:    0.92,
            letterSpacing: "-0.05em",
            fontWeight:    600,
            color:         "#fff",
          }}
        >
          Zencra Labs
        </h1>

        {/* Subtitle */}
        <p
          style={{
            marginTop:     "20px",
            maxWidth:      "680px",
            fontSize:      "clamp(22px, 3vw, 34px)",
            lineHeight:    1.12,
            letterSpacing: "-0.03em",
            color:         "rgba(255,255,255,0.88)",
          }}
        >
          Create Cinematic Content — From Idea to Film in Minutes
        </p>

        {/* Description */}
        <p
          style={{
            marginTop:  "20px",
            fontSize:   "clamp(17px, 2vw, 20px)",
            lineHeight: 1.55,
            color:      "rgba(255,255,255,0.58)",
          }}
        >
          Zencra is currently in private preview. Enter your access code to view the early experience.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginTop: "36px" }}>
          {/* Access code */}
          <input
            type="text"
            placeholder="Access code"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={loading}
            style={{
              display:          "block",
              width:            "100%",
              height:           "56px",
              border:           "1px solid rgba(255,255,255,0.14)",
              background:       "rgba(0,0,0,0.35)",
              padding:          "0 20px",
              fontSize:         "17px",
              color:            "#fff",
              outline:          "none",
              boxSizing:        "border-box",
              marginBottom:     "12px",
              letterSpacing:    "0.05em",
              transition:       "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "rgba(216,180,254,0.70)";
              e.currentTarget.style.boxShadow   = "0 0 0 2px rgba(168,85,247,0.20)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.boxShadow   = "none";
            }}
          />

          {/* Optional email */}
          <input
            type="email"
            placeholder="Email address (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
            style={{
              display:      "block",
              width:        "100%",
              height:       "56px",
              border:       "1px solid rgba(255,255,255,0.14)",
              background:   "rgba(0,0,0,0.35)",
              padding:      "0 20px",
              fontSize:     "17px",
              color:        "#fff",
              outline:      "none",
              boxSizing:    "border-box",
              marginBottom: "12px",
              transition:   "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "rgba(216,180,254,0.70)";
              e.currentTarget.style.boxShadow   = "0 0 0 2px rgba(168,85,247,0.20)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.boxShadow   = "none";
            }}
          />

          {/* Error message */}
          {errorMsg && (
            <p
              role="alert"
              style={{
                marginBottom: "12px",
                fontSize:     "14px",
                color:        "#f87171",
                lineHeight:   1.5,
              }}
            >
              {errorMsg}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              display:         "block",
              width:           "100%",
              height:          "56px",
              border:          "1px solid rgba(216,180,254,0.30)",
              background:      loading
                ? "rgba(168,85,247,0.4)"
                : "linear-gradient(90deg, #d946ef 0%, #8b5cf6 50%, #22d3ee 100%)",
              padding:         "0 24px",
              fontSize:        "17px",
              fontWeight:      600,
              letterSpacing:   "-0.01em",
              color:           "#fff",
              cursor:          loading || !code.trim() ? "not-allowed" : "pointer",
              opacity:         loading || !code.trim() ? 0.60 : 1,
              boxShadow:       "0 0 34px rgba(217,70,239,0.32)",
              transition:      "filter 0.15s, transform 0.1s",
              boxSizing:       "border-box",
            }}
            onMouseEnter={e => {
              if (!loading && code.trim()) {
                (e.currentTarget as HTMLElement).style.filter = "brightness(1.10)";
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1)";
            }}
            onMouseDown={e => {
              if (!loading && code.trim()) {
                (e.currentTarget as HTMLElement).style.transform = "scale(0.99)";
              }
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {loading ? "Checking…" : "Enter Private Preview"}
          </button>
        </form>

        {/* Footer microcopy */}
        <p
          style={{
            marginTop:  "24px",
            fontSize:   "15px",
            lineHeight: 1.5,
            color:      "rgba(255,255,255,0.42)",
          }}
        >
          Access is currently limited to invited creators, partners, and early testers.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE WRAPPER — exported component
// ─────────────────────────────────────────────────────────────────────────────

export function PrivatePreviewGate({ children }: { children: ReactNode }) {
  // ── Fast-exit 1: flag is off ─────────────────────────────────────────────────
  // Return children directly — no state, no effect, no render delay.
  if (!GATE_ENABLED) {
    return <>{children}</>;
  }

  // ── Flag is on: delegate to inner component (keeps hooks rules valid) ────────
  return <GateInner>{children}</GateInner>;
}

/** Inner component — only mounted when GATE_ENABLED is true */
function GateInner({ children }: { children: ReactNode }) {
  // Lazy initializer runs synchronously on the client before first paint.
  // On the server window is undefined → false → gate HTML is SSR'd.
  // On the client if localStorage says granted → true → children render
  // immediately during hydration with no visible flash.
  const [granted, setGranted] = useState<boolean>(() => isAlreadyGranted());

  if (granted) {
    return <>{children}</>;
  }

  return <GateScreen onGranted={() => setGranted(true)} />;
}
