"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Zap } from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

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

export type BlendMode =
  | "Primary Focus"
  | "Balanced"
  | "Style Transfer"
  | "Comp. Lock"
  | "Free Blend";

export interface StyleLocks {
  style:       boolean;
  lighting:    boolean;
  color:       boolean;
  composition: boolean;
  texture:     boolean;
}

export interface RenderDockSettings {
  model: string;
  quality: "low" | "medium" | "high";
  resolution: "1k" | "2k" | "4k";
  aspectRatio: string;
  outputCount: number;
  promptText: string;
  referenceImages?: ReferenceImage[];
  /** Only present when 2+ reference images are uploaded */
  blendMode?: BlendMode;
  locks?: StyleLocks;
  /** Character Consistency — present when face detected + lock enabled */
  characterLock?: boolean;
  characterReference?: string;
  consistencyStrength?: "low" | "medium" | "high";
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

// ── Blend modes + style locks ──────────────────────────────────────────────────

const BLEND_MODES: BlendMode[] = [
  "Primary Focus",
  "Balanced",
  "Style Transfer",
  "Comp. Lock",
  "Free Blend",
];

const LOCK_KEYS: (keyof StyleLocks)[] = [
  "style", "lighting", "color", "composition", "texture",
];

const LOCK_LABELS: Record<keyof StyleLocks, string> = {
  style:       "Style",
  lighting:    "Lighting",
  color:       "Color",
  composition: "Comp",
  texture:     "Texture",
};

const LOCK_TOOLTIPS: Record<keyof StyleLocks, string> = {
  style:       "Lock visual style — colors, texture, overall aesthetic",
  lighting:    "Preserve lighting conditions across references",
  color:       "Maintain the color palette from references",
  composition: "Keep compositional structure and layout",
  texture:     "Preserve surface texture details",
};

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

/**
 * Try to detect a human face in an image URL using the browser's FaceDetector API.
 * Falls back silently if the API is unavailable (non-Chrome browsers).
 */
async function detectFaceInUrl(url: string): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("FaceDetector" in window)) return false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector({ fastMode: true });
    const faces: unknown[] = await detector.detect(img);
    return faces.length > 0;
  } catch {
    return false;
  }
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
  const [outputCount, setOutputCount] = useState<number>(1);
  const [promptText,      setPromptText]      = useState<string>("");
  const [uploadedImages,  setUploadedImages]  = useState<Array<{ id: string; url: string }>>([]);
  const [primaryImageId,  setPrimaryImageId]  = useState<string | null>(null);

  const [manualModelOverride, setManualModelOverride] = useState(false);
  const [openDropdown,        setOpenDropdown]        = useState<string | null>(null);
  const [isUploadingRef,      setIsUploadingRef]      = useState(false);

  // ── Blend mode + style locks (active when 2+ images uploaded) ─────────────
  const [blendMode,   setBlendMode]   = useState<BlendMode>("Primary Focus");
  const [styleLocks,  setStyleLocks]  = useState<StyleLocks>({
    style: false, lighting: false, color: false, composition: false, texture: false,
  });

  const showBlendControls = uploadedImages.length >= 2;

  // Smart suggestion: when Style Transfer is active, Style lock should be on
  const showStyleLockSuggestion =
    showBlendControls && blendMode === "Style Transfer" && !styleLocks.style;

  const toggleLock = (key: keyof StyleLocks) => {
    setStyleLocks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Character Consistency ─────────────────────────────────────────────────
  const [faceImageIds,        setFaceImageIds]        = useState<Set<string>>(new Set());
  const [characterLock,       setCharacterLock]       = useState(false);
  const [consistencyStrength, setConsistencyStrength] = useState<"low" | "medium" | "high">("medium");
  const checkedImageIdsRef = useRef<Set<string>>(new Set());

  // Run face detection on each newly added image (skips already-checked IDs)
  useEffect(() => {
    for (const img of uploadedImages) {
      if (checkedImageIdsRef.current.has(img.id)) continue;
      checkedImageIdsRef.current.add(img.id);
      void detectFaceInUrl(img.url).then((hasFace) => {
        if (hasFace) setFaceImageIds((prev) => new Set([...prev, img.id]));
      });
    }
  }, [uploadedImages]);

  // ── Reference image influence system ──────────────────────────────────────
  // primaryId: first image is implicitly primary unless user clicks a different one
  const primaryId = primaryImageId ?? uploadedImages[0]?.id ?? null;
  const imgCount  = uploadedImages.length;

  // Character Consistency derived values
  const hasFaceImages          = uploadedImages.some((i) => faceImageIds.has(i.id));
  const showCharacterControls  = hasFaceImages;
  const showCharacterHint      = hasFaceImages && !characterLock;
  const characterReferenceUrl  = primaryId
    ? (uploadedImages.find((i) => i.id === primaryId)?.url ?? null)
    : null;

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
    onGenerate({
      model, quality, resolution,
      aspectRatio: resolvedRatio,
      outputCount, promptText,
      referenceImages,
      ...(showBlendControls ? { blendMode, locks: styleLocks } : {}),
      ...(characterLock && characterReferenceUrl
        ? { characterLock: true, characterReference: characterReferenceUrl, consistencyStrength }
        : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaMode, isGeneratingConcepts, isRenderDisabled, aspectRatio, projectType, model, quality, resolution, outputCount, promptText, uploadedImages, primaryId, showBlendControls, blendMode, styleLocks, characterLock, characterReferenceUrl, consistencyStrength, onGenerate, onGenerateConcepts]);

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
          .rd-gen:hover:not([disabled]) { transform: translateY(-1px); box-shadow: 0 0 14px rgba(86,140,255,0.35), 0 6px 22px rgba(0,0,0,0.6) !important; }
          .rd-gen[disabled] { opacity: 0.36; cursor: default; transform: none !important; filter: none !important; box-shadow: none !important; }
          .rd-chip-remove:hover { background: rgba(255,80,80,0.18) !important; color: #FF8080 !important; }
          .rd-ref-chip { transition: box-shadow 0.15s ease, transform 0.15s ease; }
          .rd-ref-chip:hover { transform: translateY(-2px) !important; }
          .rd-ref-chip--primary:hover { box-shadow: 0 0 0 2px rgba(86,140,255,0.9), 0 0 24px rgba(86,140,255,0.55), 0 4px 12px rgba(0,0,0,0.5) !important; }
          .rd-ref-chip--secondary:hover { box-shadow: 0 0 0 1px rgba(120,160,255,0.5), 0 0 16px rgba(86,140,255,0.3), 0 4px 12px rgba(0,0,0,0.5) !important; }
          .rd-blend:hover { border-color: rgba(86,140,255,0.45) !important; background: rgba(86,140,255,0.1) !important; color: ${Z.textPrimary} !important; }
          .rd-lock:hover { border-color: rgba(86,140,255,0.4) !important; background: rgba(86,140,255,0.1) !important; color: ${Z.textPrimary} !important; }
          .rd-lock-suggest:hover { background: rgba(37,99,235,0.25) !important; border-color: rgba(96,165,250,0.6) !important; }
          .rd-char-toggle:hover { border-color: rgba(245,158,11,0.55) !important; background: rgba(245,158,11,0.1) !important; color: rgba(252,211,77,0.9) !important; }
          .rd-char-strength:hover { border-color: rgba(245,158,11,0.45) !important; background: rgba(245,158,11,0.1) !important; color: rgba(252,211,77,0.85) !important; }
          @keyframes rdSpin { to { transform: rotate(360deg); } }
          @keyframes rdFadeIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
          @keyframes rdSlideIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 36px; } }
        `}</style>

        {/* ── ROW 1: Upload chips + Prompt bar ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* ── Upload button — 48×48 ── */}
          <Tooltip
            content={
              uploadedImages.length >= selectedModel.maxUploads
                ? selectedModel.maxUploads === 1
                  ? `${selectedModel.label} accepts 1 reference image only`
                  : `${selectedModel.label} limit reached — upload up to ${selectedModel.maxUploads} images`
                : selectedModel.maxUploads === 1
                  ? "Upload 1 reference image (this model is single-reference)"
                  : `Upload up to ${selectedModel.maxUploads} reference images, brand assets, or logos`
            }
          >
          <button
            className="rd-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingRef || uploadedImages.length >= selectedModel.maxUploads}
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
          </Tooltip>

          {/* ── Reference strip + prompt (grows together) ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>

            {/* ── Reference influence strip — only when images exist ── */}
            {uploadedImages.length > 0 && (
              <div style={{
                display:        "flex",
                alignItems:     "flex-end",  // secondary chips bottom-align with primary
                gap:            8,
                overflowX:      imgCount >= 5 ? "auto" : "visible",
                paddingBottom:  2,
                scrollbarWidth: "none",
              }}>
                {orderedImgs.map((img) => {
                  const isPrimary     = img.id === primaryId;
                  const isCharacterRef = characterLock && isPrimary;
                  const chipH         = getChipH(img.id);
                  // width proportional: primary slightly wider (square-ish)
                  const chipW         = imgCount === 1 ? 128 : isPrimary ? chipH + 8 : chipH;

                  return (
                    <div
                      key={img.id}
                      className={`rd-ref-chip rd-ref-chip--${isPrimary ? "primary" : "secondary"}`}
                      onClick={() => {
                        if (!isPrimary) setPrimaryImageId(img.id);
                      }}
                      title={
                        isCharacterRef
                          ? "Character reference — face identity locked"
                          : isPrimary
                          ? "Main reference (strongest influence)"
                          : "Supporting reference — click to make primary"
                      }
                      style={{
                        flexShrink:   0,
                        position:     "relative",
                        width:        chipW,
                        height:       chipH,
                        borderRadius: 10,
                        overflow:     "hidden",
                        cursor:       isPrimary ? "default" : "pointer",
                        border:       isCharacterRef
                          ? "1.5px solid rgba(245,158,11,0.75)"
                          : isPrimary
                          ? "1.5px solid rgba(86,140,255,0.7)"
                          : `1px solid ${Z.borderSoft}`,
                        background:   Z.bgInput,
                        animation:    "rdFadeIn 0.18s ease",
                        transform:    isPrimary ? "scale(1.05)" : "scale(1)",
                        transformOrigin: "bottom center",
                        boxShadow:    isCharacterRef
                          ? "0 0 0 2px rgba(245,158,11,0.45), 0 0 20px rgba(245,158,11,0.32), 0 0 40px rgba(245,158,11,0.12)"
                          : isPrimary
                          ? "0 0 0 2px rgba(86,140,255,0.5), 0 0 20px rgba(86,140,255,0.35), 0 0 40px rgba(86,140,255,0.12)"
                          : "0 0 0 1px rgba(120,160,255,0.15), 0 0 8px rgba(86,140,255,0.08)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={isCharacterRef ? "Character reference" : isPrimary ? "Primary reference" : "Supporting reference"}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        draggable={false}
                      />

                      {/* CHARACTER / PRIMARY badge */}
                      {isPrimary && (
                        <div style={{
                          position:     "absolute",
                          bottom:       4, left: 4,
                          fontSize:     8,
                          fontWeight:   800,
                          letterSpacing: "0.10em",
                          color:        "#ffffff",
                          background:   isCharacterRef
                            ? "rgba(245,158,11,0.92)"
                            : "rgba(59,130,246,0.92)",
                          borderRadius: 4,
                          padding:      "2px 5px",
                          lineHeight:   1.2,
                          pointerEvents: "none",
                          backdropFilter: "blur(4px)",
                        }}>
                          {isCharacterRef ? "CHARACTER" : "PRIMARY"}
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

            {/* ── Blend mode + style lock row — fades in at 2+ images ── */}
            <div
              style={{
                maxHeight:  showBlendControls ? 34 : 0,
                opacity:    showBlendControls ? 1 : 0,
                overflow:   "hidden",
                transition: "opacity 0.22s ease, max-height 0.22s ease",
                pointerEvents: showBlendControls ? "auto" : "none",
              }}
            >
              <div style={{
                display:    "flex",
                alignItems: "center",
                gap:        8,
                paddingBottom: 4,
              }}>
                {/* ── Blend mode pills ── */}
                {BLEND_MODES.map((mode) => {
                  const isActive = blendMode === mode;
                  const blendTooltip = mode === "Primary Focus"
                    ? "Primary reference dominates the output"
                    : mode === "Balanced"
                    ? "Equal influence from all references"
                    : mode === "Style Transfer"
                    ? "Transfer style from primary to subject"
                    : mode === "Comp. Lock"
                    ? "Lock composition from primary reference"
                    : "All references blend freely with no hierarchy";
                  return (
                    <Tooltip key={mode} content={blendTooltip}>
                    <button
                      className="rd-blend"
                      onClick={() => setBlendMode(mode)}
                      style={{
                        height:       26,
                        padding:      "0 9px",
                        borderRadius: 20,
                        border:       isActive
                          ? "1px solid rgba(86,140,255,0.55)"
                          : "1px solid rgba(255,255,255,0.1)",
                        background:   isActive
                          ? "rgba(37,99,235,0.22)"
                          : "rgba(255,255,255,0.04)",
                        color:        isActive ? Z.textPrimary : "rgba(167,176,197,0.55)",
                        fontSize:     11,
                        fontWeight:   isActive ? 700 : 500,
                        cursor:       "pointer",
                        whiteSpace:   "nowrap",
                        flexShrink:   0,
                        transform:    isActive ? "scale(1.03)" : "scale(1)",
                        boxShadow:    isActive
                          ? "0 0 0 1px rgba(86,140,255,0.3), 0 0 10px rgba(37,99,235,0.2)"
                          : "none",
                        transition:   "all 0.14s ease",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {mode}
                    </button>
                    </Tooltip>
                  );
                })}

                {/* ── Separator ── */}
                <div style={{ width: 1, height: 14, background: "rgba(120,160,255,0.15)", flexShrink: 0, margin: "0 2px" }} />

                {/* ── Lock label ── */}
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: "rgba(120,140,180,0.5)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  Lock
                </span>

                {/* ── Style lock chips ── */}
                {LOCK_KEYS.map((key) => {
                  const isOn = styleLocks[key];
                  return (
                    <Tooltip key={key} content={LOCK_TOOLTIPS[key]}>
                    <button
                      className="rd-lock"
                      onClick={() => toggleLock(key)}
                      style={{
                        height:       24,
                        padding:      "0 8px",
                        borderRadius: 6,
                        border:       isOn
                          ? "1px solid rgba(86,140,255,0.5)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background:   isOn
                          ? "rgba(37,99,235,0.2)"
                          : "rgba(255,255,255,0.03)",
                        color:        isOn ? "rgba(147,197,253,0.95)" : "rgba(120,140,180,0.5)",
                        fontSize:     10,
                        fontWeight:   700,
                        cursor:       "pointer",
                        whiteSpace:   "nowrap",
                        flexShrink:   0,
                        letterSpacing: "0.04em",
                        boxShadow:    isOn
                          ? "0 0 0 1px rgba(86,140,255,0.25), 0 0 8px rgba(37,99,235,0.18)"
                          : "none",
                        transition:   "all 0.13s ease",
                      }}
                    >
                      {LOCK_LABELS[key]}
                    </button>
                    </Tooltip>
                  );
                })}

                {/* ── Style Transfer suggestion chip ── */}
                {showStyleLockSuggestion && (
                  <Tooltip content="Style Transfer works best with Style lock enabled">
                  <button
                    className="rd-lock-suggest"
                    onClick={() => toggleLock("style")}
                    style={{
                      height:       24,
                      padding:      "0 8px",
                      borderRadius: 6,
                      border:       "1px solid rgba(96,165,250,0.4)",
                      background:   "rgba(37,99,235,0.14)",
                      color:        "rgba(147,197,253,0.8)",
                      fontSize:     10,
                      fontWeight:   700,
                      cursor:       "pointer",
                      whiteSpace:   "nowrap",
                      flexShrink:   0,
                      letterSpacing: "0.02em",
                      transition:   "all 0.13s ease",
                      display:      "flex",
                      alignItems:   "center",
                      gap:          4,
                    }}
                  >
                    <span style={{ fontSize: 9 }}>⚡</span>
                    Enable Style lock?
                  </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* ── Character Consistency — fades in when face detected ── */}
            <div
              style={{
                maxHeight:     showCharacterControls ? 38 : 0,
                opacity:       showCharacterControls ? 1 : 0,
                overflow:      "hidden",
                transition:    "opacity 0.22s ease, max-height 0.22s ease",
                pointerEvents: showCharacterControls ? "auto" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
                {/* Lock toggle pill */}
                <Tooltip content="Preserve the character's face identity across all generations">
                <button
                  className="rd-char-toggle"
                  onClick={() => setCharacterLock((prev) => !prev)}
                  style={{
                    height:       26,
                    padding:      "0 10px",
                    borderRadius: 20,
                    border:       characterLock
                      ? "1px solid rgba(245,158,11,0.62)"
                      : "1px solid rgba(255,255,255,0.1)",
                    background:   characterLock
                      ? "rgba(245,158,11,0.13)"
                      : "rgba(255,255,255,0.04)",
                    color:        characterLock
                      ? "rgba(252,211,77,0.95)"
                      : "rgba(140,155,185,0.72)",
                    fontSize:     11,
                    fontWeight:   700,
                    cursor:       "pointer",
                    display:      "flex", alignItems: "center", gap: 5,
                    transition:   "all 0.15s ease",
                    whiteSpace:   "nowrap",
                    flexShrink:   0,
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{characterLock ? "◉" : "○"}</span>
                  Lock Character Identity
                </button>
                </Tooltip>

                {/* Consistency strength — only when locked */}
                {characterLock && (["low", "medium", "high"] as const).map((s) => {
                  const isActive = consistencyStrength === s;
                  return (
                    <button
                      key={s}
                      className="rd-char-strength"
                      onClick={() => setConsistencyStrength(s)}
                      style={{
                        height:       24,
                        padding:      "0 8px",
                        borderRadius: 6,
                        border:       isActive
                          ? "1px solid rgba(245,158,11,0.52)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background:   isActive
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(255,255,255,0.03)",
                        color:        isActive
                          ? "rgba(252,211,77,0.9)"
                          : "rgba(120,140,180,0.5)",
                        fontSize:     10,
                        fontWeight:   700,
                        cursor:       "pointer",
                        textTransform: "capitalize",
                        transition:   "all 0.15s ease",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}

                {/* Auto-suggest hint when face detected but lock is off */}
                {showCharacterHint && (
                  <span style={{
                    fontSize:      10,
                    color:         "rgba(252,211,77,0.52)",
                    fontWeight:    600,
                    letterSpacing: "0.01em",
                    whiteSpace:    "nowrap",
                  }}>
                    Face detected — enable to preserve identity
                  </span>
                )}
              </div>
            </div>

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
            <Tooltip content="Clear prompt">
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
            >×</button>
            </Tooltip>
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

          {/* Credit estimate — amber, larger, with tooltip */}
          <Tooltip content="Estimated total cost for current settings">
          <div
            style={{
              fontSize:      16,
              fontWeight:    700,
              color:         "#fece01",
              textShadow:    "0 0 8px rgba(254,206,1,0.25)",
              flexShrink:    0,
              whiteSpace:    "nowrap",
              paddingLeft:   2,
              letterSpacing: "-0.02em",
              cursor:        "default",
            }}
          >
            ~{creditEstimate} cr
          </div>
          </Tooltip>

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

          {/* ── 6. Context CTA — Zencra signature trigger button ── */}
          <button
            className="rd-gen"
            onClick={handleGenerate}
            disabled={ctaMode === "select-concept"}
            style={{
              height:         50,
              minWidth:       ctaMode === "select-concept" ? 168 : 162,
              padding:        "0 24px",
              borderRadius:   12,
              marginLeft:     12,
              border:         ctaMode === "select-concept"
                ? `1px solid ${Z.borderSubtle}`
                : "1px solid rgba(255,255,255,0.18)",
              background:     ctaMode === "select-concept"
                ? Z.bgInput
                : "linear-gradient(135deg, #3FA9F5 0%, #6C5CE7 100%)",
              color:          ctaMode === "select-concept" ? Z.textMuted : "#ffffff",
              cursor:         ctaMode === "select-concept" ? "default" : "pointer",
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "stretch",
              justifyContent: "center",
              flexShrink:     0,
              boxShadow:      ctaMode === "select-concept"
                ? "none"
                : "0 0 10px rgba(86,140,255,0.25), 0 4px 18px rgba(0,0,0,0.5)",
              transition:     "all 0.18s ease",
            }}
          >
            {/* ── Disabled: select-concept ── */}
            {ctaMode === "select-concept" && (
              <span style={{ fontSize: 14, fontWeight: 600, textAlign: "center", letterSpacing: "0.01em" }}>
                Select a Concept
              </span>
            )}

            {/* ── Loading state ── */}
            {ctaMode !== "select-concept" && (isGenerating || isGeneratingConcepts) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ animation: "rdSpin 0.8s linear infinite", display: "inline-block", fontSize: 16, lineHeight: 1 }}>⟳</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {isGeneratingConcepts ? "Generating Concepts…" : "Generating…"}
                </span>
              </div>
            )}

            {/* ── Active: stacked two-line layout ── */}
            {ctaMode !== "select-concept" && !isGenerating && !isGeneratingConcepts && (
              <>
                {/* Row 1: primary verb + icon + credit */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {ctaMode === "generate-concepts" ? "Generate"
                      : isVariationMode           ? "Generate"
                      : "Render"}
                  </span>
                  <Zap size={11} strokeWidth={2.5} style={{ color: "#fece01", flexShrink: 0 }} />
                  <span style={{
                    fontSize:      12,
                    fontWeight:    500,
                    color:         "rgba(255,255,255,0.62)",
                    letterSpacing: "0em",
                    lineHeight:    1,
                    flexShrink:    0,
                  }}>
                    {ctaMode === "generate-concepts" ? "1 cr" : `${creditEstimate} cr`}
                  </span>
                </div>
                {/* Row 2: context noun */}
                <div style={{ lineHeight: 1, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.78, letterSpacing: "0.005em" }}>
                    {ctaMode === "generate-concepts" ? "Concepts"
                      : isVariationMode           ? "Variation"
                      : "Concept"}
                  </span>
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
