"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoCanvas — Main centre workspace panel
// Modes: text_to_video | start_frame | start_end | extend | lip_sync | motion_control
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";
import type { FrameMode, ImageSlot, AudioSlot } from "./types";
import VideoEmptyStateMascot from "./VideoEmptyStateMascot";

// ── AR helpers ────────────────────────────────────────────────────────────────

function arToRatio(ar: string): string {
  if (ar === "9:16") return "9 / 16";
  if (ar === "1:1")  return "1 / 1";
  return "16 / 9";
}

function arMaxW(ar: string): string {
  if (ar === "9:16") return "340px";
  if (ar === "1:1")  return "420px";
  return "100%";
}

// ── Corner accents ────────────────────────────────────────────────────────────

function CornerAccents() {
  const s: React.CSSProperties = {
    position: "absolute", width: 18, height: 18, pointerEvents: "none",
  };
  const line = "1.5px solid rgba(34,211,238,0.35)";
  return (
    <>
      <div style={{ ...s, top: 8, left: 8, borderTop: line, borderLeft: line, borderTopLeftRadius: 4 }} />
      <div style={{ ...s, top: 8, right: 8, borderTop: line, borderRight: line, borderTopRightRadius: 4 }} />
      <div style={{ ...s, bottom: 8, left: 8, borderBottom: line, borderLeft: line, borderBottomLeftRadius: 4 }} />
      <div style={{ ...s, bottom: 8, right: 8, borderBottom: line, borderRight: line, borderBottomRightRadius: 4 }} />
    </>
  );
}

// ── Transition indicator ──────────────────────────────────────────────────────

function TransitionIndicator() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 4, flexShrink: 0, padding: "0 6px", zIndex: 2,
    }}>
      <div style={{ width: 1, height: 20, background: "linear-gradient(to bottom, transparent, rgba(34,211,238,0.3))" }} />
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: "1px solid rgba(34,211,238,0.25)",
        background: "rgba(14,165,160,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulseArrow 2s ease-in-out infinite",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
        </svg>
      </div>
      <div style={{ width: 1, height: 20, background: "linear-gradient(to top, transparent, rgba(34,211,238,0.3))" }} />
      <style>{`@keyframes pulseArrow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }`}</style>
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  slot: ImageSlot;
  label: string;
  aspectRatio: string;
  onUpload: (s: ImageSlot) => void;
  hint?: string;
}

function UploadZone({ slot, label, aspectRatio, onUpload, hint }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      onUpload({ url: URL.createObjectURL(file), preview, name: file.name });
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUpload({ url: null, preview: null });
    if (inputRef.current) inputRef.current.value = "";
  }, [onUpload]);

  const hasImage = !!slot.preview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center" }}>
        {label}
      </div>
      <div
        onClick={() => !hasImage && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        style={{
          position: "relative",
          aspectRatio: arToRatio(aspectRatio),
          borderRadius: 10,
          border: dragging ? "1.5px dashed rgba(34,211,238,0.6)" : hasImage ? "1px solid rgba(34,211,238,0.2)" : "1.5px dashed rgba(255,255,255,0.1)",
          background: hasImage ? "transparent" : dragging ? "rgba(14,165,160,0.06)" : "rgba(255,255,255,0.015)",
          overflow: "hidden",
          cursor: hasImage ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {hasImage ? (
          <>
            <img src={slot.preview!} alt="Uploaded" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {/* Hover controls */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(2,6,23,0)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                padding: "0 0 8px", opacity: 0, transition: "opacity 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0.55)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0)"; }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(14,165,160,0.9)", border: "none", color: "#020617", cursor: "pointer" }}>
                  Replace
                </button>
                <button onClick={handleRemove}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(100,116,139,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.4 }}>
              {hint || "Drop image or click"}
            </div>
          </div>
        )}
        {!hasImage && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(14,165,160,0.15)", border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 4, padding: "1px 5px",
            fontSize: 9, fontWeight: 700, color: "#22D3EE", letterSpacing: "0.05em",
          }}>
            {aspectRatio}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} style={{ display: "none" }} />
      </div>
    </div>
  );
}

// ── Video upload zone (Motion Control) ───────────────────────────────────────

interface VideoUploadZoneProps {
  label: string;
  aspectRatio: string;
  videoUrl: string | null;
  videoName: string | null;
  onUpload: (url: string, name: string, dur: number) => void;
  onRemove: () => void;
  maxDuration?: number;
}

