"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterBuilder — progressive accordion left panel
// One section open at a time: Identity → Traits → Style DNA → Prompt
// Style DNA shown as visual cards, not chips
// Enhance Identity pinned at bottom
// Props + BuildPayload UNCHANGED from Phase 3A
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
  surface:     "#0b0e17",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARACTER_TYPES = ["AI Influencer", "Avatar", "Brand", "Fictional", "Custom"];
const TRAITS          = ["Bold", "Empowered", "Creative", "Precise", "Minimal", "Edgy", "Warm", "Professional"];
const PLATFORMS       = ["Instagram", "YouTube", "TikTok", "Ads"];

const STYLE_DNA_CARDS: Array<{
  id: string;
  label: string;
  description: string;
  color: string;
  gradient: string;
}> = [
  { id: "Cinematic",  label: "Cinematic",  description: "Dramatic lighting, film grain",   color: "#f59e0b", gradient: "linear-gradient(135deg, #1a120a, #2d1f00)" },
  { id: "Editorial",  label: "Editorial",  description: "Magazine-ready, high contrast",   color: "#e879f9", gradient: "linear-gradient(135deg, #130d1a, #1f0d2d)" },
  { id: "Street",     label: "Street",     description: "Urban grit, raw energy",          color: "#34d399", gradient: "linear-gradient(135deg, #091a14, #0d2d1e)" },
  { id: "Fashion",    label: "Fashion",    description: "Couture, polished, luxe",         color: "#f472b6", gradient: "linear-gradient(135deg, #1a0d12, #2d0d1a)" },
  { id: "Anime",      label: "Anime",      description: "Japanese cel-shaded aesthetic",   color: "#60a5fa", gradient: "linear-gradient(135deg, #090d1a, #0d152d)" },
  { id: "Realistic",  label: "Realistic",  description: "Photorealistic, ultra-detailed",  color: "#94a3b8", gradient: "linear-gradient(135deg, #0d1117, #111827)" },
  { id: "Fantasy",    label: "Fantasy",    description: "Otherworldly, magical realism",   color: "#a78bfa", gradient: "linear-gradient(135deg, #0f0d1a, #1a0d2d)" },
];

// ── Accordion sections ────────────────────────────────────────────────────────

type SectionId = "identity" | "traits" | "style" | "prompt";

const SECTIONS: Array<{ id: SectionId; num: string; label: string; hint: string }> = [
  { id: "identity", num: "01", label: "Identity",  hint: "Name, type"         },
  { id: "traits",   num: "02", label: "Traits",    hint: "Personality"        },
  { id: "style",    num: "03", label: "Style DNA", hint: "Visual style"       },
  { id: "prompt",   num: "04", label: "Prompt",    hint: "Appearance, intent" },
];

// ── Chip multi-select ─────────────────────────────────────────────────────────

