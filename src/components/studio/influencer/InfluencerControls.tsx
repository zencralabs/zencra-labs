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

// ── Visual card option type (image-ready, no icons) ────────────────────────────

interface VisualCardOption {
  value:    string;
  label:    string;
  preview?: string;  // /character-traits/*.webp — loaded at runtime, missing = silent fallback
  bgColor?: string;  // CSS background — hex fill, gradient, or fallback when preview absent
  accent?:  string;  // per-option accent override (used for style cards with unique palette)
}

// ── Style categories — cinematic preview cards ────────────────────────────────

const STYLE_VC: VisualCardOption[] = [
  { value: "hyper-real",       label: "Hyper Real",   accent: "#f59e0b", preview: "/character-traits/style-hyper-real.webp",    bgColor: "linear-gradient(145deg, #2e1f0a 0%, #1a0c04 100%)" },
  { value: "3d-animation",     label: "3D Animation", accent: "#38bdf8", preview: "/character-traits/style-3d-animation.webp",  bgColor: "linear-gradient(145deg, #081828 0%, #041018 100%)" },
  { value: "anime-manga",      label: "Anime",        accent: "#f472b6", preview: "/character-traits/style-anime.webp",         bgColor: "linear-gradient(145deg, #280818 0%, #14040e 100%)" },
  { value: "fine-art",         label: "Fine Art",     accent: "#d4a054", preview: "/character-traits/style-fine-art.webp",      bgColor: "linear-gradient(145deg, #201408 0%, #120c04 100%)" },
  { value: "game-concept",     label: "Game Art",     accent: "#8b5cf6", preview: "/character-traits/style-game-art.webp",      bgColor: "linear-gradient(145deg, #180828 0%, #0c0418 100%)" },
  { value: "physical-texture", label: "Texture",      accent: "#c2715a", preview: "/character-traits/style-texture.webp",       bgColor: "linear-gradient(145deg, #1e0e08 0%, #120806 100%)" },
  { value: "retro-pixel",      label: "Pixel Art",    accent: "#84cc16", preview: "/character-traits/style-pixel-art.webp",     bgColor: "linear-gradient(145deg, #081808 0%, #040e04 100%)" },
];

// ── Age range — human-readable labels ─────────────────────────────────────────

const AGE_RANGE_VC: VisualCardOption[] = [
  { value: "18–24", label: "Teenage" },
  { value: "25–32", label: "Young"   },
  { value: "33–40", label: "Mature"  },
  { value: "40+",   label: "Senior"  },
];

// ── Ethnicity / Region — 10 visual grid cards ─────────────────────────────────

const ETHNICITY_VC: VisualCardOption[] = [
  { value: "south-asian-indian", label: "Indian",       preview: "/character-traits/ethnicity-indian.webp",       bgColor: "linear-gradient(145deg, #2a1408 0%, #180c04 100%)" },
  { value: "american",           label: "American",     preview: "/character-traits/ethnicity-american.webp",     bgColor: "linear-gradient(145deg, #081428 0%, #040c18 100%)" },
  { value: "southeast-asian",    label: "Asian",        preview: "/character-traits/ethnicity-asian.webp",        bgColor: "linear-gradient(145deg, #081e10 0%, #041208 100%)" },
  { value: "middle-eastern",     label: "Middle East",  preview: "/character-traits/ethnicity-middle-east.webp",  bgColor: "linear-gradient(145deg, #281e08 0%, #181204 100%)" },
  { value: "european",           label: "European",     preview: "/character-traits/ethnicity-european.webp",     bgColor: "linear-gradient(145deg, #081828 0%, #041018 100%)" },
  { value: "brazilian",          label: "Brazilian",    preview: "/character-traits/ethnicity-brazilian.webp",    bgColor: "linear-gradient(145deg, #0e2008 0%, #081404 100%)" },
  { value: "african",            label: "African",      preview: "/character-traits/ethnicity-african.webp",      bgColor: "linear-gradient(145deg, #1e0e04 0%, #120804 100%)" },
  { value: "african-american",   label: "Afro American",preview: "/character-traits/ethnicity-afro-american.webp",bgColor: "linear-gradient(145deg, #1a0e06 0%, #0e0804 100%)" },
  { value: "east-asian",         label: "East Asian",   preview: "/character-traits/ethnicity-east-asian.webp",   bgColor: "linear-gradient(145deg, #200818 0%, #14040e 100%)" },
  { value: "mixed-ethnicity",    label: "Mix-Blended",  preview: "/character-traits/ethnicity-mix-blended.webp",  bgColor: "linear-gradient(145deg, #181028 0%, #0c0818 100%)" },
];

// ── Skin tone — luxury muted palette ──────────────────────────────────────────

