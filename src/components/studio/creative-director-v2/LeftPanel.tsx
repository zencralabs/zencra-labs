"use client";

/**
 * LeftPanel — Scene assist panel for Creative Director v2.
 *
 * Sections (top → bottom):
 *   1. Scene Intent    — freetext name / description of the scene
 *   2. Add to Scene    — role-typed element quick-add (44px min-height buttons)
 *   3. Style Mood      — premium chip presets → direction_refinements
 *   4. Identity Lock   — premium toggle switch (48×26) → refinements.identity_lock
 *   5. Advanced        — collapsible: tone intensity
 *
 * Collapse:
 *   Expanded: 280px, all sections visible.
 *   Collapsed: 56px, icon-only rail with 5 nav icons + right-side tooltips.
 *   Parent (CDv2Shell) controls the grid column width; this component
 *   signals collapse state changes via onCollapsedChange.
 */

import { useState, useCallback }          from "react";
import { useDirectionStore, STYLE_MOOD_PRESETS } from "@/lib/creative-director/store";
import type { DirectionElementType }      from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface LeftPanelProps {
  onAddElement:      (type: DirectionElementType, label: string) => void;
  onEnsureDirection: () => Promise<string | null>;
  isCollapsed:       boolean;   // controlled by CDv2Shell — no internal state
}

const ROLE_BUTTONS: Array<{
  type:        DirectionElementType;
  label:       string;
  color:       string;
  shape:       "circle";
  placeholder: string;
}> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)",  shape: "circle", placeholder: "e.g. a dancer mid-leap" },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)",   shape: "circle", placeholder: "e.g. neon-lit Tokyo alley" },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)",  shape: "circle", placeholder: "e.g. moody fog, 3am energy" },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)",  shape: "circle", placeholder: "e.g. chrome motorcycle" },
];

