"use client";

import Image from "next/image";

/**
 * HeroBackground
 *
 * Renders the cinematic full-bleed background for the homepage hero:
 *   • Base dark (#050509)
 *   • Optional /hero/hero-bg.jpg overlay (graceful fallback if missing)
 *   • Top + bottom vignettes to blend into page background
 *   • Radial-gradient colour grade (blue → purple → pink tone)
 *   • Ambient glow orbs
 *
 * Uses next/image with `priority` — this is the only hero image that gets priority.
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
      {/* ── Base colour ───────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#050509" }} />

      {/* ── Cinematic image — priority loaded, graceful 404 fallback ─────── */}
      <Image
        src="/hero/hero-bg.jpg"
        alt=""
        fill
        priority
        quality={85}
        sizes="100vw"
        style={{
          objectFit: "cover",
          objectPosition: "center 30%",
          opacity: 0.40,
        }}
        // onError intentionally left to default — Next.js renders nothing on 404
      />

      {/* ── Top vignette ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "220px",
          background: "linear-gradient(to bottom, #050509 0%, transparent 100%)",
        }}
      />

      {/* ── Bottom vignette ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "320px",
          background: "linear-gradient(to top, #050509 0%, rgba(5,5,9,0.70) 55%, transparent 100%)",
        }}
      />

      {/* ── Radial edge darkening ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 120% 80% at 50% 40%, transparent 40%, rgba(5,5,9,0.75) 100%)",
        }}
      />

      {/* ── Cinematic colour grade: blue→purple→pink screen layer ─────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(139,92,246,0.10) 50%, rgba(217,70,239,0.12) 100%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* ── Ambient glow — top-left blue ──────────────────────────────────── */}
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

      {/* ── Ambient glow — bottom-right purple ───────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: "80px",
          right: "-60px",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.16) 0%, transparent 70%)",
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Subtle centre highlight ───────────────────────────────────────── */}
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
