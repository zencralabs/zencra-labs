"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoResultsLibrary — Cinematic video gallery (Phase 2)
//
// Phase 2 upgrades:
//   • #1B1B1B background with teal radial glow, border-top
//   • One-line toolbar: tabs left, zoom+sort+show right
//   • Zoom slider with live % label, default 60%, drives grid column width
//   • Sharp cinematic cards (borderRadius: 0), hover lift + teal glow
//   • Clean empty state matching dark background
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import type { GeneratedVideo } from "./types";
import { downloadAsset } from "@/lib/client/downloadAsset";
import { useAuth } from "@/components/auth/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}


// ── Zoom → card height (equal for all ARs; width varies per card) ─────────────
// 40% → 180px | 60% → 260px | 100% → 400px
function zoomToCardHeight(pct: number): number {
  return Math.round(180 + ((pct - 40) / 60) * 220);
}

// ── Aspect-ratio helpers ──────────────────────────────────────────────────────
function arToFactor(ar?: string): number {
  if (ar === "9:16") return 9 / 16;
  if (ar === "1:1")  return 1;
  return 16 / 9; // default 16:9
}
function cardWidthFromAR(height: number, ar?: string): number {
  return Math.round(height * arToFactor(ar));
}

// ── Shared toolbar button style ───────────────────────────────────────────────
const toolbarBtnBase: React.CSSProperties = {
  height: 38,
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 3,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  color: "rgba(226,244,255,0.78)",
  cursor: "pointer",
  transition: `background var(--zen-fast) var(--zen-ease), border-color var(--zen-fast) var(--zen-ease), color var(--zen-fast) var(--zen-ease), box-shadow var(--zen-fast) var(--zen-ease)`,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const toolbarBtnActive: React.CSSProperties = {
  background: "rgba(45,212,191,0.16)",
  borderColor: "rgba(45,212,191,0.45)",
  color: "#2DD4BF",
  boxShadow: "0 0 18px rgba(45,212,191,0.12)",
};

// ── In-progress status badge ──────────────────────────────────────────────────

function InProgressBadge({ status }: { status: GeneratedVideo["status"] }) {
  if (status !== "generating" && status !== "polling") return null;
  const color = status === "generating" ? "#F59E0B" : "#8B5CF6";
  const bg    = status === "generating" ? "rgba(245,158,11,0.1)" : "rgba(139,92,246,0.1)";
  const label = status === "generating" ? "Generating" : "Processing";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px",
      background: bg, border: `1px solid ${color}30`,
      fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em",
      borderRadius: 4,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: color, animation: "vlPulse 1s ease-in-out infinite",
      }} />
      {label}
    </div>
  );
}

// ── Error badge ───────────────────────────────────────────────────────────────

function ErrorBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px",
      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
      fontSize: 10, fontWeight: 700, color: "#EF4444", letterSpacing: "0.04em",
      borderRadius: 4,
    }}>
      Failed
    </div>
  );
}

// ── Waveform Bars — 5-bar CSS animated equalizer ─────────────────────────────
// Bars animate with staggered delays. Respects prefers-reduced-motion via CSS.
// Uses className="zen-wave-bar" so the global style block can stop the animation.

const WAVE_DELAYS = ["0s", "0.10s", "0.20s", "0.14s", "0.06s"] as const;

function WaveformBars({ color = "#C6FF00" }: { color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {WAVE_DELAYS.map((delay, i) => (
        <div
          key={i}
          className="zen-wave-bar"
          style={{
            width:           3,
            height:          "100%",
            borderRadius:    1,
            background:      color,
            opacity:         0.65,
            transformOrigin: "bottom",
            animation:       `waveBar${i + 1} 0.72s ease-in-out infinite`,
            animationDelay:  delay,
          }}
        />
      ))}
    </div>
  );
}

// ── Audio Badge SVG icons ─────────────────────────────────────────────────────

function SpeakerOff() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  );
}

function SpeakerOn() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

