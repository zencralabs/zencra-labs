"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA STUDIO — Video Generation
// Inspired by Higgsfield video generation workspace
// Phase 1: Kling 2.5 / 2.6 / 3.0 + Seedance 2.0 (API coming soon)
// ─────────────────────────────────────────────────────────────────────────────

type SidebarTab = "create" | "edit" | "motion";
type ViewMode = "list" | "grid";
type HistoryTab = "history" | "howto";
type VideoStatus = "generating" | "done" | "error" | "queued";

interface GeneratedVideo {
  id: string;
  prompt: string;
  model: string;
  modelLabel: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  audioEnabled: boolean;
  status: VideoStatus;
  thumbnailGradient: string;
  createdAt: Date;
}

// ── Video Models ──────────────────────────────────────────────────────────────
const VIDEO_MODELS = [
  // Phase 1 — active (API coming)
  {
    id: "seedance-2.0", name: "Seedance 2.0", provider: "ByteDance",
    desc: "Most advanced video model", badge: "TOP", badgeBg: "#16a34a",
    available: true, icon: "seedance",
  },
  {
    id: "kling-3.0", name: "Kling 3.0", provider: "Kling AI",
    desc: "Cinematic videos with audio", badge: null, badgeBg: null,
    available: true, icon: "kling",
  },
  {
    id: "kling-2.6", name: "Kling 2.6", provider: "Kling AI",
    desc: "Cinematic videos with audio", badge: null, badgeBg: null,
    available: true, icon: "kling",
  },
  {
    id: "kling-2.5", name: "Kling 2.5", provider: "Kling AI",
    desc: "High-quality motion", badge: null, badgeBg: null,
    available: true, icon: "kling",
  },
  // Coming soon
  {
    id: "veo-3.1", name: "Google Veo 3.1", provider: "Google",
    desc: "Advanced AI video with sound", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "google",
  },
  {
    id: "sora-2", name: "Sora 2", provider: "OpenAI",
    desc: "OpenAI's most advanced video model", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "openai",
  },
  {
    id: "runway-gen4", name: "Runway Gen-4", provider: "Runway",
    desc: "Professional cinematic generation", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "runway",
  },
  {
    id: "luma", name: "Luma Dream Machine", provider: "Luma AI",
    desc: "Hyper-realistic video generation", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "luma",
  },
  {
    id: "wan-2.6", name: "Wan 2.6", provider: "Alibaba",
    desc: "Multi-shot cinematic storytelling", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "wan",
  },
  {
    id: "minimax-hailuo", name: "Minimax Hailuo 02", provider: "Minimax",
    desc: "Fastest high-dynamic video", badge: "SOON", badgeBg: "#374151",
    available: false, icon: "minimax",
  },
] as const;

type ModelId = typeof VIDEO_MODELS[number]["id"];

// ── Thumbnail gradients (cinematic) ───────────────────────────────────────────
const GRADIENTS = [
  "linear-gradient(160deg, #0c1445 0%, #1d4ed8 50%, #0891b2 100%)",
  "linear-gradient(160deg, #1a0533 0%, #7c3aed 60%, #db2777 100%)",
  "linear-gradient(160deg, #1c1917 0%, #92400e 40%, #d97706 100%)",
  "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  "linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
  "linear-gradient(160deg, #14532d 0%, #065f46 50%, #0d9488 100%)",
];