function VideoUploadZone({ label, aspectRatio, videoUrl, videoName, onUpload, onRemove, maxDuration = 30 }: VideoUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.onloadedmetadata = () => {
      if (vid.duration < 3)           { setError("Video must be ≥ 3 seconds"); URL.revokeObjectURL(url); return; }
      if (vid.duration > maxDuration) { setError(`Max ${maxDuration}s allowed`); URL.revokeObjectURL(url); return; }
      onUpload(url, file.name, vid.duration);
    };
    vid.onerror = () => setError("Could not read video file");
    vid.src = url;
  }, [onUpload, maxDuration]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center" }}>
        {label}
      </div>
      <div
        onClick={() => !videoUrl && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("video/")) processFile(f); }}
        style={{
          position: "relative",
          aspectRatio: arToRatio(aspectRatio),
          borderRadius: 10,
          border: dragging ? "1.5px dashed rgba(34,211,238,0.6)" : videoUrl ? "1px solid rgba(34,211,238,0.2)" : "1.5px dashed rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.015)",
          overflow: "hidden",
          cursor: videoUrl ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {videoUrl ? (
          <>
            <video src={videoUrl} muted playsInline loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div
              style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,0)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 8px", opacity: 0, transition: "opacity 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0.55)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0)"; }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(14,165,160,0.9)", border: "none", color: "#020617", cursor: "pointer" }}>Replace</button>
                <button onClick={e => { e.stopPropagation(); onRemove(); }}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(100,116,139,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="3"/><path d="M9 8l7 4-7 4V8z"/>
            </svg>
            <div style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.4 }}>
              Drop video (3–{maxDuration}s)
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} style={{ display: "none" }} />
      </div>
      {error && <div style={{ fontSize: 11, color: "#EF4444", textAlign: "center" }}>{error}</div>}
      {videoName && !error && <div style={{ fontSize: 10, color: "#475569", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoName}</div>}
    </div>
  );
}

// ── Waveform bars ─────────────────────────────────────────────────────────────

function WaveformBars({ bars }: { bars: number[] }) {
  if (!bars.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 28, padding: "0 2px" }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, maxWidth: 4,
          height: `${Math.max(12, h * 100)}%`,
          background: `rgba(34,211,238,${0.3 + h * 0.5})`,
          borderRadius: 2,
        }} />
      ))}
    </div>
  );
}

// ── Audio player ──────────────────────────────────────────────────────────────

function AudioPlayer({ audio, onRemove }: { audio: AudioSlot; onRemove: () => void }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audio.url) return;
    const a = new Audio(audio.url);
    audioRef.current = a;
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onended = () => { setPlaying(false); setProgress(0); };
    return () => { a.pause(); a.src = ""; };
  }, [audio.url]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div style={{
      borderRadius: 10, border: "1px solid rgba(34,211,238,0.2)",
      background: "rgba(14,165,160,0.06)", padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={togglePlay} style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "1px solid rgba(34,211,238,0.4)",
          background: "rgba(14,165,160,0.15)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {playing
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="#22D3EE"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="#22D3EE"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
            {audio.name ?? "audio file"}
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: "#22D3EE", borderRadius: 2, transition: "width 0.1s" }} />
          </div>
        </div>
        {audio.duration != null && (
          <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>{fmt(audio.duration)}</span>
        )}
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", lineHeight: 0, padding: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Audio upload zone ─────────────────────────────────────────────────────────

function AudioUploadZone({ audio, onAudio }: { audio: AudioSlot; onAudio: (a: AudioSlot) => void }) {
  const [dragging, setDragging] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function processAudio(file: File) {
    const url = URL.createObjectURL(file);
    const a = new Audio(url);
    a.onloadedmetadata = () => {
      onAudio({ url, name: file.name, duration: a.duration });
      file.arrayBuffer().then(buf => {
        const ctx = new AudioContext();
        ctx.decodeAudioData(buf).then(decoded => {
          const data = decoded.getChannelData(0);
          const B = 40, step = Math.floor(data.length / B);
          const bars: number[] = [];
          for (let i = 0; i < B; i++) {
            let max = 0;
            for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j]));
            bars.push(Math.min(1, max * 1.5));
          }
          setWaveform(bars);
          ctx.close();
        }).catch(() => {});
      }).catch(() => {});
    };
  }

  if (audio.url) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {waveform.length > 0 && <WaveformBars bars={waveform} />}
        <AudioPlayer audio={audio} onRemove={() => { onAudio({ url: null }); setWaveform([]); }} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processAudio(f); }}
      style={{
        borderRadius: 10,
        border: dragging ? "1.5px dashed rgba(34,211,238,0.6)" : "1.5px dashed rgba(255,255,255,0.1)",
        background: dragging ? "rgba(14,165,160,0.06)" : "rgba(255,255,255,0.015)",
        padding: "20px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(100,116,139,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
      <div style={{ fontSize: 12, color: "#475569", textAlign: "center", lineHeight: 1.4 }}>
        Drop audio or click to upload<br/>
        <span style={{ fontSize: 10, color: "#334155" }}>MP3 · WAV · M4A</span>
      </div>
      <input ref={inputRef} type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0]; if (f) processAudio(f); }} style={{ display: "none" }} />
    </div>
  );
}

// ── Generating overlay ────────────────────────────────────────────────────────

