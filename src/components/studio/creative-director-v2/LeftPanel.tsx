"use client";

/**
 * LeftPanel — Scene assist panel for Creative Director v2.
 *
 * Sections (top → bottom):
 *   1. Scene Intent    — freetext name / description of the scene
 *   2. Add to Scene    — role-typed element quick-add buttons
 *   3. Style Mood      — chip presets → direction_refinements (color_palette + lighting_style)
 *   4. Identity Lock   — toggle → refinements.identity_lock
 *   5. Advanced        — collapsible: tone intensity
 */

import { useState, useCallback }         from "react";
import { useDirectionStore, STYLE_MOOD_PRESETS } from "@/lib/creative-director/store";
import type { DirectionElementType }     from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface LeftPanelProps {
  onAddElement:        (type: DirectionElementType, label: string) => void;
  onEnsureDirection:   () => Promise<string | null>;
}

// Role buttons
const ROLE_BUTTONS: Array<{
  type:  DirectionElementType;
  label: string;
  color: string;
  icon:  string;
  placeholder: string;
}> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)",  icon: "👤", placeholder: "e.g. a dancer mid-leap" },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)",   icon: "🌍", placeholder: "e.g. neon-lit Tokyo alley" },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)",  icon: "🌫", placeholder: "e.g. moody fog, 3am energy" },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)",  icon: "📦", placeholder: "e.g. chrome motorcycle" },
];

// ─────────────────────────────────────────────────────────────────────────────