// ── Icons ─────────────────────────────────────────────────────────────────────
function PlayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ModelAvatar({ icon, size = 28 }: { icon: string; size?: number }) {
  const configs: Record<string, { bg: string; letter: string }> = {
    seedance: { bg: "#1d4ed8", letter: "S" },
    kling: { bg: "#6d28d9", letter: "K" },
    google: { bg: "#1a73e8", letter: "G" },
    openai: { bg: "#10a37f", letter: "O" },
    runway: { bg: "#e11d48", letter: "R" },
    luma: { bg: "#f59e0b", letter: "L" },
    wan: { bg: "#0891b2", letter: "W" },
    minimax: { bg: "#7c3aed", letter: "M" },
  };
  const c = configs[icon] ?? { bg: "#374151", letter: "?" };
  return (
    <div style={{
      width: size, height: size, borderRadius: size > 24 ? 8 : "50%",
      background: c.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {c.letter}
    </div>
  );
}

// ── Video thumbnail card ──────────────────────────────────────────────────────
function VideoCard({
  video,
  viewMode,
  onSelect,
  selected,
}: {
  video: GeneratedVideo;
  viewMode: ViewMode;
  onSelect: (v: GeneratedVideo) => void;
  selected: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const model = VIDEO_MODELS.find((m) => m.id === video.model);

  if (viewMode === "list") {
    return (
      <div
        style={{
          display: "flex", gap: 24, padding: "20px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
        }}
        onClick={() => onSelect(video)}
      >
        {/* Thumbnail */}
        <div style={{
          width: 220, minWidth: 220, height: 124, borderRadius: 10, overflow: "hidden",
          background: video.thumbnailGradient, position: "relative", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {video.status === "generating" || video.status === "queued" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTop: "2px solid rgba(255,255,255,0.7)", animation: "spin 0.9s linear infinite" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Generating…</span>
            </div>
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <PlayIcon size={18} />
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {model && (
              <span style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)",
                background: "rgba(255,255,255,0.07)", padding: "3px 10px", borderRadius: 20,
              }}>
                <ModelAvatar icon={model.icon} size={14} />
                {model.name}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {video.prompt}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { icon: "👁", label: video.resolution },
              { icon: "⏱", label: `${video.duration}s` },
              { icon: "▭", label: video.aspectRatio },
              video.audioEnabled ? { icon: "🔊", label: "Audio" } : null,
            ].filter(Boolean).map((item, i) => (
              <span key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
                {item!.icon} {item!.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Grid card
  return (
    <div
      style={{
        borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative",
        background: video.thumbnailGradient, animation: "fadeIn 0.3s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(video)}
    >
      {/* Aspect ratio box */}
      <div style={{ paddingBottom: video.aspectRatio === "9:16" ? "177.7%" : video.aspectRatio === "1:1" ? "100%" : "56.25%", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {video.status === "generating" || video.status === "queued" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(255,255,255,0.6)", animation: "spin 0.9s linear infinite" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Generating…</span>
            </div>
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transition: "transform 0.2s", transform: hovered ? "scale(1.1)" : "scale(1)" }}>
              <PlayIcon size={18} />
            </div>
          )}
        </div>

        {/* Hover overlay */}
        {hovered && video.status === "done" && (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.4) 100%)", animation: "fadeIn 0.15s ease" }}>
            {/* Top left select */}
            <div style={{ position: "absolute", top: 8, left: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: selected ? "none" : "1.5px solid rgba(255,255,255,0.7)", background: selected ? "#2563EB" : "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} />
            </div>
            {/* Top right actions */}
            <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
              {["♡", "↓", "⋯"].map((btn) => (
                <button key={btn} style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {btn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom audio bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{video.audioEnabled ? "🔊" : "🔇"}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>▾</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function VideoStudioInner() {
  const { user } = useAuth();

  // Sidebar
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("create");

  // Create form
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("kling-3.0");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [multiShot, setMultiShot] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Main content
  const [historyTab, setHistoryTab] = useState<HistoryTab>("history");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [zoomLevel, setZoomLevel] = useState(3);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [authModal, setAuthModal] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const currentModel = VIDEO_MODELS.find((m) => m.id === model)!;

  const ZOOM_COLS = [2, 3, 4, 5, 7];
  const gridCols = ZOOM_COLS[zoomLevel - 1];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest("[data-dd]")) setShowModelPicker(false);
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!user) { setAuthModal(true); return; }

    const id = `vid-${Date.now()}`;
    const newVideo: GeneratedVideo = {
      id,
      prompt,
      model,
      modelLabel: currentModel.name,
      duration,
      aspectRatio,
      resolution,
      audioEnabled,
      status: "generating",
      thumbnailGradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      createdAt: new Date(),
    };

    setVideos((prev) => [newVideo, ...prev]);

    // Simulate API delay — replace with real API call in Phase 2
    await new Promise((r) => setTimeout(r, 4000));

    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, status: "done" as VideoStatus } : v
      )
    );
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const sidebarTabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer",
    border: "none", background: "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.35)",
    borderBottom: active ? "2px solid #fff" : "2px solid transparent",
    transition: "all 0.15s",
  });

  const controlChip = (active?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5,
    padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500,
    cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "#0A0A0A", color: "#fff",
      display: "flex", overflow: "hidden",
      fontFamily: "var(--font-body, system-ui, sans-serif)",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        input[type=range]{-webkit-appearance:none;appearance:none;outline:none;border:none;background:transparent}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 0 6px rgba(37,99,235,0.5)}
        input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;border:none}
        .vid-model-row:hover{background:rgba(255,255,255,0.06)!important}
      `}</style>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════════════ */}
      <div style={{
        width: 280, minWidth: 280, maxWidth: 280,
        background: "#111", borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Zencra logo strip */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <defs><linearGradient id="zg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#0EA5A0" /></linearGradient></defs>
              <rect width="36" height="36" rx="8" fill="url(#zg3)" opacity="0.15" />
              <path d="M9 10h18l-14 16h14" stroke="url(#zg3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#2563EB,#0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Zencra Studio</span>
          </Link>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/studio/image" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              ← Image
            </Link>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {([
            { id: "create", label: "Create Video" },
            { id: "edit", label: "Edit Video", locked: true },
            { id: "motion", label: "Motion Control", locked: true },
          ] as { id: SidebarTab; label: string; locked?: boolean }[]).map((tab) => (
            <button
              key={tab.id}
              disabled={tab.locked}
              onClick={() => !tab.locked && setSidebarTab(tab.id)}
              style={{
                ...sidebarTabBtn(sidebarTab === tab.id),
                flex: "none",
                padding: "10px 12px",
                fontSize: 12,
                opacity: tab.locked ? 0.4 : 1,
                cursor: tab.locked ? "not-allowed" : "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sidebar content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>

          {sidebarTab === "create" && (
            <>
              {/* Reference image */}
              <div style={{
                borderRadius: 10, overflow: "hidden", position: "relative",
                background: "linear-gradient(160deg, #0c1445 0%, #1d4ed8 100%)",
                cursor: "pointer", minHeight: 90,
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#86efac", letterSpacing: "0.05em" }}>GENERAL</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{currentModel.name}</div>
                  </div>
                  <button style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                    ✏ Change
                  </button>
                </div>
                <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22, opacity: 0.3 }}>🎬</span>
                </div>
              </div>

              {/* Start / End frame */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Start frame", "End frame"].map((label) => (
                  <div key={label} style={{
                    borderRadius: 10, border: "1.5px dashed rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "12px 8px", textAlign: "center", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "border-color 0.15s",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>🖼</div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>Optional</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Multi-shot toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Multi-shot</span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", padding: "1px 5px", borderRadius: 4, cursor: "help" }}>?</span>
                </div>
                <div
                  onClick={() => setMultiShot((v) => !v)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                    background: multiShot ? "#2563EB" : "rgba(255,255,255,0.12)",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: multiShot ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }} />
                </div>
              </div>

              {/* Prompt */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prompt</p>
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={"Describe your scene in detail. Use @ to reference assets"}
                  rows={5}
                  style={{
                    width: "100%", background: "transparent", border: "none", outline: "none",
                    color: "#fff", fontSize: 13, lineHeight: 1.6, resize: "none",
                    fontFamily: "var(--font-body, system-ui)", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Enhance / Audio / Elements */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={controlChip()}>✨ Enhance on</button>
                <button
                  onClick={() => setAudioEnabled((v) => !v)}
                  style={{ ...controlChip(audioEnabled), color: audioEnabled ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}
                >
                  {audioEnabled ? "🔊" : "🔇"} Audio {audioEnabled ? "on" : "off"}
                </button>
                <button style={controlChip()}>@ Elements</button>
              </div>

              {/* Model selector */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Model</p>
                <div data-dd style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowModelPicker((v) => !v)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ModelAvatar icon={currentModel.icon} size={28} />
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          {currentModel.name}
                          {currentModel.badge && currentModel.badge !== "SOON" && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: currentModel.badgeBg ?? "#374151", color: "#fff" }}>
                              {currentModel.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{currentModel.desc}</div>
                      </div>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>›</span>
                  </button>

                  {showModelPicker && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                      background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12, zIndex: 300, maxHeight: 340, overflowY: "auto",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                    }}>
                      {/* Active models */}
                      <div style={{ padding: "8px 8px 4px" }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px 6px" }}>Phase 1 — Available</p>
                        {VIDEO_MODELS.filter((m) => m.available).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModel(m.id as ModelId); setShowModelPicker(false); }}
                            className="vid-model-row"
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: "none",
                              background: model === m.id ? "rgba(37,99,235,0.15)" : "transparent",
                              textAlign: "left",
                            }}
                          >
                            <ModelAvatar icon={m.icon} size={30} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{m.name}</span>
                                {m.badge && m.badge !== "SOON" && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: m.badgeBg ?? "#374151", color: "#fff" }}>{m.badge}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{m.desc}</div>
                            </div>
                            {model === m.id && <span style={{ color: "#60A5FA" }}>✓</span>}
                          </button>
                        ))}
                      </div>
                      {/* Coming soon */}
                      <div style={{ padding: "4px 8px 8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 8px 6px" }}>Coming soon</p>
                        {VIDEO_MODELS.filter((m) => !m.available).map((m) => (
                          <div
                            key={m.id}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10,
                              padding: "7px 10px", borderRadius: 8, opacity: 0.45,
                            }}
                          >
                            <ModelAvatar icon={m.icon} size={28} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 12, color: "#fff" }}>{m.name}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#374151", color: "#aaa" }}>SOON</span>
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{m.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Duration / AR / Resolution */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {/* Duration */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Duration</p>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 8px", cursor: "pointer", outline: "none",
                    }}
                  >
                    {[5, 8, 10].map((d) => <option key={d} value={d} style={{ background: "#1a1a1a" }}>{d}s</option>)}
                  </select>
                </div>

                {/* Aspect ratio */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Ratio</p>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 8px", cursor: "pointer", outline: "none",
                    }}
                  >
                    {["Auto", "16:9", "9:16", "1:1", "4:3"].map((ar) => <option key={ar} value={ar} style={{ background: "#1a1a1a" }}>{ar}</option>)}
                  </select>
                </div>

                {/* Resolution */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Quality</p>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 8px", cursor: "pointer", outline: "none",
                    }}
                  >
                    {["720p", "1080p"].map((r) => <option key={r} value={r} style={{ background: "#1a1a1a" }}>{r}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {sidebarTab === "edit" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.5, minHeight: 200 }}>
              <span style={{ fontSize: 28 }}>✂️</span>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Edit Video coming soon</p>
            </div>
          )}

          {sidebarTab === "motion" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 4 }}>Motion Control</p>
                <p style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", lineHeight: 1.5 }}>
                  Camera path, speed curves, and motion transfer — coming in Phase 2
                </p>
              </div>
              {["Camera Path", "Speed Curve", "Motion Transfer", "Zoom Control"].map((feature) => (
                <div key={feature} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: 0.5 }}>
                  <span style={{ fontSize: 14 }}>🔒</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{feature}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate button (always visible at bottom) */}
        <div style={{ padding: "14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            style={{
              width: "100%", padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 700,
              border: "none", cursor: !prompt.trim() ? "not-allowed" : "pointer",
              background: !prompt.trim()
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              color: !prompt.trim() ? "rgba(255,255,255,0.25)" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
              boxShadow: !prompt.trim() ? "none" : "0 0 20px rgba(37,99,235,0.3)",
            }}
          >
            Generate
            {prompt.trim() && (
              <span style={{ fontSize: 12, background: "rgba(0,0,0,0.2)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                ✦ {duration === 5 ? "8.75" : duration === 8 ? "14" : "17.5"}
              </span>
            )}
          </button>
          {!user && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 8 }}>
              Login required to generate
            </p>
          )}
        </div>
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          height: 48, minHeight: 48, display: "flex", alignItems: "center",
          padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          gap: 20,
        }}>
          {/* History / How it works */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "history" as HistoryTab, icon: "📁", label: "History" },
              { id: "howto" as HistoryTab, icon: "📖", label: "How it works" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHistoryTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: "pointer", border: "none",
                  background: historyTab === tab.id ? "rgba(255,255,255,0.1)" : "transparent",
                  color: historyTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Zoom slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>⊟</span>
            <div style={{ position: "relative", width: 60, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.12)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(zoomLevel - 1) * 25}%`, borderRadius: 4, background: "#2563EB", transition: "width 0.1s" }} />
              <input
                type="range" min={1} max={5} step={1} value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%", margin: 0 }}
              />
              {/* Dot */}
              <div style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                left: `calc(${(zoomLevel - 1) * 25}% - 7px)`,
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                boxShadow: "0 0 6px rgba(37,99,235,0.5)", transition: "left 0.1s",
                pointerEvents: "none",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>⊞</span>
          </div>

          {/* List / Grid toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 3, gap: 2 }}>
            {[
              { mode: "list" as ViewMode, icon: "≡", label: "List" },
              { mode: "grid" as ViewMode, icon: "⊞", label: "Grid" },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                style={{
                  width: 28, height: 26, borderRadius: 6, border: "none",
                  background: viewMode === mode ? "rgba(255,255,255,0.12)" : "transparent",
                  color: viewMode === mode ? "#fff" : "rgba(255,255,255,0.35)",
                  cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* User */}
          {user ? (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              {user.name?.charAt(0).toUpperCase() ?? "Z"}
            </div>
          ) : (
            <button onClick={() => setAuthModal(true)} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg,#2563EB,#7C3AED)", color: "#fff", border: "none", cursor: "pointer" }}>
              Login
            </button>
          )}
        </div>

        {/* Video content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: videos.length > 0 ? "20px" : 0 }}>
          {historyTab === "howto" ? (
            /* How it works */
            <div style={{ maxWidth: 600, margin: "40px auto", display: "flex", flexDirection: "column", gap: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>How Video Generation Works</h2>
              {[
                { step: "01", title: "Write your prompt", desc: "Describe your scene in detail — include camera movement, lighting, mood, and subject action. The more specific, the better." },
                { step: "02", title: "Choose your model", desc: "Kling 3.0 for cinematic realism. Seedance 2.0 for high-motion scenes. Select duration (5s/8s/10s) and aspect ratio." },
                { step: "03", title: "Add reference frames", desc: "Optionally upload a start frame and end frame to control the visual style and motion path of your video." },
                { step: "04", title: "Generate & iterate", desc: "Your video renders in the queue. Download, extend, or add voice once complete. Build your library over time." },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ display: "flex", gap: 20 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(37,99,235,0.3)", minWidth: 48, fontVariantNumeric: "tabular-nums" }}>{step}</div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{title}</h3>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            /* Empty state */
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: "calc(100vh - 200px)" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎬</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Your videos will appear here</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 340 }}>
                Write a prompt in the sidebar, choose a model and settings, then click Generate.
              </p>
              {/* API notice */}
              <div style={{ marginTop: 8, padding: "10px 18px", borderRadius: 24, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <span style={{ fontSize: 12, color: "rgba(96,165,250,0.8)" }}>⚡ Kling & Seedance APIs coming soon — UI ready for integration</span>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid view */
            <div>
              {/* Group by date */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                  {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 6 }}>
                  {videos.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      viewMode="grid"
                      onSelect={setSelectedVideo}
                      selected={selectedVideo?.id === v.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* List view — large player + right panel */
            <div style={{ display: "flex", gap: 0, height: "100%" }}>
              {/* Video list (left) */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
                {videos.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    viewMode="list"
                    onSelect={setSelectedVideo}
                    selected={selectedVideo?.id === v.id}
                  />
                ))}
              </div>

              {/* Detail panel (right) */}
              {selectedVideo && (
                <div style={{ width: 320, minWidth: 320, borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "20px 16px", overflowY: "auto" }}>
                  {/* Model badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <ModelAvatar icon={VIDEO_MODELS.find((m) => m.id === selectedVideo.model)?.icon ?? "kling"} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{selectedVideo.modelLabel}</span>
                  </div>

                  {/* Prompt */}
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 16 }}>{selectedVideo.prompt}</p>

                  {/* Specs */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {[
                      { icon: "👁", val: selectedVideo.resolution },
                      { icon: "⏱", val: `${selectedVideo.duration}s` },
                      { icon: "▭", val: selectedVideo.aspectRatio },
                      selectedVideo.audioEnabled ? { icon: "🔊", val: "Audio" } : null,
                    ].filter(Boolean).map((s, i) => (
                      <span key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: 20 }}>
                        {s!.icon} {s!.val}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12 }}>
                      ↓ Download
                    </button>
                    <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>
                      ⏱ Extend video
                    </button>
                    <button style={{ width: "100%", padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>
                      🎙 Add voice
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Auth modal */}
      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}
    </div>
  );
}

export default function VideoStudioPage() {
  return (
    <Suspense fallback={
      <div style={{ position: "fixed", inset: 0, background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.06)", borderTop: "3px solid #2563EB", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <VideoStudioInner />
    </Suspense>
  );
}
