"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA VIDEO STUDIO — Kling-powered video generation
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedVideo {
  id: string;
  url: string | null;
  prompt: string;
  model: string;
  duration: number;
  aspectRatio: string;
  mode: "t2v" | "i2v";
  status: "generating" | "done" | "error";
  error?: string;
  elapsedMs?: number;
}

type VideoAspectRatio = "16:9" | "9:16" | "1:1";
type VideoDuration = 5 | 10;
type VideoMode = "t2v" | "i2v";

interface VideoModel {
  id: string;
  name: string;
  description: string;
  badge: string | null;
  badgeColor: string | null;
  available: boolean;
  apiModelId: string;
}

// ── Model definitions ─────────────────────────────────────────────────────────

const MODELS: VideoModel[] = [
  {
    id: "kling-30",
    name: "Kling 3.0",
    description: "Flagship model — cinematic quality, best motion",
    badge: "HOT",
    badgeColor: "#0d9488",
    available: true,
    apiModelId: "kling-v3",
  },
  {
    id: "kling-26",
    name: "Kling 2.6",
    description: "Enhanced scene coherence and character fidelity",
    badge: null,
    badgeColor: null,
    available: true,
    apiModelId: "kling-v2-6",
  },
  {
    id: "kling-25",
    name: "Kling 2.5",
    description: "Fast, reliable cinematic generation",
    badge: null,
    badgeColor: null,
    available: true,
    apiModelId: "kling-v2-5",
  },
  {
    id: "seedance",
    name: "Seedance 2.0",
    description: "Specialist in human motion and dance",
    badge: "SOON",
    badgeColor: "#92400e",
    available: false,
    apiModelId: "seedance",
  },
];

// ── Catalog → studio model ID map (from navbar ?model= param) ─────────────────

const CATALOG_TO_STUDIO: Record<string, string> = {
  "kling-25":  "kling-25",
  "kling-26":  "kling-26",
  "kling-30":  "kling-30",
  "kling-30-omni": "kling-30",
};

// ── Credit helper ─────────────────────────────────────────────────────────────

function estimateCredits(duration: VideoDuration): number {
  return duration === 10 ? 22 : 11; // 10 + 1 per 5s block
}

// ── Aspect ratio display labels ───────────────────────────────────────────────

const AR_OPTIONS: { value: VideoAspectRatio; label: string; icon: string }[] = [
  { value: "16:9", label: "16:9",  icon: "▬" },
  { value: "9:16", label: "9:16",  icon: "▮" },
  { value: "1:1",  label: "1:1",   icon: "■" },
];

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
      return () => clearInterval(id);
    } else {
      setElapsed(0);
    }
  }, [running]);
  return elapsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER PAGE
// ─────────────────────────────────────────────────────────────────────────────

