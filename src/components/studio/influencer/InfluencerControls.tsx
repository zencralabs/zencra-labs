"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Controls — Right panel
// Tabs: Builder | Packs | Refine
//
// Builder tab is a PURE INPUT UI — no API calls, no loading, no error state.
// All form state lives in AIInfluencerBuilder (lifted) and is passed in.
// Creation is triggered by the canvas dock button → handleCreateInfluencer().
//
// Biological Identity (Phase A traits) lives INSIDE Builder tab, between
// Ethnicity/Region and Rendering — it is part of core identity, not advanced.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanvasState, ActiveInfluencer } from "./AIInfluencerBuilder";
import type { StyleCategory } from "@/lib/influencer/types";
import { STYLE_CATEGORY_VALUES } from "@/lib/influencer/types";
import { useState } from "react";
import { formatHandle } from "@/lib/ai-influencer/format-handle";

const T = {
  border:      "#111827",
  surface:     "#0b0e17",
  text:        "#e8eaf0",
  muted:       "#8b92a8",
  ghost:       "#3d4560",
  amber:       "#f59e0b",
  amberBg:     "rgba(245,158,11,0.09)",
  amberBorder: "rgba(245,158,11,0.22)",
} as const;

type ControlTab = "builder" | "packs" | "refine";

// ── Props — all form state lifted from parent ─────────────────────────────────

interface Props {
  canvasState:      CanvasState;
  activeInfluencer: ActiveInfluencer | null;
  // Lifted form state
  styleCategory:    StyleCategory;
  setStyleCategory: (v: StyleCategory) => void;
  gender:           string;
  setGender:        (v: string) => void;
  ageRange:         string;
  setAgeRange:      (v: string) => void;
  skinTone:         string;
  setSkinTone:      (v: string) => void;
  faceStruct:       string;
  setFaceStruct:    (v: string) => void;
  // Ethnicity/Region — drives region-aware naming + facial genetics in prompts
  ethnicityRegion:      string;
  setEthnicityRegion:   (v: string) => void;
  mixedBlendRegions:    string[];
  setMixedBlendRegions: (v: string[]) => void;
  // Identity Options — candidate count (1–4, default 4)
  candidateCount:    number;
  setCandidateCount: (v: number) => void;
  // Phase A — Biological Identity Traits
  species:         string;
  setSpecies:      (v: string) => void;
  hairIdentity:    string;
  setHairIdentity: (v: string) => void;
  eyeColor:        string;
  setEyeColor:     (v: string) => void;
  eyeType:         string;
  setEyeType:      (v: string) => void;
  skinMarks:       string[];
  setSkinMarks:    (v: string[]) => void;
  earType:         string;
  setEarType:      (v: string) => void;
  hornType:        string;
  setHornType:     (v: string) => void;
  // Phase B — Body Architecture (transient casting params)
  bodyType:     string;
  setBodyType:  (v: string) => void;
  leftArm:      string;
  setLeftArm:   (v: string) => void;
  rightArm:     string;
  setRightArm:  (v: string) => void;
  leftLeg:      string;
  setLeftLeg:   (v: string) => void;
  rightLeg:     string;
  setRightLeg:  (v: string) => void;
  skinArt:      string[];
  setSkinArt:   (v: string[]) => void;
}

export default function InfluencerControls({
  canvasState, activeInfluencer,
  styleCategory, setStyleCategory,
  gender, setGender,
  ageRange, setAgeRange,
  skinTone, setSkinTone,
  faceStruct, setFaceStruct,
  ethnicityRegion, setEthnicityRegion,
  mixedBlendRegions, setMixedBlendRegions,
  candidateCount, setCandidateCount,
  species, setSpecies,
  hairIdentity, setHairIdentity,
  eyeColor, setEyeColor,
  eyeType, setEyeType,
  skinMarks, setSkinMarks,
  earType, setEarType,
  hornType, setHornType,
  bodyType, setBodyType,
  leftArm, setLeftArm,
  rightArm, setRightArm,
  leftLeg, setLeftLeg,
  rightLeg, setRightLeg,
  skinArt, setSkinArt,
}: Props) {
  const [activeTab, setActiveTab] = useState<ControlTab>("builder");

  const tabs: Array<{ id: ControlTab; label: string }> = [
    { id: "builder", label: "Builder" },
    { id: "packs",   label: "Packs"   },
    { id: "refine",  label: "Refine"  },
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
              color: activeTab === tab.id ? T.amber : "rgba(255,255,255,0.32)",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "builder" && (
          <BuilderTab
            canvasState={canvasState}
            activeInfluencer={activeInfluencer}
            styleCategory={styleCategory}          setStyleCategory={setStyleCategory}
            gender={gender}                        setGender={setGender}
            ageRange={ageRange}                    setAgeRange={setAgeRange}
            skinTone={skinTone}                    setSkinTone={setSkinTone}
            faceStruct={faceStruct}                setFaceStruct={setFaceStruct}
            ethnicityRegion={ethnicityRegion}      setEthnicityRegion={setEthnicityRegion}
            mixedBlendRegions={mixedBlendRegions}  setMixedBlendRegions={setMixedBlendRegions}
            candidateCount={candidateCount}        setCandidateCount={setCandidateCount}
            species={species}                      setSpecies={setSpecies}
            hairIdentity={hairIdentity}            setHairIdentity={setHairIdentity}
            eyeColor={eyeColor}                    setEyeColor={setEyeColor}
            eyeType={eyeType}                      setEyeType={setEyeType}
            skinMarks={skinMarks}                  setSkinMarks={setSkinMarks}
            earType={earType}                      setEarType={setEarType}
            hornType={hornType}                    setHornType={setHornType}
            bodyType={bodyType}                    setBodyType={setBodyType}
            leftArm={leftArm}                      setLeftArm={setLeftArm}
            rightArm={rightArm}                    setRightArm={setRightArm}
            leftLeg={leftLeg}                      setLeftLeg={setLeftLeg}
            rightLeg={rightLeg}                    setRightLeg={setRightLeg}
            skinArt={skinArt}                      setSkinArt={setSkinArt}
          />
        )}
        {activeTab === "packs"  && <PacksInfoTab active={activeInfluencer} />}
        {activeTab === "refine" && <RefineTab    active={activeInfluencer} />}
      </div>
    </div>
  );
}

