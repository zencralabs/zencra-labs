"use client";

/**
 * GeneratingBorderTrace
 *
 * Renders a 1px white glowing segment that travels around all 4 sides of its
 * nearest positioned ancestor — a "train trace" effect during AI generation.
 *
 * Usage (drop-in sibling pattern):
 *   Parent MUST have  position: relative | absolute | fixed
 *   No wrapper divs — just drop alongside existing children:
 *     {isGenerating && <GeneratingBorderTrace borderRadius={14} />}
 *
 * The component unmounts immediately when isGenerating becomes false,
 * so no explicit "stop" logic is needed — React handles teardown.
 *
 * Technique: SVG pathLength normalization (pathLength={1}) lets us animate
 * stroke-dashoffset from 0 → -1 for one full clockwise loop regardless of
 * the actual pixel dimensions of the container. No JS measurement needed.
 *
 * Wire-up locations:
 *   1. src/app/studio/image/page.tsx          → GeneratingPlaceholder
 *   2. src/components/studio/video/VideoCanvas.tsx → outer container
 *   3. src/app/studio/audio/page.tsx          → AudioCard generating shimmer
 *   4. src/components/studio/creative-director-v2/FrameNode.tsx → outerRef div
 */

import React, { useId } from "react";

// ── Keyframes (global, registered once) ───────────────────────────────────────
// All instances share this name — the animation definition is identical so
// duplicate @keyframes blocks in the DOM are harmless.
const KEYFRAMES = `
@keyframes zbTrace {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -1; }
}
`;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GeneratingBorderTraceProps {
  /**
   * Border radius in pixels — must match the parent container's border-radius
   * so the trace follows the rounded corners correctly.
   * Pass 0 for sharp corners (Image Studio, Video Canvas).
   * @default 0
   */
  borderRadius?: number;
  /**
   * Duration of one full loop in seconds.
   * Lower = faster. Sweet spot: 2–3s for premium cinematic feel.
   * @default 2.5
   */
  speed?: number;
  /**
   * Stroke color of the sharp 1px trace segment.
   * @default "rgba(255,255,255,0.85)"
   */
  color?: string;
  /**
   * Fraction of the perimeter covered by the glowing segment (0–1).
   * 0.18 = 18% of perimeter — a tight train-light feel.
   * @default 0.18
   */
  segmentLength?: number;
  /**
   * zIndex of the SVG layer.
   * Should sit above the content but below interactive overlays.
   * @default 20
   */
  zIndex?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GeneratingBorderTrace({
  borderRadius   = 0,
  speed          = 2.5,
  color          = "rgba(255,255,255,0.85)",
  segmentLength  = 0.18,
  zIndex         = 20,
}: GeneratingBorderTraceProps) {
  // Unique ID per instance — prevents SVG filter ID collisions when multiple
  // cards are generating simultaneously (e.g. batch Image Studio generations).
  const uid       = useId().replace(/:/g, "_");
  const filterId  = `zbg_${uid}`;
  const duration  = `${speed}s`;
  const gap       = +(1 - segmentLength).toFixed(4);

  return (
    <>
      {/* Keyframes are identical across instances — safe to repeat in DOM */}
      <style>{KEYFRAMES}</style>

      <svg
        aria-hidden="true"
        focusable="false"
        style={{
          position:      "absolute",
          inset:         0,
          width:         "100%",
          height:        "100%",
          pointerEvents: "none",
          zIndex,
          // overflow: visible so the 0.5px outer half of the stroke shows
          // when the parent has overflow: hidden — it gets naturally clipped
          // at the container edge, keeping the visual crisp.
          overflow:      "visible",
        }}
      >
        <defs>
          {/* Soft glow halo — larger stdDeviation = wider, softer bloom */}
          <filter
            id={filterId}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="3.5" result="blur" />
          </filter>
        </defs>

        {/* ── Layer 1: Wide glow halo (semi-transparent, blurred) ──────────── */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.18}
          pathLength={1}
          strokeDasharray={`${segmentLength} ${gap}`}
          filter={`url(#${filterId})`}
          style={{
            animation: `zbTrace ${duration} linear infinite`,
          }}
        />

        {/* ── Layer 2: Sharp 1px crisp trace ───────────────────────────────── */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={1}
          pathLength={1}
          strokeDasharray={`${segmentLength} ${gap}`}
          style={{
            animation: `zbTrace ${duration} linear infinite`,
          }}
        />
      </svg>
    </>
  );
}