function VideoStudioInner() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();

  // Read ?model= from navbar link
  const modelParam   = searchParams.get("model") ?? "";
  const initialModel = CATALOG_TO_STUDIO[modelParam] ?? "kling-30";

  const [videos, setVideos]           = useState<GeneratedVideo[]>([]);
  const [prompt, setPrompt]           = useState(searchParams.get("prompt") ?? "");
  const [model, setModel]             = useState(initialModel);
  const [mode, setMode]               = useState<VideoMode>("t2v");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [duration, setDuration]       = useState<VideoDuration>(5);
  const [authModal, setAuthModal]     = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [imageUrl, setImageUrl]       = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // UI pickers
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showArPicker, setShowArPicker]       = useState(false);

  const promptRef   = useRef<HTMLTextAreaElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const currentModel = MODELS.find(m => m.id === model) ?? MODELS[0];

  const elapsed = useElapsedTimer(generating);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest("[data-dd]")) {
        setShowModelPicker(false);
        setShowArPicker(false);
      }
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  // Reset image when switching to T2V
  useEffect(() => {
    if (mode === "t2v") {
      setImageUrl("");
      setImagePreview(null);
    }
  }, [mode]);

  // ── Image upload handler ──────────────────────────────────────────────────

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase storage via the existing file upload endpoint
    // For now, use a data URL directly — Kling API accepts base64 images
    const base64Reader = new FileReader();
    base64Reader.onload = ev => {
      setImageUrl(ev.target?.result as string); // data:image/... base64 URI
    };
    base64Reader.readAsDataURL(file);
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    if (!currentModel.available) return;
    if (!user) { setAuthModal(true); return; }
    if (mode === "i2v" && !imageUrl) return;

    const videoId = `gen-${Date.now()}`;
    const placeholder: GeneratedVideo = {
      id: videoId,
      url: null,
      prompt,
      model,
      duration,
      aspectRatio,
      mode,
      status: "generating",
    };

    setVideos(prev => [placeholder, ...prev]);
    setGenerating(true);

    try {
      const body: Record<string, unknown> = {
        mode:            "video",
        provider:        "kling",
        prompt,
        quality:         "cinematic",
        aspectRatio:     mode === "i2v" ? undefined : aspectRatio,
        durationSeconds: duration,
        metadata:        { klingModel: model },
      };

      if (mode === "i2v" && imageUrl) {
        body.imageUrl = imageUrl;
      }

      const res = await fetch("/api/generate", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 402) {
        const errData = await res.json();
        const needed  = errData.data?.required ?? "?";
        const have    = errData.data?.available ?? "?";
        throw new Error(`Not enough credits — need ${needed}, you have ${have}`);
      }

      const data = await res.json();
      if (!res.ok || !data.data?.url) throw new Error(data.error ?? "Video generation failed");

      setVideos(prev =>
        prev.map(v =>
          v.id === videoId ? { ...v, url: data.data.url as string, status: "done" } : v
        )
      );

    } catch (err) {
      setVideos(prev =>
        prev.map(v =>
          v.id === videoId
            ? { ...v, status: "error", error: err instanceof Error ? err.message : "Failed" }
            : v
        )
      );
    } finally {
      setGenerating(false);
      await refreshUser();
    }
  }, [prompt, user, currentModel, mode, aspectRatio, duration, imageUrl, model, generating, refreshUser]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const ctrlBtn = (active?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: "pointer", border: "none",
    background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
    color: active ? "#fff" : "rgba(255,255,255,0.75)",
    transition: "all 0.15s", whiteSpace: "nowrap" as const,
  });

  const ddItem = (selected?: boolean, disabled?: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", borderRadius: 8, width: "100%", textAlign: "left" as const,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    background: selected ? "rgba(255,255,255,0.1)" : "transparent",
    opacity: disabled ? 0.45 : 1, transition: "background 0.1s",
  });

  const hasVideos    = videos.length > 0;
  const isDisabled   = !prompt.trim() || !currentModel.available || generating || (mode === "i2v" && !imageUrl);
  const estimatedCr  = estimateCredits(duration);

  // Format elapsed time for display
  const elapsedSec   = Math.floor(elapsed / 1000);
  const elapsedLabel = elapsed > 0
    ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`
    : null;

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
        padding: "0 24px", height: 58, minHeight: 58,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(16px)",
        zIndex: 10,
      }}>
        {/* Left: Logo + mode tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="zvg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#0EA5A0" />
                </linearGradient>
              </defs>
              <rect width="36" height="36" rx="8" fill="url(#zvg)" opacity="0.18" />
              <path d="M9 10h18l-14 16h14" stroke="url(#zvg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{
              fontSize: 15, fontWeight: 700,
              background: "linear-gradient(135deg, #2563EB, #0EA5A0)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Zencra</span>
          </Link>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

          {/* Studio tabs */}
          {[
            { label: "Image", href: "/studio/image" },
            { label: "Video", href: "/studio/video" },
          ].map(tab => (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                fontSize: 13, fontWeight: tab.label === "Video" ? 600 : 400,
                color: tab.label === "Video" ? "#0EA5A0" : "rgba(255,255,255,0.45)",
                textDecoration: "none",
                paddingBottom: 2,
                borderBottom: tab.label === "Video" ? "2px solid #0EA5A0" : "2px solid transparent",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Right: credit display + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: "rgba(14,165,160,0.1)", border: "1px solid rgba(14,165,160,0.2)",
              fontSize: 12, fontWeight: 600, color: "#0EA5A0",
            }}>
              ✦ {user.credits ?? 0} credits
            </div>
          )}
          {!user && (
            <button
              onClick={() => setAuthModal(true)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #0EA5A0, #2563EB)", color: "#fff",
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", overflow: "hidden",
        minHeight: 0,
      }}>

        {/* ── LEFT PANEL: controls ────────────────────────────────────────── */}
        <div style={{
          width: 300, minWidth: 260, maxWidth: 340,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.015)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
          padding: "20px 16px",
          gap: 20,
        }}>

          {/* Model picker */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              Model
            </p>
            <div data-dd style={{ position: "relative" }}>
              <button
                style={ctrlBtn(showModelPicker)}
                onClick={() => { setShowModelPicker(v => !v); setShowArPicker(false); }}
              >
                <span style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: currentModel.available ? "#0EA5A0" : "#374151",
                  boxShadow: currentModel.available ? "0 0 6px #0EA5A0" : "none",
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{currentModel.name}</span>
                {currentModel.badge && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                    background: `${currentModel.badgeColor ?? "#374151"}30`,
                    color: currentModel.badgeColor ?? "#9CA3AF",
                    border: `1px solid ${currentModel.badgeColor ?? "#374151"}50`,
                  }}>{currentModel.badge}</span>
                )}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>▾</span>
              </button>

              {showModelPicker && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                  background: "#161616", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: 6, boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
                }}>
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      style={ddItem(m.id === model, !m.available)}
                      onClick={() => {
                        if (m.available) { setModel(m.id); setShowModelPicker(false); }
                      }}
                    >
                      <span style={{
                        display: "inline-block", width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: m.available ? "#0EA5A0" : "#374151",
                        boxShadow: m.available ? "0 0 6px #0EA5A0" : "none",
                      }} />
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: m.available ? "#fff" : "#6B7280" }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{m.description}</p>
                      </div>
                      {m.badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                          background: `${m.badgeColor ?? "#374151"}30`,
                          color: m.badgeColor ?? "#6B7280",
                        }}>{m.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mode: T2V / I2V */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              Mode
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {([
                { value: "t2v", label: "Text to Video" },
                { value: "i2v", label: "Image to Video" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  style={{
                    flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    cursor: "pointer", border: "none",
                    background: mode === opt.value ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.05)",
                    color: mode === opt.value ? "#0EA5A0" : "rgba(255,255,255,0.5)",
                    outline: mode === opt.value ? "1px solid rgba(14,165,160,0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
              Duration
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {([5, 10] as VideoDuration[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    cursor: "pointer", border: "none",
                    background: duration === d ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.05)",
                    color: duration === d ? "#0EA5A0" : "rgba(255,255,255,0.5)",
                    outline: duration === d ? "1px solid rgba(14,165,160,0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio (T2V only) */}
          {mode === "t2v" && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                Aspect ratio
              </p>
              <div data-dd style={{ position: "relative" }}>
                <button
                  style={ctrlBtn(showArPicker)}
                  onClick={() => { setShowArPicker(v => !v); setShowModelPicker(false); }}
                >
                  <span style={{ fontSize: 14 }}>{AR_OPTIONS.find(a => a.value === aspectRatio)?.icon}</span>
                  {aspectRatio}
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>▾</span>
                </button>
                {showArPicker && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                    background: "#161616", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: 4, boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
                  }}>
                    {AR_OPTIONS.map(ar => (
                      <button
                        key={ar.value}
                        style={ddItem(ar.value === aspectRatio)}
                        onClick={() => { setAspectRatio(ar.value); setShowArPicker(false); }}
                      >
                        <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{ar.icon}</span>
                        <span style={{ fontSize: 13, color: "#fff" }}>{ar.label}</span>
                        {ar.value === aspectRatio && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "#0EA5A0" }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Image upload (I2V) */}
          {mode === "i2v" && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                Source image
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: `1.5px dashed ${imagePreview ? "#0EA5A0" : "rgba(255,255,255,0.15)"}`,
                  background: imagePreview ? "rgba(14,165,160,0.06)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  overflow: "hidden",
                }}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Source"
                    style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6 }}
                  />
                ) : (
                  <>
                    <span style={{ fontSize: 20 }}>🖼️</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      Click to upload image
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                      JPG, PNG, WEBP
                    </span>
                  </>
                )}
              </button>
              {imagePreview && (
                <button
                  onClick={() => { setImageUrl(""); setImagePreview(null); }}
                  style={{
                    marginTop: 6, width: "100%", padding: "5px", borderRadius: 6,
                    fontSize: 11, color: "rgba(255,255,255,0.4)", border: "none",
                    background: "transparent", cursor: "pointer",
                  }}
                >
                  ✕ Remove image
                </button>
              )}
            </div>
          )}

          {/* Credit estimate */}
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
              Estimated cost
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0EA5A0" }}>
              ✦ {estimatedCr} credits
            </p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
              {duration}s · {mode === "i2v" ? "Image-to-Video" : aspectRatio} · {currentModel.name}
            </p>
          </div>
        </div>

        {/* ── CENTER: prompt + generate ─────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", minWidth: 0,
        }}>

          {/* Prompt area */}
          <div style={{
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "20px 24px",
            background: "rgba(255,255,255,0.01)",
          }}>
            <textarea
              ref={promptRef}
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your video... e.g. Slow dolly push into a misty forest at dawn, golden light filtering through trees, cinematic mood, film grain"
              style={{
                width: "100%", resize: "none", background: "transparent",
                border: "none", outline: "none",
                fontSize: 15, lineHeight: 1.6, color: "#F8FAFC",
                fontFamily: "inherit",
              }}
            />

            {/* Generate bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginTop: 12,
            }}>
              {/* Hint */}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                ⌘↵ to generate
              </span>
              <div style={{ flex: 1 }} />

              {/* Elapsed timer (while generating) */}
              {generating && elapsedLabel && (
                <span style={{
                  fontSize: 12, color: "rgba(14,165,160,0.8)",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#0EA5A0", animation: "pulse 1s infinite",
                    display: "inline-block",
                  }} />
                  {elapsedLabel}
                </span>
              )}

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={isDisabled}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "11px 26px", borderRadius: 13, fontSize: 14, fontWeight: 700,
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  background: isDisabled
                    ? "rgba(255,255,255,0.07)"
                    : "linear-gradient(135deg, #0EA5A0 0%, #2563EB 100%)",
                  color: isDisabled ? "rgba(255,255,255,0.2)" : "#fff",
                  transition: "all 0.2s", letterSpacing: "0.02em",
                  boxShadow: isDisabled ? "none" : "0 0 28px rgba(14,165,160,0.45), 0 4px 16px rgba(0,0,0,0.4)",
                  minWidth: 140,
                }}
                onMouseEnter={e => { if (!isDisabled) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
              >
                {generating ? (
                  <>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #fff",
                      animation: "spin 0.8s linear infinite",
                      flexShrink: 0,
                    }} />
                    Generating...
                  </>
                ) : (
                  <>
                    ⚡ Generate
                    <span style={{
                      fontSize: 11, fontWeight: 600, opacity: 0.8,
                      background: "rgba(0,0,0,0.25)", padding: "2px 7px", borderRadius: 6,
                    }}>
                      ✦ {estimatedCr} cr
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Notices */}
            {generating && (
              <p style={{
                marginTop: 8, fontSize: 11,
                color: "rgba(14,165,160,0.7)", textAlign: "center",
              }}>
                Kling is rendering your video — this takes 2–4 minutes. Keep this tab open.
              </p>
            )}
            {mode === "i2v" && !imageUrl && !generating && (
              <p style={{
                marginTop: 8, fontSize: 11,
                color: "rgba(245,158,11,0.8)", textAlign: "center",
              }}>
                Upload a source image above to use Image-to-Video mode
              </p>
            )}
          </div>

          {/* ── Results grid ────────────────────────────────────────────────── */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "20px 24px",
          }}>
            {!hasVideos && !generating && (
              <div style={{
                height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
                color: "rgba(255,255,255,0.2)",
              }}>
                <span style={{ fontSize: 40 }}>🎬</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>
                  Your generated videos will appear here
                </p>
                <p style={{ fontSize: 12 }}>
                  Write a prompt and click Generate to start
                </p>
              </div>
            )}

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}>
              {videos.map(v => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onRegenerate={() => {
                    setPrompt(v.prompt);
                    setModel(v.model);
                    setDuration(v.duration as VideoDuration);
                    setAspectRatio(v.aspectRatio as VideoAspectRatio);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {authModal && <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes fadeIn  { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO CARD
// ─────────────────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  onRegenerate,
}: {
  video: GeneratedVideo;
  onRegenerate: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);

  const ar = video.aspectRatio;
  const paddingBottom =
    ar === "9:16" ? "177.78%" :
    ar === "1:1"  ? "100%"   :
    "56.25%"; // 16:9 default

  if (video.status === "generating") {
    return (
      <div style={{
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(14,165,160,0.2)",
        background: "rgba(255,255,255,0.03)",
        animation: "fadeIn 0.3s ease",
      }}>
        <div style={{ position: "relative", width: "100%", paddingBottom }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, rgba(14,165,160,0.05) 25%, rgba(14,165,160,0.12) 50%, rgba(14,165,160,0.05) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s infinite linear",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.1)",
              borderTop: "3px solid #0EA5A0",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Generating video...</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
              {video.duration}s · {video.aspectRatio}
            </p>
          </div>
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}
            className="truncate">
            {video.prompt}
          </p>
        </div>
      </div>
    );
  }

  if (video.status === "error") {
    return (
      <div style={{
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(239,68,68,0.2)",
        background: "rgba(239,68,68,0.04)",
        animation: "fadeIn 0.3s ease",
      }}>
        <div style={{ position: "relative", width: "100%", paddingBottom }}>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8, padding: 16,
          }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <p style={{ fontSize: 12, color: "rgba(239,68,68,0.9)", textAlign: "center" }}>
              {video.error ?? "Generation failed"}
            </p>
          </div>
        </div>
        <div style={{
          padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", flex: 1 }} className="truncate">
            {video.prompt}
          </p>
          <button
            onClick={onRegenerate}
            style={{
              marginLeft: 8, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer",
              background: "rgba(239,68,68,0.15)", color: "#EF4444",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Done — render video
  return (
    <div
      style={{
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(14,165,160,0.2)",
        background: "#0a0a0a",
        animation: "fadeIn 0.4s ease",
      }}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom }}>
        <video
          ref={vidRef}
          src={video.url ?? undefined}
          controls
          loop
          playsInline
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "contain", background: "#000",
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {/* Play overlay if not playing */}
        {!playing && (
          <button
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onClick={() => { vidRef.current?.play(); }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(255,255,255,0.3)",
            }}>
              <span style={{ fontSize: 18, marginLeft: 3 }}>▶</span>
            </div>
          </button>
        )}
      </div>

      {/* Card footer */}
      <div style={{
        padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <p style={{
          flex: 1, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {video.prompt}
        </p>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {/* Download */}
          <a
            href={video.url ?? "#"}
            download
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer", textDecoration: "none",
              background: "rgba(14,165,160,0.12)", color: "#0EA5A0",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            ↓ Save
          </a>
          {/* Regenerate */}
          <button
            onClick={onRegenerate}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)",
            }}
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  return (
    <Suspense fallback={
      <div style={{
        position: "fixed", top: 64, left: 0, right: 0, bottom: 0, background: "#0A0A0A",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.06)",
          borderTop: "3px solid #0EA5A0",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <VideoStudioInner />
    </Suspense>
  );
}