// 5 rail icons for the collapsed state — one per section
const RAIL_ICONS = [
  { icon: "✦", label: "Scene Intent",  color: "rgba(139,92,246,0.5)" },
  { icon: "＋", label: "Add to Scene", color: "rgba(139,92,246,0.5)" },
  { icon: "◈", label: "Style Mood",    color: "rgba(139,92,246,0.5)" },
  { icon: "⬡", label: "Identity Lock", color: "rgba(251,191,36,0.5)" },
  { icon: "▸", label: "Advanced",      color: "rgba(255,255,255,0.3)" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export function LeftPanel({ onAddElement, onEnsureDirection, isCollapsed }: LeftPanelProps) {
  const {
    sceneIntent,
    activeStyleMood,
    refinements,
    setSceneIntentText,
    setStyleMood,
    patchRefinements,
  } = useDirectionStore();

  const [activeRole,   setActiveRole]   = useState<DirectionElementType | null>(null);
  const [roleInput,    setRoleInput]    = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleIntentChange = useCallback(
    async (val: string) => {
      setSceneIntentText(val);
      if (val.trim().length > 2) await onEnsureDirection();
    },
    [setSceneIntentText, onEnsureDirection]
  );

  const commitRoleInput = useCallback(() => {
    if (!activeRole || !roleInput.trim()) return;
    onAddElement(activeRole, roleInput.trim());
    setRoleInput("");
    setActiveRole(null);
  }, [activeRole, roleInput, onAddElement]);

  const identityLock = refinements?.identity_lock === true;

  // ── Collapsed: 56px icon rail ─────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div
        style={{
          height:          "100%",
          display:         "flex",
          flexDirection:   "column",
          background:      "rgba(10,12,20,0.75)",
          backdropFilter:  "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          borderRight:     "1px solid rgba(120,160,255,0.18)",
          overflow:        "visible", // allow tooltips to escape into canvas column
          position:        "relative",
          zIndex:          10,
        }}
      >
        {/* Thin spacer at top (toggle lives in CDv2Shell now) */}
        <div style={{ height: 10, flexShrink: 0 }} />

        {/* Thin divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 10px 6px" }} />

        {/* Nav icons */}
        {RAIL_ICONS.map((item) => (
          <NavRailIcon key={item.label} icon={item.icon} label={item.label} color={item.color} />
        ))}
      </div>
    );
  }

  // ── Expanded: full panel ──────────────────────────────────────────────────
  return (
    <div
      style={{
        height:               "100%",
        overflowY:            "auto",
        background:           "rgba(10,12,20,0.75)",
        backdropFilter:       "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderRight:          "1px solid rgba(120,160,255,0.18)",
        display:              "flex",
        flexDirection:        "column",
        gap:                  0,
        scrollbarWidth:       "none",
      }}
    >
      {/* Top spacer (toggle lives in CDv2Shell now) */}
      <div style={{ height: 8, flexShrink: 0 }} />

      {/* ── Scene Intent ────────────────────────────────────────────────── */}
      <Section label="Scene Intent" symbol="✦">
        <textarea
          value={sceneIntent.text}
          onChange={(e) => void handleIntentChange(e.target.value)}
          placeholder="Describe the scene, mood, or story in your own words…"
          rows={3}
          style={{
            width:        "100%",
            background:   "rgba(255,255,255,0.03)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            color:        "#E8ECF5",
            fontSize:     14,
            fontFamily:   "var(--font-sans)",
            lineHeight:   1.6,
            padding:      "10px 12px",
            resize:       "none",
            outline:      "none",
            boxSizing:    "border-box",
            transition:   "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(139,92,246,0.4)";
            e.target.style.boxShadow   = "0 0 0 3px rgba(139,92,246,0.07)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,0.08)";
            e.target.style.boxShadow   = "none";
          }}
        />
      </Section>

      <Divider />

      {/* ── Add to Scene ────────────────────────────────────────────────── */}
      <Section label="Add to Scene" symbol="＋">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ROLE_BUTTONS.map((r) => (
            <div key={r.type}>
              <RoleButton
                r={r}
                active={activeRole === r.type}
                onClick={() => {
                  setActiveRole(activeRole === r.type ? null : r.type);
                  setRoleInput("");
                }}
              />

              {activeRole === r.type && (
                <div style={{ display: "flex", gap: 6, marginTop: 5, paddingLeft: 2 }}>
                  <input
                    autoFocus
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")  commitRoleInput();
                      if (e.key === "Escape") { setActiveRole(null); setRoleInput(""); }
                    }}
                    placeholder={r.placeholder}
                    style={{
                      flex:         1,
                      background:   "rgba(255,255,255,0.04)",
                      border:       `1px solid ${r.color.replace("1)", "0.35)")}`,
                      borderRadius: 8,
                      color:        "#E8ECF5",
                      fontSize:     14,
                      fontFamily:   "var(--font-sans)",
                      padding:      "8px 12px",
                      outline:      "none",
                      boxShadow:    `0 0 0 2px ${r.color.replace("1)", "0.06)")}`,
                    }}
                  />
                  <button
                    onClick={commitRoleInput}
                    disabled={!roleInput.trim()}
                    style={{
                      background:   roleInput.trim() ? r.color.replace("1)", "0.18)") : "rgba(255,255,255,0.03)",
                      border:       `1px solid ${roleInput.trim() ? r.color.replace("1)", "0.4)") : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 8,
                      color:        roleInput.trim() ? r.color : "rgba(255,255,255,0.25)",
                      fontSize:     12,
                      fontFamily:   "var(--font-sans)",
                      fontWeight:   600,
                      cursor:       roleInput.trim() ? "pointer" : "not-allowed",
                      padding:      "8px 14px",
                      transition:   "all 0.15s ease",
                      whiteSpace:   "nowrap",
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── Style Mood ──────────────────────────────────────────────────── */}
      <Section label="Style Mood" symbol="◈">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STYLE_MOOD_PRESETS.map((p) => (
            <MoodChip
              key={p.key}
              label={p.label}
              active={activeStyleMood === p.key}
              onClick={() => setStyleMood(activeStyleMood === p.key ? null : p.key)}
            />
          ))}
        </div>

        {activeStyleMood && (
          <div style={{
            marginTop:    8,
            padding:      "8px 10px",
            background:   "rgba(139,92,246,0.06)",
            border:       "1px solid rgba(139,92,246,0.15)",
            borderRadius: 8,
          }}>
            <p style={{
              fontSize:   10,
              color:      "rgba(139,92,246,0.7)",
              fontFamily: "var(--font-sans)",
              margin:     0,
              lineHeight: 1.5,
            }}>
              {STYLE_MOOD_PRESETS.find(p => p.key === activeStyleMood)?.color_palette} palette
              {" · "}
              {STYLE_MOOD_PRESETS.find(p => p.key === activeStyleMood)?.lighting_style} lighting
            </p>
          </div>
        )}
      </Section>

      <Divider />

      {/* ── Identity Lock ───────────────────────────────────────────────── */}
      <Section label="Identity Lock" symbol="⬡">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize:   13,
              color:      "#E6EBFF",
              fontFamily: "var(--font-sans)",
              margin:     0,
              fontWeight: 600,
            }}>
              Lock character identity
            </p>
            <p style={{
              fontSize:   11,
              color:      "#AEB7D0",
              fontFamily: "var(--font-sans)",
              margin:     "3px 0 0",
              lineHeight: 1.4,
            }}>
              Enforce facial consistency across outputs
            </p>
          </div>
          <ToggleSwitch
            active={identityLock}
            onChange={(v) => patchRefinements({ identity_lock: v } as Parameters<typeof patchRefinements>[0])}
            color="rgba(251,191,36,1)"
          />
        </div>
      </Section>

      <Divider />

      {/* ── Advanced (collapsible) ───────────────────────────────────────── */}
      <button
        onClick={() => setAdvancedOpen((o) => !o)}
        style={{
          background:    "none",
          border:        "none",
          color:         "#AEB7D0",
          fontSize:      13,
          fontFamily:    "var(--font-sans)",
          fontWeight:    600,
          cursor:        "pointer",
          padding:       "12px 16px",
          textAlign:     "left",
          display:       "flex",
          alignItems:    "center",
          gap:           7,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          transition:    "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#E6EBFF")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#AEB7D0")}
      >
        <span style={{ fontSize: 8, opacity: 0.6 }}>{advancedOpen ? "▾" : "▸"}</span>
        Advanced
      </button>

      {advancedOpen && (
        <div style={{ padding: "0 16px 20px" }}>
          <label style={{
            display:       "block",
            fontSize:      10,
            color:         "#AEB7D0",
            fontFamily:    "var(--font-sans)",
            marginBottom:  8,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            Tone Intensity — {refinements?.tone_intensity ?? 50}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={refinements?.tone_intensity ?? 50}
            onChange={(e) => patchRefinements({ tone_intensity: Number(e.target.value) } as Parameters<typeof patchRefinements>[0])}
            style={{ width: "100%", accentColor: "rgba(139,92,246,1)", marginBottom: 4 }}
          />
          <div style={{
            display:        "flex",
            justifyContent: "space-between",
            fontSize:       9,
            color:          "#AEB7D0",
            fontFamily:     "var(--font-sans)",
          }}>
            <span>Minimal</span>
            <span>Ultra Dramatic</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsed rail sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NavRailIcon({ icon, label, color }: { icon: string; label: string; color: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        style={{
          width:          56,
          height:         46,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          cursor:         "default",
          background:     hov ? "rgba(255,255,255,0.04)" : "transparent",
          transition:     "background 0.15s ease",
        }}
      >
        <span style={{
          fontSize:   15,
          color:      hov ? "rgba(255,255,255,0.75)" : color,
          transition: "color 0.15s ease",
          lineHeight: 1,
        }}>
          {icon}
        </span>
      </div>

      {/* Right-side tooltip */}
      {hov && (
        <div
          style={{
            position:      "absolute",
            left:          60,
            top:           "50%",
            transform:     "translateY(-50%)",
            background:    "rgba(10,10,16,0.96)",
            border:        "1px solid rgba(255,255,255,0.1)",
            borderRadius:  6,
            padding:       "5px 11px",
            whiteSpace:    "nowrap",
            fontSize:      11,
            color:         "rgba(255,255,255,0.8)",
            fontFamily:    "var(--font-sans)",
            letterSpacing: "0.02em",
            zIndex:        50,
            pointerEvents: "none",
            boxShadow:     "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Chevron collapse / expand button */
function ChevronBtn({
  direction,
  onToggle,
  tooltip,
}: {
  direction: "left" | "right";
  onToggle:  () => void;
  tooltip:   string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      title={tooltip}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:        28,
        height:       28,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        background:   hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border:       `1px solid ${hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 7,
        cursor:       "pointer",
        flexShrink:   0,
        transition:   "all 0.15s ease",
        padding:      0,
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ transform: direction === "right" ? "rotate(180deg)" : "none" }}
      >
        <path
          d="M6.5 2L3.5 5L6.5 8"
          stroke={hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)"}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Section({ label, symbol, children }: { label: string; symbol: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 16px 14px" }}>
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          7,
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 12, color: "rgba(139,92,246,0.75)", lineHeight: 1 }}>{symbol}</span>
        <p style={{
          fontSize:      13,
          color:         "#AEB7D0",
          fontFamily:    "var(--font-sans)",
          fontWeight:    600,
          margin:        0,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{
      height:     1,
      background: "rgba(255,255,255,0.04)",
      margin:     "0 16px",
      flexShrink: 0,
    }} />
  );
}