// ── Audio Badge — gallery-card indicator for audio state ─────────────────────
//
// States:
//  1. scene + audioDetected=true   → speaker icon + waveform bars + glow pulse  (lime)
//  2. voiceover + status=ready     → speaker + mic icons + glow                 (lime)
//  3. voiceover + status=gen       → Generating Voiceover                       (purple pulsing)
//  4. scene + audioDetected=false  → "No Audio" + speaker-off icon              (gray)
//  5. null/undefined/fallback      → "No Audio" + speaker-off icon              (gray)
//
// "Silent Audio" label removed. Unknown/missing → "No Audio".

const badgeBase: React.CSSProperties = {
  display:       "inline-flex",
  alignItems:    "center",
  gap:           5,
  padding:       "2px 7px",
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: "0.04em",
  borderRadius:  4,
  whiteSpace:    "nowrap" as const,
};

const noAudioBadge: React.CSSProperties = {
  ...badgeBase,
  gap:        4,
  background: "rgba(100,116,139,0.10)",
  border:     "1px solid rgba(100,116,139,0.22)",
  color:      "rgba(148,163,184,0.70)",
};

function AudioBadge({ video }: { video: GeneratedVideo }) {
  if (video.status !== "done") return null;

  // ── State 1: Scene Audio — confirmed present ──────────────────────────────
  if (video.audioMode === "scene" && video.audioDetected === true) {
    return (
      <div style={{
        ...badgeBase,
        background: "rgba(198,255,0,0.09)",
        border:     "1px solid rgba(198,255,0,0.25)",
        color:      "#C6FF00",
        animation:  "audioPulse 3.2s ease-in-out infinite",
      }}>
        <SpeakerOn />
        <WaveformBars color="#C6FF00" />
        Scene Audio
      </div>
    );
  }

  // ── State 4: Scene Audio — confirmed absent ───────────────────────────────
  if (video.audioMode === "scene" && video.audioDetected === false) {
    return (
      <div style={noAudioBadge}>
        <SpeakerOff />
        No Audio
      </div>
    );
  }

  // ── State 5: Scene Audio — detection inconclusive / fallback / no audioMode ─
  if (
    video.audioMode === "scene" &&
    (video.audioDetected === null || video.audioDetected === undefined ||
     video.sceneAudioFallback)
  ) {
    return (
      <div style={noAudioBadge}>
        <SpeakerOff />
        No Audio
      </div>
    );
  }

  // ── Voiceover states ──────────────────────────────────────────────────────

  if (video.audioMode === "voiceover") {

    // State 3: Generating Voiceover — pulsing skeleton waveform
    if (video.voiceoverStatus === "generating") {
      return (
        <div style={{
          ...badgeBase,
          background: "rgba(139,92,246,0.10)",
          border:     "1px solid rgba(139,92,246,0.22)",
          color:      "#8B5CF6",
        }}>
          {/* Pulsing skeleton bars */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
            {WAVE_DELAYS.map((_, i) => (
              <div key={i} style={{
                width:         3,
                height:        "100%",
                borderRadius:  1,
                background:    "#8B5CF6",
                opacity:       0.50,
                animation:     "vlPulse 1s ease-in-out infinite",
                animationDelay:`${i * 0.12}s`,
              }} />
            ))}
          </div>
          Generating Voiceover
        </div>
      );
    }

    // State 2: Voiceover Ready — speaker + mic + waveform + glow
    if (video.voiceoverStatus === "ready") {
      return (
        <div style={{
          ...badgeBase,
          background: "rgba(198,255,0,0.09)",
          border:     "1px solid rgba(198,255,0,0.25)",
          color:      "#C6FF00",
          animation:  "audioPulse 3.2s ease-in-out infinite",
        }}>
          <SpeakerOn />
          <MicIcon />
          <WaveformBars color="#C6FF00" />
          Voiceover Ready
        </div>
      );
    }

    // Voiceover error
    if (video.voiceoverStatus === "error") {
      return (
        <div style={{
          ...badgeBase,
          gap:        4,
          background: "rgba(255,160,0,0.12)",
          border:     "1px solid rgba(255,160,0,0.32)",
          color:      "#FFA000",
        }}>
          ⚠ Voiceover Failed
        </div>
      );
    }
  }

  // ── No audioMode set or unrecognised — show "No Audio" ───────────────────
  return (
    <div style={noAudioBadge}>
      <SpeakerOff />
      No Audio
    </div>
  );
}

// ── Featured Reel Tile ────────────────────────────────────────────────────────
// First item in the grid when filtered videos exist. Spans 2 columns on desktop,
// autoplays muted loop, no actions/checkbox/prompt. Click → fullscreen preview.

function FeaturedVideoTile({
  video,
  onPreview,
}: {
  video: GeneratedVideo;
  onPreview?: (v: GeneratedVideo) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const hasMedia = !!video.url;
  const hasThumbnail = !!video.thumbnailUrl;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview?.(video)}
      style={{
        minHeight: 360,
        background: "#050B10",
        border: `1px solid ${hovered ? "rgba(45,212,191,0.42)" : "rgba(45,212,191,0.26)"}`,
        boxShadow: hovered
          ? "0 0 40px rgba(45,212,191,0.14), 0 28px 56px rgba(0,0,0,0.55)"
          : "0 0 20px rgba(45,212,191,0.07), 0 16px 36px rgba(0,0,0,0.4)",
        transition: `border-color var(--zen-base) var(--zen-ease), box-shadow var(--zen-base) var(--zen-ease)`,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      } as React.CSSProperties}
    >
      {/* ── Media — 9:16 videos get a centred 50%-width container to stay tall ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#020608" }}>
        {/* For 9:16 we constrain the player to ~50% width so it doesn't fill the whole tile */}
        <div style={{
          width:  video.aspectRatio === "9:16" ? "50%" : "100%",
          height: "100%",
          margin: video.aspectRatio === "9:16" ? "0 auto" : undefined,
          position: "relative",
          overflow: "hidden",
        }}>
        {hasMedia ? (
          <video
            ref={videoRef}
            src={video.url!}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              transform: hovered ? "scale(1.02)" : "scale(1)",
              transition: "transform 360ms ease",
            }}
          />
        ) : hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl!}
            alt="Featured reel"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", minHeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #050B10 0%, #0A1520 100%)",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="rgba(45,212,191,0.2)" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
          </div>
        )}
        </div>{/* end 9:16 width-constraining inner div */}

        {/* Bottom gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(5,11,16,0.88) 0%, rgba(5,11,16,0.18) 55%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* ── Label block ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "18px 20px 20px",
          pointerEvents: "none",
        }}>
          {/* "Featured Reel" chip */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px",
            background: "rgba(45,212,191,0.14)",
            border: "1px solid rgba(45,212,191,0.32)",
            borderRadius: 2,
            marginBottom: 8,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#2DD4BF">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02l1.18-6.88L2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span style={{
              fontSize: 10, fontWeight: 800, color: "#2DD4BF",
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Featured Reel
            </span>
          </div>

          {/* Subtext */}
          <div style={{ fontSize: 11, color: "rgba(226,244,255,0.45)", fontWeight: 500, marginBottom: 6 }}>
            Latest generation · click to fullscreen
          </div>

          {/* Metadata row */}
          {(video.aspectRatio || video.duration || video.modelName) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              {video.modelName && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "rgba(226,244,255,0.38)",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>
                  {video.modelName}
                </span>
              )}
              {video.aspectRatio && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(226,244,255,0.28)" }}>
                  {video.aspectRatio}
                </span>
              )}
              {video.duration && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(226,244,255,0.28)" }}>
                  {video.duration}s
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Video Card ────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  selected,
  anySelected,
  onSelect,
  onReuse,
  onDelete,
  onFavToggle,
  onPreview,
  onRetry,
  onAuthRequired,
  onCardRef,
}: {
  video:           GeneratedVideo;
  selected:        boolean;
  anySelected:     boolean;
  onSelect:        (id: string) => void;
  onReuse:         (v: GeneratedVideo) => void;
  onDelete:        (id: string) => void;
  onFavToggle?:    (id: string, newFav: boolean) => void;
  onPreview?:      (v: GeneratedVideo) => void;
  onRetry?:        (v: GeneratedVideo) => void;
  onAuthRequired?: () => void;
  onCardRef?:      (id: string, el: HTMLDivElement | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  const isDone    = video.status === "done";
  const isError   = video.status === "error";
  const isPending = video.status === "generating" || video.status === "polling";
  const showCheckbox = hovered || anySelected;

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (videoRef.current && video.url && isDone) {
      videoRef.current.play().catch(() => {});
    }
  }, [video.url, isDone]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  function handleCopy() {
    if (!video.prompt) return;
    navigator.clipboard.writeText(video.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!video.url) return;
    if (!user) { onAuthRequired?.(); return; }
    downloadAsset(video.url, `zencra-video-${video.id}.mp4`);
  }

  // ── Dynamic card border + shadow ─────────────────────────────────────────────
  const cardBorder = selected
    ? "1px solid rgba(34,211,238,0.55)"
    : hovered
    ? "1px solid rgba(45,212,191,0.38)"
    : "1px solid rgba(255,255,255,0.07)";

  const cardShadow = selected
    ? "0 0 0 1px rgba(34,211,238,0.15), 0 12px 40px rgba(0,0,0,0.55)"
    : hovered
    ? "0 22px 46px rgba(0,0,0,0.42), 0 0 22px rgba(45,212,191,0.08)"
    : "none";

  return (
    <div
      ref={el => onCardRef?.(video.id, el)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        width: "100%", height: "100%",   // fills the AR-aware wrapper set by the parent
        background: isError ? "rgba(12,4,4,0.98)" : "#101010",
        border: cardBorder,
        borderRadius: 0,
        overflow: "hidden",
        transition: `transform var(--zen-base) var(--zen-ease), border-color var(--zen-base) var(--zen-ease), box-shadow var(--zen-base) var(--zen-ease)`,
        transform: hovered && !isError ? "translateY(-2px)" : "translateY(0)",
        boxShadow: cardShadow,
        cursor: "default",
      }}
    >
      {/* ── Media area — full card height, AR handled by parent wrapper ──── */}
      <div
        style={{
          position: "relative",
          width: "100%", height: "100%",
          background: isError ? "rgba(18,4,4,0.98)" : "#050505",
          overflow: "hidden",
          borderRadius: 0,
          cursor: isDone ? "pointer" : "default",
        }}
        onClick={isDone ? () => onPreview?.(video) : undefined}
      >
        {/* ── Failed state — dark disabled area with error message ────────── */}
        {isError ? (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
            background: "radial-gradient(ellipse at center, rgba(60,10,10,0.6) 0%, rgba(10,2,2,0.95) 70%)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="rgba(239,68,68,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {video.error && (
              <div style={{
                fontSize: 10, color: "rgba(239,68,68,0.55)", textAlign: "center",
                padding: "0 16px", lineHeight: 1.5,
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {video.error}
              </div>
            )}
            {/* Retry button — always visible on failed cards */}
            {onRetry && (
              <button
                onClick={e => { e.stopPropagation(); onRetry(video); }}
                title="Retry with same prompt and settings"
                style={{
                  marginTop: 4,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 12px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.28)",
                  borderRadius: 4,
                  fontSize: 10, fontWeight: 700, color: "rgba(239,68,68,0.65)",
                  cursor: "pointer", letterSpacing: "0.04em",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(239,68,68,0.18)";
                  el.style.borderColor = "rgba(239,68,68,0.5)";
                  el.style.color = "rgba(239,68,68,0.9)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(239,68,68,0.1)";
                  el.style.borderColor = "rgba(239,68,68,0.28)";
                  el.style.color = "rgba(239,68,68,0.65)";
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.33"/>
                </svg>
                Retry
              </button>
            )}
          </div>
        ) : video.url && isDone ? (
          /* ── Ready — play video on hover ──────────────────────────────── */
          <video
            ref={videoRef}
            src={video.url}
            muted loop playsInline
            poster={video.thumbnailUrl ?? undefined}
            style={{
              width: "100%", height: "100%",
              objectFit: "contain", display: "block",
              borderRadius: 0,
              transform: hovered ? "scale(1.025)" : "scale(1)",
              transition: `transform var(--zen-base) var(--zen-ease)`,
            }}
          />
        ) : video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt="thumbnail"
            style={{
              width: "100%", height: "100%",
              objectFit: "contain", display: "block",
              borderRadius: 0,
            }}
          />
        ) : (
          /* ── Pending / generating — neutral placeholder ─────────────── */
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#050505",
          }}>
            {isPending ? (
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "2px solid rgba(139,92,246,0.4)",
                borderTop: "2px solid #8B5CF6",
                animation: "spin 1s linear infinite",
              }} />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="rgba(100,116,139,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <path d="M9 8l7 4-7 4V8z"/>
              </svg>
            )}
          </div>
        )}

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: hovered
            ? "linear-gradient(to top,rgba(2,6,23,0.85) 0%,rgba(2,6,23,0.35) 40%,transparent 70%)"
            : "linear-gradient(to top,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.1) 45%,transparent 70%)",
          transition: "background 0.25s",
        }} />

        {/* Idle play icon */}
        {isDone && !hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(2,6,23,0.55)",
              border: "1.5px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#E2E8F0">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Hover play icon */}
        {isDone && hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(14,165,160,0.18)",
              border: "2px solid rgba(45,212,191,0.65)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)",
              boxShadow: "0 0 24px rgba(45,212,191,0.30)",
              animation: "vlPlayPulse 1.8s ease-in-out infinite",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#2DD4BF">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Status badges — top left, offset 36px to clear 20px checkbox + 8px margin */}
        <div style={{ position: "absolute", top: 8, left: 36, display: "flex", gap: 5, alignItems: "center", zIndex: 4 }}>
          <InProgressBadge status={video.status} />
          {isError && <ErrorBadge />}
          <AudioBadge video={video} />
        </div>

        {/* Duration + credits — top right, shifted left to make room for heart */}
        <div style={{ position: "absolute", top: 8, right: 50, display: "flex", gap: 4 }}>
          <div style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(2,6,23,0.70)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#94A3B8",
          }}>
            {video.duration}s
          </div>
          {isDone && video.creditsUsed > 0 && (
            <div style={{
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(14,165,160,0.12)", border: "1px solid rgba(45,212,191,0.2)",
              fontSize: 10, fontWeight: 700, color: "#2DD4BF",
            }}>
              {video.creditsUsed}⚡
            </div>
          )}
        </div>

        {/* Heart / Favourite — top right overlay, 38px */}
        <button
          onClick={e => { e.stopPropagation(); onFavToggle?.(video.id, !video.is_favorite); }}
          title={video.is_favorite ? "Remove from favourites" : "Add to favourites"}
          style={{
            position: "absolute", top: 6, right: 6,
            width: 38, height: 38,
            background: video.is_favorite ? "rgba(239,68,68,0.18)" : "rgba(2,6,23,0.65)",
            border: video.is_favorite ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.14)",
            borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            transition: `background var(--zen-fast) var(--zen-ease), border-color var(--zen-fast) var(--zen-ease), transform var(--zen-fast) var(--zen-ease)`,
            zIndex: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={video.is_favorite ? "#EF4444" : "none"}
            stroke={video.is_favorite ? "#EF4444" : "rgba(226,244,255,0.55)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: `fill var(--zen-fast) var(--zen-ease), stroke var(--zen-fast) var(--zen-ease)` }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        {/* Hover prompt overlay — bottom of media, above action strip */}
        {hovered && video.prompt && (
          <div style={{
            position: "absolute", bottom: 48, left: 0, right: 0,
            padding: "6px 10px",
            background: "linear-gradient(transparent, rgba(2,6,23,0.72))",
            fontSize: 11, color: "rgba(203,213,225,0.78)", lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            pointerEvents: "none", zIndex: 4,
          }}>
            {video.prompt}
          </div>
        )}

        {/* Checkbox — top left, appears on hover or selection */}
        <div
          style={{
            position: "absolute", top: 8, left: 8,
            opacity: showCheckbox ? 1 : 0,
            transition: `opacity var(--zen-fast) var(--zen-ease)`,
            zIndex: 10,
          }}
          onClick={e => { e.stopPropagation(); onSelect(video.id); }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: selected ? "rgba(34,211,238,0.9)" : "rgba(2,6,23,0.8)",
            border: selected ? "1.5px solid #22D3EE" : "1.5px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: `all var(--zen-fast) var(--zen-ease)`,
            backdropFilter: "blur(4px)",
          }}>
            {selected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="#020617" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
        </div>

        {/* Hover action strip — bottom of media */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "8px 10px",
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateY(0)" : "translateY(6px)",
          transition: `opacity var(--zen-fast) var(--zen-ease), transform var(--zen-fast) var(--zen-ease)`,
          display: "flex", gap: 5, flexWrap: "wrap",
          zIndex: 5,
        }}>
          {/* Model badge */}
          <div style={{
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(2,6,23,0.75)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 10, fontWeight: 600, color: "#64748B",
            marginRight: "auto",
          }}>
            {video.modelName}
          </div>

          {/* Voiceover audio preview — shown when voiceover is ready */}
          {isDone && video.voiceoverStatus === "ready" && video.voiceoverUrl && (
            <button
              onClick={e => {
                e.stopPropagation();
                const a = new Audio(video.voiceoverUrl!);
                a.play().catch(() => {});
              }}
              title="Play voiceover"
              style={{ ...actionBtnStyle, color: "#C6FF00" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
          )}

          {/* Download */}
          {isDone && (
            <button onClick={handleDownload} title="Download" style={actionBtnStyle}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}

          {/* Reuse prompt */}
          <button
            onClick={e => { e.stopPropagation(); onReuse(video); }}
            title="Reuse prompt"
            style={actionBtnStyle}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.33"/>
            </svg>
          </button>

          {/* Copy prompt */}
          {video.prompt && (
            <button
              onClick={e => { e.stopPropagation(); handleCopy(); }}
              title="Copy prompt"
              style={{ ...actionBtnStyle, color: copied ? "#2DD4BF" : "#94A3B8" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(video.id); }}
            title="Delete"
            style={{ ...actionBtnStyle, color: "#EF4444" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}

// Shared action button style
const actionBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 5,
  background: "rgba(10,15,30,0.8)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#94A3B8",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "background 0.12s, color 0.12s",
  backdropFilter: "blur(6px)",
  flexShrink: 0,
};

// ── Selection Dock ────────────────────────────────────────────────────────────

function SelectionDock({ count, onDelete, onClear }: {
  count: number; onDelete: () => void; onClear: () => void;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
      background: "rgba(8,12,28,0.96)", backdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "14px 32px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#2DD4BF", marginRight: 4 }}>
        {count} selected
      </div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
      <button
        onClick={onDelete}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.2)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.55)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)";
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
        Delete selected
      </button>
      <PlaceholderDockBtn label="Make Public" />
      <PlaceholderDockBtn label="Make Private" />
      <PlaceholderDockBtn label="Move to Project" />
      <div style={{ flex: 1 }} />
      <button
        onClick={onClear}
        style={{
          padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
          background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
          color: "#4E6275", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4E6275"; }}
      >
        Clear
      </button>
    </div>
  );
}

function PlaceholderDockBtn({ label }: { label: string }) {
  return (
    <button
      disabled
      title="Coming in next release"
      style={{
        padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        color: "#2D3A4A", cursor: "not-allowed",
      }}
    >
      {label}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  videos:          GeneratedVideo[];
  onReusePrompt:   (v: GeneratedVideo) => void;
  onDelete?:       (id: string) => void;
  onFavToggle?:    (id: string, newFav: boolean) => void;
  onRetry?:        (v: GeneratedVideo) => void;
  onAuthRequired?: () => void;
  onPreview?:      (v: GeneratedVideo) => void;
  onCardRef?:      (id: string, el: HTMLDivElement | null) => void;
}

type FilterTab = "history" | "failed" | "favorites";
type SortMode  = "latest" | "oldest";
type ShowCount = 25 | 50 | 100 | 500;

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoResultsLibrary({
  videos, onReusePrompt, onDelete, onFavToggle, onRetry, onAuthRequired, onPreview, onCardRef,
}: Props) {
  const [filter,    setFilter]    = useState<FilterTab>("history");
  const [sort,      setSort]      = useState<SortMode>("latest");
  const [showCount, setShowCount] = useState<ShowCount>(25);
  const [zoomPct,   setZoomPct]   = useState(65);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now        = Date.now();
  const cardHeight = zoomToCardHeight(zoomPct);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function handleBulkDelete() {
    selectedIds.forEach(id => onDelete?.(id));
    setSelectedIds(new Set());
  }

  // Filter
  let filtered = videos.filter(v => {
    if (filter === "history")   return v.status === "done";   // ready only
    if (filter === "failed")    return v.status === "error";  // failed only
    if (filter === "favorites") return v.is_favorite === true;
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sort === "latest")  return b.createdAt - a.createdAt;
    if (sort === "oldest")  return a.createdAt - b.createdAt;
    return 0;
  });

  filtered = filtered.slice(0, showCount);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "history",   label: "History" },
    { key: "failed",    label: "Failed" },
    { key: "favorites", label: "Favourites" },
  ];

  const sortModes: { key: SortMode; label: string }[] = [
    { key: "latest",  label: "Latest" },
    { key: "oldest",  label: "Oldest" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section style={{
      marginTop: 44,
      padding: "34px 24px 54px",
      background: [
        "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.05), transparent 40%)",
        "#1A1A1A",
      ].join(", "),
      borderTop: "1px solid rgba(255,255,255,0.06)",
      boxSizing: "border-box",
      width: "100%",
      paddingBottom: selectedIds.size > 0 ? 80 : 54,
    } as React.CSSProperties}>

      {/* ── Full-width container ─────────────────────────────────────────────── */}
      <div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{
          fontSize: 16, fontWeight: 800, color: "rgba(226,244,255,0.82)",
          letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: 18,
        }}>
          Your Videos
        </div>

        {/* ── Toolbar — one desktop line ─────────────────────────────────────── */}
        <div style={{
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          marginBottom: 22,
          flexWrap: "wrap",
        }}>
          {/* Left: filter tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {filterTabs.map(t => {
              const active = filter === t.key;
              const count =
                t.key === "history"   ? videos.filter(v => v.status === "done").length :
                t.key === "failed"    ? videos.filter(v => v.status === "error").length :
                videos.filter(v => v.is_favorite === true).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  style={active ? { ...toolbarBtnBase, ...toolbarBtnActive } : toolbarBtnBase}
                >
                  {t.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                    background: active ? "rgba(45,212,191,0.18)" : "rgba(255,255,255,0.07)",
                    color: active ? "#2DD4BF" : "#475569",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: zoom + sort + show */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>

            {/* Zoom control */}
            <div style={{
              height: 38,
              minWidth: 210,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 3,
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(226,244,255,0.82)",
                minWidth: 64,
                whiteSpace: "nowrap",
              }}>
                Zoom {zoomPct}%
              </span>
              <input
                type="range"
                min={40} max={100} step={5}
                value={zoomPct}
                onChange={e => setZoomPct(Number(e.target.value))}
                style={{
                  width: 112,
                  accentColor: "#2DD4BF",
                  cursor: "pointer",
                  background: "transparent",
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Sort buttons */}
            {sortModes.map(s => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  style={active ? { ...toolbarBtnBase, ...toolbarBtnActive } : toolbarBtnBase}
                >
                  {s.label}
                </button>
              );
            })}

            {/* Show count */}
            <select
              value={showCount}
              onChange={e => setShowCount(Number(e.target.value) as ShowCount)}
              style={{
                height: 38,
                padding: "0 12px",
                borderRadius: 3,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(226,244,255,0.78)",
                cursor: "pointer",
                outline: "none",
                flexShrink: 0,
              }}
            >
              {([25, 50, 100, 500] as ShowCount[]).map(n => (
                <option key={n} value={n} style={{ background: "#1B1B1B" }}>Show {n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Count line ────────────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: "#3D4D5E", marginBottom: 18 }}>
          {filtered.length} video{filtered.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && (
            <span style={{ color: "#2DD4BF", marginLeft: 8 }}>· {selectedIds.size} selected</span>
          )}
        </div>

        {/* ── Grid / empty states ───────────────────────────────────────────── */}
        {videos.length === 0 ? (
          /* No videos at all — clean empty state */
          <div style={{
            height: 280,
            border: "1px dashed rgba(255,255,255,0.12)",
            background: "#101010",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(100,116,139,0.25)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ margin: "0 auto 10px" }}>
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <path d="M9 8l7 4-7 4V8z"/>
              </svg>
              <div style={{ fontSize: 13, color: "#2D3A4A", fontWeight: 500 }}>
                Your generated videos will appear here
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Videos exist but nothing matches the filter */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "36px 0", textAlign: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="rgba(100,116,139,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>No videos match this filter</span>
          </div>
        ) : (() => {
          // ── Compute featured (first READY video) and remaining videos ────
          const featuredVideo = filtered.find(v => v.status === "done");
          const restVideos    = featuredVideo
            ? filtered.filter(v => v !== featuredVideo)
            : filtered;

          // Side cards fill the hero's 1fr columns — use explicit row heights
          const heroRowH = Math.round(cardHeight * 0.85);

          function VideoCardWrapper({ v }: { v: typeof filtered[0] }) {
            return (
              <div style={{ height: cardHeight, width: "100%", minWidth: 0 }}>
                <VideoCard
                  video={v}
                  selected={selectedIds.has(v.id)}
                  anySelected={selectedIds.size > 0}
                  onSelect={toggleSelect}
                  onReuse={onReusePrompt}
                  onDelete={onDelete ?? (() => {})}
                  onFavToggle={onFavToggle}
                  onPreview={onPreview}
                  onRetry={onRetry}
                  onAuthRequired={onAuthRequired}
                  onCardRef={onCardRef}
                />
              </div>
            );
          }

          return (
            <>
              {/* ── Hero section: Featured + 2×2 side cards ────────────── */}
              {featuredVideo && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  gridTemplateRows: `${heroRowH}px ${heroRowH}px`,
                  gap: 22,
                  marginBottom: 22,
                }}>
                  {/* Featured tile — spans both rows, full height */}
                  <div style={{ gridColumn: 1, gridRow: "1 / span 2" }}>
                    <FeaturedVideoTile
                      video={featuredVideo}
                      onPreview={onPreview}
                    />
                  </div>
                  {/* Side cards 1–4 — fill their grid cells */}
                  {restVideos.slice(0, 4).map(v => (
                    <div key={v.id} style={{ height: "100%", width: "100%" }}>
                      <VideoCard
                        video={v}
                        selected={selectedIds.has(v.id)}
                        anySelected={selectedIds.size > 0}
                        onSelect={toggleSelect}
                        onReuse={onReusePrompt}
                        onDelete={onDelete ?? (() => {})}
                        onFavToggle={onFavToggle}
                        onPreview={onPreview}
                        onRetry={onRetry}
                        onAuthRequired={onAuthRequired}
                        onCardRef={onCardRef}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Overflow grid — CSS auto-fill for flush alignment ──── */}
              {/* When no featured: show all. When featured: show rest after 4 side slots. */}
              {/* At ≥ 80% zoom, cap to 2 columns so 100% zoom = exactly 2 per row.        */}
              {(featuredVideo ? restVideos.slice(4) : filtered).length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: zoomPct >= 80
                    ? "repeat(2, 1fr)"
                    : `repeat(auto-fill, minmax(${Math.round(cardWidthFromAR(cardHeight, "16:9"))}px, 1fr))`,
                  gridAutoRows: `${cardHeight}px`,
                  gap: 22,
                }}>
                  {(featuredVideo ? restVideos.slice(4) : filtered).map(v => (
                    <VideoCardWrapper key={v.id} v={v} />
                  ))}
                </div>
              )}

            </>
          );
        })()}
      </div>

      {/* ── Bulk selection dock ───────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <SelectionDock
          count={selectedIds.size}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <style>{`
        @keyframes vlPulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes vlPlayPulse { 0%,100%{box-shadow:0 0 24px rgba(45,212,191,0.30)} 50%{box-shadow:0 0 40px rgba(45,212,191,0.55)} }
        @keyframes waveBar1    { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1.0)} }
        @keyframes waveBar2    { 0%,100%{transform:scaleY(1.0)} 50%{transform:scaleY(0.3)} }
        @keyframes waveBar3    { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(0.9)} }
        @keyframes waveBar4    { 0%,100%{transform:scaleY(0.8)} 50%{transform:scaleY(0.3)} }
        @keyframes waveBar5    { 0%,100%{transform:scaleY(0.5)} 50%{transform:scaleY(1.0)} }
        @keyframes audioPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(198,255,0,0)} 50%{box-shadow:0 0 8px 1px rgba(198,255,0,0.18)} }
        @media (prefers-reduced-motion: reduce) { .zen-wave-bar { animation: none !important; } }
      `}</style>
    </section>
  );
}
