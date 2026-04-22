"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CreativeRenderDock — Floating bottom command bar for Creative Director mode
// Render execution controls: model → quality → resolution → ratio → count → generate
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
  onGenerate: (settings: RenderDockSettings) => void;
  onReferenceUpload?: (file: File) => Promise<string>;
}

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
  {
    value: "gpt-image-1",
    label: "GPT Image 2",
    provider: "openai",
    supportedResolutions: ["1k", "2k"],
    defaultQuality: "medium",
    baseCredits: 8,
  },
  {
    value: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "nano-banana",
    supportedResolutions: ["1k", "2k", "4k"],
    defaultQuality: "high",
    baseCredits: 12,
  },
  {
    value: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "nano-banana",
    supportedResolutions: ["1k", "2k", "4k"],
    defaultQuality: "medium",
    baseCredits: 10,
  },
  {
    value: "seedream-v5",
    label: "Seedream v5",
    provider: "fal",
    supportedResolutions: ["1k", "2k"],
    defaultQuality: "low",
    baseCredits: 5,
  },
  {
    value: "flux-kontext",
    label: "Flux Kontext",
    provider: "fal",
    supportedResolutions: ["1k", "2k"],
    defaultQuality: "medium",
    baseCredits: 8,
  },
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

const ASPECT_RATIOS = [
  "Auto", "1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9",
];

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

function estimateCredits(
  model: string,
  quality: string,
  resolution: string,
  count: number,
): number {
  const m = CD_MODELS.find((x) => x.value === model);
  const base = m?.baseCredits ?? 8;
  const qMult = quality === "low" ? 0.7 : quality === "high" ? 1.35 : 1.0;
  const rMult = resolution === "2k" ? 1.5 : resolution === "4k" ? 2.5 : 1.0;
  return Math.round(base * qMult * rMult * count * 10) / 10;
}

// ── Shared pill button style ───────────────────────────────────────────────────

const pillBase: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
  transition: "all 0.15s ease",
};

const dropdownBase: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  left: 0,
  background: "rgba(10,10,18,0.98)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  overflow: "hidden",
  zIndex: 400,
  boxShadow: "0 12px 40px rgba(0,0,0,0.75)",
};

const dropdownItemBase: React.CSSProperties = {
  width: "100%",
  display: "block",
  textAlign: "left",
  padding: "9px 14px",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  transition: "background 0.1s ease",
};

