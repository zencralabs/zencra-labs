"use client";

/**
 * WaitlistPage — Premium cinematic waitlist funnel for Zencra Labs.
 *
 * Visual direction:
 *   Dark #050509 background, fuchsia/cyan ambient glow, sharp corners only.
 *   Desktop: two-column (brand left, form right).
 *   Mobile: single column stack.
 *
 * Typography:
 *   Display/Hero → Syne (font-display)
 *   Body/UI      → Familjen Grotesk (font-body)
 *
 * On submit: calls POST /api/waitlist/join.
 * On success: replaces form with premium success state.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";

// ── Role options ──────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "",           label: "Select your role"   },
  { value: "creator",    label: "Creator"             },
  { value: "filmmaker",  label: "Filmmaker"           },
  { value: "brand",      label: "Brand"               },
  { value: "developer",  label: "Developer"           },
  { value: "studio",     label: "Studio"              },
  { value: "other",      label: "Other"               },
] as const;

// ── Shared input style (inline — avoids Tailwind arbitrary value conflicts) ───
const inputStyle: React.CSSProperties = {
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
  transition:       "border-color 0.2s, box-shadow 0.2s",
  borderRadius:     0,
  WebkitAppearance: "none",
  appearance:       "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height:     "auto",
  minHeight:  "132px",
  padding:    "16px 20px",
  resize:     "none",
  lineHeight: "1.45",
};

function focusOn(el: HTMLElement) {
  el.style.borderColor = "rgba(216,180,254,0.70)";
  el.style.boxShadow   = "0 0 0 2px rgba(168,85,247,0.20)";
}
function focusOff(el: HTMLElement) {
  el.style.borderColor = "rgba(255,255,255,0.14)";
  el.style.boxShadow   = "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function WaitlistForm({ onSuccess }: { onSuccess: () => void }) {
  const [email,   setEmail]   = useState("");
  const [name,    setName]    = useState("");
  const [role,    setRole]    = useState("");
  const [intent,  setIntent]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !role) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/waitlist/join", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:  email.trim(),
          name:   name.trim()   || undefined,
          role:   role          || undefined,
          intent: intent.trim() || undefined,
        }),
      });
      const json = await res.json() as { ok: boolean; message?: string; error?: string };

      if (json.ok) {
        onSuccess();
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Email */}
      <input
        type="email"
        placeholder="Email address *"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        disabled={loading}
        autoComplete="email"
        style={inputStyle}
        onFocus={e => focusOn(e.currentTarget)}
        onBlur={e  => focusOff(e.currentTarget)}
      />

      {/* Name */}
      <input
        type="text"
        placeholder="Full name (optional)"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={loading}
        autoComplete="name"
        maxLength={80}
        style={inputStyle}
        onFocus={e => focusOn(e.currentTarget)}
        onBlur={e  => focusOff(e.currentTarget)}
      />

      {/* Role select */}
      <select
        value={role}
        onChange={e => setRole(e.target.value)}
        required
        disabled={loading}
        style={{
          ...inputStyle,
          color:            role ? "#fff" : "rgba(255,255,255,0.32)",
          cursor:           "pointer",
          // Custom arrow
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' stroke='rgba(255,255,255,0.5)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat:   "no-repeat",
          backgroundPosition: "right 16px center",
          paddingRight:       "44px",
        }}
        onFocus={e => focusOn(e.currentTarget)}
        onBlur={e  => focusOff(e.currentTarget)}
      >
        {ROLE_OPTIONS.map(opt => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.value === ""}
            style={{ background: "#0d0d16", color: "#fff" }}
          >
            {opt.label}
          </option>
        ))}
      </select>

      {/* Intent textarea */}
      <textarea
        placeholder="What do you want to create? (optional)"
        value={intent}
        onChange={e => setIntent(e.target.value)}
        disabled={loading}
        maxLength={600}
        style={textareaStyle}
        onFocus={e => focusOn(e.currentTarget)}
        onBlur={e  => focusOff(e.currentTarget)}
      />

      {/* Error */}
      {error && (
        <p role="alert" style={{ fontSize: "15px", color: "#f87171", lineHeight: 1.5, margin: 0 }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !email.trim() || !role}
        style={{
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          height:        "56px",
          width:         "100%",
          border:        "1px solid rgba(216,180,254,0.30)",
          background:    loading
            ? "rgba(168,85,247,0.4)"
            : "linear-gradient(90deg, #d946ef 0%, #8b5cf6 50%, #22d3ee 100%)",
          padding:       "0 24px",
          fontSize:      "17px",
          fontWeight:    600,
          letterSpacing: "-0.01em",
          color:         "#fff",
          cursor:        loading || !email.trim() || !role ? "not-allowed" : "pointer",
          opacity:       loading || !email.trim() || !role ? 0.60 : 1,
          boxShadow:     "0 0 34px rgba(217,70,239,0.32)",
          transition:    "filter 0.15s, transform 0.1s",
          boxSizing:     "border-box",
          borderRadius:  0,
        }}
        onMouseEnter={e => {
          if (!loading) (e.currentTarget as HTMLElement).style.filter = "brightness(1.10)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.filter = "brightness(1)";
        }}
        onMouseDown={e => {
          if (!loading) (e.currentTarget as HTMLElement).style.transform = "scale(0.99)";
        }}
        onMouseUp={e => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        }}
      >
        {loading ? "Joining…" : "Join Waitlist"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS STATE
// ─────────────────────────────────────────────────────────────────────────────

function WaitlistSuccess() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Checkmark badge */}
      <div
        aria-hidden="true"
        style={{
          width:      "52px",
          height:     "52px",
          border:     "1px solid rgba(168,85,247,0.40)",
          background: "rgba(168,85,247,0.12)",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2
        style={{
          fontSize:      "clamp(28px, 4vw, 38px)",
          fontWeight:    600,
          letterSpacing: "-0.04em",
          color:         "#fff",
          margin:        0,
          lineHeight:    1.1,
        }}
      >
        You&apos;re on the list.
      </h2>

      <p
        style={{
          fontSize:   "18px",
          lineHeight: "1.55",
          color:      "rgba(255,255,255,0.56)",
          margin:     0,
        }}
      >
        We&apos;ll review your request and send a private access code when your invite is ready.
      </p>

      <p
        style={{
          fontSize:   "15px",
          lineHeight: "1.5",
          color:      "rgba(255,255,255,0.38)",
          margin:     0,
          borderTop:  "1px solid rgba(255,255,255,0.08)",
          paddingTop: "16px",
        }}
      >
        Keep an eye on your email. Early access is limited.
      </p>

      <Link
        href="/"
        style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           "8px",
          height:        "48px",
          padding:       "0 24px",
          border:        "1px solid rgba(255,255,255,0.15)",
          background:    "rgba(255,255,255,0.06)",
          color:         "rgba(255,255,255,0.82)",
          fontSize:      "15px",
          fontWeight:    500,
          textDecoration:"none",
          transition:    "background 0.15s",
          alignSelf:     "flex-start",
          boxSizing:     "border-box",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
      >
        ← Back to Home
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function WaitlistPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div
      style={{
        minHeight:  "100vh",
        width:      "100%",
        background: "#050509",
        color:      "#fff",
        overflow:   "hidden",
        position:   "relative",
        padding:    "40px 24px 56px",
      }}
    >
      {/* ── Background glow layers ─────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position:      "absolute",
          top:           "-176px",
          left:          "-160px",
          width:         "560px",
          height:        "560px",
          background:    "rgba(217,70,239,0.20)",
          filter:        "blur(150px)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position:      "absolute",
          bottom:        "-192px",
          right:         "-176px",
          width:         "620px",
          height:        "620px",
          background:    "rgba(34,211,238,0.16)",
          filter:        "blur(160px)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position:      "absolute",
          inset:         0,
          background:    "radial-gradient(circle at center, rgba(255,255,255,0.075) 0%, transparent 44%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position:      "absolute",
          inset:         0,
          background:    "linear-gradient(to bottom, rgba(5,5,9,0.15), rgba(5,5,9,0.92))",
        }}
      />

      {/* ── Top-left brand link ────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 10, marginBottom: "32px" }}>
        <Link
          href="/"
          style={{
            fontSize:      "15px",
            fontWeight:    600,
            letterSpacing: "0.04em",
            color:         "rgba(255,255,255,0.60)",
            textDecoration:"none",
            transition:    "color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.60)"; }}
        >
          Zencra Labs
        </Link>
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position:      "relative",
          zIndex:        10,
          margin:        "0 auto",
          maxWidth:      "1240px",
          display:       "grid",
          gridTemplateColumns: "1fr",
          gap:           "40px",
          alignItems:    "center",
          minHeight:     "calc(100vh - 120px)",
        }}
        className="lg:grid-cols-[1.05fr_0.95fr]"
      >
        {/* ── LEFT — brand / story ────────────────────────────────────────── */}
        <div>
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
            Private Beta Access
          </div>

          {/* Headline */}
          <h1
            className="font-display"
            style={{
              marginTop:     "28px",
              fontSize:      "clamp(42px, 6vw, 72px)",
              fontWeight:    600,
              lineHeight:    0.92,
              letterSpacing: "-0.055em",
              color:         "#fff",
              maxWidth:      "720px",
            }}
          >
            Join the next wave of cinematic AI creation.
          </h1>

          {/* Subheadline */}
          <p
            style={{
              marginTop:     "24px",
              maxWidth:      "680px",
              fontSize:      "clamp(18px, 2.5vw, 24px)",
              lineHeight:    1.45,
              letterSpacing: "-0.025em",
              color:         "rgba(255,255,255,0.68)",
            }}
          >
            Get early access to Zencra&apos;s private creative studio for AI images, videos, voices, and cinematic workflows.
          </p>

          {/* Trust bullets */}
          <div
            style={{
              marginTop:  "32px",
              display:    "flex",
              flexWrap:   "wrap",
              gap:        "10px",
            }}
          >
            {[
              "Private creator access",
              "Controlled beta invites",
              "Built for cinematic workflows",
            ].map(label => (
              <div
                key={label}
                style={{
                  border:     "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.045)",
                  padding:    "12px 16px",
                  fontSize:   "16px",
                  fontWeight: 500,
                  color:      "rgba(255,255,255,0.72)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT — form card ────────────────────────────────────────────── */}
        <div
          style={{
            border:             "1px solid rgba(255,255,255,0.14)",
            background:         "rgba(255,255,255,0.055)",
            backdropFilter:     "blur(24px)",
            WebkitBackdropFilter:"blur(24px)",
            boxShadow:          "0 0 90px rgba(168,85,247,0.18)",
            padding:            "28px 24px",
          }}
          className="md:px-8 md:py-9"
        >
          {submitted ? (
            <WaitlistSuccess />
          ) : (
            <>
              {/* Card title */}
              <h2
                className="font-display"
                style={{
                  fontSize:      "clamp(28px, 3.5vw, 38px)",
                  fontWeight:    600,
                  letterSpacing: "-0.04em",
                  color:         "#fff",
                  margin:        0,
                  lineHeight:    1.1,
                }}
              >
                Request early access
              </h2>

              {/* Card description */}
              <p
                style={{
                  marginTop:  "12px",
                  fontSize:   "18px",
                  lineHeight: "1.55",
                  color:      "rgba(255,255,255,0.56)",
                  marginBottom:"24px",
                }}
              >
                Tell us who you are and what you want to create. We&apos;ll send approved users a private access code.
              </p>

              <WaitlistForm onSuccess={() => setSubmitted(true)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
