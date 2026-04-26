"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Controls — Right panel
// Tabs: Builder | Packs | Refine | Advanced
// Builder is context-aware: shows creation form when empty, influencer info when selected
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { CanvasState, ActiveInfluencer } from "./AIInfluencerBuilder";
import type { AIInfluencer } from "@/lib/influencer/types";

const T = {
  border:  "#111827",
  surface: "#0b0e17",
  text:    "#e8eaf0",
  muted:   "#8b92a8",
  ghost:   "#3d4560",
  amber:   "#f59e0b",
  amberBg: "rgba(245,158,11,0.09)",
  amberBorder: "rgba(245,158,11,0.22)",
} as const;

type ControlTab = "builder" | "packs" | "refine" | "advanced";

interface Props {
  canvasState:      CanvasState;
  activeInfluencer: ActiveInfluencer | null;
  onCreated:        (influencer: AIInfluencer) => void;
}

export default function InfluencerControls({ canvasState, activeInfluencer, onCreated }: Props) {
  const [activeTab, setActiveTab] = useState<ControlTab>("builder");

  const tabs: Array<{ id: ControlTab; label: string }> = [
    { id: "builder",  label: "Builder"  },
    { id: "packs",    label: "Packs"    },
    { id: "refine",   label: "Refine"   },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Tab bar */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${T.border}`,
        padding: "0 4px", flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "13px 4px",
              background: "none", border: "none",
              borderBottom: activeTab === tab.id
                ? `2px solid ${T.amber}`
                : "2px solid transparent",
              color: activeTab === tab.id ? T.amber : T.ghost,
              fontSize: 12, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.04em",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "builder"  && (
          <BuilderTab
            canvasState={canvasState}
            activeInfluencer={activeInfluencer}
            onCreated={onCreated}
          />
        )}
        {activeTab === "packs"    && <PacksInfoTab    active={activeInfluencer} />}
        {activeTab === "refine"   && <RefineTab       active={activeInfluencer} />}
        {activeTab === "advanced" && <AdvancedTab />}
      </div>
    </div>
  );
}

// ── Builder tab ───────────────────────────────────────────────────────────────

function BuilderTab({
  canvasState, activeInfluencer, onCreated,
}: {
  canvasState: CanvasState;
  activeInfluencer: ActiveInfluencer | null;
  onCreated: (influencer: AIInfluencer) => void;
}) {
  const [name,       setName]       = useState("");
  const [gender,     setGender]     = useState("");
  const [ageRange,   setAgeRange]   = useState("");
  const [skinTone,   setSkinTone]   = useState("");
  const [faceStruct, setFaceStruct] = useState("");
  const [fashion,    setFashion]    = useState("");
  const [realism,    setRealism]    = useState("photorealistic");
  const [mood,       setMood]       = useState<string[]>([]);
  const [platforms,  setPlatforms]  = useState<string[]>([]);
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // If we're generating or have a selected influencer, show a compact status view
  if (canvasState.phase === "generating") {
    return (
      <div style={{ padding: "24px 18px" }}>
        <StatusNote icon="⟳" color={T.amber} text="Building influencer candidates…" />
      </div>
    );
  }

  if (activeInfluencer) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: T.ghost, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Active Influencer
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            {activeInfluencer.influencer.name}
          </div>
          <StatusNote icon="●" color="#10b981" text="Identity locked — packs are available" />
        </div>
        <div style={{
          padding: "12px 14px", borderRadius: 9,
          background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
          fontSize: 12, color: T.ghost, lineHeight: 1.65,
        }}>
          Use the pack buttons below the hero image to expand this influencer's content world.
        </div>
      </div>
    );
  }

  // Default: creation form
  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError(null);
    setLoading(true);

    try {
      // Step 1: Create influencer record
      const createRes = await fetch("/api/character/ai-influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          gender, age_range: ageRange, skin_tone: skinTone,
          face_structure: faceStruct, fashion_style: fashion,
          realism_level: realism, mood, platform_intent: platforms,
          appearance_notes: notes,
        }),
      });

      if (!createRes.ok) {
        setError("Failed to create influencer. Try again.");
        return;
      }

      const createData = await createRes.json();
      const influencer = createData.data?.influencer;
      if (!influencer) { setError("Unexpected response."); return; }

      // Step 2: Trigger generation
      await fetch("/api/character/ai-influencers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ influencer_id: influencer.id }),
      });

      onCreated(influencer);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMood(v: string) {
    setMood(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }
  function togglePlatform(v: string) {
    setPlatforms(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "#090c13", border: `1px solid ${T.border}`,
    borderRadius: 8, padding: "10px 12px",
    color: T.text, fontSize: 14, outline: "none",
    fontFamily: "inherit", transition: "border-color 0.15s",
  };

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Name */}
      <section>
        <SectionLabel label="Name" />
        <input
          type="text" placeholder="e.g. Nova Reyes"
          value={name} onChange={e => setName(e.target.value)}
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = T.amberBorder)}
          onBlur={e => (e.currentTarget.style.borderColor = T.border)}
        />
      </section>

      {/* Identity */}
      <section>
        <SectionLabel label="Identity" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SelectField
            label="Gender" value={gender} onChange={setGender}
            options={["", "Female", "Male", "Non-binary", "Androgynous"]}
            style={inputStyle}
          />
          <SelectField
            label="Age Range" value={ageRange} onChange={setAgeRange}
            options={["", "18–24", "25–32", "33–40", "40+"]}
            style={inputStyle}
          />
          <SelectField
            label="Skin Tone" value={skinTone} onChange={setSkinTone}
            options={["", "Fair", "Light warm", "Medium warm", "Tan olive", "Deep brown", "Rich dark"]}
            style={inputStyle}
          />
          <SelectField
            label="Face Structure" value={faceStruct} onChange={setFaceStruct}
            options={["", "Oval", "Heart", "Square jaw", "Angular", "Round", "Diamond"]}
            style={inputStyle}
          />
        </div>
      </section>

      {/* Style */}
      <section>
        <SectionLabel label="Style" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SelectField
            label="Fashion Style" value={fashion} onChange={setFashion}
            options={["", "Cinematic", "Editorial", "Streetwear", "Fashion", "Minimal", "Casual", "Formal"]}
            style={inputStyle}
          />
          <SelectField
            label="Realism Level" value={realism} onChange={setRealism}
            options={["photorealistic", "cinematic", "stylized", "hyper-realistic"]}
            style={inputStyle}
          />
        </div>
      </section>

      {/* Mood */}
      <section>
        <SectionLabel label="Mood" />
        <ChipGroup
          options={["Confident", "Bold", "Cinematic", "Warm", "Edgy", "Minimal"]}
          selected={mood}
          onToggle={toggleMood}
        />
      </section>

      {/* Platform */}
      <section>
        <SectionLabel label="Platform Intent" />
        <ChipGroup
          options={["Instagram", "TikTok", "YouTube", "Brand"]}
          selected={platforms}
          onToggle={togglePlatform}
        />
      </section>

      {/* Notes */}
      <section>
        <SectionLabel label="Appearance Notes" />
        <textarea
          rows={2}
          placeholder="Specific features, vibe, references…"
          value={notes} onChange={e => setNotes(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
          onFocus={e => (e.currentTarget.style.borderColor = T.amberBorder)}
          onBlur={e => (e.currentTarget.style.borderColor = T.border)}
        />
      </section>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>
      )}

      {/* CTA */}
      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          padding: "14px 18px", borderRadius: 10, width: "100%",
          background: loading
            ? "rgba(245,158,11,0.20)"
            : "linear-gradient(135deg, #92400e, #b45309 40%, #f59e0b)",
          border: "none",
          color: loading ? "rgba(255,255,255,0.30)" : "#060810",
          fontSize: 14, fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: "0.02em",
          boxShadow: loading ? "none" : "0 0 28px rgba(245,158,11,0.28), 0 4px 16px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Creating…" : "Create Influencer"}
      </button>
    </div>
  );
}

// ── Packs info tab ─────────────────────────────────────────────────────────────

function PacksInfoTab({ active }: { active: ActiveInfluencer | null }) {
  if (!active) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <StatusNote icon="○" color={T.ghost} text="Create and select an influencer to unlock packs." />
      </div>
    );
  }

  const packs = [
    { label: "Identity Sheet",  desc: "5-angle character reference sheet",     accent: "#e2e8f0" },
    { label: "Look Pack",       desc: "Outfit variations, same identity",       accent: "#f59e0b" },
    { label: "Scene Pack",      desc: "Different environments, identity held",  accent: "#10b981" },
    { label: "Pose Pack",       desc: "Body positions and movement",            accent: "#3b82f6" },
    { label: "Social Pack",     desc: "9:16 · 1:1 · 16:9 ready formats",       accent: "#a855f7" },
  ];

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: T.ghost, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
        Available Packs
      </div>
      {packs.map(p => (
        <div key={p.label} style={{
          padding: "11px 13px", borderRadius: 9,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid rgba(255,255,255,0.07)`,
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.accent }}>{p.label}</div>
          <div style={{ fontSize: 12, color: T.ghost }}>{p.desc}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: T.ghost, marginTop: 6, lineHeight: 1.6 }}>
        Use the pack buttons below the hero image to generate each pack.
      </div>
    </div>
  );
}

