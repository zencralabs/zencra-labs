"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudioShell — Master layout + state + generation logic
// Tool switcher: horizontal pill bar in studio header (not left rail)
// Background: premium radial gradient
// Left rail: 220px, controls only
// Canvas: ambient glow
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { VIDEO_MODEL_REGISTRY, getVideoModel, type VideoModel } from "@/lib/ai/video-model-registry";
import VideoLeftRail from "./VideoLeftRail";
import VideoCanvas from "./VideoCanvas";
import VideoPromptPanel from "./VideoPromptPanel";
import VideoResultsLibrary from "./VideoResultsLibrary";
import type { FrameMode, VideoAR, Quality, ImageSlot, GeneratedVideo } from "./types";
import type { CameraPreset } from "@/lib/ai/video-model-registry";

const EMPTY_SLOT: ImageSlot = { url: null, preview: null };

// Credit rate helper
const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30": { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26": { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25": { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(modelId: string, quality: string, duration: number): number {
  return CREDIT_RATES[modelId]?.[quality]?.[duration] ?? Math.round(duration * 5);
}

// ── TOOL PILL BAR ─────────────────────────────────────────────────────────────
// Horizontal scrollable row — tools in display order, no provider headings

const TOOL_ORDER = [
  "kling-30",
  "kling-26",
  "kling-25",
  "seedance-20",
  "runway-gen45",
  "veo-32",
  "sora-2",
];

