"use client";

/**
 * DirectorPanel — bottom overlay with all cinematography controls.
 *
 * Slides up from the bottom of the center zone when directorPanelOpen === true.
 * Controls: Shot Type, Camera Angle, Lighting, Scene Energy, Lens (via LensDial).
 *
 * Each change calls onRefinementChange which:
 *   1. Patches local store (instant UI)
 *   2. Fires fire-and-forget sync to DB
 */

import { useDirectionStore }           from "@/lib/creative-director/store";
import { LensDial }                    from "./LensDial";

// ─────────────────────────────────────────────────────────────────────────────

interface DirectorPanelProps {
  onRefinementChange: (key: string, value: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

const SHOT_TYPES    = ["close", "medium", "wide", "extreme-wide", "macro", "aerial"] as const;
const CAMERA_ANGLES = ["eye-level", "low", "high", "dutch", "top-down", "worms-eye"] as const;
const LIGHTING_STYLES = ["dramatic", "soft", "golden-hour", "neon", "overcast", "studio", "practical"] as const;
const SCENE_ENERGIES = [
  { key: "static",         label: "Static",      desc: "Perfectly still" },
  { key: "walking-pose",   label: "Walking",     desc: "Mid-stride pose" },
  { key: "action-pose",    label: "Action",      desc: "Peak moment frozen" },
  { key: "dramatic-still", label: "Dramatic",    desc: "Cinematic freeze" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export function DirectorPanel({ onRefinementChange }: DirectorPanelProps) {
  const { directorPanelOpen, refinements } = useDirectionStore();

  if (!directorPanelOpen) return null;

  return (
    <div
      style={{
        position:       "absolute",
        bottom:         60,   // above PromptDock (60px)
        left:           0,
        right:          0,
        background:     "rgba(10,9,13,0.97)",
        borderTop:      "1px solid rgba(255,255,255,0.07)",
        borderRadius:   "16px 16px 0 0",
        padding:        "16px 20px",
        zIndex:         40,
        backdropFilter: "blur(20px)",
        boxShadow:      "0 -8px 40px rgba(0,0,0,0.6)",
        overflowY:      "auto",
        maxHeight:      "55%",
      }}
    >
      {/* Handle */}
      <div
        style={{
          width:        36,
          height:       3,
          borderRadius: 2,
          background:   "rgba(255,255,255,0.12)",
          margin:       "0 auto 16px",
        }}
      />

      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "auto 1fr 1fr",
          gap:                 24,
          alignItems:          "start",
        }}
      >
        {/* ── Lens Dial ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Lens</SectionLabel>
          <LensDial
            value={refinements?.lens ?? null}
            onChange={(lens) => onRefinementChange("lens", lens)}
          />
        </div>

        {/* ── Shot + Angle ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <SectionLabel>Shot Type</SectionLabel>
            <ChipGroup
              options={[...SHOT_TYPES]}
              value={refinements?.shot_type ?? null}
              onChange={(v) => onRefinementChange("shot_type", v)}
              color="rgba(59,130,246,1)"
            />
          </div>
          <div>
            <SectionLabel>Camera Angle</SectionLabel>
            <ChipGroup
              options={[...CAMERA_ANGLES]}
              value={refinements?.camera_angle ?? null}
              onChange={(v) => onRefinementChange("camera_angle", v)}
              color="rgba(34,197,94,1)"
            />
          </div>
        </div>

        {/* ── Lighting + Scene Energy ────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <SectionLabel>Lighting</SectionLabel>
            <ChipGroup
              options={[...LIGHTING_STYLES]}
              value={refinements?.lighting_style ?? null}
              onChange={(v) => onRefinementChange("lighting_style", v)}
              color="rgba(251,191,36,1)"
            />
          </div>
          <div>
            <SectionLabel>Scene Energy</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SCENE_ENERGIES.map((e) => (
                <button
                  key={e.key}
                  onClick={() => onRefinementChange("scene_energy", e.key)}
                  style={{
                    background:   refinements?.scene_energy === e.key
                      ? "rgba(139,92,246,0.12)"
                      : "rgba(255,255,255,0.02)",
                    border:       `1px solid ${refinements?.scene_energy === e.key ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 7,
                    color:        refinements?.scene_energy === e.key
                      ? "rgba(139,92,246,1)"
                      : "rgba(255,255,255,0.45)",
                    fontSize:     11,
                    fontFamily:   "var(--font-sans)",
                    cursor:       "pointer",
                    padding:      "6px 10px",
                    textAlign:    "left",
                    display:      "flex",
                    justifyContent: "space-between",
                    alignItems:   "center",
                    transition:   "all 0.15s",
                  }}
                >
                  <span>{e.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.5 }}>{e.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize:      9,
        color:         "rgba(255,255,255,0.3)",
        fontFamily:    "var(--font-sans)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin:        "0 0 8px",
      }}
    >
      {children}
    </p>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  color = "rgba(139,92,246,1)",
}: {
  options:  string[];
  value:    string | null;
  onChange: (v: string) => void;
  color?:   string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            background:   value === opt ? color.replace("1)", "0.12)") : "rgba(255,255,255,0.03)",
            border:       `1px solid ${value === opt ? color.replace("1)", "0.3)") : "rgba(255,255,255,0.07)"}`,
            borderRadius: 100,
            color:        value === opt ? color : "rgba(255,255,255,0.4)",
            fontSize:     10,
            fontFamily:   "var(--font-sans)",
            cursor:       "pointer",
            padding:      "4px 10px",
            transition:   "all 0.15s",
            whiteSpace:   "nowrap",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
