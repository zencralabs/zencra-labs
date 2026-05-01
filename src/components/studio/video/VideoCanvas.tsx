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

import { useState, useRef, useCallback, useEffect, useId, useMemo } from "react";
import type { FrameMode, ImageSlot, AudioSlot, GeneratedVideo } from "./types";
import VideoEmptyStateMascot from "./VideoEmptyStateMascot";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { downloadAsset } from "@/lib/client/downloadAsset";

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
  borderRadius: 0,
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
      // Use the data URL for both url and preview — blob: URLs are browser-memory-only
      // and cannot be resolved server-side. The data URL (data:image/...;base64,...) is
      // transport-safe and gets normalized to raw base64 by normalizeKlingImageInput().
      const dataUrl = e.target?.result as string;
      onUpload({ url: dataUrl, preview: dataUrl, name: file.name });
      onFileRaw?.(file, dataUrl);
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
    ? { width: "100%", flex: 1, minHeight: 0, borderRadius: 0, border: zoneBorder,
        background: hasImage ? "transparent" : dragging ? "rgba(14,165,160,0.04)" : T.surface,
        overflow: "hidden", cursor: hasImage ? "default" : "pointer", transition: "all 0.2s ease",
        position: "relative" }
    : { position: "relative", aspectRatio: arToRatio(aspectRatio), borderRadius: 0,
        border: zoneBorder,
        background: hasImage ? "transparent" : dragging ? "rgba(14,165,160,0.04)" : T.surface,
        overflow: "hidden", cursor: hasImage ? "default" : "pointer", transition: "all 0.2s ease" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: fillParent ? 1 : undefined, height: fillParent ? "100%" : undefined }}>
      {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: T.textMuted,
        letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center",
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
            {/* Chip: 13px / medium 500 / tracking -0.005em */}
            <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: T.textMuted, textAlign: "center", lineHeight: 1.5, padding: "0 12px" }}>
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
            /* Micro: 11px / semibold 600 / tracking 0.12em (was 10px — below system minimum) */
            fontSize: 11, fontWeight: 600, color: "#22D3EE", letterSpacing: "0.12em",
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
      {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}>
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
            {/* Chip: 13px / medium 500 / tracking -0.005em */}
            <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: T.textMuted, textAlign: "center", lineHeight: 1.5 }}>
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
        /* Micro: 11px / semibold 600 / tracking 0.12em — filename metadata */
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: T.textFaint, textAlign: "center",
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
      borderRadius: 0,
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
          {/* Chip: 13px / semibold 600 / tracking -0.005em */}
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: T.textSec,
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
          borderRadius: 0,
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
        {/* Chip: 13px / medium 500 / tracking -0.005em */}
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: T.textSec, textAlign: "center", lineHeight: 1.5 }}>
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

// ── Generating overlay — cinematic timeline shimmer + staged messages ─────────

const TIMELINE_BARS = [0.35, 0.65, 0.45, 0.85, 0.55, 0.75, 0.40, 0.90, 0.60, 0.50, 0.80, 0.45, 0.70, 0.38, 0.88];

// Staged message thresholds (seconds elapsed)
const STAGED_MESSAGES = [
  { after: 0,  label: "Analyzing source frame…",  sub: "Reading composition and depth" },
  { after: 4,  label: "Building motion path…",    sub: "Tracking motion vectors frame by frame" },
  { after: 12, label: "Rendering final video…",   sub: "Cinematic render in progress · 1–3 min" },
] as const;