// ── Refine tab ─────────────────────────────────────────────────────────────────

function RefineTab({ active }: { active: ActiveInfluencer | null }) {
  if (!active) {
    return (
      <div style={{ padding: "24px 18px" }}>
        <StatusNote icon="○" color={T.ghost} text="Select an influencer to access refine options." />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: T.ghost, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
        Refine Identity
      </div>
      <div style={{ fontSize: 13, color: T.ghost, lineHeight: 1.65, marginBottom: 20 }}>
        Generate a variation of the hero image while preserving the core identity. Identity lock is always maintained.
      </div>
      <button style={{
        width: "100%", padding: "11px 16px", borderRadius: 9,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: T.muted, fontSize: 13, fontWeight: 700,
        cursor: "pointer", letterSpacing: "0.02em",
        transition: "all 0.15s",
      }}>
        Refine Hero Image
      </button>
    </div>
  );
}

// ── Advanced tab ───────────────────────────────────────────────────────────────

function AdvancedTab() {
  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: T.ghost, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
        Advanced
      </div>
      <div style={{ fontSize: 13, color: T.ghost, lineHeight: 1.65 }}>
        Advanced identity controls — custom prompt overrides, seed control, and generation fine-tuning — coming in a future update.
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: T.ghost,
      letterSpacing: "0.10em", textTransform: "uppercase",
      marginBottom: 8,
    }}>
      {label}
    </div>
  );
}

function SelectField({
  label, value, onChange, options, style,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; style: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={style}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt || label}</option>
      ))}
    </select>
  );
}

function ChipGroup({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: "6px 12px", borderRadius: 20,
              border: active ? `1px solid rgba(245,158,11,0.35)` : `1px solid ${T.border}`,
              background: active ? T.amberBg : "transparent",
              color: active ? T.amber : T.muted,
              fontSize: 12, fontWeight: active ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function StatusNote({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      fontSize: 13, color: color, lineHeight: 1.5,
    }}>
      <span style={{ fontSize: 10, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