const SKIN_TONE_VC: VisualCardOption[] = [
  { value: "Fair",        label: "Fair",   bgColor: "#e8ccb0" },
  { value: "Light warm",  label: "Light",  bgColor: "#c99568" },
  { value: "Medium warm", label: "Medium", bgColor: "#a57048" },
  { value: "Tan olive",   label: "Tan",    bgColor: "#7a5035" },
  { value: "Deep brown",  label: "Deep",   bgColor: "#4a2818" },
  { value: "Rich dark",   label: "Dark",   bgColor: "#200e06" },
];

// ── Eye color — iris radial gradient ──────────────────────────────────────────

const EYE_COLOR_VC: VisualCardOption[] = [
  { value: "black",       label: "Black",    preview: "/character-traits/eye-black.webp",      bgColor: "radial-gradient(ellipse at 50% 55%, #303038 30%, #080810 100%)" },
  { value: "grey",        label: "Grey",     preview: "/character-traits/eye-grey.webp",       bgColor: "radial-gradient(ellipse at 50% 55%, #8a9aaa 28%, #1e2028 100%)" },
  { value: "green",       label: "Green",    preview: "/character-traits/eye-green.webp",      bgColor: "radial-gradient(ellipse at 50% 55%, #3a8a58 28%, #0c1810 100%)" },
  { value: "brown",       label: "Brown",    preview: "/character-traits/eye-brown.webp",      bgColor: "radial-gradient(ellipse at 50% 55%, #8a5428 28%, #1a0e08 100%)" },
  { value: "blue",        label: "Blue",     preview: "/character-traits/eye-blue.webp",       bgColor: "radial-gradient(ellipse at 50% 55%, #2a68b8 28%, #08101e 100%)" },
  { value: "amber",       label: "Amber",    preview: "/character-traits/eye-amber.webp",      bgColor: "radial-gradient(ellipse at 50% 55%, #d89030 28%, #1e1208 100%)" },
  { value: "honey-brown", label: "Honey",    preview: "/character-traits/eye-honey-brown.webp",bgColor: "radial-gradient(ellipse at 50% 55%, #a07838 28%, #1a1008 100%)" },
  { value: "dark-brown",  label: "Dark Brn", preview: "/character-traits/eye-dark-brown.webp", bgColor: "radial-gradient(ellipse at 50% 55%, #543020 28%, #140a06 100%)" },
];

// ── Non-color visual card option arrays ───────────────────────────────────────

const FACE_VC: VisualCardOption[] = [
  { value: "Oval",       label: "Oval"    },
  { value: "Heart",      label: "Heart"   },
  { value: "Square jaw", label: "Square"  },
  { value: "Angular",    label: "Angular" },
  { value: "Round",      label: "Round"   },
  { value: "Diamond",    label: "Diamond" },
];

const SPECIES_VC: VisualCardOption[] = [
  { value: "human",           label: "Human"  },
  { value: "elf",             label: "Elf"    },
  { value: "alien",           label: "Alien"  },
  { value: "animal-inspired", label: "Animal" },
  { value: "insect-inspired", label: "Insect" },
];

const HAIR_VC: VisualCardOption[] = [
  { value: "long-hair",  label: "Long"  },
  { value: "short-hair", label: "Short" },
  { value: "bald",       label: "Bald"  },
  { value: "punk-style", label: "Punk"  },
  { value: "afro-style", label: "Afro"  },
  { value: "fur",        label: "Fur"   },
];

const EYE_TYPE_VC: VisualCardOption[] = [
  { value: "human-eyes",   label: "Human"   },
  { value: "glowing-eyes", label: "Glowing" },
  { value: "reptile-eyes", label: "Reptile" },
  { value: "robotic-eyes", label: "Robotic" },
  { value: "blind-eyes",   label: "Blind"   },
  { value: "mixed-eyes",   label: "Mixed"   },
];

const SKIN_MARK_VC: VisualCardOption[] = [
  { value: "freckles",      label: "Freckles"    },
  { value: "birthmarks",    label: "Birthmarks"  },
  { value: "scars",         label: "Scars"       },
  { value: "pigmentation",  label: "Pigmentation"},
  { value: "wrinkled-skin", label: "Wrinkled"    },
  { value: "albinism",      label: "Albinism"    },
];

const EAR_VC: VisualCardOption[] = [
  { value: "human-ears",  label: "Human"  },
  { value: "elf-ears",    label: "Elf"    },
  { value: "winged-ears", label: "Winged" },
  { value: "alien-ears",  label: "Alien"  },
];

const HORN_VC: VisualCardOption[] = [
  { value: "small-horns", label: "Small" },
  { value: "large-horns", label: "Large" },
];

