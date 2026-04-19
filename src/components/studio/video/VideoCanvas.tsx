"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoCanvas — Main centre workspace panel
// Design system:
//   • Canvas surface: #1A1A1A (graphite, not navy)
//   • Border: 1px solid rgba(255,255,255,0.15) (premium highlight)
//   • 4-layer box-shadow glow system
//   • Inner frame: 1px dashed rgba(255,255,255,0.12)
//   • Upload zones: #1A1A1A bg, rgba(255,255,255,0.06) border
//   • 9:16 fix: portrait zones are height-constrained, not aspect-ratio-constrained
//   • Lip Sync: STACKED layout — Image (60%) on top, Audio (40%) below
//   • Audio zone: purple accent (#8B5CF6) when loaded
//   • All text: upgraded by 2–3px per design system
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect, useId } from "react";
import type { FrameMode, ImageSlot, AudioSlot } from "./types";
import VideoEmptyStateMascot from "./VideoEmptyStateMascot";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surface:      "#1A1A1A",
  borderStd:    "rgba(255,255,255,0.06)",
  borderPremium:"rgba(255,255,255,0.15)",
  borderActive: "rgba(14,165,160,0.6)",
  borderPurple: "rgba(139,92,246,0.6)",
  teal:         "#0EA5A0",
  tealGlow:     "rgba(14,165,160,0.4)",
  purple:       "#8B5CF6",
  purpleGlow:   "rgba(139,92,246,0.3)",
  textPrimary:  "#F8FAFC",
  textSec:      "#CBD5F5",
  textMuted:    "#94A3B8",
  textFaint:    "#64748B",
  danger:       "#EF4444",
} as const;

// ── Frame container glow ──────────────────────────────────────────────────────
// Applied to all zone wrapper divs. Keeps frames lifted / cinematic depth.
// Values deliberately soft — not neon.
const FRAME_GLOW: React.CSSProperties = {
  background: "radial-gradient(circle at center, rgba(14,165,160,0.08), transparent 70%)",
  boxShadow: "0 0 40px rgba(14,165,160,0.06)",
  borderRadius: 10,
};

// ── AR helpers ────────────────────────────────────────────────────────────────

function arToRatio(ar: string): string {
  if (ar === "9:16") return "9 / 16";
  if (ar === "1:1")  return "1 / 1";
  return "16 / 9";
}

function arMaxW(ar: string): string {
  if (ar === "9:16") return "240px";
  if (ar === "1:1")  return "380px";
  return "100%";
}

// ── Corner accents ────────────────────────────────────────────────────────────

function CornerAccents({ active }: { active?: boolean }) {
  const opacity = active ? 0.28 : 0.18;
  const s: React.CSSProperties = {
    position: "absolute", width: 18, height: 18, pointerEvents: "none",
    transition: "opacity 0.35s ease",
  };
  const line = `1.5px solid rgba(34,211,238,${opacity})`;
  return (
    <>
      <div style={{ ...s, top: 8, left: 8, borderTop: line, borderLeft: line, borderTopLeftRadius: 4 }} />
      <div style={{ ...s, top: 8, right: 8, borderTop: line, borderRight: line, borderTopRightRadius: 4 }} />
      <div style={{ ...s, bottom: 8, left: 8, borderBottom: line, borderLeft: line, borderBottomLeftRadius: 4 }} />
      <div style={{ ...s, bottom: 8, right: 8, borderBottom: line, borderRight: line, borderBottomRightRadius: 4 }} />
    </>
  );
}

// ── Transition indicator (Start+End mode) ─────────────────────────────────────

function TransitionIndicator() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 4, flexShrink: 0, padding: "0 6px", zIndex: 2,
    }}>
      <div style={{ width: 1, height: 20, background: "linear-gradient(to bottom, transparent, rgba(34,211,238,0.25))" }} />
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `1px solid rgba(34,211,238,0.22)`,
        background: "rgba(14,165,160,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulseArrow 2s ease-in-out infinite",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
        </svg>
      </div>
      <div style={{ width: 1, height: 20, background: "linear-gradient(to top, transparent, rgba(34,211,238,0.25))" }} />
      <style>{`@keyframes pulseArrow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }`}</style>
    </div>
  );
}