function RoleIcon({ color, active, hov }: { shape: "circle"; color: string; active: boolean; hov: boolean }) {
  const opacity  = active ? 1 : hov ? 0.8 : 0.55;
  const glowSize = active ? "8px" : hov ? "5px" : "0px";
  const glowClr  = color.replace("1)", "0.7)");

  return (
    <span style={{
      display:      "inline-block",
      width:        9,
      height:       9,
      borderRadius: "50%",
      background:   color,
      flexShrink:   0,
      opacity,
      boxShadow:    `0 0 ${glowSize} ${glowClr}`,
      transition:   "opacity 0.2s, box-shadow 0.2s",
    }} />
  );
}

function RoleButton({
  r, active, onClick,
}: {
  r: typeof ROLE_BUTTONS[number];
  active: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:        "100%",
        minHeight:    44,
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        background:   active ? r.color.replace("1)", "0.08)") : hov ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.02)",
        border:       `1px solid ${active ? r.color.replace("1)", "0.35)") : hov ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 10,
        padding:      "10px 14px",
        cursor:       "pointer",
        color:        active ? "#E8ECF5" : hov ? "#E6EBFF" : "#AEB7D0",
        fontSize:     13,
        fontFamily:   "var(--font-sans)",
        transition:   "all 0.15s ease",
        transform:    hov && !active ? "translateY(-1px)" : "none",
        boxShadow:    active ? `0 0 16px ${r.color.replace("1)", "0.12)")}` : hov ? "0 4px 12px rgba(0,0,0,0.25)" : "none",
      }}
    >
      <RoleIcon shape={r.shape} color={r.color} active={active} hov={hov} />
      <span style={{ flex: 1, textAlign: "left", letterSpacing: "0.01em" }}>{r.label}</span>
      <span style={{ opacity: 0.3, fontSize: 9, flexShrink: 0 }}>
        {active ? "▲" : "▼"}
      </span>
    </button>
  );
}

function MoodChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    active ? "rgba(139,92,246,0.14)" : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
        border:        `1px solid ${active ? "rgba(139,92,246,0.45)" : hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:  100,
        color:         active ? "rgba(139,92,246,1)" : hov ? "#E6EBFF" : "#AEB7D0",
        fontSize:      13,
        fontFamily:    "var(--font-sans)",
        padding:       "6px 14px",
        cursor:        "pointer",
        transition:    "all 0.15s ease",
        letterSpacing: "0.02em",
        transform:     hov && !active ? "translateY(-1px)" : "none",
        boxShadow:     active ? "0 0 12px rgba(139,92,246,0.2)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function ToggleSwitch({
  active,
  onChange,
  color = "rgba(139,92,246,1)",
}: {
  active:   boolean;
  onChange: (v: boolean) => void;
  color?:   string;
}) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      style={{
        width:        48,
        height:       26,
        borderRadius: 100,
        background:   active ? color.replace("1)", "0.85)") : "rgba(255,255,255,0.08)",
        border:       `1px solid ${active ? color.replace("1)", "0.5)") : "rgba(255,255,255,0.1)"}`,
        cursor:       "pointer",
        position:     "relative",
        flexShrink:   0,
        transition:   "background 0.22s ease, border-color 0.22s ease",
        boxShadow:    active ? `0 0 12px ${color.replace("1)", "0.35)")}` : "none",
      }}
    >
      <span style={{
        position:     "absolute",
        top:          3,
        left:         active ? 23 : 3,
        width:        18,
        height:       18,
        borderRadius: "50%",
        background:   "white",
        transition:   "left 0.22s cubic-bezier(0.16,1,0.3,1)",
        boxShadow:    "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}
