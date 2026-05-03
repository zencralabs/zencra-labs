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
const DEFAULT_FRAME_WIDTH = 220;
const MIN_FRAME_WIDTH     = 140;
const MAX_FRAME_WIDTH     = 520;
const HEADER_HEIGHT       = 30;
const HANDLE_SIZE         = 12;   // hit-area of each corner handle

// ─── Aspect ratio helpers ──────────────────────────────────────────────────────
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
  frame:      GenerationFrame;
  isSelected: boolean;
  scale:      number;                              // canvas zoom (0–200)
  isSpring:   boolean;
  onSelect:   (id: string) => void;
  onDelete:   (id: string) => void;
  onDragEnd:  (id: string, pos: { x: number; y: number }) => void;
  onResize:   (id: string, width: number, pos?: { x: number; y: number }) => void;
}

// ─── Corner handle types ───────────────────────────────────────────────────────
type Corner = "se" | "ne" | "sw" | "nw";

// ─── Component ────────────────────────────────────────────────────────────────
export function FrameNode({
  frame,
  isSelected,
  scale,
  isSpring,
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

  // ── Resize (corner handles) ────────────────────────────────────────────────
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

    const isLeft = corner === "sw" || corner === "nw";

    const onMove = (ev: MouseEvent) => {
      const screenDx   = ev.clientX - startMx;
      const canvasDx   = screenDx / scaleFactor;
      const rawWidth   = isLeft ? startW - canvasDx : startW + canvasDx;
      const newWidth   = Math.max(MIN_FRAME_WIDTH, Math.min(MAX_FRAME_WIDTH, rawWidth));

      if (outerRef.current) {
        outerRef.current.style.width = `${newWidth}px`;
        if (isLeft) {
          const actualDelta = startW - newWidth;
          outerRef.current.style.transform =
            `translate(${startPx + actualDelta}px, ${frame.position.y}px)`;
        }
      }
    };

    const onUp = (ev: MouseEvent) => {
      const screenDx   = ev.clientX - startMx;
      const canvasDx   = screenDx / scaleFactor;
      const rawWidth   = isLeft ? startW - canvasDx : startW + canvasDx;
      const newWidth   = Math.max(MIN_FRAME_WIDTH, Math.min(MAX_FRAME_WIDTH, rawWidth));

      if (isLeft) {
        const actualDelta = startW - newWidth;
        onResize(frame.id, newWidth, { x: startPx + actualDelta, y: frame.position.y });
      } else {
        onResize(frame.id, newWidth);
      }

      setResizeCorner(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [frame.id, frame.position, frameWidth, scale, onResize]);

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

  // ── Glow / border colours ─────────────────────────────────────────────────
  const outerGlow = isSelected
    ? "0 0 0 1.5px rgba(139,92,246,0.85), 0 0 28px rgba(139,92,246,0.22), 0 12px 40px rgba(0,0,0,0.45)"
    : hovered
      ? "0 0 0 1px rgba(139,92,246,0.35), 0 8px 32px rgba(0,0,0,0.35)"
      : "0 4px 20px rgba(0,0,0,0.28)";

  const shellBorder = isSelected
    ? "1px solid rgba(139,92,246,0.5)"
    : hovered
      ? "1px solid rgba(139,92,246,0.28)"
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
    <div
      ref={outerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        position:   "absolute",
        top:        0,
        left:       0,
        transform:  `translate(${frame.position.x}px, ${frame.position.y}px)`,
        width:      frameWidth,
        animation:  isSpring ? "cd-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
        zIndex:     isSelected ? 20 : 10,
        userSelect: "none",
        cursor:     isResizing ? "none" : "default",
        boxShadow:  outerGlow,
        borderRadius: 12,
        transition: isResizing ? "none" : "box-shadow 0.18s ease",
      }}
    >
      {/* ── Glass shell ────────────────────────────────────────────────────── */}
      <div
        style={{
          width:        "100%",
          borderRadius: 12,
          overflow:     "hidden",
          border:       shellBorder,
          background:   filled
            ? "rgba(12,10,20,0.92)"
            : "linear-gradient(160deg, rgba(28,22,48,0.92) 0%, rgba(14,11,26,0.96) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
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
            borderBottom:   "1px solid rgba(139,92,246,0.12)",
            background:     isSelected
              ? "rgba(139,92,246,0.08)"
              : "rgba(255,255,255,0.03)",
            flexShrink:     0,
          }}
        >
          {/* ✦ icon */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 22 22"
            fill="none"
            style={{ opacity: isSelected ? 0.75 : 0.4, flexShrink: 0 }}
          >
            <path
              d="M11 1L12.8 8.2L20 10L12.8 11.8L11 19L9.2 11.8L2 10L9.2 8.2L11 1Z"
              fill="rgba(139,92,246,1)"
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
              color:          isSelected ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.45)",
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
              {/* Glass shimmer overlay */}
              <div
                style={{
                  position:   "absolute",
                  inset:      0,
                  background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 50%, rgba(139,92,246,0.04) 100%)",
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
                {/* ✦ large icon */}
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 22 22"
                  fill="none"
                  style={{ opacity: isSelected ? 0.45 : 0.2, flexShrink: 0, transition: "opacity 0.18s ease" }}
                >
                  <path
                    d="M11 1L12.8 8.2L20 10L12.8 11.8L11 19L9.2 11.8L2 10L9.2 8.2L11 1Z"
                    fill="rgba(139,92,246,1)"
                  />
                </svg>

                {/* Hint */}
                <span
                  style={{
                    fontFamily:  "var(--font-familjen-grotesk), sans-serif",
                    fontSize:     11,
                    color:        "rgba(255,255,255,0.2)",
                    lineHeight:   1.4,
                    textAlign:    "center",
                  }}
                >
                  Generate to fill
                </span>
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
  );
}
