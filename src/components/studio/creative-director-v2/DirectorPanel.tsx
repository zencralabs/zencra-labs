"use client";

/**
 * DirectorPanel — premium bottom overlay with cinematography controls.
 *
 * Slides up with CSS transform transition. Visual card controls (not tiny pills).
 * Controls: Shot Type, Camera Angle, Lighting, Scene Energy, Lens (LensDial).
 *
 * Each control uses a card-style button with active glow, hover lift.
 * Scene Energy cards show icon + label + description.
 */

import { useState }           from "react";
import { useDirectionStore }  from "@/lib/creative-director/store";
import { LensDial }           from "./LensDial";

// ─────────────────────────────────────────────────────────────────────────────

interface DirectorPanelProps {
  onRefinementChange: (key: string, value: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

const SHOT_TYPES: Array<{ key: string; icon: string }> = [
  { key: "close",        icon: "◉" },
  { key: "medium",       icon: "◎" },
  { key: "wide",         icon: "⊙" },
  { key: "extreme-wide", icon: "⊛" },
  { key: "macro",        icon: "⊕" },
  { key: "aerial",       icon: "△" },
];

const CAMERA_ANGLES: Array<{ key: string; icon: string }> = [
  { key: "eye-level", icon: "—" },
  { key: "low",       icon: "↗" },
  { key: "high",      icon: "↘" },
  { key: "dutch",     icon: "↗↘" },
  { key: "top-down",  icon: "↓" },
  { key: "worms-eye", icon: "↑" },
];

const LIGHTING_STYLES: Array<{ key: string; icon: string; color: string }> = [
  { key: "dramatic",    icon: "◆", color: "rgba(239,68,68,1)"   },
  { key: "soft",        icon: "◌", color: "rgba(251,191,36,1)"  },
  { key: "golden-hour", icon: "☀", color: "rgba(251,146,60,1)"  },
  { key: "neon",        icon: "⚡", color: "rgba(139,92,246,1)"  },
  { key: "overcast",    icon: "☁", color: "rgba(148,163,184,1)" },
  { key: "studio",      icon: "◈", color: "rgba(255,255,255,0.7)" },
  { key: "practical",   icon: "⊡", color: "rgba(250,204,21,1)"  },
];

const SCENE_ENERGIES: Array<{ key: string; icon: string; label: string; desc: string }> = [
  { key: "static",         icon: "◼", label: "Static",   desc: "Perfectly still" },
  { key: "walking-pose",   icon: "⟶", label: "Walking",  desc: "Mid-stride pose" },
  { key: "action-pose",    icon: "⚡", label: "Action",   desc: "Peak moment frozen" },
  { key: "dramatic-still", icon: "◈", label: "Dramatic", desc: "Cinematic freeze" },
];

// ─────────────────────────────────────────────────────────────────────────────

export function DirectorPanel({ onRefinementChange }: DirectorPanelProps) {
  const { directorPanelOpen, refinements } = useDirectionStore();

  return (
    <div
      style={{
        position:       "absolute",
        bottom:         80,   // above PromptDock (80px)
        left:           0,
        right:          0,
        background:     "rgba(8,7,12,0.98)",
        borderTop:      "1px solid rgba(255,255,255,0.08)",
        borderRadius:   "20px 20px 0 0",
        zIndex:         40,
        backdropFilter: "blur(24px)",
        boxShadow:      "0 -12px 48px rgba(0,0,0,0.7)",
        overflowY:      "auto",
        maxHeight:      "62%",
        // Slide-up animation
        transform:      directorPanelOpen ? "translateY(0)" : "translateY(110%)",
        transition:     "transform 0.38s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents:  directorPanelOpen ? "auto" : "none",
      }}
    >
      {/* Drag handle */}
      <div style={{ padding: "14px 0 12px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
      </div>

      {/* Director Panel label */}
      <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(139,92,246,1)", boxShadow: "0 0 8px rgba(139,92,246,0.8)" }} />
        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Director Controls
        </span>
      </div>

      {/* Controls grid */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 28, padding: "0 24px 28px", alignItems: "start" }}>

        {/* ── Lens Dial ─────────────────────────────────────────────────── */}
        <LensDial
          value={refinements?.lens ?? null}
          onChange={(lens) => onRefinementChange("lens", lens)}
        />

        {/* ── Shot Type ─────────────────────────────────────────────────── */}
        <ControlGroup label="Shot Type" color="rgba(59,130,246,1)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {SHOT_TYPES.map(({ key, icon }) => (
              <ControlCard
                key={key}
                label={key}
                icon={icon}
                active={refinements?.shot_type === key}
                color="rgba(59,130,246,1)"
                onClick={() => onRefinementChange("shot_type", key)}
              />
            ))}
          </div>
        </ControlGroup>

        {/* ── Camera Angle + Lighting ────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <ControlGroup label="Camera Angle" color="rgba(34,197,94,1)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {CAMERA_ANGLES.map(({ key, icon }) => (
                <ControlCard
                  key={key}
                  label={key}
                  icon={icon}
                  active={refinements?.camera_angle === key}
                  color="rgba(34,197,94,1)"
                  onClick={() => onRefinementChange("camera_angle", key)}
                />
              ))}
            </div>
          </ControlGroup>
        </div>

        {/* ── Lighting + Scene Energy ────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <ControlGroup label="Lighting" color="rgba(251,191,36,1)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {LIGHTING_STYLES.map(({ key, icon, color }) => (
                <ControlCard
                  key={key}
                  label={key}
                  icon={icon}
                  active={refinements?.lighting_style === key}
                  color={color}
                  onClick={() => onRefinementChange("lighting_style", key)}
                />
              ))}
            </div>
          </ControlGroup>

          <ControlGroup label="Scene Energy" color="rgba(139,92,246,1)">
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {SCENE_ENERGIES.map(({ key, icon, label, desc }) => (
                <EnergyCard
                  key={key}
                  energyKey={key}
                  icon={icon}
                  label={label}
                  desc={desc}
                  active={refinements?.scene_energy === key}
                  onClick={() => onRefinementChange("scene_energy", key)}
                />
              ))}
            </div>
          </ControlGroup>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ControlGroup({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 3, height: 12, borderRadius: 2, background: color, opacity: 0.7 }} />
        <p style={{ fontSize: 9, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.09em", margin: 0 }}>
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function ControlCard({
  label, icon, active, color, onClick,
}: {
  label: string; icon: string; active: boolean; color: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const activeColor = color;
  const activeBg    = color.replace("1)", "0.12)");
  const activeBorder = color.replace("1)", "0.35)");

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:   active ? activeBg : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
        border:       `1px solid ${active ? activeBorder : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 8,
        color:        active ? activeColor : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
        cursor:       "pointer",
        padding:      "8px 8px 7px",
        display:      "flex",
        flexDirection: "column",
        alignItems:   "center",
        gap:          4,
        transition:   "all 0.15s ease",
        transform:    hov && !active ? "translateY(-1px)" : "none",
        boxShadow:    active ? `0 0 12px ${color.replace("1)", "0.2)")}` : hov ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 9, fontFamily: "var(--font-sans)", letterSpacing: "0.04em", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {label.replace("-", " ")}
      </span>
    </button>
  );
}

function EnergyCard({
  icon, label, desc, active, onClick,
}: {
  energyKey: string; icon: string; label: string; desc: string; active: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:     active ? "rgba(139,92,246,0.12)" : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
        border:         `1px solid ${active ? "rgba(139,92,246,0.35)" : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:   9,
        color:          active ? "rgba(139,92,246,1)" : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
        cursor:         "pointer",
        padding:        "9px 12px",
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        textAlign:      "left",
        transition:     "all 0.15s ease",
        transform:      hov && !active ? "translateY(-1px)" : "none",
        boxShadow:      active ? "0 0 16px rgba(139,92,246,0.2)" : hov ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: active ? 600 : 400 }}>{label}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", marginTop: 1 }}>{desc}</div>
      </div>
      {active && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(139,92,246,1)", flexShrink: 0, boxShadow: "0 0 6px rgba(139,92,246,0.8)" }} />
      )}
    </button>
  );
}

