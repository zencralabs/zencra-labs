"use client";

import { useState } from "react";

export interface HeroCardProps {
  id: string;
  title: string;
  tag: string;
  /** Poster path (e.g. /hero/cyberpunk.jpg). Card shows dark fallback if missing. */
  image: string;
}

/**
 * HeroCard — cinematic scene preview card.
 *
 * Media layers (bottom → top):
 *   1. Dark cinematic base  (#0a0a14 + gradient) — always visible, no broken icon
 *   2. <img> poster         — hidden via onError if file is missing/broken
 *   3. <video> autoplay     — muted, loop, playsInline, preload=metadata
 *   4. Gradient overlay + genre chip + title label
 *
 * Video source: /hero/videos/{id}.mp4
 * Poster:       the `image` prop  — safe to pass even if file doesn't exist yet;
 *               onError hides the img element so the browser never shows a broken icon.
 *
 * Duration badge: removed — no timing labels on hero cards.
 * border-radius:  0 everywhere (sharp cinematic edges).
 *
 * Hover: scale(1.03) + purple border glow.
 */
export function HeroCard({ id, title, tag, image }: HeroCardProps) {
  const [hovered,  setHovered]  = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoSrc = `/hero/videos/${id}.mp4`;

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

        /* Dark cinematic base — visible even when poster + video both missing */
        background: "linear-gradient(135deg, #05070F 0%, #111827 100%)",

        /* Hover border + cinematic glow (Option A) */
        border: hovered
          ? "1px solid rgba(139,92,246,0.55)"
          : "1px solid rgba(255,255,255,0.10)",
        boxShadow: hovered
          ? "0 0 36px rgba(139,92,246,0.32), 0 10px 40px rgba(0,0,0,0.55)"
          : "0 10px 30px rgba(59,130,246,0.12), 0 0 40px rgba(139,92,246,0.08)",

        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition:
          "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
      }}
    >
      {/* ── 1. Poster <img> — hidden via onError; no broken icon ever shown ── */}
      {/*
        We render the img only when we haven't already seen it error.
        onError fires synchronously on 404/network fail and flips imgError →
        React re-renders, the element is removed, dark base shows instead.
        eslint-disable-next-line: decorative card media, not a CLS image.
      */}
      {!imgError && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt=""
          onError={() => setImgError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
            opacity: 0.65,
          }}
        />
      )}

      {/* ── 2. Autoplay video preview ─────────────────────────────────────── */}
      {/*
        poster= is safe even when the image file is missing — browser handles
        a missing poster silently (no broken icon, just skips the frame).
        video onError hides the element if the .mp4 is also missing.
      */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={imgError ? undefined : image}
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 0,
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

      {/* ── 4. Genre chip — top left ──────────────────────────────────────── */}
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

      {/* ── 5. Title — bottom ─────────────────────────────────────────────── */}
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

      {/* ── 6. Hover colour overlay ───────────────────────────────────────── */}
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
