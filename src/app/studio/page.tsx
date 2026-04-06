"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA STUDIO — Unified AI Creation Workspace
// Inspired by LTX Studio Gen Space, simplified for Phase 1
// Phase 2: Cinema Studio (LTX scene cards + timeline)
// ─────────────────────────────────────────────────────────────────────────────

type Mode = "image" | "video" | "audio";
type GenState = "idle" | "loading" | "done" | "error";
type AspectRatio = "21:9" | "16:9" | "3:2" | "4:3" | "1:1" | "9:16" | "2:3" | "3:4" | "4:5";

// ── Models ────────────────────────────────────────────────────────────────────
const IMAGE_MODELS = [
  { id: "nano-banana-pro", label: "Nano Banana Pro", sub: "Studio-grade · Gemini 3 by Google", badge: null, disabled: false },
  { id: "nano-banana-2", label: "Nano Banana 2", sub: "High-quality, fast & cost-effective", badge: "NEW", disabled: false },
  { id: "flux-pro", label: "FLUX.2 Pro", sub: "Enhanced realism by Black Forest Labs", badge: null, disabled: false },
  { id: "z-image", label: "Z-Image", sub: "Fast, high-quality visuals by Alibaba", badge: null, disabled: false },
];

const VIDEO_MODELS = [
  { id: "kling-2.6-pro", label: "Kling 2.6 Pro", sub: "Realistic cinematic video & audio", badge: null, disabled: false },
  { id: "seedance", label: "Seedance 1.0 Pro", sub: "High-quality motion, by ByteDance", badge: "NEW", disabled: false },
  { id: "veo-2", label: "Veo 2", sub: "Google's video model", badge: null, disabled: false },
  { id: "ltx-2.3-pro", label: "LTX-2.3 Pro", sub: "Cinema Studio · Director mode", badge: "SOON", disabled: true },
  { id: "kling-3.0-pro", label: "Kling 3.0 Pro", sub: "Advanced cinematic generations", badge: "SOON", disabled: true },
];

const VOICE_OPTIONS = [
  { id: "aria", label: "Aria", sub: "Warm, professional female" },
  { id: "nova", label: "Nova", sub: "Clear, energetic female" },
  { id: "echo", label: "Echo", sub: "Deep, cinematic male" },
  { id: "onyx", label: "Onyx", sub: "Authoritative, rich male" },
];

// ── Aspect Ratios ─────────────────────────────────────────────────────────────
const ASPECT_RATIOS: { label: AspectRatio; wRatio: number; hRatio: number }[] = [
  { label: "21:9", wRatio: 21, hRatio: 9 },
  { label: "16:9", wRatio: 16, hRatio: 9 },
  { label: "3:2", wRatio: 3, hRatio: 2 },
  { label: "4:3", wRatio: 4, hRatio: 3 },
  { label: "1:1", wRatio: 1, hRatio: 1 },
  { label: "9:16", wRatio: 9, hRatio: 16 },
  { label: "2:3", wRatio: 2, hRatio: 3 },
  { label: "3:4", wRatio: 3, hRatio: 4 },
  { label: "4:5", wRatio: 4, hRatio: 5 },
];

// ── Presets ───────────────────────────────────────────────────────────────────
const IMAGE_PRESETS = [
  {
    id: 1,
    label: "Golden Portrait",
    prompt: "Cinematic close-up of a woman bathed in golden hour light, sharp focus, photorealistic, 8K detail",
    gradient: "linear-gradient(160deg, #7c3aed 0%, #db2777 60%, #f97316 100%)",
    accent: "#db2777",
  },
  {
    id: 2,
    label: "Neon City",
    prompt: "Futuristic cityscape at night with neon reflections on rain-soaked streets, cinematic, wide angle",
    gradient: "linear-gradient(160deg, #0f172a 0%, #1d4ed8 50%, #0ea5e9 100%)",
    accent: "#1d4ed8",
  },
  {
    id: 3,
    label: "Liquid Metal",
    prompt: "Abstract flowing liquid chrome in iridescent colors, macro photography, hyper-realistic 3D render",
    gradient: "linear-gradient(160deg, #134e4a 0%, #0ea5a0 60%, #38bdf8 100%)",
    accent: "#0ea5a0",
  },
];

