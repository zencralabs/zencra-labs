"use client";

/**
 * Zencra Labs — Cinematic Video Studio
 * Premium 4-zone pro-editor layout:
 *   [Left Rail] [Central Canvas] [Prompt Panel] [Meta Panel]
 *   [Bottom Video Library Strip]
 *
 * Tool selection via ?tool=kling-30 (defaults to kling-30)
 * Capabilities driven by video-model-registry.ts — no hardcoded chaos.
 */

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload, X, Play, Pause, Download, Copy, Check,
  ChevronDown, ChevronUp, Zap, Film, Maximize2, Minimize2,
  Settings2, SlidersHorizontal, Camera,
  RotateCcw, Plus, Minus, ImagePlus,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { getVideoModel } from "@/lib/ai/video-model-registry";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FrameMode = "text_to_video" | "start_frame" | "start_end" | "extend" | "lip_sync";
type VideoAR   = "16:9" | "9:16" | "1:1";
type Quality   = "std" | "pro";
type CamPreset = "none" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward";

interface ImageSlot { url: string | null; preview: string | null; name?: string; }
const EMPTY_SLOT: ImageSlot = { url: null, preview: null };

interface GeneratedVideo {
  id: string; url: string | null; prompt: string; negPrompt: string;
  modelId: string; duration: number; aspectRatio: string;
  frameMode: FrameMode; status: "generating" | "done" | "error";
  error?: string; klingTaskId?: string; creditsUsed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool list for the header switcher
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_TOOLS = [
  { id: "kling-30",     label: "Kling 3.0",       badge: "HOT",  bc: "#EF4444", ok: true  },
  { id: "kling-26",     label: "Kling 2.6",        badge: null,   bc: null,      ok: true  },
  { id: "kling-25",     label: "Kling 2.5 Turbo",  badge: null,   bc: null,      ok: true  },
  { id: "seedance-20",  label: "Seedance 2.0",      badge: "SOON", bc: "#8B5CF6", ok: false },
  { id: "runway-gen45", label: "Runway ML",          badge: "SOON", bc: "#8B5CF6", ok: false },
  { id: "veo-32",       label: "Veo 3.2",            badge: "SOON", bc: "#8B5CF6", ok: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function estimateCredits(duration: number, quality: Quality, mode: FrameMode) {
  let base = duration === 10 ? 12 : 8;
  if (quality === "pro") base += 5;
  if (mode === "start_end") base += 2;
  if (mode === "lip_sync")  base = 6;
  if (mode === "extend")    base = 5;
  return base;
}

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadSlot
// ─────────────────────────────────────────────────────────────────────────────

function UploadSlot({ slot, label, onFile, onClear, disabled }: {
  slot: ImageSlot; label: string; onFile: (f: File) => void;
  onClear: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  if (slot.preview) return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: "#050A14" }}>
      <img src={slot.preview} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      <button onClick={onClear} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
      <div style={{ position: "absolute", bottom: 10, left: 10, fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 8 }}>{label}</div>
    </div>
  );

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) onFile(f); }}
      onClick={() => !disabled && ref.current?.click()}
      style={{
        width: "100%", height: "100%", borderRadius: 14,
        border: `2px dashed ${drag ? "#0EA5A0" : "rgba(14,165,160,0.25)"}`,
        background: drag ? "rgba(14,165,160,0.06)" : "rgba(255,255,255,0.015)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", gap: 12,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,rgba(14,165,160,0.18),rgba(37,99,235,0.18))", border: "1px solid rgba(14,165,160,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ImagePlus size={24} color="#0EA5A0" />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#CBD5E1" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#3D4F6E", marginTop: 4 }}>Drag & drop or click to upload</div>
        <div style={{ fontSize: 11, color: "#2D3748", marginTop: 2 }}>PNG, JPG, WebP supported</div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoCard
// ─────────────────────────────────────────────────────────────────────────────

function VideoCard({ video, zoom, onExtend }: { video: GeneratedVideo; zoom: number; onExtend: (v: GeneratedVideo) => void; }) {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const vRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.status !== "generating") return;
    const t = setInterval(() => setElapsed(e => e + 1000), 1000);
    return () => clearInterval(t);
  }, [video.status]);

  const W = Math.round(190 * zoom), H = Math.round(126 * zoom);

  return (
    <div style={{ width: W, flexShrink: 0, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", transition: "all 0.2s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-3px)"; el.style.boxShadow = "0 8px 28px rgba(14,165,160,0.15)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ""; el.style.boxShadow = ""; }}
    >
      {/* Thumbnail */}
      <div style={{ width: "100%", height: H, background: "#050A14", position: "relative", overflow: "hidden" }}>
        {video.status === "generating" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(14,165,160,0.2)", borderTopColor: "#0EA5A0", animation: "spin .8s linear infinite" }} />
            <span style={{ fontSize: 11, color: "#3D4F6E" }}>{fmtMs(elapsed)}</span>
          </div>
        )}
        {video.status === "error" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} color="#EF4444" /></div>
            <span style={{ fontSize: 10, color: "#EF4444", textAlign: "center", lineHeight: 1.4 }}>{video.error || "Failed"}</span>
          </div>
        )}
        {video.status === "done" && video.url && (
          <>
            <video ref={vRef} src={video.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} loop />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: playing ? 0 : 1, transition: "opacity 0.2s" }}>
              <button onClick={() => { playing ? vRef.current?.pause() : vRef.current?.play(); setPlaying(!playing); }}
                style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(14,165,160,0.9)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
              </button>
            </div>
          </>
        )}
        <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(14,165,160,0.75)", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>{video.duration}s</span>
          <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(0,0,0,0.6)", color: "#64748B", padding: "1px 6px", borderRadius: 4 }}>{video.aspectRatio}</span>
        </div>
      </div>
      {/* Footer */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 11, color: "#3D4F6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 7 }}>{video.prompt || "—"}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {video.status === "done" && video.url && (
              <a href={video.url} download style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", textDecoration: "none" }}><Download size={11} /></a>
            )}
            <button onClick={() => { navigator.clipboard.writeText(video.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: copied ? "#0EA5A0" : "#64748B" }}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            {video.status === "done" && (
              <button onClick={() => onExtend(video)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}><Plus size={11} /></button>
            )}
          </div>
          <span style={{ fontSize: 10, color: "#2D3748" }}>{video.creditsUsed}cr</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Studio
// ─────────────────────────────────────────────────────────────────────────────

function VideoStudioContent() {
  const { user }  = useAuth();
  const router    = useRouter();
  const params    = useSearchParams();
  const toolId    = params.get("tool") ?? "kling-30";
  const model     = getVideoModel(toolId) ?? getVideoModel("kling-30")!;
  const caps      = model.capabilities;

  // Controls
  const [frameMode, setFrameMode] = useState<FrameMode>("text_to_video");
  const [duration,  setDuration]  = useState<number>(caps.durations[0] ?? 5);
  const [ar,        setAr]        = useState<VideoAR>("16:9");
  const [quality,   setQuality]   = useState<Quality>("std");
  const [camera,    setCamera]    = useState<CamPreset>("none");
  const [showCam,   setShowCam]   = useState(false);

  // Slots
  const [startSlot, setStartSlot] = useState<ImageSlot>(EMPTY_SLOT);
  const [endSlot,   setEndSlot]   = useState<ImageSlot>(EMPTY_SLOT);

  // Prompt
  const [prompt,    setPrompt]    = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [showNeg,   setShowNeg]   = useState(false);

  // Generation
  const [videos,      setVideos]      = useState<GeneratedVideo[]>([]);
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState("");
  const [activeVideo, setActiveVideo] = useState<GeneratedVideo | null>(null);

  // Extend
  const [extId,  setExtId]  = useState("");
  const [extUrl, setExtUrl] = useState("");

  // UI
  const [authModal,   setAuthModal]   = useState(false);
  const [zoom,        setZoom]        = useState(1);
  const [railClosed,  setRailClosed]  = useState(false);
  const [metaOpen,    setMetaOpen]    = useState(true);
  const [pCopied,     setPCopied]     = useState(false);

  const credits = estimateCredits(duration, quality, frameMode);

  // Fix mode when model changes
  useEffect(() => {
    if (frameMode === "start_end" && !caps.endFrame)   setFrameMode("start_frame");
    if (frameMode === "start_frame" && !caps.startFrame) setFrameMode("text_to_video");
    if (frameMode === "extend" && !caps.extendVideo)   setFrameMode("text_to_video");
    if (frameMode === "lip_sync" && !caps.lipSync)     setFrameMode("text_to_video");
    if (!caps.durations.includes(duration)) setDuration(caps.durations[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  async function handleSlotFile(which: "start" | "end", file: File) {
    const url = await readFile(file);
    const preview = URL.createObjectURL(file);
    const slot = { url, preview, name: file.name };
    which === "start" ? setStartSlot(slot) : setEndSlot(slot);
  }

  function handleExtend(v: GeneratedVideo) {
    setFrameMode("extend");
    setExtId(v.klingTaskId ?? "");
    setExtUrl(v.url ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerate() {
    if (!user) { setAuthModal(true); return; }
    if (!model.available) { setGenError("This model is not yet available."); return; }
    if (!["extend","lip_sync"].includes(frameMode) && !prompt.trim()) { setGenError("Please enter a prompt."); return; }
    if (frameMode === "start_frame" && !startSlot.url) { setGenError("Upload a start frame image."); return; }
    if (frameMode === "start_end" && (!startSlot.url || !endSlot.url)) { setGenError("Upload both start and end frames."); return; }

    setGenError(""); setGenerating(true);
    const nv: GeneratedVideo = {
      id: `v-${Date.now()}`, url: null, prompt, negPrompt,
      modelId: model.id, duration, aspectRatio: ar, frameMode,
      status: "generating", creditsUsed: credits,
    };
    setVideos(prev => [nv, ...prev]);
    setActiveVideo(nv);

    try {
      const token = (user as unknown as { access_token?: string }).access_token ?? "";
      const op =
        frameMode === "extend"      ? "extend_video"     :
        frameMode === "lip_sync"    ? "lip_sync"         :
        frameMode === "start_end"   ? "start_end_frame"  :
        frameMode === "start_frame" ? "start_frame"      :
        startSlot.url               ? "image_to_video"   : "text_to_video";

      const body: Record<string, unknown> = {
        mode: "video", provider: "kling",
        prompt: prompt || " ",
        quality: quality === "pro" ? "studio" : "cinematic",
        aspectRatio: ar, durationSeconds: duration,
        videoMode: quality, operationType: op,
        metadata: { klingModel: model.id },
      };
      if (negPrompt)     body.negativePrompt = negPrompt;
      if (startSlot.url) body.imageUrl        = startSlot.url;
      if (endSlot.url)   body.endImageUrl     = endSlot.url;
      if (extId)         body.sourceVideoId   = extId;
      if (extUrl)        body.sourceVideoUrl  = extUrl;
      if (camera !== "none") body.cameraControl = { type: camera };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res  = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      const url    = data.data?.url ?? null;
      const taskId = data.data?.taskId ?? data.data?.metadata?.taskId;
      setVideos(p => p.map(v => v.id === nv.id ? { ...v, url, klingTaskId: taskId, status: url ? "done" : "generating" } : v));
      setActiveVideo({ ...nv, url, klingTaskId: taskId, status: url ? "done" : "generating" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setVideos(p => p.map(v => v.id === nv.id ? { ...v, status: "error", error: msg } : v));
      setGenError(msg);
    }
    setGenerating(false);
  }

  const FRAME_MODES: { id: FrameMode; label: string; ok: boolean }[] = [
    { id: "text_to_video", label: "Text → Video",  ok: caps.textToVideo  },
    { id: "start_frame",   label: "Start Frame",   ok: caps.startFrame   },
    { id: "start_end",     label: "Start + End",   ok: caps.endFrame     },
    { id: "extend",        label: "Extend",         ok: caps.extendVideo  },
    { id: "lip_sync",      label: "Lip Sync",       ok: caps.lipSync      },
  ];

  const AR_OPTS: { value: VideoAR; label: string; icon: string }[] = [
    { value: "16:9", label: "16:9", icon: "▬" },
    { value: "9:16", label: "9:16", icon: "▮" },
    { value: "1:1",  label: "1:1",  icon: "▪" },
  ];

  const CAM_OPTS = [
    { value: "none" as CamPreset,                label: "Free" },
    { value: "down_back" as CamPreset,           label: "Pull Back" },
    { value: "forward_up" as CamPreset,          label: "Push In" },
    { value: "right_turn_forward" as CamPreset,  label: "Arc Right" },
    { value: "left_turn_forward" as CamPreset,   label: "Arc Left" },
  ];

  const canGenerate = !generating;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#060D1F", color: "#F8FAFC", overflow: "hidden", fontFamily: "var(--font-body,sans-serif)" }}>

      {/* ════════ HEADER BAR ════════ */}
      <header style={{
        height: 50, flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(4,9,20,0.98)", backdropFilter: "blur(12px)",
        zIndex: 200,
      }}>
        {/* Back link */}
        <Link href="/studio" style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none", color: "#3D4F6E", fontSize: 12, flexShrink: 0 }}>
          <Film size={13} /> Studio
        </Link>
        <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 14 }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", flexShrink: 0 }}>Video Studio</span>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />

        {/* Tool switcher */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flexShrink: 0 }}>
          {VIDEO_TOOLS.map(t => (
            <button key={t.id}
              onClick={() => t.ok && router.push(`/studio/video?tool=${t.id}`)}
              style={{
                padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                border: `1px solid ${toolId === t.id ? "rgba(14,165,160,0.45)" : "rgba(255,255,255,0.06)"}`,
                background: toolId === t.id ? "rgba(14,165,160,0.1)" : "transparent",
                color: toolId === t.id ? "#0EA5A0" : t.ok ? "#475569" : "#1E293B",
                cursor: t.ok ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 5,
              }}>
              {t.label}
              {t.badge && <span style={{ fontSize: 9, fontWeight: 800, color: t.bc ?? "#64748B", background: `${t.bc ?? "#64748B"}22`, padding: "0 4px", borderRadius: 3 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Rail toggle */}
        <button onClick={() => setRailClosed(c => !c)}
          title={railClosed ? "Show controls" : "Hide controls"}
          style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#3D4F6E", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SlidersHorizontal size={14} />
        </button>
      </header>

      {/* ════════ 4-ZONE WORK AREA ════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ═══ ZONE 1: LEFT RAIL ═══ */}
        {!railClosed && (
          <aside style={{
            width: 224, flexShrink: 0, overflowY: "auto",
            background: "rgba(255,255,255,0.013)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: "18px 14px", display: "flex", flexDirection: "column", gap: 22,
          }}>

            {/* Active model card */}
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "linear-gradient(135deg,rgba(14,165,160,0.09),rgba(37,99,235,0.07))", border: "1px solid rgba(14,165,160,0.22)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Active Model</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0EA5A0" }}>{model.displayName}</div>
              <div style={{ fontSize: 11, color: "#3D4F6E", marginTop: 3, lineHeight: 1.5 }}>{model.description}</div>
            </div>

            {/* Frame mode */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Frame Mode</div>
              {FRAME_MODES.map(m => (
                <button key={m.id} disabled={!m.ok} onClick={() => setFrameMode(m.id)} style={{
                  width: "100%", marginBottom: 4, padding: "8px 12px", borderRadius: 9, textAlign: "left",
                  border: `1px solid ${frameMode === m.id ? "rgba(14,165,160,0.4)" : "rgba(255,255,255,0.06)"}`,
                  background: frameMode === m.id ? "rgba(14,165,160,0.1)" : "transparent",
                  color: !m.ok ? "#1E293B" : frameMode === m.id ? "#0EA5A0" : "#475569",
                  cursor: m.ok ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: frameMode === m.id ? 700 : 400, transition: "all 0.15s",
                }}>
                  {m.label}
                  {!m.ok && <span style={{ marginLeft: 6, fontSize: 9, color: "#1E293B" }}>N/A</span>}
                </button>
              ))}
            </div>

            {/* Duration */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Duration</div>
              <div style={{ display: "flex", gap: 6 }}>
                {caps.durations.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{
                    flex: 1, padding: "9px 4px", borderRadius: 9,
                    border: `1px solid ${duration === d ? "rgba(14,165,160,0.4)" : "rgba(255,255,255,0.07)"}`,
                    background: duration === d ? "rgba(14,165,160,0.1)" : "transparent",
                    color: duration === d ? "#0EA5A0" : "#475569",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>{d}s</button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            {frameMode !== "start_end" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Aspect Ratio</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {AR_OPTS.filter(o => caps.aspectRatios.includes(o.value)).map(o => (
                    <button key={o.value} onClick={() => setAr(o.value)} style={{
                      flex: 1, padding: "8px 4px", borderRadius: 9,
                      border: `1px solid ${ar === o.value ? "rgba(14,165,160,0.4)" : "rgba(255,255,255,0.07)"}`,
                      background: ar === o.value ? "rgba(14,165,160,0.1)" : "transparent",
                      color: ar === o.value ? "#0EA5A0" : "#475569",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>{o.icon} {o.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quality */}
            {caps.proMode && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Quality</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["std","pro"] as Quality[]).map(q => (
                    <button key={q} onClick={() => setQuality(q)} style={{
                      flex: 1, padding: "8px 4px", borderRadius: 9,
                      border: `1px solid ${quality === q ? (q === "pro" ? "rgba(168,85,247,0.4)" : "rgba(14,165,160,0.4)") : "rgba(255,255,255,0.07)"}`,
                      background: quality === q ? (q === "pro" ? "rgba(168,85,247,0.1)" : "rgba(14,165,160,0.1)") : "transparent",
                      color: quality === q ? (q === "pro" ? "#A855F7" : "#0EA5A0") : "#475569",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>{q === "std" ? "Standard" : "Pro"}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Camera */}
            {caps.cameraControl && (
              <div>
                <button onClick={() => setShowCam(c => !c)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#3D4F6E", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 0",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Camera size={12} /> Camera</span>
                  {showCam ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showCam && CAM_OPTS.map(p => (
                  <button key={p.value} onClick={() => setCamera(p.value)} style={{
                    width: "100%", marginBottom: 3, padding: "7px 10px", borderRadius: 8, textAlign: "left",
                    border: `1px solid ${camera === p.value ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.06)"}`,
                    background: camera === p.value ? "rgba(37,99,235,0.1)" : "transparent",
                    color: camera === p.value ? "#60A5FA" : "#475569",
                    fontSize: 12, cursor: "pointer",
                  }}>{p.label}</button>
                ))}
              </div>
            )}

            {/* Credit estimate */}
            <div style={{ marginTop: "auto", padding: "14px", borderRadius: 12, background: "linear-gradient(135deg,rgba(37,99,235,0.09),rgba(14,165,160,0.06))", border: "1px solid rgba(37,99,235,0.2)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Estimated Cost</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={18} color="#60A5FA" />
                <span style={{ fontSize: 26, fontWeight: 900, color: "#60A5FA", lineHeight: 1 }}>{credits}</span>
                <span style={{ fontSize: 12, color: "#3D4F6E" }}>credits</span>
              </div>
              <div style={{ fontSize: 11, color: "#2D3748", marginTop: 6 }}>{duration}s · {quality === "pro" ? "Pro" : "Standard"} · {model.displayName}</div>
            </div>
          </aside>
        )}

        {/* ═══ ZONE 2: CENTRAL CANVAS ═══ */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px", gap: 10, minWidth: 0, overflow: "hidden" }}>
          {/* Canvas label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2D3748", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {frameMode === "text_to_video" ? "Reference Image — optional, for Image-to-Video"
              : frameMode === "start_frame"  ? "Start Frame — required"
              : frameMode === "start_end"    ? "Start + End Frames — both required"
              : frameMode === "extend"       ? "Extend — select a generated video below"
              : "Lip Sync — video with clear face"}
            </span>
            <span style={{ fontSize: 11, color: "#1E293B" }}>{model.displayName} · {ar} · {duration}s · {quality === "pro" ? "Pro" : "Standard"}</span>
          </div>

          {/* Canvas body */}
          <div style={{ flex: 1, display: "flex", gap: 14, minHeight: 0 }}>
            {frameMode === "extend" ? (
              <div style={{ flex: 1, borderRadius: 16, border: "2px dashed rgba(37,99,235,0.25)", background: "rgba(37,99,235,0.03)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
                {extUrl ? (
                  <video src={extUrl} style={{ maxWidth: "65%", maxHeight: "75%", borderRadius: 12, objectFit: "contain" }} controls />
                ) : (
                  <>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <RotateCcw size={26} color="#60A5FA" />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#CBD5E1" }}>Extend Mode</div>
                      <div style={{ fontSize: 13, color: "#3D4F6E", marginTop: 4 }}>Click "Extend" on any video below, or paste a URL</div>
                    </div>
                    <input value={extUrl} onChange={e => setExtUrl(e.target.value)} placeholder="Paste video URL to extend…"
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", width: 340 }} />
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <UploadSlot slot={startSlot}
                    label={frameMode === "text_to_video" ? "Reference Image (optional)" : "Start Frame"}
                    onFile={f => handleSlotFile("start", f)} onClear={() => setStartSlot(EMPTY_SLOT)} />
                </div>
                {frameMode === "start_end" && (
                  <div style={{ flex: 1 }}>
                    <UploadSlot slot={endSlot} label="End Frame"
                      onFile={f => handleSlotFile("end", f)} onClear={() => setEndSlot(EMPTY_SLOT)}
                      disabled={!caps.endFrame} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {genError && (
            <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              {genError}
              <button onClick={() => setGenError("")} style={{ background: "none", border: "none", color: "#FCA5A5", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}
        </main>

        {/* ═══ ZONE 3: PROMPT PANEL ═══ */}
        <aside style={{
          width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.012)",
          padding: "18px 16px", gap: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#3D4F6E", textTransform: "uppercase", letterSpacing: "0.08em" }}>Prompt</div>

          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={
              frameMode === "lip_sync" ? "Enter speech for lip sync…" :
              frameMode === "extend"   ? "Optional: additional direction…" :
              "Describe your cinematic video scene…"
            }
            style={{
              flex: 1, minHeight: 200, padding: "14px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
              color: "#F8FAFC", fontSize: 13, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(14,165,160,0.4)")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
          />

          {caps.negativePrompt && (
            <div>
              <button onClick={() => setShowNeg(n => !n)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3D4F6E", fontSize: 12, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                {showNeg ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Negative prompt
              </button>
              {showNeg && (
                <textarea value={negPrompt} onChange={e => setNegPrompt(e.target.value)} placeholder="What to avoid…"
                  style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 10, minHeight: 68, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "#94A3B8", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              )}
            </div>
          )}

          {/* Prompt chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["cinematic", "slow motion", "4K", "dramatic light", "aerial shot"].map(chip => (
              <button key={chip} onClick={() => setPrompt(p => p ? `${p}, ${chip}` : chip)}
                style={{ padding: "4px 9px", borderRadius: 20, fontSize: 11, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#3D4F6E", cursor: "pointer" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(14,165,160,0.35)"; el.style.color = "#0EA5A0"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.color = "#3D4F6E"; }}>
                + {chip}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Credit + balance */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#3D4F6E" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Zap size={12} color="#60A5FA" />{credits} credits</span>
            {user && <span>{user.credits?.toLocaleString()} available</span>}
          </div>

          {/* GENERATE BUTTON */}
          <button onClick={handleGenerate} disabled={!canGenerate} style={{
            padding: "15px", borderRadius: 12, border: "none",
            cursor: canGenerate ? "pointer" : "not-allowed",
            background: canGenerate ? "linear-gradient(135deg,#0EA5A0 0%,#0D9488 100%)" : "rgba(255,255,255,0.05)",
            color: canGenerate ? "#fff" : "#2D3748",
            fontSize: 14, fontWeight: 800, letterSpacing: "0.03em",
            boxShadow: canGenerate ? "0 0 28px rgba(14,165,160,0.35)" : "none",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => canGenerate && ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(14,165,160,0.55)")}
            onMouseLeave={e => canGenerate && ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(14,165,160,0.35)")}
          >
            {generating ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin .8s linear infinite", display: "inline-block" }} />
                Generating…
              </span>
            ) : user ? "⚡ Generate Video" : "Sign In to Generate"}
          </button>
          {!user && <p style={{ fontSize: 11, color: "#2D3748", textAlign: "center", margin: 0 }}>Free to try · No card required</p>}
        </aside>

        {/* ═══ ZONE 4: META PANEL ═══ */}
        <aside style={{
          width: metaOpen ? 230 : 36, flexShrink: 0, overflow: "hidden",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.008)",
          transition: "width 0.25s ease", display: "flex", flexDirection: "column",
        }}>
          <button onClick={() => setMetaOpen(m => !m)} style={{ height: 50, border: "none", background: "transparent", cursor: "pointer", color: "#2D3748", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {metaOpen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {metaOpen && (
            <div style={{ flex: 1, padding: "0 12px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Generation config */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Config</div>
                {[
                  ["Model",    model.displayName],
                  ["Mode",     frameMode.replace(/_/g, " ")],
                  ["Duration", `${duration}s`],
                  ["Ratio",    ar],
                  ["Quality",  quality === "pro" ? "Pro" : "Standard"],
                  ["Credits",  `~${credits}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}>
                    <span style={{ fontSize: 11, color: "#1E293B" }}>{k}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", textTransform: "capitalize" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Last prompt */}
              {activeVideo && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Last Prompt</div>
                  <div style={{ padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#334155", lineHeight: 1.6, marginBottom: 8 }}>
                    {activeVideo.prompt || "—"}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(activeVideo.prompt); setPCopied(true); setTimeout(() => setPCopied(false), 1500); }}
                    style={{ width: "100%", padding: "6px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: pCopied ? "#0EA5A0" : "#334155", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    {pCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy Prompt</>}
                  </button>
                </div>
              )}

              {/* Status */}
              {activeVideo && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Status</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: activeVideo.status === "done" ? "#10B981" : activeVideo.status === "error" ? "#EF4444" : "#F59E0B", boxShadow: `0 0 6px ${activeVideo.status === "done" ? "#10B981" : activeVideo.status === "error" ? "#EF4444" : "#F59E0B"}` }} />
                    <span style={{ fontSize: 12, color: "#334155", textTransform: "capitalize" }}>{activeVideo.status}</span>
                  </div>
                  {activeVideo.status === "done" && activeVideo.url && (
                    <a href={activeVideo.url} download style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(14,165,160,0.2)", background: "rgba(14,165,160,0.07)", color: "#0EA5A0", fontSize: 11, textDecoration: "none", fontWeight: 700 }}>
                      <Download size={11} /> Download
                    </a>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Model Caps</div>
                {([
                  ["Text→Video",    caps.textToVideo],
                  ["Image→Video",   caps.imageToVideo],
                  ["Start+End",     caps.endFrame],
                  ["Extend",        caps.extendVideo],
                  ["Lip Sync",      caps.lipSync],
                  ["Camera Ctrl",   caps.cameraControl],
                  ["Pro Mode",      caps.proMode],
                ] as [string, boolean][]).map(([label, flag]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ fontSize: 10, color: "#1E293B" }}>{label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: flag ? "#0EA5A0" : "#1E293B" }}>{flag ? "✓" : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ════════ ZONE 5: BOTTOM VIDEO LIBRARY ════════ */}
      {videos.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.008)" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
              Generated Videos <span style={{ color: "#2D3748", fontWeight: 400 }}>({videos.length})</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12} /></button>
              <span style={{ fontSize: 11, color: "#334155", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <input type="range" min={50} max={150} value={Math.round(zoom * 100)} onChange={e => setZoom(+e.target.value / 100)} style={{ width: 80, accentColor: "#0EA5A0", cursor: "pointer" }} />
              <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12} /></button>
            </div>
          </div>
          {/* Strip */}
          <div style={{ display: "flex", gap: 12, padding: "14px 20px", overflowX: "auto" }}>
            {videos.map(v => <VideoCard key={v.id} video={v} zoom={zoom} onExtend={handleExtend} />)}
          </div>
        </div>
      )}

      {/* Auth modal */}
      {authModal && (
        <Suspense fallback={null}>
          <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />
        </Suspense>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page export — Suspense required for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────
export default function VideoStudioPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#060D1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(14,165,160,0.2)", borderTopColor: "#0EA5A0", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <VideoStudioContent />
    </Suspense>
  );
}
