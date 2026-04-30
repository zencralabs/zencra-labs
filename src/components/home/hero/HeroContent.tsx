"use client";

/**
 * HeroContent
 *
 * Renders the hero eyebrow label, headline, and subtext.
 *
 * Typography (responsive via clamp):
 *   Headline:  36px (mobile) → 48px (tablet) → 64px (desktop) → 84px (wide)
 *   Subtext:   16px → 20px
 *
 * Uses Syne (--font-display) for the headline per Zencra typography lock.
 */
export function HeroContent() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "22px",
        textAlign: "center",
        padding: "0 24px",
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      {/* ── Eyebrow label ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid rgba(139,92,246,0.38)",
          background: "rgba(139,92,246,0.10)",
          padding: "8px 18px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.20em",
          textTransform: "uppercase" as const,
          color: "rgba(196,181,253,0.90)",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#a855f7",
            boxShadow: "0 0 8px rgba(168,85,247,0.80)",
            flexShrink: 0,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        Cinematic AI Studio
      </div>

      {/* ── Headline ───────────────────────────────────────────────────────── */}
      {/*
        Responsive font-size via clamp:
          min 36px  (mobile ~320px viewport)
          preferred 8.5vw
          max 84px  (large desktop)
        The 48px tablet and 64px desktop breakpoints fall naturally within this range.
      */}
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 600,
          lineHeight: 0.92,
          letterSpacing: "-0.055em",
          color: "#ffffff",
          fontSize: "clamp(36px, 8.5vw, 84px)",
          textShadow: "0 2px 40px rgba(0,0,0,0.80)",
          maxWidth: "880px",
        }}
      >
        <span style={{ display: "block" }}>Create Cinematic</span>

        {/* Gradient line: blue → purple → pink */}
        <span
          style={{
            display: "block",
            background:
              "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #d946ef 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AI Content
        </span>

        <span style={{ display: "block" }}>From Idea to Film</span>
      </h1>

      {/* ── Subtext ────────────────────────────────────────────────────────── */}
      <p
        style={{
          margin: "4px 0 0",
          fontSize: "clamp(15px, 1.9vw, 20px)",
          lineHeight: 1.60,
          color: "rgba(255,255,255,0.54)",
          maxWidth: "560px",
          letterSpacing: "-0.01em",
        }}
      >
        Generate images, animate them into videos, and add voice with
        perfect lip-sync — all in one unified AI workflow.
      </p>
    </div>
  );
}
