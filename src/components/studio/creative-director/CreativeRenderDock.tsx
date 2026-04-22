"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CreativeRenderDock — Floating render command bar (Zencra-branded)
// Positioned inside the center zone — does not overlap left / right panels.
// Row 1: upload + prompt instruction
// Row 2: model → quality → resolution → ratio → count → estimate → generate
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferenceImage {
  url: string;
  weight: number;
}

export interface RenderDockSettings {
  model: string;
  quality: "low" | "medium" | "high";
  resolution: "1k" | "2k" | "4k";
  aspectRatio: string;
  outputCount: number;
  promptText: string;
  referenceImages?: ReferenceImage[];
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
  bgDock:       "#0a0a0a",
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
  maxUploads: number;  // max reference images this model accepts
}

const CD_MODELS: CDModel[] = [
  { value: "gpt-image-1",     label: "GPT Image 2",        provider: "openai",       supportedResolutions: ["1k", "2k"],        defaultQuality: "medium", baseCredits: 8,  maxUploads: 16 },
  { value: "nano-banana-pro", label: "Nano Banana Pro",    provider: "nano-banana",  supportedResolutions: ["1k", "2k", "4k"],  defaultQuality: "high",   baseCredits: 12, maxUploads: 14 },
  { value: "nano-banana-2",   label: "Nano Banana 2",      provider: "nano-banana",  supportedResolutions: ["1k", "2k", "4k"],  defaultQuality: "medium", baseCredits: 10, maxUploads: 14 },
  { value: "seedream-v5",     label: "Seedream 5.0 Lite",  provider: "fal",          supportedResolutions: ["1k", "2k"],        defaultQuality: "low",    baseCredits: 5,  maxUploads: 14 },
  { value: "flux-kontext",    label: "Flux Kontext Max",   provider: "fal",          supportedResolutions: ["1k", "2k"],        defaultQuality: "medium", baseCredits: 8,  maxUploads: 1  },
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

/**
 * Compute influence weights for reference images.
 * Primary = 0.7; remaining 0.3 split evenly across secondaries.
 */
function computeReferenceWeights(
  images: Array<{ id: string; url: string }>,
  primaryId: string | null
): ReferenceImage[] {
  if (images.length === 0) return [];
  const pid = primaryId ?? images[0].id;
  const secondaryCount = images.filter((i) => i.id !== pid).length;
  const secondaryWeight = secondaryCount > 0
    ? Math.round(((1 - 0.7) / secondaryCount) * 1000) / 1000
    : 0;
  return images.map((img) => ({
    url: img.url,
    weight: img.id === pid ? 0.7 : secondaryWeight,
  }));
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
  const [promptText,      setPromptText]      = useState<string>("");
  const [uploadedImages,  setUploadedImages]  = useState<Array<{ id: string; url: string }>>([]);
  const [primaryImageId,  setPrimaryImageId]  = useState<string | null>(null);

  const [manualModelOverride, setManualModelOverride] = useState(false);
  const [openDropdown,        setOpenDropdown]        = useState<string | null>(null);
  const [isUploadingRef,      setIsUploadingRef]      = useState(false);

  // ── Reference image influence system ──────────────────────────────────────
  // primaryId: first image is implicitly primary unless user clicks a different one
  const primaryId = primaryImageId ?? uploadedImages[0]?.id ?? null;
  const imgCount  = uploadedImages.length;

  // Render primary first, then secondaries in upload order
  const primaryImg    = uploadedImages.find((i) => i.id === primaryId) ?? null;
  const secondaryImgs = uploadedImages.filter((i) => i.id !== primaryId);
  const orderedImgs   = primaryImg ? [primaryImg, ...secondaryImgs] : uploadedImages;

  // Chip height by count and role
  const getChipH = (imgId: string): number => {
    if (imgCount === 1) return 76;                              // hero
    if (imgCount <= 4)  return imgId === primaryId ? 72 : 58;  // strip
    return imgId === primaryId ? 68 : 52;                       // scrollable strip
  };

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
    try {
      const url = await onReferenceUpload(file);
      setUploadedImages((prev) => {
        if (prev.length >= selectedModel.maxUploads) return prev; // guard limit
        return [...prev, { id: `${Date.now()}-${Math.random()}`, url }];
      });
    }
    catch { /* caller handles toast */ }
    finally { setIsUploadingRef(false); }
  }, [onReferenceUpload, selectedModel.maxUploads]);

  const handleGenerate = useCallback(() => {
    if (ctaMode === "generate-concepts") {
      if (!isGeneratingConcepts) onGenerateConcepts?.();
      return;
    }
    if (isRenderDisabled) return;
    const resolvedRatio    = aspectRatio === "Auto" ? getDefaultAspectRatio(projectType) : aspectRatio;
    const referenceImages  = uploadedImages.length > 0
      ? computeReferenceWeights(uploadedImages, primaryId)
      : undefined;
    onGenerate({ model, quality, resolution, aspectRatio: resolvedRatio, outputCount, promptText, referenceImages });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaMode, isGeneratingConcepts, isRenderDisabled, aspectRatio, projectType, model, quality, resolution, outputCount, promptText, uploadedImages, primaryId, onGenerate, onGenerateConcepts]);

  return (
    <>
      {openDropdown && (
        <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setOpenDropdown(null)} />
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadChange} />

      {/* ══════════════════════════════════════════════════════════════
          DOCK SHELL
          Center zone: 320px panels + 20px gap + 20px outer each side = 360px × 2 = 720px
          width: clamp(840px, calc(100vw - 720px), 1080px) — tighter, more breathable
      ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position:        "fixed",
          bottom:          24,
          left:            "50%",
          transform:       "translateX(-50%)",
          width:           "clamp(840px, calc(100vw - 720px), 1080px)",
          zIndex:          300,
          background:      `${Z.bgDock}f8`,
          backdropFilter:  "blur(36px)",
          WebkitBackdropFilter: "blur(36px)",
          border:          "1px solid rgba(255,255,255,0.16)",
          borderRadius:    24,
          boxShadow:       "inset 0 1px 0 rgba(255,255,255,0.09), 0 0 28px rgba(140,180,255,0.22), 0 14px 44px rgba(0,0,0,0.6), 0 0 70px rgba(86,140,255,0.14)",
          padding:         "16px 20px",
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
          .rd-gen:hover:not([disabled]) { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(140,180,255,0.3), 0 8px 28px rgba(30,58,110,0.7), 0 0 18px rgba(86,140,255,0.28) !important; }
          .rd-gen[disabled] { opacity: 0.36; cursor: default; transform: none !important; filter: none !important; box-shadow: none !important; }
          .rd-chip-remove:hover { background: rgba(255,80,80,0.18) !important; color: #FF8080 !important; }
          .rd-ref-chip { transition: box-shadow 0.15s ease, transform 0.15s ease; }
          .rd-ref-chip:hover { transform: translateY(-2px) !important; }
          .rd-ref-chip--primary:hover { box-shadow: 0 0 0 2px rgba(86,140,255,0.9), 0 0 24px rgba(86,140,255,0.55), 0 4px 12px rgba(0,0,0,0.5) !important; }
          .rd-ref-chip--secondary:hover { box-shadow: 0 0 0 1px rgba(120,160,255,0.5), 0 0 16px rgba(86,140,255,0.3), 0 4px 12px rgba(0,0,0,0.5) !important; }
          @keyframes rdSpin { to { transform: rotate(360deg); } }
          @keyframes rdFadeIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
        `}</style>

        {/* ── ROW 1: Upload chips + Prompt bar ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* ── Upload button — 48×48 ── */}
          <button
            className="rd-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingRef || uploadedImages.length >= selectedModel.maxUploads}
            title={
              uploadedImages.length >= selectedModel.maxUploads
                ? selectedModel.maxUploads === 1
                  ? `${selectedModel.label} accepts 1 reference image only`
                  : `${selectedModel.label} limit reached — upload up to ${selectedModel.maxUploads} images`
                : selectedModel.maxUploads === 1
                  ? "Upload 1 reference image (this model is single-reference)"
                  : `Upload up to ${selectedModel.maxUploads} reference images, brand assets, or logos`
            }
            style={{
              flexShrink:   0,
              width:        48, height: 48,
              borderRadius: 16,
              border:       `1px solid ${uploadedImages.length > 0 ? Z.borderActive : Z.borderSubtle}`,
              background:   uploadedImages.length > 0 ? "rgba(59,130,246,0.12)" : Z.bgInput,
              color:        uploadedImages.length > 0 ? Z.accentBlue : Z.textMuted,
              cursor:       (isUploadingRef || uploadedImages.length >= selectedModel.maxUploads) ? "default" : "pointer",
              display:      "flex", alignItems: "center", justifyContent: "center",
              transition:   "all 0.15s ease",
              fontSize:     22, fontWeight: 300, lineHeight: 1,
              opacity:      uploadedImages.length >= selectedModel.maxUploads ? 0.38 : 1,
            }}
          >
            {isUploadingRef
              ? <span style={{ fontSize: 16, animation: "rdSpin 0.8s linear infinite", display: "inline-block" }}>⟳</span>
              : "+"}
          </button>

          {/* ── Reference strip + prompt (grows together) ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>

            {/* ── Reference influence strip — only when images exist ── */}
            {uploadedImages.length > 0 && (
              <div style={{
                display:        "flex",
                alignItems:     "flex-end",  // secondary chips bottom-align with primary
                gap:            6,
                overflowX:      imgCount >= 5 ? "auto" : "visible",
                paddingBottom:  2,
                scrollbarWidth: "none",
              }}>
                {orderedImgs.map((img) => {
                  const isPrimary = img.id === primaryId;
                  const chipH     = getChipH(img.id);
                  // width proportional: primary slightly wider (square-ish)
                  const chipW     = imgCount === 1 ? 128 : isPrimary ? chipH + 8 : chipH;

                  return (
                    <div
                      key={img.id}
                      className={`rd-ref-chip rd-ref-chip--${isPrimary ? "primary" : "secondary"}`}
                      onClick={() => {
                        if (!isPrimary) setPrimaryImageId(img.id);
                      }}
                      title={isPrimary
                        ? "Main reference (strongest influence)"
                        : "Supporting reference — click to make primary"}
                      style={{
                        flexShrink:   0,
                        position:     "relative",
                        width:        chipW,
                        height:       chipH,
                        borderRadius: 10,
                        overflow:     "hidden",
                        cursor:       isPrimary ? "default" : "pointer",
                        border:       isPrimary
                          ? "1.5px solid rgba(86,140,255,0.7)"
                          : `1px solid ${Z.borderSoft}`,
                        background:   Z.bgInput,
                        animation:    "rdFadeIn 0.18s ease",
                        transform:    isPrimary ? "scale(1.05)" : "scale(1)",
                        transformOrigin: "bottom center",
                        boxShadow:    isPrimary
                          ? "0 0 0 2px rgba(86,140,255,0.5), 0 0 20px rgba(86,140,255,0.35), 0 0 40px rgba(86,140,255,0.12)"
                          : "0 0 0 1px rgba(120,160,255,0.15), 0 0 8px rgba(86,140,255,0.08)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={isPrimary ? "Primary reference" : "Supporting reference"}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        draggable={false}
                      />

                      {/* PRIMARY badge */}
                      {isPrimary && (
                        <div style={{
                          position:     "absolute",
                          bottom:       4, left: 4,
                          fontSize:     8,
                          fontWeight:   800,
                          letterSpacing: "0.10em",
                          color:        "#ffffff",
                          background:   "rgba(59,130,246,0.92)",
                          borderRadius: 4,
                          padding:      "2px 5px",
                          lineHeight:   1.2,
                          pointerEvents: "none",
                          backdropFilter: "blur(4px)",
                        }}>
                          PRIMARY
                        </div>
                      )}

                      {/* Remove button */}
                      <button
                        className="rd-chip-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImages((prev) => prev.filter((x) => x.id !== img.id));
                          if (isPrimary) setPrimaryImageId(null);
                        }}
                        title="Remove"
                        style={{
                          position:   "absolute", top: 3, right: 3,
                          width:      17, height: 17,
                          borderRadius: 5,
                          border:     "none",
                          background: "rgba(0,0,0,0.6)",
                          color:      "rgba(255,255,255,0.8)",
                          fontSize:   11,
                          lineHeight: 1,
                          cursor:     "pointer",
                          display:    "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.12s ease",
                          padding:    0,
                          zIndex:     2,
                        }}
                      >×</button>
                    </div>
                  );
                })}

                {/* Limit counter */}
                <div style={{
                  flexShrink:  0,
                  display:     "flex",
                  alignItems:  "flex-end",
                  paddingBottom: 4,
                  fontSize:    11,
                  color:       Z.textMuted,
                  paddingLeft: 2,
                  whiteSpace:  "nowrap",
                }}>
                  {uploadedImages.length}/{selectedModel.maxUploads}
                </div>
              </div>
            )}

            {/* Prompt input */}
            <input
              className="rd-prompt"
              type="text"
              placeholder={
                uploadedImages.length > 0
                  ? "Describe how to blend these references — style, mood, or creative direction…"
                  : selectedConceptId
                  ? "Refine this concept before rendering — add direction, mood, or extra detail…"
                  : "Describe the scene, campaign, or direction you want to create…"
              }
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isRenderDisabled) handleGenerate(); }}
              style={{
                width:        "100%",
                height:       uploadedImages.length > 0 ? 44 : 56,
                background:   Z.bgInput,
                border:       `1px solid ${Z.borderSubtle}`,
                borderRadius: 20,
                padding:      "0 18px",
                color:        Z.textPrimary,
                fontSize:     15,
                fontWeight:   500,
                fontFamily:   "inherit",
                transition:   "border-color 0.15s ease, height 0.2s ease",
                boxSizing:    "border-box",
              }}
            />
          </div>

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
            fontSize: 15, fontWeight: 600, color: "rgba(200,215,255,0.75)",
            flexShrink: 0, whiteSpace: "nowrap", paddingLeft: 2,
            letterSpacing: "-0.01em",
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

          {/* ── 6. Context CTA button — Zencra premium blue ── */}
          <button
            className="rd-gen"
            onClick={handleGenerate}
            disabled={ctaMode === "select-concept"}
            style={{
              height:       46,
              minWidth:     ctaMode === "render" ? 210 : ctaMode === "generate-concepts" ? 188 : 176,
              padding:      "0 22px",
              borderRadius: 12,
              border:       ctaMode === "select-concept"
                ? `1px solid ${Z.borderSubtle}`
                : "1px solid rgba(140,180,255,0.22)",   /* silver-white glow border */
              background:   ctaMode === "select-concept"
                ? Z.bgInput
                : "linear-gradient(135deg, #1E3A6E 0%, #1A2F5E 45%, #0F1F42 100%)",  /* deep blue */
              color:        ctaMode === "select-concept" ? Z.textMuted : Z.textPrimary,
              fontSize:     14,
              fontWeight:   700,
              cursor:       ctaMode === "select-concept" ? "default" : "pointer",
              letterSpacing: "0.02em",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              gap:          8,
              flexShrink:   0,
              whiteSpace:   "nowrap",
              boxShadow:    ctaMode === "select-concept"
                ? "none"
                : "0 0 0 1px rgba(120,160,255,0.18), 0 4px 20px rgba(30,58,110,0.55), 0 0 12px rgba(86,140,255,0.2)",
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
