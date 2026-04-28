"use client";

import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmptyStateMascot — Canvas empty state with 3-video model showcase
//
// Layout:
//   • Center 16:9 card is the background (z-index 1)
//   • 9:16 card overlaps ON TOP of the center card's left side (z-index 3)
//   • 1:1 card overlaps ON TOP of the center card's right side (z-index 3)
//   • No breathing / floating / parallax — clean static stack
//   • Model crossfade: opacity fade only on model switch
// ─────────────────────────────────────────────────────────────────────────────

// ── Model preview config ──────────────────────────────────────────────────────

type ModelPreviewSet = {
  key:         string;
  label:       string;
  vertical?:   string;   // 9:16 MP4
  landscape?:  string;   // 16:9 MP4
  square?:     string;   // 1:1 MP4
  comingSoon?: boolean;
};

const MODEL_PREVIEW_SETS: ModelPreviewSet[] = [
  {
    key:       "kling",
    label:     "Kling 3.0",
    vertical:  "/model-previews/kling/vertical.mp4",
    landscape: "/model-previews/kling/landscape.mp4",
    square:    "/model-previews/kling/square.mp4",
  },
  {
    key:       "seedance",
    label:     "Seedance",
    vertical:  "/model-previews/seedance/vertical.mp4",
    landscape: "/model-previews/seedance/landscape.mp4",
    square:    "/model-previews/seedance/square.mp4",
  },
  { key: "minimax", label: "MiniMax Hailuo", comingSoon: true },
  { key: "veo",     label: "Google Veo 3.2", comingSoon: true },
  { key: "sora",    label: "Sora 2",         comingSoon: true },
  { key: "wan",     label: "Wan 2.7",         comingSoon: true },
  { key: "grok",    label: "Grok Imagine",    comingSoon: true },
  { key: "luma",    label: "Ray Flash 2",     comingSoon: true },
];

const DEFAULT_PREVIEW_KEY = "kling";

function getPreviewSet(key: string): ModelPreviewSet {
  return (
    MODEL_PREVIEW_SETS.find(s => s.key === key) ?? {
      key,
      label:      key.charAt(0).toUpperCase() + key.slice(1),
      comingSoon: true,
    }
  );
}

// ── Layout constants ──────────────────────────────────────────────────────────
//
// CENTER: 16:9 base card — the visual anchor
// LEFT:   9:16 card     — sits on top of the center card's left portion
// RIGHT:  1:1 card      — sits on top of the center card's right portion
//
// OVERHANG: how many px each side card extends past the center card edge.
//           Both side cards use the same value for visual balance.

const CENTER_W  = 540;   // 16:9 center card width
const CENTER_H  = 290;   // 16:9 center card height
const LEFT_W    = 152;   // 9:16 width  (= LEFT_H × 9/16 ≈ 270 × 9/16)  — secondary dominant
const LEFT_H    = 270;   // 9:16 height — ~7% larger than before, still shorter than center ✓
const RIGHT_W   = 225;   // 1:1 square — tertiary (smallest)
const RIGHT_H   = 225;   // 1:1 square
const OVERHANG  = 28;    // px each side card sticks past center edge (reduced from 40 for breathing)

// Derived horizontal positions (all relative to 50% = container center):
//   Left  card left edge  : -(CENTER_W/2 + OVERHANG)  = -298px
//   Right card left edge  : +(CENTER_W/2 + OVERHANG - RIGHT_W) = +73px

const STACK_HEIGHT = CENTER_H + 30; // 320 — breathing room without wasted space

// ── Single preview block ──────────────────────────────────────────────────────

