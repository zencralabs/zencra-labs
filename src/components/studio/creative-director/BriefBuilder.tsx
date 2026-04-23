"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BriefBuilder — Left column of the AI Creative Director
// ─────────────────────────────────────────────────────────────────────────────

export interface BriefState {
  projectName: string;
  projectType: string;
  brandName: string;
  audience: string;
  platform: string;
  goal: string;
  headline: string;
  subheadline: string;
  cta: string;
  additionalNotes: string;
  stylePreset: string;
  moodTags: string[];
  visualIntensity: string;
  textRenderingIntent: string;
  realismVsDesign: number;
  colorPreference: string;
  aspectRatio: string;
  outputCount: number;
  advancedOpen: boolean;
  preferredProvider: string;
  avoidElements: string;
  compositionPreference: string;
}

interface BriefBuilderProps {
  brief: BriefState;
  onChange: (updates: Partial<BriefState>) => void;
  onImproveBrief: () => void;
  isLoading: boolean;
}

const PROJECT_TYPES = [
  "Poster", "Ad Creative", "Product Banner", "Instagram Post",
  "Story", "YouTube Thumbnail", "Flyer", "Landing Hero",
];

const STYLE_PRESETS = [
  "Luxury", "Futuristic", "Streetwear", "Cinematic", "Editorial",
  "Corporate", "Minimal", "Gaming", "Fantasy", "Tech Product",
];

const MOOD_TAGS = [
  "Bold", "Elegant", "Energetic", "Dark", "Playful", "Minimal",
  "Cinematic", "Raw", "Premium", "Dreamy", "Intense", "Clean",
];

const INTENSITY_LABELS = ["Clean", "Balanced", "Bold", "Extreme"];

const TEXT_RENDERING_OPTIONS = [
  { value: "none", label: "No text" },
  { value: "minimal", label: "Minimal text" },
  { value: "ad_text", label: "Ad text" },
  { value: "poster_text", label: "Poster text" },
  { value: "typography_first", label: "Typography-first" },
];

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"];

const PROVIDERS = ["Auto", "GPT Image", "Nano Banana", "Nano Banana Pro", "Nano Banana 2"];

// ── Style constants — Zencra refined typography ────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.65)",
  display: "block",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(120,160,255,0.14)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#F5F7FF",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 72,
  fontFamily: "inherit",
  lineHeight: 1.5,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 30,
};

const sectionStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(120,160,255,0.1)",
  padding: "28px 20px",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "rgba(167,176,197,0.55)",
  marginBottom: 16,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 16,
};

