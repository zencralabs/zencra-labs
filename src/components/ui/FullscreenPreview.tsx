"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FullscreenPreview — Unified full-screen media viewer
//
// Renders images OR videos in a cinematic overlay with an optional right-side
// metadata panel. ESC or backdrop click closes it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FullscreenMeta {
  prompt?:       string;
  modelName?:    string;
  /** Muted provider attribution — shown as "Zencra Render Engine" not raw brand */
  provider?:     string;
  aspectRatio?:  string;
  resolution?:   string;    // e.g. "1024×1024" or "1080p"
  quality?:      string;    // e.g. "High", "Standard", "Pro"
  createdAt?:    number;    // ms timestamp
  creditsUsed?:  number;
  visibility?:   string;    // "public" | "private"
  duration?:     number;    // seconds (video only)
  // Project context
  projectId?:    string;
  projectName?:  string;
  // Source studio label
  sourceStudio?: string;    // "Image Studio" | "Creative Director" | "Upload"
}

export interface FullscreenPreviewProps {
  type:             "image" | "video";
  url:              string;
  thumbnailUrl?:    string;          // poster for video
  metadata?:        FullscreenMeta;
  onClose:          () => void;
  /** Opens Move to Project selector from parent; if undefined shows disabled pill */
  onMoveToProject?: () => void;
  /** Override z-index (default 9800) */
  zIndex?:          number;
  /**
   * Width in px of an external right-side panel that overlays the viewport
   * (e.g. the Image Studio premium action panel at z:9020).
   * When set, the media area is constrained to `100vw - rightPanelWidth` so
   * the image centres in the available left space and never hides behind the panel.
   * Defaults to 0 (full-width media area, unchanged behaviour for Video/CD/Dashboard).
   */
  rightPanelWidth?: number;
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

function MetaRow({ label, value, accent, muted }: {
  label:   string;
  value:   React.ReactNode;
  accent?: boolean;
  muted?:  boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4E6275",
        letterSpacing: "0.09em", textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: muted ? "#334155" : accent ? "#22D3EE" : "#CBD5F5",
        lineHeight: 1.45, wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Settings block — aspect ratio + resolution + quality grouped ──────────────

function SettingsGroup({ aspectRatio, resolution, quality }: {
  aspectRatio?: string;
  resolution?:  string;
  quality?:     string;
}) {
  const rows: { label: string; val: string }[] = [];
  if (aspectRatio) rows.push({ label: "Aspect ratio", val: aspectRatio });
  if (resolution)  rows.push({ label: "Resolution",   val: resolution });
  if (quality)     rows.push({ label: "Quality",       val: quality });
  if (rows.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4E6275",
        letterSpacing: "0.09em", textTransform: "uppercase",
      }}>
        Settings
      </div>
      <div style={{
        background: "rgba(255,255,255,0.03)", borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 10px",
        display: "flex", flexDirection: "column", gap: 5,
      }}>
        {rows.map(({ label, val }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12,
          }}>
            <span style={{ color: "#4E6275", fontWeight: 500 }}>{label}</span>
            <span style={{ color: "#94A3B8", fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Project row ───────────────────────────────────────────────────────────────

function ProjectRow({ projectId, projectName, onMoveToProject }: {
  projectId?:       string;
  projectName?:     string;
  onMoveToProject?: () => void;
}) {
  // Asset is in a project — show clickable breadcrumb
  if (projectId && projectName) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "#4E6275",
          letterSpacing: "0.09em", textTransform: "uppercase",
        }}>
          Project
        </div>
        <a
          href={`/dashboard/project/${projectId}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 13, fontWeight: 500, color: "#60A5FA",
            textDecoration: "none", transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#93C5FD")}
          onMouseLeave={e => (e.currentTarget.style.color = "#60A5FA")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          {projectName}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.5 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </a>
      </div>
    );
  }

  // Asset not yet in a project
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4E6275",
        letterSpacing: "0.09em", textTransform: "uppercase",
      }}>
        Project
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
          Not linked to a project
        </span>
        {onMoveToProject ? (
          <button
            onClick={onMoveToProject}
            style={{
              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(37,99,235,0.28)",
              color: "#60A5FA", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.22)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.12)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.28)";
            }}
          >
            Move to Project
          </button>
        ) : (
          <span
            title="Use gallery actions to move to a project"
            style={{
              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#334155", cursor: "default",
            }}
          >
            Move to Project
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FullscreenPreview({
  type, url, thumbnailUrl, metadata, onClose, onMoveToProject, zIndex = 12000,
  rightPanelWidth = 0,
}: FullscreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Panel visible when ANY meaningful field has data
  const hasMeta = !!(
    metadata?.prompt     || metadata?.modelName   || metadata?.aspectRatio  ||
    metadata?.creditsUsed != null || metadata?.resolution || metadata?.quality ||
    metadata?.projectId !== undefined || metadata?.sourceStudio || metadata?.visibility
  );

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

  // ── Layout geometry ────────────────────────────────────────────────────────
  // The external right panel (Image Studio 360px, z:9020) is a separate fixed
  // element — NOT a flex sibling. We calculate the available left width
  // explicitly so the image centres in the visible area, never behind the panel.
  //
  // When rightPanelWidth > 0:
  //   leftW  = calc(100vw - rightPanelWidth)   — full available left area
  //   padding on the media wrapper gives 48px breathing room on all 4 sides
  //   image  maxWidth: 90%  maxHeight: calc(100vh - 120px)  — ~10% smaller
  //
  // When panel closed:
  //   leftW  = 100vw — full viewport
  //   image  maxWidth: min(100vw, 1280px)  maxHeight: calc(100vh - 96px)
  //
  // Close button sits INSIDE the image at top:10 right:10 (no transform).
  // No overflow-clip on wrapper → button is always fully visible + clickable.
  const panelWidth = rightPanelWidth || 0;
  const panelOpen  = panelWidth > 0;

  // Left centering zone — takes all space left of the external right panel
  const leftW = panelOpen ? `calc(100vw - ${panelWidth}px)` : "100vw";

  // Inner padding creates visible black breathing room around the image
  const mediaPad = panelOpen ? "48px" : "32px";

  // Image constraints — explicit (never %) to avoid circular inline-block dependency
  const imgMaxW = panelOpen ? "90%" : "min(100%, 1280px)";
  const imgMaxH = panelOpen ? "calc(100vh - 120px)" : "calc(100vh - 96px)";

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0,
        // Issue 2 — overlay is highest z-index on the page; nothing can intercept clicks above it
        zIndex,
        background: "rgba(5,5,9,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "stretch",
      }}
    >
      {/* ── Left centering zone ──────────────────────────────────────────── */}
      {/* Explicit width = leftW so image never slides behind the right panel */}
      <div
        onClick={handleBackdropClick}
        style={{
          width: leftW,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          // Padding provides visible black breathing room on all 4 sides.
          // box-sizing: border-box keeps total width = leftW (no overflow).
          padding: mediaPad,
          boxSizing: "border-box",
        }}
      >
        {/* inline-block: shrinks to image rendered size → button follows corner */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative",
            display: "inline-block",
            lineHeight: 0,  // removes phantom whitespace gap below img
            // NO overflow:hidden — close button must be fully visible at corner
          }}
        >
          {type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Full size preview"
              style={{
                display: "block",
                maxWidth: imgMaxW,
                maxHeight: imgMaxH,
                objectFit: "contain",
                borderRadius: 0,
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
                maxWidth: imgMaxW,
                maxHeight: imgMaxH,
                borderRadius: 0,
                boxShadow: "0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
                background: "#0a0f1a",
              }}
            />
          )}

          {/* ── Close button ────────────────────────────────────────────────
              Issue 2 fix:
              - position:absolute, top:10 right:10 — INSIDE the image, never
                outside the wrapper so no transform-overflow or clip issues.
              - NO transform — safe across all aspect ratios and panel states.
              - zIndex: 12010 (above overlay root at 12000) — guaranteed on top.
              - pointerEvents: "auto" — always receives clicks regardless of
                any parent pointer-events rule.
              Issue 3: onClose from page.tsx already calls handleCloseFullscreen
              which clears viewingImage + selectedImage, removes fullscreen-active
              class, and restores body scroll. No extra logic needed here.
          ─────────────────────────────────────────────────────────────────── */}
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              position: "absolute",
              top: 10, right: 10,
              transform: "none",
              width: 34, height: 34,
              borderRadius: "50%",
              background: "rgba(8,12,26,0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(224,232,255,0.80)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 12010,
              pointerEvents: "auto",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,60,60,0.9)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,100,100,0.4)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(8,12,26,0.92)";
              (e.currentTarget as HTMLElement).style.color = "rgba(224,232,255,0.80)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

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

          {/* Meta rows — ordered by importance */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {metadata?.prompt && (
              <MetaRow label="Prompt" value={metadata.prompt} />
            )}

            {metadata?.modelName && (
              <MetaRow label="Model" value={metadata.modelName} accent />
            )}

            {/* Provider — always muted, internal-facing only */}
            {metadata?.provider && (
              <MetaRow label="Provider" value={metadata.provider} muted />
            )}

            {/* Settings — aspect ratio + resolution + quality grouped */}
            <SettingsGroup
              aspectRatio={metadata?.aspectRatio}
              resolution={metadata?.resolution}
              quality={metadata?.quality}
            />

            {/* Duration (video only) */}
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

            {/* Project breadcrumb — always rendered (shows "Not linked" fallback) */}
            <ProjectRow
              projectId={metadata?.projectId}
              projectName={metadata?.projectName}
              onMoveToProject={onMoveToProject}
            />

            {metadata?.sourceStudio && (
              <MetaRow label="Source" value={metadata.sourceStudio} muted />
            )}

            {metadata?.createdAt != null && (
              <MetaRow label="Created" value={timeAgo(metadata.createdAt)} />
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
