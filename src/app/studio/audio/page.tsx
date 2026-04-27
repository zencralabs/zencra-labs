"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { useFlowStore } from "@/lib/flow/store";

import { createWorkflow, addWorkflowStep } from "@/lib/flow/actions";
import FlowBar from "@/components/studio/flow/FlowBar";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA AUDIO STUDIO
// Design system: mirrors Video Studio · base #020617 · lime #C6FF00
// Motion layer: AudioAmbientLayer · WaveformBars · AudioPulseIcon
// ─────────────────────────────────────────────────────────────────────────────

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT      = "#C6FF00";
const ACCENT_D    = "#9FD600";
const BASE        = "#020617";
const SIDE_GUTTER = 20;
const GLOW_SM     = "0 0 12px rgba(198,255,0,0.18)";
const GLOW_MD     = "0 0 24px rgba(198,255,0,0.28)";
const GLOW_LG     = "0 0 40px rgba(198,255,0,0.40)";

// ── Wave state type ────────────────────────────────────────────────────────────
type WaveState = "idle" | "hover" | "playing" | "generating";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedAudio {
  id: string;
  url: string | null;
  prompt: string;
  tool: string;
  voiceId: string;
  quality: string;
  status: "generating" | "done" | "error";
  error?: string;
  durationMs?: number;
}

type AudioQuality = "standard" | "studio";

interface AudioTool {
  id: string;
  label: string;
  description: string;
  badge: string | null;
  badgeColor: string | null;
  available: boolean;
  provider: "elevenlabs" | "kits" | null;
  requiresAudio: boolean;
  placeholder: string;
}

