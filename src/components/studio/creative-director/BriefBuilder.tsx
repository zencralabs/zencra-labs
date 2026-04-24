"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import PromptEnhancerPanel from "@/components/studio/prompt/PromptEnhancerPanel";

// ─────────────────────────────────────────────────────────────────────────────
// BriefBuilder — Guided Creative Briefing Experience
// Redesigned as a premium guided system, not a plain form.
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
  hasConceptsGenerated?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

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
  { value: "none",             label: "No text" },
  { value: "minimal",          label: "Minimal text" },
  { value: "ad_text",          label: "Ad text" },
  { value: "poster_text",      label: "Poster text" },
  { value: "typography_first", label: "Typography-first" },
];

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"];

const PROVIDERS = [
  "Auto", "GPT Image", "Nano Banana", "Nano Banana Pro", "Nano Banana 2",
];

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const PAD = "0 20px";        // horizontal padding for all sections
const SEC_PY = "22px 20px";  // section block padding top/bottom

// Input base
const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(120,160,255,0.14)",
  borderRadius: 10,
  padding: "11px 14px",
  color: "#F5F7FF",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
  fontFamily: "inherit",
};

const selectBase: React.CSSProperties = {
  ...inputBase,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 34,
};

const textareaBase: React.CSSProperties = {
  ...inputBase,
  resize: "vertical",
  lineHeight: 1.55,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Section divider line */
function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(120,160,255,0.12) 20%, rgba(120,160,255,0.12) 80%, transparent)",
        margin: "0 20px",
      }}
    />
  );
}

/** Section title — 15px, 600, white */
function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: "#E8EEFF",
        letterSpacing: "0.01em",
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Field label — 13px, 600, muted */
function FieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: "rgba(167,176,197,0.8)",
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
      {required && (
        <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14, letterSpacing: 0, textTransform: "none" }}>*</span>
      )}
      {optional && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
            textTransform: "none",
            letterSpacing: "0.02em",
          }}
        >
          optional
        </span>
      )}
    </label>
  );
}

/** Subtle helper text — 13px */
function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "6px 0 0",
        fontSize: 13,
        color: "rgba(148,163,184,0.7)",
        lineHeight: 1.45,
      }}
    >
      {children}
    </p>
  );
}

/** Field wrapper — consistent 12px bottom gap */
function Field({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12, ...style }}>{children}</div>
  );
}

