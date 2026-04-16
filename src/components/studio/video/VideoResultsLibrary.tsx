"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoResultsLibrary — Full-width masonry gallery with filters, sorting, autoplay
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import type { GeneratedVideo } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const ONE_HOUR = 60 * 60 * 1000;

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GeneratedVideo["status"] }) {
  const map = {
    done:       { color: "#22D3EE", bg: "rgba(34,211,238,0.1)",  label: "Done" },
    generating: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  label: "Generating" },
    polling:    { color: "#8B5CF6", bg: "rgba(139,92,246,0.1)",  label: "Processing" },
    error:      { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   label: "Error" },
  };
  const cfg = map[status] ?? map.error;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.color}30`,
      fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: "0.04em",
    }}>
      {(status === "generating" || status === "polling") && (
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: cfg.color, animation: "libPulse 1s ease-in-out infinite",
        }} />
      )}
      {cfg.label}
    </div>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────

function VideoCard({ video, onReuse, onDelete }: {
  video: GeneratedVideo;
  onReuse: (v: GeneratedVideo) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied]   = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (videoRef.current && video.url && video.status === "done") {
      videoRef.current.play().catch(() => {});
    }
  }, [video.url, video.status]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  function handleCopy() {
    if (video.prompt) {
      navigator.clipboard.writeText(video.prompt).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  function handleDownload() {
    if (!video.url) return;
    const a = document.createElement("a");
    a.href = video.url;
    a.download = `zencra-video-${video.id}.mp4`;
    a.click();
  }

  const isDone = video.status === "done";

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: hovered ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(14,165,160,0.08)" : "0 2px 8px rgba(0,0,0,0.3)",
        breakInside: "avoid",
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      {/* Thumbnail / video */}
      <div style={{ position: "relative", aspectRatio: video.aspectRatio?.replace(":", " / ") ?? "16 / 9", background: "#0a0f1a" }}>
        {video.url && isDone ? (
          <video
            ref={videoRef}
            src={video.url}
            muted loop playsInline
            poster={video.thumbnailUrl ?? undefined}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="3"/><path d="M9 8l7 4-7 4V8z"/>
            </svg>
          </div>
        )}

        {/* Center play icon — always visible when done, not hovering */}
        {isDone && !hovered && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(2,6,23,0.55)",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#E2E8F0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        )}

        {/* Hover overlay: top badges */}
        <div style={{
          position: "absolute", inset: 0,
          background: hovered ? "linear-gradient(to bottom, rgba(2,6,23,0.55) 0%, transparent 40%, rgba(2,6,23,0.7) 70%, rgba(2,6,23,0.9) 100%)" : "linear-gradient(to bottom, rgba(2,6,23,0.3) 0%, transparent 35%)",
          transition: "background 0.2s",
          pointerEvents: "none",
        }} />

        {/* Top badges */}
        <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <StatusBadge status={video.status} />
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{
              padding: "2px 6px", borderRadius: 6,
              background: "rgba(2,6,23,0.7)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 10, fontWeight: 600, color: "#94A3B8",
            }}>
              {video.duration}s
            </div>
            <div style={{
              padding: "2px 6px", borderRadius: 6,
              background: "rgba(14,165,160,0.15)", border: "1px solid rgba(34,211,238,0.2)",
              fontSize: 10, fontWeight: 700, color: "#22D3EE",
            }}>
              {video.creditsUsed}⚡
            </div>
          </div>
        </div>

        {/* Model badge */}
        <div style={{ position: "absolute", bottom: 8, left: 8 }}>
          <div style={{
            padding: "2px 7px", borderRadius: 6,
            background: "rgba(2,6,23,0.75)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#64748B",
          }}>
            {video.modelName}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px" }}>
        {/* Prompt */}
        <div style={{ fontSize: 12, color: "#B0C0D4", lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {video.prompt || <span style={{ color: "#4E6275", fontStyle: "italic" }}>No prompt</span>}
        </div>

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: "#4E6275", marginBottom: 10 }}>{timeAgo(video.createdAt)}</div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[
            { label: "Download", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, onClick: handleDownload, disabled: !isDone },
            { label: "Reuse", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.33"/></svg>, onClick: () => onReuse(video), disabled: false },
            { label: copied ? "Copied!" : "Copy", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>, onClick: handleCopy, disabled: !video.prompt },
            { label: "Delete", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>, onClick: () => onDelete(video.id), disabled: false, danger: true },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={e => { e.stopPropagation(); if (!btn.disabled) btn.onClick(); }}
              disabled={btn.disabled}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: (btn as { danger?: boolean }).danger ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(255,255,255,0.08)",
                background: (btn as { danger?: boolean }).danger ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
                color: btn.disabled ? "#3A4F62" : (btn as { danger?: boolean }).danger ? "#EF4444" : "#B0C0D4",
                cursor: btn.disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                if (!btn.disabled) {
                  (e.currentTarget as HTMLElement).style.background = (btn as { danger?: boolean }).danger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color = (btn as { danger?: boolean }).danger ? "#F87171" : "#D8E3EE";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = (btn as { danger?: boolean }).danger ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLElement).style.color = btn.disabled ? "#3A4F62" : (btn as { danger?: boolean }).danger ? "#EF4444" : "#B0C0D4";
              }}
            >
              {btn.icon}{btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  videos: GeneratedVideo[];
  onReusePrompt: (v: GeneratedVideo) => void;
  onDelete?: (id: string) => void;
}

// ── Filter / sort types ───────────────────────────────────────────────────────

type FilterTab = "all" | "generated" | "history" | "favorites";
type SortMode  = "latest" | "oldest" | "credits";
type ShowCount = 25 | 50 | 100 | 500;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoResultsLibrary({ videos, onReusePrompt, onDelete }: Props) {
  const [filter, setFilter]     = useState<FilterTab>("all");
  const [sort, setSort]         = useState<SortMode>("latest");
  const [showCount, setShowCount] = useState<ShowCount>(25);
  const [favs, setFavs]         = useState<Set<string>>(new Set());

  function toggleFav(id: string) {
    setFavs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const now = Date.now();

  // Filter
  let filtered = videos.filter(v => {
    if (filter === "generated") return now - v.createdAt <= ONE_HOUR;
    if (filter === "history")   return now - v.createdAt > ONE_HOUR;
    if (filter === "favorites") return favs.has(v.id);
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sort === "latest")  return b.createdAt - a.createdAt;
    if (sort === "oldest")  return a.createdAt - b.createdAt;
    if (sort === "credits") return b.creditsUsed - a.creditsUsed;
    return 0;
  });

  // Cap
  filtered = filtered.slice(0, showCount);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "generated", label: "Generated" },
    { key: "history",   label: "History" },
    { key: "favorites", label: "Favorites" },
  ];

  if (videos.length === 0) {
    // Ghost shimmer cards — gallery feels alive even when empty
    const GHOST_COLS = 5;
    const GHOST_HEIGHTS = [140, 110, 155, 125, 140];
    return (
      <div>
        {/* Ghost card grid */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {Array.from({ length: GHOST_COLS }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: GHOST_HEIGHTS[i],
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.022)",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Shimmer sweep */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.045) 50%, transparent 100%)",
                animation: `ghostShimmer 2.2s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }} />
              {/* First card gets the label */}
              {i === 0 && (
                <div style={{
                  position: "relative", zIndex: 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(100,116,139,0.35)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="18" rx="3"/>
                    <path d="M9 8l7 4-7 4V8z"/>
                  </svg>
                  <span style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>
                    Your first video will appear here
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes ghostShimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          @keyframes libPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10, marginBottom: 18,
      }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
          {filterTabs.map(t => {
            const active = filter === t.key;
            const count = t.key === "all" ? videos.length
              : t.key === "generated" ? videos.filter(v => now - v.createdAt <= ONE_HOUR).length
              : t.key === "history"   ? videos.filter(v => now - v.createdAt > ONE_HOUR).length
              : videos.filter(v => favs.has(v.id)).length;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: active ? "1px solid rgba(34,211,238,0.35)" : "1px solid transparent",
                  background: active ? "rgba(14,165,160,0.12)" : "transparent",
                  color: active ? "#22D3EE" : "#7A90A8",
                  cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 5,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#B0C0D4"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#7A90A8"; }}
              >
                {t.label}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                  background: active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
                  color: active ? "#22D3EE" : "#475569",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort + Count */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Sort */}
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 2 }}>
            {(["latest", "oldest", "credits"] as SortMode[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: sort === s ? 700 : 400,
                  border: sort === s ? "1px solid rgba(34,211,238,0.3)" : "1px solid transparent",
                  background: sort === s ? "rgba(14,165,160,0.1)" : "transparent",
                  color: sort === s ? "#22D3EE" : "#64748B",
                  cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize",
                }}
              >
                {s === "latest" ? "Latest" : s === "oldest" ? "Oldest" : "Credits"}
              </button>
            ))}
          </div>

          {/* Show count */}
          <select
            value={showCount}
            onChange={e => setShowCount(Number(e.target.value) as ShowCount)}
            style={{
              padding: "5px 8px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#64748B", cursor: "pointer", outline: "none",
            }}
          >
            {([25, 50, 100, 500] as ShowCount[]).map(n => (
              <option key={n} value={n} style={{ background: "#0C1220" }}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Count line ──────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: "#4E6275", marginBottom: 14 }}>
        {filtered.length} video{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* ── Masonry grid ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: "#334155", textAlign: "center", padding: "32px 0" }}>
          No videos in this filter.
        </div>
      ) : (
        <div style={{ columns: "280px", columnGap: 16 }}>
          {filtered.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onReuse={onReusePrompt}
              onDelete={onDelete ?? (() => {})}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes libPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}
