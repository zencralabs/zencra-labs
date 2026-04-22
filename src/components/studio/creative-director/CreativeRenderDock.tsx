"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CreativeRenderDock — Floating render command bar (Zencra-branded)
// Positioned inside the center zone — does not overlap left / right panels.
// Row 1: upload + prompt instruction
// Row 2: model → quality → resolution → ratio → count → estimate → generate
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderDockSettings {
  model: string;
  quality: "low" | "medium" | "high";
  resolution: "1k" | "2k" | "4k";
  aspectRatio: string;
  outputCount: number;
  promptText: string;
  referenceImageUrl?: string;
}

export interface CreativeRenderDockProps {
  selectedConceptId: string | null;
  conceptRecommendedProvider?: string | null;
  projectType?: string;
  isGenerating: boolean;
  isVariationMode?: boolean;
  conceptsExist?: boolean;          // true once at least 1 concept card exists
  isGeneratingConcepts?: boolean;   // true while concept generation is running
  onGenerate: (settings: RenderDockSettings) => void;
  onGenerateConcepts?: () => void;  // called when dock CTA = "Generate Concepts"
  onReferenceUpload?: (file: File) => Promise<string>;
}

// ── Zencra color tokens ────────────────────────────────────────────────────────

const Z = {
  bgDock:       "#0A0F20",
  bgInput:      "#12182B",
  bgHover:      "#151D34",
  bgElevated:   "#11182F",
  borderSubtle: "rgba(255,255,255,0.06)",
  borderSoft:   "rgba(120,160,255,0.14)",
  borderActive: "rgba(86,140,255,0.42)",
  textPrimary:  "#F5F7FF",
  textSecondary:"#A7B0C5",
  textMuted:    "#6F7893",
  accentBlue:   "#3B82F6",
  accentCyan:   "#22D3EE",
  accentViolet: "#8B5CF6",
  accentLime:   "#C7F36B",
} as const;

// ── Model registry ─────────────────────────────────────────────────────────────

interface CDModel {
  value: string;
  label: string;
  provider: string;
  supportedResolutions: ("1k" | "2k" | "4k")[];
  defaultQuality: "low" | "medium" | "high";
  baseCredits: number;
}

const CD_MODELS: CDModel[] = [
  { value: "gpt-image-1",     label: "GPT Image 2",     provider: "openai",       supportedResolutions: ["1k", "2k"],        defaultQuality: "medium", baseCredits: 8  },
  { value: "nano-banana-pro", label: "Nano Banana Pro", provider: "nano-banana",  supportedResolutions: ["1k", "2k", "4k"],  defaultQuality: "high",   baseCredits: 12 },
  { value: "nano-banana-2",   label: "Nano Banana 2",   provider: "nano-banana",  supportedResolutions: ["1k", "2k", "4k"],  defaultQuality: "medium", baseCredits: 10 },
  { value: "seedream-v5",     label: "Seedream v5",     provider: "fal",          supportedResolutions: ["1k", "2k"],        defaultQuality: "low",    baseCredits: 5  },
  { value: "flux-kontext",    label: "Flux Kontext",    provider: "fal",          supportedResolutions: ["1k", "2k"],        defaultQuality: "medium", baseCredits: 8  },
];

const QUALITY_OPTIONS: { value: "low" | "medium" | "high"; label: string; desc: string }[] = [
  { value: "low",    label: "Low",    desc: "Fastest and cheapest"  },
  { value: "medium", label: "Medium", desc: "Balanced visuals"      },
  { value: "high",   label: "High",   desc: "Best visual fidelity"  },
];

const RESOLUTION_OPTIONS: { value: "1k" | "2k" | "4k"; label: string; desc: string }[] = [
  { value: "1k", label: "1K", desc: "1024 px" },
  { value: "2k", label: "2K", desc: "2048 px" },
  { value: "4k", label: "4K", desc: "4096 px" },
];

const ASPECT_RATIOS = ["Auto", "1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9"];

// ── Shared style constants (Zencra-branded) ───────────────────────────────────