// ── Style category definitions ────────────────────────────────────────────────

interface CategoryDef {
  value:  StyleCategory;
  label:  string;
  emoji:  string;
  desc:   string;
  accent: string;
}

const CATEGORIES: CategoryDef[] = [
  { value: "hyper-real",       label: "Hyper Real",   emoji: "📷", desc: "Photorealistic · Camera-rendered", accent: "#f59e0b" },
  { value: "3d-animation",     label: "3D Animation", emoji: "🎬", desc: "Pixar-style · Rendered 3D",        accent: "#38bdf8" },
  { value: "anime-manga",      label: "Anime",        emoji: "✦",  desc: "Cel-shaded · 2D Japanese",        accent: "#f472b6" },
  { value: "fine-art",         label: "Fine Art",     emoji: "🖼",  desc: "Oil · Watercolor · Painterly",    accent: "#d4a054" },
  { value: "game-concept",     label: "Game Art",     emoji: "⚔",  desc: "Fantasy · Hero · Concept",        accent: "#8b5cf6" },
  { value: "physical-texture", label: "Texture",      emoji: "◈",  desc: "Fabric · Clay · Tactile",         accent: "#c2715a" },
  { value: "retro-pixel",      label: "Pixel Art",    emoji: "▪",  desc: "8-bit · Retro · Grid",            accent: "#84cc16" },
];

// ── Category card selector ────────────────────────────────────────────────────