interface VoiceEntry {
  id: string;
  name: string;
  description: string;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const AUDIO_TOOLS: AudioTool[] = [
  {
    id: "voiceover",
    label: "Voiceover",
    description: "Text to natural speech — narration, commercials, explainers",
    badge: null, badgeColor: null,
    available: true, provider: "elevenlabs", requiresAudio: false,
    placeholder: "Type your script here… e.g. \"Welcome to Zencra Labs — the AI creative studio built for filmmakers and content creators.\"",
  },
  {
    id: "dub",
    label: "Dub",
    description: "Replace dialogue in video with AI-voiced translation",
    badge: "SOON", badgeColor: "#374151",
    available: false, provider: null, requiresAudio: false,
    placeholder: "Paste the original script and target language…",
  },
  {
    id: "voice-clone",
    label: "Voice Clone",
    description: "Clone a real voice from a sample recording",
    badge: "SOON", badgeColor: "#374151",
    available: false, provider: null, requiresAudio: true,
    placeholder: "Upload a voice sample and describe the speech you want to generate…",
  },
  {
    id: "voice-convert",
    label: "Voice Convert",
    description: "Transform any audio into a different AI voice",
    badge: null, badgeColor: null,
    available: true, provider: "kits", requiresAudio: true,
    placeholder: "Upload source audio. The voice will be transformed using the selected AI voice model.",
  },
  {
    id: "sing",
    label: "Sing",
    description: "Generate AI vocal singing from lyrics and melody style",
    badge: "SOON", badgeColor: "#374151",
    available: false, provider: null, requiresAudio: false,
    placeholder: "Type lyrics and describe the vocal style…",
  },
];

// ── Voice roster ──────────────────────────────────────────────────────────────

const VOICE_ROSTER: VoiceEntry[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   description: "Calm · Narrative" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    description: "Deep · Authoritative" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    description: "Young · Energetic" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  description: "Natural · Conversational" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    description: "Expressive · Emotive" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  description: "Strong · Professional" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",     description: "Crisp · Clear" },
];

// ── Kits voice model roster ───────────────────────────────────────────────────

const KITS_VOICE_MODELS = [
  { id: "voice_male_1",   name: "Male Classic",   description: "Deep, resonant" },
  { id: "voice_female_1", name: "Female Classic", description: "Warm, clear" },
  { id: "voice_anime_1",  name: "Anime Female",   description: "Bright, expressive" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MOTION COMPONENTS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. AudioAmbientLayer — full-bleed fixed background ────────────────────────

function AudioAmbientLayer() {
  const BAR_COUNT = 28;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", overflow: "hidden",
        background: BASE,
      }}
    >
      {/* Primary drifting lime radial */}
      <div style={{
        position: "absolute",
        width: "70%", height: "65%",
        top: "10%", left: "15%",
        background: "radial-gradient(ellipse at center, rgba(198,255,0,0.055) 0%, transparent 70%)",
        filter: "blur(48px)",
        animation: "ambientDrift 16s ease-in-out infinite",
      }} />
      {/* Secondary drift — offset phase */}
      <div style={{
        position: "absolute",
        width: "50%", height: "45%",
        bottom: "5%", right: "10%",
        background: "radial-gradient(ellipse at center, rgba(100,180,0,0.032) 0%, transparent 70%)",
        filter: "blur(56px)",
        animation: "ambientDrift 20s ease-in-out 5s infinite reverse",
      }} />
      {/* Noise texture */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: 0.018,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "160px 160px",
      }} />
      {/* Faint vertical bars — bottom-anchored */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "48%",
        display: "flex", alignItems: "flex-end",
      }}>
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const h = 18 + Math.sin(i * 0.68) * 16 + Math.sin(i * 1.9) * 9;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(6, h)}%`,
                background: "linear-gradient(to top, rgba(198,255,0,0.030), rgba(198,255,0,0.008) 55%, transparent)",
                transformOrigin: "bottom",
                animation: `ambientBarPulse ${1.4 + (i % 7) * 0.22}s ease-in-out ${(i * 0.09) % 1.2}s infinite alternate`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── 2. AudioPulseIcon — ring + dot + expanding rings ─────────────────────────

function AudioPulseIcon({
  size = 52,
  state = "idle",
}: {
  size?: number;
  state?: "idle" | "generating" | "output";
}) {
  const speed = state === "generating" ? 0.8 : state === "output" ? 1.2 : 1.6;
  const glowColor = state === "generating"
    ? "rgba(198,255,0,0.55)"
    : "rgba(198,255,0,0.28)";

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      {/* Outer expanding ring */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
        border: `1px solid rgba(198,255,0,0.30)`,
        animation: `pulseRingExpand ${speed}s ease-out infinite`,
      }} />
      {/* Mid expanding ring — offset phase */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
        border: `1px solid rgba(198,255,0,0.20)`,
        animation: `pulseRingExpand ${speed}s ease-out ${speed * 0.45}s infinite`,
      }} />
      {/* Static circle base */}
      <div style={{
        position: "absolute",
        inset: size * 0.22,
        borderRadius: "50%",
        border: `1px solid rgba(198,255,0,0.40)`,
        background: "rgba(198,255,0,0.05)",
        boxShadow: `0 0 16px ${glowColor}`,
        transition: "box-shadow 0.4s ease",
      }} />
      {/* Center dot */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: size * 0.16, height: size * 0.16,
        borderRadius: "50%",
        background: ACCENT,
        boxShadow: `0 0 8px ${ACCENT}, 0 0 16px rgba(198,255,0,0.4)`,
      }} />
    </div>
  );
}

// ── 3. WaveformBars — 4-state animated waveform ───────────────────────────────

function WaveformBars({
  bars = 32,
  progress = 0,
  state = "idle" as WaveState,
  seed = 0,
  compact = false,
}: {
  bars?: number;
  progress?: number;
  state?: WaveState;
  seed?: number;
  compact?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: compact ? 1.5 : 2,
      height: "100%",
      padding: compact ? "0 2px" : "0 4px",
    }}>
      {Array.from({ length: bars }, (_, i) => {
        const basePct = 18
          + Math.sin((i + seed) * 0.72) * 14
          + Math.sin((i + seed) * 2.1)  * 8
          + Math.sin((i + seed * 0.5) * 0.35) * 6;

        const filled  = progress > 0 && (i / bars) * 100 < progress;
        const isActive = state !== "idle";

        // Per-state animation config
        const anim: { name: string; dur: string; delay: string } = (() => {
          switch (state) {
            case "hover":
              return {
                name: "waveHover",
                dur: `${1.0 + (i % 4) * 0.10}s`,
                delay: `${(i * 0.035) % 0.45}s`,
              };
            case "playing":
              return {
                name: "wavePlaying",
                dur: `${0.75 + (i % 4) * 0.18}s`,
                delay: `${(i * 0.04) % 0.5}s`,
              };
            case "generating":
              return {
                name: "waveGenerate",
                dur: "0.8s",
                delay: `${(i / bars) * 0.35}s`,
              };
            default: // idle
              return {
                name: "waveIdle",
                dur: `${1.4 + (i % 5) * 0.12}s`,
                delay: `${(i * 0.055) % 0.85}s`,
              };
          }
        })();

        return (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 2,
              height: `${Math.max(8, basePct)}%`,
              background: filled
                ? ACCENT
                : isActive
                  ? "rgba(198,255,0,0.45)"
                  : "rgba(255,255,255,0.09)",
              transformOrigin: "bottom",
              transition: "background 0.08s ease, opacity 0.22s ease",
              opacity: state === "idle" ? 0.65 : state === "hover" ? 0.78 : 1,
              animation: `${anim.name} ${anim.dur} ease-in-out ${anim.delay} infinite ${state === "generating" ? "alternate" : "alternate"}`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── 4. VoiceDropdownItem — voice card with preview + waveform ─────────────────

function VoiceDropdownItem({
  voice,
  isSelected,
  previewingId,
  onSelect,
  onPreviewChange,
}: {
  voice: VoiceEntry;
  isSelected: boolean;
  previewingId: string | null;
  onSelect: () => void;
  onPreviewChange: (id: string | null) => void;
}) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const [hovered, setHovered] = useState(false);
  const isPlaying  = previewingId === voice.id;
  const previewSrc = `/voice-previews/${voice.name.toLowerCase()}.mp3`;

  // If another voice takes the previewingId slot, pause this one
  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [isPlaying]);

  function togglePreview(e: React.MouseEvent) {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      el.currentTime = 0;
      onPreviewChange(null);
    } else {
      el.currentTime = 0;
      el.play().catch(() => {/* file absent — silent fail */});
      onPreviewChange(voice.id);
    }
  }

  const waveState: WaveState = isPlaying ? "playing" : hovered ? "hover" : "idle";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "9px 12px", cursor: "pointer",
        background: isSelected
          ? "rgba(198,255,0,0.09)"
          : hovered
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      <audio
        ref={audioRef}
        src={previewSrc}
        preload="none"
        onEnded={() => onPreviewChange(null)}
      />

      {/* Selection dot */}
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: isSelected ? ACCENT : "transparent",
        boxShadow: isSelected ? `0 0 6px ${ACCENT}` : "none",
        border: isSelected ? "none" : "1px solid rgba(255,255,255,0.15)",
        transition: "all 0.2s ease",
      }} />

      {/* Name + mini waveform */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{
            fontSize: 13,
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? "#F8FAFC" : hovered ? "#E2E8F0" : "#94A3B8",
            transition: "color 0.15s",
          }}>
            {voice.name}
          </span>
          <span style={{ fontSize: 10, color: "#64748B" }}>{voice.description}</span>
        </div>
        {/* Mini waveform strip */}
        <div style={{
          height: 14, borderRadius: 3, overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
        }}>
          <WaveformBars
            bars={22}
            state={waveState}
            seed={voice.name.charCodeAt(0)}
            compact
          />
        </div>
      </div>

      {/* Play preview button */}
      <button
        onClick={togglePreview}
        title={isPlaying ? "Stop preview" : "Preview voice"}
        style={{
          width: 26, height: 26, borderRadius: "50%", border: "none",
          cursor: "pointer", flexShrink: 0,
          background: isPlaying
            ? `rgba(198,255,0,0.16)`
            : "rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.18s ease",
          boxShadow: isPlaying ? GLOW_SM : "none",
        }}
        onMouseEnter={e => {
          if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
        }}
        onMouseLeave={e => {
          if (!isPlaying) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
        }}
      >
        {isPlaying ? (
          <span style={{ display: "flex", gap: 2 }}>
            <span style={{ width: 2, height: 9, background: ACCENT, borderRadius: 1 }} />
            <span style={{ width: 2, height: 9, background: ACCENT, borderRadius: 1 }} />
          </span>
        ) : (
          <span style={{
            width: 0, height: 0,
            borderTop: "4px solid transparent",
            borderBottom: "4px solid transparent",
            borderLeft: `6.5px solid ${hovered || isSelected ? ACCENT : "rgba(255,255,255,0.42)"}`,
            marginLeft: 2,
            transition: "border-left-color 0.15s",
          }} />
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── EXISTING COMPONENTS (updated) ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── AudioCard — with hover lift, scale entry, waveform states ─────────────────

function AudioCard({ item, idx }: { item: GeneratedAudio; idx: number }) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hovered,  setHovered]  = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress((el.currentTime / (el.duration || 1)) * 100);
    const onMeta = () => setDuration(el.duration);
    const onEnd  = () => { setPlaying(false); setProgress(0); };
    el.addEventListener("timeupdate",     onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended",          onEnd);
    return () => {
      el.removeEventListener("timeupdate",     onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended",          onEnd);
    };
  }, []);

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !item.url) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play().catch(() => {}); setPlaying(true); }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const waveState: WaveState = playing ? "playing" : hovered ? "hover" : "idle";

  // ── Generating shimmer ───────────────────────────────────────────────────
  if (item.status === "generating") {
    return (
      <div style={{
        borderRadius: 12, padding: "16px 18px",
        background: "rgba(198,255,0,0.04)",
        border: `1px solid rgba(198,255,0,0.12)`,
        display: "flex", flexDirection: "column", gap: 12,
        animation: "cardScaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AudioPulseIcon size={34} state="generating" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 11, borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 7, width: "55%" }} />
            <div style={{ height: 8,  borderRadius: 4, background: "rgba(255,255,255,0.03)", width: "32%" }} />
          </div>
        </div>
        <div style={{ height: 28, borderRadius: 6, background: "rgba(255,255,255,0.03)", overflow: "hidden" }}>
          <WaveformBars bars={32} state="generating" seed={idx * 3} />
        </div>
        <div style={{ height: 2, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: "40%",
            background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
            animation: "generateSweep 0.8s ease-in-out infinite",
          }} />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (item.status === "error") {
    return (
      <div style={{
        borderRadius: 12, padding: "14px 18px",
        background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)",
        animation: "cardScaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <p style={{ fontSize: 13, color: "#FCA5A5", margin: "0 0 3px" }}>Generation failed</p>
        <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>{item.error ?? "Unknown error — please try again."}</p>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  const cardSeed = idx * 7;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12, padding: "14px 16px",
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? "rgba(198,255,0,0.18)" : "rgba(255,255,255,0.06)"}`,
        display: "flex", flexDirection: "column", gap: 11,
        boxShadow: hovered
          ? `0 8px 32px rgba(0,0,0,0.55), ${GLOW_SM}`
          : "0 4px 20px rgba(0,0,0,0.40)",
        animation: "cardScaleIn 0.40s cubic-bezier(0.22,1,0.36,1) both",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
      }}
    >
      {item.url && <audio ref={audioRef} src={item.url} preload="metadata" />}

      {/* Waveform scrubber */}
      <div
        style={{
          height: 52, borderRadius: 8,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${playing ? "rgba(198,255,0,0.12)" : "rgba(255,255,255,0.05)"}`,
          cursor: "pointer", position: "relative", overflow: "hidden",
          transition: "border-color 0.2s ease",
        }}
        onClick={handleSeek}
      >
        {/* Filled progress track */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress}%`,
          background: "linear-gradient(90deg, rgba(198,255,0,0.16), rgba(198,255,0,0.07))",
          transition: "width 0.1s linear",
        }} />
        <WaveformBars bars={52} progress={progress} state={waveState} seed={cardSeed} />
        {progress > 0 && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${progress}%`,
            width: 1.5, background: ACCENT,
            boxShadow: `0 0 6px ${ACCENT}`,
          }} />
        )}
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          style={{
            width: 34, height: 34, borderRadius: "50%", border: "none",
            cursor: "pointer", flexShrink: 0,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: playing ? GLOW_MD : `0 0 14px rgba(198,255,0,0.28)`,
            transition: "box-shadow 0.2s ease, transform 0.15s ease",
            transform: "scale(1)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = GLOW_MD;
            (e.currentTarget as HTMLElement).style.transform = "scale(1.09)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = playing ? GLOW_MD : `0 0 14px rgba(198,255,0,0.28)`;
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          {playing
            ? <span style={{ display: "flex", gap: 2.5 }}>
                <span style={{ width: 2.5, height: 12, background: BASE, borderRadius: 2 }} />
                <span style={{ width: 2.5, height: 12, background: BASE, borderRadius: 2 }} />
              </span>
            : <span style={{
                width: 0, height: 0,
                borderTop: "5.5px solid transparent",
                borderBottom: "5.5px solid transparent",
                borderLeft: `9px solid ${BASE}`,
                marginLeft: 2,
              }} />
          }
        </button>

        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums", minWidth: 30 }}>
          {audioRef.current ? fmt(audioRef.current.currentTime) : "0:00"}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>/</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>
          {duration > 0 ? fmt(duration) : "--:--"}
        </span>

        <div style={{ flex: 1 }} />

        <span style={{
          fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
          background: "rgba(198,255,0,0.07)",
          color: "rgba(198,255,0,0.55)",
          letterSpacing: "0.07em",
          border: "1px solid rgba(198,255,0,0.14)",
        }}>
          {item.tool.toUpperCase()}
        </span>

        {item.url && (
          <a
            href={item.url}
            download={`zencra-audio-${item.id}.mp3`}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", textDecoration: "none", flexShrink: 0,
              transition: "background 0.15s, border-color 0.15s",
            }}
            title="Download MP3"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(198,255,0,0.06)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(198,255,0,0.22)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v6.5M3.5 5.5L6 8l2.5-2.5M1.5 10.5h9"
                stroke="rgba(255,255,255,0.45)" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>

      {/* Script preview */}
      <p style={{
        fontSize: 10, color: "rgba(255,255,255,0.20)", margin: 0,
        lineHeight: 1.55, wordBreak: "break-word",
        borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 9,
      }}>
        {item.prompt.length > 120 ? item.prompt.slice(0, 120) + "…" : item.prompt}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── LAYOUT COMPONENTS (unchanged from video-aligned version) ──────────────────
// ─────────────────────────────────────────────────────────────────────────────

function ChipDivider() {
  return (
    <div style={{
      width: 1, height: 20, flexShrink: 0,
      background: "rgba(255,255,255,0.10)",
      marginLeft: 6, marginRight: 6,
    }} />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.10em", color: "#475569",
      margin: "0 0 10px",
    }}>
      {children}
    </p>
  );
}

function Breadcrumb({ userCredits }: { userCredits: number | null }) {
  const crumbStyle: React.CSSProperties = {
    fontSize: 13, color: "#64748B", textDecoration: "none", transition: "color 0.15s",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingBottom: 14, paddingLeft: SIDE_GUTTER, paddingRight: SIDE_GUTTER,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <a href="/studio" style={crumbStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
        >Studio</a>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Audio Studio</span>
      </div>
      {userCredits !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(198,255,0,0.06)",
          border: "1px solid rgba(198,255,0,0.18)",
          borderRadius: 20, padding: "4px 12px",
          boxShadow: "0 0 10px rgba(198,255,0,0.08)",
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1l1.2 2.4L9 4l-2 1.95.47 2.74L5 7.35 2.53 8.69 3 5.95 1 4l2.8-.6L5 1z" fill={ACCENT} />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{userCredits} credits</span>
        </div>
      )}
    </div>
  );
}

function AudioToolBar({
  activeTool,
  onSelect,
  onSignUp,
  showSignUp,
}: {
  activeTool: string;
  onSelect: (id: string) => void;
  onSignUp: () => void;
  showSignUp: boolean;
}) {
  return (
    <div style={{
      position: "relative", zIndex: 50, overflow: "visible",
      paddingBottom: 18, paddingLeft: SIDE_GUTTER, paddingRight: SIDE_GUTTER,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {AUDIO_TOOLS.map((tool, i) => {
          const isActive = activeTool === tool.id;
          return (
            <div key={tool.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {i > 0 && <ChipDivider />}
              <button
                onClick={() => tool.available && onSelect(tool.id)}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: isActive ? `1px solid ${ACCENT}99` : "1px solid rgba(255,255,255,0.08)",
                  background: isActive ? "rgba(198,255,0,0.13)" : "rgba(255,255,255,0.03)",
                  color: isActive ? "#F8FAFC" : tool.available ? "#CBD5F5" : "rgba(255,255,255,0.28)",
                  fontSize: 14, fontWeight: isActive ? 700 : 500,
                  cursor: tool.available ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: isActive ? `0 0 15px ${ACCENT}44` : "none",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  if (!isActive && tool.available) {
                    (e.currentTarget as HTMLElement).style.color = "#F8FAFC";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive && tool.available) {
                    (e.currentTarget as HTMLElement).style.color = "#CBD5F5";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }
                }}
              >
                {tool.label}
                {tool.badge && (() => {
                  const isSoon = tool.badge === "SOON";
                  return (
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 6px",
                      borderRadius: 4, letterSpacing: "0.07em",
                      background: isSoon ? "rgba(245,158,11,0.15)" : "rgba(198,255,0,0.15)",
                      color: isSoon ? "#FCD34D" : ACCENT,
                      border: `1px solid ${isSoon ? "#F59E0B" : ACCENT}`,
                    }}>
                      {tool.badge}
                    </span>
                  );
                })()}
              </button>
            </div>
          );
        })}
      </div>
      {showSignUp && (
        <button
          onClick={onSignUp}
          style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`,
            color: BASE, fontSize: 13, fontWeight: 700,
            boxShadow: GLOW_SM, transition: "box-shadow 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = GLOW_MD}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = GLOW_SM}
        >
          Sign Up Free
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN STUDIO ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function AudioStudioInner() {
  const searchParams = useSearchParams();
  const { user, session } = useAuth();

  // ── Creative Flow store ──────────────────────────────────────────────────────
  const flowStore = useFlowStore();

  const recordFlowStep = useCallback(async (params: {
    modelKey:   string;
    prompt:     string;
    resultUrl:  string;
  }) => {
    if (!user) return;
    try {
      let wfId = useFlowStore.getState().workflowId;
      if (!wfId) {
        const wfResult = await createWorkflow(user.id);
        if (!wfResult.ok) return;
        wfId = wfResult.workflowId;
        flowStore.initWorkflow(wfId);
      }
      const stepResult = await addWorkflowStep({
        workflowId: wfId,
        userId:     user.id,
        studioType: "audio",
        modelKey:   params.modelKey,
        prompt:     params.prompt,
        resultUrl:  params.resultUrl,
        status:     "success",
      });
      if (stepResult.ok) flowStore.pushStep(stepResult.step);
    } catch {
      // Non-critical
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [activeTool,       setActiveTool]       = useState<string>(() => {
    const t = searchParams.get("tool");
    return AUDIO_TOOLS.find(x => x.id === t) ? t! : "voiceover";
  });
  const [prompt,           setPrompt]           = useState("");
  const [voiceId,          setVoiceId]          = useState(VOICE_ROSTER[0].id);
  const [kitsModel,        setKitsModel]        = useState(KITS_VOICE_MODELS[0].id);
  const [quality,          setQuality]          = useState<AudioQuality>("standard");
  const [audioFile,        setAudioFile]        = useState<File | null>(null);
  const [audioDataUrl,     setAudioDataUrl]     = useState<string | null>(null);
  const [outputs,          setOutputs]          = useState<GeneratedAudio[]>([]);
  const [generating,       setGenerating]       = useState(false);
  const [authModal,        setAuthModal]        = useState<"login" | "signup" | null>(null);
  const [voiceOpen,        setVoiceOpen]        = useState(false);
  // Motion state
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [ripple,           setRipple]           = useState<{ key: number; x: number; y: number } | null>(null);
  const [btnHovered,       setBtnHovered]       = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const tool    = AUDIO_TOOLS.find(t => t.id === activeTool)!;

  function handleToolSelect(id: string) {
    setActiveTool(id);
    setPrompt("");
    setAudioFile(null);
    setAudioDataUrl(null);
    setVoiceOpen(false);
    setPreviewingVoiceId(null);
  }

  function handleAudioFile(file: File) {
    setAudioFile(file);
    const reader = new FileReader();
    reader.onload = e => setAudioDataUrl(e.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-voice-dd]")) setVoiceOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!user) { setAuthModal("signup"); return; }
    if (!tool.available) return;
    if (tool.requiresAudio && !audioDataUrl) return;
    if (!tool.requiresAudio && !prompt.trim()) return;
    if (generating) return;

    const id = uid();
    const newItem: GeneratedAudio = {
      id, url: null,
      prompt: tool.requiresAudio ? (audioFile?.name ?? "uploaded audio") : prompt.trim(),
      tool: tool.label,
      voiceId: tool.provider === "kits" ? kitsModel : voiceId,
      quality, status: "generating",
    };
    setOutputs(prev => [newItem, ...prev]);
    setGenerating(true);
    const t0 = Date.now();

    try {
      // Kits / voice-convert is Phase 2 — not available in the new backend.
      // Gate it here rather than letting it reach the route and fail with MODEL_NOT_FOUND.
      if (tool.provider === "kits") {
        setOutputs(prev => prev.map(o => o.id === id
          ? { ...o, status: "error", error: "Voice Convert is coming soon — not yet available." }
          : o
        ));
        return;
      }

      // Use the session token from context — always current after SDK refresh events.
      // Avoids the stale user.accessToken race between INITIAL_SESSION and TOKEN_REFRESHED.
      const accessToken = session?.access_token ?? "";

      const res = await fetch("/api/studio/audio/generate", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          modelKey:       "elevenlabs",
          prompt:         prompt.trim(),
          voiceId,
          providerParams: { quality },
        }),
      });

      const data = await res.json() as { success?: boolean; data?: { url?: string; status?: string }; error?: string };

      if (!res.ok || !data.success) {
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "error", error: data.error ?? "Generation failed." } : o));
      } else {
        const url = data.data?.url ?? null;
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "done", url, durationMs: Date.now() - t0 } : o));
        if (url) {
          void recordFlowStep({ modelKey: "elevenlabs", prompt: prompt.trim(), resultUrl: url });
        }
      }
    } catch {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "error", error: "Network error — please try again." } : o));
    } finally {
      setGenerating(false);
    }
  }, [user, session, tool, prompt, voiceId, kitsModel, quality, audioDataUrl, audioFile, generating, recordFlowStep]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleGenerate(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleGenerate]);

  const canGenerate   = tool.available && !generating && (tool.requiresAudio ? !!audioDataUrl : prompt.trim().length > 0);
  const selectedVoice = VOICE_ROSTER.find(v => v.id === voiceId) ?? VOICE_ROSTER[0];
  const creditCost    = quality === "studio" ? 5 : 3;

  // Generate button glow state
  const btnShadow = generating
    ? `${GLOW_LG}, 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)`
    : canGenerate && btnHovered
      ? `${GLOW_LG}, 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)`
      : canGenerate
        ? "0 0 28px rgba(198,255,0,0.32), 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)"
        : "none";

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "transparent", // AudioAmbientLayer provides the base color
      color: "#CBD5F5",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
      paddingTop: 80,
      boxSizing: "border-box",
      position: "relative",
      zIndex: 1,
    }}>
      {/* ── Ambient background layer ─────────────────────────────────────── */}
      <AudioAmbientLayer />

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <Breadcrumb userCredits={user ? (user as unknown as { credits?: number }).credits ?? 0 : null} />

      {/* ── Tool pill bar ────────────────────────────────────────────────── */}
      <AudioToolBar
        activeTool={activeTool}
        onSelect={handleToolSelect}
        onSignUp={() => setAuthModal("signup")}
        showSignUp={!user}
      />

      {/* ── 3-column workspace ───────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr 340px",
        columnGap: 14,
        alignItems: "start",
        width: "100%",
        paddingBottom: 28,
        boxSizing: "border-box",
        position: "relative",
        zIndex: 1,
      }}>

        {/* ── LEFT PANEL ───────────────────────────────────────────────── */}
        <div style={{
          paddingLeft: SIDE_GUTTER, paddingRight: 12,
          paddingTop: 14, paddingBottom: 14,
          height: "100%", minHeight: 0,
          position: "sticky", top: 88, zIndex: 10,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.28)",
          borderRadius: 12,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxSizing: "border-box",
        }}>

          {/* Tool info */}
          <div style={{ marginBottom: 22 }}>
            <SectionLabel>Tool</SectionLabel>
            <div style={{
              padding: "11px 14px", borderRadius: 10,
              background: "rgba(198,255,0,0.04)",
              border: "1px solid rgba(198,255,0,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#F8FAFC", margin: "0 0 3px" }}>{tool.label}</p>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{tool.description}</p>
            </div>
          </div>

          {/* Voice selector — ElevenLabs only */}
          {tool.provider === "elevenlabs" && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>Voice</SectionLabel>
              <div data-voice-dd style={{ position: "relative" }}>
                {/* Trigger button */}
                <button
                  onClick={() => setVoiceOpen(v => !v)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 10,
                    border: voiceOpen
                      ? `1px solid ${ACCENT}66`
                      : "1px solid rgba(255,255,255,0.08)",
                    background: voiceOpen ? "rgba(198,255,0,0.05)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: "#CBD5F5", fontSize: 13,
                    transition: "all 0.18s ease",
                    boxShadow: voiceOpen ? GLOW_SM : "none",
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 600 }}>{selectedVoice.name}</span>
                    <span style={{ color: "#64748B", fontSize: 11, marginLeft: 8 }}>{selectedVoice.description}</span>
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                    style={{ transform: voiceOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "rgba(255,255,255,0.3)" }}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Voice dropdown — VoiceDropdownItem cards */}
                {voiceOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 20,
                    background: "rgba(4,8,20,0.98)",
                    border: `1px solid ${ACCENT}22`,
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.65)",
                    backdropFilter: "blur(20px)",
                  }}>
                    {VOICE_ROSTER.map(v => (
                      <VoiceDropdownItem
                        key={v.id}
                        voice={v}
                        isSelected={voiceId === v.id}
                        previewingId={previewingVoiceId}
                        onSelect={() => { setVoiceId(v.id); setVoiceOpen(false); setPreviewingVoiceId(null); }}
                        onPreviewChange={setPreviewingVoiceId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kits voice model selector */}
          {tool.provider === "kits" && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>Target Voice</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {KITS_VOICE_MODELS.map(m => {
                  const isActive = kitsModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setKitsModel(m.id)}
                      style={{
                        padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                        background: isActive ? "rgba(198,255,0,0.08)" : "rgba(255,255,255,0.03)",
                        outline: isActive ? `1px solid ${ACCENT}44` : "none",
                        boxShadow: isActive ? GLOW_SM : "none",
                        textAlign: "left", transition: "all 0.18s ease",
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? "#F8FAFC" : "#94A3B8", display: "block", marginBottom: 3 }}>{m.name}</span>
                      {/* Idle waveform for Kits cards */}
                      <div style={{ height: 11, borderRadius: 2, overflow: "hidden" }}>
                        <WaveformBars bars={18} state={isActive ? "hover" : "idle"} seed={m.id.length * 3} compact />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quality selector — ElevenLabs only */}
          {tool.provider === "elevenlabs" && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel>Quality</SectionLabel>
              <div style={{ display: "flex", gap: 5 }}>
                {(["standard", "studio"] as AudioQuality[]).map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 10,
                      fontSize: 13, fontWeight: quality === q ? 700 : 500, cursor: "pointer",
                      border: quality === q ? `1px solid ${ACCENT}66` : "1px solid rgba(255,255,255,0.08)",
                      background: quality === q ? "rgba(198,255,0,0.09)" : "rgba(255,255,255,0.03)",
                      color: quality === q ? "#F8FAFC" : "#64748B",
                      boxShadow: quality === q ? `0 0 15px ${ACCENT}33` : "none",
                      transition: "all 0.18s ease",
                    }}
                    onMouseEnter={e => { if (quality !== q) { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; } }}
                    onMouseLeave={e => { if (quality !== q) { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; } }}
                  >
                    {q === "studio" ? "Studio" : "Standard"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: "#374151", margin: "6px 0 0", letterSpacing: "0.02em" }}>
                {quality === "studio" ? "Zencra Voice Engine v2 · Highest realism" : "Zencra Voice Engine · Fast · Low latency"}
              </p>
            </div>
          )}

          {/* Credit estimate */}
          {tool.available && (
            <div style={{
              marginTop: 8, padding: "14px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>
              <p style={{ fontSize: 10, color: "#374151", margin: "0 0 7px", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                Estimated cost
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1l1.4 2.8L11 4.5l-2.5 2.4.59 3.38L6 8.8 2.91 10.28 3.5 6.9 1 4.5l3.6-.7L6 1z" fill={ACCENT} />
                </svg>
                <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: "-0.02em" }}>{creditCost}</span>
                <span style={{ fontSize: 12, color: "rgba(198,255,0,0.55)", fontWeight: 500 }}>credits</span>
              </div>
              <p style={{ fontSize: 10, color: "#374151", margin: "4px 0 0" }}>
                {tool.label} · {quality === "studio" ? "Studio" : "Standard"}
              </p>
            </div>
          )}
        </div>

        {/* ── CENTER — script / upload + generate bar ───────────────────── */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Script textarea */}
          {!tool.requiresAudio && (
            <div style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.30)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: [
                "0 0 0 1px rgba(255,255,255,0.03)",
                "0 0 40px rgba(198,255,0,0.03)",
                "0 16px 64px rgba(0,0,0,0.7)",
              ].join(", "),
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={tool.placeholder}
                disabled={!tool.available}
                style={{
                  flex: 1, width: "100%", resize: "none",
                  border: "none", outline: "none",
                  background: "transparent",
                  color: "#F1F5F9",
                  fontSize: 15, lineHeight: 1.75,
                  padding: "28px 28px 20px",
                  fontFamily: "var(--font-sans, system-ui, sans-serif)",
                  opacity: tool.available ? 1 : 0.35,
                  caretColor: ACCENT,
                  minHeight: 380,
                  boxSizing: "border-box",
                }}
              />
              <div style={{
                padding: "10px 28px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>
                  {prompt.length} characters
                  {prompt.length > 5000 && (
                    <span style={{ color: "#EF4444", marginLeft: 8 }}>⚠ Maximum 5 000 characters</span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.13)" }}>⌘↵ to generate</span>
              </div>
            </div>
          )}

          {/* Audio upload zone */}
          {tool.requiresAudio && (
            <div style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.30)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 16px 64px rgba(0,0,0,0.7)",
              minHeight: 380,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 32,
            }}>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); }}
              />
              {audioFile ? (
                <div style={{
                  width: "100%", maxWidth: 440, padding: "28px 32px", borderRadius: 16,
                  background: "rgba(198,255,0,0.04)",
                  border: "1px solid rgba(198,255,0,0.18)",
                  display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
                  boxShadow: GLOW_SM,
                }}>
                  <AudioPulseIcon size={48} state="output" />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", margin: "0 0 4px" }}>{audioFile.name}</p>
                    <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div style={{ width: "100%", height: 28, borderRadius: 6, overflow: "hidden" }}>
                    <WaveformBars bars={36} state="hover" seed={audioFile.name.length} />
                  </div>
                  <button
                    onClick={() => { setAudioFile(null); setAudioDataUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ fontSize: 11, color: "#64748B", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#64748B"}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%", maxWidth: 420, padding: "52px 32px", borderRadius: 16,
                    border: "1.5px dashed rgba(198,255,0,0.18)",
                    background: "transparent",
                    cursor: "pointer", textAlign: "center",
                    transition: "all 0.22s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(198,255,0,0.42)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(198,255,0,0.04)";
                    (e.currentTarget as HTMLElement).style.boxShadow = GLOW_SM;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(198,255,0,0.18)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                    <AudioPulseIcon size={44} state="idle" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", margin: "0 0 6px" }}>Upload Audio File</p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>MP3, WAV, M4A · Max 50 MB</p>
                </button>
              )}
            </div>
          )}

          {/* Generate bar — with ripple + sweep */}
          <div style={{
            padding: "16px 20px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.28)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            display: "flex", gap: 14, alignItems: "center",
            boxSizing: "border-box",
          }}>
            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              onMouseDown={e => {
                if (!canGenerate) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setRipple({ key: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top });
                (e.currentTarget as HTMLElement).style.transform = "scale(0.98) translateY(0)";
              }}
              onMouseUp={e => {
                if (canGenerate) (e.currentTarget as HTMLElement).style.transform = "scale(1.02) translateY(-1px)";
              }}
              style={{
                padding: "13px 36px", borderRadius: 11, border: "none",
                cursor: canGenerate ? "pointer" : "not-allowed",
                background: canGenerate
                  ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_D} 100%)`
                  : "rgba(255,255,255,0.05)",
                color: canGenerate ? BASE : "rgba(255,255,255,0.22)",
                fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
                boxShadow: btnShadow,
                transition: "box-shadow 0.22s ease, transform 0.15s ease",
                display: "flex", alignItems: "center", gap: 8,
                whiteSpace: "nowrap",
                position: "relative",
                overflow: "hidden",
                transform: canGenerate && btnHovered ? "scale(1.02) translateY(-1px)" : "none",
              }}
            >
              {/* Click ripple */}
              {ripple && (
                <span
                  key={ripple.key}
                  style={{
                    position: "absolute",
                    left: ripple.x, top: ripple.y,
                    width: 8, height: 8,
                    borderRadius: "50%",
                    background: "rgba(2,6,23,0.22)",
                    pointerEvents: "none",
                    animation: "rippleOut 600ms ease-out forwards",
                  }}
                  onAnimationEnd={() => setRipple(null)}
                />
              )}
              {/* Generating sweep */}
              {generating && (
                <span style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)",
                  animation: "generateSweep 0.8s ease-in-out infinite",
                  borderRadius: "inherit",
                  pointerEvents: "none",
                }} />
              )}
              {/* Label */}
              {generating ? (
                <>
                  <span style={{
                    width: 13, height: 13, borderRadius: "50%",
                    border: `2px solid rgba(2,6,23,0.25)`,
                    borderTop: `2px solid ${BASE}`,
                    display: "inline-block",
                    animation: "spin 0.75s linear infinite",
                    flexShrink: 0,
                  }} />
                  Generating…
                </>
              ) : (
                tool.available ? <><Zap size={14} /> Generate</> : "Coming Soon"
              )}
            </button>

            {!tool.available && (
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                {tool.label} is coming soon — try{" "}
                <button
                  onClick={() => handleToolSelect("voiceover")}
                  style={{ color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}
                >
                  Voiceover
                </button>
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — output ─────────────────────────────────────────── */}
        <div style={{
          paddingLeft: 12, paddingRight: SIDE_GUTTER,
          paddingTop: 14, paddingBottom: 14,
          position: "sticky", top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.22)",
          borderRadius: 12,
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxSizing: "border-box",
        }}>

          {/* Output header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.10em", color: "#475569",
              }}>
                Output
              </span>
              {outputs.length > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                  background: "rgba(198,255,0,0.07)",
                  color: "rgba(198,255,0,0.55)",
                  border: "1px solid rgba(198,255,0,0.14)",
                  letterSpacing: "0.04em",
                }}>
                  {outputs.length}
                </span>
              )}
            </div>
            {outputs.length > 0 && (
              <button
                onClick={() => setOutputs([])}
                style={{
                  fontSize: 11, color: "#374151", background: "none", border: "none",
                  cursor: "pointer", transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#374151"}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Output list or empty state */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {outputs.length === 0 ? (
              /* ── Empty state — AudioPulseIcon centered ── */
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 16, padding: "52px 12px",
                textAlign: "center",
              }}>
                {/* Pulse icon */}
                <AudioPulseIcon size={56} state="idle" />

                {/* Waveform strip */}
                <div style={{
                  width: "100%", maxWidth: 200, height: 32,
                  borderRadius: 8, overflow: "hidden",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  position: "relative",
                }}>
                  <WaveformBars bars={32} state="idle" seed={7} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to right, rgba(2,6,23,0.85) 0%, transparent 20%, transparent 80%, rgba(2,6,23,0.85) 100%)",
                    pointerEvents: "none",
                  }} />
                </div>

                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.30)", margin: "0 0 6px" }}>
                    No audio yet
                  </p>
                  <p style={{ fontSize: 11, color: "#374151", margin: 0, lineHeight: 1.65 }}>
                    Write your script and<br />bring it to life
                  </p>
                </div>

                {/* Ambient dots */}
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "rgba(198,255,0,0.12)",
                      animation: `idleDot 2.4s ease-in-out ${i * 0.4}s infinite alternate`,
                    }} />
                  ))}
                </div>
              </div>
            ) : (
              outputs.map((item, idx) => <AudioCard key={item.id} item={item} idx={idx} />)
            )}
          </div>
        </div>
      </div>

      {authModal && <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />}

      {/* ── Creative Flow overlays ────────────────────────────────────────── */}
      <FlowBar />

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Ambient ── */
        @keyframes ambientDrift {
          0%   { transform: translate(0%,  0%)  scale(1.00); }
          30%  { transform: translate(4%,  -3%) scale(1.05); }
          60%  { transform: translate(-3%, 4%)  scale(0.97); }
          100% { transform: translate(0%,  0%)  scale(1.00); }
        }
        @keyframes ambientBarPulse {
          from { transform: scaleY(0.28); }
          to   { transform: scaleY(0.72); }
        }

        /* ── Waveform states ── */
        @keyframes waveIdle {
          from { transform: scaleY(0.30); }
          to   { transform: scaleY(0.58); }
        }
        @keyframes waveHover {
          from { transform: scaleY(0.50); }
          to   { transform: scaleY(0.84); }
        }
        @keyframes wavePlaying {
          from { transform: scaleY(0.52); }
          to   { transform: scaleY(1.00); }
        }
        @keyframes waveGenerate {
          0%   { transform: scaleY(0.25); }
          50%  { transform: scaleY(0.95); }
          100% { transform: scaleY(0.25); }
        }

        /* ── Pulse icon ── */
        @keyframes pulseRingExpand {
          0%   { transform: scale(0.88); opacity: 0.65; }
          100% { transform: scale(1.42); opacity: 0; }
        }

        /* ── Generate button ── */
        @keyframes rippleOut {
          from { transform: translate(-50%, -50%) scale(0);  opacity: 0.38; }
          to   { transform: translate(-50%, -50%) scale(32); opacity: 0; }
        }
        @keyframes generateSweep {
          from { transform: translateX(-120%); }
          to   { transform: translateX(280%); }
        }

        /* ── Card entry ── */
        @keyframes cardScaleIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1.00); }
        }

        /* ── Misc ── */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes idleDot {
          from { opacity: 0.15; transform: scale(0.85); }
          to   { opacity: 0.55; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// ── Export with Suspense ──────────────────────────────────────────────────────

export default function AudioStudioPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        background: BASE,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 14,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}>
        <div style={{
          position: "absolute", width: 240, height: 240, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(198,255,0,0.07), transparent 70%)",
          filter: "blur(48px)",
        }} />
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          border: "2px solid rgba(198,255,0,0.12)",
          borderTopColor: ACCENT,
          animation: "spin 0.75s linear infinite",
          position: "relative",
        }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>
          Loading Audio Studio…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <AudioStudioInner />
    </Suspense>
  );
}
