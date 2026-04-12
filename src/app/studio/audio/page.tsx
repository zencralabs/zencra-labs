"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA AUDIO STUDIO
// ElevenLabs TTS (Voiceover) + Kits AI (Voice Convert) + SOON tools
// ─────────────────────────────────────────────────────────────────────────────

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

interface ElevenLabsVoice {
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
    badge: null,
    badgeColor: null,
    available: true,
    provider: "elevenlabs",
    requiresAudio: false,
    placeholder: "Type your script here... e.g. \"Welcome to Zencra Labs — the AI creative studio built for filmmakers and content creators.\"",
  },
  {
    id: "dub",
    label: "Dub",
    description: "Replace dialogue in video with AI-voiced translation",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    provider: null,
    requiresAudio: false,
    placeholder: "Paste the original script and target language...",
  },
  {
    id: "voice-clone",
    label: "Voice Clone",
    description: "Clone a real voice from a sample recording",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    provider: null,
    requiresAudio: true,
    placeholder: "Upload a voice sample and describe the speech you want to generate...",
  },
  {
    id: "voice-convert",
    label: "Voice Convert",
    description: "Transform any audio into a different AI voice",
    badge: null,
    badgeColor: null,
    available: true,
    provider: "kits",
    requiresAudio: true,
    placeholder: "Upload source audio. The voice will be transformed using the selected AI voice model.",
  },
  {
    id: "sing",
    label: "Sing",
    description: "Generate AI vocal singing from lyrics and melody style",
    badge: "SOON",
    badgeColor: "#374151",
    available: false,
    provider: null,
    requiresAudio: false,
    placeholder: "Type lyrics and describe the vocal style...",
  },
];

// ── ElevenLabs voice roster ───────────────────────────────────────────────────

const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   description: "Calm · Narrative" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    description: "Deep · Authoritative" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    description: "Young · Energetic" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  description: "Natural · Conversational" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    description: "Expressive · Emotive" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  description: "Strong · Professional" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",     description: "Crisp · Clear" },
];

// ── Kits voice model roster (coming soon — UI-only for now) ──────────────────

