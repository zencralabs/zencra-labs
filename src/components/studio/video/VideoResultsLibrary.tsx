"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoResultsLibrary — Cinematic video gallery (Phase 2)
//
// Phase 2 upgrades:
//   • #1B1B1B background with teal radial glow, border-top
//   • One-line toolbar: tabs left, zoom+sort+show right
//   • Zoom slider with live % label, default 60%, drives grid column width
//   • Sharp cinematic cards (borderRadius: 0), hover lift + teal glow
//   • Clean empty state matching dark background
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import type { GeneratedVideo } from "./types";
import { useAuth } from "@/components/auth/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ONE_HOUR = 60 * 60 * 1000;

// ── Zoom → card min-width mapping ─────────────────────────────────────────────
// 40% = 260px | 60% = 380px | 100% = 620px
function zoomToMinWidth(pct: number): number {
  return Math.round(260 + ((pct - 40) / 60) * 360);
}

// ── Shared toolbar button style ───────────────────────────────────────────────
const toolbarBtnBase: React.CSSProperties = {
  height: 38,
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 3,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  color: "rgba(226,244,255,0.78)",
  cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const toolbarBtnActive: React.CSSProperties = {
  background: "rgba(45,212,191,0.16)",
  borderColor: "rgba(45,212,191,0.45)",
  color: "#2DD4BF",
  boxShadow: "0 0 18px rgba(45,212,191,0.12)",
};

// ── In-progress status badge ──────────────────────────────────────────────────

function InProgressBadge({ status }: { status: GeneratedVideo["status"] }) {
  if (status !== "generating" && status !== "polling") return null;
  const color = status === "generating" ? "#F59E0B" : "#8B5CF6";
  const bg    = status === "generating" ? "rgba(245,158,11,0.1)" : "rgba(139,92,246,0.1)";
  const label = status === "generating" ? "Generating" : "Processing";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px",
      background: bg, border: `1px solid ${color}30`,
      fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em",
      borderRadius: 4,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: color, animation: "vlPulse 1s ease-in-out infinite",
      }} />
      {label}
    </div>
  );
}

// ── Error badge ───────────────────────────────────────────────────────────────

function ErrorBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px",
      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
      fontSize: 10, fontWeight: 700, color: "#EF4444", letterSpacing: "0.04em",
      borderRadius: 4,
    }}>
      Failed
    </div>
  );
}

// ── Featured Reel Tile ────────────────────────────────────────────────────────
// First item in the grid when filtered videos exist. Spans 2 columns on desktop,
// autoplays muted loop, no actions/checkbox/prompt. Click → fullscreen preview.