function ToolPillBar({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const tools = TOOL_ORDER
    .map(id => VIDEO_MODEL_REGISTRY.find(m => m.id === id))
    .filter((m): m is VideoModel => Boolean(m));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: 2, // prevent clipping pill shadow
      }}
    >
      <style>{`
        .tool-pill-bar::-webkit-scrollbar { display: none; }
      `}</style>
      {tools.map(model => {
        const active = model.id === selectedId;
        const soon   = !model.available;
        const color  = model.badgeColor ?? "#0EA5A0";

        return (
          <button
            key={model.id}
            onClick={() => !soon && onSelect(model.id)}
            title={soon ? `${model.displayName} — Coming Soon` : model.displayName}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 999,
              border: active
                ? `1px solid ${color}80`
                : soon
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid rgba(255,255,255,0.09)",
              background: active
                ? `${color}20`
                : "rgba(255,255,255,0.03)",
              color: active
                ? color === "#0EA5A0" ? "#22D3EE" : color
                : soon
                ? "#334155"
                : "#64748B",
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              cursor: soon ? "not-allowed" : "pointer",
              opacity: soon ? 0.55 : 1,
              transition: "all 0.15s",
              flexShrink: 0,
              minHeight: 36,
            }}
            onMouseEnter={e => {
              if (!active && !soon)
                (e.currentTarget as HTMLElement).style.color = "#94A3B8";
            }}
            onMouseLeave={e => {
              if (!active && !soon)
                (e.currentTarget as HTMLElement).style.color = "#64748B";
            }}
          >
            {model.displayName}
            {model.badge && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.07em",
                  color: color,
                  background: `${color}22`,
                  border: `1px solid ${color}44`,
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                {model.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── COMING SOON SCREEN ────────────────────────────────────────────────────────

function ComingSoonScreen({ model }: { model: VideoModel }) {
  const color = model.badgeColor ?? "#64748B";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 48,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: `${color}15`,
          border: `1px solid ${color}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>

      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#E2E8F0", marginBottom: 8, letterSpacing: "-0.02em" }}>
          {model.displayName} — Coming Soon
        </div>
        <div style={{ fontSize: 14, color: "#64748B", maxWidth: 420, lineHeight: 1.7 }}>
          {model.description}
        </div>
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 16, padding: "8px 18px",
            borderRadius: 8,
            background: `${color}12`, border: `1px solid ${color}33`,
            fontSize: 13, color, fontWeight: 600,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Notify me when live
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 440 }}>
        {model.capabilities.nativeAudio && <FeatureChip>Native Audio</FeatureChip>}
        {model.capabilities.audioEnabled && <FeatureChip>Audio Input</FeatureChip>}
        {model.capabilities.videoInput && <FeatureChip>Video Input</FeatureChip>}
        {model.capabilities.avatar && <FeatureChip>AI Avatar</FeatureChip>}
        {model.capabilities.lipSync && <FeatureChip>Lip Sync</FeatureChip>}
        {model.capabilities.maxDuration > 10 && <FeatureChip>Up to {model.capabilities.maxDuration}s</FeatureChip>}
        {model.capabilities.cameraControl && <FeatureChip>Camera Control</FeatureChip>}
      </div>
    </div>
  );
}

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11, color: "#64748B",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "4px 12px",
      }}
    >
      {children}
    </span>
  );
}

// ── MOBILE DRAWER ─────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200, backdropFilter: "blur(2px)",
          }}
        />
      )}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          width: 260,
          background: "#080E1A",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          padding: "80px 16px 24px",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </>
  );
}

// ── SHELL ─────────────────────────────────────────────────────────────────────

export default function VideoStudioShell() {
  const { user, refreshCredits } = useAuth();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model
  const toolParam      = searchParams.get("tool") ?? "kling-30";
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const m = getVideoModel(toolParam);
    return m ? m.id : "kling-30";
  });
  const model = getVideoModel(selectedModelId) ?? null;

  // Generation settings
  const [frameMode,    setFrameMode]    = useState<FrameMode>("text_to_video");
  const [aspectRatio,  setAspectRatio]  = useState<VideoAR>("16:9");
  const [quality,      setQuality]      = useState<Quality>("std");
  const [duration,     setDuration]     = useState<number>(5);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);

  // Prompt
  const [prompt,    setPrompt]    = useState("");
  const [negPrompt, setNegPrompt] = useState("");

  // Image slots
  const [startSlot,    setStartSlot]    = useState<ImageSlot>(EMPTY_SLOT);
  const [endSlot,      setEndSlot]      = useState<ImageSlot>(EMPTY_SLOT);
  const [pendingSlot,  setPendingSlot]  = useState<"start" | "end">("start");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [videos,     setVideos]     = useState<GeneratedVideo[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // UI
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [zoom,            setZoom]           = useState(1);

  const userCredits    = user?.credits ?? 0;
  const creditEstimate = model ? estimateCredits(model.id, quality, duration) : 0;
  const isComingSoon   = model ? !model.available : false;

  // ── Sync capabilities on model change ──────────────────────────────────────
  useEffect(() => {
    if (!model) return;
    const caps = model.capabilities;

    const modeAllowed: Record<FrameMode, boolean> = {
      text_to_video: caps.textToVideo,
      start_frame:   caps.startFrame,
      start_end:     caps.endFrame,
      extend:        caps.extendVideo,
      lip_sync:      caps.lipSync,
    };
    if (!modeAllowed[frameMode]) setFrameMode("text_to_video");
    if (!caps.durations.includes(duration)) setDuration(caps.durations[0] ?? 5);
    if (!caps.aspectRatios.includes(aspectRatio)) setAspectRatio((caps.aspectRatios[0] as VideoAR) ?? "16:9");
    if (quality === "pro" && !caps.proMode) setQuality("std");
    if (cameraPreset && !caps.cameraPresets.includes(cameraPreset)) setCameraPreset(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // Cleanup polling
  useEffect(() => () => { if (pollingRef.current) clearTimeout(pollingRef.current); }, []);

  // ── Upload ──────────────────────────────────────────────────────────────────
  function uploadFile(file: File, slot: "start" | "end") {
    const preview = URL.createObjectURL(file);
    (slot === "start" ? setStartSlot : setEndSlot)({ url: null, preview, name: file.name });
  }

  function handleOpenUpload() {
    setPendingSlot("start");
    fileInputRef.current?.click();
  }

  // ── Sample prompt ───────────────────────────────────────────────────────────
  function handleSamplePrompt() {
    const chips = model?.promptChips;
    if (chips?.length) {
      setPrompt(`A cinematic ${chips.slice(0, 3).join(", ")} shot, dramatic lighting, ultra realistic`);
    } else {
      setPrompt("A cinematic aerial shot over misty mountains at golden hour, slow motion, ultra realistic");
    }
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!model || !prompt.trim() || generating || !model.available) return;
    if (userCredits < creditEstimate) return;

    setGenerating(true);
    const videoId = `vid_${Date.now()}`;

    const placeholder: GeneratedVideo = {
      id: videoId, url: null, thumbnailUrl: null,
      prompt: prompt.trim(), negPrompt: negPrompt.trim(),
      modelId: model.id, modelName: model.displayName,
      duration, aspectRatio, frameMode,
      status: "generating", taskId: undefined,
      provider: model.provider, creditsUsed: creditEstimate,
      createdAt: Date.now(), isPublic: false,
    };
    setVideos(prev => [placeholder, ...prev]);

    try {
      const body: Record<string, unknown> = {
        modelId: model.apiModelId,
        prompt: prompt.trim(),
        negativePrompt: negPrompt.trim() || undefined,
        duration, aspectRatio, mode: quality, frameMode,
        cameraPreset: cameraPreset ?? undefined,
      };
      if (frameMode === "start_frame" && startSlot.url) body.startImageUrl = startSlot.url;
      if (frameMode === "start_end"   && startSlot.url) body.startImageUrl = startSlot.url;
      if (frameMode === "start_end"   && endSlot.url)   body.endImageUrl   = endSlot.url;

      const res  = await fetch("/api/generate/video/kling", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.accessToken ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: "error", error: data.error ?? "Generation failed" } : v));
        setGenerating(false);
        return;
      }

      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, taskId: data.taskId, status: "polling" } : v));
      startPolling(videoId, data.taskId, model.provider);
    } catch (err) {
      console.error("[generate]", err);
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: "error", error: "Network error" } : v));
      setGenerating(false);
    }
  }

  // ── Poll ────────────────────────────────────────────────────────────────────
  function startPolling(videoId: string, taskId: string, provider: string) {
    let count = 0;
    const MAX = 60;
    function poll() {
      pollingRef.current = setTimeout(async () => {
        count++;
        try {
          const res  = await fetch(`/api/generate/status/${provider}/${taskId}`, {
            headers: { Authorization: `Bearer ${user?.accessToken ?? ""}` },
          });
          const data = await res.json();

          if (data.status === "done" && data.videoUrl) {
            setVideos(prev => prev.map(v => v.id === videoId
              ? { ...v, url: data.videoUrl, thumbnailUrl: data.thumbnailUrl ?? null, status: "done" }
              : v));
            setGenerating(false);
            await refreshCredits();
            return;
          }
          if (data.status === "error") {
            setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: "error", error: data.error ?? "Failed" } : v));
            setGenerating(false);
            return;
          }
          if (count >= MAX) {
            setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: "error", error: "Timed out" } : v));
            setGenerating(false);
            return;
          }
          poll();
        } catch {
          if (count < MAX) poll();
          else {
            setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: "error", error: "Poll error" } : v));
            setGenerating(false);
          }
        }
      }, 4000);
    }
    poll();
  }

  // ── Video actions ───────────────────────────────────────────────────────────
  function handleDelete(id: string) { setVideos(prev => prev.filter(v => v.id !== id)); }
  function handleReusePrompt(video: GeneratedVideo) {
    setPrompt(video.prompt);
    setNegPrompt(video.negPrompt ?? "");
  }
  function handleExtend(video: GeneratedVideo) {
    setSelectedModelId(video.modelId);
    setFrameMode("extend");
    setPrompt(`Extend: ${video.prompt}`);
  }
  function handleTogglePublic(id: string) {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, isPublic: !v.isPublic } : v));
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 64px)",
        marginTop: 64,
        // Premium radial gradient background
        background: `
          radial-gradient(ellipse at 25% 15%, rgba(14,165,160,0.12) 0%, transparent 55%),
          radial-gradient(ellipse at 75% 85%, rgba(99,102,241,0.12) 0%, transparent 55%),
          #020617
        `,
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file, pendingSlot);
          e.target.value = "";
        }}
      />

      {/* ── STUDIO HEADER ────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 64,
          zIndex: 50,
        }}
      >
        {/* Top row: title + credits */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 20px 0",
            gap: 12,
          }}
        >
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileRailOpen(true)}
            className="mobile-menu-btn"
            style={{
              width: 34, height: 34,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#64748B",
              cursor: "pointer",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Studio title */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: "rgba(14,165,160,0.12)",
                border: "1px solid rgba(14,165,160,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>Video Studio</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Credits */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: "rgba(14,165,160,0.07)",
              border: "1px solid rgba(14,165,160,0.15)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#22D3EE" }}>{userCredits}</span>
            <span style={{ fontSize: 11, color: "#475569" }}>credits</span>
          </div>
        </div>

        {/* Tool pill bar — horizontal scroll row */}
        <div
          style={{
            padding: "12px 20px 14px",
          }}
        >
          <ToolPillBar selectedId={selectedModelId} onSelect={setSelectedModelId} />
        </div>
      </div>

      {/* ── MAIN 3-COL LAYOUT ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left Rail — desktop */}
        <div
          className="desktop-rail"
          style={{
            width: 220,
            flexShrink: 0,
            padding: "18px 14px",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(2,6,23,0.5)",
            backdropFilter: "blur(8px)",
            overflowY: "auto",
          }}
        >
          <VideoLeftRail
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            cameraPreset={cameraPreset}
            onFrameMode={setFrameMode}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onCameraPreset={setCameraPreset}
            model={model}
            userCredits={userCredits}
            creditEstimate={creditEstimate}
          />
        </div>

        {/* Mobile drawer */}
        <MobileDrawer open={mobileRailOpen} onClose={() => setMobileRailOpen(false)}>
          <VideoLeftRail
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            cameraPreset={cameraPreset}
            onFrameMode={m => { setFrameMode(m); setMobileRailOpen(false); }}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onCameraPreset={setCameraPreset}
            model={model}
            userCredits={userCredits}
            creditEstimate={creditEstimate}
          />
        </MobileDrawer>

        {/* Center + Right */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
          {isComingSoon && model ? (
            <ComingSoonScreen model={model} />
          ) : (
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

              {/* Center: Canvas + Library */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  padding: "20px 16px 20px 20px",
                  gap: 20,
                  minWidth: 0,
                  overflowY: "auto",
                }}
              >
                {/* Canvas with ambient glow */}
                <div
                  style={{
                    borderRadius: 18,
                    boxShadow: "0 0 80px rgba(14,165,160,0.12), inset 0 0 60px rgba(14,165,160,0.04)",
                  }}
                >
                  <VideoCanvas
                    model={model}
                    frameMode={frameMode}
                    startSlot={startSlot}
                    endSlot={endSlot}
                    generating={generating}
                    onStartUpload={file => uploadFile(file, "start")}
                    onEndUpload={file => uploadFile(file, "end")}
                    onSamplePrompt={handleSamplePrompt}
                    onOpenUpload={handleOpenUpload}
                  />
                </div>

                {/* Library */}
                <VideoResultsLibrary
                  videos={videos}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  onDelete={handleDelete}
                  onReusePrompt={handleReusePrompt}
                  onExtend={handleExtend}
                  onTogglePublic={handleTogglePublic}
                />
              </div>

              {/* Right: Prompt panel */}
              <div
                style={{
                  width: 320,
                  flexShrink: 0,
                  padding: "20px 20px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <VideoPromptPanel
                  model={model}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  negPrompt={negPrompt}
                  setNegPrompt={setNegPrompt}
                  quality={quality}
                  duration={duration}
                  generating={generating}
                  userCredits={userCredits}
                  onGenerate={handleGenerate}
                />
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Global styles ─────────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-rail { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 901px) {
          .mobile-menu-btn { display: none !important; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        .tool-pill-bar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