/** Chip button — style + mood presets */
function Chip({
  active,
  disabled,
  onClick,
  color = "blue",
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  color?: "blue" | "violet";
  children: React.ReactNode;
}) {
  const borderActive =
    color === "violet"
      ? "1px solid rgba(124,58,237,0.6)"
      : "1px solid rgba(37,99,235,0.6)";
  const bgActive =
    color === "violet"
      ? "rgba(124,58,237,0.15)"
      : "rgba(37,99,235,0.15)";
  const textActive = color === "violet" ? "#c4b5fd" : "#93c5fd";

  return (
    <button
      className="brief-chip"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 13px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 7,
        border: active ? borderActive : "1px solid rgba(255,255,255,0.1)",
        background: active ? bgActive : "rgba(255,255,255,0.04)",
        color: active ? textActive : disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

/** Collapsible toggle header */
function CollapsibleHeader({
  isOpen,
  onToggle,
  title,
  subtitle,
}: {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#E8EEFF",
            letterSpacing: "0.01em",
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          marginTop: 3,
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.35)",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.22s ease",
          fontSize: 14,
        }}
      >
        ▾
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BriefBuilder({
  brief,
  onChange,
  onImproveBrief,
  isLoading,
  hasConceptsGenerated = false,
}: BriefBuilderProps) {
  // Message section collapsed by default — purely UI state
  const [messageOpen, setMessageOpen] = useState(false);

  // ── Additional notes enhance ────────────────────────────────────────────────
  const { session } = useAuth();
  const [notesEnhancing, setNotesEnhancing]         = useState(false);
  const [notesEnhancerOpen, setNotesEnhancerOpen]   = useState(false);
  const [notesEnhancedResult, setNotesEnhancedResult] = useState<string | null>(null);

  const handleEnhanceNotes = useCallback(async () => {
    const raw = brief.additionalNotes.trim();
    if (!raw || notesEnhancing) return;

    setNotesEnhancerOpen(true);
    setNotesEnhancedResult(null);
    setNotesEnhancing(true);

    try {
      const res = await fetch("/api/studio/prompt/enhance", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          prompt:     raw,
          studioType: "image",
          modelHint:  brief.preferredProvider ?? "",
        }),
      });

      const json = await res.json() as { enhancedPrompt?: string; error?: string };

      if (res.ok && json.enhancedPrompt) {
        setNotesEnhancedResult(json.enhancedPrompt);
      } else {
        console.warn("[brief-enhance] failed:", json.error);
        setNotesEnhancedResult(null);
      }
    } catch (err) {
      console.warn("[brief-enhance] network error:", err);
      setNotesEnhancedResult(null);
    } finally {
      setNotesEnhancing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.additionalNotes, brief.preferredProvider, notesEnhancing, session]);

  const toggleMoodTag = (tag: string) => {
    const current = brief.moodTags;
    if (current.includes(tag)) {
      onChange({ moodTags: current.filter((t) => t !== tag) });
    } else if (current.length < 4) {
      onChange({ moodTags: [...current, tag] });
    }
  };

  const intensityIndex = Math.max(
    0,
    INTENSITY_LABELS.indexOf(
      brief.visualIntensity.charAt(0).toUpperCase() + brief.visualIntensity.slice(1)
    )
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

        .brief-chip:not(:disabled):hover {
          border-color: rgba(37,99,235,0.5) !important;
          background: rgba(37,99,235,0.1) !important;
        }

        .brief-input:focus {
          border-color: rgba(37,99,235,0.45) !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.1) !important;
          outline: none;
        }

        .brief-goal-input:focus {
          border-color: rgba(86,140,255,0.55) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
          outline: none;
        }

        .brief-action-btn:not(:disabled):hover {
          background: rgba(37,99,235,0.14) !important;
          border-color: rgba(86,140,255,0.45) !important;
          box-shadow: 0 0 16px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.07) !important;
        }

        .bb-slider {
          width: 100%;
          accent-color: #2563EB;
          cursor: pointer;
          height: 4px;
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 0 — INTRO
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "20px 20px 18px" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#F0F4FF",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          Create your campaign brief
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(167,176,197,0.7)",
            lineHeight: 1.5,
          }}
        >
          Start simple. You can refine later —{" "}
          <span style={{ color: "rgba(167,176,197,0.45)" }}>
            AI will guide you.
          </span>
        </div>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — WHAT ARE YOU CREATING?
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: SEC_PY }}>
        <SectionTitle>What are you creating?</SectionTitle>
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          Define the core context of your campaign.
        </div>

        {/* Project Name */}
        <Field>
          <FieldLabel>Project Name</FieldLabel>
          <input
            className="brief-input"
            style={inputBase}
            type="text"
            placeholder="e.g. Summer Launch Campaign"
            value={brief.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
        </Field>

        {/* Project Type */}
        <Field>
          <FieldLabel>Project Type</FieldLabel>
          <select
            className="brief-input"
            style={selectBase}
            value={brief.projectType}
            onChange={(e) => onChange({ projectType: e.target.value })}
          >
            <option value="">Select type…</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        {/* Brand + Audience — 2-col */}
        <Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel optional>Brand Name</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="Your brand"
                value={brief.brandName}
                onChange={(e) => onChange({ brandName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel optional>Audience</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="Who's it for?"
                value={brief.audience}
                onChange={(e) => onChange({ audience: e.target.value })}
              />
            </div>
          </div>
        </Field>

        {/* Platform */}
        <Field style={{ marginBottom: 0 }}>
          <FieldLabel optional>Platform</FieldLabel>
          <input
            className="brief-input"
            style={inputBase}
            type="text"
            placeholder="e.g. Instagram, Billboard, Website"
            value={brief.platform}
            onChange={(e) => onChange({ platform: e.target.value })}
          />
        </Field>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — CAMPAIGN GOAL (PRIMARY — highlighted)
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: SEC_PY }}>
        <SectionTitle>Campaign Goal</SectionTitle>
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          What should this creative achieve? This directly shapes your concepts.
        </div>

        {/* Highlighted goal block */}
        <div
          style={{
            padding: "16px",
            borderRadius: 12,
            background: "rgba(37,99,235,0.05)",
            border: "1px solid rgba(86,140,255,0.24)",
            boxShadow: "0 0 0 1px rgba(37,99,235,0.08), 0 0 24px rgba(37,99,235,0.07)",
          }}
        >
          <FieldLabel required>Campaign Goal</FieldLabel>
          <textarea
            className="brief-input brief-goal-input"
            style={{
              ...textareaBase,
              minHeight: 80,
              border: "1px solid rgba(86,140,255,0.2)",
              background: "rgba(255,255,255,0.04)",
            }}
            placeholder="Describe the result you want this campaign to achieve"
            value={brief.goal}
            onChange={(e) => onChange({ goal: e.target.value })}
          />
          <HelperText>e.g. get signups, drive clicks, promote a product</HelperText>
        </div>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — MESSAGE (collapsible, default closed)
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: SEC_PY }}>
        <CollapsibleHeader
          isOpen={messageOpen}
          onToggle={() => setMessageOpen((v) => !v)}
          title="Message details"
          subtitle="Add headline, supporting copy, CTA, and notes"
        />

        <div
          style={{
            maxHeight: messageOpen ? "600px" : "0",
            overflow: "hidden",
            transition: "max-height 0.28s ease",
          }}
        >
          <div style={{ paddingTop: 20 }}>

            {/* Headline */}
            <Field>
              <FieldLabel optional>Headline</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="Main headline text"
                value={brief.headline}
                onChange={(e) => onChange({ headline: e.target.value })}
              />
              <HelperText>The primary text that may appear on the creative</HelperText>
            </Field>

            {/* Subheadline */}
            <Field>
              <FieldLabel optional>Subheadline</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="Supporting line"
                value={brief.subheadline}
                onChange={(e) => onChange({ subheadline: e.target.value })}
              />
            </Field>

            {/* Call to Action */}
            <Field>
              <FieldLabel optional>Call to Action</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="e.g. Shop Now, Learn More"
                value={brief.cta}
                onChange={(e) => onChange({ cta: e.target.value })}
              />
              <HelperText>The action text shown to the viewer</HelperText>
            </Field>

            {/* Additional Notes */}
            <Field style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <FieldLabel optional>Additional Notes</FieldLabel>
                {brief.additionalNotes.trim() && (
                  <button
                    onClick={handleEnhanceNotes}
                    disabled={notesEnhancing}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                      border: "1px solid rgba(139,92,246,0.35)",
                      background: notesEnhancing ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.10)",
                      color: notesEnhancing ? "rgba(167,139,250,0.45)" : "rgba(167,139,250,0.85)",
                      cursor: notesEnhancing ? "not-allowed" : "pointer",
                      transition: "all 0.15s", letterSpacing: "0.01em",
                    }}
                    onMouseEnter={e => {
                      if (!notesEnhancing) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.18)";
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.55)";
                        (e.currentTarget as HTMLElement).style.color = "#C4B5FD";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!notesEnhancing) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.10)";
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)";
                        (e.currentTarget as HTMLElement).style.color = "rgba(167,139,250,0.85)";
                      }
                    }}
                  >
                    {notesEnhancing ? (
                      <>
                        <div style={{
                          width: 9, height: 9, borderRadius: "50%",
                          border: "1.5px solid rgba(167,139,250,0.2)",
                          borderTopColor: "rgba(167,139,250,0.65)",
                          animation: "bbEnhSpin 0.7s linear infinite", flexShrink: 0,
                        }} />
                        Enhancing…
                      </>
                    ) : "✦ Enhance"}
                  </button>
                )}
              </div>
              <textarea
                className="brief-input"
                style={{ ...textareaBase, minHeight: 60 }}
                placeholder="Any extra context, references, or constraints"
                value={brief.additionalNotes}
                onChange={(e) => onChange({ additionalNotes: e.target.value })}
              />
              <HelperText>Extra context, references, or constraints</HelperText>
              {/* Enhancer panel — slides in below the textarea */}
              <PromptEnhancerPanel
                open={notesEnhancerOpen}
                originalPrompt={brief.additionalNotes}
                enhancedPrompt={notesEnhancedResult}
                isLoading={notesEnhancing}
                onEnhance={handleEnhanceNotes}
                onApply={(enhanced) => {
                  onChange({ additionalNotes: enhanced });
                  setNotesEnhancerOpen(false);
                  setNotesEnhancedResult(null);
                }}
                onClose={() => {
                  setNotesEnhancerOpen(false);
                  setNotesEnhancedResult(null);
                }}
              />
              <style>{`
                @keyframes bbEnhSpin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </Field>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — STYLE DIRECTION
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: SEC_PY }}>
        <SectionTitle>Style Direction</SectionTitle>
        <div
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          Define how the campaign should feel visually.
        </div>

        {/* 4A — Style Presets */}
        <Field>
          <FieldLabel optional>Style Preset</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STYLE_PRESETS.map((preset) => (
              <Chip
                key={preset}
                active={brief.stylePreset === preset}
                color="blue"
                onClick={() =>
                  onChange({ stylePreset: brief.stylePreset === preset ? "" : preset })
                }
              >
                {preset}
              </Chip>
            ))}
          </div>
          <HelperText>Choose the overall visual language for your creative</HelperText>
        </Field>

        {/* 4B — Mood Tags */}
        <Field>
          <FieldLabel optional>
            Mood Tags{" "}
            <span
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: "rgba(255,255,255,0.2)",
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (pick up to 4)
            </span>
          </FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MOOD_TAGS.map((tag) => {
              const active = brief.moodTags.includes(tag);
              const disabled = !active && brief.moodTags.length >= 4;
              return (
                <Chip
                  key={tag}
                  active={active}
                  disabled={disabled}
                  color="violet"
                  onClick={() => toggleMoodTag(tag)}
                >
                  {tag}
                </Chip>
              );
            })}
          </div>
        </Field>

        {/* 4C — Visual Intensity */}
        <Field>
          <FieldLabel optional>Visual Intensity</FieldLabel>
          <div style={{ padding: "4px 2px 0" }}>
            <input
              type="range"
              className="bb-slider"
              min={0}
              max={3}
              step={1}
              value={intensityIndex}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                onChange({ visualIntensity: INTENSITY_LABELS[idx].toLowerCase() });
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              {INTENSITY_LABELS.map((label, i) => (
                <span
                  key={label}
                  style={{
                    fontSize: 12,
                    color:
                      i === intensityIndex
                        ? "rgba(255,255,255,0.75)"
                        : "rgba(255,255,255,0.28)",
                    fontWeight: i === intensityIndex ? 700 : 400,
                    transition: "color 0.15s ease",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Field>

        {/* 4D — Text Rendering */}
        <Field>
          <FieldLabel optional>Text Rendering</FieldLabel>
          <select
            className="brief-input"
            style={selectBase}
            value={brief.textRenderingIntent}
            onChange={(e) => onChange({ textRenderingIntent: e.target.value })}
          >
            {TEXT_RENDERING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <HelperText>How much text should appear in the generated visual</HelperText>
        </Field>

        {/* 4E — Realism vs Design */}
        <Field>
          <FieldLabel optional>Realism vs Design</FieldLabel>
          <div style={{ padding: "4px 2px 0" }}>
            <input
              type="range"
              className="bb-slider"
              min={0}
              max={100}
              value={brief.realismVsDesign}
              onChange={(e) =>
                onChange({ realismVsDesign: parseInt(e.target.value, 10) })
              }
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                Graphic / Design
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                Photorealistic
              </span>
            </div>
          </div>
        </Field>

        {/* 4F — Color Preference */}
        <Field style={{ marginBottom: 0 }}>
          <FieldLabel optional>Color Preference</FieldLabel>
          <input
            className="brief-input"
            style={inputBase}
            type="text"
            placeholder="e.g. Monochrome, Deep blues, Brand red"
            value={brief.colorPreference}
            onChange={(e) => onChange({ colorPreference: e.target.value })}
          />
          <HelperText>Dominant palette or brand color direction</HelperText>
        </Field>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — ADVANCED CONTROLS (collapsible, default closed)
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: SEC_PY }}>
        <CollapsibleHeader
          isOpen={brief.advancedOpen}
          onToggle={() => onChange({ advancedOpen: !brief.advancedOpen })}
          title="Advanced Controls"
          subtitle="Provider, ratio, output count, exclusions, composition"
        />

        <div
          style={{
            maxHeight: brief.advancedOpen ? "700px" : "0",
            overflow: "hidden",
            transition: "max-height 0.28s ease",
          }}
        >
          <div style={{ paddingTop: 20 }}>

            {/* Preferred Provider */}
            <Field>
              <FieldLabel optional>Preferred Provider</FieldLabel>
              <select
                className="brief-input"
                style={selectBase}
                value={brief.preferredProvider}
                onChange={(e) => onChange({ preferredProvider: e.target.value })}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <HelperText>The AI model used to generate concept visuals</HelperText>
            </Field>

            {/* Aspect Ratio */}
            <Field>
              <FieldLabel optional>Aspect Ratio</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ASPECT_RATIOS.map((ar) => (
                  <Chip
                    key={ar}
                    active={brief.aspectRatio === ar}
                    color="blue"
                    onClick={() => onChange({ aspectRatio: ar })}
                  >
                    {ar}
                  </Chip>
                ))}
              </div>
            </Field>

            {/* Output Count */}
            <Field>
              <FieldLabel optional>Output Count</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4].map((n) => (
                  <Chip
                    key={n}
                    active={brief.outputCount === n}
                    color="blue"
                    onClick={() => onChange({ outputCount: n })}
                  >
                    {String(n)}
                  </Chip>
                ))}
              </div>
              <HelperText>How many images to generate per render</HelperText>
            </Field>

            {/* Avoid Elements */}
            <Field>
              <FieldLabel optional>Avoid Elements</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="e.g. People, busy backgrounds, red tones"
                value={brief.avoidElements}
                onChange={(e) => onChange({ avoidElements: e.target.value })}
              />
              <HelperText>Elements you don't want in the generated creative</HelperText>
            </Field>

            {/* Composition Preference */}
            <Field style={{ marginBottom: 0 }}>
              <FieldLabel optional>Composition Preference</FieldLabel>
              <input
                className="brief-input"
                style={inputBase}
                type="text"
                placeholder="e.g. Rule of thirds, centered product, full bleed"
                value={brief.compositionPreference}
                onChange={(e) => onChange({ compositionPreference: e.target.value })}
              />
              <HelperText>How elements should be arranged in the frame</HelperText>
            </Field>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — ACTIONS
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ padding: "20px 20px 24px", marginTop: "auto" }}>

        {/* Improve Brief */}
        <div
          title={
            !hasConceptsGenerated
              ? "Generate concepts first — then AI will refine your brief based on them"
              : "Refine your brief using AI feedback from your concepts"
          }
          style={{ marginBottom: 8 }}
        >
          <button
            className="brief-action-btn"
            onClick={onImproveBrief}
            disabled={isLoading || !hasConceptsGenerated}
            style={{
              width: "100%",
              padding: "12px 0",
              background: hasConceptsGenerated
                ? "rgba(37,99,235,0.08)"
                : "rgba(255,255,255,0.03)",
              border: hasConceptsGenerated
                ? "1px solid rgba(86,140,255,0.3)"
                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 9,
              color: hasConceptsGenerated
                ? "rgba(255,255,255,0.8)"
                : "rgba(255,255,255,0.25)",
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading || !hasConceptsGenerated ? "default" : "pointer",
              transition: "all 0.18s ease",
              boxShadow: hasConceptsGenerated
                ? "0 0 12px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "none",
              letterSpacing: "0.01em",
            }}
          >
            ✨ Improve Brief
          </button>
          {!hasConceptsGenerated && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "rgba(148,163,184,0.45)",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              Generate concepts first to unlock this
            </p>
          )}
        </div>

        {/* Randomize */}
        <div title="Auto-fill style fields with a creative starting point">
          <button
            className="brief-action-btn"
            onClick={() => {
              const shuffled = [...MOOD_TAGS].sort(() => Math.random() - 0.5);
              const randomPreset =
                STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)];
              onChange({
                moodTags: shuffled.slice(0, 2),
                stylePreset: randomPreset,
                visualIntensity:
                  INTENSITY_LABELS[
                    Math.floor(Math.random() * INTENSITY_LABELS.length)
                  ].toLowerCase(),
              });
            }}
            style={{
              width: "100%",
              padding: "12px 0",
              background: "rgba(37,99,235,0.07)",
              border: "1px solid rgba(86,140,255,0.28)",
              borderRadius: 9,
              color: "rgba(255,255,255,0.72)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow:
                "0 0 12px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
              letterSpacing: "0.01em",
            }}
          >
            ⟳ Randomize Style
          </button>
        </div>
      </div>
    </div>
  );
}
