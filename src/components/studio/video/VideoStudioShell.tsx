"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudioShell — Master 3-column layout + all state + generation logic
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { getVideoModel, getAllModels, type VideoModel } from "@/lib/ai/video-model-registry";
import VideoLeftRail from "./VideoLeftRail";
import VideoCanvas from "./VideoCanvas";
import VideoPromptPanel from "./VideoPromptPanel";
import VideoResultsLibrary from "./VideoResultsLibrary";
import type {
  FrameMode, VideoAR, Quality, ImageSlot,
  GeneratedVideo,
} from "./types";
import type { CameraPreset } from "@/lib/ai/video-model-registry";

const EMPTY: ImageSlot = { url: null, preview: null };

// Credit rate helper (mirrors VideoPromptPanel)
const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30":  { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26":  { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25":  { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(modelId: string, quality: string, duration: number): number {
  return CREDIT_RATES[modelId]?.[quality]?.[duration] ?? Math.round(duration * 5);
}

// ── Coming soon screen ────────────────────────────────────────────────────────

function ComingSoonScreen({ model }: { model: VideoModel }) {
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
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `${model.badgeColor ?? "#64748B"}15`,
          border: `1px solid ${model.badgeColor ?? "#64748B"}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={model.badgeColor ?? "#64748B"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>

      {/* Text */}
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#E2E8F0",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {model.displayName} — Coming Soon
        </div>
        <div style={{ fontSize: 14, color: "#64748B", maxWidth: 400, lineHeight: 1.7 }}>
          {model.description}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            padding: "8px 16px",
            borderRadius: 8,
            background: `${model.badgeColor ?? "#64748B"}12`,
            border: `1px solid ${model.badgeColor ?? "#64748B"}33`,
            fontSize: 13,
            color: model.badgeColor ?? "#64748B",
            fontWeight: 600,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Notify me when live
        </div>
      </div>

      {/* Feature preview chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 440 }}>
        {model.capabilities.nativeAudio && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            Native Audio
          </span>
        )}
        {model.capabilities.audioEnabled && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            Audio Input
          </span>
        )}
        {model.capabilities.videoInput && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            Video Input
          </span>
        )}
        {model.capabilities.avatar && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            AI Avatar
          </span>
        )}
        {model.capabilities.lipSync && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            Lip Sync
          </span>
        )}
        {model.capabilities.maxDuration > 10 && (
          <span style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "4px 12px" }}>
            Up to {model.capabilities.maxDuration}s
          </span>
        )}
      </div>
    </div>
  );
}

// ── Mobile drawer rail ────────────────────────────────────────────────────────

function MobileRailDrawer({
  open,
  onClose,
  children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          width: 280,
          background: "#080E1A",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          padding: "72px 16px 24px",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export default function VideoStudioShell() {
  const { user, refreshCredits } = useAuth();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Model state ─────────────────────────────────────────────────────────────
  const toolParam = searchParams.get("tool") ?? "kling-30";
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const m = getVideoModel(toolParam);
    return m ? m.id : "kling-30";
  });
  const model = getVideoModel(selectedModelId) ?? null;

  // ── Generation settings ─────────────────────────────────────────────────────
  const [frameMode, setFrameMode] = useState<FrameMode>("text_to_video");
  const [aspectRatio, setAspectRatio] = useState<VideoAR>("16:9");
  const [quality, setQuality] = useState<Quality>("std");
  const [duration, setDuration] = useState<number>(5);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");

  // ── Image slots ─────────────────────────────────────────────────────────────
  const [startSlot, setStartSlot] = useState<ImageSlot>(EMPTY);
  const [endSlot, setEndSlot] = useState<ImageSlot>(EMPTY);
  const [pendingSlot, setPendingSlot] = useState<"start" | "end">("start");

  // ── Generation state ────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const userCredits = user?.credits ?? 0;
  const creditEstimate = model
    ? estimateCredits(model.id, quality, duration)
    : 0;

  // ── Sync model capabilities → reset invalid settings ───────────────────────
  useEffect(() => {
    if (!model) return;
    const caps = model.capabilities;

    // Reset frame mode if not supported
    const modeMap: Record<FrameMode, boolean> = {
      text_to_video: caps.textToVideo,
      start_frame: caps.startFrame,
      start_end: caps.endFrame,
      extend: caps.extendVideo,
      lip_sync: caps.lipSync,
    };
    if (!modeMap[frameMode]) {
      setFrameMode("text_to_video");
    }

    // Reset duration if not in available list
    if (!caps.durations.includes(duration)) {
      setDuration(caps.durations[0] ?? 5);
    }

    // Reset AR if not supported
    if (!caps.aspectRatios.includes(aspectRatio)) {
      setAspectRatio((caps.aspectRatios[0] as VideoAR) ?? "16:9");
    }

    // Reset quality if pro not supported
    if (quality === "pro" && !caps.proMode) {
      setQuality("std");
    }

    // Reset camera preset
    if (cameraPreset && !caps.cameraPresets.includes(cameraPreset)) {
      setCameraPreset(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // ── Image upload helpers ────────────────────────────────────────────────────
  function uploadFile(file: File, slot: "start" | "end") {
    const preview = URL.createObjectURL(file);
    const setter = slot === "start" ? setStartSlot : setEndSlot;
    setter({ url: null, preview, name: file.name });
    // TODO: upload to Supabase storage and set .url
  }

  function handleOpenUpload() {
    setPendingSlot("start");
    fileInputRef.current?.click();
  }

  // ── Sample prompt ───────────────────────────────────────────────────────────
  function handleSamplePrompt() {
    const chips = model?.promptChips;
    if (chips && chips.length > 0) {
      const sample = chips.slice(0, 3).join(", ");
      setPrompt(`A cinematic ${sample} shot, dramatic lighting, ultra realistic`);
    } else {
      setPrompt("A cinematic aerial shot over misty mountains at golden hour, slow motion, ultra realistic");
    }
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!model || !prompt.trim() || generating) return;
    if (!model.available) return;
    if (userCredits < creditEstimate) return;

    setGenerating(true);

    const videoId = `vid_${Date.now()}`;
    const placeholder: GeneratedVideo = {
      id: videoId,
      url: null,
      thumbnailUrl: null,
      prompt: prompt.trim(),
      negPrompt: negPrompt.trim(),
      modelId: model.id,
      modelName: model.displayName,
      duration,
      aspectRatio,
      frameMode,
      status: "generating",
      taskId: undefined,
      provider: model.provider,
      creditsUsed: creditEstimate,
      createdAt: Date.now(),
      isPublic: false,
    };

    setVideos(prev => [placeholder, ...prev]);

    try {
      const body: Record<string, unknown> = {
        modelId: model.apiModelId,
        prompt: prompt.trim(),
        negativePrompt: negPrompt.trim() || undefined,
        duration,
        aspectRatio,
        mode: quality,
        frameMode,
        cameraPreset: cameraPreset ?? undefined,
      };

      if (frameMode === "start_frame" && startSlot.url) body.startImageUrl = startSlot.url;
      if (frameMode === "start_end" && startSlot.url) body.startImageUrl = startSlot.url;
      if (frameMode === "start_end" && endSlot.url) body.endImageUrl = endSlot.url;

      const res = await fetch("/api/generate/video/kling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.accessToken ?? ""}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setVideos(prev =>
          prev.map(v =>
            v.id === videoId ? { ...v, status: "error", error: data.error ?? "Generation failed" } : v
          )
        );
        setGenerating(false);
        return;
      }

      // Update with taskId and start polling
      setVideos(prev =>
        prev.map(v =>
          v.id === videoId ? { ...v, taskId: data.taskId, status: "polling" } : v
        )
      );

      startPolling(videoId, data.taskId, model.provider);

    } catch (err) {
      console.error("[generate]", err);
      setVideos(prev =>
        prev.map(v =>
          v.id === videoId ? { ...v, status: "error", error: "Network error" } : v
        )
      );
      setGenerating(false);
    }
  }

  // ── Poll for result ─────────────────────────────────────────────────────────
  function startPolling(videoId: string, taskId: string, provider: string) {
    const POLL_INTERVAL = 4000;
    const MAX_POLLS = 60; // 4min max
    let count = 0;

    function poll() {
      pollingRef.current = setTimeout(async () => {
        count++;
        try {
          const res = await fetch(`/api/generate/status/${provider}/${taskId}`, {
            headers: { Authorization: `Bearer ${user?.accessToken ?? ""}` },
          });
          const data = await res.json();

          if (data.status === "done" && data.videoUrl) {
            setVideos(prev =>
              prev.map(v =>
                v.id === videoId
                  ? { ...v, url: data.videoUrl, thumbnailUrl: data.thumbnailUrl ?? null, status: "done" }
                  : v
              )
            );
            setGenerating(false);
            await refreshCredits();
            return;
          }

          if (data.status === "error") {
            setVideos(prev =>
              prev.map(v =>
                v.id === videoId ? { ...v, status: "error", error: data.error ?? "Generation failed" } : v
              )
            );
            setGenerating(false);
            return;
          }

          if (count >= MAX_POLLS) {
            setVideos(prev =>
              prev.map(v =>
                v.id === videoId ? { ...v, status: "error", error: "Generation timed out" } : v
              )
            );
            setGenerating(false);
            return;
          }

          poll(); // continue
        } catch (err) {
          console.error("[poll]", err);
          if (count < MAX_POLLS) poll();
          else {
            setVideos(prev =>
              prev.map(v =>
                v.id === videoId ? { ...v, status: "error", error: "Poll error" } : v
              )
            );
            setGenerating(false);
          }
        }
      }, POLL_INTERVAL);
    }

    poll();
  }

  // ── Cleanup polling on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  // ── Video actions ───────────────────────────────────────────────────────────
  function handleDeleteVideo(id: string) {
    setVideos(prev => prev.filter(v => v.id !== id));
  }

  function handleReusePrompt(video: GeneratedVideo) {
    setPrompt(video.prompt);
    setNegPrompt(video.negPrompt ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleExtendVideo(video: GeneratedVideo) {
    setSelectedModelId(video.modelId);
    setFrameMode("extend");
    setPrompt(`Extend: ${video.prompt}`);
  }

  function handleTogglePublic(id: string) {
    setVideos(prev =>
      prev.map(v => v.id === id ? { ...v, isPublic: !v.isPublic } : v)
    );
  }

  // ── Coming soon screen ──────────────────────────────────────────────────────
  const isComingSoon = model ? !model.available : false;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 64px)",
        marginTop: 64,
        background: "#060B14",
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

      {/* ── Studio header bar ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(6,11,20,0.95)",
          gap: 12,
          position: "sticky",
          top: 64,
          zIndex: 50,
        }}
      >
        {/* Mobile menu button */}
        <button
          className="mobile-only"
          onClick={() => setMobileRailOpen(true)}
          style={{
            display: "none",
            width: 36, height: 36,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#64748B",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(14,165,160,0.12)",
              border: "1px solid rgba(14,165,160,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", lineHeight: 1.2 }}>
              Video Studio
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              {model?.displayName ?? "Select a model"}
              {model?.badge && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    fontWeight: 800,
                    color: model.badgeColor ?? "#0EA5A0",
                    background: `${model.badgeColor ?? "#0EA5A0"}22`,
                    border: `1px solid ${model.badgeColor ?? "#0EA5A0"}44`,
                    borderRadius: 3,
                    padding: "1px 4px",
                    letterSpacing: "0.07em",
                  }}
                >
                  {model.badge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Credits badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(14,165,160,0.06)",
            border: "1px solid rgba(14,165,160,0.15)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0EA5A0" }}>{userCredits}</span>
          <span style={{ fontSize: 11, color: "#475569" }}>credits</span>
        </div>
      </div>

      {/* ── Main 3-col layout ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* ── Left Rail (desktop) ───────────────────────────────────────── */}
        <div
          className="desktop-rail"
          style={{
            width: 248,
            flexShrink: 0,
            padding: "20px 16px",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.008)",
            overflowY: "auto",
          }}
        >
          <VideoLeftRail
            selectedModelId={selectedModelId}
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            cameraPreset={cameraPreset}
            onModelSelect={id => setSelectedModelId(id)}
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

        {/* ── Mobile drawer ─────────────────────────────────────────────── */}
        <MobileRailDrawer open={mobileRailOpen} onClose={() => setMobileRailOpen(false)}>
          <VideoLeftRail
            selectedModelId={selectedModelId}
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            cameraPreset={cameraPreset}
            onModelSelect={id => { setSelectedModelId(id); setMobileRailOpen(false); }}
            onFrameMode={setFrameMode}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onCameraPreset={setCameraPreset}
            model={model}
            userCredits={userCredits}
            creditEstimate={creditEstimate}
          />
        </MobileRailDrawer>

        {/* ── Center + Right columns ────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>

          {isComingSoon && model ? (
            <ComingSoonScreen model={model} />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                gap: 0,
                padding: 0,
              }}
            >
              {/* ── Center: Canvas + Library ─────────────────────────── */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  padding: 20,
                  minWidth: 0,
                }}
              >
                {/* Canvas */}
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

                {/* Library */}
                <div style={{ marginTop: 20 }}>
                  <VideoResultsLibrary
                    videos={videos}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    onDelete={handleDeleteVideo}
                    onReusePrompt={handleReusePrompt}
                    onExtend={handleExtendVideo}
                    onTogglePublic={handleTogglePublic}
                  />
                </div>
              </div>

              {/* ── Right: Prompt panel ──────────────────────────────── */}
              <div
                style={{
                  width: 320,
                  flexShrink: 0,
                  padding: "20px 20px 20px 0",
                  display: "flex",
                  flexDirection: "column",
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

      {/* ── Global styles ──────────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-rail { display: none !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 901px) {
          .mobile-only { display: none !important; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>
    </div>
  );
}
