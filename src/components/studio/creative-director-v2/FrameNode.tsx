/**
 * src/components/studio/creative-director-v2/FrameNode.tsx
 *
 * Generation Frame Node — premium canvas-level output/preview target.
 *
 * Visual structure (outer → inner):
 *   [outer]  absolute-positioned; controls position + selection glow + resize handles
 *     [shell]  glass gradient background, cinematic border, overflow:hidden
 *       [header]  30px bar — ✦ icon, "Generation Frame" label, AR badge, delete btn
 *       [body]    fills remaining height — empty OR filled state
 *
 * Resize handles (4 corners on outer, outside shell):
 *   SE (↘) NE (↗)  — right-side handles: only width changes
 *   SW (↙) NW (↖)  — left-side handles: width + position.x both change
 *   All handles maintain aspect ratio (height derived from width).
 *   Min width 140px, max 520px. Scale-aware: canvasDx = screenDx / (scale/100).
 *
 * States:
 *   empty  → subtle glass fill, ✦ icon, "Generate to fill" hint
 *   filled → generatedImageUrl rendered as cover image in body
 *
 * Behaviour:
 *   - Draggable via header (onDragEnd)
 *   - Resizable via 4 corner handles (onResize)
 *   - Selectable (click → onSelect)
 *   - Deletable (× in header)
 *   - Spring entry animation via "cd-spring" keyframe (globals.css)
 */

"use client";

import { useState, useRef, useCallback } from "react";
import type { GenerationFrame, FrameAspectRatio } from "@/lib/creative-director/store";

// ─── Constants ────────────────────────────────────────────────────────────────
/** Default canvas-pixel width for a newly created frame. */
export const DEFAULT_FRAME_WIDTH = 220;
const MIN_FRAME_WIDTH            = 140;
const MAX_FRAME_WIDTH            = 520;
/** Pixel height of the frame header bar (used by SceneCanvas for handle geometry). */
export const FRAME_HEADER_HEIGHT = 30;
const HEADER_HEIGHT              = FRAME_HEADER_HEIGHT;   // internal alias
const HANDLE_SIZE                = 12;   // hit-area of each corner handle

// ─── Aspect ratio helpers ──────────────────────────────────────────────────────
/** Numeric width/height ratios for each aspect ratio key (width ÷ height). */
export const FRAME_RATIO_VALUES: Record<FrameAspectRatio, number> = {
  "1:1":  1,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:5":  4 / 5,
};

const RATIO_MAP: Record<FrameAspectRatio, string> = {
  "1:1":  "1 / 1",
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "4:5":  "4 / 5",
};