function PreviewBlock({
  src,
  label,
  width,
  height,
  innerAspect = "cover",
  comingSoon,
  extraStyle,
}: {
  src?:         string;
  label:        string;
  width:        number;
  height:       number;
  innerAspect?: "cover" | "9/16" | "1/1";
  comingSoon?:  boolean;
  extraStyle?:  React.CSSProperties;
}) {
  const hasSrc = !!src && !comingSoon;
  const isSide = innerAspect !== "cover";

  const videoStyle: React.CSSProperties = isSide
    ? { height: "100%", width: "auto", aspectRatio: innerAspect, objectFit: "cover", display: "block", flexShrink: 0 }
    : { width: "100%", height: "100%", objectFit: "cover", display: "block" };

  return (
    <div
      style={{
        width,
        height,
        background:     "#070F1A",
        borderRadius:   0,
        overflow:       "hidden",
        flexShrink:     0,
        position:       "relative",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        ...extraStyle,
      }}
    >
      {hasSrc ? (
        <video
          src={src}
          autoPlay muted loop playsInline
          style={videoStyle}
        />
      ) : (
        // Graceful placeholder — same dimensions, never broken
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 7,
          background: "linear-gradient(160deg, #050F1A 0%, #0B1C2E 100%)",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "rgba(14,165,160,0.07)",
            border: "1px solid rgba(14,165,160,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="rgba(45,212,191,0.35)" strokeWidth="1.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          {width >= 90 && (
            <span style={{
              fontSize: 9, color: "rgba(45,212,191,0.28)",
              letterSpacing: "0.06em", textTransform: "uppercase",
              textAlign: "center", padding: "0 6px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: width - 12,
            }}>
              {comingSoon ? `${label} · Soon` : label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── ShowcaseCards ─────────────────────────────────────────────────────────────
// Static 3-card overlap stack.
//
// Stacking order:
//   z-index 1 — Center 16:9  (background anchor)
//   z-index 3 — Left  9:16   (on top of center's left edge)
//   z-index 3 — Right 1:1    (on top of center's right edge)
//
// Positioning:
//   Center  left: 50%, transform: translateY(-50%)  → perfectly centered horizontally + vertically
//   Left    left: calc(50% - 298px), transform: translateY(-50%)  → 28px past center left edge
//   Right   left: calc(50% + 73px),  transform: translateY(-50%)  → 28px past center right edge
//
// All three share top: 50% + transform: translateY(-50%) — identical vertical midline guaranteed.

function ShowcaseCards({ preview }: { preview: ModelPreviewSet }) {
  const leftPos  = `calc(50% - ${CENTER_W / 2 + OVERHANG}px)`;          // calc(50% - 310px)
  const rightPos = `calc(50% + ${CENTER_W / 2 + OVERHANG - RIGHT_W}px)`; // calc(50% + 85px)

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* ── Center: 16:9 landscape — base anchor card ───────────────────────── */}
      <div style={{
        position:  "absolute",
        left:      "50%",
        marginLeft: -(CENTER_W / 2),
        top:       "50%",
        transform: "translateY(-50%)",
        zIndex:    1,
      }}>
        <PreviewBlock
          src={preview.landscape}
          label={preview.label}
          width={CENTER_W}
          height={CENTER_H}
          innerAspect="cover"
          comingSoon={preview.comingSoon}
          extraStyle={{
            border:    "1px solid rgba(45,212,191,0.22)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        />
      </div>

      {/* ── Left: 9:16 vertical — on top of center card's left side ─────────── */}
      <div style={{
        position:  "absolute",
        left:      leftPos,
        top:       "50%",
        transform: "translateY(-50%)",
        zIndex:    3,
      }}>
        <PreviewBlock
          src={preview.vertical}
          label={preview.label}
          width={LEFT_W}
          height={LEFT_H}
          innerAspect="9/16"
          comingSoon={preview.comingSoon}
          extraStyle={{
            border:    "1px solid rgba(0,0,0,1)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        />
      </div>

      {/* ── Right: 1:1 square — on top of center card's right side ──────────── */}
      <div style={{
        position:  "absolute",
        left:      rightPos,
        top:       "50%",
        transform: "translateY(-50%)",
        zIndex:    3,
      }}>
        <PreviewBlock
          src={preview.square}
          label={preview.label}
          width={RIGHT_W}
          height={RIGHT_H}
          innerAspect="1/1"
          comingSoon={preview.comingSoon}
          extraStyle={{
            border:    "1px solid rgba(0,0,0,1)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        />
      </div>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onUpload?:       () => void;
  onSamplePrompt?: () => void;
  /** Current cinematic sample prompt — rotates on each click */
  samplePrompt?:   string;
  /** Which model family to display previews for. Defaults to "kling". */
  previewKey?:     string;
}

export default function VideoEmptyStateMascot({
  onUpload,
  onSamplePrompt,
  samplePrompt,
  previewKey,
}: Props) {

  // ── Crossfade state ──────────────────────────────────────────────────────────
  // displayKey: what's currently rendered (only changes at the midpoint of fade)
  // fadeOpacity: drives the CSS transition — 0 between sets, 1 when settled
  const [displayKey,  setDisplayKey]  = useState(previewKey ?? DEFAULT_PREVIEW_KEY);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const crossfadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const newKey = previewKey ?? DEFAULT_PREVIEW_KEY;

    // Always cancel any in-flight crossfade FIRST — before the guard.
    // If we don't, a cancelled timer can leave fadeOpacity stuck at 0.
    if (crossfadeTimer.current) {
      clearTimeout(crossfadeTimer.current);
      crossfadeTimer.current = null;
    }

    // Guard: same key — ensure showcase is fully visible.
    if (newKey === displayKey) {
      setFadeOpacity(1);
      return;
    }

    // Step 1 — fade out (CSS transition: 160ms)
    setFadeOpacity(0);

    // Step 2 — at 165ms swap content and fade back in
    crossfadeTimer.current = setTimeout(() => {
      setDisplayKey(newKey);
      setFadeOpacity(1);
      crossfadeTimer.current = null;
    }, 165);

    return () => {
      if (crossfadeTimer.current) {
        clearTimeout(crossfadeTimer.current);
        crossfadeTimer.current = null;
      }
    };
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = getPreviewSet(displayKey);

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            0,
        height:         "100%",
        padding:        "80px 32px 40px",
        textAlign:      "center",
        userSelect:     "none",
      }}
    >

      {/* ── 3-video preview showcase ──────────────────────────────────────────── */}
      <div style={{
        position:     "relative",
        width:        "100%",
        height:       STACK_HEIGHT,
        marginTop:    10,
        marginBottom: 5,
        flexShrink:   0,
        overflow:     "visible",
      }}>

        {/* Crossfade wrapper — opacity transitions on previewKey change only */}
        <div style={{
          opacity:    fadeOpacity,
          transition: "opacity var(--zen-fast) var(--zen-ease)",
          width:      "100%",
          height:     "100%",
        }}>
          <ShowcaseCards preview={preview} />
        </div>

      </div>

      {/* ── Model label strip ─────────────────────────────────────────────────── */}
      <div style={{
        opacity:       fadeOpacity,
        transition:    "opacity 160ms ease",
        fontSize:      11,
        fontWeight:    700,
        color:         "rgba(45,212,191,0.4)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom:  20,
      }}>
        {preview.label}{preview.comingSoon ? " · Coming Soon" : ""}
      </div>

      {/* ── Headline ──────────────────────────────────────────────────────────── */}
      <h2
        className="zencra-display-heading text-[30px] font-semibold tracking-[-0.02em]"
        style={{
          color:      "#F1F5F9",
          margin:     "0 0 12px",
          lineHeight: 1.15,
          textShadow: "0 0 12px rgba(255,255,255,0.08)",
        }}
      >
        Create cinematic AI videos
      </h2>

      {/* ── Subtext ───────────────────────────────────────────────────────────── */}
      <p className="mt-2 mb-8 max-w-[720px] whitespace-nowrap text-[15.5px] leading-relaxed text-white/60">
        Start with a prompt or upload a reference frame to guide your generation
      </p>

      {/* ── CTA buttons ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={onUpload}
          className="zen-motion-fast"
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            padding:      "13px 26px",
            borderRadius: 10,
            border:       "1px solid rgba(14,165,160,0.40)",
            background:   "rgba(14,165,160,0.09)",
            color:        "#0EA5A0",
            fontSize:     15,
            fontWeight:   600,
            cursor:       "pointer",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "rgba(14,165,160,0.15)";
            el.style.borderColor = "rgba(14,165,160,0.55)";
            el.style.boxShadow   = "0 0 20px rgba(14,165,160,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "rgba(14,165,160,0.09)";
            el.style.borderColor = "rgba(14,165,160,0.40)";
            el.style.boxShadow   = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Upload Image
        </button>

        <button
          onClick={onSamplePrompt}
          className="zen-motion-fast"
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            padding:      "13px 26px",
            borderRadius: 10,
            border:       "1px solid rgba(37,99,235,0.38)",
            background:   "rgba(37,99,235,0.09)",
            color:        "#60A5FA",
            fontSize:     15,
            fontWeight:   600,
            cursor:       "pointer",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "rgba(37,99,235,0.15)";
            el.style.borderColor = "rgba(37,99,235,0.55)";
            el.style.boxShadow   = "0 0 20px rgba(37,99,235,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = "rgba(37,99,235,0.09)";
            el.style.borderColor = "rgba(37,99,235,0.38)";
            el.style.boxShadow   = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Try Sample Prompt
        </button>
      </div>

      {/* ── Sample prompt preview / style chips ──────────────────────────────── */}
      {samplePrompt ? (
        <div style={{
          marginTop:    24,
          maxWidth:     400,
          padding:      "10px 16px",
          borderRadius: 10,
          border:       "1px solid rgba(37,99,235,0.22)",
          background:   "rgba(37,99,235,0.06)",
          fontSize:     13,
          color:        "#94A3B8",
          lineHeight:   1.55,
          fontStyle:    "italic",
          textAlign:    "center",
        }}>
          &ldquo;{samplePrompt}&rdquo;
        </div>
      ) : (
        <div style={{
          display:        "flex",
          gap:            8,
          flexWrap:       "wrap",
          justifyContent: "center",
          marginTop:      24,
          opacity:        0.6,
        }}>
          {["Cinematic", "Slow Motion", "Aerial Shot"].map(hint => (
            <span
              key={hint}
              style={{
                fontSize:     12,
                color:        "#475569",
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding:      "4px 12px",
              }}
            >
              {hint}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
