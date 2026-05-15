"use client";

/**
 * HeroBackground
 *
 * Full-bleed cinematic background for the homepage hero.
 *
 * Media layers (bottom → top):
 *   1. Base #050509 colour          — always visible, instant
 *   2. <img> fallback               — shows if video 404s or fails to play
 *   3. <video> hero-bg.mp4          — autoplay, muted, loop, playsInline
 *   4. Vignette + colour-grade divs — overlaid above media
 *   5. Ambient glow orbs            — composited above everything
 *
 * Performance targets:
 *   hero-bg.mp4 → under 5 MB, no audio track, H.264 baseline
 *   During buffering: base #050509 colour layer shows instantly — no poster needed
 *
 * Overflow fix: right-side glow is positioned at right:0, NOT right:-60px.
 * The previous negative value caused blur() to paint past the viewport edge.
 */
export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* ── 1. Base colour ───────────────────────────────────────────────── */}
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "#050509" }}
      />

      {/* ── 2. Fallback layer — base #050509 colour above handles buffering ── */}
      {/* hero-bg.jpg does not exist; the dark base colour (layer 1) is      */}
      {/* sufficient during video buffering — no img fallback needed.         */}

      {/* ── 3. Background video ───────────────────────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
          opacity: 0.65,
        }}
      >
        <source src={`${process.env.NEXT_PUBLIC_SITE_MEDIA_BASE}/homepage/hero-bg.mp4`} type="video/mp4" />
        {/* No <track> — decorative background, no captions needed */}
      </video>

      {/* ── 4a. Top vignette — blends into Navbar ────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "220px",
          background: "linear-gradient(to bottom, #050509 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── 4b. Bottom vignette — blends into page sections ──────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "360px",
          background:
            "linear-gradient(to top, rgba(5,7,15,0.92) 0%, rgba(5,7,15,0.70) 40%, rgba(5,7,15,0.35) 70%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── 4c-left. Left cinematic vignette — text readability ───────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "55%",
          background:
            "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.38) 40%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── 4c. Radial edge darkening — reduced to 0.28 for sharper video ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 120% 80% at 50% 40%, transparent 40%, rgba(5,5,9,0.28) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── 4d. Colour grade removed — video plays clean, no tint wash ─────── */}

      {/* ── 5a. Ambient glow — top-left blue ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "-80px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* ── 5b. Ambient glow — bottom-right purple ───────────────────────── */}
      {/*
        NOTE: right is 0, NOT -60px.
        The previous -60px value caused the blur() paint layer to extend
        ~170px beyond the viewport right edge, creating the blank overflow strip.
        Positioning at right:0 keeps the glow edge flush with the page boundary;
        the radial gradient still produces a soft corner effect.
      */}
      <div
        style={{
          position: "absolute",
          bottom: "80px",
          right: 0,
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.16) 0%, transparent 70%)",
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />

      {/* ── 5c. Subtle centre highlight ───────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(255,255,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
