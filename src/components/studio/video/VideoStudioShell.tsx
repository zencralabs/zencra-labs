"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudioShell — Master layout + state + generation logic
// Design system: #020617 base · #1A1A1A canvas · per-model pill colors
// Cinema focus mode: canvas glow intensifies on active mode
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  VIDEO_MODEL_REGISTRY,
  type VideoModel,
  type CameraPreset,
} from "@/lib/ai/video-model-registry";
import type { FrameMode, VideoAR, Quality, ImageSlot, AudioSlot, GeneratedVideo } from "./types";
import { EMPTY_SLOT, EMPTY_AUDIO } from "./types";
import { supabase }            from "@/lib/supabase";
import { useLipSync }          from "@/hooks/useLipSync";
import type { LipSyncQuality } from "@/lib/lipsync/status";
import { useAuth }             from "@/components/auth/AuthContext";
import { AuthModal }           from "@/components/auth/AuthModal";
import VideoLeftRail       from "./VideoLeftRail";
import VideoCanvas         from "./VideoCanvas";
import VideoPromptPanel    from "./VideoPromptPanel";
import VideoResultsLibrary from "./VideoResultsLibrary";

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_CREDITS  = 500;
const POLL_INTERVAL = 4000;
const MAX_POLLS     = 60;
const SIDE_GUTTER   = 20;

// ── Per-model accent color ────────────────────────────────────────────────────

function modelAccentColor(m: VideoModel): string {
  if (m.badgeColor) return m.badgeColor;
  if (m.provider === "kling") return "#0EA5A0";
  return "#0EA5A0";
}

// ── Credit estimate ───────────────────────────────────────────────────────────

const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30": { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26": { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25": { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(id: string, q: string, d: number) {
  return CREDIT_RATES[id]?.[q]?.[d] ?? Math.round(d * 5);
}

// ── Tool pill bar ─────────────────────────────────────────────────────────────

function ToolPillBar({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 6,
      overflowX: "auto", scrollbarWidth: "none",
      paddingBottom: 18,
      paddingLeft: SIDE_GUTTER,
      paddingRight: SIDE_GUTTER,
    }}>
      {VIDEO_MODEL_REGISTRY.map(m => {
        const active = m.id === selectedId;
        const accent = modelAccentColor(m);
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              flexShrink: 0,
              padding: "9px 18px",
              borderRadius: 10,
              border: active
                ? `1px solid ${accent}99`
                : "1px solid rgba(255,255,255,0.08)",
              background: active
                ? `${accent}22`
                : "rgba(255,255,255,0.03)",
              color: active ? "#F8FAFC" : "#CBD5F5",
              fontSize: 14, fontWeight: active ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: active ? `0 0 15px ${accent}44` : "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#F8FAFC";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#CBD5F5";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }
            }}
          >
            {m.displayName}
            {m.badge && (() => {
              // Badge color system
              const isSoon   = m.badge === "SOON";
              const isHot    = m.badge === "HOT";
              const bgColor  = isSoon ? "rgba(245,158,11,0.15)"
                             : isHot  ? `${accent}22`
                             : `${accent}22`;
              const bdColor  = isSoon ? "#F59E0B"
                             : isHot  ? accent
                             : accent;
              const txColor  = isSoon ? "#FCD34D"
                             : isHot  ? accent
                             : accent;
              return (
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  padding: "2px 6px", borderRadius: 4,
                  letterSpacing: "0.07em",
                  background: bgColor,
                  color: txColor,
                  border: `1px solid ${bdColor}`,
                }}>
                  {m.badge}
                </span>
              );
            })()}
          </button>
        );
      })}
    </div>
  );
}

// ── Coming soon screen ────────────────────────────────────────────────────────

