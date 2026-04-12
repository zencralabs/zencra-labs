"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  VIDEO_MODEL_REGISTRY,
  getVideoModel,
  CAMERA_PRESET_LABELS,
  type CameraPreset,
} from "@/lib/ai/video-model-registry";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type StudioMode = "standard" | "start_frame" | "start_end" | "extend" | "audio";

type VideoAspectRatio = "16:9" | "9:16" | "1:1";
type VideoDuration = 5 | 10;

interface GeneratedVideo {
  id:          string;
  url:         string | null;
  prompt:      string;
  modelId:     string;
  duration:    number;
  aspectRatio: string;
  operation:   string;
  status:      "generating" | "done" | "error";
  error?:      string;
  elapsedMs?:  number;
  klingTaskId?: string;
}

interface ImageSlot {
  url:     string | null;  // base64 or remote URL
  preview: string | null;  // object URL for <img>
  name?:   string;
}

const EMPTY_SLOT: ImageSlot = { url: null, preview: null };

const AR_OPTIONS: { value: VideoAspectRatio; label: string; icon: string }[] = [
  { value: "16:9", label: "16:9", icon: "▬" },
  { value: "9:16", label: "9:16", icon: "▮" },
  { value: "1:1",  label: "1:1",  icon: "▪" },
];

const DURATION_OPTIONS: VideoDuration[] = [5, 10];

