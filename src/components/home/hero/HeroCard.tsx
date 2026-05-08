"use client";

import { useState } from "react";

export interface HeroCardProps {
  id: string;
  title: string;
  tag: string;
  /**
   * Explicit video source path — caller is responsible for supplying a real file.
   * Allows HeroTimeline to cycle available .mp4 files across all 10 cards.
   */
  videoSrc: string;
}

/**
 * HeroCard — cinematic video-only preview card.
 *
 * Media layers (bottom → top):
 *   1. Dark cinematic base  (#0a0a14 + gradient) — always visible
 *   2. <video> autoplay     — muted, loop, playsInline, preload=metadata
 *   3. Gradient overlay + genre chip + title label
 *
 * No image fallback — video source is always provided by the caller.
 * border-radius: 0 everywhere (sharp cinematic edges).
 * Hover: scale(1.03) + purple border glow.
 */
export function HeroCard({ title, tag, videoSrc }: HeroCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "clamp(264px, 20vw, 292px)",
        height: "clamp(176px, 13.8vw, 195px)",
        flexShrink: 0,
        position: "relative" as const,
        overflow: "hidden",
        borderRadius: 0,

        /* Dark cinematic base */
        background: "linear-gradient(135deg, #05070F 0%, #111827 100%)",

        border: hovered
          ? "1px solid rgba(139,92,246,0.55)"
          : "1px solid rgba(255,255,255,0.10)",
        boxShadow: hovered
          ? "0 0 36px rgba(139,92,246,0.32), 0 10px 40px rgba(0,0,0,0.55)"
          : "0 10px 30px rgba(59,130,246,0.12), 0 0 40px rgba(139,92,246,0.08)",

        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition: "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
      }}
    >
      {/* ── Video — autoplay, no image fallback ──────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 0,
          opacity: hovered ? 0.90 : 0.78,
          transition: "opacity 0.25s ease",
        }}
      >
        <source src={videoSrc} type="video/mp4" />
        {/* No <track> — decorative preview, no captions needed */}
      </video>

      {/* ── Bottom gradient overlay ───────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "65%",
          background: "linear-gradient(to top, rgba(5,5,9,0.94) 0%, transparent 100%)",
        }}
      />

      {/* ── Genre chip — top left ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "9px",
          left: "9px",
          background: "rgba(139,92,246,0.80)",
          padding: "3px 8px",
          borderRadius: 0,
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {tag}
      </div>

      {/* ── Title — bottom ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: "11px",
          left: "12px",
          right: "12px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
      </div>

      {/* ── Hover colour overlay ──────────────────────────────────────────── */}
      {hovered && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(139,92,246,0.12) 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