const pillBase: React.CSSProperties = {
  height:          44,
  padding:         "0 14px",
  borderRadius:    12,
  border:          `1px solid ${Z.borderSubtle}`,
  background:      Z.bgInput,
  color:           Z.textPrimary,
  fontSize:        14,
  fontWeight:      500,
  cursor:          "pointer",
  display:         "flex",
  alignItems:      "center",
  gap:             7,
  whiteSpace:      "nowrap" as const,
  flexShrink:      0,
  transition:      "all 0.15s ease",
};

const dropdownBase: React.CSSProperties = {
  position:        "absolute",
  bottom:          "calc(100% + 8px)",
  left:            0,
  background:      Z.bgDock,
  backdropFilter:  "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border:          `1px solid ${Z.borderSoft}`,
  borderRadius:    14,
  overflow:        "hidden",
  zIndex:          400,
  boxShadow:       "0 16px 48px rgba(0,0,0,0.7)",
};

const dropdownItemBase: React.CSSProperties = {
  width:      "100%",
  display:    "block",
  textAlign:  "left",
  padding:    "10px 16px",
  border:     "none",
  cursor:     "pointer",
  fontSize:   14,
  transition: "background 0.1s ease",
};

const vSep: React.CSSProperties = {
  width:      1,
  height:     22,
  background: "rgba(120,160,255,0.12)",
  flexShrink: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDefaultAspectRatio(projectType: string): string {
  const map: Record<string, string> = {
    "Poster":             "2:3",
    "Ad Creative":        "1:1",
    "Product Banner":     "16:9",
    "Instagram Post":     "1:1",
    "Story":              "9:16",
    "YouTube Thumbnail":  "16:9",
    "Flyer":              "2:3",
    "Landing Hero":       "21:9",
  };
  return map[projectType] ?? "1:1";
}

function providerToModelValue(provider: string): string {
  const map: Record<string, string> = {
    "openai":          "gpt-image-1",
    "gpt-image":       "gpt-image-1",
    "gpt-image-1":     "gpt-image-1",
    "nano-banana":     "nano-banana-pro",
    "nano-banana-pro": "nano-banana-pro",
    "nano-banana-2":   "nano-banana-2",
    "seedream":        "seedream-v5",
    "fal":             "seedream-v5",
    "flux-kontext":    "flux-kontext",
    "flux":            "flux-kontext",
  };
  return map[provider?.toLowerCase()] ?? "gpt-image-1";
}

function estimateCredits(model: string, quality: string, resolution: string, count: number): number {
  const m     = CD_MODELS.find((x) => x.value === model);
  const base  = m?.baseCredits ?? 8;
  const qMult = quality === "low" ? 0.7 : quality === "high" ? 1.35 : 1.0;
  const rMult = resolution === "2k" ? 1.5 : resolution === "4k" ? 2.5 : 1.0;
  return Math.round(base * qMult * rMult * count * 10) / 10;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CreativeRenderDock({
  selectedConceptId,
  conceptRecommendedProvider,
  projectType = "",
  isGenerating,
  isVariationMode = false,
  conceptsExist = false,
  isGeneratingConcepts = false,
  onGenerate,
  onGenerateConcepts,
  onReferenceUpload,
}: CreativeRenderDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [model,       setModel]       = useState<string>("gpt-image-1");
  const [quality,     setQuality]     = useState<"low" | "medium" | "high">("medium");
  const [resolution,  setResolution]  = useState<"1k" | "2k" | "4k">("1k");
  const [aspectRatio, setAspectRatio] = useState<string>("Auto");
  const [outputCount, setOutputCount] = useState<number>(4);
  const [promptText,  setPromptText]  = useState<string>("");
  const [refImageUrl, setRefImageUrl] = useState<string>("");

  const [manualModelOverride, setManualModelOverride] = useState(false);
  const [openDropdown,        setOpenDropdown]        = useState<string | null>(null);
  const [isUploadingRef,      setIsUploadingRef]      = useState(false);

  // Smart defaults from concept recommendation
  useEffect(() => {
    if (!conceptRecommendedProvider || manualModelOverride) return;
    const mv = providerToModelValue(conceptRecommendedProvider);
    const m  = CD_MODELS.find((x) => x.value === mv);
    if (!m) return;
    setModel(mv);
    setQuality(m.defaultQuality);
    if (!m.supportedResolutions.includes(resolution)) setResolution("1k");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptRecommendedProvider, manualModelOverride]);

  // Concept change clears manual override
  useEffect(() => { setManualModelOverride(false); }, [selectedConceptId]);

  const selectedModel  = CD_MODELS.find((x) => x.value === model) ?? CD_MODELS[0];
  const creditEstimate = estimateCredits(model, quality, resolution, outputCount);

  // ── Context CTA state machine ─────────────────────────────────────────────
  // Step 1: No concepts yet  → "Generate Concepts" (calls onGenerateConcepts)
  // Step 2: Concepts exist, none selected → "Select a Concept" (disabled)
  // Step 3: Concept selected → "Render Selected Concept" (calls onGenerate)
  type DockCTAMode = "generate-concepts" | "select-concept" | "render";
  const ctaMode: DockCTAMode = !conceptsExist
    ? "generate-concepts"
    : !selectedConceptId
    ? "select-concept"
    : "render";

  const isRenderDisabled = ctaMode !== "render" || isGenerating;
  const isGenerateLabel  = isGeneratingConcepts ? "Generating Concepts…" : "Generate Concepts";

  const generateLabel =
    ctaMode === "generate-concepts"
      ? isGenerateLabel
      : ctaMode === "select-concept"
      ? "Select a Concept"
      : isGenerating
      ? "Rendering…"
      : isVariationMode
      ? "Generate Variation"
      : "Render Selected Concept";

  const handleModelChange = useCallback((value: string) => {
    const m = CD_MODELS.find((x) => x.value === value);
    if (!m) return;
    setModel(value);
    setManualModelOverride(true);
    setQuality(m.defaultQuality);
    if (!m.supportedResolutions.includes(resolution)) setResolution("1k");
    setOpenDropdown(null);
  }, [resolution]);

  const handleUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onReferenceUpload) return;
    e.target.value = "";
    setIsUploadingRef(true);
    try { const url = await onReferenceUpload(file); setRefImageUrl(url); }
    catch { /* caller handles toast */ }
    finally { setIsUploadingRef(false); }
  }, [onReferenceUpload]);

  const handleGenerate = useCallback(() => {
    if (ctaMode === "generate-concepts") {
      if (!isGeneratingConcepts) onGenerateConcepts?.();
      return;
    }
    if (isRenderDisabled) return;
    const resolvedRatio = aspectRatio === "Auto" ? getDefaultAspectRatio(projectType) : aspectRatio;
    onGenerate({ model, quality, resolution, aspectRatio: resolvedRatio, outputCount, promptText, referenceImageUrl: refImageUrl || undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaMode, isGeneratingConcepts, isRenderDisabled, aspectRatio, projectType, model, quality, resolution, outputCount, promptText, refImageUrl, onGenerate, onGenerateConcepts]);

  return (
    <>
      {openDropdown && (
        <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setOpenDropdown(null)} />
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadChange} />

      {/* ══════════════════════════════════════════════════════════════
          DOCK SHELL
          Positioned to the center zone: left/right panels are 320px + 20px gap each = 340px per side
          width: clamp(860px, calc(100vw - 680px), 1120px)
      ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position:        "fixed",
          bottom:          24,
          left:            "50%",
          transform:       "translateX(-50%)",
          // Stays inside the center zone, away from left/right panels
          width:           "clamp(860px, calc(100vw - 680px), 1120px)",
          zIndex:          300,
          background:      `${Z.bgDock}f5`,   // ~96% opacity
          backdropFilter:  "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border:          `1px solid ${Z.borderSoft}`,
          borderRadius:    28,
          boxShadow:       "0 16px 60px rgba(0,0,0,0.48), 0 0 0 1px rgba(59,130,246,0.08)",
          padding:         "16px 18px",
          display:         "flex",
          flexDirection:   "column",
          gap:             12,
        }}
      >
        <style>{`
          .rd-pill:hover:not([disabled]) { border-color: ${Z.borderActive} !important; background: ${Z.bgHover} !important; }
          .rd-pill[disabled] { opacity: 0.36; cursor: default !important; }
          .rd-prompt:focus { outline: none; border-color: ${Z.borderActive} !important; }
          .rd-upload:hover:not([disabled]) { background: ${Z.bgHover} !important; border-color: ${Z.borderSoft} !important; }
          .rd-step:hover:not([disabled]) { background: rgba(120,160,255,0.08) !important; }
          .rd-step[disabled] { opacity: 0.28; cursor: default; }
          .rd-clear:hover { background: ${Z.bgHover} !important; color: ${Z.textSecondary} !important; }
          .rd-gen:hover:not([disabled]) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 12px 32px rgba(59,130,246,0.38) !important; }
          .rd-gen[disabled] { opacity: 0.36; cursor: default; transform: none !important; filter: none !important; box-shadow: none !important; }
          @keyframes rdSpin { to { transform: rotate(360deg); } }
        `}</style>

        {/* ── ROW 1: Prompt bar ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* Upload / Add button — 48×48 */}
          <button
            className="rd-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingRef}
            title="Upload reference image, attach brand asset, or add logo"
            style={{
              flexShrink:     0,
              width:          48, height: 48,
              borderRadius:   16,
              border:         `1px solid ${refImageUrl ? Z.borderActive : Z.borderSubtle}`,
              background:     refImageUrl ? "rgba(59,130,246,0.15)" : Z.bgInput,
              color:          refImageUrl ? Z.accentBlue : Z.textMuted,
              cursor:         isUploadingRef ? "default" : "pointer",
              display:        "flex", alignItems: "center", justifyContent: "center",
              transition:     "all 0.15s ease",
              fontSize:       22, fontWeight: 300, lineHeight: 1,
            }}
          >
            {isUploadingRef ? (
              <span style={{ fontSize: 16, animation: "rdSpin 0.8s linear infinite", display: "inline-block" }}>⟳</span>
            ) : refImageUrl ? (
              <span style={{ fontSize: 15 }}>✓</span>
            ) : "+"}
          </button>

          {/* Prompt input — 56px tall */}
          <input
            className="rd-prompt"
            type="text"
            placeholder={
              selectedConceptId
                ? "Refine this concept before rendering — add direction, mood, or extra detail…"
                : "Describe the scene, campaign, or direction you want to create…"
            }
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !isRenderDisabled) handleGenerate(); }}
            style={{
              flex:         1,
              height:       56,
              background:   Z.bgInput,
              border:       `1px solid ${Z.borderSubtle}`,
              borderRadius: 20,
              padding:      "0 18px",
              color:        Z.textPrimary,
              fontSize:     15,
              fontWeight:   500,
              fontFamily:   "inherit",
              transition:   "border-color 0.15s ease",
            }}
          />

          {/* Clear prompt */}
          {promptText && (
            <button
              className="rd-clear"
              onClick={() => setPromptText("")}
              style={{
                flexShrink: 0, width: 32, height: 32,
                borderRadius: 9, border: "none",
                background: Z.bgInput, color: Z.textMuted,
                cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              title="Clear"
            >×</button>
          )}
        </div>

        {/* ── ROW 2: Render controls ────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* ── 1. Model selector — 190px ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
              style={{
                ...pillBase, minWidth: 190,
                background:  openDropdown === "model" ? "rgba(59,130,246,0.12)" : Z.bgInput,
                borderColor: openDropdown === "model" ? Z.borderActive : Z.borderSubtle,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: Z.textMuted, textTransform: "uppercase" }}>Model</span>
              <span style={{ flex: 1, color: Z.textPrimary }}>{selectedModel.label}</span>
              {manualModelOverride && <span style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>⚡</span>}
              <span style={{ fontSize: 10, color: Z.textMuted }}>▾</span>
            </button>

            {openDropdown === "model" && (
              <div style={{ ...dropdownBase, minWidth: 220 }}>
                {manualModelOverride && (
                  <div style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, color: "#F59E0B", borderBottom: `1px solid ${Z.borderSubtle}`, letterSpacing: "0.04em" }}>
                    ⚡ Manual override active
                  </div>
                )}
                {CD_MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleModelChange(m.value)}
                    style={{
                      ...dropdownItemBase,
                      background: model === m.value ? "rgba(59,130,246,0.12)" : "transparent",
                      color:      model === m.value ? Z.accentBlue : Z.textPrimary,
                      fontWeight: model === m.value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (model !== m.value) (e.currentTarget as HTMLButtonElement).style.background = Z.bgHover; }}
                    onMouseLeave={(e) => { if (model !== m.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {m.label}
                    {model === m.value && <span style={{ float: "right", fontSize: 12, color: Z.textMuted }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 2. Quality — 122px ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "quality" ? null : "quality")}
              style={{
                ...pillBase, minWidth: 122,
                background:  openDropdown === "quality" ? "rgba(59,130,246,0.12)" : Z.bgInput,
                borderColor: openDropdown === "quality" ? Z.borderActive : Z.borderSubtle,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: Z.textMuted, textTransform: "uppercase" }}>Quality</span>
              <span style={{ color: Z.textPrimary }}>{quality.charAt(0).toUpperCase() + quality.slice(1)}</span>
              <span style={{ fontSize: 10, color: Z.textMuted }}>▾</span>
            </button>

            {openDropdown === "quality" && (
              <div style={{ ...dropdownBase, minWidth: 192 }}>
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => { setQuality(q.value); setOpenDropdown(null); }}
                    style={{
                      ...dropdownItemBase,
                      background: quality === q.value ? "rgba(59,130,246,0.12)" : "transparent",
                      color:      quality === q.value ? Z.accentBlue : Z.textPrimary,
                      fontWeight: quality === q.value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (quality !== q.value) (e.currentTarget as HTMLButtonElement).style.background = Z.bgHover; }}
                    onMouseLeave={(e) => { if (quality !== q.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <div>{q.label}</div>
                    <div style={{ fontSize: 12, color: Z.textMuted, marginTop: 2 }}>{q.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. Resolution — 112px ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "resolution" ? null : "resolution")}
              style={{
                ...pillBase, minWidth: 112,
                background:  openDropdown === "resolution" ? "rgba(59,130,246,0.12)" : Z.bgInput,
                borderColor: openDropdown === "resolution" ? Z.borderActive : Z.borderSubtle,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: Z.textMuted, textTransform: "uppercase" }}>Res</span>
              <span style={{ color: Z.textPrimary }}>{resolution.toUpperCase()}</span>
              <span style={{ fontSize: 10, color: Z.textMuted }}>▾</span>
            </button>

            {openDropdown === "resolution" && (
              <div style={{ ...dropdownBase, minWidth: 170 }}>
                {RESOLUTION_OPTIONS.map((r) => {
                  const supported = selectedModel.supportedResolutions.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      onClick={() => { if (supported) { setResolution(r.value); setOpenDropdown(null); } }}
                      disabled={!supported}
                      title={!supported ? "Not available for this model" : undefined}
                      style={{
                        ...dropdownItemBase,
                        background: resolution === r.value ? "rgba(59,130,246,0.12)" : "transparent",
                        color:      !supported ? Z.textMuted : resolution === r.value ? Z.accentBlue : Z.textPrimary,
                        fontWeight: resolution === r.value ? 600 : 400,
                        cursor:     supported ? "pointer" : "default",
                        opacity:    supported ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => { if (supported && resolution !== r.value) (e.currentTarget as HTMLButtonElement).style.background = Z.bgHover; }}
                      onMouseLeave={(e) => { if (supported && resolution !== r.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {r.label} {!supported && <span style={{ fontSize: 11, color: Z.textMuted }}>⊘</span>}
                      </div>
                      <div style={{ fontSize: 12, color: Z.textMuted, marginTop: 2 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 4. Aspect ratio — 130px ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "aspect" ? null : "aspect")}
              style={{
                ...pillBase, minWidth: 130,
                background:  openDropdown === "aspect" ? "rgba(59,130,246,0.12)" : Z.bgInput,
                borderColor: openDropdown === "aspect" ? Z.borderActive : Z.borderSubtle,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: Z.textMuted, textTransform: "uppercase" }}>Ratio</span>
              <span style={{ color: Z.textPrimary }}>{aspectRatio}</span>
              <span style={{ fontSize: 10, color: Z.textMuted }}>▾</span>
            </button>

            {openDropdown === "aspect" && (
              <div style={{ ...dropdownBase, minWidth: 160 }}>
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => { setAspectRatio(ar); setOpenDropdown(null); }}
                    style={{
                      ...dropdownItemBase, padding: "8px 16px",
                      background: aspectRatio === ar ? "rgba(59,130,246,0.12)" : "transparent",
                      color:      aspectRatio === ar ? Z.accentBlue : Z.textPrimary,
                      fontWeight: aspectRatio === ar ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (aspectRatio !== ar) (e.currentTarget as HTMLButtonElement).style.background = Z.bgHover; }}
                    onMouseLeave={(e) => { if (aspectRatio !== ar) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {ar === "Auto"
                      ? <span>{ar} <span style={{ fontSize: 12, color: Z.textMuted }}>— smart default</span></span>
                      : ar
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 5. Output count — 112px ── */}
          <div style={{
            display: "flex", alignItems: "center",
            height: 44, minWidth: 112, borderRadius: 12,
            border: `1px solid ${Z.borderSubtle}`,
            background: Z.bgInput, overflow: "hidden", flexShrink: 0,
          }}>
            <button
              className="rd-step"
              onClick={() => setOutputCount((n) => Math.max(1, n - 1))}
              disabled={outputCount <= 1 || isGenerating}
              style={{
                width: 36, height: "100%", border: "none",
                background: "transparent",
                cursor: outputCount <= 1 || isGenerating ? "default" : "pointer",
                color: Z.textSecondary, fontSize: 18, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s ease",
              }}
            >−</button>
            <div style={{
              flex: 1, textAlign: "center",
              fontSize: 15, fontWeight: 700, color: Z.textPrimary,
              userSelect: "none",
            }}>{outputCount}</div>
            <button
              className="rd-step"
              onClick={() => setOutputCount((n) => Math.min(4, n + 1))}
              disabled={outputCount >= 4 || isGenerating}
              style={{
                width: 36, height: "100%", border: "none",
                background: "transparent",
                cursor: outputCount >= 4 || isGenerating ? "default" : "pointer",
                color: Z.textSecondary, fontSize: 18, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s ease",
              }}
            >+</button>
          </div>

          {/* Credit estimate */}
          <div style={{
            fontSize: 13, fontWeight: 500, color: Z.textSecondary,
            flexShrink: 0, whiteSpace: "nowrap", paddingLeft: 2,
          }}>
            ~{creditEstimate} cr
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Variation mode chip */}
          {isVariationMode && selectedConceptId && (
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              padding: "3px 10px", borderRadius: 20,
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#C4B5FD", flexShrink: 0,
            }}>MODE: VARIATION</span>
          )}

          {/* ── 6. Context CTA button ── */}
          <button
            className="rd-gen"
            onClick={handleGenerate}
            disabled={ctaMode === "select-concept"}
            style={{
              height:       44,
              minWidth:     ctaMode === "render" ? 200 : ctaMode === "generate-concepts" ? 180 : 172,
              padding:      "0 22px",
              borderRadius: 12,
              border:       ctaMode === "select-concept"
                ? `1px solid ${Z.borderSubtle}`
                : "none",
              background:   ctaMode === "select-concept"
                ? Z.bgInput
                : ctaMode === "generate-concepts"
                ? "linear-gradient(135deg, rgba(16,185,129,0.85) 0%, rgba(5,150,105,0.85) 100%)"
                : "linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(79,70,229,0.9) 100%)",
              color:        ctaMode === "select-concept" ? Z.textMuted : Z.textPrimary,
              fontSize:     14, fontWeight: 700,
              cursor:       ctaMode === "select-concept" ? "default" : "pointer",
              letterSpacing: "0.01em",
              display:      "flex", alignItems: "center", justifyContent: "center",
              gap:          8, flexShrink: 0, whiteSpace: "nowrap",
              boxShadow:    ctaMode === "select-concept"
                ? "none"
                : ctaMode === "generate-concepts"
                ? "0 8px 24px rgba(16,185,129,0.2)"
                : "0 8px 24px rgba(59,130,246,0.28)",
              transition:   "all 0.18s ease",
            }}
          >
            {(isGenerating || isGeneratingConcepts) && (
              <span style={{ animation: "rdSpin 0.8s linear infinite", display: "inline-block", fontSize: 14 }}>⟳</span>
            )}
            {generateLabel}
          </button>
        </div>
      </div>
    </>
  );
}
