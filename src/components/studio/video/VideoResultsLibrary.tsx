"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoResultsLibrary — Cinematic video gallery
//
// Layer 2 redesign:
//   • Large media-first cards, sharp (borderRadius: 0) corners
//   • Zoom slider 40–100% controls card minimum width
//   • Hover → autoplay muted + reveal action overlay
//   • Click video → fullscreen
//   • No "Done" badge on completed cards
//   • Bulk select: checkbox per card, selection dock with Delete + placeholder actions
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

// ── Zoom helpers ──────────────────────────────────────────────────────────────
// 40% → 280px, 100% → 680px (linear)
function zoomToMinWidth(pct: number): number {
  return Math.round(280 + ((pct - 40) / 60) * 400);
}

// ── In-progress status badge (only for non-done / non-error) ─────────────────

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
  video:          GeneratedVideo;
  selected:       boolean;
  anySelected:    boolean;
  onSelect:       (id: string) => void;
  onReuse:        (v: GeneratedVideo) => void;
  onDelete:       (id: string) => void;
  onFavToggle?:   (id: string, newFav: boolean) => void;
  onPreview?:     (v: GeneratedVideo) => void;
  onAuthRequired?:() => void;
  onCardRef?:     (id: string, el: HTMLDivElement | null) => void;
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

  // AR ratio string for CSS
  const arCSS = (video.aspectRatio ?? "16:9").replace(":", " / ");

  return (
    <div
      ref={el => onCardRef?.(video.id, el)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.02)",
        border: selected
          ? "1px solid rgba(34,211,238,0.5)"
          : hovered
          ? "1px solid rgba(34,211,238,0.25)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 3,
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.25s, transform 0.25s",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: selected
          ? "0 0 0 1px rgba(34,211,238,0.15), 0 12px 40px rgba(0,0,0,0.55)"
          : hovered
          ? "0 20px 40px rgba(0,0,0,0.45), 0 0 22px rgba(14,165,160,0.1)"
          : "0 2px 10px rgba(0,0,0,0.35)",
        cursor: "default",
      }}
    >
      {/* ── Media area ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          aspectRatio: arCSS,
          background: "#0a0f1a",
          overflow: "hidden",
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
              transform: hovered ? "scale(1.03)" : "scale(1)",
              transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)",
            }}
          />
        ) : video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt="thumbnail"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
              transform: hovered ? "scale(1.03)" : "scale(1)",
              transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)",
            }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.015)",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
          </div>
        )}

        {/* Gradient overlay — always on, intensifies on hover */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: hovered
            ? "linear-gradient(to top,rgba(2,6,23,0.85) 0%,rgba(2,6,23,0.35) 40%,transparent 70%)"
            : "linear-gradient(to top,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.1) 45%,transparent 70%)",
          transition: "background 0.25s",
        }} />

        {/* ── Idle play icon (done, not hovering) ─────────────────────────── */}
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

        {/* ── Hover play icon (done, hovering) ────────────────────────────── */}
        {isDone && hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(14,165,160,0.18)",
              border: "2px solid rgba(34,211,238,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
              boxShadow: "0 0 24px rgba(34,211,238,0.3)",
              animation: "vlPlayPulse 1.8s ease-in-out infinite",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#22D3EE">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}

        {/* ── In-progress / error badges top-left ─────────────────────────── */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5, alignItems: "center" }}>
          <InProgressBadge status={video.status} />
          {isError && <ErrorBadge />}
        </div>

        {/* ── Duration + credits top-right ────────────────────────────────── */}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
          <div style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(2,6,23,0.7)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#94A3B8",
          }}>
            {video.duration}s
          </div>
          {isDone && video.creditsUsed > 0 && (
            <div style={{
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(14,165,160,0.12)", border: "1px solid rgba(34,211,238,0.2)",
              fontSize: 10, fontWeight: 700, color: "#22D3EE",
            }}>
              {video.creditsUsed}⚡
            </div>
          )}
        </div>

        {/* ── Checkbox — top-left corner, appears on hover or when any selected ── */}
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

        {/* ── Hover action strip — bottom of media ────────────────────────── */}
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
            <button
              onClick={handleDownload}
              title="Download"
              style={actionBtnStyle}
            >
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
              style={{ ...actionBtnStyle, color: copied ? "#22D3EE" : "#94A3B8" }}
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

      {/* ── Card body — prompt + timestamp + heart ───────────────────────────── */}
      <div style={{ padding: "9px 11px 10px" }}>
        <div style={{
          fontSize: 13, color: "#7A8EA4", lineHeight: 1.6,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
          marginBottom: 6,
        }}>
          {video.prompt
            ? video.prompt
            : <span style={{ color: "#2D3A4A", fontStyle: "italic" }}>No prompt</span>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "#2D3A4A" }}>{timeAgo(video.createdAt)}</div>
          {/* Heart / Favourite toggle */}
          <button
            onClick={e => { e.stopPropagation(); onFavToggle?.(video.id, !video.is_favorite); }}
            title={video.is_favorite ? "Remove from favourites" : "Add to favourites"}
            style={{
              background: "none", border: "none", padding: "2px 0", cursor: "pointer",
              display: "flex", alignItems: "center",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill={video.is_favorite ? "#EF4444" : "none"}
              stroke={video.is_favorite ? "#EF4444" : "#3A4F62"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "fill 0.18s, stroke 0.18s" }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared action button style — small icon buttons in hover overlay
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

function SelectionDock({
  count,
  onDelete,
  onClear,
}: {
  count:    number;
  onDelete: () => void;
  onClear:  () => void;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
      background: "rgba(8,12,28,0.96)", backdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "14px 32px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {/* Count */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#22D3EE",
        marginRight: 4,
      }}>
        {count} selected
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

      {/* Delete selected — fully wired */}
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

      {/* Visual placeholder — Make Public */}
      <PlaceholderDockBtn label="Make Public" />
      {/* Visual placeholder — Make Private */}
      <PlaceholderDockBtn label="Make Private" />
      {/* Visual placeholder — Move to Project */}
      <PlaceholderDockBtn label="Move to Project" />

      {/* Spacer + clear */}
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

type FilterTab = "all" | "generated" | "history" | "favorites";
type SortMode  = "latest" | "oldest" | "credits";
type ShowCount = 25 | 50 | 100 | 500;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoResultsLibrary({
  videos, onReusePrompt, onDelete, onFavToggle, onAuthRequired, onPreview, onCardRef,
}: Props) {
  const [filter,    setFilter]    = useState<FilterTab>("all");
  const [sort,      setSort]      = useState<SortMode>("latest");
  const [showCount, setShowCount] = useState<ShowCount>(25);
  const [zoomPct,   setZoomPct]   = useState(60);
  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now = Date.now();
  const minCardWidth = zoomToMinWidth(zoomPct);

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
    if (filter === "generated") return now - v.createdAt <= ONE_HOUR;
    if (filter === "history")   return now - v.createdAt > ONE_HOUR;
    if (filter === "favorites") return v.is_favorite === true;
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sort === "latest")  return b.createdAt - a.createdAt;
    if (sort === "oldest")  return a.createdAt - b.createdAt;
    if (sort === "credits") return b.creditsUsed - a.creditsUsed;
    return 0;
  });

  filtered = filtered.slice(0, showCount);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "generated", label: "Generated" },
    { key: "history",   label: "History" },
    { key: "favorites", label: "Favorites" },
  ];

  // Empty state
  if (videos.length === 0) {
    const GHOST = [0.38, 0.62, 0.44, 0.80, 0.52];
    return (
      <div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {GHOST.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: Math.round(h * 220),
                borderRadius: 3, border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.02)",
                overflow: "hidden", position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)",
                animation: `ghostShimmer 2.2s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }} />
              {i === 0 && (
                <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(100,116,139,0.3)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ margin: "0 auto 8px" }}>
                    <rect x="2" y="3" width="20" height="18" rx="2"/>
                    <path d="M9 8l7 4-7 4V8z"/>
                  </svg>
                  <div style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>
                    Your first video will appear here
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes ghostShimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
          @keyframes vlPulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
          @keyframes vlPlayPulse { 0%,100%{box-shadow:0 0 24px rgba(34,211,238,0.3)} 50%{box-shadow:0 0 40px rgba(34,211,238,0.55)} }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: selectedIds.size > 0 ? 80 : 32 }}>
      {/* ── Toolbar — single line ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, marginBottom: 18,
        flexWrap: "nowrap",
      }}>
        {/* LEFT: Filter tabs */}
        <div style={{
          display: "flex", gap: 3,
          background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4,
          flexShrink: 0,
        }}>
          {filterTabs.map(t => {
            const active = filter === t.key;
            const count =
              t.key === "all"       ? videos.length :
              t.key === "generated" ? videos.filter(v => now - v.createdAt <= ONE_HOUR).length :
              t.key === "history"   ? videos.filter(v => now - v.createdAt > ONE_HOUR).length :
              videos.filter(v => v.is_favorite === true).length;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 7,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  border: active ? "1px solid rgba(34,211,238,0.35)" : "1px solid transparent",
                  background: active ? "rgba(14,165,160,0.14)" : "transparent",
                  color: active ? "#22D3EE" : "#7A90A8",
                  cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                  background: active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.07)",
                  color: active ? "#22D3EE" : "#475569",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* RIGHT: Zoom + Sort + Show */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* Zoom slider with % label */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8, padding: "0 10px", height: 36,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
            <input
              type="range" min={40} max={100} step={5} value={zoomPct}
              onChange={e => setZoomPct(Number(e.target.value))}
              style={{
                width: 80, accentColor: "#0EA5A0", cursor: "pointer",
                background: "transparent",
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", minWidth: 30 }}>
              {zoomPct}%
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />

          {/* Sort buttons */}
          {(["latest", "oldest", "credits"] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                height: 36, padding: "0 14px", borderRadius: 7, fontSize: 13,
                fontWeight: sort === s ? 700 : 500,
                border: sort === s ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.07)",
                background: sort === s ? "rgba(14,165,160,0.12)" : "rgba(255,255,255,0.04)",
                color: sort === s ? "#22D3EE" : "#64748B",
                cursor: "pointer", transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {s === "latest" ? "Latest" : s === "oldest" ? "Oldest" : "Credits"}
            </button>
          ))}

          {/* Show count */}
          <select
            value={showCount}
            onChange={e => setShowCount(Number(e.target.value) as ShowCount)}
            style={{
              height: 36, padding: "0 10px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              color: "#64748B", cursor: "pointer", outline: "none",
            }}
          >
            {([25, 50, 100, 500] as ShowCount[]).map(n => (
              <option key={n} value={n} style={{ background: "#0C1220" }}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Count line ─────────────────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: "#4E6275", marginBottom: 16 }}>
        {filtered.length} video{filtered.length !== 1 ? "s" : ""}
        {selectedIds.size > 0 && (
          <span style={{ color: "#22D3EE", marginLeft: 8 }}>· {selectedIds.size} selected</span>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          padding: "36px 0", textAlign: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="rgba(100,116,139,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>No videos match this filter</span>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
          gap: 18,
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
        @keyframes vlPlayPulse { 0%,100%{box-shadow:0 0 24px rgba(34,211,238,0.3)} 50%{box-shadow:0 0 40px rgba(34,211,238,0.55)} }
      `}</style>
    </div>
  );
}