function GeneratingOverlay() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const stage = useMemo(() => {
    let current: typeof STAGED_MESSAGES[number] = STAGED_MESSAGES[0];
    for (const s of STAGED_MESSAGES) {
      if (elapsed >= s.after) current = s;
    }
    return current;
  }, [elapsed]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(2,6,23,0.82)", backdropFilter: "blur(8px)",
      borderRadius: "inherit",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 22,
    }}>
      {/* Film strip accent line — top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.35) 40%, rgba(34,211,238,0.6) 50%, rgba(34,211,238,0.35) 60%, transparent 100%)",
        animation: "cvSweep 2.4s ease-in-out infinite" }} />

      {/* Timeline motion bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
        {TIMELINE_BARS.map((h, i) => (
          <div key={i} style={{
            width: 4, borderRadius: 2,
            background: `linear-gradient(to top, rgba(14,165,160,0.5), #22D3EE)`,
            height: `${h * 100}%`,
            animation: `cvBar ${0.8 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.07).toFixed(2)}s`,
            boxShadow: "0 0 6px rgba(34,211,238,0.3)",
          }} />
        ))}
      </div>

      {/* Stage-aware label */}
      <div style={{ textAlign: "center", minHeight: 44 }}>
        {/* Studio Title: 30px / bold 700 / tracking -0.02em — note: font-display (Syne) omitted per inline-style hard rule; apply via className when refactored */}
        <div key={stage.label} style={{
          fontSize: 30, fontWeight: 700, color: T.textPrimary,
          marginBottom: 5, letterSpacing: "-0.02em",
          transition: "opacity 0.4s ease",
        }}>
          {stage.label}
        </div>
        {/* Chip: 13px / medium 500 / tracking -0.005em — color #4E6275 is semantic (dim teal) */}
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#4E6275" }}>
          {stage.sub}
        </div>
      </div>

      {/* Shimmer progress track */}
      <div style={{ width: 180, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: "45%",
          background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.8), transparent)",
          animation: "cvShimmer 1.8s ease-in-out infinite", borderRadius: 2,
        }} />
      </div>

      {/* Film strip accent line — bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, transparent 0%, rgba(14,165,160,0.25) 40%, rgba(14,165,160,0.45) 50%, rgba(14,165,160,0.25) 60%, transparent 100%)",
        animation: "cvSweep 2.4s ease-in-out infinite", animationDirection: "reverse" }} />

      <style>{`
        @keyframes cvSweep   { 0%{backgroundPosition:-200% 0} 100%{backgroundPosition:200% 0} }
        @keyframes cvBar     { from{transform:scaleY(0.55)} to{transform:scaleY(1)} }
        @keyframes cvShimmer { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }
      `}</style>
    </div>
  );
}

// ── Canvas Video Preview — cinematic player overlay ──────────────────────────

function CtrlBtn({
  title, onClick, danger, active, children,
}: {
  title: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: danger && hov
          ? "rgba(239,68,68,0.28)"
          : active
          ? "rgba(255,255,255,0.18)"
          : hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        border: danger && hov
          ? "1px solid rgba(239,68,68,0.4)"
          : "1px solid rgba(255,255,255,0.1)",
        color: danger && hov ? "#EF4444" : "#CBD5F5",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function CanvasVideoPreview({
  video,
  isFavorite = false,
  onClose,
  onFullscreen,
  onFavoriteToggle,
  onDownload,
  onCopyPrompt,
  onDelete,
  onCancel,
  onSetStartFrame,
  onSetEndFrame,
  onReuse,
}: {
  video:             GeneratedVideo;
  isFavorite?:       boolean;
  onClose?:          () => void;
  onFullscreen?:     (v: GeneratedVideo) => void;
  onFavoriteToggle?: () => void;
  onDownload?:       () => void;
  onCopyPrompt?:     () => void;
  onDelete?:         () => void;
  onCancel?:         () => void;
  onSetStartFrame?:  () => void;
  onSetEndFrame?:    () => void;
  onReuse?:          () => void;
}) {
  const [closing,          setClosing]          = useState(false);
  const [elapsed,          setElapsed]          = useState(0);
  const [playing,          setPlaying]          = useState(false);
  const [vol,              setVol]              = useState(0.7);
  const [muted,            setMuted]            = useState(false);
  const [showVolSlider,    setShowVolSlider]    = useState(false);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [promptCopied,     setPromptCopied]     = useState(false);
  const [favPulse,         setFavPulse]         = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const volLeaveId = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick elapsed seconds while waiting
  useEffect(() => {
    if (video.status !== "generating" && video.status !== "polling") return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [video.status]);

  // Autoplay when done + apply initial volume
  useEffect(() => {
    if (video.status === "done" && video.url && videoRef.current) {
      const v = videoRef.current;
      v.volume = vol;
      v.muted  = muted;
      v.play().catch(() => {});
    }
  }, [video.status, video.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep volume in sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted  = muted;
    }
  }, [vol, muted]);

  // Sync playing state from native video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play",  onPlay);
    v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, [video.status]); // re-attach when video el is recreated

  const stage = useMemo(() => {
    let cur: typeof STAGED_MESSAGES[number] = STAGED_MESSAGES[0];
    for (const s of STAGED_MESSAGES) { if (elapsed >= s.after) cur = s; }
    return cur;
  }, [elapsed]);

  const handleClose = () => { setClosing(true); setTimeout(() => onClose?.(), 360); };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play().catch(() => {});
  };

  const handleVolEnter = () => {
    if (volLeaveId.current) clearTimeout(volLeaveId.current);
    setShowVolSlider(true);
  };
  const handleVolLeave = () => {
    volLeaveId.current = setTimeout(() => setShowVolSlider(false), 500);
  };

  const handleDownload = () => {
    if (!video.url) return;
    downloadAsset(video.url, `zencra-${video.id}.mp4`);
    onDownload?.();
  };

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(video.prompt); } catch { /* ignore */ }
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
    onCopyPrompt?.();
  };

  const handleFavourite = () => {
    setFavPulse(true);
    setTimeout(() => setFavPulse(false), 350);
    onFavoriteToggle?.();
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try { await onDelete?.(); } catch { /* ignore */ }
    setDeleting(false);
    setShowDeleteModal(false);
    handleClose();
  };

  const handleCancel = () => {
    onCancel?.();
    handleClose();
  };

  const isGenerating = video.status === "generating" || video.status === "polling";
  const isDone       = video.status === "done" && !!video.url;
  const isError      = video.status === "error";
  const canCancel    = isGenerating && !!video.taskId;

  const volIcon = muted || vol === 0
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
    : vol < 0.5
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;

  return (
    <>
      <DeleteConfirmModal
        open={showDeleteModal}
        title="Delete this video?"
        description="The video will be permanently removed from your library. This cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
        loading={deleting}
      />

      <div style={{
        position: "absolute", inset: 0, zIndex: 30,
        borderRadius: "inherit", overflow: "hidden",
        background: isDone ? "#000" : "rgba(2,6,23,0.92)",
        backdropFilter: isGenerating ? "blur(8px)" : "none",
        transform: closing ? "translateY(56px)" : "translateY(0)",
        opacity:   closing ? 0 : 1,
        transition: "transform 0.36s cubic-bezier(0.4,0,0.2,1), opacity 0.34s ease",
      }}>

        {/* ── Close button (top-right) ───────────────────────────────────── */}
        <button
          onClick={handleClose}
          title="Close preview"
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 50,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(10,15,30,0.85)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#E2E8F0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.8)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.4)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(10,15,30,0.85)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* ── Generating / polling state ──────────────────────────────────── */}
        {isGenerating && (
          <>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg,transparent 0%,rgba(34,211,238,0.35) 40%,rgba(34,211,238,0.6) 50%,rgba(34,211,238,0.35) 60%,transparent 100%)",
              animation: "cpSweep 2.4s ease-in-out infinite",
            }} />

            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 22, padding: "0 36px 48px",
              textAlign: "center",
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
                {TIMELINE_BARS.map((h, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: "linear-gradient(to top,rgba(14,165,160,0.5),#22D3EE)",
                    height: `${h * 100}%`,
                    animation: `cvBar ${0.8 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
                    animationDelay: `${(i * 0.07).toFixed(2)}s`,
                    boxShadow: "0 0 6px rgba(34,211,238,0.3)",
                  }} />
                ))}
              </div>

              <div>
                {/* Studio Title: 30px / bold 700 / tracking -0.02em */}
                <div key={stage.label} style={{ fontSize: 30, fontWeight: 700, color: T.textPrimary, marginBottom: 6, letterSpacing: "-0.02em" }}>
                  {stage.label}
                </div>
                {/* Chip: 13px / medium 500 / tracking -0.005em — color semantic */}
                <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#4E6275" }}>{stage.sub}</div>
              </div>

              {video.prompt && (
                // Chip: 13px / medium 500 / tracking -0.005em — color #3A4F62 is semantic
                <div style={{
                  maxWidth: 340, fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
                  color: "#3A4F62", lineHeight: 1.6, fontStyle: "italic",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  &ldquo;{video.prompt}&rdquo;
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ padding: "3px 9px", borderRadius: 6, background: "rgba(14,165,160,0.1)", border: "1px solid rgba(34,211,238,0.2)", fontSize: 11, fontWeight: 600, color: "#22D3EE" }}>{video.modelName}</div>
                <div style={{ padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, fontWeight: 600, color: "#64748B" }}>{video.duration}s · {video.aspectRatio}</div>
              </div>

              <div style={{ width: 200, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "45%", borderRadius: 2, background: "linear-gradient(90deg,transparent,rgba(34,211,238,0.8),transparent)", animation: "cvShimmer 1.8s ease-in-out infinite" }} />
              </div>
            </div>

            {/* Cancel button — only when task can be cancelled */}
            {canCancel && (
              <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: "6px 18px", borderRadius: 20,
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                    /* Chip: 13px / semibold 600 / tracking -0.005em — color #F87171 is semantic (error red) */
                    color: "#F87171", fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.22)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"; }}
                >
                  Cancel generation
                </button>
              </div>
            )}

            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg,transparent 0%,rgba(14,165,160,0.25) 40%,rgba(14,165,160,0.45) 50%,rgba(14,165,160,0.25) 60%,transparent 100%)",
              animation: "cpSweep 2.4s ease-in-out infinite", animationDirection: "reverse",
            }} />
            <style>{`@keyframes cpSweep{0%{backgroundPosition:-200% 0}100%{backgroundPosition:200% 0}}`}</style>
          </>
        )}

        {/* ── Done state — cinematic player ───────────────────────────────── */}
        {isDone && (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>

            <video
              ref={videoRef}
              src={video.url!}
              loop playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }}
            />

            {/* READY badge — top-left (sits behind close btn) */}
            <div style={{
              position: "absolute", top: 12, left: 12,
              padding: "3px 10px", borderRadius: 5,
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.22)",
              /* Micro: 11px / semibold 600 / tracking 0.12em (was 10px — below system minimum) */
              fontSize: 11, fontWeight: 600, color: "#34D399", letterSpacing: "0.12em",
              pointerEvents: "none",
            }}>
              READY
            </div>

            {/* ── BOTTOM OVERLAY: left=metadata, right=controls ───────── */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, rgba(2,6,23,0.97) 0%, rgba(2,6,23,0.78) 50%, transparent 100%)",
              padding: "56px 14px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>

                {/* LEFT: Prompt + metadata */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {video.prompt && (
                    <div style={{
                      /* Chip: 13px / medium 500 / tracking -0.005em — color #64748B is semantic */
                      fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B", lineHeight: 1.55, marginBottom: 5,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {video.prompt}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#22D3EE", fontWeight: 600 }}>{video.modelName}</span>
                    <span style={{ fontSize: 11, color: "#2D3A4A" }}>·</span>
                    <span style={{ fontSize: 11, color: "#4E6275" }}>{video.duration}s</span>
                    <span style={{ fontSize: 11, color: "#2D3A4A" }}>·</span>
                    <span style={{ fontSize: 11, color: "#4E6275" }}>{video.aspectRatio}</span>
                    {video.creditsUsed > 0 && (
                      <>
                        <span style={{ fontSize: 11, color: "#2D3A4A" }}>·</span>
                        <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          {video.creditsUsed}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT: 3-group control bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

                  {/* ── Group 1: Playback ── */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

                    <CtrlBtn title={playing ? "Pause" : "Play"} onClick={togglePlay}>
                      {playing
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      }
                    </CtrlBtn>

                    {/* Volume — hover fades in slider */}
                    <div
                      style={{ display: "flex", alignItems: "center" }}
                      onMouseEnter={handleVolEnter}
                      onMouseLeave={handleVolLeave}
                    >
                      <CtrlBtn title={muted ? "Unmute" : "Mute"} onClick={() => setMuted(m => !m)}>
                        {volIcon}
                      </CtrlBtn>
                      <div style={{
                        width: showVolSlider ? 72 : 0,
                        opacity: showVolSlider ? 1 : 0,
                        overflow: "hidden",
                        transition: "width 0.25s ease, opacity 0.25s ease",
                        display: "flex", alignItems: "center",
                      }}>
                        <input
                          type="range"
                          min={0} max={1} step={0.05}
                          value={muted ? 0 : vol}
                          onChange={e => { setVol(Number(e.target.value)); setMuted(false); }}
                          style={{
                            width: 68, height: 3, cursor: "pointer",
                            accentColor: "#0EA5A0", display: "block",
                            marginLeft: 4,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                  {/* ── Group 2: Content ── */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

                    {/* Favourite — scale bump animation */}
                    <button
                      onClick={handleFavourite}
                      title={isFavorite ? "Remove from favourites" : "Add to favourites"}
                      style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: isFavorite ? "rgba(239,68,68,0.16)" : "rgba(255,255,255,0.06)",
                        border: isFavorite ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: favPulse ? "favBump 0.38s cubic-bezier(0.36,0.07,0.19,0.97)" : "none",
                        transition: "background 0.18s, border-color 0.18s",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24"
                        fill={isFavorite ? "#EF4444" : "none"}
                        stroke={isFavorite ? "#EF4444" : "#94A3B8"}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: "fill 0.18s, stroke 0.18s" }}
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>

                    {/* Reuse prompt */}
                    {onReuse && (
                      <button
                        onClick={onReuse}
                        title="Reuse prompt"
                        style={{
                          height: 26, padding: "0 8px", borderRadius: 4, flexShrink: 0,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          /* Micro: 11px / semibold 600 / tracking 0.12em (was 10px — below system minimum) */
                          color: "#94A3B8", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4,
                          letterSpacing: "0.12em", whiteSpace: "nowrap",
                          transition: "background 0.15s, color 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#E2E8F0"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.33"/></svg>
                        Reuse
                      </button>
                    )}

                    {/* Set as Start Frame */}
                    {onSetStartFrame && (
                      <button
                        onClick={onSetStartFrame}
                        title="Use as Start Frame"
                        style={{
                          height: 26, padding: "0 8px", borderRadius: 4, flexShrink: 0,
                          background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)",
                          /* Micro: 11px / semibold 600 / tracking 0.12em — color #22D3EE is semantic (teal) */
                          color: "#22D3EE", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          letterSpacing: "0.12em", whiteSpace: "nowrap",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.18)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.08)"; }}
                      >
                        ↑ START
                      </button>
                    )}

                    {/* Set as End Frame */}
                    {onSetEndFrame && (
                      <button
                        onClick={onSetEndFrame}
                        title="Use as End Frame"
                        style={{
                          height: 26, padding: "0 8px", borderRadius: 4, flexShrink: 0,
                          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)",
                          /* Micro: 11px / semibold 600 / tracking 0.12em — color #A78BFA is semantic (purple) */
                          color: "#A78BFA", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          letterSpacing: "0.12em", whiteSpace: "nowrap",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.18)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.08)"; }}
                      >
                        ↑ END
                      </button>
                    )}

                    {/* Download */}
                    <CtrlBtn title="Download video" onClick={handleDownload}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </CtrlBtn>

                    {/* Copy prompt */}
                    <CtrlBtn title={promptCopied ? "Copied!" : "Copy prompt"} onClick={handleCopyPrompt} active={promptCopied}>
                      {promptCopied
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      }
                    </CtrlBtn>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                  {/* ── Group 3: Actions ── */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <CtrlBtn title="Open fullscreen" onClick={() => onFullscreen?.(video)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                    </CtrlBtn>
                    <CtrlBtn title="Delete video" danger onClick={() => setShowDeleteModal(true)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </CtrlBtn>
                  </div>

                </div>{/* /control groups */}
              </div>{/* /bottom row */}
            </div>{/* /bottom overlay */}

            <style>{`@keyframes favBump{0%{transform:scale(1)}30%{transform:scale(0.88)}65%{transform:scale(1.22)}100%{transform:scale(1)}}`}</style>
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {isError && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 14,
            padding: "0 36px", textAlign: "center",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F87171" }}>Generation failed</div>
            <div style={{ fontSize: 13, color: "#4E6275", lineHeight: 1.5 }}>{video.error ?? "Please try again"}</div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Motion Flow strip — contextual cinematic workflow indicator ────────────────

export function MotionFlowStrip({ frameMode, endFrameEnabled, hasStartSlot, hasEndSlot }: {
  frameMode:      FrameMode;
  endFrameEnabled?: boolean;
  hasStartSlot?:  boolean;
  hasEndSlot?:    boolean;
}) {
  type PillDef = { label: string; dim?: boolean };

  let pills: PillDef[];

  if (frameMode === "start_frame" && endFrameEnabled) {
    pills = [
      { label: "Start Frame", dim: !hasStartSlot },
      { label: "Motion Path" },
      { label: "End Frame", dim: !hasEndSlot },
    ];
  } else if (frameMode === "start_frame") {
    pills = [
      { label: "Source Frame", dim: !hasStartSlot },
      { label: "Motion Path" },
      { label: "Output" },
    ];
  } else if (frameMode === "motion_control") {
    pills = [
      { label: "Subject" },
      { label: "Motion Reference" },
      { label: "Output" },
    ];
  } else if (frameMode === "extend") {
    pills = [
      { label: "Source Clip" },
      { label: "Extend" },
      { label: "Output" },
    ];
  } else if (frameMode === "lip_sync") {
    pills = [
      { label: "Face" },
      { label: "Audio" },
      { label: "Output" },
    ];
  } else {
    // text_to_video
    pills = [
      { label: "Prompt" },
      { label: "Motion" },
      { label: "Output" },
    ];
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
      paddingBottom: 10,
    }}>
      {pills.map((p, i) => (
        <div key={p.label} style={{ display: "flex", alignItems: "center" }}>
          {/* Connector line */}
          {i > 0 && (
            <div style={{
              width: 28, height: 1,
              background: "linear-gradient(90deg, rgba(14,165,160,0.15), rgba(34,211,238,0.35), rgba(14,165,160,0.15))",
              flexShrink: 0,
            }}>
              <svg width="28" height="8" viewBox="0 0 28 8"
                style={{ display: "block", marginTop: -4 }}>
                <path d="M0 4 L22 4 L18 2 M22 4 L18 6"
                  stroke="rgba(34,211,238,0.3)" strokeWidth="1"
                  fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          )}
          {/* Pill */}
          <div style={{
            padding: "3px 10px", borderRadius: 20,
            background: p.dim
              ? "rgba(255,255,255,0.02)"
              : "rgba(14,165,160,0.08)",
            border: p.dim
              ? "1px solid rgba(255,255,255,0.06)"
              : "1px solid rgba(34,211,238,0.2)",
            fontSize: 11, fontWeight: 600,
            color: p.dim ? "#2D3A4A" : "#22D3EE",
            letterSpacing: "0.02em",
            transition: "all 0.3s ease",
            whiteSpace: "nowrap",
          }}>
            {p.label}
          </div>
        </div>
      ))}
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
        {/* Studio Title: 30px / bold 700 / tracking -0.02em */}
        <div style={{ fontSize: 30, fontWeight: 700, color: T.textPrimary, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Extend a Video
        </div>
        {/* Body: 16px / leading 1.65 — color T.textMuted is semantic */}
        <div style={{ fontSize: 16, color: T.textMuted, lineHeight: 1.65, maxWidth: 260 }}>
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
  /** Which model family to preview in the empty state showcase */
  previewKey?:         string;
  // ── Canvas Preview (Layer 1) ──────────────────────────────────────────────
  /** When set, shows a canvas-level generating/playback overlay above everything */
  previewVideo?:          GeneratedVideo | null;
  /** Clear the canvas preview (called by close button with slide-down animation) */
  onClosePreview?:        () => void;
  /** Open fullscreen viewer from the canvas preview "expand" button */
  onOpenFullscreen?:      (v: GeneratedVideo) => void;
  // ── Cinematic player callbacks ─────────────────────────────────────────────
  previewIsFavorite?:     boolean;
  onPreviewFavToggle?:    () => void;
  onPreviewDownload?:     () => void;
  onPreviewCopyPrompt?:   () => void;
  onPreviewDelete?:       () => void;
  onPreviewCancel?:       () => void;
  onPreviewSetStartFrame?:() => void;
  onPreviewSetEndFrame?:  () => void;
  onPreviewReuse?:        () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function VideoCanvas({
  frameMode, aspectRatio, generating, cinemaModeActive,
  endFrameEnabled = false,
  startSlot, endSlot, audioSlot,
  motionVideoUrl, motionVideoName,
  onStartSlot, onEndSlot, onAudioSlot, onMotionVideo, onMotionVideoRemove,
  onLipSyncFaceFile, onLipSyncAudioFile,
  onMascotUpload, onSamplePrompt, mascotSamplePrompt, previewKey,
  previewVideo, onClosePreview, onOpenFullscreen,
  previewIsFavorite,
  onPreviewFavToggle,
  onPreviewDownload,
  onPreviewCopyPrompt,
  onPreviewDelete,
  onPreviewCancel,
  onPreviewSetStartFrame,
  onPreviewSetEndFrame,
  onPreviewReuse,
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
                  // Use data URL for url — blob: URLs are browser-memory-only and
                  // cannot be resolved server-side. normalizeKlingImageInput() strips
                  // the data: prefix on the backend before sending to Kling.
                  const dataUrl = ev.target?.result as string;
                  onStartSlot({ url: dataUrl, preview: dataUrl, name: file.name });
                  onMascotUpload?.(file, dataUrl);
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
              previewKey={previewKey}
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

        // Model supports only first-frame input — show Source Frame zone only
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
                  slot={startSlot} label="Source Frame" aspectRatio={aspectRatio}
                  onUpload={onStartSlot} hint="Upload the image to animate"
                  fillParent
                />
              </div>
            ) : (
              <div style={{ maxWidth: arMaxW(aspectRatio), width: "100%", ...FRAME_GLOW }}>
                <UploadZone
                  slot={startSlot} label="Source Frame" aspectRatio={aspectRatio}
                  onUpload={onStartSlot} hint="Upload the image to animate"
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
      borderRadius: 0,
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
        position: "absolute", inset: 8, borderRadius: 0,
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
        {/* Standard generating overlay — only when no canvas preview is active */}
        {generating && !previewVideo && <GeneratingOverlay />}
        {/* Canvas preview overlay — covers generate state AND done playback */}
        {previewVideo && (
          <CanvasVideoPreview
            video={previewVideo}
            isFavorite={previewIsFavorite}
            onClose={onClosePreview}
            onFullscreen={onOpenFullscreen}
            onFavoriteToggle={onPreviewFavToggle}
            onDownload={onPreviewDownload}
            onCopyPrompt={onPreviewCopyPrompt}
            onDelete={onPreviewDelete}
            onCancel={onPreviewCancel}
            onSetStartFrame={onPreviewSetStartFrame}
            onSetEndFrame={onPreviewSetEndFrame}
            onReuse={onPreviewReuse}
          />
        )}
      </div>
    </div>
  );
}