// Parse "W:H" → ratio number (width/height)
function parseRatio(ar: FrameAspectRatio): number {
  const [w, h] = ar.split(":").map(Number);
  return w / h;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface FrameNodeProps {
  frame:              GenerationFrame;
  isSelected:         boolean;
  scale:              number;                      // canvas zoom (0–200)
  isSpring:           boolean;
  pendingConnActive:  boolean;                     // true while a node→frame connection is being dragged
  onboardingSuccess?:       boolean;               // Phase 1: subject dropped into frame
  onboardingPhase2Complete?: boolean;              // Phase 2: system finished wiring all nodes → frame
  onSelect:           (id: string) => void;
  onDelete:           (id: string) => void;
  onDragEnd:          (id: string, pos: { x: number; y: number }) => void;
  onResize:           (id: string, width: number, pos?: { x: number; y: number }) => void;
}

// ─── Corner handle types ───────────────────────────────────────────────────────
type Corner = "se" | "ne" | "sw" | "nw";

// ─── Onboarding keyframes ──────────────────────────────────────────────────────
/** Phase 1 — user dropped subject into frame: stronger scale pop */
const FRAME_SUCCESS_KEYFRAME = `
@keyframes cd-ob-frame-scale {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}
`;

/** Phase 2 — system completed scene build: softer, more sustained glow */
const FRAME_P2_KEYFRAME = `
@keyframes cd-ob-frame-p2 {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.015); }
  100% { transform: scale(1); }
}
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function FrameNode({
  frame,
  isSelected,
  scale,
  isSpring,
  pendingConnActive,
  onboardingSuccess,
  onboardingPhase2Complete,
  onSelect,
  onDelete,
  onDragEnd,
  onResize,
}: FrameNodeProps) {
  const [hovered,       setHovered]       = useState(false);
  const [resizeCorner,  setResizeCorner]  = useState<Corner | null>(null);
  const outerRef                          = useRef<HTMLDivElement>(null);

  const frameWidth = frame.width ?? DEFAULT_FRAME_WIDTH;
  const ratio      = parseRatio(frame.aspectRatio);
  const bodyHeight = frameWidth / ratio;

  // ── Drag (on header) ───────────────────────────────────────────────────────
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const scaleFactor = scale / 100;
    const startMx = e.clientX;
    const startMy = e.clientY;
    const startPx = frame.position.x;
    const startPy = frame.position.y;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startMx) / scaleFactor;
      const dy = (ev.clientY - startMy) / scaleFactor;
      if (outerRef.current) {
        outerRef.current.style.transform =
          `translate(${startPx + dx}px, ${startPy + dy}px)`;
      }
    };

    const onUp = (ev: MouseEvent) => {
      const dx = (ev.clientX - startMx) / scaleFactor;
      const dy = (ev.clientY - startMy) / scaleFactor;
      onDragEnd(frame.id, { x: startPx + dx, y: startPy + dy });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [frame.id, frame.position, scale, onDragEnd]);

  // ── Resize (corner handles) — center-scale: frame expands from its center ──
  const handleResizeMouseDown = useCallback((
    e:      React.MouseEvent,
    corner: Corner,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setResizeCorner(corner);

    const scaleFactor = scale / 100;
    const startMx     = e.clientX;
    const startW      = frameWidth;
    const startPx     = frame.position.x;
    const startPy     = frame.position.y;
    const arRatio     = parseRatio(frame.aspectRatio); // captured once; AR never changes mid-resize

    // Left-side corners grow when dragged left; right-side when dragged right.
    const isLeft = corner === "sw" || corner === "nw";

    const compute = (ev: MouseEvent) => {
      const screenDx = ev.clientX - startMx;
      const canvasDx = screenDx / scaleFactor;
      const rawWidth = isLeft ? startW - canvasDx : startW + canvasDx;
      const newWidth = Math.max(MIN_FRAME_WIDTH, Math.min(MAX_FRAME_WIDTH, rawWidth));
      const deltaW   = newWidth - startW;
      // Height change follows from locked aspect ratio (body only, header is fixed)
      const deltaH   = deltaW / arRatio;
      return {
        newWidth,
        newX: startPx - deltaW / 2,
        newY: startPy - deltaH / 2,
      };
    };

    const onMove = (ev: MouseEvent) => {
      const { newWidth, newX, newY } = compute(ev);
      if (outerRef.current) {
        outerRef.current.style.width     = `${newWidth}px`;
        outerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };

    const onUp = (ev: MouseEvent) => {
      const { newWidth, newX, newY } = compute(ev);
      onResize(frame.id, newWidth, { x: newX, y: newY });
      setResizeCorner(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [frame.id, frame.position, frame.aspectRatio, frameWidth, scale, onResize]);

  // ── Click (select) ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(frame.id);
  }, [frame.id, onSelect]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(frame.id);
  }, [frame.id, onDelete]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filled     = !!frame.generatedImageUrl;
  const isResizing = resizeCorner !== null;

  // ── Outer shadow / selection ring ──────────────────────────────────────────
  // Phase 1 success: bright ring + strong glow (user action)
  // Phase 2 complete: softer ring + extended glow (system action — different feel)
  // Selection: standard purple. Default: depth only.
  const outerGlow = onboardingSuccess
    ? "0 0 0 1px rgba(139,92,246,0.9), 0 0 60px rgba(139,92,246,0.50)"
    : onboardingPhase2Complete
      ? "0 0 0 1px rgba(139,92,246,0.55), 0 0 80px rgba(139,92,246,0.28)"
      : isSelected
        ? "0 0 0 1px rgba(139,92,246,0.6), 0 0 40px rgba(139,92,246,0.25)"
        : "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(255,255,255,0.02)";

  // Shell border: always ultra-subtle white; purple only when selected
  const shellBorder = isSelected
    ? "1px solid rgba(139,92,246,0.35)"
    : "1px solid rgba(255,255,255,0.08)";

  // ── Corner handle render helper ────────────────────────────────────────────
  const renderHandle = (corner: Corner) => {
    const isL = corner === "sw" || corner === "nw";
    const isT = corner === "nw" || corner === "ne";
    const active = resizeCorner === corner;
    const cursorMap: Record<Corner, string> = {
      se: "se-resize", ne: "ne-resize", sw: "sw-resize", nw: "nw-resize",
    };

    return (
      <div
        key={corner}
        onMouseDown={(e) => handleResizeMouseDown(e, corner)}
        style={{
          position:   "absolute",
          [isT ? "top" : "bottom"]: -(HANDLE_SIZE / 2),
          [isL ? "left" : "right"]: -(HANDLE_SIZE / 2),
          width:      HANDLE_SIZE,
          height:     HANDLE_SIZE,
          borderRadius: "50%",
          background: active
            ? "rgba(139,92,246,0.9)"
            : (hovered || isSelected)
              ? "rgba(139,92,246,0.65)"
              : "rgba(255,255,255,0.18)",
          border:     `1px solid ${active ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.25)"}`,
          cursor:     cursorMap[corner],
          transition: "background 0.15s ease, border-color 0.15s ease",
          zIndex:     60,
          backdropFilter: "blur(4px)",
        }}
      />
    );
  };

  return (
    <>
    {onboardingSuccess        && <style>{FRAME_SUCCESS_KEYFRAME}</style>}
    {onboardingPhase2Complete && <style>{FRAME_P2_KEYFRAME}</style>}
    <div
      ref={outerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        position:   "absolute",
        top:        0,
        left:       0,
        // transform controls position — keep it clear of the spring animation
        transform:  `translate(${frame.position.x}px, ${frame.position.y}px)`,
        width:      frameWidth,
        // NOTE: animation is intentionally NOT here — it would override translate and
        // cause the frame to flash to (0,0) on first render. Animation lives on the
        // glass shell div instead so only the visual shell scales in.
        zIndex:     isSelected ? 20 : 10,
        userSelect: "none",
        cursor:     isResizing ? "none" : "default",
        boxShadow:  outerGlow,
        borderRadius: 12,
        transition: isResizing ? "none" : "box-shadow 0.18s ease",
      }}
    >
      {/* ── Input connection handle — rendered inside outerRef so it follows during drag ─ */}
      {/* Drop detection in SceneCanvas is distance-based; this dot is purely visual.        */}
      <div
        style={{
          position:     "absolute",
          left:         -7,
          top:          FRAME_HEADER_HEIGHT + bodyHeight / 2 - 7,
          width:        14,
          height:       14,
          borderRadius: "50%",
          background:   pendingConnActive
            ? "rgba(255,255,255,0.25)"
            : "rgba(255,255,255,0.08)",
          border:       pendingConnActive
            ? "1.5px solid rgba(255,255,255,0.55)"
            : "1.5px solid rgba(255,255,255,0.2)",
          boxShadow:    pendingConnActive ? "0 0 8px rgba(255,255,255,0.2)" : "none",
          zIndex:       22,
          pointerEvents: "none",
          transition:   "all 0.2s ease",
        }}
      />

      {/* ── Glass shell — spring + onboarding success animation live here, not on outer ─── */}
      <div
        style={{
          width:        "100%",
          borderRadius: 12,
          overflow:     "hidden",
          border:       shellBorder,
          background:   "#000000",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          // Animation priority: Phase 1 success > Phase 2 complete > spring entry
          // All live on the shell (not outer) to avoid translate conflict on outer div
          animation:    onboardingSuccess
            ? "cd-ob-frame-scale 0.6s ease-out both"
            : onboardingPhase2Complete
              ? "cd-ob-frame-p2 0.7s ease-in-out both"
              : isSpring ? "cd-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
          transition:   isResizing ? "none" : "border-color 0.18s ease, background 0.18s ease",
        }}
      >
        {/* ── Header bar ───────────────────────────────────────────────────── */}
        <div
          onMouseDown={handleHeaderMouseDown}
          style={{
            height:         HEADER_HEIGHT,
            display:        "flex",
            alignItems:     "center",
            gap:            6,
            padding:        "0 10px",
            cursor:         "grab",
            userSelect:     "none",
            borderBottom:   "1px solid rgba(255,255,255,0.06)",
            background:     "rgba(255,255,255,0.025)",
            flexShrink:     0,
          }}
        >
          {/* ✦ icon */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 22 22"
            fill="none"
            style={{ opacity: 0.35, flexShrink: 0 }}
          >
            <path
              d="M11 1L12.8 8.2L20 10L12.8 11.8L11 19L9.2 11.8L2 10L9.2 8.2L11 1Z"
              fill="rgba(255,255,255,1)"
            />
          </svg>

          {/* "Generation Frame" label */}
          <span
            style={{
              fontFamily:    "var(--font-syne), sans-serif",
              fontSize:       9,
              fontWeight:     600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:          isSelected ? "rgba(139,92,246,0.85)" : "rgba(255,255,255,0.38)",
              flex:           1,
              lineHeight:     1,
              transition:     "color 0.18s ease",
            }}
          >
            Generation Frame
          </span>

          {/* AR badge */}
          <span
            style={{
              fontFamily:    "var(--font-familjen-grotesk), sans-serif",
              fontSize:       8,
              fontWeight:     600,
              letterSpacing: "0.08em",
              padding:        "2px 5px",
              borderRadius:   4,
              background:     isSelected ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.06)",
              border:         `1px solid ${isSelected ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.1)"}`,
              color:          isSelected ? "rgba(139,92,246,0.85)" : "rgba(255,255,255,0.35)",
              lineHeight:     1.2,
              flexShrink:     0,
              transition:     "all 0.18s ease",
            }}
          >
            {frame.aspectRatio}
          </span>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            title="Remove frame"
            style={{
              width:          18,
              height:         18,
              borderRadius:   "50%",
              border:         `1px solid ${hovered ? "rgba(239,68,68,0.45)" : "rgba(239,68,68,0.15)"}`,
              background:     hovered ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.06)",
              color:          hovered ? "rgba(239,68,68,0.95)"  : "rgba(239,68,68,0.35)",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              padding:        0,
              fontSize:       12,
              lineHeight:     1,
              flexShrink:     0,
              transition:     "all 0.15s ease",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            width:       "100%",
            height:      bodyHeight,
            position:    "relative",
            overflow:    "hidden",
          }}
        >
          {filled ? (
            /* ── Filled state ───────────────────────────────────────────────── */
            <img
              src={frame.generatedImageUrl}
              alt="Generated frame"
              draggable={false}
              style={{
                width:     "100%",
                height:    "100%",
                objectFit: "cover",
                display:   "block",
              }}
            />
          ) : (
            /* ── Empty state ────────────────────────────────────────────────── */
            <>
              {/* Subtle depth overlay — no colour, no glow */}
              <div
                style={{
                  position:      "absolute",
                  inset:         0,
                  background:    "linear-gradient(160deg, rgba(255,255,255,0.012) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />

              {/* Content */}
              <div
                style={{
                  width:           "100%",
                  height:          "100%",
                  display:         "flex",
                  flexDirection:   "column",
                  alignItems:      "center",
                  justifyContent:  "center",
                  gap:             10,
                  padding:         "16px 12px",
                  position:        "relative",
                }}
              >
                {/* ✦ center indicator — toned down, not a glow */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 22 22"
                  fill="none"
                  style={{
                    opacity:    0.4,
                    filter:     "blur(0.5px)",
                    flexShrink: 0,
                  }}
                >
                  <path
                    d="M11 1L12.8 8.2L20 10L12.8 11.8L11 19L9.2 11.8L2 10L9.2 8.2L11 1Z"
                    fill="rgba(255,255,255,1)"
                  />
                </svg>

                {/* Render-target copy */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      fontFamily:    "var(--font-syne), sans-serif",
                      fontSize:       12,
                      fontWeight:     500,
                      letterSpacing: "0.04em",
                      color:          "rgba(255,255,255,0.35)",
                      lineHeight:     1,
                      textAlign:      "center",
                    }}
                  >
                    Ready to render
                  </span>
                  <span
                    style={{
                      fontFamily:    "var(--font-familjen-grotesk), sans-serif",
                      fontSize:       10,
                      letterSpacing: "0.04em",
                      color:          "rgba(255,255,255,0.18)",
                      lineHeight:     1.4,
                      textAlign:      "center",
                    }}
                  >
                    Connect nodes + prompt
                  </span>
                </div>
              </div>

              {/* Subtle vignette */}
              <div
                style={{
                  position:      "absolute",
                  inset:         0,
                  background:    "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.2) 100%)",
                  pointerEvents: "none",
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* ── 4 corner resize handles (on outer, outside shell) ──────────────── */}
      {(hovered || isSelected || isResizing) && (
        <>
          {renderHandle("se")}
          {renderHandle("ne")}
          {renderHandle("sw")}
          {renderHandle("nw")}
        </>
      )}
    </div>
    </>
  );
}