const VIDEO_PRESETS = [
  {
    id: 1,
    label: "Drone Ascent",
    prompt: "Cinematic drone shot rising above misty mountain peaks at golden hour, smooth motion, epic scale",
    gradient: "linear-gradient(160deg, #0c1445 0%, #1d4ed8 60%, #38bdf8 100%)",
    accent: "#1d4ed8",
  },
  {
    id: 2,
    label: "Morning Coffee",
    prompt: "Close-up of hands wrapping around a warm coffee cup in soft morning light, steam rising, slow motion",
    gradient: "linear-gradient(160deg, #1a0533 0%, #7c3aed 60%, #c084fc 100%)",
    accent: "#7c3aed",
  },
  {
    id: 3,
    label: "Storm & Sea",
    prompt: "Timelapse of storm clouds forming over ocean cliffs at dusk, dramatic lighting, cinematic grade",
    gradient: "linear-gradient(160deg, #1c1917 0%, #92400e 50%, #d97706 100%)",
    accent: "#d97706",
  },
];

const AUDIO_PRESETS = [
  {
    id: 1,
    label: "Product Launch",
    prompt: "Warm, professional voiceover for a premium tech product launch. Confident, clear, inspiring.",
    gradient: "linear-gradient(160deg, #14532d 0%, #16a34a 60%, #4ade80 100%)",
    accent: "#16a34a",
  },
  {
    id: 2,
    label: "Movie Trailer",
    prompt: "Dramatic, deep narration for a cinematic movie trailer. Epic, slow, powerful delivery.",
    gradient: "linear-gradient(160deg, #1e1b4b 0%, #6366f1 60%, #a78bfa 100%)",
    accent: "#6366f1",
  },
  {
    id: 3,
    label: "Creator Intro",
    prompt: "Energetic, friendly host voice for a YouTube channel intro. Upbeat, relatable, professional.",
    gradient: "linear-gradient(160deg, #7f1d1d 0%, #dc2626 60%, #f87171 100%)",
    accent: "#dc2626",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconImage({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconVideo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function IconAudio({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconChevron({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
    </svg>
  );
}

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconRefresh({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconLock({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconCamera({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconAdd({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlay({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

// ── Dropdown wrapper ───────────────────────────────────────────────────────────
function Dropdown({
  open,
  children,
  align = "left",
}: {
  open: boolean;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  if (!open) return null;
  const alignStyle =
    align === "right" ? { right: 0 } : align === "center" ? { left: "50%", transform: "translateX(-50%)" } : { left: 0 };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        ...alignStyle,
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "8px",
        zIndex: 200,
        minWidth: 200,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
}

// ── AspectRatioIcon ────────────────────────────────────────────────────────────
function AspectBox({ w, h, selected }: { w: number; h: number; selected: boolean }) {
  const maxW = 28;
  const maxH = 28;
  const scale = Math.min(maxW / w, maxH / h);
  const bw = Math.round(w * scale);
  const bh = Math.round(h * scale);

  return (
    <div
      style={{
        width: bw,
        height: bh,
        border: `1.5px solid ${selected ? "#2563EB" : "rgba(255,255,255,0.5)"}`,
        borderRadius: 3,
        background: selected ? "rgba(37,99,235,0.15)" : "transparent",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER COMPONENT (wrapped in Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────
function StudioInner() {
  const searchParams = useSearchParams();
  const initialMode = ((searchParams.get("mode") as Mode) || "video") as Mode;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [prompt, setPrompt] = useState("");
  const [genState, setGenState] = useState<GenState>("idle");

  // Image settings
  const [imageModel, setImageModel] = useState("nano-banana-pro");
  const [imageResolution, setImageResolution] = useState("2K");
  const [imageAspectRatio, setImageAspectRatio] = useState<AspectRatio>("16:9");
  const [imageVariations, setImageVariations] = useState(1);

  // Video settings
  const [videoModel, setVideoModel] = useState("kling-2.6-pro");
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoResolution, setVideoResolution] = useState("1080p");
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatio>("16:9");

  // Audio settings
  const [audioVoice, setAudioVoice] = useState("aria");

  // Mode dropdown (Image ▾ at bottom-left of prompt)
  const [showModePicker, setShowModePicker] = useState(false);
  // Control bar dropdowns
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAspectPicker, setShowAspectPicker] = useState(false);
  const [showResolutionPicker, setShowResolutionPicker] = useState(false);
  const [showVariationsPicker, setShowVariationsPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showAspectPickerVideo, setShowAspectPickerVideo] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [editingName, setEditingName] = useState(false);

  const presets = mode === "image" ? IMAGE_PRESETS : mode === "video" ? VIDEO_PRESETS : AUDIO_PRESETS;
  const currentImageModel = IMAGE_MODELS.find((m) => m.id === imageModel);
  const currentVideoModel = VIDEO_MODELS.find((m) => m.id === videoModel);
  const currentVoice = VOICE_OPTIONS.find((v) => v.id === audioVoice);

  function handlePreset(p: (typeof presets)[0]) {
    setPrompt(p.prompt);
    promptRef.current?.focus();
  }

  async function handleGenerate() {
    if (!prompt.trim() || genState === "loading") return;
    setGenState("loading");
    // Phase 1: Simulate generation (swap with real API in Phase 2)
    await new Promise((r) => setTimeout(r, 3000));
    setGenState("done");
  }

  function handleReset() {
    setGenState("idle");
    setPrompt("");
  }

  // Close all dropdowns on outside click
  const closeAll = useCallback(() => {
    setShowModePicker(false);
    setShowModelPicker(false);
    setShowAspectPicker(false);
    setShowResolutionPicker(false);
    setShowVariationsPicker(false);
    setShowDurationPicker(false);
    setShowAspectPickerVideo(false);
    setShowVoicePicker(false);
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest("[data-dd]")) closeAll();
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [closeAll]);

  // Auto-resize textarea
  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const modeLabel = mode === "image" ? "Image" : mode === "video" ? "Video" : "Audio";
  const ModeIcon = mode === "image" ? IconImage : mode === "video" ? IconVideo : IconAudio;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const pill = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s ease",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#F8FAFC" : "rgba(255,255,255,0.45)",
  });

  const ctrlBtn = (active?: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
    color: active ? "#F8FAFC" : "rgba(255,255,255,0.7)",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap" as const,
    position: "relative" as const,
  });

  const ddItem = (selected?: boolean, disabled?: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    background: selected ? "rgba(37,99,235,0.15)" : "transparent",
    opacity: disabled ? 0.45 : 1,
    transition: "background 0.1s ease",
  });

  const inputBlock = (): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: 86,
    height: 72,
    borderRadius: 10,
    border: "1.5px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: 500,
    textAlign: "center" as const,
    letterSpacing: "0.02em",
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#080E1C",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
        overflowY: "auto",
      }}
    >
      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <nav
        style={{
          height: 52,
          minHeight: 52,
          background: "rgba(8,14,28,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          <Logo size="sm" asLink={false} />
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

        {/* Project name */}
        {editingName ? (
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(37,99,235,0.5)",
              borderRadius: 6,
              color: "#F8FAFC",
              fontSize: 13,
              fontWeight: 500,
              padding: "3px 8px",
              outline: "none",
              minWidth: 120,
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              padding: "3px 6px",
              borderRadius: 6,
              transition: "all 0.15s",
            }}
            title="Click to rename"
          >
            {projectName}
          </button>
        )}

        {/* Center Tabs */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
          {[
            { label: "Studio", active: true, locked: false },
            { label: "Canvas", active: false, locked: true },
            { label: "Storyboard", active: false, locked: true },
            { label: "Editor", active: false, locked: true },
          ].map((tab) => (
            <button
              key={tab.label}
              disabled={tab.locked}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: tab.active ? 600 : 400,
                border: "none",
                cursor: tab.locked ? "not-allowed" : "pointer",
                background: tab.active ? "rgba(37,99,235,0.2)" : "transparent",
                color: tab.active ? "#60A5FA" : "rgba(255,255,255,0.3)",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
              {tab.locked && (
                <span style={{ opacity: 0.6 }}>
                  <IconLock size={10} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              color: "#fff",
              letterSpacing: "0.01em",
            }}
          >
            ⚡ Upgrade
          </button>
          {/* Avatar */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Z
          </div>
        </div>
      </nav>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 24px 60px",
          gap: 0,
        }}
      >
        {/* Mode selector pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: "4px",
            marginBottom: 36,
          }}
        >
          {(["image", "video", "audio"] as Mode[]).map((m) => {
            const Icon = m === "image" ? IconImage : m === "video" ? IconVideo : IconAudio;
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setGenState("idle"); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 18px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                  background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isActive ? "#F8FAFC" : "rgba(255,255,255,0.4)",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={14} />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Preset showcase */}
        {genState === "idle" && (
          <div style={{ width: "100%", maxWidth: 760, marginBottom: 40 }}>
            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
                marginBottom: 16,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Start with a preset
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePreset(preset)}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: preset.gradient,
                    height: 130,
                    position: "relative",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "12px",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px ${preset.accent}40`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  {/* Gradient overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)",
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#fff",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PROMPT BOX ─────────────────────────────────────────────────── */}
        <div style={{ width: "100%", maxWidth: 760 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              overflow: "visible",
              transition: "border-color 0.2s ease",
            }}
            onFocus={() => {}}
          >
            {/* Input blocks */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px 0",
              }}
            >
              {mode === "video" ? (
                <>
                  <div style={inputBlock()}>
                    <IconAdd size={16} />
                    <span>ADD START<br />FRAME</span>
                  </div>
                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <div style={inputBlock()}>
                    <IconAdd size={16} />
                    <span>ADD END<br />FRAME</span>
                  </div>
                  <div style={inputBlock()}>
                    <IconCamera size={16} />
                    <span>CAMERA<br />MOTION</span>
                  </div>
                </>
              ) : mode === "image" ? (
                <>
                  <div style={inputBlock()}>
                    <IconAdd size={16} />
                    <span>ADD IMAGE<br />REFERENCE</span>
                  </div>
                  <div style={inputBlock()}>
                    <IconSparkle size={16} />
                    <span>ADD<br />ELEMENT</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={inputBlock()}>
                    <IconAudio size={16} />
                    <span>UPLOAD<br />SCRIPT</span>
                  </div>
                  <div style={inputBlock()}>
                    <IconAdd size={16} />
                    <span>ADD<br />REFERENCE</span>
                  </div>
                </>
              )}
            </div>

            {/* Prompt textarea */}
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={handlePromptChange}
              placeholder={
                mode === "image"
                  ? "Describe the image you want to create..."
                  : mode === "video"
                  ? "Describe your cinematic scene..."
                  : "Describe the voice, tone, and content..."
              }
              rows={3}
              style={{
                display: "block",
                width: "100%",
                padding: "16px",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: "#F8FAFC",
                fontSize: 15,
                lineHeight: 1.6,
                fontFamily: "var(--font-body, system-ui)",
                minHeight: 80,
                boxSizing: "border-box",
              }}
            />

            {/* ── CONTROL BAR ─────────────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                flexWrap: "wrap",
              }}
            >
              {/* Mode Picker (left anchor) */}
              <div data-dd style={{ position: "relative" }}>
                <button
                  onClick={() => { closeAll(); setShowModePicker((v) => !v); }}
                  style={{ ...ctrlBtn(showModePicker), background: "rgba(255,255,255,0.08)" }}
                >
                  <ModeIcon size={13} />
                  {modeLabel}
                  <IconChevron size={10} />
                </button>
                <Dropdown open={showModePicker} align="left">
                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>MODE</p>
                  {[
                    { id: "image" as Mode, label: "Generate Images", Icon: IconImage },
                    { id: "video" as Mode, label: "Generate Videos", Icon: IconVideo },
                    { id: "audio" as Mode, label: "AI Voiceover", Icon: IconAudio },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setMode(id); setGenState("idle"); closeAll(); }}
                      style={{ ...ddItem(mode === id), width: "100%", textAlign: "left" }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.6)" }}>
                        <Icon size={14} />
                      </span>
                      <span style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 500 }}>{label}</span>
                      {mode === id && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                    </button>
                  ))}
                </Dropdown>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)" }} />

              {/* ── IMAGE CONTROLS ── */}
              {mode === "image" && (
                <>
                  {/* Model */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowModelPicker((v) => !v); }} style={ctrlBtn(showModelPicker)}>
                      <IconSparkle size={11} />
                      {currentImageModel?.label}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showModelPicker} align="left">
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>IMAGE MODEL</p>
                      {IMAGE_MODELS.map((m) => (
                        <button key={m.id} onClick={() => { setImageModel(m.id); closeAll(); }} style={{ ...ddItem(imageModel === m.id), width: "100%", textAlign: "left" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 500 }}>{m.label}</span>
                              {m.badge && (
                                <span style={{ fontSize: 9, fontWeight: 700, background: "#2563EB", color: "#fff", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.05em" }}>
                                  {m.badge}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{m.sub}</div>
                          </div>
                          {imageModel === m.id && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>

                  {/* Resolution */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowResolutionPicker((v) => !v); }} style={ctrlBtn(showResolutionPicker)}>
                      🖥 {imageResolution}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showResolutionPicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>IMAGE RESOLUTION</p>
                      {["1K", "2K", "4K"].map((r) => (
                        <button key={r} onClick={() => { setImageResolution(r); closeAll(); }} style={{ ...ddItem(imageResolution === r), width: "100%", textAlign: "left" }}>
                          <span style={{ fontSize: 13, color: "#F8FAFC" }}>🖥 {r}</span>
                          {imageResolution === r && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>

                  {/* Aspect Ratio */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowAspectPicker((v) => !v); }} style={ctrlBtn(showAspectPicker)}>
                      ▭ {imageAspectRatio}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showAspectPicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 12px" }}>ASPECT RATIO</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 4px 4px" }}>
                        {ASPECT_RATIOS.map((ar) => (
                          <button
                            key={ar.label}
                            onClick={() => { setImageAspectRatio(ar.label); closeAll(); }}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 8, cursor: "pointer", border: "none", background: imageAspectRatio === ar.label ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)", transition: "background 0.1s" }}
                          >
                            <AspectBox w={ar.wRatio} h={ar.hRatio} selected={imageAspectRatio === ar.label} />
                            <span style={{ fontSize: 10, color: imageAspectRatio === ar.label ? "#60A5FA" : "rgba(255,255,255,0.5)", fontWeight: 500 }}>{ar.label}</span>
                          </button>
                        ))}
                      </div>
                    </Dropdown>
                  </div>

                  {/* Variations */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowVariationsPicker((v) => !v); }} style={ctrlBtn(showVariationsPicker)}>
                      ⊞ {imageVariations}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showVariationsPicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>VARIATIONS</p>
                      {[1, 3, 6, 9, 12].map((n) => (
                        <button key={n} onClick={() => { setImageVariations(n); closeAll(); }} style={{ ...ddItem(imageVariations === n), width: "100%", textAlign: "left" }}>
                          <span style={{ fontSize: 13, color: "#F8FAFC" }}>{n}</span>
                          {imageVariations === n && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>
                </>
              )}

              {/* ── VIDEO CONTROLS ── */}
              {mode === "video" && (
                <>
                  {/* Model */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowModelPicker((v) => !v); }} style={ctrlBtn(showModelPicker)}>
                      <IconSparkle size={11} />
                      {currentVideoModel?.label}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showModelPicker} align="left">
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>VIDEO MODEL</p>
                      {VIDEO_MODELS.map((m) => (
                        <button
                          key={m.id}
                          disabled={m.disabled}
                          onClick={() => { if (!m.disabled) { setVideoModel(m.id); closeAll(); } }}
                          style={{ ...ddItem(videoModel === m.id, m.disabled), width: "100%", textAlign: "left" }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 500 }}>{m.label}</span>
                              {m.badge && (
                                <span style={{ fontSize: 9, fontWeight: 700, background: m.badge === "SOON" ? "#374151" : "#2563EB", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>
                                  {m.badge}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{m.sub}</div>
                          </div>
                          {videoModel === m.id && !m.disabled && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>

                  {/* Duration */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowDurationPicker((v) => !v); }} style={ctrlBtn(showDurationPicker)}>
                      ⏱ {videoDuration}s
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showDurationPicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>VIDEO DURATION</p>
                      {[5, 10].map((d) => (
                        <button key={d} onClick={() => { setVideoDuration(d); closeAll(); }} style={{ ...ddItem(videoDuration === d), width: "100%", textAlign: "left" }}>
                          <span style={{ fontSize: 13, color: "#F8FAFC" }}>{d} Sec</span>
                          {videoDuration === d && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>

                  {/* Resolution */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowResolutionPicker((v) => !v); }} style={ctrlBtn(showResolutionPicker)}>
                      🖥 {videoResolution}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showResolutionPicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>VIDEO RESOLUTION</p>
                      {[
                        { label: "1080p", locked: false },
                        { label: "1440p", locked: false },
                        { label: "4K ⚡", locked: true },
                      ].map(({ label, locked }) => (
                        <button
                          key={label}
                          disabled={locked}
                          onClick={() => { if (!locked) { setVideoResolution(label); closeAll(); } }}
                          style={{ ...ddItem(videoResolution === label, locked), width: "100%", textAlign: "left" }}
                        >
                          <span style={{ fontSize: 13, color: "#F8FAFC" }}>{label}</span>
                          {locked && <span style={{ marginLeft: "auto", opacity: 0.5 }}><IconLock size={11} /></span>}
                          {videoResolution === label && !locked && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>

                  {/* Aspect Ratio */}
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowAspectPickerVideo((v) => !v); }} style={ctrlBtn(showAspectPickerVideo)}>
                      ▭ {videoAspectRatio}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showAspectPickerVideo}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 12px" }}>ASPECT RATIO</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 4px 4px" }}>
                        {ASPECT_RATIOS.filter((ar) => ["16:9", "9:16", "1:1", "4:3"].includes(ar.label)).map((ar) => (
                          <button
                            key={ar.label}
                            onClick={() => { setVideoAspectRatio(ar.label); closeAll(); }}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 8, cursor: "pointer", border: "none", background: videoAspectRatio === ar.label ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)", transition: "background 0.1s" }}
                          >
                            <AspectBox w={ar.wRatio} h={ar.hRatio} selected={videoAspectRatio === ar.label} />
                            <span style={{ fontSize: 10, color: videoAspectRatio === ar.label ? "#60A5FA" : "rgba(255,255,255,0.5)", fontWeight: 500 }}>{ar.label}</span>
                          </button>
                        ))}
                      </div>
                    </Dropdown>
                  </div>
                </>
              )}

              {/* ── AUDIO CONTROLS ── */}
              {mode === "audio" && (
                <>
                  <div data-dd style={{ position: "relative" }}>
                    <button onClick={() => { closeAll(); setShowVoicePicker((v) => !v); }} style={ctrlBtn(showVoicePicker)}>
                      <IconAudio size={11} />
                      {currentVoice?.label}
                      <IconChevron size={10} />
                    </button>
                    <Dropdown open={showVoicePicker}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 8px" }}>VOICE</p>
                      {VOICE_OPTIONS.map((v) => (
                        <button key={v.id} onClick={() => { setAudioVoice(v.id); closeAll(); }} style={{ ...ddItem(audioVoice === v.id), width: "100%", textAlign: "left" }}>
                          <div>
                            <div style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 500 }}>{v.label}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{v.sub}</div>
                          </div>
                          {audioVoice === v.id && <span style={{ marginLeft: "auto", color: "#60A5FA", fontSize: 11 }}>✓</span>}
                        </button>
                      ))}
                    </Dropdown>
                  </div>
                </>
              )}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || genState === "loading"}
                style={{
                  padding: "8px 22px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor: !prompt.trim() || genState === "loading" ? "not-allowed" : "pointer",
                  background:
                    !prompt.trim() || genState === "loading"
                      ? "rgba(255,255,255,0.1)"
                      : "linear-gradient(135deg, #2563EB, #7C3AED)",
                  color: !prompt.trim() || genState === "loading" ? "rgba(255,255,255,0.35)" : "#fff",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.01em",
                }}
              >
                {genState === "loading" ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>

          {/* ── LOADING STATE ─────────────────────────────────────────────── */}
          {genState === "loading" && (
            <div
              style={{
                marginTop: 24,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "48px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Spinner */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.08)",
                  borderTop: "3px solid #2563EB",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 500 }}>
                {mode === "image"
                  ? "Generating your image…"
                  : mode === "video"
                  ? "Rendering your cinematic scene…"
                  : "Synthesizing voice…"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>This usually takes 10–30 seconds</p>
            </div>
          )}

          {/* ── OUTPUT PANEL ──────────────────────────────────────────────── */}
          {genState === "done" && (
            <div
              style={{
                marginTop: 24,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Output header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {mode === "image" ? "Generated Image" : mode === "video" ? "Generated Video" : "Generated Audio"}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleReset}
                    style={{ ...ctrlBtn(), gap: 5 }}
                  >
                    <IconRefresh size={12} />
                    New
                  </button>
                  <button style={{ ...ctrlBtn(), gap: 5, background: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.3)", color: "#60A5FA" }}>
                    <IconDownload size={12} />
                    Download
                  </button>
                </div>
              </div>

              {/* Output preview */}
              {mode === "image" && (
                <div
                  style={{
                    aspectRatio: imageAspectRatio.replace(":", "/"),
                    maxHeight: 420,
                    background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #2d1b69 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Decorative elements */}
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(124,58,237,0.3) 0%, transparent 60%)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 60%, rgba(37,99,235,0.2) 0%, transparent 60%)" }} />
                  <div style={{ position: "relative", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                      🖼 Image ready — connect API to display
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                      {currentImageModel?.label} · {imageResolution} · {imageAspectRatio}
                    </div>
                  </div>
                </div>
              )}

              {mode === "video" && (
                <div
                  style={{
                    aspectRatio: videoAspectRatio.replace(":", "/"),
                    maxHeight: 380,
                    background: "linear-gradient(160deg, #0c1445 0%, #1e3a8a 40%, #1d4ed8 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(37,99,235,0.2) 0%, transparent 70%)" }} />
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <IconPlay size={22} />
                  </div>
                  <div style={{ position: "absolute", bottom: 16, left: 16, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {currentVideoModel?.label} · {videoDuration}s · {videoResolution} · {videoAspectRatio}
                  </div>
                </div>
              )}

              {mode === "audio" && (
                <div
                  style={{
                    padding: "32px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  {/* Waveform visualization (decorative) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 3, height: 48 }}>
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 3,
                          height: Math.random() * 36 + 6,
                          borderRadius: 2,
                          background: `rgba(37,99,235,${0.4 + Math.random() * 0.5})`,
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    Voice: {currentVoice?.label} — connect ElevenLabs API to play
                  </p>
                </div>
              )}

              {/* Action strip */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  flexWrap: "wrap",
                }}
              >
                <button style={ctrlBtn()}>
                  <IconRefresh size={12} />
                  Regenerate
                </button>
                {mode === "video" && (
                  <>
                    <button style={ctrlBtn()}>⏱ Extend</button>
                    <button style={ctrlBtn()}>🎙 Add Voice</button>
                  </>
                )}
                {mode === "image" && (
                  <>
                    <button style={ctrlBtn()}>✨ Upscale</button>
                    <button style={ctrlBtn()}>▶ Animate</button>
                  </>
                )}
                {mode === "audio" && (
                  <button style={ctrlBtn()}>🎬 Sync to Video</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Future Cinema Studio hint */}
        {genState === "idle" && (
          <div
            style={{
              marginTop: 48,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 24,
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
            }}
          >
            <span style={{ fontSize: 12, color: "rgba(167,139,250,0.8)" }}>🎬</span>
            <span style={{ fontSize: 12, color: "rgba(167,139,250,0.8)", fontWeight: 500 }}>Cinema Studio</span>
            <span style={{ fontSize: 11, color: "rgba(124,58,237,0.6)" }}>— Scene cards, timeline & director mode · Coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT (wrapped in Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────
export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#080E1C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.06)",
              borderTop: "3px solid #2563EB",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      }
    >
      <StudioInner />
    </Suspense>
  );
}
