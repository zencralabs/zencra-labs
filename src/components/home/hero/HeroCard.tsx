"use client";

import { useState } from "react";

export interface HeroCardProps {
  id: string;
  title: string;
  tag: string;
  duration: string;
  image: string;
}

/**
 * HeroCard — cinematic scene preview card.
 *
 * Media layers (bottom → top):
 *   1. Dark base background (#0a0a14)
 *   2. <img> fallback image          — always rendered, shows if video fails
 *   3. <video> autoplay preview       — muted, loop, playsInline, preload=metadata
 *   4. Gradient overlays + badges
 *
 * Video source: /hero/videos/{id}.mp4  (target <2–3 MB, no audio)
 * Image fallback: the `image` prop path (e.g. /hero/cyberpunk.jpg)
 *
 * Dimensions (clamp, responsive):
 *   Width:  220px mobile → 280px desktop
 *   Height: 150px mobile → 180px desktop
 *
 * Hover: scale(1.03) + purple border glow.
 * No next/image — media layers are decorative, not CLS-sensitive content.
 */
export function HeroCard({ id, title, tag, duration, image }: HeroCardProps) {
  const [hovered, setHovered] = useState(false);
  const videoSrc = `/hero/videos/${id}.mp4`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "clamp(210px, 18vw, 230px)",
        height: "clamp(130px, 11vw, 145px)",
        flexShrink: 0,
        position: "relative" as const,
        overflow: "hidden",
        background: "#0a0a14",

        /* Hover border + glow */
        border: hovered
          ? "1px solid rgba(139,92,246,0.55)"
          : "1px solid rgba(255,255,255,0.10)",
        boxShadow: hovered
          ? "0 0 32px rgba(139,92,246,0.28), 0 8px 40px rgba(0,0,0,0.60)"
          : "0 4px 20px rgba(0,0,0,0.40)",

        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition:
          "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
      }}
    >
      {/* ── 1. Fallback <img> — renders behind video ─────────────────────── */}
      {/*
        If the .mp4 file is missing or the browser can't play it, this img
        is visible through the transparent video layer. The video's poster
        attribute also provides browser-native fallback during buffering.
        eslint-disable-next-line: decorative card media, not a CLS image.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.65,
        }}
      />

      {/* ── 2. Autoplay video preview ─────────────────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={image}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: hovered ? 0.85 : 0.72,
          transition: "opacity 0.25s ease",
        }}
      >
        <source src={videoSrc} type="video/mp4" />
        {/* No <track> — decorative preview, no captions needed */}
      </video>

      {/* ── 3. Bottom gradient overlay ───────────────────────────────────── */}
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

      {/* ── 4. Duration badge — top right ─────────────────────────────────── */}
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

      {/* ── 5. Genre chip — top left ──────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "9px",
          left: "9px",
          background: "rgba(139,92,246,0.80)",
          padding: "3px 8px",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {tag}
      </div>

      {/* ── 6. Title — bottom ─────────────────────────────────────────────── */}
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

      {/* ── 7. Hover colour overlay ───────────────────────────────────────── */}
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