const BODY_TYPE_VC: VisualCardOption[] = [
  { value: "Athletic",  label: "Athletic"  },
  { value: "Slim",      label: "Slim"      },
  { value: "Lean",      label: "Lean"      },
  { value: "Muscular",  label: "Muscular"  },
  { value: "Curvy",     label: "Curvy"     },
  { value: "Healthy",   label: "Healthy"   },
  { value: "Skinny",    label: "Skinny"    },
];

const ARM_VC: VisualCardOption[] = [
  { value: "Normal",     label: "Normal"     },
  { value: "Robotic",    label: "Robotic"    },
  { value: "Mechanical", label: "Mechanical" },
  { value: "Prosthetic", label: "Prosthetic" },
  { value: "No Arm",     label: "No Arm"     },
];

const LEG_VC: VisualCardOption[] = [
  { value: "Normal",     label: "Normal"     },
  { value: "Robotic",    label: "Robotic"    },
  { value: "Mechanical", label: "Mechanical" },
  { value: "Prosthetic", label: "Prosthetic" },
  { value: "No Leg",     label: "No Leg"     },
];

const SKIN_ART_VC: VisualCardOption[] = [
  { value: "Tattoos",           label: "Tattoos"       },
  { value: "Piercing",          label: "Piercing"      },
  { value: "Symbol Art",        label: "Symbol Art"    },
  { value: "Cyber Robotic Art", label: "Cyber Robotic" },
];

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

      {/* ── Style Category — cinematic 2-col grid ──────────────────── */}
      <section>
        <SectionLabel label="Style" />
        <VisualCardGrid
          options={STYLE_VC}
          value={styleCategory}
          onChange={v => setStyleCategory(v as typeof styleCategory)}
          accent={selectedCat.accent}
          cols={2}
        />
      </section>

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
          <VisualCardGrid
            options={AGE_RANGE_VC}
            value={ageRange}
            onChange={setAgeRange}
            accent={selectedCat.accent}
            cols={2}
          />
        </div>
      </section>

      <div style={{ height: 1, background: T.border, margin: "0 -2px" }} />

      {/* ── 2. ETHNICITY / REGION ──────────────────────────────────── */}
      <section>
        <SectionLabel label="Ethnicity / Region" />

        {/* 10-card 2-col visual grid */}
        <VisualCardGrid
          options={ETHNICITY_VC}
          value={ethnicityRegion}
          onChange={v => {
            setEthnicityRegion(v === ethnicityRegion ? "" : v);
            if (v !== "mixed-ethnicity") setMixedBlendRegions([]);
          }}
          accent={selectedCat.accent}
          cols={2}
        />

        {/* Mix-Blended sub-panel */}
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
          <VisualCardGrid
            options={SKIN_TONE_VC}
            value={skinTone}
            onChange={setSkinTone}
            accent={selectedCat.accent}
            cols={3}
          />
        </AdvSection>

        {/* Face Structure */}
        <AdvSection label="Face Structure">
          <VisualCardGrid
            options={FACE_VC}
            value={faceStruct}
            onChange={setFaceStruct}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Species · Origin */}
        <AdvSection label="Species · Origin">
          <VisualCardGrid
            options={SPECIES_VC}
            value={species}
            onChange={setSpecies}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Hair Identity */}
        <AdvSection label="Hair Identity">
          <VisualCardGrid
            options={HAIR_VC}
            value={hairIdentity}
            onChange={setHairIdentity}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Eye Color */}
        <AdvSection label="Eye Color">
          <VisualCardGrid
            options={EYE_COLOR_VC}
            value={eyeColor}
            onChange={setEyeColor}
            accent={selectedCat.accent}
            cols={4}
          />
        </AdvSection>

        {/* Eye Type */}
        <AdvSection label="Eye Type">
          <VisualCardGrid
            options={EYE_TYPE_VC}
            value={eyeType}
            onChange={setEyeType}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Skin Marks — multi-select */}
        <AdvSection label="Skin Marks">
          <VisualMultiGrid
            options={SKIN_MARK_VC}
            selected={skinMarks}
            onToggle={v => setSkinMarks(
              skinMarks.includes(v) ? skinMarks.filter(m => m !== v) : [...skinMarks, v]
            )}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Ears */}
        <AdvSection label="Ears">
          <VisualCardGrid
            options={EAR_VC}
            value={earType}
            onChange={setEarType}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Horns — optional */}
        <AdvSection label="Horns" badge="Optional">
          <VisualCardGrid
            options={HORN_VC}
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
          <VisualCardGrid
            options={BODY_TYPE_VC}
            value={bodyType}
            onChange={setBodyType}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Left Arm */}
        <AdvSection label="Left Arm">
          <VisualCardGrid
            options={ARM_VC}
            value={leftArm}
            onChange={setLeftArm}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Right Arm */}
        <AdvSection label="Right Arm">
          <VisualCardGrid
            options={ARM_VC}
            value={rightArm}
            onChange={setRightArm}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Left Leg */}
        <AdvSection label="Left Leg">
          <VisualCardGrid
            options={LEG_VC}
            value={leftLeg}
            onChange={setLeftLeg}
            accent={selectedCat.accent}
            cols={2}
          />
        </AdvSection>

        {/* Right Leg */}
        <AdvSection label="Right Leg">
          <VisualCardGrid
            options={LEG_VC}
            value={rightLeg}
            onChange={setRightLeg}
            accent={selectedCat.accent}
            cols={2}
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
        <VisualMultiGrid
          options={SKIN_ART_VC}
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