function CategorySelector({
  value,
  onChange,
}: {
  value:    StyleCategory;
  onChange: (v: StyleCategory) => void;
}) {
  return (
    <section>
      <SectionLabel label="Style" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {CATEGORIES.map(cat => {
          const selected = value === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onChange(cat.value)}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "9px 12px", borderRadius: 9,
                border:     selected ? `1px solid ${cat.accent}55` : `1px solid ${T.border}`,
                background: selected ? `${cat.accent}10` : "rgba(255,255,255,0.02)",
                cursor: "pointer", textAlign: "left",
                transition: "all 0.14s", width: "100%",
                boxShadow: selected ? `0 0 12px ${cat.accent}14` : "none",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                background: selected ? `${cat.accent}18` : "rgba(255,255,255,0.05)",
                border: selected ? `1px solid ${cat.accent}30` : `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, transition: "all 0.14s",
              }}>
                {cat.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 13, fontWeight: selected ? 700 : 600,
                  color: selected ? cat.accent : T.text,
                  letterSpacing: "0.01em", transition: "color 0.14s",
                }}>
                  {cat.label}
                </div>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2,
                }}>
                  {cat.desc}
                </div>
              </div>
              {selected && (
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  background: cat.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <polyline points="2,5 4.2,7.5 8,3" stroke="#060810" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Builder tab — pure input UI, no API calls ─────────────────────────────────

interface BuilderTabProps {
  canvasState:      CanvasState;
  activeInfluencer: ActiveInfluencer | null;
  styleCategory:    StyleCategory;
  setStyleCategory: (v: StyleCategory) => void;
  gender:           string;
  setGender:        (v: string) => void;
  ageRange:         string;
  setAgeRange:      (v: string) => void;
  skinTone:         string;
  setSkinTone:      (v: string) => void;
  faceStruct:       string;
  setFaceStruct:    (v: string) => void;
  // Ethnicity/Region
  ethnicityRegion:      string;
  setEthnicityRegion:   (v: string) => void;
  mixedBlendRegions:    string[];
  setMixedBlendRegions: (v: string[]) => void;
  // Identity Options — candidate count
  candidateCount:    number;
  setCandidateCount: (v: number) => void;
  // Phase A — Biological Identity (core layer, inline in Builder)
  species:         string;
  setSpecies:      (v: string) => void;
  hairIdentity:    string;
  setHairIdentity: (v: string) => void;
  eyeColor:        string;
  setEyeColor:     (v: string) => void;
  eyeType:         string;
  setEyeType:      (v: string) => void;
  skinMarks:       string[];
  setSkinMarks:    (v: string[]) => void;
  earType:         string;
  setEarType:      (v: string) => void;
  hornType:        string;
  setHornType:     (v: string) => void;
  // Phase B — Body Architecture (transient casting params)
  bodyType:     string;
  setBodyType:  (v: string) => void;
  leftArm:      string;
  setLeftArm:   (v: string) => void;
  rightArm:     string;
  setRightArm:  (v: string) => void;
  leftLeg:      string;
  setLeftLeg:   (v: string) => void;
  rightLeg:     string;
  setRightLeg:  (v: string) => void;
  skinArt:      string[];
  setSkinArt:   (v: string[]) => void;
}

// ── Gender visual options ──────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "Female",      label: "Female",      icon: "♀" },
  { value: "Male",        label: "Male",        icon: "♂" },
  { value: "Non-binary",  label: "Non-binary",  icon: "⊕" },
  { value: "Androgynous", label: "Androgynous", icon: "⚥" },
] as const;

// ── Body Architecture option sets ──────────────────────────────────────────────

const BODY_TYPE_OPTIONS = ["Athletic", "Slim", "Lean", "Muscular", "Curvy", "Healthy", "Skinny"] as const;
const ARM_TYPE_OPTIONS  = ["Normal", "Robotic", "Mechanical", "Prosthetic", "No Arm"] as const;
const LEG_TYPE_OPTIONS  = ["Normal", "Robotic", "Mechanical", "Prosthetic", "No Leg"] as const;
const SKIN_ART_OPTIONS  = ["Tattoos", "Piercing", "Symbol Art", "Cyber Robotic Art"] as const;

const SKIN_TONE_LABELS: Record<string, string> = {
  "Fair":        "Fair",
  "Light warm":  "Light",
  "Medium warm": "Medium",
  "Tan olive":   "Tan",
  "Deep brown":  "Deep",
  "Rich dark":   "Dark",
};
const FACE_STRUCT_LABELS: Record<string, string> = {
  "Oval":       "Oval",
  "Heart":      "Heart",
  "Square jaw": "Square",
  "Angular":    "Angular",
  "Round":      "Round",
  "Diamond":    "Diamond",
};
const BODY_TYPE_LABELS: Record<string, string> = {
  "Athletic":  "Athletic",
  "Slim":      "Slim",
  "Lean":      "Lean",
  "Muscular":  "Muscular",
  "Curvy":     "Curvy",
  "Healthy":   "Healthy",
  "Skinny":    "Skinny",
};
const ARM_TYPE_LABELS: Record<string, string> = {
  "Normal":     "Normal",
  "Robotic":    "Robotic",
  "Mechanical": "Mech",
  "Prosthetic": "Prosthetic",
  "No Arm":     "No Arm",
};
const LEG_TYPE_LABELS: Record<string, string> = {
  "Normal":     "Normal",
  "Robotic":    "Robotic",
  "Mechanical": "Mech",
  "Prosthetic": "Prosthetic",
  "No Leg":     "No Leg",
};
const SKIN_ART_LABELS: Record<string, string> = {
  "Tattoos":           "Tattoos",
  "Piercing":          "Piercing",
  "Symbol Art":        "Symbol Art",
  "Cyber Robotic Art": "Cyber Robotic",
};

// ── Color swatches for card grids ──────────────────────────────────────────────

const SKIN_TONE_COLORS: Record<string, string> = {
  "Fair":        "#f5d5b8",
  "Light warm":  "#e8b88a",
  "Medium warm": "#c89060",
  "Tan olive":   "#a46840",
  "Deep brown":  "#6e3820",
  "Rich dark":   "#371508",
};
const EYE_COLOR_COLORS: Record<string, string> = {
  "black":       "#18181b",
  "grey":        "#7a8a9a",
  "green":       "#2e7d52",
  "brown":       "#7a4a20",
  "blue":        "#2563a8",
  "amber":       "#d08020",
  "honey-brown": "#9a6830",
  "dark-brown":  "#4a2010",
};

// ── Symbol icons for card grids ────────────────────────────────────────────────

const FACE_ICONS: Record<string, string> = {
  "Oval":       "○",
  "Heart":      "♡",
  "Square jaw": "□",
  "Angular":    "◇",
  "Round":      "●",
  "Diamond":    "◆",
};
const SPECIES_ICONS: Record<string, string> = {
  "human":           "⊙",
  "elf":             "✦",
  "alien":           "⊗",
  "animal-inspired": "◉",
  "insect-inspired": "⬡",
};
const HAIR_ICONS: Record<string, string> = {
  "long-hair":  "↕",
  "short-hair": "≡",
  "bald":       "○",
  "punk-style": "↑",
  "afro-style": "●",
  "fur":        "≈",
};
const EYE_TYPE_ICONS: Record<string, string> = {
  "human-eyes":   "○",
  "glowing-eyes": "◎",
  "reptile-eyes": "◈",
  "robotic-eyes": "⊡",
  "blind-eyes":   "—",
  "mixed-eyes":   "◐",
};
const SKIN_MARK_ICONS: Record<string, string> = {
  "freckles":      "∴",
  "birthmarks":    "◦",
  "scars":         "╳",
  "pigmentation":  "≋",
  "wrinkled-skin": "≈",
  "albinism":      "○",
};
const EAR_ICONS: Record<string, string> = {
  "human-ears":  "⊏",
  "elf-ears":    "∧",
  "winged-ears": "∽",
  "alien-ears":  "⊐",
};
const HORN_ICONS: Record<string, string> = {
  "small-horns": "∧",
  "large-horns": "⋀",
};
const BODY_TYPE_ICONS: Record<string, string> = {
  "Athletic":  "◈",
  "Slim":      "▎",
  "Lean":      "▏",
  "Muscular":  "◉",
  "Curvy":     "∿",
  "Healthy":   "○",
  "Skinny":    "│",
};
const ARM_ICONS: Record<string, string> = {
  "Normal":     "—",
  "Robotic":    "⊡",
  "Mechanical": "⚙",
  "Prosthetic": "⊢",
  "No Arm":     "╳",
};
const LEG_ICONS: Record<string, string> = {
  "Normal":     "│",
  "Robotic":    "⊡",
  "Mechanical": "⚙",
  "Prosthetic": "⊥",
  "No Leg":     "╳",
};
const SKIN_ART_ICONS: Record<string, string> = {
  "Tattoos":           "✦",
  "Piercing":          "◎",
  "Symbol Art":        "◈",
  "Cyber Robotic Art": "⊗",
};

export function BuilderTab({
  canvasState, activeInfluencer,
  styleCategory, setStyleCategory,
  gender, setGender,
  ageRange, setAgeRange,
  skinTone, setSkinTone,
  faceStruct, setFaceStruct,
  ethnicityRegion, setEthnicityRegion,
  mixedBlendRegions, setMixedBlendRegions,
  candidateCount, setCandidateCount,
  species, setSpecies,
  hairIdentity, setHairIdentity,
  eyeColor, setEyeColor,
  eyeType, setEyeType,
  skinMarks, setSkinMarks,
  earType, setEarType,
  hornType, setHornType,
  bodyType, setBodyType,
  leftArm, setLeftArm,
  rightArm, setRightArm,
  leftLeg, setLeftLeg,
  rightLeg, setRightLeg,
  skinArt, setSkinArt,
}: BuilderTabProps) {

  // Accent for the currently selected style
  const selectedCat = CATEGORIES.find(c => c.value === styleCategory)!;

  // Show compact status while generating
  if (canvasState.phase === "generating") {
    return (
      <div style={{ padding: "24px 18px" }}>
        <StatusNote icon="⟳" color={T.amber} text="Building influencer candidates…" />
      </div>
    );
  }

  // Show active influencer info
  if (activeInfluencer) {
    const activeCat = CATEGORIES.find(
      c => c.value === activeInfluencer.influencer.style_category,
    ) ?? CATEGORIES[0];

    const handle = formatHandle(activeInfluencer.influencer.handle);

    return (
      <div style={{ padding: "24px 18px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8,
          }}>
            Active Influencer
          </div>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 22, fontWeight: 800, color: T.text,
            letterSpacing: "-0.02em", marginBottom: 6,
          }}>
            {handle}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 20, marginBottom: 10,
            background: `${activeCat.accent}12`,
            border: `1px solid ${activeCat.accent}30`,
          }}>
            <span style={{ fontSize: 10 }}>{activeCat.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: activeCat.accent, letterSpacing: "0.04em" }}>
              {activeCat.label}
            </span>
          </div>
          <StatusNote icon="●" color="#10b981" text="Identity locked — packs are available" />
        </div>
        <div style={{
          padding: "12px 14px", borderRadius: 9,
          background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
          fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.65,
        }}>
          Use the pack buttons below the hero image to expand {handle}&apos;s content world.
        </div>
      </div>
    );
  }

  // ── Creation form — inputs only, no CTA here ───────────────────────────────

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Handle notice — auto-assigned ────────────────────────────── */}
      <div style={{
        padding: "10px 13px", borderRadius: 9,
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.14)",
        fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.6,
      }}>
        <span style={{ color: T.amber, fontWeight: 700 }}>@Handle auto-assigned.</span>
        {" "}Your influencer receives a unique name when created.
      </div>

      {/* ── Style Category ─────────────────────────────────────────── */}
      <CategorySelector value={styleCategory} onChange={setStyleCategory} />

      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />

      {/* ── 1. GENDER ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="Gender" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {GENDER_OPTIONS.map(g => {
            const sel = gender === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setGender(sel ? "" : g.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 9,
                  border: sel ? `1px solid ${selectedCat.accent}55` : `1px solid ${T.border}`,
                  background: sel ? `${selectedCat.accent}10` : "rgba(255,255,255,0.02)",
                  cursor: "pointer", transition: "all 0.14s",
                  boxShadow: sel ? `0 0 10px ${selectedCat.accent}12` : "none",
                }}
              >
                <span style={{ fontSize: 15, color: sel ? selectedCat.accent : "rgba(255,255,255,0.35)" }}>
                  {g.icon}
                </span>
                <span style={{
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 12, fontWeight: sel ? 700 : 500,
                  color: sel ? selectedCat.accent : "rgba(255,255,255,0.50)",
                  transition: "color 0.14s",
                }}>
                  {g.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Age Range */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            marginBottom: 7,
          }}>
            Age Range
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
            {(["18–24", "25–32", "33–40", "40+"] as const).map(age => {
              const sel = ageRange === age;
              return (
                <button
                  key={age}
                  onClick={() => setAgeRange(sel ? "" : age)}
                  style={{
                    padding: "11px 0", borderRadius: 0,
                    border: sel ? `1px solid ${selectedCat.accent}60` : "1px solid rgba(255,255,255,0.07)",
                    background: sel ? `${selectedCat.accent}12` : "rgba(255,255,255,0.025)",
                    color: sel ? selectedCat.accent : "rgba(255,255,255,0.40)",
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: 12, fontWeight: sel ? 700 : 500,
                    cursor: "pointer", transition: "all 0.13s",
                    boxShadow: sel ? `0 0 8px ${selectedCat.accent}18` : "none",
                    letterSpacing: "0.01em",
                  }}
                >
                  {age}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />

      {/* ── 2. ETHNICITY / REGION ──────────────────────────────────── */}
      <section>
        <SectionLabel label="Ethnicity / Region" />

        {/* Compact dropdown */}
        <div style={{ position: "relative" }}>
          <select
            value={ethnicityRegion}
            onChange={e => {
              setEthnicityRegion(e.target.value);
              // Reset blend when switching away from mixed
              if (e.target.value !== "mixed-ethnicity") setMixedBlendRegions([]);
            }}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#070a10",
              border: ethnicityRegion
                ? `1px solid ${selectedCat.accent}55`
                : `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 0,
              padding: "9px 32px 9px 12px",
              color: ethnicityRegion ? selectedCat.accent : "rgba(255,255,255,0.55)",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13,
              fontWeight: ethnicityRegion ? 700 : 400,
              cursor: "pointer",
              outline: "none",
              appearance: "none" as const,
              WebkitAppearance: "none" as const,
              transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <option value="">Auto</option>
            <option value="south-asian-indian">South Asian — Indian</option>
            <option value="south-asian-other">South Asian — Other</option>
            <option value="east-asian">East Asian</option>
            <option value="southeast-asian">Southeast Asian</option>
            <option value="african">African</option>
            <option value="african-american">African American</option>
            <option value="european">European</option>
            <option value="scandinavian">Scandinavian</option>
            <option value="mediterranean">Mediterranean</option>
            <option value="latin-american">Latin American</option>
            <option value="brazilian">Brazilian</option>
            <option value="middle-eastern">Middle Eastern</option>
            <option value="mixed-ethnicity">Mixed / Blended ✦</option>
          </select>
          {/* Chevron icon */}
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <polyline points="2,3.5 5,6.5 8,3.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Auto helper text */}
        {!ethnicityRegion && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
            Auto lets Zencra choose a natural identity direction from your style and creative notes.
          </div>
        )}

        {/* Mixed / Blended sub-panel */}
        {ethnicityRegion === "mixed-ethnicity" && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: selectedCat.accent,
              letterSpacing: "0.07em", textTransform: "uppercase" as const,
              marginBottom: 8,
            }}>
              Blend Regions
              <span style={{ fontWeight: 400, color: T.muted, marginLeft: 6, textTransform: "none" as const, letterSpacing: 0 }}>
                — choose 2–4
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {([
                { v: "south-asian-indian",  l: "South Asian" },
                { v: "east-asian",          l: "East Asian" },
                { v: "southeast-asian",     l: "SE Asian" },
                { v: "african",             l: "African" },
                { v: "african-american",    l: "African American" },
                { v: "european",            l: "European" },
                { v: "scandinavian",        l: "Scandinavian" },
                { v: "mediterranean",       l: "Mediterranean" },
                { v: "latin-american",      l: "Latin American" },
                { v: "middle-eastern",      l: "Middle Eastern" },
              ] as const).map(({ v, l }) => {
                const on = mixedBlendRegions.includes(v);
                const maxReached = mixedBlendRegions.length >= 4 && !on;
                return (
                  <button
                    key={v}
                    disabled={maxReached}
                    onClick={() => {
                      if (on) {
                        setMixedBlendRegions(mixedBlendRegions.filter(r => r !== v));
                      } else if (!maxReached) {
                        setMixedBlendRegions([...mixedBlendRegions, v]);
                      }
                    }}
                    style={{
                      padding: "5px 10px", borderRadius: 20,
                      border: on
                        ? `1px solid ${selectedCat.accent}70`
                        : `1px solid rgba(255,255,255,0.10)`,
                      background: on
                        ? `${selectedCat.accent}18`
                        : "rgba(255,255,255,0.03)",
                      color: on ? selectedCat.accent : "rgba(255,255,255,0.50)",
                      fontFamily: "'Familjen Grotesk', sans-serif",
                      fontSize: 11, fontWeight: on ? 700 : 400,
                      cursor: maxReached ? "not-allowed" : "pointer",
                      opacity: maxReached ? 0.38 : 1,
                      transition: "all 0.13s",
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            {mixedBlendRegions.length < 2 && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
                Select at least 2 regions to activate blended-heritage genetics.
              </div>
            )}
            {mixedBlendRegions.length >= 2 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 7, lineHeight: 1.5 }}>
                ✦ Blending {mixedBlendRegions.length} regions — authentic heritage, no stereotype.
              </div>
            )}
          </div>
        )}

        {/* Standard helper when a single region is selected */}
        {ethnicityRegion && ethnicityRegion !== "mixed-ethnicity" && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
            Shapes facial genetics in the prompt and selects a region-matched name.
          </div>
        )}
      </section>

      {/* ── 3. BIOLOGICAL IDENTITY ─────────────────────────────────────── */}
      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />
      <section>
        <SectionLabel label="Biological Identity" />
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.40)",
          marginBottom: 14, lineHeight: 1.55,
        }}>
          Genetic-layer traits — injected before body architecture.
        </div>

        {/* Skin Tone */}
        <AdvSection label="Skin Tone">
          <CardGrid
            options={["Fair", "Light warm", "Medium warm", "Tan olive", "Deep brown", "Rich dark"]}
            labels={SKIN_TONE_LABELS}
            colorMap={SKIN_TONE_COLORS}
            value={skinTone}
            onChange={setSkinTone}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Face Structure */}
        <AdvSection label="Face Structure">
          <CardGrid
            options={["Oval", "Heart", "Square jaw", "Angular", "Round", "Diamond"]}
            labels={FACE_STRUCT_LABELS}
            icons={FACE_ICONS}
            value={faceStruct}
            onChange={setFaceStruct}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Species · Origin */}
        <AdvSection label="Species · Origin">
          <CardGrid
            options={["human","elf","alien","animal-inspired","insect-inspired"]}
            labels={SPECIES_LABELS}
            icons={SPECIES_ICONS}
            value={species}
            onChange={setSpecies}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Hair Identity */}
        <AdvSection label="Hair Identity">
          <CardGrid
            options={["long-hair","short-hair","bald","punk-style","afro-style","fur"]}
            labels={HAIR_LABELS}
            icons={HAIR_ICONS}
            value={hairIdentity}
            onChange={setHairIdentity}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Eye Color */}
        <AdvSection label="Eye Color">
          <CardGrid
            options={["black","grey","green","brown","blue","amber","honey-brown","dark-brown"]}
            labels={EYE_COLOR_LABELS}
            colorMap={EYE_COLOR_COLORS}
            value={eyeColor}
            onChange={setEyeColor}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Eye Type */}
        <AdvSection label="Eye Type">
          <CardGrid
            options={["human-eyes","glowing-eyes","reptile-eyes","robotic-eyes","blind-eyes","mixed-eyes"]}
            labels={EYE_TYPE_LABELS}
            icons={EYE_TYPE_ICONS}
            value={eyeType}
            onChange={setEyeType}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Skin Marks — multi-select */}
        <AdvSection label="Skin Marks">
          <MultiCardGrid
            options={["freckles","birthmarks","scars","pigmentation","wrinkled-skin","albinism"]}
            labels={SKIN_MARK_LABELS}
            icons={SKIN_MARK_ICONS}
            selected={skinMarks}
            onToggle={v => setSkinMarks(
              skinMarks.includes(v) ? skinMarks.filter(m => m !== v) : [...skinMarks, v]
            )}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Ears */}
        <AdvSection label="Ears">
          <CardGrid
            options={["human-ears","elf-ears","winged-ears","alien-ears"]}
            labels={EAR_LABELS}
            icons={EAR_ICONS}
            value={earType}
            onChange={setEarType}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Horns — optional */}
        <AdvSection label="Horns" badge="Optional">
          <CardGrid
            options={["small-horns","large-horns"]}
            labels={HORN_LABELS}
            icons={HORN_ICONS}
            value={hornType}
            onChange={setHornType}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>
      </section>

      {/* ── 4. BODY ARCHITECTURE ───────────────────────────────────────── */}
      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />
      <section>
        <SectionLabel label="Body Architecture" />
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.3)",
          marginBottom: 14, lineHeight: 1.55,
        }}>
          Build cues — subtle secondary layer, never overrides facial identity.
        </div>

        {/* Body Type */}
        <AdvSection label="Body Type">
          <CardGrid
            options={[...BODY_TYPE_OPTIONS]}
            labels={BODY_TYPE_LABELS}
            icons={BODY_TYPE_ICONS}
            value={bodyType}
            onChange={setBodyType}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Left Arm */}
        <AdvSection label="Left Arm">
          <CardGrid
            options={[...ARM_TYPE_OPTIONS]}
            labels={ARM_TYPE_LABELS}
            icons={ARM_ICONS}
            value={leftArm}
            onChange={setLeftArm}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Right Arm */}
        <AdvSection label="Right Arm">
          <CardGrid
            options={[...ARM_TYPE_OPTIONS]}
            labels={ARM_TYPE_LABELS}
            icons={ARM_ICONS}
            value={rightArm}
            onChange={setRightArm}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Left Leg */}
        <AdvSection label="Left Leg">
          <CardGrid
            options={[...LEG_TYPE_OPTIONS]}
            labels={LEG_TYPE_LABELS}
            icons={LEG_ICONS}
            value={leftLeg}
            onChange={setLeftLeg}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Right Leg */}
        <AdvSection label="Right Leg">
          <CardGrid
            options={[...LEG_TYPE_OPTIONS]}
            labels={LEG_TYPE_LABELS}
            icons={LEG_ICONS}
            value={rightLeg}
            onChange={setRightLeg}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>
      </section>

      {/* ── 5. SKIN ART ────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />
      <section>
        <SectionLabel label="Skin Art" />
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.3)",
          marginBottom: 12, lineHeight: 1.55,
        }}>
          Optional body art — multi-select.
        </div>
        <MultiCardGrid
          options={[...SKIN_ART_OPTIONS]}
          labels={SKIN_ART_LABELS}
          icons={SKIN_ART_ICONS}
          selected={skinArt}
          onToggle={v => setSkinArt(skinArt.includes(v) ? skinArt.filter(s => s !== v) : [...skinArt, v])}
          accent={selectedCat.accent}
          cols={2}
        />
      </section>

      {/* ── Identity Options — candidate count selector ─────────────────── */}
      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />
      <section>
        <SectionLabel label="Identity Options" />
        <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
          {([1, 2, 3, 4] as const).map(n => {
            const selected = candidateCount === n;
            return (
              <button
                key={n}
                onClick={() => setCandidateCount(n)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  border: selected
                    ? `1px solid rgba(245,158,11,0.60)`
                    : `1px solid rgba(255,255,255,0.09)`,
                  background: selected ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                  color: selected ? T.amber : "#5a6280",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 0.15s",
                }}
              >
                {n}×
              </button>
            );
          })}
        </div>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 10, color: "rgba(255,255,255,0.38)", textAlign: "center",
          letterSpacing: "0.02em",
        }}>
          {candidateCount * 8} cr total · {candidateCount} candidate{candidateCount > 1 ? "s" : ""}
        </div>
      </section>

      {/* CTA pointer — creation is in the canvas dock button */}
      <div style={{
        padding: "10px 13px", borderRadius: 9,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.6, textAlign: "center",
      }}>
        Use the <span style={{ color: T.text, fontWeight: 600 }}>Create Influencer</span> button in the canvas to generate.
      </div>
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
    { label: "Identity Sheet",  desc: "5-angle character reference sheet",    accent: "#e2e8f0" },
    { label: "Look Pack",       desc: "Outfit variations, same identity",      accent: "#f59e0b" },
    { label: "Scene Pack",      desc: "Different environments, identity held", accent: "#10b981" },
    { label: "Pose Pack",       desc: "Body positions and movement",           accent: "#3b82f6" },
    { label: "Social Pack",     desc: "9:16 · 1:1 · 16:9 ready formats",      accent: "#a855f7" },
  ];

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4,
      }}>
        Available Packs
      </div>
      {packs.map(p => (
        <div key={p.label} style={{
          padding: "11px 13px", borderRadius: 9,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.accent }}>{p.label}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{p.desc}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginTop: 6, lineHeight: 1.6 }}>
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
      <div style={{
        fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14,
      }}>
        Refine Identity
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 20 }}>
        Generate a variation of the hero image while preserving the core identity.
        Identity lock is always maintained.
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