export default function BriefBuilder({
  brief,
  onChange,
  onImproveBrief,
  isLoading,
}: BriefBuilderProps) {

  const toggleMoodTag = (tag: string) => {
    const current = brief.moodTags;
    if (current.includes(tag)) {
      onChange({ moodTags: current.filter((t) => t !== tag) });
    } else if (current.length < 4) {
      onChange({ moodTags: [...current, tag] });
    }
  };

  const intensityIndex = INTENSITY_LABELS.indexOf(
    brief.visualIntensity.charAt(0).toUpperCase() + brief.visualIntensity.slice(1)
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "none",
      }}
    >
      <style>{`
        .brief-builder-scroll::-webkit-scrollbar { display: none; }
        .brief-chip:hover { border-color: rgba(37,99,235,0.5) !important; background: rgba(37,99,235,0.1) !important; }
        .brief-input:focus { border-color: rgba(37,99,235,0.4) !important; outline: none; }
        .brief-action-btn:hover { background: rgba(37,99,235,0.14) !important; border-color: rgba(86,140,255,0.45) !important; box-shadow: 0 0 16px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.07) !important; }
      `}</style>

      {/* ── B1: Project Basics ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={sectionHeaderStyle}>Project Basics</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Project Name</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="e.g. Summer Campaign"
            value={brief.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Project Type</label>
          <select
            className="brief-input"
            style={selectStyle}
            value={brief.projectType}
            onChange={(e) => onChange({ projectType: e.target.value })}
          >
            <option value="">Select type…</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Brand Name</label>
            <input
              className="brief-input"
              style={inputStyle}
              type="text"
              placeholder="Your brand"
              value={brief.brandName}
              onChange={(e) => onChange({ brandName: e.target.value })}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Audience</label>
            <input
              className="brief-input"
              style={inputStyle}
              type="text"
              placeholder="Who's it for?"
              value={brief.audience}
              onChange={(e) => onChange({ audience: e.target.value })}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Platform</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="e.g. Instagram, Billboard, Website"
            value={brief.platform}
            onChange={(e) => onChange({ platform: e.target.value })}
          />
        </div>
      </div>

      {/* ── B2: Message Inputs ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Message Inputs</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Campaign Goal</label>
          <textarea
            className="brief-input"
            style={textareaStyle}
            placeholder="What should this creative achieve?"
            value={brief.goal}
            onChange={(e) => onChange({ goal: e.target.value })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Headline</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="Main headline text"
            value={brief.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Subheadline</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="Supporting line"
            value={brief.subheadline}
            onChange={(e) => onChange({ subheadline: e.target.value })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Call to Action</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="e.g. Shop Now, Learn More"
            value={brief.cta}
            onChange={(e) => onChange({ cta: e.target.value })}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Additional Notes</label>
          <textarea
            className="brief-input"
            style={{ ...textareaStyle, minHeight: 60 }}
            placeholder="Any extra context, references, or constraints"
            value={brief.additionalNotes}
            onChange={(e) => onChange({ additionalNotes: e.target.value })}
          />
        </div>
      </div>

      {/* ── B3: Style Controls ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Style Controls</div>

        {/* Style Presets */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Style Preset</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STYLE_PRESETS.map((preset) => {
              const active = brief.stylePreset === preset;
              return (
                <button
                  key={preset}
                  className="brief-chip"
                  onClick={() => onChange({ stylePreset: active ? "" : preset })}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: active
                      ? "1px solid rgba(37,99,235,0.6)"
                      : "1px solid rgba(255,255,255,0.1)",
                    background: active
                      ? "rgba(37,99,235,0.15)"
                      : "rgba(255,255,255,0.04)",
                    color: active ? "#93c5fd" : "rgba(255,255,255,0.55)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mood Tags */}
        <div style={fieldStyle}>
          <label style={labelStyle}>
            Mood Tags{" "}
            <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>
              (max 4)
            </span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MOOD_TAGS.map((tag) => {
              const active = brief.moodTags.includes(tag);
              const disabled = !active && brief.moodTags.length >= 4;
              return (
                <button
                  key={tag}
                  className="brief-chip"
                  onClick={() => toggleMoodTag(tag)}
                  disabled={disabled}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 5,
                    border: active
                      ? "1px solid rgba(124,58,237,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: active
                      ? "rgba(124,58,237,0.15)"
                      : "rgba(255,255,255,0.03)",
                    color: active
                      ? "#c4b5fd"
                      : disabled
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.5)",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Intensity */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Visual Intensity</label>
          <div style={{ position: "relative", padding: "0 2px" }}>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={Math.max(0, intensityIndex)}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                onChange({ visualIntensity: INTENSITY_LABELS[idx].toLowerCase() });
              }}
              style={{
                width: "100%",
                accentColor: "#2563EB",
                cursor: "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {INTENSITY_LABELS.map((label, i) => (
                <span
                  key={label}
                  style={{
                    fontSize: 10,
                    color: i === Math.max(0, intensityIndex)
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(255,255,255,0.25)",
                    fontWeight: i === Math.max(0, intensityIndex) ? 700 : 400,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Text Rendering Intent */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Text Rendering</label>
          <select
            className="brief-input"
            style={selectStyle}
            value={brief.textRenderingIntent}
            onChange={(e) => onChange({ textRenderingIntent: e.target.value })}
          >
            {TEXT_RENDERING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Realism vs Design Slider */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Realism vs Design</label>
          <input
            type="range"
            min={0}
            max={100}
            value={brief.realismVsDesign}
            onChange={(e) => onChange({ realismVsDesign: parseInt(e.target.value, 10) })}
            style={{ width: "100%", accentColor: "#2563EB", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Design</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Realism</span>
          </div>
        </div>

        {/* Color Preference */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Color Preference</label>
          <input
            className="brief-input"
            style={inputStyle}
            type="text"
            placeholder="e.g. Monochrome, Deep blues, Brand red"
            value={brief.colorPreference}
            onChange={(e) => onChange({ colorPreference: e.target.value })}
          />
        </div>
      </div>

      {/* ── B4: Advanced Controls ── */}
      <div style={sectionStyle}>
        <button
          onClick={() => onChange({ advancedOpen: !brief.advancedOpen })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: brief.advancedOpen ? 14 : 0,
          }}
        >
          <span style={sectionHeaderStyle}>Advanced Controls</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", transform: brief.advancedOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
        </button>

        {brief.advancedOpen && (
          <div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Preferred Provider</label>
              <select
                className="brief-input"
                style={selectStyle}
                value={brief.preferredProvider}
                onChange={(e) => onChange({ preferredProvider: e.target.value })}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Aspect Ratio</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ASPECT_RATIOS.map((ar) => {
                  const active = brief.aspectRatio === ar;
                  return (
                    <button
                      key={ar}
                      className="brief-chip"
                      onClick={() => onChange({ aspectRatio: ar })}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: active
                          ? "1px solid rgba(37,99,235,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                        background: active
                          ? "rgba(37,99,235,0.15)"
                          : "rgba(255,255,255,0.04)",
                        color: active ? "#93c5fd" : "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {ar}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Output Count</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4].map((n) => {
                  const active = brief.outputCount === n;
                  return (
                    <button
                      key={n}
                      className="brief-chip"
                      onClick={() => onChange({ outputCount: n })}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: active
                          ? "1px solid rgba(37,99,235,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                        background: active
                          ? "rgba(37,99,235,0.15)"
                          : "rgba(255,255,255,0.04)",
                        color: active ? "#93c5fd" : "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Avoid Elements</label>
              <input
                className="brief-input"
                style={inputStyle}
                type="text"
                placeholder="e.g. People, busy backgrounds, red tones"
                value={brief.avoidElements}
                onChange={(e) => onChange({ avoidElements: e.target.value })}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Composition Preference</label>
              <input
                className="brief-input"
                style={inputStyle}
                type="text"
                placeholder="e.g. Rule of thirds, centered product, full bleed"
                value={brief.compositionPreference}
                onChange={(e) => onChange({ compositionPreference: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── B5: Brief support actions (Generate via dock below) ── */}
      <div style={{ padding: "16px 20px 20px", marginTop: "auto" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="brief-action-btn"
            onClick={onImproveBrief}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "rgba(37,99,235,0.07)",
              border: "1px solid rgba(86,140,255,0.28)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.72)",
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading ? "default" : "pointer",
              transition: "all 0.18s ease",
              boxShadow: "0 0 10px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            ✨ Improve Brief
          </button>
          <button
            className="brief-action-btn"
            onClick={() => {
              const shuffled = [...MOOD_TAGS].sort(() => Math.random() - 0.5);
              const randomPreset = STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)];
              onChange({
                moodTags: shuffled.slice(0, 2),
                stylePreset: randomPreset,
                visualIntensity: INTENSITY_LABELS[Math.floor(Math.random() * INTENSITY_LABELS.length)].toLowerCase(),
              });
            }}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "rgba(37,99,235,0.07)",
              border: "1px solid rgba(86,140,255,0.28)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.72)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: "0 0 10px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            ⟳ Randomize
          </button>
        </div>
      </div>
    </div>
  );
}
