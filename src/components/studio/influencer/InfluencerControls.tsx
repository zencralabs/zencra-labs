"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Controls — Right panel
// Tabs: Builder | Packs | Refine | Advanced
//
// Builder tab is a PURE INPUT UI — no API calls, no loading, no error state.
// All form state lives in AIInfluencerBuilder (lifted) and is passed in.
// Creation is triggered by the canvas dock button → handleCreateInfluencer().
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

type ControlTab = "builder" | "packs" | "refine" | "advanced";

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
  fashion:          string;
  setFashion:       (v: string) => void;
  realism:          string;
  setRealism:       (v: string) => void;
  mood:             string[];
  setMood:          (v: string[]) => void;
  platforms:        string[];
  setPlatforms:     (v: string[]) => void;
  notes:            string;
  setNotes:         (v: string) => void;
  // Ethnicity/Region — drives region-aware naming + facial genetics in prompts
  ethnicityRegion:      string;
  setEthnicityRegion:   (v: string) => void;
  mixedBlendRegions:    string[];
  setMixedBlendRegions: (v: string[]) => void;
  // Identity Options — candidate count (1–4, default 4)
  candidateCount:    number;
  setCandidateCount: (v: number) => void;
  // Library tags — used for AI Talent Roster filtering
  tags:    string[];
  setTags: (v: string[]) => void;
}

export default function InfluencerControls({
  canvasState, activeInfluencer,
  styleCategory, setStyleCategory,
  gender, setGender,
  ageRange, setAgeRange,
  skinTone, setSkinTone,
  faceStruct, setFaceStruct,
  fashion, setFashion,
  realism, setRealism,
  mood, setMood,
  platforms, setPlatforms,
  notes, setNotes,
  ethnicityRegion, setEthnicityRegion,
  mixedBlendRegions, setMixedBlendRegions,
  candidateCount, setCandidateCount,
  tags, setTags,
}: Props) {
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
        {activeTab === "builder"  && (
          <BuilderTab
            canvasState={canvasState}
            activeInfluencer={activeInfluencer}
            styleCategory={styleCategory}          setStyleCategory={setStyleCategory}
            gender={gender}                        setGender={setGender}
            ageRange={ageRange}                    setAgeRange={setAgeRange}
            skinTone={skinTone}                    setSkinTone={setSkinTone}
            faceStruct={faceStruct}                setFaceStruct={setFaceStruct}
            fashion={fashion}                      setFashion={setFashion}
            realism={realism}                      setRealism={setRealism}
            mood={mood}                            setMood={setMood}
            platforms={platforms}                  setPlatforms={setPlatforms}
            notes={notes}                          setNotes={setNotes}
            ethnicityRegion={ethnicityRegion}           setEthnicityRegion={setEthnicityRegion}
            mixedBlendRegions={mixedBlendRegions}      setMixedBlendRegions={setMixedBlendRegions}
            candidateCount={candidateCount}            setCandidateCount={setCandidateCount}
            tags={tags}                            setTags={setTags}
          />
        )}
        {activeTab === "packs"    && <PacksInfoTab    active={activeInfluencer} />}
        {activeTab === "refine"   && <RefineTab       active={activeInfluencer} />}
        {activeTab === "advanced" && <AdvancedTab />}
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
  fashion:          string;
  setFashion:       (v: string) => void;
  realism:          string;
  setRealism:       (v: string) => void;
  mood:             string[];
  setMood:          (v: string[]) => void;
  platforms:        string[];
  setPlatforms:     (v: string[]) => void;
  notes:            string;
  setNotes:         (v: string) => void;
  // Ethnicity/Region
  ethnicityRegion:      string;
  setEthnicityRegion:   (v: string) => void;
  mixedBlendRegions:    string[];
  setMixedBlendRegions: (v: string[]) => void;
  // Identity Options — candidate count
  candidateCount:    number;
  setCandidateCount: (v: number) => void;
  // Library tags
  tags:    string[];
  setTags: (v: string[]) => void;
}

