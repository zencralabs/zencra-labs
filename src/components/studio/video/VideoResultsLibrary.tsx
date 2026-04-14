"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, Copy, Check, Plus, RefreshCw, Globe, Trash2 } from "lucide-react";
import type { GeneratedVideo } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// VideoResultsLibrary — Bottom generated video strip
// ─────────────────────────────────────────────────────────────────────────────

interface LibraryProps {
  videos: GeneratedVideo[];
  zoom: number;
  onZoomChange: (z: number) => void;
  onExtend: (v: GeneratedVideo) => void;
  onReusePrompt: (v: GeneratedVideo) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string) => void;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── Single video card ─────────────────────────────────────────────────────────

interface CardProps {
  video: GeneratedVideo;
  zoom: number;
  onExtend: (v: GeneratedVideo) => void;
  onReusePrompt: (v: GeneratedVideo) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string) => void;
}

function VideoCard({ video, zoom, onExtend, onReusePrompt, onDelete, onTogglePublic }: CardProps) {
  const [playing, setPlaying]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [hovered, setHovered]       = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const vRef = useRef<HTMLVideoElement>(null);

  // Elapsed timer while generating
  useEffect(() => {
    if (video.status !== "generating" && video.status !== "polling") return;
    const t = setInterval(() => setElapsed(e => e + 1000), 1000);
    return () => clearInterval(t);
  }, [video.status]);

  // Stop delete confirm after 3s
  useEffect(() => {
    if (!delConfirm) return;
    const t = setTimeout(() => setDelConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [delConfirm]);

  const W = Math.round(200 * zoom);
  const H = Math.round(130 * zoom);
  const isGenerating = video.status === "generating" || video.status === "polling";
  const isDone = video.status === "done" && !!video.url;
  const isError = video.status === "error";

  function ActionBtn({ onClick, title, children, danger = false, active = false }: {
    onClick: () => void; title: string; children: React.ReactNode; danger?: boolean; active?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          width: 28, height: 28, borderRadius: 7,
          background: danger ? "rgba(239,68,68,0.1)" : active ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : active ? "rgba(14,165,160,0.3)" : "rgba(255,255,255,0.07)"}`,
          color: danger ? "#F87171" : active ? "#0EA5A0" : "#64748B",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", flexShrink: 0,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = danger ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.1)";
          el.style.color = danger ? "#FCA5A5" : "#E2E8F0";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = danger ? "rgba(239,68,68,0.1)" : active ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.05)";
          el.style.color = danger ? "#F87171" : active ? "#0EA5A0" : "#64748B";
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      style={{
        width: W, flexShrink: 0,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? "rgba(14,165,160,0.25)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14, overflow: "hidden", transition: "all 0.2s",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 12px 32px rgba(14,165,160,0.12)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail / video */}
      <div style={{ width: "100%", height: H, background: "#050A14", position: "relative", overflow: "hidden", cursor: isDone ? "pointer" : "default" }}
        onClick={() => {
          if (!isDone || !vRef.current) return;
          playing ? vRef.current.pause() : vRef.current.play();
          setPlaying(!playing);
        }}
      >
        {/* Generating shimmer */}
        {isGenerating && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(14,165,160,0.06) 50%, transparent 100%)", animation: "shimmer 2s infinite", backgroundSize: "200% 100%" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2.5px solid rgba(14,165,160,0.2)", borderTopColor: "#0EA5A0", animation: "spin .8s linear infinite" }} />
              <span style={{ fontSize: 11, color: "#475569" }}>
                {video.status === "polling" ? "Processing…" : "Generating…"}
              </span>
              <span style={{ fontSize: 10, color: "#334155" }}>{fmtMs(elapsed)}</span>
            </div>
          </>
        )}

        {/* Error state */}
        {isError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </div>
            <span style={{ fontSize: 10, color: "#EF4444", textAlign: "center", lineHeight: 1.4 }}>{video.error || "Generation failed"}</span>
          </div>
        )}

        {/* Video player */}
        {isDone && (
          <>
            <video
              ref={vRef} src={video.url!}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loop playsInline
              onEnded={() => setPlaying(false)}
            />
            {/* Play overlay */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: playing ? 0 : (hovered ? 1 : 0.6), transition: "opacity 0.2s" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(14,165,160,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                {playing
                  ? <Pause size={14} color="#fff" />
                  : <Play size={14} color="#fff" style={{ marginLeft: 2 }} />
                }
              </div>
            </div>
          </>
        )}

        {/* Corner badges */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(0,0,0,0.7)", color: "#94A3B8", padding: "2px 6px", borderRadius: 4, backdropFilter: "blur(4px)" }}>
            {video.duration}s
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(0,0,0,0.7)", color: "#64748B", padding: "2px 6px", borderRadius: 4, backdropFilter: "blur(4px)" }}>
            {video.aspectRatio}
          </span>
        </div>
        {video.isPublic && (
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(16,185,129,0.2)", color: "#10B981", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(16,185,129,0.3)" }}>PUBLIC</span>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{ padding: "10px 10px 10px" }}>
        {/* Prompt */}
        <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4, lineHeight: 1.4 }}>
          {video.prompt || <span style={{ color: "#334155", fontStyle: "italic" }}>No prompt</span>}
        </div>
        <div style={{ fontSize: 10, color: "#334155", marginBottom: 10 }}>
          {video.modelName}
        </div>

        {/* Actions row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {/* Play/Pause */}
          {isDone && (
            <ActionBtn
              onClick={() => { playing ? vRef.current?.pause() : vRef.current?.play(); setPlaying(!playing); }}
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={11} /> : <Play size={11} style={{ marginLeft: 1 }} />}
            </ActionBtn>
          )}

          {/* Download */}
          {isDone && (
            <a
              href={video.url!} download
              title="Download video"
              style={{
                width: 28, height: 28, borderRadius: 7,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#64748B",
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none", transition: "all 0.15s", flexShrink: 0,
              }}
            >
              <Download size={11} />
            </a>
          )}

          {/* Copy prompt */}
          <ActionBtn
            onClick={() => { if (video.prompt) { navigator.clipboard.writeText(video.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
            title="Copy prompt"
            active={copied}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </ActionBtn>

          {/* Reuse prompt */}
          <ActionBtn onClick={() => onReusePrompt(video)} title="Reuse prompt">
            <RefreshCw size={11} />
          </ActionBtn>

          {/* Extend (Kling only) */}
          {isDone && (
            <ActionBtn onClick={() => onExtend(video)} title="Extend video">
              <Plus size={11} />
            </ActionBtn>
          )}

          {/* Make public */}
          <ActionBtn onClick={() => onTogglePublic(video.id)} title={video.isPublic ? "Make private" : "Make public"} active={video.isPublic}>
            <Globe size={11} />
          </ActionBtn>

          {/* Delete */}
          <ActionBtn
            onClick={() => { if (delConfirm) { onDelete(video.id); } else { setDelConfirm(true); } }}
            title={delConfirm ? "Click again to confirm delete" : "Delete"}
            danger
          >
            <Trash2 size={11} />
          </ActionBtn>

          {/* Credits */}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569", fontWeight: 600 }}>
            {video.creditsUsed}cr
          </span>
        </div>

        {delConfirm && (
          <div style={{ marginTop: 6, fontSize: 10, color: "#F87171", textAlign: "center" }}>
            Click 🗑 again to confirm delete
          </div>
        )}
      </div>
    </div>
  );
}

// ── Library container ─────────────────────────────────────────────────────────

export default function VideoResultsLibrary({ videos, zoom, onZoomChange, onExtend, onReusePrompt, onDelete, onTogglePublic }: LibraryProps) {
  const pct = Math.round(zoom * 100);

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(4,9,20,0.8)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Library toolbar */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8" }}>
            Generated Videos
          </span>
          {videos.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#475569",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "1px 8px",
            }}>
              {videos.length}
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => onZoomChange(Math.max(0.5, +(zoom - 0.1).toFixed(1)))}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          >
            −
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range" min={50} max={150} value={pct}
              onChange={e => onZoomChange(+e.target.value / 100)}
              style={{ width: 90, accentColor: "#0EA5A0", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: "#94A3B8", minWidth: 38, textAlign: "right", fontWeight: 600 }}>
              {pct}%
            </span>
          </div>
          <button
            onClick={() => onZoomChange(Math.min(1.5, +(zoom + 0.1).toFixed(1)))}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          >
            +
          </button>
        </div>
      </div>

      {/* Video strip */}
      {videos.length === 0 ? (
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(14,165,160,0.08)", border: "1px solid rgba(14,165,160,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>No videos yet</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>Generated videos will appear here</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 14, padding: "14px 20px", overflowX: "auto", minHeight: 200 }}>
          {videos.map(v => (
            <VideoCard
              key={v.id} video={v} zoom={zoom}
              onExtend={onExtend}
              onReusePrompt={onReusePrompt}
              onDelete={onDelete}
              onTogglePublic={onTogglePublic}
            />
          ))}
        </div>
      )}
    </div>
  );
}
