"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudioShell — Master layout + state + generation logic
// Full-width: no maxWidth cap. 260px rail | flex canvas | 340px prompt
// Tool pills left-aligned. Gallery always visible, 100vw.
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
import VideoLeftRail       from "./VideoLeftRail";
import VideoCanvas         from "./VideoCanvas";
import VideoPromptPanel    from "./VideoPromptPanel";
import VideoResultsLibrary from "./VideoResultsLibrary";

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_CREDITS    = 500;
const POLL_INTERVAL   = 4000;
const MAX_POLLS       = 60;
const SIDE_GUTTER     = 20; // px — inner gutter from viewport edge

// Lip Sync provider hook — null = Coming Soon.
// Set to "heygen" | "elevenlabs" when a provider is integrated.
const LIP_SYNC_PROVIDER: string | null = null;

// ── Credit estimate ───────────────────────────────────────────────────────────

const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30": { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26": { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25": { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(id: string, q: string, d: number) {
  return CREDIT_RATES[id]?.[q]?.[d] ?? Math.round(d * 5);
}

// ── Tool pill bar — full width, left-aligned ──────────────────────────────────

function ToolPillBar({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div style={{
      display: "flex",
      gap: 6,
      overflowX: "auto",
      scrollbarWidth: "none",
      paddingBottom: 18,
      paddingLeft: SIDE_GUTTER,
      paddingRight: SIDE_GUTTER,
    }}>
      {VIDEO_MODEL_REGISTRY.map(m => {
        const active = m.id === selectedId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              flexShrink: 0,
              padding: "9px 18px",
              borderRadius: 10,
              border: active ? "1px solid rgba(34,211,238,0.5)" : "1px solid rgba(255,255,255,0.09)",
              background: active ? "rgba(14,165,160,0.18)" : "rgba(255,255,255,0.04)",
              color: active ? "#22D3EE" : "#7A90A8",
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: active ? "0 0 18px rgba(14,165,160,0.25)" : "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#B0C0D4";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#7A90A8";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              }
            }}
          >
            {m.displayName}
            {m.badge && (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "1px 5px",
                borderRadius: 4, letterSpacing: "0.06em",
                background: `${m.badgeColor ?? "#64748B"}22`,
                color: m.badgeColor ?? "#64748B",
                border: `1px solid ${m.badgeColor ?? "#64748B"}44`,
              }}>
                {m.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Coming soon screen ────────────────────────────────────────────────────────

function ComingSoonScreen({ model }: { model: VideoModel }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: "100%", aspectRatio: "16 / 9", gap: 18, textAlign: "center",
      borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.015)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5A6F88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#D8E3EE", marginBottom: 8 }}>{model.displayName}</div>
        <div style={{ fontSize: 13, color: "#7A90A8", maxWidth: 320, lineHeight: 1.65 }}>{model.description}</div>
      </div>
      {model.badge && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 20, letterSpacing: "0.06em",
          background: `${model.badgeColor ?? "#64748B"}22`, color: model.badgeColor ?? "#64748B",
          border: `1px solid ${model.badgeColor ?? "#64748B"}44`,
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
    fontSize: 12, color: "#4E6275", textDecoration: "none", transition: "color 0.15s",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 14, paddingLeft: SIDE_GUTTER }}>
      <a href="/studio" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#7A90A8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4E6275"; }}
      >Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="/studio/video" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#7A90A8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4E6275"; }}
      >Video Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      <span style={{ fontSize: 12, color: "#7A90A8", fontWeight: 600 }}>{modelName}</span>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function VideoStudioShell() {
  const searchParams = useSearchParams();

  const defaultModelId = VIDEO_MODEL_REGISTRY.find(m => m.available)?.id ?? VIDEO_MODEL_REGISTRY[0].id;
  const [selectedModelId, setSelectedModelId] = useState(searchParams.get("model") ?? defaultModelId);
  const model = VIDEO_MODEL_REGISTRY.find(m => m.id === selectedModelId) ?? null;

  // Controls
  const [frameMode,      setFrameMode]      = useState<FrameMode>("text_to_video");
  const [aspectRatio,    setAspectRatio]    = useState<VideoAR>("16:9");
  const [quality,        setQuality]        = useState<Quality>("std");
  const [duration,       setDuration]       = useState<number>(5);
  const [cameraPreset,   setCameraPreset]   = useState<CameraPreset | null>(null);
  const [motionStrength, setMotionStrength] = useState(50);
  const [motionArea,     setMotionArea]     = useState("full_body");

  // Canvas slots
  const [startSlot,        setStartSlot]        = useState<ImageSlot>(EMPTY_SLOT);
  const [endSlot,          setEndSlot]          = useState<ImageSlot>(EMPTY_SLOT);
  const [audioSlot,        setAudioSlot]        = useState<AudioSlot>(EMPTY_AUDIO);
  const [motionVideoUrl,   setMotionVideoUrl]   = useState<string | null>(null);
  const [motionVideoName,  setMotionVideoName]  = useState<string | null>(null);

  // Prompt
  const [prompt,    setPrompt]    = useState("");
  const [negPrompt, setNegPrompt] = useState("");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [videos,     setVideos]     = useState<GeneratedVideo[]>([]);

  // Reset mode/duration/AR when switching models
  useEffect(() => {
    if (!model) return;
    const caps = model.capabilities;
    const allowed: Record<FrameMode, boolean> = {
      text_to_video:  caps.textToVideo,
      start_frame:    caps.startFrame,
      start_end:      caps.endFrame,
      extend:         caps.extendVideo,
      lip_sync:       true,             // provider-independent, always reachable
      motion_control: caps.motionControl,
    };
    if (!allowed[frameMode]) setFrameMode("text_to_video");
    if (!caps.durations.includes(duration))          setDuration(caps.durations[0] ?? 5);
    if (!caps.aspectRatios.includes(aspectRatio))    setAspectRatio((caps.aspectRatios[0] ?? "16:9") as VideoAR);
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate
  const handleGenerate = useCallback(async () => {
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
      if (frameMode === "start_frame"    && startSlot.url)    body.startFrameUrl = startSlot.url;
      if (frameMode === "start_end"      && startSlot.url)    body.startFrameUrl = startSlot.url;
      if (frameMode === "start_end"      && endSlot.url)      body.endFrameUrl   = endSlot.url;
      if (frameMode === "lip_sync"       && startSlot.url)    body.imageUrl      = startSlot.url;
      if (frameMode === "lip_sync"       && audioSlot.url)    body.audioUrl      = audioSlot.url;
      if (frameMode === "motion_control" && motionVideoUrl)   body.videoUrl      = motionVideoUrl;
      if (frameMode === "motion_control" && startSlot.url)    body.imageUrl      = startSlot.url;
      if (frameMode === "motion_control") { body.motionStrength = motionStrength; body.motionArea = motionArea; }

      const res = await fetch(`/api/generate/video/${model.provider}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const { taskId } = await res.json();

      setVideos(prev => prev.map(v => v.id === newVideo.id ? { ...v, status: "polling", taskId } : v));

      let polls = 0;
      const poll = setInterval(async () => {
        polls++;
        if (polls > MAX_POLLS) {
          clearInterval(poll);
          setVideos(prev => prev.map(v => v.id === newVideo.id ? { ...v, status: "error", error: "Timed out" } : v));
          setGenerating(false);
          return;
        }
        try {
          const sr = await fetch(`/api/generate/status/${model.provider}/${taskId}`);
          const sd = await sr.json();
          if (sd.status === "done" && sd.url) {
            clearInterval(poll);
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id ? { ...v, status: "done", url: sd.url, thumbnailUrl: sd.thumbnailUrl ?? null } : v,
            ));
            setGenerating(false);
          } else if (sd.status === "error") {
            clearInterval(poll);
            setVideos(prev => prev.map(v => v.id === newVideo.id ? { ...v, status: "error", error: sd.error } : v));
            setGenerating(false);
          }
        } catch { /* ignore transient errors */ }
      }, POLL_INTERVAL);
    } catch (err) {
      setVideos(prev => prev.map(v => v.id === newVideo.id ? { ...v, status: "error", error: String(err) } : v));
      setGenerating(false);
    }
  }, [model, generating, prompt, negPrompt, duration, aspectRatio, quality, cameraPreset, frameMode, startSlot, endSlot, audioSlot, motionVideoUrl, motionStrength, motionArea]);

  const handleReusePrompt = useCallback((video: GeneratedVideo) => {
    setPrompt(video.prompt ?? "");
    setNegPrompt(video.negPrompt ?? "");
  }, []);

  const handleDelete = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  }, []);

  const creditEstimate = model ? estimateCredits(model.id, quality, duration) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: [
        "radial-gradient(ellipse at 20% 10%, rgba(14,165,160,0.15) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 90%, rgba(99,102,241,0.14) 0%, transparent 50%)",
        "radial-gradient(ellipse at 60% 40%, rgba(14,165,160,0.05) 0%, transparent 40%)",
        "#040E1C",
      ].join(", "),
      color: "#D8E3EE",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      paddingTop: 80,
      boxSizing: "border-box",
    }}>

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <Breadcrumb modelName={model?.displayName ?? "Video Studio"} />

      {/* ── Tool pill bar — left-aligned, full width ────────────────── */}
      <ToolPillBar selectedId={selectedModelId} onSelect={setSelectedModelId} />

      {/* ── 3-column workspace — true full width ───────────────────── */}
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
          height: "100%",
          minHeight: 0,
          position: "sticky",
          top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.06) transparent",
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

        {/* Canvas — fills 1fr naturally */}
        <div style={{ minWidth: 0 }}>
          {model && !model.available ? (
            <ComingSoonScreen model={model} />
          ) : (
            <VideoCanvas
              frameMode={frameMode}
              aspectRatio={aspectRatio}
              generating={generating}
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
            />
          )}
        </div>

        {/* Right panel — prompt */}
        <div style={{
          paddingRight: SIDE_GUTTER,
          position: "sticky",
          top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.06) transparent",
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
            lipSyncProvider={LIP_SYNC_PROVIDER}
            onGenerate={handleGenerate}
          />
        </div>
      </div>

      {/* ── Gallery — always visible, full viewport width ────────────── */}
      <div style={{
        width: "100%",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingTop: 28,
        paddingLeft: SIDE_GUTTER,
        paddingRight: SIDE_GUTTER,
        paddingBottom: 48,
        boxSizing: "border-box",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#4E6275",
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18,
        }}>
          Your Videos
        </div>
        <VideoResultsLibrary
          videos={videos}
          onReusePrompt={handleReusePrompt}
          onDelete={handleDelete}
        />
      </div>

    </div>
  );
}
