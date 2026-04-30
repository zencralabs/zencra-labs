"use client";

import Image from "next/image";
import { useState } from "react";

export interface HeroCardProps {
  id: string;
  title: string;
  tag: string;
  duration: string;
  image: string;
}

/**
 * HeroCard
 *
 * A single cinematic scene card shown in the HeroTimeline.
 *
 * Dimensions (responsive via clamp):
 *   Width:  220px (mobile) → 280px (desktop)
 *   Height: 150px (mobile) → 180px (desktop)
 *
 * Hover: scale(1.03) + purple glow border.
 * Image: lazy-loaded; dark background fallback when image is missing.
 * next/image `loading="lazy"` — only the hero-bg gets `priority`.
 */
export function HeroCard({ title, tag, duration, image }: HeroCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        /* Responsive size — clamp gives smooth scaling between breakpoints */
        width: "clamp(220px, 28vw, 280px)",
        height: "clamp(150px, 17vw, 180px)",
        flexShrink: 0,
        position: "relative" as const,
        overflow: "hidden",
        background: "#0a0a14",

        /* Border + glow on hover */
        border: hovered
          ? "1px solid rgba(139,92,246,0.55)"
          : "1px solid rgba(255,255,255,0.10)",
        boxShadow: hovered
          ? "0 0 32px rgba(139,92,246,0.28), 0 8px 40px rgba(0,0,0,0.60)"
          : "0 4px 20px rgba(0,0,0,0.40)",

        /* Scale on hover */
        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition:
          "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",

        cursor: "pointer",
      }}
    >
      {/* ── Scene image (lazy) ──────────────────────────────────────────────── */}
      <Image
        src={image}
        alt={title}
        fill
        loading="lazy"
        sizes="(max-width: 640px) 220px, 280px"
        style={{
          objectFit: "cover",
          opacity: hovered ? 0.80 : 0.65,
          transition: "opacity 0.25s ease",
        }}
        // Graceful fallback: if image 404s, Next.js renders nothing;
        // the dark #0a0a14 background shows through.
      />

      {/* ── Bottom gradient overlay ─────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "65%",
          background:
            "linear-gradient(to top, rgba(5,5,9,0.94) 0%, transparent 100%)",
        }}
      />

      {/* ── Duration badge (top-right) ──────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "9px",
          right: "9px",
          background: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.12)",
          padding: "3px 8px",
          fontSize: "11px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.82)",
          letterSpacing: "0.02em",
        }}
      >
        {duration}
      </div>

      {/* ── Genre chip (top-left) ───────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "9px",
          left: "9px",
          background: "rgba(139,92,246,0.80)",
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {tag}
      </div>

      {/* ── Title (bottom) ──────────────────────────────────────────────────── */}
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

      {/* ── Hover colour overlay ────────────────────────────────────────────── */}
      {hovered && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(139,92,246,0.12) 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