function estimateCreditCost(duration: VideoDuration, mode: "std" | "pro"): number {
  const base = duration === 10 ? 12 : 11;
  return mode === "pro" ? base + 5 : base;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT — IMAGE UPLOAD SLOT
// ─────────────────────────────────────────────────────────────────────────────

function ImageUploadSlot({
  label,
  hint,
  slot,
  onFile,
  onClear,
  accept = "image/jpeg,image/png,image/webp",
}: {
  label:   string;
  hint?:   string;
  slot:    ImageSlot;
  onFile:  (file: File) => void;
  onClear: () => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </label>
      {slot.preview ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", aspectRatio: "16/9" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.preview} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button
            onClick={onClear}
            style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragging ? "rgba(14,165,160,0.8)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 10,
            aspectRatio: "16/9",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            background: dragging ? "rgba(14,165,160,0.06)" : "rgba(255,255,255,0.02)",
            transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 22, opacity: 0.4 }}>🖼</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
            {hint ?? "Drop image or click to upload"}
          </span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT — VIDEO CARD
// ─────────────────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  onRetry,
  onExtend,
}: {
  video:    GeneratedVideo;
  onRetry:  () => void;
  onExtend: (v: GeneratedVideo) => void;
}) {
  const modelDef = getVideoModel(video.modelId);

  if (video.status === "generating") {
    return (
      <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", aspectRatio: "16/9", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
          <div style={{ width: 32, height: 32, border: "2.5px solid rgba(14,165,160,0.6)", borderTopColor: "#0EA5A0", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {video.elapsedMs ? `${Math.floor(video.elapsedMs / 1000)}s…` : "Generating…"}
          </span>
        </div>
        <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (video.status === "error") {
    return (
      <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
        <span style={{ fontSize: 24 }}>⚠️</span>
        <p style={{ fontSize: 12, color: "rgba(239,68,68,0.9)", textAlign: "center", margin: 0 }}>
          {video.error ?? "Generation failed"}
        </p>
        <button
          onClick={onRetry}
          style={{ fontSize: 11, color: "#fff", background: "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}
        >Retry</button>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#000" }}>
        {video.url && (
          <video
            src={video.url}
            controls
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {video.prompt}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 6px" }}>
            {modelDef?.displayName ?? video.modelId}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 6px" }}>
            {video.duration}s
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 6px" }}>
            {video.aspectRatio}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {video.url && (
            <a
              href={video.url}
              download="zencra-video.mp4"
              style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "6px 0", cursor: "pointer", textDecoration: "none", textAlign: "center" }}
            >↓ Download</a>
          )}
          {modelDef?.capabilities.extendVideo && (
            <button
              onClick={() => onExtend(video)}
              style={{ flex: 1, fontSize: 11, color: "#0EA5A0", background: "rgba(14,165,160,0.08)", border: "1px solid rgba(14,165,160,0.25)", borderRadius: 7, padding: "6px 0", cursor: "pointer" }}
            >⟳ Extend</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STUDIO
// ─────────────────────────────────────────────────────────────────────────────

function VideoStudioContent() {
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();

  // Map incoming ?model= param
  const CATALOG_TO_STUDIO: Record<string, string> = {
    "kling-25": "kling-25", "kling-26": "kling-26",
    "kling-30": "kling-30", "kling-30-omni": "kling-30",
  };
  const modelParam   = searchParams.get("model") ?? "";
  const initialModel = CATALOG_TO_STUDIO[modelParam] ?? "kling-30";

  // ── State ──────────────────────────────────────────────────────────────────
  const [videos,        setVideos]        = useState<GeneratedVideo[]>([]);
  const [studioMode,    setStudioMode]    = useState<StudioMode>("standard");
  const [model,         setModel]         = useState(initialModel);
  const [prompt,        setPrompt]        = useState(searchParams.get("prompt") ?? "");
  const [negPrompt,     setNegPrompt]     = useState("");
  const [showNegPrompt, setShowNegPrompt] = useState(false);
  const [aspectRatio,   setAspectRatio]   = useState<VideoAspectRatio>("16:9");
  const [duration,      setDuration]      = useState<VideoDuration>(5);
  const [videoMode,     setVideoMode]     = useState<"std" | "pro">("std");
  const [startSlot,     setStartSlot]     = useState<ImageSlot>(EMPTY_SLOT);
  const [endSlot,       setEndSlot]       = useState<ImageSlot>(EMPTY_SLOT);
  const [sourceVideoId, setSourceVideoId] = useState<string>("");
  const [sourceVideoUrl,setSourceVideoUrl]= useState<string>("");
  const [cameraPreset,  setCameraPreset]  = useState<CameraPreset | "none">("none");
  const [showCamera,    setShowCamera]    = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [authModal,     setAuthModal]     = useState(false);
  const startTimeRef = useRef<number>(0);

  const modelDef = getVideoModel(model);
  const caps     = modelDef?.capabilities;

  // ── Validate generate button ──────────────────────────────────────────────
  function getBlockedReason(): string | null {
    if (!user) return "Sign in to generate";
    if (generating) return "Generating…";
    if (!modelDef?.available) return "Model unavailable";

    if (studioMode === "start_frame" && !startSlot.url) return "Upload a start frame image";
    if (studioMode === "start_end") {
      if (!startSlot.url) return "Upload a start frame image";
      if (!endSlot.url)   return "Upload an end frame image";
    }

    if (studioMode === "extend") {
      if (!sourceVideoId && !sourceVideoUrl) return "Select a video to extend";
    }

    if (!prompt.trim() && studioMode !== "extend") return "Enter a prompt";
    return null;
  }

  const blockedReason = getBlockedReason();
  const canGenerate   = !blockedReason;
  const creditCost    = estimateCreditCost(duration, videoMode);

  // ── Determine operation type ───────────────────────────────────────────────
  function resolveOperationType(): string {
    if (studioMode === "extend")     return "extend_video";
    if (studioMode === "audio")      return "lip_sync";
    if (studioMode === "start_end")  return "start_end_frame";
    if (studioMode === "start_frame") return "start_frame";
    if (startSlot.url) return "image_to_video";
    return "text_to_video";
  }

  // ── Handle image slot upload ──────────────────────────────────────────────
  async function handleSlotFile(slot: "start" | "end", file: File) {
    const [dataUrl, preview] = await Promise.all([
      readFileAsDataUrl(file),
      Promise.resolve(createPreviewUrl(file)),
    ]);
    if (slot === "start") setStartSlot({ url: dataUrl, preview, name: file.name });
    else                  setEndSlot({ url: dataUrl, preview, name: file.name });
  }

  function clearSlot(slot: "start" | "end") {
    if (slot === "start") {
      if (startSlot.preview) URL.revokeObjectURL(startSlot.preview);
      setStartSlot(EMPTY_SLOT);
    } else {
      if (endSlot.preview) URL.revokeObjectURL(endSlot.preview);
      setEndSlot(EMPTY_SLOT);
    }
  }

  // ── Handle Extend (from video card) ──────────────────────────────────────
  function handleExtendVideo(v: GeneratedVideo) {
    setStudioMode("extend");
    setSourceVideoId(v.klingTaskId ?? "");
    setSourceVideoUrl(v.url ?? "");
    setModel(v.modelId);
    setPrompt("");
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!canGenerate) {
      if (!user) { setAuthModal(true); return; }
      return;
    }

    const videoId    = `vid_${Date.now()}`;
    const operation  = resolveOperationType();
    const placeholder: GeneratedVideo = {
      id:          videoId,
      url:         null,
      prompt:      prompt || "(extend)",
      modelId:     model,
      duration,
      aspectRatio,
      operation,
      status:      "generating",
    };

    setVideos(prev => [placeholder, ...prev]);
    setGenerating(true);
    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      setVideos(prev => prev.map(v =>
        v.id === videoId ? { ...v, elapsedMs: Date.now() - startTimeRef.current } : v
      ));
    }, 1000);

    try {
      const authHeader: Record<string, string> = (user as { accessToken?: string })?.accessToken
        ? { Authorization: `Bearer ${(user as { accessToken?: string }).accessToken}` }
        : {};

      const body: Record<string, unknown> = {
        mode:          "video",
        provider:      "kling",
        prompt:        prompt || " ",
        quality:       "cinematic",
        aspectRatio:   studioMode === "standard" && !startSlot.url ? aspectRatio : undefined,
        durationSeconds: duration,
        videoMode,
        operationType: operation,
        metadata:      { klingModel: model },
      };

      if (startSlot.url)    body.imageUrl     = startSlot.url;
      if (endSlot.url)      body.endImageUrl   = endSlot.url;
      if (sourceVideoId)    body.sourceVideoId = sourceVideoId;
      if (sourceVideoUrl)   body.sourceVideoUrl= sourceVideoUrl;
      if (negPrompt.trim()) body.metadata = { ...(body.metadata as object), negativePrompt: negPrompt };

      if (cameraPreset !== "none") {
        body.cameraControl = { type: cameraPreset };
      }

      const res = await fetch("/api/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body:    JSON.stringify(body),
      });

      if (res.status === 402) {
        const errData = await res.json();
        const need    = errData.data?.required ?? "?";
        const have    = errData.data?.available ?? "?";
        throw new Error(`Not enough credits — need ${need}, you have ${have}`);
      }

      const data = await res.json();
      if (!res.ok || !data.data?.url) {
        throw new Error(data.data?.error ?? data.error ?? "Video generation failed");
      }

      // Store the Kling task ID from metadata for extend/lip-sync
      const klingTaskId = String(data.data?.metadata?.taskId ?? "");

      setVideos(prev => prev.map(v =>
        v.id === videoId
          ? { ...v, url: data.data.url as string, status: "done", elapsedMs: Date.now() - startTimeRef.current, klingTaskId }
          : v
      ));

    } catch (err) {
      setVideos(prev => prev.map(v =>
        v.id === videoId
          ? { ...v, status: "error", error: err instanceof Error ? err.message : "Failed" }
          : v
      ));
    } finally {
      clearInterval(timer);
      setGenerating(false);
      refreshUser?.();
    }
  }

  // ── Retry ─────────────────────────────────────────────────────────────────
  function handleRetry(videoId: string) {
    setVideos(prev => prev.filter(v => v.id !== videoId));
    handleGenerate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const STUDIO_MODES: { id: StudioMode; label: string; icon: string; disabled?: boolean }[] = [
    { id: "standard",    label: "Standard",    icon: "✦" },
    { id: "start_frame", label: "Start Frame", icon: "▶" },
    { id: "start_end",   label: "Start + End", icon: "⇥", disabled: !caps?.endFrame },
    { id: "extend",      label: "Extend",      icon: "⟳" },
    { id: "audio",       label: "Lip Sync",    icon: "🎙" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", paddingTop: 64 }}>

      <div className="studio-layout" style={{ display: "flex", padding: "0 20px", gap: 20, paddingBottom: 120 }}>

        {/* ── LEFT: Controls ──────────────────────────────────────────── */}
        <div className="studio-left-panel">

          {/* Mode Switcher */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Mode</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {STUDIO_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => !m.disabled && setStudioMode(m.id)}
                  disabled={m.disabled}
                  title={m.disabled ? "Requires Kling 3.0 or 2.6" : undefined}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: studioMode === m.id ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: studioMode === m.id ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.03)",
                    color: m.disabled ? "rgba(255,255,255,0.2)" : studioMode === m.id ? "#7EDDD9" : "rgba(255,255,255,0.5)",
                    fontSize: 12, cursor: m.disabled ? "default" : "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Model</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {VIDEO_MODEL_REGISTRY.map(m => (
                <button
                  key={m.id}
                  onClick={() => m.available && setModel(m.id)}
                  disabled={!m.available}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: model === m.id ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.07)",
                    background: model === m.id ? "rgba(14,165,160,0.12)" : "rgba(255,255,255,0.02)",
                    color: !m.available ? "rgba(255,255,255,0.25)" : model === m.id ? "#CCEFEE" : "rgba(255,255,255,0.7)",
                    fontSize: 12, cursor: m.available ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>{m.displayName}</span>
                    {m.available && (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{m.description.split(" — ")[0]}</span>
                    )}
                  </div>
                  {m.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: m.badgeColor ?? "#555", borderRadius: 4, padding: "2px 5px", letterSpacing: "0.06em" }}>
                      {m.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Duration</div>
            <div style={{ display: "flex", gap: 4 }}>
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, cursor: "pointer", border: duration === d ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.08)", background: duration === d ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.03)", color: duration === d ? "#7EDDD9" : "rgba(255,255,255,0.5)", fontWeight: duration === d ? 600 : 400 }}
                >{d}s</button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio (T2V only) */}
          {studioMode === "standard" && startSlot.url ? null : studioMode === "standard" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Aspect Ratio</div>
              <div style={{ display: "flex", gap: 5 }}>
                {AR_OPTIONS.map(ar => (
                  <button
                    key={ar.value}
                    onClick={() => setAspectRatio(ar.value)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, cursor: "pointer", border: aspectRatio === ar.value ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.08)", background: aspectRatio === ar.value ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.03)", color: aspectRatio === ar.value ? "#7EDDD9" : "rgba(255,255,255,0.5)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
                  >
                    <span>{ar.icon}</span>
                    <span style={{ fontSize: 10 }}>{ar.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode: std / pro */}
          {caps?.proMode && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Quality</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["std", "pro"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setVideoMode(m)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, cursor: "pointer", border: videoMode === m ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.08)", background: videoMode === m ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.03)", color: videoMode === m ? "#7EDDD9" : "rgba(255,255,255,0.5)", fontWeight: videoMode === m ? 600 : 400 }}
                  >{m === "std" ? "Standard" : "Pro"}</button>
                ))}
              </div>
            </div>
          )}

          {/* Camera Control */}
          {caps?.cameraControl && (studioMode === "standard" || studioMode === "start_frame" || studioMode === "start_end") && (
            <div>
              <button
                onClick={() => setShowCamera(!showCamera)}
                style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showCamera ? "▾" : "▸"} Camera Control {cameraPreset !== "none" && `(${CAMERA_PRESET_LABELS[cameraPreset as CameraPreset]})`}
              </button>
              {showCamera && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                  <button
                    onClick={() => setCameraPreset("none")}
                    style={{ padding: "6px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: cameraPreset === "none" ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.07)", background: cameraPreset === "none" ? "rgba(14,165,160,0.12)" : "rgba(255,255,255,0.02)", color: cameraPreset === "none" ? "#7EDDD9" : "rgba(255,255,255,0.4)", textAlign: "left" }}
                  >No camera movement</button>
                  {(caps.cameraPresets as CameraPreset[]).filter(p => p !== "simple").map(preset => (
                    <button
                      key={preset}
                      onClick={() => setCameraPreset(preset)}
                      style={{ padding: "6px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: cameraPreset === preset ? "1px solid rgba(14,165,160,0.5)" : "1px solid rgba(255,255,255,0.07)", background: cameraPreset === preset ? "rgba(14,165,160,0.12)" : "rgba(255,255,255,0.02)", color: cameraPreset === preset ? "#7EDDD9" : "rgba(255,255,255,0.4)", textAlign: "left" }}
                    >{CAMERA_PRESET_LABELS[preset]}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Credit estimate */}
          <div style={{ background: "rgba(14,165,160,0.07)", border: "1px solid rgba(14,165,160,0.15)", borderRadius: 9, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>Estimated Cost</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#7EDDD9" }}>
              {creditCost} credits
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
              {duration}s · {videoMode === "pro" ? "Pro" : "Standard"} · {modelDef?.displayName}
            </div>
          </div>

        </div>

        {/* ── CENTER: Prompt + Reference Slots ────────────────────────── */}
        <div className="studio-center-panel">

          {/* Standard mode: optional image upload for I2V */}
          {studioMode === "standard" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Reference Image <span style={{ fontWeight: 400, textTransform: "none", color: "rgba(255,255,255,0.25)" }}>— optional, for Image-to-Video</span>
              </div>
              <ImageUploadSlot
                label="Start Frame"
                hint="Upload to animate from this image (optional)"
                slot={startSlot}
                onFile={f => handleSlotFile("start", f)}
                onClear={() => clearSlot("start")}
              />
            </div>
          )}

          {/* Start Frame mode */}
          {studioMode === "start_frame" && (
            <ImageUploadSlot
              label="Start Frame"
              hint="How the shot begins — required"
              slot={startSlot}
              onFile={f => handleSlotFile("start", f)}
              onClear={() => clearSlot("start")}
            />
          )}

          {/* Start + End Frame mode */}
          {studioMode === "start_end" && (
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <ImageUploadSlot
                  label="Start Frame"
                  hint="How the shot begins — required"
                  slot={startSlot}
                  onFile={f => handleSlotFile("start", f)}
                  onClear={() => clearSlot("start")}
                />
              </div>
              <div style={{ flex: 1 }}>
                <ImageUploadSlot
                  label="End Frame"
                  hint="How the shot resolves — required"
                  slot={endSlot}
                  onFile={f => handleSlotFile("end", f)}
                  onClear={() => clearSlot("end")}
                />
              </div>
            </div>
          )}

          {/* Extend mode */}
          {studioMode === "extend" && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Source Video</div>
              {sourceVideoUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <video src={sourceVideoUrl} controls style={{ width: "100%", borderRadius: 8, maxHeight: 200, background: "#000" }} />
                  <button
                    onClick={() => { setSourceVideoId(""); setSourceVideoUrl(""); }}
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", alignSelf: "flex-start" }}
                  >Remove</button>
                </div>
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  Click <strong style={{ color: "#0EA5A0" }}>⟳ Extend</strong> on a generated video below to extend it here.
                </div>
              )}
            </div>
          )}

          {/* Lip Sync mode */}
          {studioMode === "audio" && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Lip Sync</div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 10px", lineHeight: 1.6 }}>
                Select a source video with a visible face below using the <strong style={{ color: "#7EDDD9" }}>⟳ Extend</strong> button (also works for Lip Sync), or paste a video URL below.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Video URL</label>
                <input
                  type="text"
                  placeholder="https://…"
                  value={sourceVideoUrl}
                  onChange={e => setSourceVideoUrl(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none" }}
                />
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Text to speak</label>
                <textarea
                  placeholder="The text the person will say…"
                  rows={3}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "8px 10px", color: "#fff", fontSize: 13, resize: "none", outline: "none", lineHeight: 1.6 }}
                />
              </div>
            </div>
          )}

          {/* Prompt */}
          {studioMode !== "audio" && (
            <div style={{ position: "relative" }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                placeholder={
                  studioMode === "extend"      ? "Optional continuation prompt…" :
                  studioMode === "start_end"   ? "Describe what happens between the start and end frames…" :
                  studioMode === "start_frame" ? "Describe what happens after the start frame…" :
                  "Describe your video scene…"
                }
                rows={4}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, resize: "vertical",
                  outline: "none", lineHeight: 1.7, boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <button
                  onClick={() => setShowNegPrompt(!showNegPrompt)}
                  style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showNegPrompt ? "▾" : "▸"} Negative prompt
                </button>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>⌘↵ to generate</span>
              </div>
              {showNegPrompt && (
                <textarea
                  value={negPrompt}
                  onChange={e => setNegPrompt(e.target.value)}
                  placeholder="Elements to avoid (e.g. blur, watermark, text)…"
                  rows={2}
                  style={{
                    width: "100%", marginTop: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8, padding: "8px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, resize: "none",
                    outline: "none", lineHeight: 1.6, boxSizing: "border-box",
                  }}
                />
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate && !!user}
            style={{
              padding: "14px 0", borderRadius: 10, border: "none", cursor: canGenerate ? "pointer" : "default",
              background: canGenerate
                ? "linear-gradient(135deg, #0D8A86 0%, #0EA5A0 100%)"
                : "rgba(255,255,255,0.06)",
              color: canGenerate ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", transition: "all 0.2s",
              boxShadow: canGenerate ? "0 0 24px rgba(14,165,160,0.3)" : "none",
            }}
          >
            {generating
              ? "Generating…"
              : blockedReason
                ? blockedReason
                : `Generate  +${creditCost} cr`}
          </button>

          {/* Results */}
          {videos.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Results
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {videos.map(v => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    onRetry={() => handleRetry(v.id)}
                    onExtend={handleExtendVideo}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {videos.length === 0 && !generating && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12, color: "rgba(255,255,255,0.2)" }}>
              <span style={{ fontSize: 48, opacity: 0.3 }}>🎬</span>
              <p style={{ fontSize: 14, margin: 0 }}>Your generated videos will appear here</p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>Write a prompt and click Generate to start</p>
            </div>
          )}
        </div>
      </div>

      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}

      <style>{`
        .studio-layout {
          width: 100%;
          box-sizing: border-box;
        }
        .studio-left-panel {
          width: 260px;
          flex-shrink: 0;
          padding-top: 16px;
          padding-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(14,165,160,0.3) transparent;
        }
        .studio-center-panel {
          flex: 1;
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .studio-layout {
            flex-direction: column;
            padding: 0 12px;
            gap: 12px;
          }
          .studio-left-panel {
            width: 100%;
            padding-top: 12px;
          }
          .studio-center-panel {
            padding-top: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
        Loading studio…
      </div>
    }>
      <VideoStudioContent />
    </Suspense>
  );
}