function FeaturedVideoTile({
  video,
  onPreview,
}: {
  video: GeneratedVideo;
  onPreview?: (v: GeneratedVideo) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const hasMedia = !!video.url;
  const hasThumbnail = !!video.thumbnailUrl;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview?.(video)}
      style={{
        minHeight: 360,
        background: "#050B10",
        border: `1px solid ${hovered ? "rgba(45,212,191,0.42)" : "rgba(45,212,191,0.26)"}`,
        boxShadow: hovered
          ? "0 0 40px rgba(45,212,191,0.14), 0 28px 56px rgba(0,0,0,0.55)"
          : "0 0 20px rgba(45,212,191,0.07), 0 16px 36px rgba(0,0,0,0.4)",
        transition: "border-color 220ms ease, box-shadow 220ms ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      } as React.CSSProperties}
    >
      {/* ── Media ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#020608" }}>
        {hasMedia ? (
          <video
            ref={videoRef}
            src={video.url!}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transform: hovered ? "scale(1.02)" : "scale(1)",
              transition: "transform 360ms ease",
            }}
          />
        ) : hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl!}
            alt="Featured reel"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", minHeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #050B10 0%, #0A1520 100%)",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="rgba(45,212,191,0.2)" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(5,11,16,0.88) 0%, rgba(5,11,16,0.18) 55%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* ── Label block ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "18px 20px 20px",
          pointerEvents: "none",
        }}>
          {/* "Featured Reel" chip */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px",
            background: "rgba(45,212,191,0.14)",
            border: "1px solid rgba(45,212,191,0.32)",
            borderRadius: 2,
            marginBottom: 8,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#2DD4BF">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02l1.18-6.88L2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span style={{
              fontSize: 10, fontWeight: 800, color: "#2DD4BF",
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Featured Reel
            </span>
          </div>

          {/* Subtext */}
          <div style={{ fontSize: 11, color: "rgba(226,244,255,0.45)", fontWeight: 500, marginBottom: 6 }}>
            Latest generation · click to fullscreen
          </div>

          {/* Metadata row */}
          {(video.aspectRatio || video.duration || video.modelName) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              {video.modelName && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "rgba(226,244,255,0.38)",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>
                  {video.modelName}
                </span>
              )}
              {video.aspectRatio && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(226,244,255,0.28)" }}>
                  {video.aspectRatio}
                </span>
              )}
              {video.duration && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(226,244,255,0.28)" }}>
                  {video.duration}s
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Video Card ────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  selected,
  anySelected,
  onSelect,
  onReuse,
  onDelete,
  onFavToggle,
  onPreview,
  onAuthRequired,
  onCardRef,
}: {
  video:           GeneratedVideo;
  selected:        boolean;
  anySelected:     boolean;
  onSelect:        (id: string) => void;
  onReuse:         (v: GeneratedVideo) => void;
  onDelete:        (id: string) => void;
  onFavToggle?:    (id: string, newFav: boolean) => void;
  onPreview?:      (v: GeneratedVideo) => void;
  onAuthRequired?: () => void;
  onCardRef?:      (id: string, el: HTMLDivElement | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  const isDone  = video.status === "done";
  const isError = video.status === "error";
  const showCheckbox = hovered || anySelected;

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (videoRef.current && video.url && isDone) {
      videoRef.current.play().catch(() => {});
    }
  }, [video.url, isDone]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  function handleCopy() {
    if (!video.prompt) return;
    navigator.clipboard.writeText(video.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!video.url) return;
    if (!user) { onAuthRequired?.(); return; }
    const a = document.createElement("a");
    a.href     = video.url;
    a.download = `zencra-video-${video.id}.mp4`;
    a.click();
  }

  const arCSS = (video.aspectRatio ?? "16:9").replace(":", " / ");

  // ── Dynamic card border + shadow ─────────────────────────────────────────────
  const cardBorder = selected
    ? "1px solid rgba(34,211,238,0.55)"
    : hovered
    ? "1px solid rgba(45,212,191,0.38)"
    : "1px solid rgba(255,255,255,0.07)";

  const cardShadow = selected
    ? "0 0 0 1px rgba(34,211,238,0.15), 0 12px 40px rgba(0,0,0,0.55)"
    : hovered
    ? "0 22px 46px rgba(0,0,0,0.42), 0 0 22px rgba(45,212,191,0.08)"
    : "none";

  return (
    <div
      ref={el => onCardRef?.(video.id, el)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        background: "#101010",
        border: cardBorder,
        borderRadius: 0,
        overflow: "hidden",
        transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: cardShadow,
        cursor: "default",
      }}
    >
      {/* ── Media area ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          aspectRatio: arCSS,
          background: "#050505",
          overflow: "hidden",
          borderRadius: 0,
          cursor: isDone ? "pointer" : "default",
        }}
        onClick={isDone ? () => onPreview?.(video) : undefined}
      >
        {/* Video / thumbnail / empty */}
        {video.url && isDone ? (
          <video
            ref={videoRef}
            src={video.url}
            muted loop playsInline
            poster={video.thumbnailUrl ?? undefined}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
              borderRadius: 0,
              transform: hovered ? "scale(1.025)" : "scale(1)",
              transition: "transform 260ms ease",
            }}
          />
        ) : video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt="thumbnail"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
              borderRadius: 0,
              transform: hovered ? "scale(1.025)" : "scale(1)",
              transition: "transform 260ms ease",
            }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#050505",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
          </div>
        )}

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: hovered
            ? "linear-gradient(to top,rgba(2,6,23,0.85) 0%,rgba(2,6,23,0.35) 40%,transparent 70%)"
            : "linear-gradient(to top,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.1) 45%,transparent 70%)",
          transition: "background 0.25s",
        }} />

        {/* Idle play icon */}
        {isDone && !hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(2,6,23,0.55)",
              border: "1.5px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#E2E8F0">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Hover play icon */}
        {isDone && hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(14,165,160,0.18)",
              border: "2px solid rgba(45,212,191,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
              boxShadow: "0 0 24px rgba(45,212,191,0.30)",
              animation: "vlPlayPulse 1.8s ease-in-out infinite",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#2DD4BF">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Status badges — top left */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5, alignItems: "center" }}>
          <InProgressBadge status={video.status} />
          {isError && <ErrorBadge />}
        </div>

        {/* Duration + credits — top right, shifted left to make room for heart */}
        <div style={{ position: "absolute", top: 8, right: 50, display: "flex", gap: 4 }}>
          <div style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(2,6,23,0.70)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#94A3B8",
          }}>
            {video.duration}s
          </div>
          {isDone && video.creditsUsed > 0 && (
            <div style={{
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(14,165,160,0.12)", border: "1px solid rgba(45,212,191,0.2)",
              fontSize: 10, fontWeight: 700, color: "#2DD4BF",
            }}>
              {video.creditsUsed}⚡
            </div>
          )}
        </div>

        {/* Heart / Favourite — top right overlay, 38px */}
        <button
          onClick={e => { e.stopPropagation(); onFavToggle?.(video.id, !video.is_favorite); }}
          title={video.is_favorite ? "Remove from favourites" : "Add to favourites"}
          style={{
            position: "absolute", top: 6, right: 6,
            width: 38, height: 38,
            background: video.is_favorite ? "rgba(239,68,68,0.18)" : "rgba(2,6,23,0.65)",
            border: video.is_favorite ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.14)",
            borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            transition: "background 0.18s, border-color 0.18s, transform 0.15s",
            zIndex: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={video.is_favorite ? "#EF4444" : "none"}
            stroke={video.is_favorite ? "#EF4444" : "rgba(226,244,255,0.55)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "fill 0.18s, stroke 0.18s" }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        {/* Hover prompt overlay — bottom of media, above action strip */}
        {hovered && video.prompt && (
          <div style={{
            position: "absolute", bottom: 48, left: 0, right: 0,
            padding: "6px 10px",
            background: "linear-gradient(transparent, rgba(2,6,23,0.72))",
            fontSize: 11, color: "rgba(203,213,225,0.78)", lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            pointerEvents: "none", zIndex: 4,
          }}>
            {video.prompt}
          </div>
        )}

        {/* Checkbox — top left, appears on hover or selection */}
        <div
          style={{
            position: "absolute", top: 8, left: 8,
            opacity: showCheckbox ? 1 : 0,
            transition: "opacity 0.15s",
            zIndex: 10,
          }}
          onClick={e => { e.stopPropagation(); onSelect(video.id); }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: selected ? "rgba(34,211,238,0.9)" : "rgba(2,6,23,0.8)",
            border: selected ? "1.5px solid #22D3EE" : "1.5px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s",
            backdropFilter: "blur(4px)",
          }}>
            {selected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="#020617" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
        </div>

        {/* Hover action strip — bottom of media */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "8px 10px",
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.2s, transform 0.2s",
          display: "flex", gap: 5, flexWrap: "wrap",
          zIndex: 5,
        }}>
          {/* Model badge */}
          <div style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(2,6,23,0.75)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#64748B",
            marginRight: "auto",
          }}>
            {video.modelName}
          </div>

          {/* Download */}
          {isDone && (
            <button onClick={handleDownload} title="Download" style={actionBtnStyle}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}

          {/* Reuse prompt */}
          <button
            onClick={e => { e.stopPropagation(); onReuse(video); }}
            title="Reuse prompt"
            style={actionBtnStyle}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.33"/>
            </svg>
          </button>

          {/* Copy prompt */}
          {video.prompt && (
            <button
              onClick={e => { e.stopPropagation(); handleCopy(); }}
              title="Copy prompt"
              style={{ ...actionBtnStyle, color: copied ? "#2DD4BF" : "#94A3B8" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(video.id); }}
            title="Delete"
            style={{ ...actionBtnStyle, color: "#EF4444" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

// Shared action button style
const actionBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 5,
  background: "rgba(10,15,30,0.8)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#94A3B8",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "background 0.12s, color 0.12s",
  backdropFilter: "blur(6px)",
  flexShrink: 0,
};

// ── Selection Dock ────────────────────────────────────────────────────────────

function SelectionDock({ count, onDelete, onClear }: {
  count: number; onDelete: () => void; onClear: () => void;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
      background: "rgba(8,12,28,0.96)", backdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "14px 32px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#2DD4BF", marginRight: 4 }}>
        {count} selected
      </div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
      <button
        onClick={onDelete}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.2)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.55)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)";
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
        Delete selected
      </button>
      <PlaceholderDockBtn label="Make Public" />
      <PlaceholderDockBtn label="Make Private" />
      <PlaceholderDockBtn label="Move to Project" />
      <div style={{ flex: 1 }} />
      <button
        onClick={onClear}
        style={{
          padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
          background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
          color: "#4E6275", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4E6275"; }}
      >
        Clear
      </button>
    </div>
  );
}

function PlaceholderDockBtn({ label }: { label: string }) {
  return (
    <button
      disabled
      title="Coming in next release"
      style={{
        padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        color: "#2D3A4A", cursor: "not-allowed",
      }}
    >
      {label}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  videos:          GeneratedVideo[];
  onReusePrompt:   (v: GeneratedVideo) => void;
  onDelete?:       (id: string) => void;
  onFavToggle?:    (id: string, newFav: boolean) => void;
  onAuthRequired?: () => void;
  onPreview?:      (v: GeneratedVideo) => void;
  onCardRef?:      (id: string, el: HTMLDivElement | null) => void;
}

type FilterTab = "history" | "favorites";
type SortMode  = "latest" | "oldest";
type ShowCount = 25 | 50 | 100 | 500;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoResultsLibrary({
  videos, onReusePrompt, onDelete, onFavToggle, onAuthRequired, onPreview, onCardRef,
}: Props) {
  const [filter,    setFilter]    = useState<FilterTab>("history");
  const [sort,      setSort]      = useState<SortMode>("latest");
  const [showCount, setShowCount] = useState<ShowCount>(25);
  const [zoomPct,   setZoomPct]   = useState(60);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now          = Date.now();
  const cardMinWidth = zoomToMinWidth(zoomPct);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function handleBulkDelete() {
    selectedIds.forEach(id => onDelete?.(id));
    setSelectedIds(new Set());
  }

  // Filter
  let filtered = videos.filter(v => {
    if (filter === "history")   return now - v.createdAt > ONE_HOUR;
    if (filter === "favorites") return v.is_favorite === true;
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sort === "latest")  return b.createdAt - a.createdAt;
    if (sort === "oldest")  return a.createdAt - b.createdAt;
    return 0;
  });

  filtered = filtered.slice(0, showCount);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "history",   label: "History" },
    { key: "favorites", label: "Favourites" },
  ];

  const sortModes: { key: SortMode; label: string }[] = [
    { key: "latest",  label: "Latest" },
    { key: "oldest",  label: "Oldest" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section style={{
      marginTop: 44,
      padding: "34px 24px 54px",
      background: [
        "radial-gradient(circle at 50% 0%, rgba(45,212,191,0.08), transparent 36%)",
        "#1B1B1B",
      ].join(", "),
      borderTop: "1px solid rgba(255,255,255,0.06)",
      boxSizing: "border-box",
      width: "100%",
      paddingBottom: selectedIds.size > 0 ? 80 : 54,
    } as React.CSSProperties}>

      {/* ── Full-width container ─────────────────────────────────────────────── */}
      <div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{
          fontSize: 12, fontWeight: 700, color: "#374151",
          letterSpacing: "0.1em", textTransform: "uppercase",
          marginBottom: 18,
        }}>
          Your Videos
        </div>

        {/* ── Toolbar — one desktop line ─────────────────────────────────────── */}
        <div style={{
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          marginBottom: 22,
          flexWrap: "wrap",
        }}>
          {/* Left: filter tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {filterTabs.map(t => {
              const active = filter === t.key;
              const count =
                t.key === "history"   ? videos.filter(v => now - v.createdAt > ONE_HOUR).length :
                videos.filter(v => v.is_favorite === true).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  style={active ? { ...toolbarBtnBase, ...toolbarBtnActive } : toolbarBtnBase}
                >
                  {t.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                    background: active ? "rgba(45,212,191,0.18)" : "rgba(255,255,255,0.07)",
                    color: active ? "#2DD4BF" : "#475569",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: zoom + sort + show */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>

            {/* Zoom control */}
            <div style={{
              height: 38,
              minWidth: 210,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 3,
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(226,244,255,0.82)",
                minWidth: 64,
                whiteSpace: "nowrap",
              }}>
                Zoom {zoomPct}%
              </span>
              <input
                type="range"
                min={40} max={100} step={5}
                value={zoomPct}
                onChange={e => setZoomPct(Number(e.target.value))}
                style={{
                  width: 112,
                  accentColor: "#2DD4BF",
                  cursor: "pointer",
                  background: "transparent",
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Sort buttons */}
            {sortModes.map(s => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  style={active ? { ...toolbarBtnBase, ...toolbarBtnActive } : toolbarBtnBase}
                >
                  {s.label}
                </button>
              );
            })}

            {/* Show count */}
            <select
              value={showCount}
              onChange={e => setShowCount(Number(e.target.value) as ShowCount)}
              style={{
                height: 38,
                padding: "0 12px",
                borderRadius: 3,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(226,244,255,0.78)",
                cursor: "pointer",
                outline: "none",
                flexShrink: 0,
              }}
            >
              {([25, 50, 100, 500] as ShowCount[]).map(n => (
                <option key={n} value={n} style={{ background: "#1B1B1B" }}>Show {n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Count line ────────────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: "#3D4D5E", marginBottom: 18 }}>
          {filtered.length} video{filtered.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && (
            <span style={{ color: "#2DD4BF", marginLeft: 8 }}>· {selectedIds.size} selected</span>
          )}
        </div>

        {/* ── Grid / empty states ───────────────────────────────────────────── */}
        {videos.length === 0 ? (
          /* No videos at all — clean empty state */
          <div style={{
            height: 280,
            border: "1px dashed rgba(255,255,255,0.12)",
            background: "#101010",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(100,116,139,0.25)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ margin: "0 auto 10px" }}>
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <path d="M9 8l7 4-7 4V8z"/>
              </svg>
              <div style={{ fontSize: 13, color: "#2D3A4A", fontWeight: 500 }}>
                Your generated videos will appear here
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Videos exist but nothing matches the filter */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "36px 0", textAlign: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>No videos match this filter</span>
          </div>
        ) : filtered.length >= 5 ? (
          /* ── Hero layout (≥5 videos): Featured Reel + 2×2 grid + overflow ── */
          <>
            {/* First row: Featured (col 1, rows 1-2) + 4 standard cards (2×2 right) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 22,
              marginBottom: 22,
            }}>
              {/* Featured — spans rows 1 and 2 */}
              <div style={{ gridColumn: 1, gridRow: "1 / span 2" }}>
                <FeaturedVideoTile
                  video={filtered[0]}
                  onPreview={onPreview}
                />
              </div>
              {/* Cards 2–5 in the 2×2 right slots */}
              {filtered.slice(1, 5).map(v => (
                <VideoCard
                  key={v.id}
                  video={v}
                  selected={selectedIds.has(v.id)}
                  anySelected={selectedIds.size > 0}
                  onSelect={toggleSelect}
                  onReuse={onReusePrompt}
                  onDelete={onDelete ?? (() => {})}
                  onFavToggle={onFavToggle}
                  onPreview={onPreview}
                  onAuthRequired={onAuthRequired}
                  onCardRef={onCardRef}
                />
              ))}
            </div>
            {/* Videos 6+ in normal auto-fill grid */}
            {filtered.length > 5 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`,
                gap: 22,
              }}>
                {filtered.slice(5).map(v => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    selected={selectedIds.has(v.id)}
                    anySelected={selectedIds.size > 0}
                    onSelect={toggleSelect}
                    onReuse={onReusePrompt}
                    onDelete={onDelete ?? (() => {})}
                    onFavToggle={onFavToggle}
                    onPreview={onPreview}
                    onAuthRequired={onAuthRequired}
                    onCardRef={onCardRef}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Normal auto-fill grid (<5 videos — no Featured tile) ── */
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`,
            gap: 22,
          }}>
            {filtered.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                selected={selectedIds.has(v.id)}
                anySelected={selectedIds.size > 0}
                onSelect={toggleSelect}
                onReuse={onReusePrompt}
                onDelete={onDelete ?? (() => {})}
                onFavToggle={onFavToggle}
                onPreview={onPreview}
                onAuthRequired={onAuthRequired}
                onCardRef={onCardRef}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bulk selection dock ───────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <SelectionDock
          count={selectedIds.size}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <style>{`
        @keyframes vlPulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes vlPlayPulse { 0%,100%{box-shadow:0 0 24px rgba(45,212,191,0.30)} 50%{box-shadow:0 0 40px rgba(45,212,191,0.55)} }
      `}</style>
    </section>
  );
}