// ── Lip Sync connector (between image and audio in lip sync stacked layout) ───

function LipSyncConnector() {
  return (
    <div style={{
      height: 1,
      background: "rgba(255,255,255,0.06)",
      margin: "0 20px",
      flexShrink: 0,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        border: "1px solid rgba(139,92,246,0.3)",
        background: "#1A1A1A",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2,
        boxShadow: "0 0 10px rgba(139,92,246,0.15)",
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  slot:        ImageSlot;
  label:       string;
  aspectRatio: string;
  onUpload:    (s: ImageSlot) => void;
  hint?:       string;
  onFileRaw?:  (file: File, previewUrl: string) => void;
  /** When true the zone fills its parent container (no internal aspectRatio) */
  fillParent?: boolean;
}

function UploadZone({ slot, label, aspectRatio, onUpload, hint, onFileRaw, fillParent }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      onUpload({ url: URL.createObjectURL(file), preview, name: file.name });
      onFileRaw?.(file, preview);
    };
    reader.readAsDataURL(file);
  }, [onUpload, onFileRaw]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUpload({ url: null, preview: null });
    if (inputRef.current) inputRef.current.value = "";
  }, [onUpload]);

  const hasImage = !!slot.preview;

  const zoneBorder = dragging
    ? `1.5px dashed ${T.borderActive}`
    : hasImage
    ? `1px solid ${T.borderActive}`
    : `1.5px dashed ${T.borderStd}`;

  const zoneStyle: React.CSSProperties = fillParent
    ? { width: "100%", flex: 1, minHeight: 0, borderRadius: 10, border: zoneBorder,
        background: hasImage ? "transparent" : dragging ? "rgba(14,165,160,0.04)" : T.surface,
        overflow: "hidden", cursor: hasImage ? "default" : "pointer", transition: "all 0.2s ease",
        position: "relative" }
    : { position: "relative", aspectRatio: arToRatio(aspectRatio), borderRadius: 10,
        border: zoneBorder,
        background: hasImage ? "transparent" : dragging ? "rgba(14,165,160,0.04)" : T.surface,
        overflow: "hidden", cursor: hasImage ? "default" : "pointer", transition: "all 0.2s ease" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: fillParent ? 1 : undefined, height: fillParent ? "100%" : undefined }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: T.textMuted,
        letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center",
      }}>
        {label}
      </div>
      <div
        onClick={() => !hasImage && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onMouseEnter={e => {
          if (!hasImage) {
            (e.currentTarget as HTMLElement).style.borderColor = T.teal;
            (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.04)";
          }
        }}
        onMouseLeave={e => {
          if (!hasImage) {
            (e.currentTarget as HTMLElement).style.borderColor = T.borderStd;
            (e.currentTarget as HTMLElement).style.background = T.surface;
          }
        }}
        style={zoneStyle}
      >
        {hasImage ? (
          <>
            <img
              src={slot.preview!}
              alt="Uploaded"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: T.surface }}
            />
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(2,6,23,0)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                padding: "0 0 8px", opacity: 0, transition: "opacity 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
                (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0.55)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.opacity = "0";
                (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0)";
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: "rgba(14,165,160,0.9)", border: "none", color: "#020617", cursor: "pointer" }}>
                  Replace
                </button>
                <button onClick={handleRemove}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div style={{ fontSize: 14, color: T.textMuted, textAlign: "center", lineHeight: 1.5, padding: "0 12px" }}>
              {hint || "Drop image or click to upload"}
            </div>
          </div>
        )}
        {!hasImage && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(14,165,160,0.12)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 4, padding: "1px 6px",
            fontSize: 10, fontWeight: 700, color: "#22D3EE", letterSpacing: "0.05em",
          }}>
            {aspectRatio}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          style={{ display: "none" }} />
      </div>
    </div>
  );
}

// ── Video upload zone (Motion Control) ───────────────────────────────────────

interface VideoUploadZoneProps {
  label:       string;
  aspectRatio: string;
  videoUrl:    string | null;
  videoName:   string | null;
  onUpload:    (url: string, name: string, dur: number) => void;
  onRemove:    () => void;
  maxDuration?: number;
  /** When true, the zone fills its parent container (no internal aspectRatio) */
  fillParent?: boolean;
}