// ── Visual single-select card grid (62px visual area + label, borderRadius: 9) ──
// Supports: preview image (with onError fallback), bgColor fill/gradient, per-option accent

function VisualCardGrid({
  options, value, onChange, accent, cols = 2,
}: {
  options:  VisualCardOption[];
  value:    string;
  onChange: (v: string) => void;
  accent:   string;
  cols?:    number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {options.map(opt => {
        const sel = value === opt.value;
        const a   = opt.accent || accent; // per-card accent override
        return (
          <button
            key={opt.value}
            onClick={() => onChange(sel ? "" : opt.value)}
            style={{
              display: "flex", flexDirection: "column",
              borderRadius: 9, overflow: "hidden", padding: 0,
              border:     sel ? `1px solid ${a}55` : "1px solid rgba(255,255,255,0.07)",
              background: sel ? `${a}08`           : "rgba(255,255,255,0.02)",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: sel ? `0 0 12px ${a}18` : "none",
            }}
          >
            {/* Visual area — bgColor as base, preview img layers on top with onError fallback */}
            <div style={{
              height: 62, flexShrink: 0, position: "relative", overflow: "hidden",
              background: opt.bgColor
                ? opt.bgColor
                : "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
            }}>
              {opt.preview && (
                <img
                  src={opt.preview}
                  alt={opt.label}
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              {/* Accent bleed overlay — always on top of image/fill */}
              <div style={{
                position: "absolute", inset: 0,
                background: sel
                  ? `linear-gradient(to top, ${a}30, transparent 65%)`
                  : "linear-gradient(to top, rgba(0,0,0,0.30), transparent 70%)",
                transition: "all 0.15s",
              }} />
            </div>
            {/* Label band */}
            <div style={{
              padding: "7px 6px",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, fontWeight: sel ? 700 : 500,
              color:    sel ? a : "rgba(255,255,255,0.45)",
              textAlign: "center", lineHeight: 1.2,
              background: sel ? `${a}06` : "rgba(0,0,0,0.18)",
              transition: "all 0.15s",
            }}>
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Visual multi-select card grid (same design, multi-select) ─────────────────

function VisualMultiGrid({
  options, selected, onToggle, accent, cols = 2,
}: {
  options:  VisualCardOption[];
  selected: string[];
  onToggle: (v: string) => void;
  accent:   string;
  cols?:    number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {options.map(opt => {
        const sel = selected.includes(opt.value);
        const a   = opt.accent || accent;
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            style={{
              display: "flex", flexDirection: "column",
              borderRadius: 9, overflow: "hidden", padding: 0,
              border:     sel ? `1px solid ${a}55` : "1px solid rgba(255,255,255,0.07)",
              background: sel ? `${a}08`           : "rgba(255,255,255,0.02)",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: sel ? `0 0 12px ${a}18` : "none",
            }}
          >
            <div style={{
              height: 62, flexShrink: 0, position: "relative", overflow: "hidden",
              background: opt.bgColor
                ? opt.bgColor
                : "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
            }}>
              {opt.preview && (
                <img
                  src={opt.preview}
                  alt={opt.label}
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div style={{
                position: "absolute", inset: 0,
                background: sel
                  ? `linear-gradient(to top, ${a}30, transparent 65%)`
                  : "linear-gradient(to top, rgba(0,0,0,0.30), transparent 70%)",
                transition: "all 0.15s",
              }} />
            </div>
            <div style={{
              padding: "7px 6px",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, fontWeight: sel ? 700 : 500,
              color:    sel ? a : "rgba(255,255,255,0.45)",
              textAlign: "center", lineHeight: 1.2,
              background: sel ? `${a}06` : "rgba(0,0,0,0.18)",
              transition: "all 0.15s",
            }}>
              {opt.label}
            </div>
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