function ChipGroup({
  options, selected, onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt}
            onClick={() => onToggle(opt)}
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

// ── Style DNA card ────────────────────────────────────────────────────────────

function StyleDnaCard({
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
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: selected
          ? `1px solid ${card.color}55`
          : `1px solid ${T.border}`,
        background: selected ? card.gradient : "rgba(9,12,19,0.5)",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: "absolute", top: 7, right: 8,
          width: 16, height: 16, borderRadius: "50%",
          background: card.color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      <div style={{
        fontSize: 12, fontWeight: 700,
        color: selected ? card.color : T.textSec,
        marginBottom: 3,
      }}>
        {card.label}
      </div>
      <div style={{
        fontSize: 10, color: selected ? `${card.color}99` : T.textGhost,
        lineHeight: 1.4,
      }}>
        {card.description}
      </div>
    </button>
  );
}

// ── Accordion section header ───────────────────────────────────────────────────

function AccordionHeader({
  num, label, hint, isOpen, isDone, onClick,
}: {
  num: string; label: string; hint: string;
  isOpen: boolean; isDone: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        width: "100%", background: "transparent", border: "none",
        cursor: "pointer", padding: "12px 0",
        borderBottom: isOpen ? `1px solid ${T.amberBorder}` : `1px solid ${T.border}`,
        gap: 10, transition: "all 0.15s",
      }}
    >
      {/* Number badge */}
      <div style={{
        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
        background: isOpen ? T.amberBg : isDone ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isOpen ? T.amberBorder : isDone ? "rgba(16,185,129,0.3)" : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800,
        color: isOpen ? T.amber : isDone ? "#10b981" : T.textGhost,
        fontFamily: "monospace",
      }}>
        {isDone && !isOpen ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : num}
      </div>

      {/* Label + hint */}
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isOpen ? T.amber : isDone ? T.textSec : T.textMuted,
          letterSpacing: "0.02em",
        }}>
          {label}
        </div>
        {!isOpen && (
          <div style={{ fontSize: 10, color: T.textGhost, marginTop: 1 }}>
            {hint}
          </div>
        )}
      </div>

      {/* Chevron */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={isOpen ? T.amber : T.textGhost} strokeWidth="2.5" strokeLinecap="round"
        style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

// ── Label style ───────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: T.textMuted,
  letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#090c13",
  border: `1px solid ${T.border}`,
  borderRadius: 8, padding: "9px 11px",
  color: T.textPrimary, fontSize: 12,
  outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
};

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterBuilder({ mode, onGenerate, isGenerating }: CharacterBuilderProps) {
  const [openSection, setOpenSection] = useState<SectionId>("identity");

  // Form state — UNCHANGED fields
  const [name,      setName]      = useState("");
  const [charType,  setCharType]  = useState<string[]>([]);
  const [traits,    setTraits]    = useState<string[]>([]);
  const [styleDna,  setStyleDna]  = useState<string[]>([]);
  const [prompt,    setPrompt]    = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  function toggle<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function toggleSection(id: SectionId) {
    setOpenSection(prev => (prev === id ? "identity" : id));
  }

  function handleGenerate() {
    onGenerate({
      name, type: charType[0] ?? "custom",
      traits, styleDna, appearancePrompt: prompt,
      platformIntent: platforms, mode,
    });
  }

  // Completion checks for checkmark badges
  const done: Record<SectionId, boolean> = {
    identity: !!name || charType.length > 0,
    traits:   traits.length > 0,
    style:    styleDna.length > 0,
    prompt:   !!prompt || platforms.length > 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Panel heading */}
      <div style={{
        fontSize: 10, fontWeight: 800, color: T.textGhost,
        letterSpacing: "0.12em", textTransform: "uppercase",
        marginBottom: 4,
      }}>
        Character Builder
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
        Build your Soul ID identity
      </div>

      {/* ── Accordion sections ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* ── Identity ── */}
        <div>
          <AccordionHeader
            num="01" label="Identity" hint={name ? name : "Name · Type"}
            isOpen={openSection === "identity"}
            isDone={done.identity}
            onClick={() => toggleSection("identity")}
          />
          {openSection === "identity" && (
            <div style={{ padding: "14px 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
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
                  onToggle={v => setCharType(prev => toggle(prev, v))}
                />
              </div>
              <button
                onClick={() => toggleSection("traits")}
                style={{
                  marginTop: 2, padding: "7px 0", borderRadius: 8,
                  border: `1px solid ${T.amberBorder}`,
                  background: T.amberBg, color: T.amber,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  letterSpacing: "0.03em", transition: "all 0.15s",
                }}
              >
                Next — Traits →
              </button>
            </div>
          )}
        </div>

        {/* ── Traits ── */}
        <div>
          <AccordionHeader
            num="02" label="Traits" hint={traits.length > 0 ? traits.slice(0, 2).join(", ") : "Personality"}
            isOpen={openSection === "traits"}
            isDone={done.traits}
            onClick={() => toggleSection("traits")}
          />
          {openSection === "traits" && (
            <div style={{ padding: "14px 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Personality — select all that apply</label>
                <ChipGroup
                  options={TRAITS}
                  selected={traits}
                  onToggle={v => setTraits(prev => toggle(prev, v))}
                />
              </div>
              <button
                onClick={() => toggleSection("style")}
                style={{
                  marginTop: 2, padding: "7px 0", borderRadius: 8,
                  border: `1px solid ${T.amberBorder}`,
                  background: T.amberBg, color: T.amber,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  letterSpacing: "0.03em", transition: "all 0.15s",
                }}
              >
                Next — Style DNA →
              </button>
            </div>
          )}
        </div>

        {/* ── Style DNA ── */}
        <div>
          <AccordionHeader
            num="03" label="Style DNA" hint={styleDna.length > 0 ? styleDna.slice(0, 2).join(", ") : "Visual style"}
            isOpen={openSection === "style"}
            isDone={done.style}
            onClick={() => toggleSection("style")}
          />
          {openSection === "style" && (
            <div style={{ padding: "14px 0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={labelStyle}>Visual style — pick all that resonate</label>
              {STYLE_DNA_CARDS.map(card => (
                <StyleDnaCard
                  key={card.id}
                  card={card}
                  selected={styleDna.includes(card.id)}
                  onToggle={() => setStyleDna(prev => toggle(prev, card.id))}
                />
              ))}
              <button
                onClick={() => toggleSection("prompt")}
                style={{
                  marginTop: 6, padding: "7px 0", borderRadius: 8,
                  border: `1px solid ${T.amberBorder}`,
                  background: T.amberBg, color: T.amber,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  letterSpacing: "0.03em", transition: "all 0.15s",
                }}
              >
                Next — Prompt →
              </button>
            </div>
          )}
        </div>

        {/* ── Prompt ── */}
        <div>
          <AccordionHeader
            num="04" label="Prompt" hint="Appearance · Platform"
            isOpen={openSection === "prompt"}
            isDone={done.prompt}
            onClick={() => toggleSection("prompt")}
          />
          {openSection === "prompt" && (
            <div style={{ padding: "14px 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Appearance prompt</label>
                <textarea
                  rows={4}
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
                  onToggle={v => setPlatforms(prev => toggle(prev, v))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      {(name || charType[0] || traits.length > 0 || styleDna.length > 0) && (
        <div style={{
          marginTop: 16, padding: "10px 12px", borderRadius: 8,
          background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.12)",
          fontSize: 11, color: T.textMuted, lineHeight: 1.7,
        }}>
          {name && <div>Name: <span style={{ color: T.textSec }}>{name}</span></div>}
          {charType[0] && <div>Type: <span style={{ color: T.textSec }}>{charType[0]}</span></div>}
          {traits.length > 0 && <div>Traits: <span style={{ color: T.textSec }}>{traits.slice(0, 3).join(", ")}</span></div>}
          {styleDna.length > 0 && <div>Style: <span style={{ color: T.textSec }}>{styleDna.join(", ")}</span></div>}
        </div>
      )}

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        style={{
          marginTop: 16, padding: "13px 16px", borderRadius: 10, width: "100%",
          background: isGenerating
            ? "rgba(245,158,11,0.25)"
            : "linear-gradient(135deg, #b45309, #f59e0b)",
          border: "none",
          color: isGenerating ? "rgba(255,255,255,0.35)" : "#090c13",
          fontSize: 13, fontWeight: 800,
          cursor: isGenerating ? "not-allowed" : "pointer",
          letterSpacing: "0.03em", transition: "all 0.2s",
          boxShadow: isGenerating ? "none" : "0 0 24px rgba(245,158,11,0.28)",
        }}
      >
        {isGenerating ? "Generating…" : "✦ Generate Character"}
      </button>
      <div style={{ fontSize: 11, color: T.textGhost, textAlign: "center", marginTop: 8 }}>
        ≈ 8 credits · base generation
      </div>

      {/* ── Enhance Identity (pinned) ── */}
      <button
        style={{
          marginTop: 12, padding: "9px 14px", borderRadius: 8, width: "100%",
          border: `1px solid rgba(245,158,11,0.20)`,
          background: "transparent", color: T.textSec,
          fontSize: 11, fontWeight: 600, cursor: "pointer",
          letterSpacing: "0.03em", transition: "all 0.15s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = T.amber;
          (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
          (e.currentTarget as HTMLElement).style.background = T.amberBg;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = T.textSec;
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.20)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        Enhance Identity
      </button>
    </div>
  );
}
