"use client";

/**
 * LensDial — 160px premium circular SVG rotary lens selector.
 *
 * Outer decorative ring, bold center readout (font-display), arc glow on active.
 * Tick marks with active bloom. Bottom label row for quick-click access.
 */

import { useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────

const LENSES = ["24mm", "35mm", "50mm", "85mm", "135mm"] as const;
type Lens = (typeof LENSES)[number];

interface LensDialProps {
  value:    Lens | string | null;
  onChange: (lens: Lens) => void;
}

const START_ANGLE = 210;
const END_ANGLE   = 330;
const SWEEP        = END_ANGLE - START_ANGLE;

function degToRad(deg: number) { return (deg * Math.PI) / 180; }

// ─────────────────────────────────────────────────────────────────────────────

export function LensDial({ value, onChange }: LensDialProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const CX = 80; const CY = 80; const R = 58; const OUTER_R = 70;

  const ticks = LENSES.map((lens, i) => {
    const frac     = i / (LENSES.length - 1);
    const deg      = START_ANGLE + frac * SWEEP;
    const rad      = degToRad(deg);
    const isActive = lens === value;
    const isHov    = lens === hovered;
    return {
      lens, deg, rad, isActive, isHov,
      x: CX + R * Math.cos(rad),
      y: CY + R * Math.sin(rad),
      // Inner tick point
      xi: CX + (R - 10) * Math.cos(rad),
      yi: CY + (R - 10) * Math.sin(rad),
    };
  });

  const activeIdx    = LENSES.indexOf(value as Lens);
  const activeFrac   = activeIdx >= 0 ? activeIdx / (LENSES.length - 1) : 0;
  const activeArcLen = activeFrac * SWEEP;
  const fullCirc     = 2 * Math.PI * R;
  const dashLen      = (activeArcLen / 360) * fullCirc;
  const dashOffset   = -((START_ANGLE / 360) * fullCirc);

  const handleClick = useCallback((lens: Lens) => { onChange(lens); }, [onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Dial label */}
      <p style={{
        fontSize: 9, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.25)",
        textTransform: "uppercase", letterSpacing: "0.1em", margin: 0,
      }}>
        Focal Length
      </p>

      <svg width={160} height={160} viewBox="0 0 160 160" style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id="lens-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(139,92,246,0.04)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0)" />
          </radialGradient>
        </defs>

        {/* Outer decorative ring */}
        <circle cx={CX} cy={CY} r={OUTER_R}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="3 5" />

        {/* Background arc track */}
        <circle cx={CX} cy={CY} r={R} fill="url(#lens-bg)" stroke="rgba(255,255,255,0.07)" strokeWidth={2}
          strokeDasharray={`${(SWEEP / 360) * fullCirc} ${fullCirc}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round" fillOpacity={0} />

        {/* Active arc fill */}
        {activeIdx >= 0 && (
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="rgba(139,92,246,0.55)" strokeWidth={2}
            strokeDasharray={`${dashLen} ${fullCirc}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.35s ease" }}
          />
        )}

        {/* Tick marks + nodes */}
        {ticks.map(({ lens, x, y, xi, yi, isActive, isHov }) => (
          <g key={lens} onClick={() => handleClick(lens as Lens)}
             onMouseEnter={() => setHovered(lens)} onMouseLeave={() => setHovered(null)}
             style={{ cursor: "pointer" }}>
            {/* Tick line */}
            <line x1={xi} y1={yi} x2={x} y2={y}
              stroke={isActive ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.15)"}
              strokeWidth={isActive ? 2 : 1} strokeLinecap="round" />

            {/* Node circle */}
            <circle cx={x} cy={y} r={isActive ? 9 : isHov ? 8 : 6}
              fill={isActive ? "rgba(139,92,246,0.2)" : isHov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"}
              stroke={isActive ? "rgba(139,92,246,0.9)" : isHov ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}
              strokeWidth={1.5}
              style={{ transition: "r 0.15s ease, fill 0.15s ease, stroke 0.15s ease" }}
            />

            {/* Active center dot */}
            {isActive && <circle cx={x} cy={y} r={3.5} fill="rgba(139,92,246,1)" />}

            {/* Active glow ring */}
            {isActive && (
              <circle cx={x} cy={y} r={12} fill="none"
                stroke="rgba(139,92,246,0.2)" strokeWidth={4} />
            )}
          </g>
        ))}

        {/* Center readout */}
        <text x={CX} y={CY - 8} textAnchor="middle"
          fill="rgba(255,255,255,0.85)" fontSize={18} fontFamily="var(--font-display)" fontWeight="600">
          {value ?? "—"}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle"
          fill="rgba(255,255,255,0.2)" fontSize={9} fontFamily="var(--font-sans)" letterSpacing="0.1em">
          LENS
        </text>

        {/* Center decorative dot */}
        <circle cx={CX} cy={CY} r={3}
          fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.5)" strokeWidth={1} />
      </svg>

      {/* Quick-click label row */}
      <div style={{ display: "flex", gap: 5 }}>
        {LENSES.map((lens) => (
          <button key={lens} onClick={() => handleClick(lens)}
            style={{
              background:   lens === value ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
              border:       `1px solid ${lens === value ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6,
              color:        lens === value ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.3)",
              fontSize:     10,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              padding:      "4px 8px",
              transition:   "all 0.15s ease",
            }}>
            {lens}
          </button>
        ))}
      </div>
    </div>
  );
}
