"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterBuilder — flat Identity Builder left panel (Phase 3D visual tuning)
// Typography: 13-14px section headings, 14-15px body, 13px chips, 14px inputs
// All sections visible at once. Premium amber Generate button.
// Props + BuildPayload UNCHANGED.
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
  amberBorder: "rgba(245,158,11,0.30)",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARACTER_TYPES = ["AI Influencer", "Avatar", "Brand", "Fictional", "Custom"];

const TRAITS = [
  "Bold", "Empowered", "Creative", "Precise",
  "Minimal", "Edgy", "Warm", "Professional",
];

const STYLE_DNA_CARDS: Array<{
  id: string; label: string; description: string;
  color: string; gradient: string;
}> = [
  { id: "Cinematic",  label: "Cinematic",  description: "Dramatic · Film grain",     color: "#f59e0b", gradient: "linear-gradient(135deg, #1a120a, #0f0b04)" },
  { id: "Editorial",  label: "Editorial",  description: "Magazine · High contrast",  color: "#e879f9", gradient: "linear-gradient(135deg, #130d1a, #0d080f)" },
  { id: "Street",     label: "Street",     description: "Urban · Raw energy",        color: "#34d399", gradient: "linear-gradient(135deg, #071510, #040d09)" },
  { id: "Fashion",    label: "Fashion",    description: "Couture · Luxe",            color: "#f472b6", gradient: "linear-gradient(135deg, #180d12, #0f0809)" },
  { id: "Anime",      label: "Anime",      description: "Cel-shaded · Japanese",     color: "#60a5fa", gradient: "linear-gradient(135deg, #090d1a, #05080f)" },
  { id: "Realistic",  label: "Realistic",  description: "Photorealistic · Detail",   color: "#94a3b8", gradient: "linear-gradient(135deg, #0d1117, #09090e)" },
  { id: "Fantasy",    label: "Fantasy",    description: "Magical · Otherworldly",    color: "#a78bfa", gradient: "linear-gradient(135deg, #0f0d1a, #08060f)" },
];

const PLATFORMS = ["Instagram", "YouTube", "TikTok", "Ads"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggle<T extends string>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 800, color: T.textMuted,
      letterSpacing: "0.10em", textTransform: "uppercase",
      marginBottom: 12, paddingBottom: 9,
      borderBottom: `1px solid ${T.border}`,
    }}>
      {label}
    </div>
  );
}

// ── Chip group ────────────────────────────────────────────────────────────────