// ── Advanced tab — Phase A: Biological Identity Layer ─────────────────────────

// ── Phase A option labels ─────────────────────────────────────────────────────
// Display labels matching the locked option values.

const SPECIES_LABELS: Record<string, string> = {
  "human":          "Human",
  "elf":            "Elf",
  "alien":          "Alien",
  "animal-inspired":"Animal",
  "insect-inspired":"Insect",
};
const HAIR_LABELS: Record<string, string> = {
  "long-hair":  "Long",
  "short-hair": "Short",
  "bald":       "Bald",
  "punk-style": "Punk",
  "afro-style": "Afro",
  "fur":        "Fur",
};
const EYE_COLOR_LABELS: Record<string, string> = {
  "black":      "Black",
  "grey":       "Grey",
  "green":      "Green",
  "brown":      "Brown",
  "blue":       "Blue",
  "amber":      "Amber",
  "honey-brown":"Honey",
  "dark-brown": "Dark Brown",
};
const EYE_TYPE_LABELS: Record<string, string> = {
  "human-eyes":   "Human",
  "glowing-eyes": "Glowing",
  "reptile-eyes": "Reptile",
  "robotic-eyes": "Robotic",
  "blind-eyes":   "Blind",
  "mixed-eyes":   "Mixed",
};
const SKIN_MARK_LABELS: Record<string, string> = {
  "freckles":      "Freckles",
  "birthmarks":    "Birthmarks",
  "scars":         "Scars",
  "pigmentation":  "Pigmentation",
  "wrinkled-skin": "Wrinkled",
  "albinism":      "Albinism",
};
const EAR_LABELS: Record<string, string> = {
  "human-ears":  "Human",
  "elf-ears":    "Elf",
  "winged-ears": "Winged",
  "alien-ears":  "Alien",
};
const HORN_LABELS: Record<string, string> = {
  "small-horns": "Small",
  "large-horns": "Large",
};

