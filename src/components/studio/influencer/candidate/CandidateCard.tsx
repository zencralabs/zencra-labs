"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CandidateCard — single candidate in the carousel
//
// Video-first architecture: renders <video> if URL extension is a video format,
// falls back to <img> for all other URLs.
//
// Design rules:
//   - borderRadius: 0 everywhere on media (sharp, cinematic)
//   - hover scale max 1.03
//   - blue/purple glow on hover + selected border
//   - actions revealed via hover overlay (desktop)
//   - card click = preview (works on touch too)
//   - Zencra typography system throughout
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

// ── Video URL detection ───────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CandidateCardProps {
  url:         string;
  index:       number;       // 1-based display number
  accent:      string;
  isActive:    boolean;      // keyboard / scroll focus
  isInCompare: boolean;      // in the compare tray — indigo border
  isLocking:   boolean;      // identity lock in flight
  maxCompare:  boolean;      // compare tray at capacity and this card NOT in it
  onPreview:   () => void;
  onCompare:   () => void;
  onSelect:    () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateCard({
  url, index, accent, isActive, isInCompare, isLocking,
  maxCompare, onPreview, onCompare, onSelect,
}: CandidateCardProps) {
  const [hovered,     setHovered]     = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const isVideo = isVideoUrl(url);

  // ── Border / glow derivation ───────────────────────────────────────────────
  const borderColor = isInCompare
    ? "rgba(99,102,241,0.72)"     // indigo — compare selection
    : isActive
      ? "rgba(147,197,253,0.55)"  // blue — current focus
      : hovered
        ? `${accent}55`
        : "rgba(255,255,255,0.08)";

  const boxShadow = isInCompare
    ? "0 0 28px rgba(99,102,241,0.28), 0 8px 32px rgba(0,0,0,0.55)"
    : isActive
      ? "0 0 24px rgba(147,197,253,0.18), 0 8px 32px rgba(0,0,0,0.55)"
      : hovered
        ? `0 0 20px ${accent}1e, 0 12px 40px rgba(0,0,0,0.6)`
        : "0 8px 32px rgba(0,0,0,0.45)";

  const canCompare = isInCompare || !maxCompare;

  return (
    <>
      <style>{`
        @keyframes candidateCardShimmer {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.60; }
        }
      `}</style>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Candidate ${String(index).padStart(2, "0")} — click to preview`}
        onMouseEnter={() => !isLocking && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !isLocking && onPreview()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); !isLocking && onPreview(); } }}
        style={{
          flexShrink:  0,
          position:    "relative",
          width:       "clamp(220px, 70vw, 260px)",
          height:      380,
          borderRadius: 0,                   // sharp — spec requirement
          overflow:    "hidden",
          border:      `1px solid ${borderColor}`,
          boxShadow,
          cursor:      isLocking ? "not-allowed" : "pointer",
          transform:   hovered && !isLocking ? "scale(1.03)" : "scale(1)",
          opacity:     isLocking ? 0.55 : 1,
          transition: [
            "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
            "border-color 0.2s ease",
            "box-shadow 0.2s ease",
            "opacity 0.2s ease",
          ].join(", "),
          scrollSnapAlign: "start",
          background: "#0b0e17",
          outline: "none",
        }}
      >

        {/* ── Media shimmer placeholder — shown before load ───────────── */}
        {!mediaLoaded && (
          <div style={{
            position:  "absolute", inset: 0, zIndex: 1,
            background: `radial-gradient(ellipse at 50% 30%, ${accent}18, transparent 65%)`,
            animation: "candidateCardShimmer 1.8s ease-in-out infinite",
          }} />
        )}

        {/* ── Media — video-first, image fallback ─────────────────────── */}
        {isVideo ? (
          <video
            src={url}
            autoPlay muted loop playsInline
            onLoadedData={() => setMediaLoaded(true)}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              display: "block",
              borderRadius: 0,               // sharp
              position: "relative", zIndex: 2,
            }}
          />
        ) : (
          <img
            src={url}
            alt={`AI influencer candidate ${String(index).padStart(2, "0")}`}
            onLoad={() => setMediaLoaded(true)}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              display: "block",
              borderRadius: 0,               // sharp
              position: "relative", zIndex: 2,
            }}
          />
        )}

        {/* ── Candidate number badge — top left ───────────────────────── */}
        <div style={{
          position:   "absolute", top: 10, left: 10, zIndex: 5,
          padding:    "3px 8px",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          /* Micro: 11px / semibold 600 / tracking 0.12em / uppercase */
          fontSize:   11, fontWeight: 600, letterSpacing: "0.12em",
          color:      "rgba(255,255,255,0.82)",
          textTransform: "uppercase" as const,
        }}>
          {String(index).padStart(2, "0")}
        </div>

        {/* ── Compare check badge — top right ─────────────────────────── */}
        {isInCompare && (
          <div style={{
            position:   "absolute", top: 10, right: 10, zIndex: 5,
            width: 22, height: 22,
            background: "rgba(99,102,241,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* ── Permanent bottom gradient ────────────────────────────────── */}
        <div style={{
          position:   "absolute", inset: "auto 0 0 0",
          height:     120,
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 3,
        }} />

        {/* ── Hover overlay — actions + metadata ──────────────────────── */}
        <div style={{
          position:   "absolute", inset: 0, zIndex: 6,
          display:    "flex", flexDirection: "column",
          justifyContent: "flex-end",
          padding:    "14px 12px",
          opacity:    hovered && !isLocking ? 1 : 0,
          transition: "opacity 0.18s ease",
          pointerEvents: hovered && !isLocking ? "auto" : "none",
        }}>
          {/* Metadata */}
          <div style={{ marginBottom: 10 }}>
            {/* Chip: 13px / semibold 600 / -0.005em */}
            <div style={{
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
              color: "#ffffff",
            }}>
              Candidate {String(index).padStart(2, "0")}
            </div>
            {/* Micro: 11px / medium 500 / 0.12em / uppercase */}
            <div style={{
              fontSize: 11, fontWeight: 500, letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.52)", marginTop: 2,
              textTransform: "uppercase" as const,
            }}>
              {isVideo ? "Video · Identity candidate" : "Identity candidate"}
            </div>
          </div>

          {/* Preview + Compare row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {/* Preview */}
            <button
              onClick={e => { e.stopPropagation(); onPreview(); }}
              style={{
                flex: 1, height: 32,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#ffffff",
                /* Button: 13px / semibold 600 / -0.005em (tight button = Chip scale) */
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.20)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
            >
              Preview
            </button>

            {/* Compare */}
            <button
              onClick={e => { e.stopPropagation(); if (canCompare) onCompare(); }}
              disabled={!canCompare}
              style={{
                flex: 1, height: 32,
                background: isInCompare ? "rgba(99,102,241,0.28)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${isInCompare ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.14)"}`,
                color: isInCompare ? "#a5b4fc" : "rgba(255,255,255,0.72)",
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
                cursor: canCompare ? "pointer" : "not-allowed",
                opacity: canCompare ? 1 : 0.38,
                transition: "all 0.15s ease",
              }}
            >
              {isInCompare ? "✓ Compare" : "Compare"}
            </button>
          </div>

          {/* Select — full width */}
          <button
            onClick={e => { e.stopPropagation(); onSelect(); }}
            style={{
              width: "100%", height: 36,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              border: "none",
              color: "#ffffff",
              /* Button: 15px / semibold 600 / -0.01em */
              fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.32)",
              transition: "box-shadow 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(99,102,241,0.50)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(99,102,241,0.32)"; }}
          >
            Select Identity
          </button>
        </div>

      </div>
    </>
  );
}