const vSep: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "rgba(255,255,255,0.08)",
  flexShrink: 0,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CreativeRenderDock({
  selectedConceptId,
  conceptRecommendedProvider,
  projectType = "",
  isGenerating,
  isVariationMode = false,
  onGenerate,
  onReferenceUpload,
}: CreativeRenderDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dock controls state
  const [model,       setModel]       = useState<string>("gpt-image-1");
  const [quality,     setQuality]     = useState<"low" | "medium" | "high">("medium");
  const [resolution,  setResolution]  = useState<"1k" | "2k" | "4k">("1k");
  const [aspectRatio, setAspectRatio] = useState<string>("Auto");
  const [outputCount, setOutputCount] = useState<number>(4);
  const [promptText,  setPromptText]  = useState<string>("");
  const [refImageUrl, setRefImageUrl] = useState<string>("");

  // UI state
  const [manualModelOverride, setManualModelOverride] = useState(false);
  const [openDropdown,        setOpenDropdown]        = useState<string | null>(null);
  const [isUploadingRef,      setIsUploadingRef]      = useState(false);

  // ── Smart defaults: concept recommendation fills model + quality ───────────
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

  // ── Concept change clears manual override ─────────────────────────────────
  useEffect(() => {
    setManualModelOverride(false);
  }, [selectedConceptId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedModel   = CD_MODELS.find((x) => x.value === model) ?? CD_MODELS[0];
  const creditEstimate  = estimateCredits(model, quality, resolution, outputCount);
  const isDisabled      = !selectedConceptId || isGenerating;
  const generateLabel   = isGenerating ? "Generating…"
    : isVariationMode ? "Generate Variation"
    : "Generate";

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    try {
      const url = await onReferenceUpload(file);
      setRefImageUrl(url);
    } catch {
      // caller handles toast
    } finally {
      setIsUploadingRef(false);
    }
  }, [onReferenceUpload]);

  const handleGenerate = useCallback(() => {
    if (isDisabled) return;
    const resolvedRatio = aspectRatio === "Auto"
      ? getDefaultAspectRatio(projectType)
      : aspectRatio;
    onGenerate({
      model,
      quality,
      resolution,
      aspectRatio: resolvedRatio,
      outputCount,
      promptText,
      referenceImageUrl: refImageUrl || undefined,
    });
  }, [
    isDisabled, aspectRatio, projectType, model, quality,
    resolution, outputCount, promptText, refImageUrl, onGenerate,
  ]);

  return (
    <>
      {/* Backdrop — closes any open dropdown */}
      {openDropdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 299 }}
          onClick={() => setOpenDropdown(null)}
        />
      )}

      {/* Hidden file input for reference upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleUploadChange}
      />

      {/* ── Render Dock shell ── */}
      <div
        style={{
          position:        "fixed",
          bottom:          20,
          left:            "50%",
          transform:       "translateX(-50%)",
          width:           "calc(100vw - 48px)",
          maxWidth:        1220,
          zIndex:          300,
          background:      "rgba(8,8,14,0.97)",
          backdropFilter:  "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border:          "1px solid rgba(255,255,255,0.09)",
          borderRadius:    26,
          boxShadow:       "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(37,99,235,0.05)",
          padding:         "12px 16px 12px",
          display:         "flex",
          flexDirection:   "column",
          gap:             9,
        }}
      >
        {/* Scoped styles */}
        <style>{`
          .rd-pill:hover:not([disabled]) { border-color: rgba(255,255,255,0.22) !important; background: rgba(255,255,255,0.09) !important; }
          .rd-pill[disabled] { opacity: 0.38; cursor: default !important; }
          .rd-prompt:focus { outline: none; border-color: rgba(37,99,235,0.45) !important; }
          .rd-stepper-btn:hover:not([disabled]) { background: rgba(255,255,255,0.07) !important; }
          .rd-stepper-btn[disabled] { opacity: 0.3; cursor: default; }
          .rd-generate:hover:not([disabled]) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 0 28px rgba(37,99,235,0.45) !important; }
          .rd-generate[disabled] { opacity: 0.35; cursor: default; transform: none !important; filter: none !important; }
          .rd-upload:hover { background: rgba(255,255,255,0.09) !important; border-color: rgba(255,255,255,0.2) !important; }
          .rd-clear:hover { background: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.7) !important; }
          @keyframes rdSpin { to { transform: rotate(360deg); } }
        `}</style>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ROW 1 — Prompt bar                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* Upload / Add button */}
          <button
            className="rd-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingRef}
            title="Upload reference image, attach brand asset, or add logo"
            style={{
              flexShrink:     0,
              width:          44,
              height:         44,
              borderRadius:   12,
              border:         refImageUrl
                ? "1px solid rgba(37,99,235,0.45)"
                : "1px solid rgba(255,255,255,0.12)",
              background:     refImageUrl
                ? "rgba(37,99,235,0.15)"
                : "rgba(255,255,255,0.05)",
              color:          refImageUrl ? "#93c5fd" : "rgba(255,255,255,0.55)",
              cursor:         isUploadingRef ? "default" : "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              transition:     "all 0.15s ease",
            }}
          >
            {isUploadingRef ? (
              <span style={{ fontSize: 15, animation: "rdSpin 0.8s linear infinite", display: "inline-block" }}>⟳</span>
            ) : refImageUrl ? (
              <span style={{ fontSize: 14 }}>✓</span>
            ) : (
              <span style={{ fontSize: 22, lineHeight: 1, marginTop: -1, fontWeight: 300 }}>+</span>
            )}
          </button>

          {/* Prompt input */}
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
            onKeyDown={(e) => { if (e.key === "Enter" && !isDisabled) handleGenerate(); }}
            style={{
              flex:         1,
              height:       44,
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding:      "0 14px",
              color:        "#fff",
              fontSize:     13,
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
                flexShrink:     0,
                width:          30,
                height:         30,
                borderRadius:   8,
                border:         "none",
                background:     "rgba(255,255,255,0.05)",
                color:          "rgba(255,255,255,0.3)",
                cursor:         "pointer",
                fontSize:       16,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                transition:     "all 0.15s ease",
              }}
              title="Clear"
            >×</button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ROW 2 — Render controls                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>

          {/* ── 1. Model selector ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
              style={{
                ...pillBase,
                minWidth:   186,
                background: openDropdown === "model" ? "rgba(37,99,235,0.12)" : pillBase.background,
                borderColor: openDropdown === "model" ? "rgba(37,99,235,0.35)" : undefined,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.05em" }}>MODEL</span>
              <span style={{ flex: 1 }}>{selectedModel.label}</span>
              {manualModelOverride && (
                <span style={{ fontSize: 9, color: "rgba(251,191,36,0.75)", fontWeight: 700 }}>⚡</span>
              )}
              <span style={{ fontSize: 9, opacity: 0.35 }}>▾</span>
            </button>

            {openDropdown === "model" && (
              <div style={{ ...dropdownBase, minWidth: 210 }}>
                {manualModelOverride && (
                  <div style={{
                    padding: "6px 14px",
                    fontSize: 10, fontWeight: 600,
                    color: "rgba(251,191,36,0.75)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    letterSpacing: "0.04em",
                  }}>
                    ⚡ Manual override active
                  </div>
                )}
                {CD_MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleModelChange(m.value)}
                    style={{
                      ...dropdownItemBase,
                      background: model === m.value ? "rgba(37,99,235,0.12)" : "transparent",
                      color:      model === m.value ? "#93c5fd" : "rgba(255,255,255,0.82)",
                      fontWeight: model === m.value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (model !== m.value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (model !== m.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {m.label}
                    {model === m.value && <span style={{ float: "right", fontSize: 11, opacity: 0.5 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 2. Quality selector ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "quality" ? null : "quality")}
              style={{
                ...pillBase,
                background: openDropdown === "quality" ? "rgba(37,99,235,0.12)" : pillBase.background,
                borderColor: openDropdown === "quality" ? "rgba(37,99,235,0.35)" : undefined,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.05em" }}>QUALITY</span>
              <span>{quality.charAt(0).toUpperCase() + quality.slice(1)}</span>
              <span style={{ fontSize: 9, opacity: 0.35 }}>▾</span>
            </button>

            {openDropdown === "quality" && (
              <div style={{ ...dropdownBase, minWidth: 188 }}>
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => { setQuality(q.value); setOpenDropdown(null); }}
                    style={{
                      ...dropdownItemBase,
                      background: quality === q.value ? "rgba(37,99,235,0.12)" : "transparent",
                      color:      quality === q.value ? "#93c5fd" : "rgba(255,255,255,0.82)",
                      fontWeight: quality === q.value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (quality !== q.value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (quality !== q.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <div>{q.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{q.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. Resolution selector ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "resolution" ? null : "resolution")}
              style={{
                ...pillBase,
                background: openDropdown === "resolution" ? "rgba(37,99,235,0.12)" : pillBase.background,
                borderColor: openDropdown === "resolution" ? "rgba(37,99,235,0.35)" : undefined,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.05em" }}>RES</span>
              <span>{resolution.toUpperCase()}</span>
              <span style={{ fontSize: 9, opacity: 0.35 }}>▾</span>
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
                        background: resolution === r.value ? "rgba(37,99,235,0.12)" : "transparent",
                        color:      !supported
                          ? "rgba(255,255,255,0.22)"
                          : resolution === r.value
                          ? "#93c5fd"
                          : "rgba(255,255,255,0.82)",
                        fontWeight: resolution === r.value ? 600 : 400,
                        cursor:     supported ? "pointer" : "default",
                        opacity:    supported ? 1 : 0.55,
                      }}
                      onMouseEnter={(e) => { if (supported && resolution !== r.value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={(e) => { if (supported && resolution !== r.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {r.label}
                        {!supported && <span style={{ fontSize: 10 }}>⊘</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 4. Aspect ratio selector ── */}
          <div style={{ position: "relative" }}>
            <button
              className="rd-pill"
              disabled={isGenerating}
              onClick={() => setOpenDropdown(openDropdown === "aspect" ? null : "aspect")}
              style={{
                ...pillBase,
                minWidth:   130,
                background: openDropdown === "aspect" ? "rgba(37,99,235,0.12)" : pillBase.background,
                borderColor: openDropdown === "aspect" ? "rgba(37,99,235,0.35)" : undefined,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: "0.05em" }}>RATIO</span>
              <span>{aspectRatio}</span>
              <span style={{ fontSize: 9, opacity: 0.35 }}>▾</span>
            </button>

            {openDropdown === "aspect" && (
              <div style={{ ...dropdownBase, minWidth: 148 }}>
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => { setAspectRatio(ar); setOpenDropdown(null); }}
                    style={{
                      ...dropdownItemBase,
                      padding:    "7px 14px",
                      background: aspectRatio === ar ? "rgba(37,99,235,0.12)" : "transparent",
                      color:      aspectRatio === ar ? "#93c5fd" : "rgba(255,255,255,0.82)",
                      fontWeight: aspectRatio === ar ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (aspectRatio !== ar) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (aspectRatio !== ar) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {ar === "Auto"
                      ? <span>Auto <span style={{ fontSize: 11, opacity: 0.38 }}>— smart default</span></span>
                      : ar
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={vSep} />

          {/* ── 5. Output count stepper ── */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            height:       36,
            borderRadius: 10,
            border:       "1px solid rgba(255,255,255,0.12)",
            background:   "rgba(255,255,255,0.05)",
            overflow:     "hidden",
            flexShrink:   0,
          }}>
            <button
              className="rd-stepper-btn"
              onClick={() => setOutputCount((n) => Math.max(1, n - 1))}
              disabled={outputCount <= 1 || isGenerating}
              style={{
                width: 30, height: "100%", border: "none",
                background: "transparent",
                cursor: outputCount <= 1 || isGenerating ? "default" : "pointer",
                color: "rgba(255,255,255,0.45)", fontSize: 17, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s ease",
              }}
            >−</button>
            <div style={{
              minWidth: 26, textAlign: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
              userSelect: "none",
            }}>
              {outputCount}
            </div>
            <button
              className="rd-stepper-btn"
              onClick={() => setOutputCount((n) => Math.min(4, n + 1))}
              disabled={outputCount >= 4 || isGenerating}
              style={{
                width: 30, height: "100%", border: "none",
                background: "transparent",
                cursor: outputCount >= 4 || isGenerating ? "default" : "pointer",
                color: "rgba(255,255,255,0.45)", fontSize: 17, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s ease",
              }}
            >+</button>
          </div>

          {/* Credit estimate */}
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.03em",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}>
            ~{creditEstimate} cr
          </div>

          {/* Elastic spacer */}
          <div style={{ flex: 1 }} />

          {/* Helper text — no concept selected */}
          {!selectedConceptId && (
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.28)",
              flexShrink: 0, whiteSpace: "nowrap",
              fontStyle: "italic",
            }}>
              Select a concept to render
            </span>
          )}

          {/* Variation mode chip */}
          {isVariationMode && selectedConceptId && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              padding: "3px 8px", borderRadius: 20,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#c4b5fd",
              flexShrink: 0,
            }}>
              MODE: VARIATION
            </span>
          )}

          {/* ── 6. Generate button ── */}
          <button
            className="rd-generate"
            onClick={handleGenerate}
            disabled={isDisabled}
            style={{
              height:       36,
              padding:      "0 24px",
              borderRadius: 10,
              border:       "none",
              background:   isDisabled
                ? "rgba(255,255,255,0.07)"
                : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              color:        isDisabled ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize:     13,
              fontWeight:   700,
              cursor:       isDisabled ? "default" : "pointer",
              letterSpacing: "0.02em",
              display:      "flex",
              alignItems:   "center",
              gap:          7,
              flexShrink:   0,
              whiteSpace:   "nowrap",
              boxShadow:    isDisabled ? "none" : "0 0 22px rgba(37,99,235,0.28)",
              transition:   "all 0.15s ease",
            }}
          >
            {isGenerating && (
              <span style={{ animation: "rdSpin 0.8s linear infinite", display: "inline-block", fontSize: 14 }}>⟳</span>
            )}
            {generateLabel}
          </button>
        </div>
      </div>
    </>
  );
}