// ── Collapsible section ────────────────────────────────────────────────────────

function AdvSection({
  label,
  badge,
  children,
}: {
  label:    string;
  badge?:   string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 18px", background: "none", border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 11, fontWeight: 700,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {label}
          </span>
          {badge && (
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 10, fontWeight: 700, color: T.amber,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.22)",
              padding: "1px 6px", borderRadius: 0, letterSpacing: "0.06em",
            }}>
              {badge}
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s" }}
        >
          <polyline points="2,4 6,8 10,4" stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: "4px 0 16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Single-select card grid (icon cell + label, zero border-radius) ───────────

function CardGrid({
  options, labels, icons, colorMap, value, onChange, accent, cols = 2,
}: {
  options:   string[];
  labels:    Record<string, string>;
  icons?:    Record<string, string>;
  colorMap?: Record<string, string>;
  value:     string;
  onChange:  (v: string) => void;
  accent:    string;
  cols?:     number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 5 }}>
      {options.map(opt => {
        const sel = value === opt;
        const icon   = icons?.[opt];
        const color  = colorMap?.[opt];
        const hasVis = !!(icon || color);
        return (
          <button
            key={opt}
            onClick={() => onChange(sel ? "" : opt)}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 6, padding: hasVis ? "11px 6px" : "11px 8px",
              borderRadius: 0,
              border:     sel ? `1px solid ${accent}60` : "1px solid rgba(255,255,255,0.07)",
              background: sel ? `${accent}12`           : "rgba(255,255,255,0.025)",
              cursor: "pointer", transition: "all 0.14s",
              boxShadow: sel ? `0 0 8px ${accent}18` : "none",
            }}
          >
            {/* Color swatch icon cell */}
            {color && (
              <div style={{
                width: 34, height: 34, flexShrink: 0,
                background: sel ? `${accent}18` : "rgba(255,255,255,0.05)",
                border: sel ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 0,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 0 2px rgba(255,255,255,${sel ? 0.22 : 0.08})`,
                }} />
              </div>
            )}
            {/* Unicode symbol icon cell */}
            {icon && !color && (
              <div style={{
                width: 34, height: 34, flexShrink: 0,
                background: sel ? `${accent}18` : "rgba(255,255,255,0.05)",
                border: sel ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 0,
                fontSize: 15, color: sel ? accent : "rgba(255,255,255,0.38)",
              }}>
                {icon}
              </div>
            )}
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 10, fontWeight: sel ? 700 : 500,
              color:    sel ? accent : "rgba(255,255,255,0.42)",
              textAlign: "center" as const, lineHeight: 1.25,
              letterSpacing: "0.01em",
            }}>
              {labels[opt] ?? opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Multi-select card grid (icon cell + label, zero border-radius) ─────────────

function MultiCardGrid({
  options, labels, icons, selected, onToggle, accent, cols = 2,
}: {
  options:  string[];
  labels:   Record<string, string>;
  icons?:   Record<string, string>;
  selected: string[];
  onToggle: (v: string) => void;
  accent:   string;
  cols?:    number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 5 }}>
      {options.map(opt => {
        const sel  = selected.includes(opt);
        const icon = icons?.[opt];
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 6, padding: icon ? "11px 6px" : "11px 8px",
              borderRadius: 0,
              border:     sel ? `1px solid ${accent}60` : "1px solid rgba(255,255,255,0.07)",
              background: sel ? `${accent}12`           : "rgba(255,255,255,0.025)",
              cursor: "pointer", transition: "all 0.14s",
              boxShadow: sel ? `0 0 8px ${accent}18` : "none",
            }}
          >
            {icon && (
              <div style={{
                width: 34, height: 34, flexShrink: 0,
                background: sel ? `${accent}18` : "rgba(255,255,255,0.05)",
                border: sel ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 0,
                fontSize: 15, color: sel ? accent : "rgba(255,255,255,0.38)",
              }}>
                {icon}
              </div>
            )}
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 10, fontWeight: sel ? 700 : 500,
              color:    sel ? accent : "rgba(255,255,255,0.42)",
              textAlign: "center" as const, lineHeight: 1.25,
              letterSpacing: "0.01em",
            }}>
              {labels[opt] ?? opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Single-select chip group (0 border-radius, premium dark) ──────────────────

function AdvSingleChips({
  options,
  labels,
  value,
  onChange,
  accent,
}: {
  options:  string[];
  labels:   Record<string, string>;
  value:    string;
  onChange: (v: string) => void;
  accent:   string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(active ? "" : opt)}
            style={{
              padding: "5px 11px", borderRadius: 0,
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12, fontWeight: active ? 700 : 500,
              border:     active ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.09)",
              background: active ? `${accent}18` : "rgba(255,255,255,0.025)",
              color:      active ? accent : "rgba(255,255,255,0.42)",
              cursor: "pointer", transition: "all 0.13s",
              letterSpacing: "0.01em",
            }}
          >
            {labels[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Multi-select chip group (0 border-radius, same accent) ───────────────────

function AdvMultiChips({
  options,
  labels,
  selected,
  onToggle,
  accent,
}: {
  options:  string[];
  labels:   Record<string, string>;
  selected: string[];
  onToggle: (v: string) => void;
  accent:   string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: "5px 11px", borderRadius: 0,
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12, fontWeight: active ? 700 : 500,
              border:     active ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.09)",
              background: active ? `${accent}18` : "rgba(255,255,255,0.025)",
              color:      active ? accent : "rgba(255,255,255,0.42)",
              cursor: "pointer", transition: "all 0.13s",
              letterSpacing: "0.01em",
            }}
          >
            {labels[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: "'Syne', sans-serif",
      fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.70)",
      letterSpacing: "0.10em", textTransform: "uppercase",
      marginBottom: 12,
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
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt || label}</option>
      ))}
    </select>
  );
}

function ChipGroup({
  options, selected, onToggle, accent = T.amber,
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; accent?: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: "6px 12px",
              fontFamily: "'Familjen Grotesk', sans-serif",
              border:     active ? `1px solid ${accent}66` : `1px solid rgba(255,255,255,0.09)`,
              background: active ? `${accent}18` : "rgba(255,255,255,0.03)",
              color:      active ? accent : "#5a6280",
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
              letterSpacing: active ? "0.01em" : "0",
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

// Suppress unused-import warning for STYLE_CATEGORY_VALUES
void STYLE_CATEGORY_VALUES;