export function BuilderTab({
  canvasState, activeInfluencer,
  styleCategory, setStyleCategory,
  gender, setGender,
  ageRange, setAgeRange,
  skinTone, setSkinTone,
  faceStruct, setFaceStruct,
  fashion, setFashion,
  realism, setRealism,
  mood, setMood,
  platforms, setPlatforms,
  notes, setNotes,
  ethnicityRegion, setEthnicityRegion,
  mixedBlendRegions, setMixedBlendRegions,
  candidateCount, setCandidateCount,
  tags, setTags,
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

  function toggleMood(v: string) {
    setMood(mood.includes(v) ? mood.filter(x => x !== v) : [...mood, v]);
  }
  function togglePlatform(v: string) {
    setPlatforms(platforms.includes(v) ? platforms.filter(x => x !== v) : [...platforms, v]);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "#070a10", border: `1px solid rgba(255,255,255,0.08)`,
    padding: "9px 12px",
    color: T.text, fontSize: 13, outline: "none",
    fontFamily: "'Familjen Grotesk', sans-serif",
    transition: "border-color 0.18s",
  };

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

      {/* ── Ethnicity / Region ───────────────────────────────────── */}
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

      {/* Rendering — only for hyper-real */}
      {styleCategory === "hyper-real" && (
        <section>
          <SectionLabel label="Rendering" />
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
      )}

      {/* Fashion style for non-hyper-real */}
      {styleCategory !== "hyper-real" && (
        <section>
          <SectionLabel label="Fashion Style" />
          <SelectField
            label="Fashion Style" value={fashion} onChange={setFashion}
            options={["", "Cinematic", "Editorial", "Streetwear", "Fashion", "Minimal", "Casual", "Formal"]}
            style={inputStyle}
          />
        </section>
      )}

      {/* Mood */}
      <section>
        <SectionLabel label="Mood" />
        <ChipGroup
          options={["Confident", "Bold", "Cinematic", "Warm", "Edgy", "Minimal"]}
          selected={mood}
          onToggle={toggleMood}
          accent={selectedCat.accent}
        />
      </section>

      {/* Platform */}
      <section>
        <SectionLabel label="Platform Intent" />
        <ChipGroup
          options={["Instagram", "TikTok", "YouTube", "Brand"]}
          selected={platforms}
          onToggle={togglePlatform}
          accent={selectedCat.accent}
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
          onFocus={e => (e.currentTarget.style.borderColor = selectedCat.accent + "55")}
          onBlur={e => (e.currentTarget.style.borderColor = T.border)}
        />
      </section>

      {/* Roster Tags — library filter labels */}
      <section>
        <SectionLabel label="Roster Tags" />
        <ChipGroup
          options={[
            "Fashion", "Luxury", "Fitness", "Cyberpunk", "Anime",
            "Music Video", "Lifestyle", "Gaming", "Sports", "Beauty",
          ]}
          selected={tags}
          onToggle={v => setTags(tags.includes(v) ? tags.filter(t => t !== v) : [...tags, v])}
          accent={selectedCat.accent}
        />
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
          Tags appear as filter chips in your AI Talent Roster.
        </div>
      </section>

      {/* Identity Options — candidate count selector */}
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
          {candidateCount * 15} cr total · {candidateCount} candidate{candidateCount > 1 ? "s" : ""}
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

// ── Advanced tab ───────────────────────────────────────────────────────────────

function AdvancedTab() {
  return (
    <div style={{ padding: "20px 18px" }}>
      <div style={{
        fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14,
      }}>
        Advanced
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>
        Advanced identity controls — custom prompt overrides, seed control, and generation fine-tuning — coming in a future update.
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: "'Syne', sans-serif",
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)",
      letterSpacing: "0.12em", textTransform: "uppercase",
      marginBottom: 9,
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