function ChipGroup({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: "7px 14px", borderRadius: 20,
              border: active ? `1px solid ${T.amberDim}` : `1px solid ${T.border}`,
              background: active ? T.amberBg : "transparent",
              color: active ? T.amber : T.textSec,
              fontSize: 13, fontWeight: active ? 700 : 400,
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

// ── Style DNA card (2-col mini) ────────────────────────────────────────────────

function StyleCard({
  card, selected, onToggle,
}: {
  card: typeof STYLE_DNA_CARDS[number];
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "12px 12px", borderRadius: 10,
        border: selected ? `1px solid ${card.color}55` : `1px solid ${T.border}`,
        background: selected ? card.gradient : "rgba(9,12,19,0.5)",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s", position: "relative",
      }}
    >
      {selected && (
        <div style={{
          position: "absolute", top: 7, right: 7,
          width: 16, height: 16, borderRadius: "50%",
          background: card.color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: selected ? card.color : T.textSec,
        marginBottom: 3,
      }}>
        {card.label}
      </div>
      <div style={{ fontSize: 11, color: selected ? `${card.color}88` : T.textGhost, lineHeight: 1.45 }}>
        {card.description}
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterBuilder({ mode, onGenerate, isGenerating }: CharacterBuilderProps) {
  const [name,      setName]      = useState("");
  const [charType,  setCharType]  = useState<string[]>([]);
  const [traits,    setTraits]    = useState<string[]>([]);
  const [styleDna,  setStyleDna]  = useState<string[]>([]);
  const [prompt,    setPrompt]    = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  function handleGenerate() {
    onGenerate({
      name, type: charType[0] ?? "custom",
      traits, styleDna, appearancePrompt: prompt,
      platformIntent: platforms, mode,
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#090c13",
    border: `1px solid ${T.border}`,
    borderRadius: 9, padding: "11px 14px",
    color: T.textPrimary, fontSize: 14,
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    lineHeight: 1.5,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>

      {/* Panel header */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 900, color: T.textGhost,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5,
        }}>
          Identity Builder
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5 }}>
          Build your Soul ID identity
        </div>
      </div>

      {/* ── Character Name ── */}
      <div>
        <SectionLabel label="Character Name" />
        <input
          type="text"
          placeholder="e.g. Nova Reyes"
          value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle}
          onFocus={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
          }}
          onBlur={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.border;
          }}
        />
        {name && (
          <div style={{
            marginTop: 7, fontSize: 11, fontFamily: "monospace",
            color: T.amber, letterSpacing: "0.08em",
          }}>
            SOUL ID: {name.toUpperCase().replace(/\s/g, "-").slice(0, 12)}-{Math.random().toString(36).slice(2, 6).toUpperCase()}
          </div>
        )}
      </div>

      {/* ── Character Type ── */}
      <div>
        <SectionLabel label="Character Type" />
        <ChipGroup
          options={CHARACTER_TYPES}
          selected={charType}
          onToggle={v => setCharType(prev => toggle(prev, v))}
        />
      </div>

      {/* ── Core Traits ── */}
      <div>
        <SectionLabel label="Core Traits" />
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
          Personality — select all that apply
        </div>
        <ChipGroup
          options={TRAITS}
          selected={traits}
          onToggle={v => setTraits(prev => toggle(prev, v))}
        />
      </div>

      {/* ── Style DNA ── */}
      <div>
        <SectionLabel label="Style DNA" />
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
          Visual aesthetic — pick all that resonate
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {STYLE_DNA_CARDS.map(card => (
            <StyleCard
              key={card.id}
              card={card}
              selected={styleDna.includes(card.id)}
              onToggle={() => setStyleDna(prev => toggle(prev, card.id))}
            />
          ))}
        </div>
      </div>

      {/* ── Appearance Prompt ── */}
      <div>
        <SectionLabel label="Appearance Prompt" />
        <textarea
          rows={3}
          placeholder="Describe appearance, vibe, specific features…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65 }}
          onFocus={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
          }}
          onBlur={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.border;
          }}
        />
      </div>

      {/* ── Platform Intent ── */}
      <div>
        <SectionLabel label="Platform Intent" />
        <ChipGroup
          options={PLATFORMS}
          selected={platforms}
          onToggle={v => setPlatforms(prev => toggle(prev, v))}
        />
      </div>

      {/* ── Summary strip ── */}
      {(name || charType.length > 0 || styleDna.length > 0) && (
        <div style={{
          padding: "13px 16px", borderRadius: 10,
          background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.14)",
          fontSize: 13, color: T.textMuted, lineHeight: 1.85,
        }}>
          {name && <div>Name: <span style={{ color: T.textSec, fontWeight: 600 }}>{name}</span></div>}
          {charType[0] && <div>Type: <span style={{ color: T.textSec, fontWeight: 600 }}>{charType[0]}</span></div>}
          {traits.length > 0 && <div>Traits: <span style={{ color: T.textSec }}>{traits.slice(0, 3).join(", ")}</span></div>}
          {styleDna.length > 0 && <div>Style: <span style={{ color: T.textSec }}>{styleDna.join(", ")}</span></div>}
        </div>
      )}

      {/* ── Enhance Identity ── */}
      <button
        style={{
          padding: "12px 16px", borderRadius: 10, width: "100%",
          border: `1px solid rgba(245,158,11,0.24)`,
          background: "transparent", color: T.textSec,
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          letterSpacing: "0.02em", transition: "all 0.15s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = T.amber;
          (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
          (e.currentTarget as HTMLElement).style.background = T.amberBg;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = T.textSec;
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.24)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" />
        </svg>
        Enhance Identity
      </button>

      {/* ── Generate Character ── */}
      <div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            padding: "16px 18px", borderRadius: 11, width: "100%",
            background: isGenerating
              ? "rgba(245,158,11,0.20)"
              : "linear-gradient(135deg, #92400e, #b45309 40%, #f59e0b)",
            border: "none",
            color: isGenerating ? "rgba(255,255,255,0.30)" : "#060810",
            fontSize: 15, fontWeight: 800,
            cursor: isGenerating ? "not-allowed" : "pointer",
            letterSpacing: "0.02em", transition: "all 0.2s",
            boxShadow: isGenerating
              ? "none"
              : "0 0 36px rgba(245,158,11,0.32), 0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {isGenerating ? "Generating…" : "✦  Generate Character"}
        </button>
        <div style={{
          fontSize: 12, color: T.textGhost,
          textAlign: "center", marginTop: 9,
        }}>
          ≈ 8 credits · base generation
        </div>
      </div>

    </div>
  );
}
