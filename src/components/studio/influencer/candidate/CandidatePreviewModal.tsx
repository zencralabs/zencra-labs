"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CandidatePreviewModal — cinematic full-screen preview overlay
//
// Layout (desktop): left = large media  /  right = details + actions
// Layout (mobile):  media top           /  details below (stacked)
//
// Opening: fade-in backdrop + scale-up card (CSS, no Framer Motion)
// Closing:  Escape key, backdrop click, or X button
//
// Actions:
//   - Select Identity  → onSelect(url)
//   - Add to Compare / Remove from Compare  → onCompare(url)
//   - Regenerate Similar  → disabled (future phase)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import type { StyleCategory } from "@/lib/influencer/types";

// ── Video URL detection ───────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

// ── Style category label ──────────────────────────────────────────────────────

function styleLabel(cat: StyleCategory): string {
  const map: Record<StyleCategory, string> = {
    "hyper-real":       "Hyper-Real",
    "3d-animation":     "3D Animation",
    "anime-manga":      "Anime / Manga",
    "fine-art":         "Fine Art",
    "game-concept":     "Game Concept",
    "physical-texture": "Physical Texture",
    "retro-pixel":      "Retro Pixel",
  };
  return map[cat] ?? cat;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CandidatePreviewModalProps {
  url:           string;
  index:         number;          // 1-based
  accent:        string;
  styleCategory: StyleCategory;
  isInCompare:   boolean;
  maxCompare:    boolean;         // tray at capacity and this candidate NOT in it
  isLocking:     boolean;
  onClose:       () => void;
  onSelect:      () => void;
  onCompare:     () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidatePreviewModal({
  url, index, accent, styleCategory,
  isInCompare, maxCompare, isLocking,
  onClose, onSelect, onCompare,
}: CandidatePreviewModalProps) {
  const isVideo    = isVideoUrl(url);
  const canCompare = isInCompare || !maxCompare;
  const cardRef    = useRef<HTMLDivElement>(null);

  // ── Keyboard handling ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    // Lock body scroll while open
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // ── Focus trap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  return (
    <>
      <style>{`
        @keyframes candidateModalBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes candidateModalCardIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0px); }
        }
        @keyframes candidateModalShimmer {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.65; }
        }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed", inset: 0, zIndex: 1000,
          background: "rgba(2,4,10,0.88)",
          backdropFilter: "blur(10px)",
          animation: "candidateModalBackdropIn 0.22s ease forwards",
        }}
        aria-hidden="true"
      />

      {/* ── Modal card ───────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview — Candidate ${String(index).padStart(2, "0")}`}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          position:     "fixed",
          inset:        0,
          zIndex:       1001,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          padding:      "24px 20px",
          pointerEvents: "none",
          outline:      "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width:         "100%",
            maxWidth:      920,
            maxHeight:     "calc(100vh - 48px)",
            background:    "#0b0e17",
            border:        `1px solid ${accent}30`,
            boxShadow:     `0 0 60px ${accent}18, 0 32px 80px rgba(0,0,0,0.80)`,
            display:       "flex",
            flexDirection: "row",
            overflow:      "hidden",
            animation:     "candidateModalCardIn 0.26s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          {/* ── Left: media ───────────────────────────────────────────── */}
          <div style={{
            flex:       "0 0 clamp(280px, 52%, 520px)",
            position:   "relative",
            background: "#080b12",
            overflow:   "hidden",
            minHeight:  400,
          }}>
            {/* Glow pulse behind media */}
            <div style={{
              position:  "absolute", inset: 0, zIndex: 0,
              background: `radial-gradient(ellipse at 50% 30%, ${accent}14, transparent 65%)`,
              animation: "candidateModalShimmer 3s ease-in-out infinite",
            }} aria-hidden="true" />

            {isVideo ? (
              <video
                src={url}
                autoPlay muted loop playsInline
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: 0,
                  position: "relative", zIndex: 1,
                }}
              />
            ) : (
              <img
                src={url}
                alt={`AI influencer candidate ${String(index).padStart(2, "0")}`}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: 0,
                  position: "relative", zIndex: 1,
                }}
              />
            )}

            {/* Candidate number badge */}
            <div style={{
              position:   "absolute", top: 14, left: 14, zIndex: 5,
              padding:    "4px 10px",
              background: "rgba(0,0,0,0.70)",
              backdropFilter: "blur(8px)",
              /* Micro: 11px / semibold 600 / tracking 0.12em / uppercase */
              fontSize:   11, fontWeight: 600, letterSpacing: "0.12em",
              color:      "rgba(255,255,255,0.85)",
              textTransform: "uppercase" as const,
            }}>
              {String(index).padStart(2, "0")}
            </div>

            {/* Video badge */}
            {isVideo && (
              <div style={{
                position: "absolute", top: 14, right: 14, zIndex: 5,
                padding:  "3px 8px",
                background: "rgba(99,102,241,0.72)",
                /* Micro: 11px / semibold 600 / tracking 0.12em */
                fontSize:   11, fontWeight: 600, letterSpacing: "0.12em",
                color: "#ffffff",
                textTransform: "uppercase" as const,
              }}>
                Video
              </div>
            )}

            {/* Bottom gradient */}
            <div style={{
              position:   "absolute", inset: "auto 0 0 0",
              height:     80,
              background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
              pointerEvents: "none", zIndex: 4,
            }} />
          </div>

          {/* ── Right: details + actions ───────────────────────────── */}
          <div style={{
            flex:           "1 1 0",
            display:        "flex",
            flexDirection:  "column",
            padding:        "28px 28px 24px",
            overflowY:      "auto",
            minWidth:       240,
            gap:            0,
          }}>
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{
                alignSelf:   "flex-end",
                width:       28, height: 28,
                background:  "transparent",
                border:      "1px solid rgba(255,255,255,0.12)",
                color:       "rgba(255,255,255,0.55)",
                cursor:      "pointer",
                display:     "flex",
                alignItems:  "center",
                justifyContent: "center",
                flexShrink:  0,
                marginBottom: 20,
                transition:  "border-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.30)";
                (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Identity label */}
            {/* Micro: 11px / semibold 600 / tracking 0.12em / uppercase */}
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              color: `${accent}cc`,
              textTransform: "uppercase" as const,
              marginBottom: 8,
            }}>
              Identity Candidate
            </div>

            {/* Candidate name */}
            {/* Studio Title tier: 30/700/-0.02em */}
            <div style={{
              fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: 4,
            }}>
              Candidate {String(index).padStart(2, "0")}
            </div>

            {/* Style chip */}
            <div style={{
              display:     "inline-flex",
              alignItems:  "center",
              gap:         6,
              marginBottom: 24,
            }}>
              {/* Chip: 13px / medium 500 / -0.005em */}
              <span style={{
                fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
                color: "rgba(255,255,255,0.52)",
              }}>
                {styleLabel(styleCategory)}
              </span>
              {isVideo && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 13 }}>·</span>
                  {/* Chip: 13px / medium 500 / -0.005em */}
                  <span style={{
                    fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
                    color: "rgba(255,255,255,0.52)",
                  }}>
                    Video
                  </span>
                </>
              )}
            </div>

            {/* Divider */}
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 24,
            }} />

            {/* Traits */}
            <div style={{ marginBottom: 24 }}>
              {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
              <div style={{
                fontSize: 13, fontWeight: 600, letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase" as const,
                marginBottom: 10,
              }}>
                Traits
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["AI Generated", "Unique Identity", styleLabel(styleCategory)].map(t => (
                  <span key={t} style={{
                    padding:    "4px 10px",
                    background: "rgba(255,255,255,0.05)",
                    border:     "1px solid rgba(255,255,255,0.09)",
                    /* Chip: 13px / medium 500 / -0.005em */
                    fontSize:   13, fontWeight: 500, letterSpacing: "-0.005em",
                    color:      "rgba(255,255,255,0.60)",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Spacer — push actions to bottom */}
            <div style={{ flex: 1 }} />

            {/* ── Actions ────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Select Identity — primary CTA */}
              <button
                onClick={() => { if (!isLocking) onSelect(); }}
                disabled={isLocking}
                style={{
                  width:      "100%",
                  height:     44,
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  border:     "none",
                  color:      "#ffffff",
                  /* Button: 15px / semibold 600 / -0.01em */
                  fontSize:   15, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor:     isLocking ? "not-allowed" : "pointer",
                  opacity:    isLocking ? 0.55 : 1,
                  boxShadow:  "0 4px 24px rgba(99,102,241,0.36)",
                  transition: "box-shadow 0.15s ease, opacity 0.2s ease",
                }}
                onMouseEnter={e => {
                  if (!isLocking) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 32px rgba(99,102,241,0.55)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(99,102,241,0.36)";
                }}
              >
                {isLocking ? "Locking Identity…" : "Select Identity"}
              </button>

              {/* Compare toggle */}
              <button
                onClick={() => { if (canCompare) onCompare(); }}
                disabled={!canCompare}
                style={{
                  width:      "100%",
                  height:     40,
                  background: isInCompare ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                  border:     `1px solid ${isInCompare ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.12)"}`,
                  color:      isInCompare ? "#a5b4fc" : "rgba(255,255,255,0.70)",
                  /* Button: 15px / semibold 600 / -0.01em */
                  fontSize:   15, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor:     canCompare ? "pointer" : "not-allowed",
                  opacity:    canCompare ? 1 : 0.38,
                  transition: "all 0.15s ease",
                }}
              >
                {isInCompare ? "✓ Remove from Compare" : "Add to Compare"}
              </button>

              {/* Regenerate Similar — future phase (disabled) */}
              <button
                disabled
                title="Coming soon"
                style={{
                  width:      "100%",
                  height:     36,
                  background: "transparent",
                  border:     "1px solid rgba(255,255,255,0.07)",
                  color:      "rgba(255,255,255,0.22)",
                  /* Chip: 13px / medium 500 / -0.005em */
                  fontSize:   13, fontWeight: 500, letterSpacing: "-0.005em",
                  cursor:     "not-allowed",
                }}
              >
                Regenerate Similar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