function VideoUploadZone({
  label, aspectRatio, videoUrl, videoName, onUpload, onRemove, maxDuration = 30, fillParent,
}: VideoUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState<string | null>(null);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: fillParent ? undefined : 1, height: fillParent ? "100%" : undefined }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>
        {label}
      </div>
      <div
        onClick={() => !videoUrl && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("video/")) processFile(f); }}
        onMouseEnter={e => {
          if (!videoUrl) {
            (e.currentTarget as HTMLElement).style.borderColor = T.teal;
            (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.04)";
          }
        }}
        onMouseLeave={e => {
          if (!videoUrl) {
            (e.currentTarget as HTMLElement).style.borderColor = T.borderStd;
            (e.currentTarget as HTMLElement).style.background = T.surface;
          }
        }}
        style={fillParent ? {
          position: "relative",
          width: "100%",
          flex: 1,
          borderRadius: 10,
          border: dragging
            ? `1.5px dashed ${T.borderActive}`
            : videoUrl ? `1px solid ${T.borderActive}` : `1.5px dashed ${T.borderStd}`,
          background: T.surface,
          overflow: "hidden",
          cursor: videoUrl ? "default" : "pointer",
          transition: "all 0.2s ease",
        } : {
          position: "relative",
          aspectRatio: arToRatio(aspectRatio),
          borderRadius: 10,
          border: dragging
            ? `1.5px dashed ${T.borderActive}`
            : videoUrl ? `1px solid ${T.borderActive}` : `1.5px dashed ${T.borderStd}`,
          background: T.surface,
          overflow: "hidden",
          cursor: videoUrl ? "default" : "pointer",
          transition: "all 0.2s ease",
        }}
      >
        {videoUrl ? (
          <>
            <video src={videoUrl} muted playsInline loop
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div
              style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,0)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                padding: "0 0 8px", opacity: 0, transition: "opacity 0.2s" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
                (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0.55)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.opacity = "0";
                (e.currentTarget as HTMLElement).style.background = "rgba(2,6,23,0)";
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: "rgba(14,165,160,0.9)", border: "none", color: "#020617", cursor: "pointer" }}>
                  Replace
                </button>
                <button onClick={e => { e.stopPropagation(); onRemove(); }}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="3"/><path d="M9 8l7 4-7 4V8z"/>
            </svg>
            <div style={{ fontSize: 14, color: T.textMuted, textAlign: "center", lineHeight: 1.5 }}>
              Drop video (3–{maxDuration}s)
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="video/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          style={{ display: "none" }} />
      </div>
      {error && (
        <div style={{ fontSize: 13, color: T.danger, textAlign: "center" }}>{error}</div>
      )}
      {videoName && !error && (
        <div style={{ fontSize: 12, color: T.textFaint, textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {videoName}
        </div>
      )}
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
          background: `rgba(139,92,246,${0.35 + h * 0.5})`,
          borderRadius: 2,
        }} />
      ))}
    </div>
  );
}

// ── Audio player (with purple accent) ────────────────────────────────────────

