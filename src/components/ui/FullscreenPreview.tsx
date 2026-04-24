"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FullscreenPreview — Unified full-screen media viewer
//
// Renders images OR videos in a cinematic overlay with an optional right-side
// metadata panel. ESC or backdrop click closes it.
//
// Usage (image):
//   <FullscreenPreview
//     type="image"
//     url={img.url}
//     metadata={{ prompt: img.prompt, modelName: img.modelName, ... }}
//     onClose={() => setViewing(null)}
//   />
//
// Usage (video):
//   <FullscreenPreview
//     type="video"
//     url={vid.url}
//     thumbnailUrl={vid.thumbnailUrl}
//     metadata={{ prompt: vid.prompt, modelName: vid.modelName, ... }}
//     onClose={() => setViewing(null)}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FullscreenMeta {
  prompt?:      string;
  modelName?:   string;
  aspectRatio?: string;
  createdAt?:   number;   // ms timestamp
  creditsUsed?: number;
  visibility?:  string;
  duration?:    number;   // seconds (video only)
}

export interface FullscreenPreviewProps {
  type:          "image" | "video";
  url:           string;
  thumbnailUrl?: string;          // poster for video
  metadata?:     FullscreenMeta;
  onClose:       () => void;
  /** Override z-index (default 9800) */
  zIndex?:       number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Meta row ──────────────────────────────────────────────────────────────────

function MetaRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4E6275",
        letterSpacing: "0.09em", textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: accent ? "#22D3EE" : "#CBD5F5",
        lineHeight: 1.45, wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FullscreenPreview({
  type, url, thumbnailUrl, metadata, onClose, zIndex = 9800,
}: FullscreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasMeta  = !!(metadata?.prompt || metadata?.modelName || metadata?.aspectRatio || metadata?.creditsUsed);

  // ESC closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Auto-play video
  useEffect(() => {
    if (type === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [type, url]);

  const handleBackdropClick = useCallback(() => onClose(), [onClose]);

  const PANEL_W = hasMeta ? 300 : 0;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "stretch",
      }}
    >
      {/* ── Media area ──────────────────────────────────────────────────── */}
      <div
        onClick={handleBackdropClick}
        style={{
          flex: 1, minWidth: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 32px 32px",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: "relative", lineHeight: 0 }}
        >
          {type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Full size preview"
              style={{
                display: "block",
                maxWidth: `min(${hasMeta ? "calc(100vw - 380px - 80px)" : "88vw"}, 1280px)`,
                maxHeight: "calc(100vh - 80px)",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={url}
              poster={thumbnailUrl}
              controls
              playsInline
              loop
              style={{
                display: "block",
                maxWidth: `min(${hasMeta ? "calc(100vw - 380px - 80px)" : "88vw"}, 1280px)`,
                maxHeight: "calc(100vh - 80px)",
                borderRadius: 12,
                boxShadow: "0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
                background: "#0a0f1a",
              }}
            />
          )}
        </div>
      </div>

      {/* ── Close button ─────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        title="Close (Esc)"
        style={{
          position: "fixed",
          top: 20,
          right: hasMeta ? `${PANEL_W + 16}px` : "20px",
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(10,15,30,0.92)",
          border: "1px solid rgba(255,255,255,0.16)",
          color: "#E2E8F0", fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: zIndex + 30,
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.85)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.5)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(10,15,30,0.92)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)";
        }}
      >
        ✕
      </button>

      {/* ── Right metadata panel ─────────────────────────────────────────── */}
      {hasMeta && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: PANEL_W,
            flexShrink: 0,
            background: "rgba(8,12,28,0.96)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
            padding: "64px 22px 28px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.06) transparent",
          }}
        >
          {/* Panel header */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#334155",
            letterSpacing: "0.10em", textTransform: "uppercase",
            marginBottom: 22,
          }}>
            Generation Details
          </div>

          {/* Meta rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {metadata?.prompt && (
              <MetaRow label="Prompt" value={metadata.prompt} />
            )}
            {metadata?.modelName && (
              <MetaRow label="Model" value={metadata.modelName} accent />
            )}
            {metadata?.aspectRatio && (
              <MetaRow label="Aspect Ratio" value={metadata.aspectRatio} />
            )}
            {metadata?.duration != null && (
              <MetaRow label="Duration" value={`${metadata.duration}s`} />
            )}
            {metadata?.creditsUsed != null && (
              <MetaRow label="Credits Used" value={
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  {metadata.creditsUsed}
                </span>
              } accent />
            )}
            {metadata?.createdAt != null && (
              <MetaRow label="Created" value={timeAgo(metadata.createdAt)} />
            )}
            {metadata?.visibility && (
              <MetaRow label="Visibility" value={
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 10, fontSize: 12,
                  background: metadata.visibility === "public" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.1)",
                  border: `1px solid ${metadata.visibility === "public" ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.2)"}`,
                  color: metadata.visibility === "public" ? "#34D399" : "#94A3B8",
                }}>
                  {metadata.visibility === "public" ? "🌐 Public" : "🔒 Private"}
                </span>
              } />
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "24px 0" }} />

          {/* Keyboard hint */}
          <div style={{ fontSize: 11, color: "#2D3A4A", display: "flex", alignItems: "center", gap: 6 }}>
            <kbd style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 20, borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 10, fontWeight: 700, color: "#3A4F62",
            }}>
              ESC
            </kbd>
            to close
          </div>
        </div>
      )}
    </div>
  );
}
