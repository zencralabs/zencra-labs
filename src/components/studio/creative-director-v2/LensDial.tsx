"use client";

/**
 * LensDial — circular SVG rotary selector for camera lens (focal length).
 *
 * Values: 24mm, 35mm, 50mm, 85mm, 135mm
 * Each lens is a tick mark on the dial arc.
 * Selected lens glows with the purple accent.
 * User can click a tick or drag the selector handle.
 */

import { useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────

const LENSES = ["24mm", "35mm", "50mm", "85mm", "135mm"] as const;
type Lens = (typeof LENSES)[number];

interface LensDialProps {
  value:    Lens | string | null;
  onChange: (lens: Lens) => void;
}

// Arc goes from 210° to 330° (120° sweep, bottom-center arc)
const START_ANGLE = 210;
const END_ANGLE   = 330;
const SWEEP        = END_ANGLE - START_ANGLE;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// ─────────────────────────────────────────────────────────────────────────────

export function LensDial({ value, onChange }: LensDialProps) {
  const CX = 60;
  const CY = 60;
  const R  = 46;

  const ticks = LENSES.map((lens, i) => {
    const frac = i / (LENSES.length - 1);
    const deg  = START_ANGLE + frac * SWEEP;
    const rad  = degToRad(deg);
    const isActive = lens === value;
    return {
      lens,
      deg,
      rad,
      x:  CX + R * Math.cos(rad),
      y:  CY + R * Math.sin(rad),
      isActive,
    };
  });

  const activeTick = ticks.find((t) => t.isActive);

  const handleClick = useCallback(
    (lens: Lens) => {
      onChange(lens);
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg
        width={120}
        height={120}
        viewBox="0 0 120 120"
        style={{ overflow: "visible" }}
      >
        {/* Background arc */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1.5}
          strokeDasharray={`${(SWEEP / 360) * 2 * Math.PI * R} ${2 * Math.PI * R}`}
          strokeDashoffset={-((START_ANGLE / 360) * 2 * Math.PI * R)}
          strokeLinecap="round"
        />

        {/* Active arc segment */}
        {activeTick && (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="rgba(139,92,246,0.4)"
            strokeWidth={1.5}
            strokeDasharray={`${((activeTick.deg - START_ANGLE) / 360) * 2 * Math.PI * R} ${2 * Math.PI * R}`}
            strokeDashoffset={-((START_ANGLE / 360) * 2 * Math.PI * R)}
            strokeLinecap="round"
          />
        )}

        {/* Tick marks */}
        {ticks.map(({ lens, x, y, isActive }) => (
          <g
            key={lens}
            onClick={() => handleClick(lens as Lens)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={y}
              r={isActive ? 7 : 5}
              fill={isActive ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)"}
              stroke={isActive ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.12)"}
              strokeWidth={1}
            />
            {isActive && (
              <circle
                cx={x}
                cy={y}
                r={3}
                fill="rgba(139,92,246,1)"
              />
            )}
          </g>
        ))}

        {/* Center display */}
        <text
          x={CX}
          y={CY - 5}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={13}
          fontFamily="var(--font-display)"
        >
          {value ?? "—"}
        </text>
        <text
          x={CX}
          y={CY + 11}
          textAnchor="middle"
          fill="rgba(255,255,255,0.25)"
          fontSize={9}
          fontFamily="var(--font-sans)"
        >
          LENS
        </text>
      </svg>

      {/* Lens label row */}
      <div style={{ display: "flex", gap: 4 }}>
        {LENSES.map((lens) => (
          <button
            key={lens}
            onClick={() => handleClick(lens)}
            style={{
              background:   lens === value ? "rgba(139,92,246,0.15)" : "transparent",
              border:       `1px solid ${lens === value ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 4,
              color:        lens === value ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.3)",
              fontSize:     9,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              padding:      "3px 5px",
              transition:   "all 0.15s",
            }}
          >
            {lens}
          </button>
        ))}
      </div>
    </div>
  );
}
