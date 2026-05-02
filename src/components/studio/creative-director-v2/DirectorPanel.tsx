"use client";

/**
 * DirectorPanel — premium bottom overlay with cinematography + character controls.
 *
 * Slides up from bottom. Position: absolute, bottom = bottomOffset prop
 * (handle 36px + dock 124px = 160px from CDv2Shell).
 *
 * Two sections:
 *   1. Director Controls — Shot Type, Camera Angle, Lighting, Scene Energy, Lens
 *   2. Character Direction — face/body/pose/lock controls (collapsible)
 *
 * Character Direction writes to store.characterDirection (local, not DB).
 * Director Controls write to direction_refinements via onRefinementChange.
 */

import { useState }           from "react";
import { useDirectionStore }  from "@/lib/creative-director/store";
import { LensDial }           from "./LensDial";

// ─────────────────────────────────────────────────────────────────────────────

interface DirectorPanelProps {
  onRefinementChange: (key: string, value: unknown) => void;
  bottomOffset:       number;
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

// Character Direction option sets
const FACE_EXPRESSIONS = [
  { key: "neutral",    label: "Neutral"    },
  { key: "smile",      label: "Smile"      },
  { key: "serious",    label: "Serious"    },
  { key: "angry",      label: "Angry"      },
  { key: "surprised",  label: "Surprised"  },
  { key: "emotional",  label: "Emotional"  },
] as const;

const BODY_VIEWS = [
  { key: "front",         label: "Front"      },
  { key: "left-profile",  label: "Left"       },
  { key: "right-profile", label: "Right"      },
  { key: "back",          label: "Back"       },
  { key: "three-quarter", label: "3/4"        },
] as const;

const HEAD_DIRECTIONS = [
  { key: "left",    label: "← Left"   },
  { key: "right",   label: "Right →"  },
  { key: "up",      label: "↑ Up"     },
  { key: "down",    label: "↓ Down"   },
  { key: "forward", label: "⊙ Fwd"   },
] as const;

const EYE_DIRECTIONS = [
  { key: "left",   label: "← Left"  },
  { key: "right",  label: "Right →" },
  { key: "up",     label: "↑ Up"    },
  { key: "down",   label: "↓ Down"  },
  { key: "camera", label: "⊙ Cam"  },
] as const;

const POSE_ACTIONS = [
  { key: "standing", label: "Standing" },
  { key: "walking",  label: "Walking"  },
  { key: "running",  label: "Running"  },
  { key: "jumping",  label: "Jumping"  },
  { key: "driving",  label: "Driving"  },
  { key: "sitting",  label: "Sitting"  },
] as const;

const HANDS_LEGS = [
  { key: "natural-hands",  label: "Natural" },
  { key: "visible-hands",  label: "Hands"   },
  { key: "full-body",      label: "Full"    },
  { key: "dynamic-legs",   label: "Dynamic" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export function DirectorPanel({ onRefinementChange, bottomOffset }: DirectorPanelProps) {
  const {
    directorPanelOpen,
    refinements,
    characterDirection,
    patchCharacterDirection,
    resetCharacterDirection,
  } = useDirectionStore();

  const [charOpen, setCharOpen] = useState(true);

  return (
    <div
      style={{
        position:       "absolute",
        bottom:         bottomOffset,
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
        // translateY(200%) guarantees the panel top edge moves below the
        // container's bottom boundary for any realistic container height,
        // so overflow:hidden on the center column clips it completely.
        // 110% was insufficient — left ~120–150px of panel peeking through.
        transform:      directorPanelOpen ? "translateY(0)" : "translateY(200%)",
        transition:     "transform 0.38s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents:  directorPanelOpen ? "auto" : "none",
        scrollbarWidth: "none",
      }}
    >
      {/* Drag handle */}
      <div style={{ padding: "14px 0 12px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
      </div>

      {/* ── Section 1: Director Controls ─────────────────────────────────── */}
      <div style={{ padding: "0 24px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(139,92,246,1)", boxShadow: "0 0 8px rgba(139,92,246,0.8)" }} />
        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Director Controls
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 28, padding: "12px 24px 24px", alignItems: "start" }}>

        {/* Lens Dial */}
        <LensDial
          value={refinements?.lens ?? null}
          onChange={(lens) => onRefinementChange("lens", lens)}
        />

        {/* Shot Type */}
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

        {/* Camera Angle */}
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

        {/* Lighting + Scene Energy */}
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

      {/* ── Section divider ───────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 24px" }} />

      {/* ── Section 2: Character Direction ───────────────────────────────── */}
      <div style={{ padding: "0 24px 24px" }}>
        {/* Section header — collapsible */}
        <button
          onClick={() => setCharOpen((o) => !o)}
          style={{
            background:    "none",
            border:        "none",
            cursor:        "pointer",
            padding:       "14px 0 12px",
            display:       "flex",
            alignItems:    "center",
            gap:           8,
            width:         "100%",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(251,146,60,1)", boxShadow: "0 0 8px rgba(251,146,60,0.7)" }} />
          <span style={{ fontSize: 11, fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
            Character Direction
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{charOpen ? "▼" : "▲"}</span>
          {/* Reset button */}
          {charOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); resetCharacterDirection(); }}
              style={{
                background:    "rgba(255,255,255,0.05)",
                border:        "1px solid rgba(255,255,255,0.1)",
                borderRadius:  6,
                color:         "rgba(255,255,255,0.35)",
                fontSize:      9,
                fontFamily:    "var(--font-sans)",
                cursor:        "pointer",
                padding:       "2px 8px",
                letterSpacing: "0.05em",
                transition:    "all 0.15s ease",
              }}
            >
              Reset
            </button>
          )}
        </button>

        {charOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

            {/* Column 1: Face + Locks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ControlGroup label="Face Expression" color="rgba(251,146,60,1)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {FACE_EXPRESSIONS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.faceExpression === key}
                      color="rgba(251,146,60,1)"
                      onClick={() => patchCharacterDirection({
                        faceExpression: characterDirection.faceExpression === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Consistency Locks" color="rgba(251,191,36,1)">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <LockToggle
                    label="Hairstyle Lock"
                    desc="Keep hair consistent"
                    active={characterDirection.hairstyleLock}
                    onClick={() => patchCharacterDirection({ hairstyleLock: !characterDirection.hairstyleLock })}
                  />
                  <LockToggle
                    label="Outfit Lock"
                    desc="Keep outfit consistent"
                    active={characterDirection.outfitLock}
                    onClick={() => patchCharacterDirection({ outfitLock: !characterDirection.outfitLock })}
                  />
                </div>
              </ControlGroup>
            </div>

            {/* Column 2: Body View + Head + Eye */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ControlGroup label="Body View" color="rgba(59,130,246,1)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {BODY_VIEWS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.bodyView === key}
                      color="rgba(59,130,246,1)"
                      onClick={() => patchCharacterDirection({
                        bodyView: characterDirection.bodyView === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Head Direction" color="rgba(34,197,94,1)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {HEAD_DIRECTIONS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.headDirection === key}
                      color="rgba(34,197,94,1)"
                      onClick={() => patchCharacterDirection({
                        headDirection: characterDirection.headDirection === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Eye Direction" color="rgba(139,92,246,1)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {EYE_DIRECTIONS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.eyeDirection === key}
                      color="rgba(139,92,246,1)"
                      onClick={() => patchCharacterDirection({
                        eyeDirection: characterDirection.eyeDirection === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>
            </div>

            {/* Column 3: Pose + Hands/Legs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ControlGroup label="Pose / Action" color="rgba(239,68,68,1)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {POSE_ACTIONS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.poseAction === key}
                      color="rgba(239,68,68,1)"
                      onClick={() => patchCharacterDirection({
                        poseAction: characterDirection.poseAction === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Hands / Legs" color="rgba(148,163,184,1)">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {HANDS_LEGS.map(({ key, label }) => (
                    <ControlCard
                      key={key}
                      label={label}
                      icon=""
                      active={characterDirection.handsLegs === key}
                      color="rgba(148,163,184,1)"
                      onClick={() => patchCharacterDirection({
                        handsLegs: characterDirection.handsLegs === key ? null : key,
                      })}
                    />
                  ))}
                </div>
              </ControlGroup>
            </div>
          </div>
        )}
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
        <p style={{ fontSize: 10, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
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
  const activeBg     = color.replace("1)", "0.12)");
  const activeBorder = color.replace("1)", "0.35)");

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    active ? activeBg : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
        border:        `1px solid ${active ? activeBorder : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:  8,
        color:         active ? color : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
        cursor:        "pointer",
        padding:       icon ? "8px 8px 7px" : "7px 8px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           icon ? 4 : 0,
        transition:    "all 0.15s ease",
        transform:     hov && !active ? "translateY(-1px)" : "none",
        boxShadow:     active ? `0 0 12px ${color.replace("1)", "0.2)")}` : hov ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
      }}
    >
      {icon && <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>}
      <span style={{ fontSize: 13, fontFamily: "var(--font-sans)", letterSpacing: "0.02em", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {label.replace(/-/g, " ")}
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
        background:   active ? "rgba(139,92,246,0.12)" : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
        border:       `1px solid ${active ? "rgba(139,92,246,0.35)" : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 9,
        color:        active ? "rgba(139,92,246,1)" : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
        cursor:       "pointer",
        padding:      "9px 12px",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        textAlign:    "left",
        transition:   "all 0.15s ease",
        transform:    hov && !active ? "translateY(-1px)" : "none",
        boxShadow:    active ? "0 0 16px rgba(139,92,246,0.2)" : hov ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: active ? 600 : 400 }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{desc}</div>
      </div>
      {active && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(139,92,246,1)", flexShrink: 0, boxShadow: "0 0 6px rgba(139,92,246,0.8)" }} />
      )}
    </button>
  );
}

function LockToggle({
  label, desc, active, onClick,
}: {
  label: string; desc: string; active: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:   active ? "rgba(251,191,36,0.1)" : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
        border:       `1px solid ${active ? "rgba(251,191,36,0.35)" : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 9,
        cursor:       "pointer",
        padding:      "8px 12px",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        textAlign:    "left",
        transition:   "all 0.15s ease",
        transform:    hov && !active ? "translateY(-1px)" : "none",
        boxShadow:    active ? "0 0 12px rgba(251,191,36,0.15)" : "none",
      }}
    >
      {/* Lock icon */}
      <span style={{ fontSize: 13, flexShrink: 0, color: active ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.3)" }}>
        {active ? "🔒" : "○"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontFamily: "var(--font-sans)", color: active ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.6)", fontWeight: active ? 600 : 400 }}>{label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{desc}</div>
      </div>
      {/* Toggle visual */}
      <div style={{
        width:        34,
        height:       18,
        borderRadius: 100,
        background:   active ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.07)",
        border:       `1px solid ${active ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.12)"}`,
        position:     "relative",
        flexShrink:   0,
        transition:   "background 0.2s ease",
      }}>
        <div style={{
          position:   "absolute",
          top:        2,
          left:       active ? 16 : 2,
          width:      12,
          height:     12,
          borderRadius: "50%",
          background: active ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.3)",
          transition: "left 0.22s cubic-bezier(0.16,1,0.3,1), background 0.2s ease",
          boxShadow:  active ? "0 0 6px rgba(251,191,36,0.8)" : "none",
        }} />
      </div>
    </button>
  );
}