const KITS_VOICE_MODELS = [
  { id: "voice_male_1",   name: "Male Classic",  description: "Deep, resonant" },
  { id: "voice_female_1", name: "Female Classic", description: "Warm, clear" },
  { id: "voice_anime_1",  name: "Anime Female",  description: "Bright, expressive" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── AudioCard component ───────────────────────────────────────────────────────

function AudioCard({ item, accentColor }: { item: GeneratedAudio; accentColor: string }) {
  const audioRef  = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress((el.currentTime / (el.duration || 1)) * 100);
    const onMeta = () => setDuration(el.duration);
    const onEnd  = () => { setPlaying(false); setProgress(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => { el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); el.removeEventListener("ended", onEnd); };
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

  // Generating shimmer
  if (item.status === "generating") {
    return (
      <div style={{
        borderRadius: 16, padding: "20px 24px",
        background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "3px solid rgba(168,85,247,0.15)", borderTop: "3px solid #A855F7",
            animation: "spin 0.9s linear infinite", flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.07)", marginBottom: 8, width: "60%" }} />
            <div style={{ height: 8,  borderRadius: 4, background: "rgba(255,255,255,0.04)", width: "40%" }} />
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "45%", background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, animation: "shimmer 1.4s ease-in-out infinite" }} />
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>Generating audio...</p>
      </div>
    );
  }

  // Error state
  if (item.status === "error") {
    return (
      <div style={{
        borderRadius: 16, padding: "16px 20px",
        background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
      }}>
        <p style={{ fontSize: 13, color: "#FCA5A5", margin: "0 0 4px" }}>Generation failed</p>
        <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>{item.error ?? "Unknown error — please try again."}</p>
      </div>
    );
  }

  // Done state
  return (
    <div style={{
      borderRadius: 16, padding: "20px 24px",
      background: "rgba(255,255,255,0.03)", border: `1px solid ${accentColor}20`,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {item.url && <audio ref={audioRef} src={item.url} preload="metadata" />}

      {/* Waveform-style progress bar */}
      <div
        style={{ height: 48, borderRadius: 8, background: "rgba(255,255,255,0.04)", cursor: "pointer", position: "relative", overflow: "hidden" }}
        onClick={handleSeek}
      >
        {/* Filled track */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress}%`, background: `linear-gradient(90deg, ${accentColor}40, ${accentColor}20)`,
          transition: "width 0.1s linear",
        }} />
        {/* Fake waveform bars */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 2, padding: "0 8px" }}>
          {Array.from({ length: 60 }, (_, i) => {
            const h = 30 + Math.sin(i * 0.7) * 20 + Math.sin(i * 2.3) * 10;
            const filled = (i / 60) * 100 < progress;
            return (
              <div key={i} style={{
                flex: 1, borderRadius: 2,
                height: `${h}%`,
                background: filled ? accentColor : "rgba(255,255,255,0.12)",
                transition: "background 0.05s",
              }} />
            );
          })}
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${accentColor}, #6366F1)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 16px ${accentColor}40`, flexShrink: 0,
          }}
        >
          {playing
            ? <span style={{ display: "flex", gap: 2 }}><span style={{ width: 3, height: 14, background: "#fff", borderRadius: 2 }} /><span style={{ width: 3, height: 14, background: "#fff", borderRadius: 2 }} /></span>
            : <span style={{ width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "12px solid #fff", marginLeft: 2 }} />
          }
        </button>

        {/* Time */}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>
          {audioRef.current ? fmt(audioRef.current.currentTime) : "0:00"}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>/</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
          {duration > 0 ? fmt(duration) : "--:--"}
        </span>

        <div style={{ flex: 1 }} />

        {/* Tool badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
          background: `${accentColor}20`, color: accentColor, letterSpacing: "0.05em",
        }}>
          {item.tool.toUpperCase()}
        </span>

        {/* Download */}
        {item.url && (
          <a
            href={item.url}
            download={`zencra-audio-${item.id}.mp3`}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", textDecoration: "none", flexShrink: 0,
            }}
            title="Download MP3"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6M2 11h9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>

      {/* Script preview */}
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
        {item.prompt.length > 120 ? item.prompt.slice(0, 120) + "…" : item.prompt}
      </p>
    </div>
  );
}

// ── Main Studio Component ─────────────────────────────────────────────────────

function AudioStudioInner() {
  const searchParams = useSearchParams();
  const { user }     = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<string>(() => {
    const t = searchParams.get("tool");
    return AUDIO_TOOLS.find(x => x.id === t) ? t! : "voiceover";
  });
  const [prompt, setPrompt]           = useState("");
  const [voiceId, setVoiceId]         = useState(ELEVENLABS_VOICES[0].id);
  const [kitsModel, setKitsModel]     = useState(KITS_VOICE_MODELS[0].id);
  const [quality, setQuality]         = useState<AudioQuality>("standard");
  const [audioFile, setAudioFile]     = useState<File | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [outputs, setOutputs]         = useState<GeneratedAudio[]>([]);
  const [generating, setGenerating]   = useState(false);
  const [authModal, setAuthModal]     = useState<"login" | "signup" | null>(null);
  const [voiceOpen, setVoiceOpen]     = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const tool    = AUDIO_TOOLS.find(t => t.id === activeTool)!;
  const ACCENT  = "#A855F7";
  const ACCENT2 = "#6366F1";

  // ── Read audio file ────────────────────────────────────────────────────────
  function handleAudioFile(file: File) {
    setAudioFile(file);
    const reader = new FileReader();
    reader.onload = e => setAudioDataUrl(e.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-voice-dd]"))   setVoiceOpen(false);
      if (!t.closest("[data-quality-dd]")) setQualityOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Generate ───────────────────────────────────────────────────────────────
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
      quality,
      status: "generating",
    };
    setOutputs(prev => [newItem, ...prev]);
    setGenerating(true);
    const t0 = Date.now();

    try {
      const body: Record<string, unknown> = {
        mode:     "audio",
        provider: tool.provider,
        prompt:   tool.requiresAudio ? `Voice convert: ${audioFile?.name ?? "audio"}` : prompt.trim(),
        voiceId:  tool.provider === "kits" ? kitsModel : voiceId,
        quality,
        metadata: { audioMode: tool.id },
      };
      if (tool.requiresAudio && audioDataUrl) {
        body.audioUrl = audioDataUrl;
      }

      const res  = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok || data.error) {
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "error", error: data.error ?? "Generation failed." } : o));
      } else {
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "done", url: data.url, durationMs: Date.now() - t0 } : o));
      }
    } catch {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "error", error: "Network error — please try again." } : o));
    } finally {
      setGenerating(false);
    }
  }, [user, tool, prompt, voiceId, kitsModel, quality, audioDataUrl, audioFile, generating]);

  // Keyboard shortcut: Cmd/Ctrl + Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleGenerate]);

  const canGenerate = tool.available && !generating &&
    (tool.requiresAudio ? !!audioDataUrl : prompt.trim().length > 0);

  const selectedVoice   = ELEVENLABS_VOICES.find(v => v.id === voiceId) ?? ELEVENLABS_VOICES[0];
  const selectedQuality = quality === "studio" ? "Studio" : "Standard";

  // ── Credit cost ────────────────────────────────────────────────────────────
  const creditCost = quality === "studio" ? 5 : 3;

  return (
    <div style={{
      position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 40,
      background: "#0A0A0A",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body, system-ui, sans-serif)",
      color: "#fff",
      overflow: "hidden",
    }}>
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52, minHeight: 52,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(10,10,10,0.97)", backdropFilter: "blur(16px)",
        zIndex: 10, flexShrink: 0,
      }}>
        {/* Tool tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {AUDIO_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => { if (t.available) { setActiveTool(t.id); setPrompt(""); setAudioFile(null); setAudioDataUrl(null); } }}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "none", cursor: t.available ? "pointer" : "not-allowed",
                background: activeTool === t.id ? `${ACCENT}15` : "transparent",
                color: activeTool === t.id ? ACCENT : t.available ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)",
                fontSize: 13, fontWeight: activeTool === t.id ? 600 : 400,
                display: "flex", alignItems: "center", gap: 6,
                outline: activeTool === t.id ? `1px solid ${ACCENT}30` : "none",
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {t.badge && (
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                  background: t.available ? `${ACCENT}20` : "rgba(55,65,81,0.8)",
                  color: t.available ? ACCENT : "#6B7280",
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Credits */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 20, padding: "4px 12px",
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1l1.2 2.4L9 4l-2 1.95.47 2.74L5 7.35 2.53 8.69 3 5.95 1 4l2.8-.6L5 1z" fill={ACCENT} />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{user.credits} credits</span>
            </div>
          )}
          {!user && (
            <button
              onClick={() => setAuthModal("signup")}
              style={{
                padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                color: "#fff", fontSize: 12, fontWeight: 600,
              }}
            >
              Sign Up Free
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT PANEL — controls ──────────────────────────────────────── */}
        <div style={{
          width: 280, minWidth: 280,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.015)",
          display: "flex", flexDirection: "column", gap: 0,
          overflowY: "auto", padding: "20px 16px",
        }}>

          {/* Tool info */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
              Tool
            </p>
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>{tool.label}</p>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0, lineHeight: 1.4 }}>{tool.description}</p>
            </div>
          </div>

          {/* Voice selector — only for TTS tools */}
          {tool.provider === "elevenlabs" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                Voice
              </p>
              <div data-voice-dd style={{ position: "relative" }}>
                <button
                  onClick={() => setVoiceOpen(v => !v)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: "#fff", fontSize: 13,
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 600 }}>{selectedVoice.name}</span>
                    <span style={{ color: "#64748B", fontSize: 11, marginLeft: 6 }}>{selectedVoice.description}</span>
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>▾</span>
                </button>
                {voiceOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                    background: "rgba(10,10,14,0.98)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                  }}>
                    {ELEVENLABS_VOICES.map(v => (
                      <button
                        key={v.id}
                        onClick={() => { setVoiceId(v.id); setVoiceOpen(false); }}
                        style={{
                          width: "100%", padding: "9px 14px", border: "none",
                          background: voiceId === v.id ? `${ACCENT}15` : "transparent",
                          cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${ACCENT}10`)}
                        onMouseLeave={e => (e.currentTarget.style.background = voiceId === v.id ? `${ACCENT}15` : "transparent")}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{v.name}</span>
                        <span style={{ fontSize: 11, color: "#64748B" }}>{v.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kits voice model selector */}
          {tool.provider === "kits" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                Target Voice
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {KITS_VOICE_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setKitsModel(m.id)}
                    style={{
                      padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: kitsModel === m.id ? `${ACCENT}15` : "rgba(255,255,255,0.03)",
                      outline: kitsModel === m.id ? `1px solid ${ACCENT}30` : "none",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", display: "block" }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{m.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality — only for voiceover */}
          {tool.provider === "elevenlabs" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                Quality
              </p>
              <div style={{ display: "flex", gap: 4 }}>
                {(["standard", "studio"] as AudioQuality[]).map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    style={{
                      flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      cursor: "pointer", border: "none",
                      background: quality === q ? `${ACCENT}15` : "rgba(255,255,255,0.04)",
                      color: quality === q ? ACCENT : "rgba(255,255,255,0.5)",
                      outline: quality === q ? `1px solid ${ACCENT}30` : "none",
                      transition: "all 0.15s", textTransform: "capitalize",
                    }}
                  >
                    {q === "studio" ? "Studio" : "Standard"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: "#475569", margin: "6px 0 0" }}>
                {quality === "studio" ? "eleven_multilingual_v2 · Highest realism" : "eleven_turbo_v2 · Fast · Low latency"}
              </p>
            </div>
          )}

          {/* Cost estimate */}
          {tool.available && (
            <div style={{
              marginTop: "auto", padding: "14px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <p style={{ fontSize: 11, color: "#64748B", margin: "0 0 6px" }}>Estimated cost</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1l1.4 2.8L11 4.5l-2.5 2.4.59 3.38L6 8.8 2.91 10.28 3.5 6.9 1 4.5l3.6-.7L6 1z" fill={ACCENT} />
                </svg>
                <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{creditCost} credits</span>
              </div>
              <p style={{ fontSize: 10, color: "#475569", margin: "4px 0 0" }}>
                {tool.label} · {selectedQuality}
              </p>
            </div>
          )}
        </div>

        {/* ── CENTER — input area ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Script / prompt textarea */}
          {!tool.requiresAudio && (
            <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={tool.placeholder}
                disabled={!tool.available}
                style={{
                  flex: 1, width: "100%", resize: "none", border: "none", outline: "none",
                  background: "transparent", color: "#F8FAFC",
                  fontSize: 15, lineHeight: 1.7, padding: "28px 32px",
                  fontFamily: "var(--font-body, system-ui, sans-serif)",
                  opacity: tool.available ? 1 : 0.4,
                }}
              />
              {/* Char count + shortcut hint */}
              <div style={{
                padding: "10px 32px", borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                  {prompt.length} characters
                  {prompt.length > 5000 && <span style={{ color: "#EF4444", marginLeft: 6 }}>⚠ ElevenLabs limit is ~5 000 chars</span>}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>⌘↵ to generate</span>
              </div>
            </div>
          )}

          {/* Audio upload area — for Voice Convert */}
          {tool.requiresAudio && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); }}
              />
              {audioFile ? (
                <div style={{
                  width: "100%", maxWidth: 480, padding: "24px 28px", borderRadius: 16,
                  background: `${ACCENT}08`, border: `1px solid ${ACCENT}25`,
                  display: "flex", flexDirection: "column", gap: 12, alignItems: "center",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: `${ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M11 2a9 9 0 100 18A9 9 0 0011 2zm0 4v5l3 2" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>{audioFile.name}</p>
                    <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => { setAudioFile(null); setAudioDataUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ fontSize: 11, color: "#64748B", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%", maxWidth: 420, padding: "48px 32px", borderRadius: 16,
                    border: `2px dashed ${ACCENT}30`, background: `${ACCENT}05`,
                    cursor: "pointer", textAlign: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}60`; (e.currentTarget as HTMLElement).style.background = `${ACCENT}08`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}30`; (e.currentTarget as HTMLElement).style.background = `${ACCENT}05`; }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Upload Audio File</p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>MP3, WAV, M4A · Max 50 MB</p>
                </button>
              )}
            </div>
          )}

          {/* Generate button */}
          <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                padding: "10px 28px", borderRadius: 10, border: "none",
                cursor: canGenerate ? "pointer" : "not-allowed",
                background: canGenerate ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` : "rgba(255,255,255,0.06)",
                color: canGenerate ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize: 13, fontWeight: 600,
                boxShadow: canGenerate ? `0 0 20px ${ACCENT}40` : "none",
                transition: "all 0.2s",
              }}
            >
              {generating ? "Generating…" : tool.available ? "Generate" : "Coming Soon"}
            </button>
            {!tool.available && (
              <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
                {tool.label} is coming soon — try <button onClick={() => setActiveTool("voiceover")} style={{ color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11 }}>Voiceover</button>
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — output history ───────────────────────────────── */}
        <div style={{
          width: 340, minWidth: 340,
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.3)" }}>
              Output
            </span>
            {outputs.length > 0 && (
              <button
                onClick={() => setOutputs([])}
                style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Outputs */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {outputs.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 20px" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0z" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>No audio yet</p>
                  <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                    {tool.requiresAudio ? "Upload audio and click Generate" : "Write a script and click Generate"}
                  </p>
                </div>
              </div>
            ) : (
              outputs.map(item => <AudioCard key={item.id} item={item} accentColor={ACCENT} />)
            )}
          </div>
        </div>
      </div>

      {/* Auth modal */}
      {authModal && <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />}

      {/* Keyframe styles */}
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(200%); } }
      `}</style>
    </div>
  );
}

// ── Export with Suspense boundary ─────────────────────────────────────────────

export default function AudioStudioPage() {
  return (
    <Suspense fallback={
      <div style={{
        position: "fixed", top: 64, left: 0, right: 0, bottom: 0, background: "#0A0A0A",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.06)",
          borderTop: "3px solid #A855F7",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <AudioStudioInner />
    </Suspense>
  );
}