function AudioPlayer({ audio, onRemove }: { audio: AudioSlot; onRemove: () => void }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audio.url) return;
    const a = new Audio(audio.url);
    audioRef.current = a;
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onended      = () => { setPlaying(false); setProgress(0); };
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
      borderRadius: 10,
      border: `1px solid ${T.borderPurple}`,
      background: "rgba(139,92,246,0.06)",
      boxShadow: `0 0 15px ${T.purpleGlow}`,
      padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 8,
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={togglePlay} style={{
          width: 34, height: 34, borderRadius: "50%",
          border: `1px solid rgba(139,92,246,0.5)`,
          background: "rgba(139,92,246,0.15)",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
          transition: "all 0.2s ease",
        }}>
          {playing
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill={T.purple}>
                <rect x="5" y="4" width="4" height="16" rx="1"/>
                <rect x="15" y="4" width="4" height="16" rx="1"/>
              </svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill={T.purple}>
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
          }
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.textSec, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
            {audio.name ?? "audio file"}
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`,
              background: T.purple, borderRadius: 2, transition: "width 0.1s" }} />
          </div>
        </div>
        {audio.duration != null && (
          <span style={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>
            {fmt(audio.duration)}
          </span>
        )}
        <button onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer",
            color: T.textFaint, lineHeight: 0, padding: 0, transition: "color 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.danger; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textFaint; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Audio upload zone ─────────────────────────────────────────────────────────

function AudioUploadZone({
  audio, onAudio, onFileRaw,
}: {
  audio:      AudioSlot;
  onAudio:    (a: AudioSlot) => void;
  onFileRaw?: (file: File, durationSeconds: number) => void;
}) {
  const [dragging,   setDragging]   = useState(false);
  const [waveform,   setWaveform]   = useState<number[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function processAudio(file: File) {
    setAudioError(null);
    const allowed = ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && ext !== "mp3" && ext !== "wav") {
      setAudioError("Only MP3 and WAV files are supported");
      return;
    }
    const url = URL.createObjectURL(file);
    const a = new Audio(url);
    a.onloadedmetadata = () => {
      if (a.duration < 3) {
        setAudioError("Audio must be at least 3 seconds");
        URL.revokeObjectURL(url);
        return;
      }
      if (a.duration > 30) {
        setAudioError("Audio must be 30 seconds or shorter");
        URL.revokeObjectURL(url);
        return;
      }
      onAudio({ url, name: file.name, duration: a.duration });
      onFileRaw?.(file, a.duration);
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
    a.onerror = () => { setAudioError("Could not read audio file"); URL.revokeObjectURL(url); };
  }

  if (audio.url) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {waveform.length > 0 && <WaveformBars bars={waveform} />}
        <AudioPlayer audio={audio} onRemove={() => { onAudio({ url: null }); setWaveform([]); setAudioError(null); }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processAudio(f); }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.5)";
          (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.04)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = audioError
            ? "rgba(239,68,68,0.4)"
            : "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.background = T.surface;
        }}
        style={{
          borderRadius: 10,
          border: dragging
            ? `1.5px dashed rgba(139,92,246,0.6)`
            : audioError
            ? `1.5px dashed rgba(239,68,68,0.4)`
            : `1.5px dashed rgba(255,255,255,0.08)`,
          background: dragging ? "rgba(139,92,246,0.04)" : T.surface,
          padding: "20px 16px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          cursor: "pointer", transition: "all 0.2s ease",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
        <div style={{ fontSize: 15, color: T.textSec, textAlign: "center", lineHeight: 1.5 }}>
          Drop audio or click to upload
        </div>
        <div style={{ fontSize: 13, color: T.textFaint }}>
          MP3 · WAV &nbsp;·&nbsp; 3–30 seconds
        </div>
        <input
          ref={inputRef} type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          onChange={e => { const f = e.target.files?.[0]; if (f) processAudio(f); }}
          style={{ display: "none" }}
        />
      </div>
      {audioError && (
        <div style={{ fontSize: 13, color: T.danger, textAlign: "center",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
          </svg>
          {audioError}
        </div>
      )}
    </div>
  );
}

// ── Generating overlay ────────────────────────────────────────────────────────

function GeneratingOverlay() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(2,6,23,0.8)", backdropFilter: "blur(6px)",
      borderRadius: "inherit",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 18,
    }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 54, height: 54, borderRadius: "50%",
          border: "2.5px solid rgba(14,165,160,0.2)",
          borderTopColor: "#22D3EE",
          animation: "cvSpin 0.8s linear infinite",
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: "0 0 24px rgba(34,211,238,0.3)",
          animation: "cvPing 1.2s ease-out infinite",
        }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>Generating…</div>
        <div style={{ fontSize: 14, color: T.textFaint }}>This may take 1–2 minutes</div>
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, padding: "32px 24px", textAlign: "center" }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        border: "1px solid rgba(34,211,238,0.2)", background: "rgba(14,165,160,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="10" height="12" rx="2"/>
          <path d="M14 12h8"/><path d="M18 9l3 3-3 3"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>
          Extend a Video
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.65, maxWidth: 260 }}>
          Generate a video first, then click{" "}
          <span style={{ color: "#22D3EE", fontWeight: 600 }}>Extend</span>
          {" "}on any result card to continue the scene seamlessly.
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  frameMode:          FrameMode;
  aspectRatio:        string;
  generating:         boolean;
  cinemaModeActive:   boolean;
  /** Whether the End Frame zone is active. When false the zone is visible but disabled. */
  endFrameEnabled?:   boolean;
  startSlot:          ImageSlot;
  endSlot:            ImageSlot;
  audioSlot:          AudioSlot;
  motionVideoUrl:     string | null;
  motionVideoName:    string | null;
  onStartSlot:        (s: ImageSlot) => void;
  onEndSlot:          (s: ImageSlot) => void;
  onAudioSlot:        (a: AudioSlot) => void;
  onMotionVideo:      (url: string, name: string, dur: number) => void;
  onMotionVideoRemove:() => void;
  onLipSyncFaceFile?: (file: File, previewUrl: string) => void;
  onLipSyncAudioFile?:(file: File, durationSeconds: number) => void;
  /** Called when user picks an image from the mascot Upload Image button */
  onMascotUpload?:    (file: File, previewUrl: string) => void;
  /** Called when user clicks Try Sample Prompt on the mascot */
  onSamplePrompt?:    () => void;
  /** Current prompt to show in mascot (from rotating cinematic bank) */
  mascotSamplePrompt?:string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function VideoCanvas({
  frameMode, aspectRatio, generating, cinemaModeActive,
  endFrameEnabled = false,
  startSlot, endSlot, audioSlot,
  motionVideoUrl, motionVideoName,
  onStartSlot, onEndSlot, onAudioSlot, onMotionVideo, onMotionVideoRemove,
  onLipSyncFaceFile, onLipSyncAudioFile,
  onMascotUpload, onSamplePrompt, mascotSamplePrompt,
}: Props) {

  // Hidden file input for mascot Upload Image button
  const mascotInputRef = useRef<HTMLInputElement>(null);
  const mascotInputId  = useId();

  // Canvas glow intensifies in cinema mode
  const canvasGlow = cinemaModeActive
    ? [
        "0 0 0 1px rgba(255,255,255,0.08)",
        "0 0 50px rgba(14,165,160,0.25)",
        "0 0 100px rgba(14,165,160,0.14)",
        "inset 0 0 20px rgba(255,255,255,0.03)",
        "0 16px 64px rgba(0,0,0,0.85)",
      ].join(", ")
    : [
        "0 0 0 1px rgba(255,255,255,0.06)",
        "0 0 40px rgba(14,165,160,0.18)",
        "0 0 80px rgba(14,165,160,0.10)",
        "inset 0 0 20px rgba(255,255,255,0.02)",
        "0 16px 64px rgba(0,0,0,0.8)",
      ].join(", ");

  function renderContent() {
    switch (frameMode) {

      case "text_to_video":
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", flex: 1 }}>
            {/* Hidden file input wired to mascot Upload Image button */}
            <input
              id={mascotInputId}
              ref={mascotInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  const previewUrl = ev.target?.result as string;
                  onStartSlot({ url: URL.createObjectURL(file), preview: previewUrl, name: file.name });
                  onMascotUpload?.(file, previewUrl);
                };
                reader.readAsDataURL(file);
                // reset so the same file can be re-picked
                e.target.value = "";
              }}
            />
            <VideoEmptyStateMascot
              onUpload={() => mascotInputRef.current?.click()}
              onSamplePrompt={onSamplePrompt}
              samplePrompt={mascotSamplePrompt}
            />
          </div>
        );

      // Start Frame = Image Reference mode.
      // When endFrameEnabled (model.capabilities.endFrame = true): show Start + End zones side-by-side.
      // When !endFrameEnabled (model only supports first-frame): show Start Frame zone only.
      // No separate "start_end" mode exists — end frame is conditional inside this mode.

      case "start_frame": {
        if (endFrameEnabled) {
          // Model supports first + last frame — show both zones
          return (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center",
              justifyContent: "center", gap: 0, padding: "16px 20px", width: "100%", height: "100%" }}>
              {aspectRatio === "9:16" ? (
                <>
                  <div style={{ height: "calc(100% - 32px)", aspectRatio: "9 / 16", display: "flex", flexDirection: "column", ...FRAME_GLOW }}>
                    <UploadZone slot={startSlot} label="Start Frame" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="First frame" fillParent />
                  </div>
                  <TransitionIndicator />
                  <div style={{ height: "calc(100% - 32px)", aspectRatio: "9 / 16", display: "flex", flexDirection: "column", ...FRAME_GLOW }}>
                    <UploadZone slot={endSlot} label="End Frame" aspectRatio={aspectRatio} onUpload={onEndSlot} hint="Last frame" fillParent />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0, ...FRAME_GLOW }}>
                    <UploadZone slot={startSlot} label="Start Frame" aspectRatio={aspectRatio} onUpload={onStartSlot} hint="First frame" />
                  </div>
                  <TransitionIndicator />
                  <div style={{ flex: 1, minWidth: 0, ...FRAME_GLOW }}>
                    <UploadZone slot={endSlot} label="End Frame" aspectRatio={aspectRatio} onUpload={onEndSlot} hint="Last frame" />
                  </div>
                </>
              )}
            </div>
          );
        }

        // Model supports only first-frame input — show Start Frame zone only
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px 32px", width: "100%", height: "100%" }}>
            {aspectRatio === "9:16" ? (
              <div style={{
                height: "calc(100% - 32px)",
                aspectRatio: "9 / 16",
                display: "flex", flexDirection: "column",
                ...FRAME_GLOW,
              }}>
                <UploadZone
                  slot={startSlot} label="Start Frame" aspectRatio={aspectRatio}
                  onUpload={onStartSlot} hint="Upload the first frame of your video"
                  fillParent
                />
              </div>
            ) : (
              <div style={{ maxWidth: arMaxW(aspectRatio), width: "100%", ...FRAME_GLOW }}>
                <UploadZone
                  slot={startSlot} label="Start Frame" aspectRatio={aspectRatio}
                  onUpload={onStartSlot} hint="Upload the first frame of your video"
                />
              </div>
            )}
          </div>
        );
      }

      case "extend":
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", flex: 1 }}>
            <ExtendInstructions />
          </div>
        );

      case "lip_sync": {
        // ── Dynamic frame sizing by aspect ratio ───────────────────────
        const lipFrameStyle: React.CSSProperties = aspectRatio === "9:16"
          ? {
              // Portrait: height-constrained so it fills vertical space
              position: "relative", zIndex: 2,
              height: "calc(100% - 28px)",
              aspectRatio: "9 / 16",
              maxWidth: "200px",
              display: "flex", flexDirection: "column",
              ...FRAME_GLOW,
            }
          : aspectRatio === "16:9"
          ? {
              // Landscape: height-constrained so it never overflows the top zone
              position: "relative", zIndex: 2,
              height: "calc(100% - 28px)",
              aspectRatio: "16 / 9",
              maxWidth: "calc(100% - 48px)",
              display: "flex", flexDirection: "column",
              ...FRAME_GLOW,
            }
          : {
              // Square: height-constrained so label stays visible
              position: "relative", zIndex: 2,
              height: "calc(100% - 28px)",
              aspectRatio: "1 / 1",
              maxWidth: "calc(100% - 48px)",
              display: "flex", flexDirection: "column",
              ...FRAME_GLOW,
            };

        return (
          // STACKED layout: Character Image (top 62%) + divider + Audio (bottom 38%)
          <div style={{
            display: "flex", flexDirection: "column",
            width: "100%", height: "100%",
            overflow: "hidden",
          }}>

            {/* ── TOP — Character image zone (62%) — cinematic backdrop ── */}
            <div style={{
              flex: "0 0 62%",
              minHeight: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {/* Cinematic blurred backdrop — image when uploaded, gradient when empty */}
              {startSlot.preview ? (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  backgroundImage: `url(${startSlot.preview})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(18px) brightness(0.28) saturate(1.2)",
                  transform: "scale(1.08)",
                }} />
              ) : (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  background: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(139,92,246,0.09) 0%, rgba(14,165,160,0.04) 50%, transparent 100%)",
                }} />
              )}
              {/* Dark vignette over backdrop */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 1,
                background: "linear-gradient(to bottom, rgba(26,26,26,0.35) 0%, transparent 30%, transparent 70%, rgba(26,26,26,0.5) 100%)",
              }} />
              {/* Frame — AR-aware, centered */}
              <div style={lipFrameStyle}>
                <UploadZone
                  slot={startSlot}
                  label="Character Image"
                  aspectRatio={aspectRatio}
                  onUpload={onStartSlot}
                  hint="Upload a clear face portrait (JPG/PNG)"
                  onFileRaw={onLipSyncFaceFile}
                  fillParent
                />
              </div>
              {/* 16:9 only: face clarity hint below the zone */}
              {aspectRatio === "16:9" && !startSlot.preview && (
                <div style={{
                  position: "absolute", bottom: 10, left: 0, right: 0,
                  zIndex: 3, textAlign: "center",
                  fontSize: 12, color: T.textFaint,
                  pointerEvents: "none",
                }}>
                  For best results, keep face clearly visible
                </div>
              )}
            </div>

            {/* ── DIVIDER ──────────────────────────────────────────────── */}
            <LipSyncConnector />

            {/* ── BOTTOM — Audio zone (38%) ────────────────────────────── */}
            <div style={{
              flex: "0 0 38%",
              flexShrink: 0,
              padding: "10px 28px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted,
                  letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Audio Track
                </div>
                <div style={{ fontSize: 12, color: T.textFaint, marginLeft: 4 }}>
                  — drives facial motion &amp; timing
                </div>
              </div>
              <AudioUploadZone audio={audioSlot} onAudio={onAudioSlot} onFileRaw={onLipSyncAudioFile} />
            </div>
          </div>
        );
      }

      case "motion_control":
        return (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center",
            justifyContent: "center", gap: 0, padding: "16px 20px", width: "100%", height: "100%" }}>
            {aspectRatio === "9:16" ? (
              <>
                {/* 9:16 — height-constrained wrappers to prevent overflow */}
                <div style={{ height: "calc(100% - 32px)", aspectRatio: "9 / 16", display: "flex", flexDirection: "column", ...FRAME_GLOW }}>
                  <VideoUploadZone
                    label="Reference Video"
                    aspectRatio={aspectRatio}
                    videoUrl={motionVideoUrl}
                    videoName={motionVideoName}
                    onUpload={onMotionVideo}
                    onRemove={onMotionVideoRemove}
                    maxDuration={30}
                    fillParent
                  />
                </div>
                <TransitionIndicator />
                <div style={{ height: "calc(100% - 32px)", aspectRatio: "9 / 16", display: "flex", flexDirection: "column", ...FRAME_GLOW }}>
                  <UploadZone slot={startSlot} label="Character Image" aspectRatio={aspectRatio}
                    onUpload={onStartSlot} hint="Character to animate" fillParent />
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0, ...FRAME_GLOW }}>
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
                <div style={{ flex: 1, minWidth: 0, ...FRAME_GLOW }}>
                  <UploadZone slot={startSlot} label="Character Image" aspectRatio={aspectRatio}
                    onUpload={onStartSlot} hint="Character to animate" />
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div style={{
      position: "relative",
      width: "100%",
      aspectRatio: "16 / 9",
      borderRadius: 14,
      border: `1px solid ${T.borderPremium}`,
      background: T.surface,
      boxShadow: canvasGlow,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      transition: "box-shadow 0.35s ease",
    }}>
      {/* Subtle radial center glow — "lit stage" effect */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 55% at 50% 48%, rgba(14,165,160,0.055) 0%, transparent 100%)",
        borderRadius: "inherit",
      }} />

      {/* Inner dashed cinematic frame */}
      <div style={{
        position: "absolute", inset: 8, borderRadius: 10,
        border: "1px dashed rgba(255,255,255,0.12)",
        pointerEvents: "none", zIndex: 1,
        transition: "border-color 0.35s ease",
        ...(cinemaModeActive ? { borderColor: "rgba(255,255,255,0.16)" } : {}),
      }} />

      <CornerAccents active={cinemaModeActive} />

      <div style={{
        flex: 1, display: "flex", alignItems: "stretch",
        justifyContent: "center", position: "relative", minHeight: 0,
        zIndex: 2,
      }}>
        {renderContent()}
        {generating && <GeneratingOverlay />}
      </div>
    </div>
  );
}
