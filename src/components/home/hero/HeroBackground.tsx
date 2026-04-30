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
 *   hero-bg.jpg → poster shown during video buffering
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

      {/* ── 2. Fallback <img> — rendered BELOW video ─────────────────────── */}
      {/*
        Belt-and-suspenders: if the video element fails (404 on .mp4, codec
        mismatch, data-saver mode), the browser may not surface the poster
        attribute reliably. This img ensures the still is always visible.
        eslint-disable-next-line: intentional — no next/image; this is a
        decorative background, not a CLS-sensitive content image.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero/hero-bg.jpg"
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
          opacity: 0.65,
        }}
      />

      {/* ── 3. Background video ───────────────────────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero/hero-bg.jpg"
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
        <source src="/hero/videos/hero-bg.mp4" type="video/mp4" />
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
          height: "320px",
          background:
            "linear-gradient(to top, #050509 0%, rgba(5,5,9,0.70) 55%, transparent 100%)",
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
