/**
 * src/components/studio/creative-director-v2/FrameNode.tsx
 *
 * Generation Frame Node — canvas-level output/preview target.
 *
 * A blank frame is a dedicated render slot on the SceneCanvas.
 * It holds the aspect ratio constraint and, once generation runs,
 * displays the resulting image.
 *
 * States:
 *   empty  → dashed border, ✦ icon, "Generate to fill" hint
 *   filled → shows generatedImageUrl inside the frame
 *
 * Behaviour:
 *   - Draggable (parent tracks position via onDragEnd)
 *   - Selectable (click → onSelect)
 *   - Deletable (× button, always visible, dims when not hovered)
 *   - Spring entry animation via "cd-spring" keyframe (defined in globals.css)
 */

"use client";

import { useState, useRef, useCallback } from "react";
import type { GenerationFrame, FrameAspectRatio } from "@/lib/creative-director/store";

// ─── Aspect ratio → CSS ratio string ─────────────────────────────────────────
const RATIO_MAP: Record<FrameAspectRatio, string> = {
  "1:1":  "1 / 1",
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "4:5":  "4 / 5",
};

// Width of a frame node in canvas pixels
const FRAME_WIDTH = 220;

// ─── Props ────────────────────────────────────────────────────────────────────
export interface FrameNodeProps {
  frame:         GenerationFrame;
  isSelected:    boolean;
  scale:         number;           // canvas zoom scale (0–200)
  isSpring:      boolean;          // play spring entry animation?
  onSelect:      (id: string) => void;
  onDelete:      (id: string) => void;
  onDragEnd:     (id: string, pos: { x: number; y: number }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FrameNode({
  frame,
  isSelected,
  scale,
  isSpring,
  onSelect,
  onDelete,
  onDragEnd,
}: FrameNodeProps) {
  const [hovered, setHovered]     = useState(false);
  const isDragging                = useRef(false);
  const dragStart                 = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const nodeRef                   = useRef<HTMLDivElement>(null);

  // ── Drag handling ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDragging.current = true;
    dragStart.current  = {
      mx: e.clientX,
      my: e.clientY,
      px: frame.position.x,
      py: frame.position.y,
    };

    const scaleFactor = scale / 100;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.mx) / scaleFactor;
      const dy = (ev.clientY - dragStart.current.my) / scaleFactor;
      // Move the DOM node directly for perf; commit on mouseup
      if (nodeRef.current) {
        nodeRef.current.style.transform =
          `translate(${dragStart.current.px + dx}px, ${dragStart.current.py + dy}px)`;
      }
    };

    const onUp = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      isDragging.current = false;
      const dx = (ev.clientX - dragStart.current.mx) / scaleFactor;
      const dy = (ev.clientY - dragStart.current.my) / scaleFactor;
      onDragEnd(frame.id, {
        x: dragStart.current.px + dx,
        y: dragStart.current.py + dy,
      });
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [frame.id, frame.position, scale, onDragEnd]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(frame.id);
  }, [frame.id, onSelect]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(frame.id);
  }, [frame.id, onDelete]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filled      = !!frame.generatedImageUrl;
  const aspectRatio = RATIO_MAP[frame.aspectRatio];

  return (
    <div
      ref={nodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        position:     "absolute",
        top:          0,
        left:         0,
        transform:    `translate(${frame.position.x}px, ${frame.position.y}px)`,
        width:        FRAME_WIDTH,
        aspectRatio,
        cursor:       "grab",
        userSelect:   "none",
        animation:    isSpring ? "cd-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
        zIndex:       isSelected ? 20 : 10,
        // ── Outer glow / selection ring ──────────────────────────────────
        borderRadius: 12,
        boxShadow: isSelected
          ? "0 0 0 1.5px rgba(139,92,246,0.8), 0 0 20px rgba(139,92,246,0.18), 0 8px 32px rgba(0,0,0,0.4)"
          : hovered
            ? "0 0 0 1px rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.35)"
            : "0 4px 20px rgba(0,0,0,0.25)",
        transition: "box-shadow 0.18s ease",
      }}
    >
      {/* ── Frame body ──────────────────────────────────────────────────── */}
      <div
        style={{
          width:        "100%",
          height:       "100%",
          borderRadius: 12,
          overflow:     "hidden",
          position:     "relative",
          border:       filled
            ? "1px solid rgba(255,255,255,0.08)"
            : `1.5px dashed ${isSelected ? "rgba(139,92,246,0.55)" : "rgba(255,255,255,0.18)"}`,
          background:   filled
            ? "transparent"
            : "rgba(255,255,255,0.015)",
          transition:   "border-color 0.18s ease, background 0.18s ease",
        }}
      >
        {filled ? (
          /* ── Filled state ─────────────────────────────────────────────── */
          <img
            src={frame.generatedImageUrl}
            alt="Generated frame"
            draggable={false}
            style={{
              width:      "100%",
              height:     "100%",
              objectFit:  "cover",
              display:    "block",
            }}
          />
        ) : (
          /* ── Empty state ──────────────────────────────────────────────── */
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
            }}
          >
            {/* ✦ icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              style={{ opacity: isSelected ? 0.55 : 0.28, flexShrink: 0, transition: "opacity 0.18s ease" }}
            >
              <path
                d="M11 1L12.8 8.2L20 10L12.8 11.8L11 19L9.2 11.8L2 10L9.2 8.2L11 1Z"
                fill="white"
              />
            </svg>

            {/* Aspect ratio label */}
            <span
              style={{
                fontFamily:    "var(--font-syne), sans-serif",
                fontSize:       10,
                fontWeight:     600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:          "rgba(255,255,255,0.25)",
                lineHeight:     1,
              }}
            >
              {frame.aspectRatio}
            </span>

            {/* Hint */}
            <span
              style={{
                fontFamily:  "var(--font-familjen-grotesk), sans-serif",
                fontSize:     11,
                color:        "rgba(255,255,255,0.18)",
                lineHeight:   1.4,
                textAlign:    "center",
              }}
            >
              Generate to fill
            </span>
          </div>
        )}

        {/* ── Subtle inner vignette (empty state only) ─────────────────── */}
        {!filled && (
          <div
            style={{
              position:    "absolute",
              inset:       0,
              borderRadius: 11,
              background:  "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.18) 100%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* ── Delete button — always mounted, dims when not hovered ──────── */}
      <button
        onClick={handleDelete}
        title="Remove frame"
        style={{
          position:       "absolute",
          top:            -8,
          right:          -8,
          width:          22,
          height:         22,
          borderRadius:   "50%",
          border:         `1px solid ${hovered ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.12)"}`,
          background:     hovered ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.05)",
          color:          hovered ? "rgba(239,68,68,0.9)"  : "rgba(239,68,68,0.3)",
          cursor:         "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        0,
          fontSize:       13,
          lineHeight:     1,
          transition:     "all 0.15s ease",
          zIndex:         50,
        }}
      >
        ×
      </button>

      {/* ── Aspect ratio badge (top-left, subtle) ─────────────────────── */}
      <div
        style={{
          position:      "absolute",
          top:           -8,
          left:          8,
          padding:       "2px 7px",
          borderRadius:  5,
          background:    isSelected ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.06)",
          border:        `1px solid ${isSelected ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.1)"}`,
          fontFamily:    "var(--font-familjen-grotesk), sans-serif",
          fontSize:      9,
          fontWeight:    600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color:         isSelected ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.3)",
          transition:    "all 0.18s ease",
          pointerEvents: "none",
          opacity:       hovered || isSelected ? 1 : 0.6,
        }}
      >
        Frame
      </div>
    </div>
  );
}