function GeneratingOverlay() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(2,6,23,0.75)", backdropFilter: "blur(4px)",
      borderRadius: "inherit",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          border: "2.5px solid rgba(14,165,160,0.2)", borderTopColor: "#22D3EE",
          animation: "cvSpin 0.8s linear infinite",
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: "0 0 24px rgba(34,211,238,0.3)",
          animation: "cvPing 1.2s ease-out infinite",
        }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>Generating…</div>
        <div style={{ fontSize: 12, color: "#64748B" }}>This may take 1–2 minutes</div>
      </div>
      <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: "40%",
          background: "linear-gradient(90deg, transparent, #22D3EE, transparent)",
          animation: "cvShimmer 1.5s ease-in-out infinite", borderRadius: 2,
        }} />
      </div>
      <style>{`
        @keyframes cvSpin    { to { transform: rotate(360deg); } }
        @keyframes cvPing    { 0%,100%{opacity:0;transform:scale(1)} 50%{opacity:.3;transform:scale(1.15)} }
        @keyframes cvShimmer { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }
      `}</style>
    </div>
  );
}

// ── Extend instructions ───────────────────────────────────────────────────────

function ExtendInstructions() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "32px 24px", textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        border: "1px solid rgba(34,211,238,0.2)", background: "rgba(14,165,160,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="10" height="12" rx="2"/>
          <path d="M14 12h8"/><path d="M18 9l3 3-3 3"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 6 }}>Extend a Video</div>
        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.65, maxWidth: 260 }}>
          Generate a video first, then click <span style={{ color: "#22D3EE", fontWeight: 600 }}>Extend</span> on any result card to continue the scene seamlessly.
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  frameMode:       FrameMode;
  aspectRatio:     string;
  generating:      boolean;
  startSlot:       ImageSlot;
  endSlot:         ImageSlot;
  audioSlot:       AudioSlot;
  motionVideoUrl:  string | null;
  motionVideoName: string | null;
  onStartSlot:     (s: ImageSlot) => void;
  onEndSlot:       (s: ImageSlot) => void;
  onAudioSlot:     (a: AudioSlot) => void;
  onMotionVideo:   (url: string, name: string, dur: number) => void;
  onMotionVideoRemove: () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function VideoCanvas({
  frameMode, aspectRatio, generating,
  startSlot, endSlot, audioSlot,
  motionVideoUrl, motionVideoName,
  onStartSlot, onEndSlot, onAudioSlot, onMotionVideo, onMotionVideoRemove,
}: Props) {

  function renderContent() {
    switch (frameMode) {

      case "text_to_video":
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 280 }}>
            <VideoEmptyStateMascot />
          </div>
        );

      case "start_frame":
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 32px", width: "100%" }}>
            <div style={{ maxWidth: arMaxW(aspectRatio), width: "100%" }}>
              <UploadZone slot={startSlot} label="Start Frame" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="Upload the first frame of your video" />
            </div>
          </div>
        );

      case "start_end":
        return (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 0, padding: "16px 20px", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <UploadZone slot={startSlot} label="Start Frame" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="First frame" />
            </div>
            <TransitionIndicator />
            <div style={{ flex: 1, minWidth: 0 }}>
              <UploadZone slot={endSlot} label="End Frame" aspectRatio={aspectRatio} onUpload={onEndSlot} hint="Last frame" />
            </div>
          </div>
        );

      case "extend":
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 280 }}>
            <ExtendInstructions />
          </div>
        );

      case "lip_sync":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 32px", width: "100%" }}>
            <div style={{ maxWidth: arMaxW(aspectRatio), width: "100%", alignSelf: "center" }}>
              <UploadZone slot={startSlot} label="Character Image" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="Upload a face / portrait image" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
                Audio Track
              </div>
              <AudioUploadZone audio={audioSlot} onAudio={onAudioSlot} />
            </div>
            {!startSlot.preview && (
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "rgba(14,165,160,0.05)", border: "1px solid rgba(34,211,238,0.1)",
                fontSize: 11, color: "#64748B", lineHeight: 1.6, textAlign: "center",
              }}>
                Upload a clear face image and an audio clip to generate a lip-synced video.
              </div>
            )}
          </div>
        );

      case "motion_control":
        return (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 0, padding: "16px 20px", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <VideoUploadZone
                label="Reference Video"
                aspectRatio={aspectRatio}
                videoUrl={motionVideoUrl}
                videoName={motionVideoName}
                onUpload={onMotionVideo}
                onRemove={onMotionVideoRemove}
                maxDuration={30}
              />
            </div>
            <TransitionIndicator />
            <div style={{ flex: 1, minWidth: 0 }}>
              <UploadZone slot={startSlot} label="Character Image" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="Character to animate" />
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div style={{
      position: "relative",
      borderRadius: 16,
      border: "1px solid rgba(14,165,160,0.12)",
      background: "rgba(255,255,255,0.012)",
      boxShadow: "0 0 30px rgba(14,165,160,0.06), 0 8px 40px rgba(0,0,0,0.6)",
      display: "flex", flexDirection: "column",
      minHeight: 320,
    }}>
      {/* Inner cinematic frame border */}
      <div style={{
        position: "absolute", inset: 6, borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.04)",
        pointerEvents: "none", zIndex: 1,
      }} />

      <CornerAccents />

      <div style={{ flex: 1, display: "flex", alignItems: "stretch", justifyContent: "center", position: "relative" }}>
        {renderContent()}
        {generating && <GeneratingOverlay />}
      </div>
    </div>
  );
}
