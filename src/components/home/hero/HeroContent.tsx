"use client";

/**
 * HeroContent
 *
 * Renders the hero eyebrow label, headline, and subtext.
 *
 * Typography (responsive via clamp — cinematic override):
 *   Headline:  clamp(2rem, 5.5vw, 4.5rem) — scales from mobile → wide desktop
 *   Subtext:   clamp(15px, 1.9vw, 20px)
 *
 * Alignment:
 *   Mobile  → centred (items-center, text-center)
 *   Desktop → left-aligned (md:items-start, md:text-left)
 *
 * Uses Syne (--font-display) per Zencra typography lock.
 */
export function HeroContent() {
  return (
    <div
      className="flex flex-col items-center md:items-start text-center md:text-left"
      style={{
        gap: "20px",
        width: "100%",
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
          padding: "7px 16px",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.22em",
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
        Cinematic override — hero/landing context:
          clamp(2.2rem, 5.5vw, 4.5rem) gives ~36px mobile → 72px wide desktop
          fontWeight 800, lineHeight 0.95, letterSpacing -0.04em
      */}
      <h1
        className="font-display tracking-tight"
        style={{
          margin: 0,
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontSize: "clamp(44px, 5vw, 76px)",
          fontWeight: 800,
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          color: "#ffffff",
          textShadow: "0 0 14px rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ display: "block" }}>Create Cinematic</span>

        {/* Gradient line: blue → purple → pink */}
        <span
          style={{
            display: "block",
            background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #d946ef 100%)",
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
        className="mx-auto md:mx-0"
        style={{
          margin: "4px 0 0",
          fontSize: "clamp(14px, 1.6vw, 17px)",
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.52)",
          maxWidth: "480px",
          letterSpacing: "-0.01em",
        }}
      >
        Generate images, animate them into videos, and add voice with
        perfect lip-sync — all in one unified AI workflow.
      </p>
    </div>
  );
}