function ComingSoonScreen({ model }: { model: VideoModel }) {
  const accent = modelAccentColor(model);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", width: "100%", aspectRatio: "16 / 9",
      gap: 18, textAlign: "center", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "#1A1A1A",
      boxShadow: [
        "0 0 0 1px rgba(255,255,255,0.06)",
        `0 0 40px ${accent}2E`,
        "0 16px 64px rgba(0,0,0,0.8)",
      ].join(", "),
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        border: `1px solid ${accent}33`,
        background: `${accent}11`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC", marginBottom: 8 }}>
          {model.displayName}
        </div>
        <div style={{ fontSize: 15, color: "#94A3B8", maxWidth: 320, lineHeight: 1.65 }}>
          {model.description}
        </div>
      </div>
      {model.badge && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "4px 14px",
          borderRadius: 20, letterSpacing: "0.06em",
          background: "rgba(245,158,11,0.15)",
          color: "#FCD34D",
          border: "1px solid #F59E0B",
        }}>
          {model.badge}
        </span>
      )}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ modelName }: { modelName: string }) {
  const crumbStyle: React.CSSProperties = {
    fontSize: 13, color: "#64748B", textDecoration: "none", transition: "color 0.15s",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      paddingBottom: 14, paddingLeft: SIDE_GUTTER,
    }}>
      <a href="/studio" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
      >Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <a href="/studio/video" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
      >Video Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>{modelName}</span>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function VideoStudioShell() {
  const searchParams = useSearchParams();
  const { user }     = useAuth();

  const defaultModelId = VIDEO_MODEL_REGISTRY.find(m => m.available)?.id ?? VIDEO_MODEL_REGISTRY[0].id;
  const [selectedModelId, setSelectedModelId] = useState(searchParams.get("model") ?? defaultModelId);
  const model = VIDEO_MODEL_REGISTRY.find(m => m.id === selectedModelId) ?? null;

  // Auth gate — opened when non-member tries to generate/download
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Controls
  const [frameMode,      setFrameMode]      = useState<FrameMode>("text_to_video");
  const [aspectRatio,    setAspectRatio]    = useState<VideoAR>("16:9");
  const [quality,        setQuality]        = useState<Quality>("std");
  const [duration,       setDuration]       = useState<number>(5);
  const [cameraPreset,   setCameraPreset]   = useState<CameraPreset | null>(null);
  const [motionStrength, setMotionStrength] = useState(50);
  const [motionArea,     setMotionArea]     = useState("full_body");

  // Canvas slots
  const [startSlot,       setStartSlot]       = useState<ImageSlot>(EMPTY_SLOT);
  const [endSlot,         setEndSlot]         = useState<ImageSlot>(EMPTY_SLOT);
  const [audioSlot,       setAudioSlot]       = useState<AudioSlot>(EMPTY_AUDIO);
  const [motionVideoUrl,  setMotionVideoUrl]  = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string | null>(null);

  // Prompt
  const [prompt,    setPrompt]    = useState("");
  const [negPrompt, setNegPrompt] = useState("");

  // Generation (Kling/video)
  const [generating, setGenerating] = useState(false);
  const [videos,     setVideos]     = useState<GeneratedVideo[]>([]);

  // ── Scroll to top on mount (prevents browser scroll restoration mis-position) ─
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  // ── Auth token for Lip Sync ────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Lip Sync hook ──────────────────────────────────────────────────────────
  const {
    state:          lipSyncState,
    setQualityMode: setLipSyncQuality,
    uploadFace:     lipSyncUploadFace,
    uploadAudio:    lipSyncUploadAudio,
    create:         lipSyncCreate,
    retry:          lipSyncRetry,
    reset:          lipSyncReset,
  } = useLipSync(authToken);

  const handleLipSyncFaceFile = useCallback((file: File, previewUrl: string) => {
    lipSyncUploadFace(file, previewUrl);
  }, [lipSyncUploadFace]);

  const handleLipSyncAudioFile = useCallback((file: File, durationSeconds: number) => {
    lipSyncUploadAudio(file, durationSeconds);
  }, [lipSyncUploadAudio]);

  // Reset mode/duration/AR when switching models
  useEffect(() => {
    if (!model) return;
    const caps = model.capabilities;
    const allowed: Record<FrameMode, boolean> = {
      text_to_video:  caps.textToVideo,
      start_frame:    caps.startFrame,
      start_end:      caps.endFrame,
      extend:         caps.extendVideo,
      lip_sync:       true,
      motion_control: caps.motionControl,
    };
    if (!allowed[frameMode]) setFrameMode("text_to_video");
    if (!caps.durations.includes(duration))       setDuration(caps.durations[0] ?? 5);
    if (!caps.aspectRatios.includes(aspectRatio)) setAspectRatio((caps.aspectRatios[0] ?? "16:9") as VideoAR);
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate — routes to Lip Sync or Kling
  const handleGenerate = useCallback(async () => {
    // Auth gate — non-members see sign-up modal, no API call is made
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (frameMode === "lip_sync") {
      lipSyncCreate(aspectRatio);
      return;
    }

    if (!model || generating) return;
    setGenerating(true);

    const newVideo: GeneratedVideo = {
      id: crypto.randomUUID(),
      url: null, thumbnailUrl: null,
      prompt, negPrompt,
      modelId: model.id, modelName: model.displayName,
      duration, aspectRatio, frameMode,
      status: "generating",
      provider: model.provider,
      creditsUsed: estimateCredits(model.id, quality, duration),
      createdAt: Date.now(),
      isPublic: false,
    };
    setVideos(prev => [newVideo, ...prev]);

    try {
      const body: Record<string, unknown> = {
        prompt, negPrompt, model: model.apiModelId,
        duration, aspectRatio, quality,
        cameraPreset: cameraPreset ?? undefined,
      };
      if (frameMode === "start_frame"    && startSlot.url)  body.startFrameUrl = startSlot.url;
      if (frameMode === "start_end"      && startSlot.url)  body.startFrameUrl = startSlot.url;
      if (frameMode === "start_end"      && endSlot.url)    body.endFrameUrl   = endSlot.url;
      if (frameMode === "motion_control" && motionVideoUrl) body.videoUrl      = motionVideoUrl;
      if (frameMode === "motion_control" && startSlot.url)  body.imageUrl      = startSlot.url;
      if (frameMode === "motion_control") {
        body.motionStrength = motionStrength;
        body.motionArea     = motionArea;
      }

      const res = await fetch(`/api/generate/video/${model.provider}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const { taskId } = await res.json();

      setVideos(prev => prev.map(v =>
        v.id === newVideo.id ? { ...v, status: "polling", taskId } : v,
      ));

      let polls = 0;
      const poll = setInterval(async () => {
        polls++;
        if (polls > MAX_POLLS) {
          clearInterval(poll);
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id ? { ...v, status: "error", error: "Timed out" } : v,
          ));
          setGenerating(false);
          return;
        }
        try {
          const sr = await fetch(`/api/generate/status/${model.provider}/${taskId}`);
          const sd = await sr.json();
          if (sd.status === "done" && sd.url) {
            clearInterval(poll);
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id
                ? { ...v, status: "done", url: sd.url, thumbnailUrl: sd.thumbnailUrl ?? null }
                : v,
            ));
            setGenerating(false);
          } else if (sd.status === "error") {
            clearInterval(poll);
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id ? { ...v, status: "error", error: sd.error } : v,
            ));
            setGenerating(false);
          }
        } catch { /* ignore transient poll errors */ }
      }, POLL_INTERVAL);
    } catch (err) {
      setVideos(prev => prev.map(v =>
        v.id === newVideo.id ? { ...v, status: "error", error: String(err) } : v,
      ));
      setGenerating(false);
    }
  }, [
    user, frameMode, model, generating, prompt, negPrompt, duration, aspectRatio,
    quality, cameraPreset, startSlot, endSlot, motionVideoUrl,
    motionStrength, motionArea, lipSyncCreate,
  ]);

  const handleReusePrompt = useCallback((video: GeneratedVideo) => {
    setPrompt(video.prompt ?? "");
    setNegPrompt(video.negPrompt ?? "");
  }, []);

  const handleDelete = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  }, []);

  // Cinema focus mode — canvas glows more when actively working
  const cinemaModeActive = frameMode !== "text_to_video";

  const effectiveGenerating = frameMode === "lip_sync"
    ? lipSyncState.isGenerating
    : generating;

  const creditEstimate = model ? estimateCredits(model.id, quality, duration) : 0;
  void creditEstimate;

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: [
        "radial-gradient(circle at 20% 30%, rgba(14,165,160,0.12), transparent 40%)",
        "radial-gradient(circle at 80% 70%, rgba(63,169,245,0.10), transparent 40%)",
        "#020617",
      ].join(", "),
      color: "#CBD5F5",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      paddingTop: 80,
      boxSizing: "border-box",
    }}>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <Breadcrumb modelName={model?.displayName ?? "Video Studio"} />

      {/* ── Tool pill bar ──────────────────────────────────────── */}
      <ToolPillBar selectedId={selectedModelId} onSelect={setSelectedModelId} />

      {/* ── 3-column workspace ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr 340px",
        columnGap: 14,
        alignItems: "start",
        width: "100%",
        paddingBottom: 28,
        boxSizing: "border-box",
      }}>

        {/* Left rail */}
        <div style={{
          paddingLeft: SIDE_GUTTER,
          paddingRight: 12,
          paddingTop: 14,
          paddingBottom: 14,
          height: "100%",
          minHeight: 0,
          position: "sticky",
          top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          // Darker surface — control panel feel
          background: "rgba(0,0,0,0.28)",
          borderRadius: 12,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          // Subtle dim when cinema mode active — controls stay usable
          opacity: cinemaModeActive ? 0.88 : 1,
          transition: "opacity 0.35s ease",
          boxSizing: "border-box",
        }}>
          <VideoLeftRail
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            cameraPreset={cameraPreset}
            motionStrength={motionStrength}
            motionArea={motionArea}
            onFrameMode={setFrameMode}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onCameraPreset={setCameraPreset}
            onMotionStrength={setMotionStrength}
            onMotionArea={setMotionArea}
            model={model}
          />
        </div>

        {/* Canvas — fills 1fr, glow intensifies in cinema mode */}
        <div style={{
          minWidth: 0,
          transition: "filter 0.35s ease",
          filter: cinemaModeActive ? "brightness(1.04)" : "brightness(1)",
        }}>
          {model && !model.available ? (
            <ComingSoonScreen model={model} />
          ) : (
            <VideoCanvas
              frameMode={frameMode}
              aspectRatio={aspectRatio}
              generating={effectiveGenerating}
              cinemaModeActive={cinemaModeActive}
              startSlot={startSlot}
              endSlot={endSlot}
              audioSlot={audioSlot}
              motionVideoUrl={motionVideoUrl}
              motionVideoName={motionVideoName}
              onStartSlot={setStartSlot}
              onEndSlot={setEndSlot}
              onAudioSlot={setAudioSlot}
              onMotionVideo={(url, name) => { setMotionVideoUrl(url); setMotionVideoName(name); }}
              onMotionVideoRemove={() => { setMotionVideoUrl(null); setMotionVideoName(null); }}
              onLipSyncFaceFile={handleLipSyncFaceFile}
              onLipSyncAudioFile={handleLipSyncAudioFile}
            />
          )}
        </div>

        {/* Right panel — prompt */}
        <div style={{
          paddingRight: SIDE_GUTTER,
          paddingLeft: 12,
          paddingTop: 14,
          paddingBottom: 14,
          position: "sticky",
          top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.22)",
          borderRadius: 12,
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          boxSizing: "border-box",
        }}>
          <VideoPromptPanel
            model={model}
            prompt={prompt}
            setPrompt={setPrompt}
            negPrompt={negPrompt}
            setNegPrompt={setNegPrompt}
            quality={quality}
            duration={duration}
            generating={generating}
            userCredits={USER_CREDITS}
            frameMode={frameMode}
            lipSyncState={lipSyncState}
            onLipSyncQualityMode={setLipSyncQuality as (m: LipSyncQuality) => void}
            onLipSyncGenerate={handleGenerate}
            onLipSyncRetry={lipSyncRetry}
            onLipSyncReset={lipSyncReset}
            onGenerate={handleGenerate}
          />
        </div>
      </div>

      {/* ── Gallery — full viewport width ──────────────────────── */}
      <div style={{
        width: "100%",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: 28,
        paddingLeft: SIDE_GUTTER,
        paddingRight: SIDE_GUTTER,
        paddingBottom: 48,
        boxSizing: "border-box",
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#475569",
          letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 20,
        }}>
          Your Videos
        </div>
        <VideoResultsLibrary
          videos={videos}
          onReusePrompt={handleReusePrompt}
          onDelete={handleDelete}
        />
      </div>

      {/* ── Auth gate modal — opens when non-member clicks Generate ── */}
      {authModalOpen && (
        <AuthModal
          defaultTab="signup"
          onClose={() => setAuthModalOpen(false)}
        />
      )}

    </div>
  );
}