export function LeftPanel({ onAddElement, onEnsureDirection }: LeftPanelProps) {
  const {
    sceneIntent,
    activeStyleMood,
    refinements,
    setSceneIntentText,
    setStyleMood,
    patchRefinements,
  } = useDirectionStore();

  const [activeRole, setActiveRole]       = useState<DirectionElementType | null>(null);
  const [roleInput, setRoleInput]         = useState("");
  const [advancedOpen, setAdvancedOpen]   = useState(false);

  // ── Scene intent text ──────────────────────────────────────────────────────
  const handleIntentChange = useCallback(
    async (val: string) => {
      setSceneIntentText(val);
      if (val.trim().length > 2) {
        await onEnsureDirection();
      }
    },
    [setSceneIntentText, onEnsureDirection]
  );

  // ── Add element from role input ────────────────────────────────────────────
  const commitRoleInput = useCallback(() => {
    if (!activeRole || !roleInput.trim()) return;
    onAddElement(activeRole, roleInput.trim());
    setRoleInput("");
    setActiveRole(null);
  }, [activeRole, roleInput, onAddElement]);

  const identityLock = refinements?.identity_lock === true;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height:         "100%",
        overflowY:      "auto",
        background:     "rgba(10,10,10,0.95)",
        display:        "flex",
        flexDirection:  "column",
        gap:            0,
        scrollbarWidth: "none",
      }}
    >
      {/* ── Scene Intent ────────────────────────────────────────────────── */}
      <Section label="Scene Intent" icon="✦">
        <textarea
          value={sceneIntent.text}
          onChange={(e) => void handleIntentChange(e.target.value)}
          placeholder="Describe the scene, mood, or story in your own words…"
          rows={3}
          style={{
            width:          "100%",
            background:     "rgba(255,255,255,0.03)",
            border:         "1px solid rgba(255,255,255,0.08)",
            borderRadius:   8,
            color:          "rgba(255,255,255,0.85)",
            fontSize:       13,
            fontFamily:     "var(--font-sans)",
            lineHeight:     1.5,
            padding:        "10px 12px",
            resize:         "none",
            outline:        "none",
            boxSizing:      "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </Section>

      <Divider />

      {/* ── Add to Scene ────────────────────────────────────────────────── */}
      <Section label="Add to Scene" icon="＋">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ROLE_BUTTONS.map((r) => (
            <div key={r.type}>
              <button
                onClick={() => {
                  setActiveRole(activeRole === r.type ? null : r.type);
                  setRoleInput("");
                }}
                style={{
                  width:          "100%",
                  display:        "flex",
                  alignItems:     "center",
                  gap:            8,
                  background:     activeRole === r.type ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  border:         `1px solid ${activeRole === r.type ? r.color.replace("1)", "0.3)") : "rgba(255,255,255,0.06)"}`,
                  borderRadius:   8,
                  padding:        "8px 12px",
                  cursor:         "pointer",
                  color:          activeRole === r.type ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                  fontSize:       12,
                  fontFamily:     "var(--font-sans)",
                  transition:     "all 0.15s",
                }}
              >
                <span
                  style={{
                    width:          8,
                    height:         8,
                    borderRadius:   "50%",
                    background:     r.color,
                    flexShrink:     0,
                    boxShadow:      activeRole === r.type ? `0 0 6px ${r.color.replace("1)", "0.6)")}` : "none",
                  }}
                />
                <span style={{ flex: 1, textAlign: "left" }}>{r.label}</span>
                <span style={{ opacity: 0.4, fontSize: 10 }}>
                  {activeRole === r.type ? "▲" : "▼"}
                </span>
              </button>

              {/* Inline input when role is active */}
              {activeRole === r.type && (
                <div
                  style={{
                    display:        "flex",
                    gap:            6,
                    marginTop:      4,
                    paddingLeft:    4,
                  }}
                >
                  <input
                    autoFocus
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRoleInput();
                      if (e.key === "Escape") { setActiveRole(null); setRoleInput(""); }
                    }}
                    placeholder={r.placeholder}
                    style={{
                      flex:           1,
                      background:     "rgba(255,255,255,0.04)",
                      border:         `1px solid ${r.color.replace("1)", "0.3)")}`,
                      borderRadius:   6,
                      color:          "rgba(255,255,255,0.85)",
                      fontSize:       12,
                      fontFamily:     "var(--font-sans)",
                      padding:        "6px 10px",
                      outline:        "none",
                    }}
                  />
                  <button
                    onClick={commitRoleInput}
                    disabled={!roleInput.trim()}
                    style={{
                      background:     r.color.replace("1)", "0.15)"),
                      border:         `1px solid ${r.color.replace("1)", "0.3)")}`,
                      borderRadius:   6,
                      color:          r.color,
                      fontSize:       12,
                      cursor:         roleInput.trim() ? "pointer" : "not-allowed",
                      padding:        "6px 12px",
                      fontFamily:     "var(--font-sans)",
                      opacity:        roleInput.trim() ? 1 : 0.4,
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
      <Section label="Style Mood" icon="◈">
        <div
          style={{
            display:        "flex",
            flexWrap:       "wrap",
            gap:            6,
          }}
        >
          {STYLE_MOOD_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setStyleMood(activeStyleMood === p.key ? null : p.key)}
              style={{
                background:   activeStyleMood === p.key
                  ? "rgba(139,92,246,0.15)"
                  : "rgba(255,255,255,0.03)",
                border:       `1px solid ${activeStyleMood === p.key ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 100,
                color:        activeStyleMood === p.key ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.45)",
                fontSize:     11,
                fontFamily:   "var(--font-sans)",
                padding:      "5px 12px",
                cursor:       "pointer",
                transition:   "all 0.15s",
                letterSpacing: "0.02em",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {activeStyleMood && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 6, fontFamily: "var(--font-sans)" }}>
            → {STYLE_MOOD_PRESETS.find(p => p.key === activeStyleMood)?.color_palette} palette,{" "}
            {STYLE_MOOD_PRESETS.find(p => p.key === activeStyleMood)?.lighting_style} lighting
          </p>
        )}
      </Section>

      <Divider />

      {/* ── Identity Lock ────────────────────────────────────────────────── */}
      <Section label="Identity Lock" icon="⬡">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)", margin: 0 }}>
              Lock character identity
            </p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", margin: "3px 0 0" }}>
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
          background:   "none",
          border:       "none",
          color:        "rgba(255,255,255,0.3)",
          fontSize:     11,
          fontFamily:   "var(--font-sans)",
          cursor:       "pointer",
          padding:      "10px 16px",
          textAlign:    "left",
          display:      "flex",
          alignItems:   "center",
          gap:          6,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span>{advancedOpen ? "▾" : "▸"}</span>
        Advanced
      </button>

      {advancedOpen && (
        <div style={{ padding: "0 16px 16px" }}>
          <label
            style={{
              display:     "block",
              fontSize:    11,
              color:       "rgba(255,255,255,0.4)",
              fontFamily:  "var(--font-sans)",
              marginBottom: 6,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Tone Intensity — {refinements?.tone_intensity ?? 50}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={refinements?.tone_intensity ?? 50}
            onChange={(e) => patchRefinements({ tone_intensity: Number(e.target.value) } as Parameters<typeof patchRefinements>[0])}
            style={{ width: "100%", accentColor: "rgba(139,92,246,1)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-sans)", marginTop: 2 }}>
            <span>Minimal</span>
            <span>Ultra Dramatic</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Section({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 16px 12px" }}>
      <p
        style={{
          fontSize:      10,
          color:         "rgba(255,255,255,0.3)",
          fontFamily:    "var(--font-sans)",
          margin:        "0 0 10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display:       "flex",
          alignItems:    "center",
          gap:           6,
        }}
      >
        <span style={{ opacity: 0.5 }}>{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height:     1,
        background: "rgba(255,255,255,0.04)",
        margin:     "0 16px",
        flexShrink: 0,
      }}
    />
  );
}

function ToggleSwitch({
  active,
  onChange,
  color = "rgba(139,92,246,1)",
}: {
  active:    boolean;
  onChange:  (v: boolean) => void;
  color?:    string;
}) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      style={{
        width:        40,
        height:       22,
        borderRadius: 100,
        background:   active ? color.replace("1)", "0.8)") : "rgba(255,255,255,0.1)",
        border:       "none",
        cursor:       "pointer",
        position:     "relative",
        transition:   "background 0.2s",
        flexShrink:   0,
      }}
    >
      <span
        style={{
          position:         "absolute",
          top:              3,
          left:             active ? 21 : 3,
          width:            16,
          height:           16,
          borderRadius:     "50%",
          background:       "white",
          transition:       "left 0.2s",
          boxShadow:        "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}
