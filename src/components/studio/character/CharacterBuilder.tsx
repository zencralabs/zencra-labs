"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterBuilder — 5-step guided left panel
// Progressive reveal, step dots, amber = active
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { CharacterMode, Character } from "@/lib/character";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuildPayload {
  name: string;
  type: string;
  traits: string[];
  styleDna: string[];
  appearancePrompt: string;
  platformIntent: string[];
  mode: CharacterMode;
}

export interface CharacterBuilderProps {
  mode: CharacterMode;
  onGenerate: (payload: BuildPayload) => void;
  isGenerating: boolean;
  character: Character | null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "#b45309",
  amberBg:     "rgba(245,158,11,0.10)",
  amberBorder: "rgba(245,158,11,0.3)",
  surface:     "#0b0e17",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Chip multi-select ─────────────────────────────────────────────────────────

function ChipGroup({
  options, selected, onToggle, multi = true,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt}
            onClick={() => {
              if (!multi) {
                onToggle(opt);
              } else {
                onToggle(opt);
              }
            }}
            style={{
              padding: "5px 11px", borderRadius: 20,
              border: active ? `1px solid ${T.amberDim}` : `1px solid ${T.border}`,
              background: active ? T.amberBg : "transparent",
              color: active ? T.amber : T.textSec,
              fontSize: 11, fontWeight: active ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
              letterSpacing: "0.02em",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Step dot indicator ────────────────────────────────────────────────────────

function StepDots({
  total, active, onStep,
}: {
  total: number; active: number; onStep: (i: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i}
          onClick={() => onStep(i)}
          style={{
            width: i === active ? 20 : 7, height: 7, borderRadius: 4,
            background: i === active ? T.amber : i < active ? "rgba(245,158,11,0.3)" : T.border,
            border: "none", cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Step label ────────────────────────────────────────────────────────────────

function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: T.amberBg, border: `1px solid ${T.amberBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color: T.amber, flexShrink: 0,
      }}>
        {step}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARACTER_TYPES = ["AI Influencer", "Avatar", "Brand", "Fictional", "Custom"];
const TRAITS          = ["Bold", "Empowered", "Creative", "Precise", "Minimal", "Edgy", "Warm", "Professional"];
const STYLE_DNA       = ["Cinematic", "Editorial", "Street", "Fashion", "Anime", "Realistic", "Fantasy"];
const PLATFORMS       = ["Instagram", "YouTube", "TikTok", "Ads"];
const TOTAL_STEPS     = 5;

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterBuilder({ mode, onGenerate, isGenerating }: CharacterBuilderProps) {
  const [step, setStep]         = useState(0);
  const [name, setName]         = useState("");
  const [charType, setCharType] = useState<string[]>([]);
  const [traits, setTraits]     = useState<string[]>([]);
  const [styleDna, setStyleDna] = useState<string[]>([]);
  const [prompt, setPrompt]     = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  function toggleOne<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function handleGenerate() {
    onGenerate({
      name, type: charType[0] ?? "custom",
      traits, styleDna, appearancePrompt: prompt,
      platformIntent: platforms, mode,
    });
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: T.textSec,
    letterSpacing: "0.06em", textTransform: "uppercase",
    display: "block", marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#090c13",
    border: `1px solid ${T.border}`,
    borderRadius: 8, padding: "8px 10px",
    color: T.textPrimary, fontSize: 12,
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Step dots nav */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Builder
        </div>
        <StepDots total={TOTAL_STEPS} active={step} onStep={setStep} />
      </div>

      {/* ── Step 0 — Identity ── */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StepHeader step={1} label="Identity" />
          <div>
            <label style={labelStyle}>Character Name</label>
            <input
              type="text"
              placeholder="e.g. Nova Reyes"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <ChipGroup
              options={CHARACTER_TYPES}
              selected={charType}
              onToggle={v => setCharType(prev => toggleOne(prev, v))}
            />
          </div>
        </div>
      )}

      {/* ── Step 1 — Traits ── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StepHeader step={2} label="Traits" />
          <div>
            <label style={labelStyle}>Personality — select all that apply</label>
            <ChipGroup
              options={TRAITS}
              selected={traits}
              onToggle={v => setTraits(prev => toggleOne(prev, v))}
            />
          </div>
        </div>
      )}

      {/* ── Step 2 — Style DNA ── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StepHeader step={3} label="Style DNA" />
          <div>
            <label style={labelStyle}>Visual style</label>
            <ChipGroup
              options={STYLE_DNA}
              selected={styleDna}
              onToggle={v => setStyleDna(prev => toggleOne(prev, v))}
            />
          </div>
          <button
            style={{
              padding: "8px 14px", borderRadius: 8, width: "100%",
              border: `1px solid ${T.amberBorder}`,
              background: "transparent", color: T.amber,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = T.amberBg;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            ✦ Open Style Picker
          </button>
        </div>
      )}

      {/* ── Step 3 — Prompt ── */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StepHeader step={4} label="Prompt" />
          <div>
            <label style={labelStyle}>Appearance prompt</label>
            <textarea
              rows={3}
              placeholder="Describe your character's appearance, style, and vibe…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Platform intent</label>
            <ChipGroup
              options={PLATFORMS}
              selected={platforms}
              onToggle={v => setPlatforms(prev => toggleOne(prev, v))}
            />
          </div>
          <button
            style={{
              padding: "8px 14px", borderRadius: 8, width: "100%",
              border: `1px solid ${T.amberBorder}`,
              background: "transparent", color: T.amber,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = T.amberBg;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            ✦ Enhance Identity
          </button>
        </div>
      )}

      {/* ── Step 4 — Generate ── */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StepHeader step={5} label="Generate" />
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.12)",
            fontSize: 11, color: T.textMuted, lineHeight: 1.7,
          }}>
            <div style={{ color: T.textSec, fontWeight: 600, marginBottom: 4 }}>Summary</div>
            {name && <div>Name: <span style={{ color: T.textPrimary }}>{name}</span></div>}
            {charType[0] && <div>Type: <span style={{ color: T.textPrimary }}>{charType[0]}</span></div>}
            {traits.length > 0 && <div>Traits: <span style={{ color: T.textPrimary }}>{traits.join(", ")}</span></div>}
            {styleDna.length > 0 && <div>Style: <span style={{ color: T.textPrimary }}>{styleDna.join(", ")}</span></div>}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              padding: "12px 16px", borderRadius: 10, width: "100%",
              background: isGenerating ? "rgba(245,158,11,0.3)" : "linear-gradient(135deg, #b45309, #f59e0b)",
              border: "none", color: isGenerating ? "rgba(255,255,255,0.4)" : "#090c13",
              fontSize: 13, fontWeight: 800, cursor: isGenerating ? "not-allowed" : "pointer",
              letterSpacing: "0.03em", transition: "all 0.2s",
              boxShadow: isGenerating ? "none" : "0 0 20px rgba(245,158,11,0.3)",
            }}
          >
            {isGenerating ? "Generating…" : "Generate Character"}
          </button>
          <div style={{ fontSize: 11, color: T.textGhost, textAlign: "center" }}>
            ≈ 8 credits · base generation
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: step === 0 ? "flex-end" : "space-between",
        marginTop: 20,
        paddingTop: 16,
        borderTop: `1px solid ${T.border}`,
      }}>
        {step > 0 && (
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            style={{
              padding: "6px 12px", borderRadius: 7,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}
        {step < TOTAL_STEPS - 1 && (
          <button
            onClick={() => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1))}
            style={{
              padding: "6px 14px", borderRadius: 7,
              border: `1px solid ${T.amberBorder}`,
              background: T.amberBg, color: T.amber,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Next →
          </button>
        )}
        {step === TOTAL_STEPS - 1 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              padding: "6px 14px", borderRadius: 7,
              border: "none",
              background: "linear-gradient(135deg, #b45309, #f59e0b)",
              color: "#090c13", fontSize: 12, fontWeight: 700,
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.5 : 1,
            }}
          >
            Generate
          </button>
        )}
      </div>
    </div>
  );
}
