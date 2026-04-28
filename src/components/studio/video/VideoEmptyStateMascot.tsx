"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmptyStateMascot — Canvas empty state with 3-video model showcase
//
// Layout:
//   • 3 preview blocks: 9:16 left-front, 16:9 center-back, 1:1 right-front
//   • Title, subtitle, Upload + Sample buttons below
//   • previewKey drives which model family's clips are shown
//   • When MP4 files are absent, renders styled placeholder blocks
//   • Paths are structured for: /model-previews/{key}/{shape}.mp4
// ─────────────────────────────────────────────────────────────────────────────

// ── Model preview config ──────────────────────────────────────────────────────

type ModelPreviewSet = {
  key:        string;
  label:      string;
  vertical?:  string;   // 9:16 MP4
  landscape?: string;   // 16:9 MP4
  square?:    string;   // 1:1 MP4
  comingSoon?: boolean; // if true, always show placeholder
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
  {
    key:        "minimax",
    label:      "MiniMax Hailuo",
    comingSoon: true,
  },
  {
    key:        "veo",
    label:      "Google Veo 3.2",
    comingSoon: true,
  },
  {
    key:        "sora",
    label:      "Sora 2",
    comingSoon: true,
  },
  {
    key:        "wan",
    label:      "Wan 2.7",
    comingSoon: true,
  },
  {
    key:        "grok",
    label:      "Grok Imagine",
    comingSoon: true,
  },
  {
    key:        "luma",
    label:      "Ray Flash 2",
    comingSoon: true,
  },
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

// ── Shared preview height — all three cards lock to this plane ────────────────
const PREVIEW_HEIGHT = 220;

// ── Single preview block ──────────────────────────────────────────────────────
// All blocks share PREVIEW_HEIGHT. The outer container clips; the inner
// video respects its own aspect ratio so the layout stays cinematic.
// "cover"   → 16:9 center — video fills the entire frame
// "9/16"    → vertical left  — video is natural width, height-locked
// "1/1"     → square right   — video is natural width, height-locked

function PreviewBlock({
  src,
  label,
  width,
  innerAspect = "cover",
  comingSoon,
  extraStyle,
}: {
  src?:        string;
  label:       string;
  width:       number;
  /** Determines how the inner video/placeholder is sized inside the fixed-height frame */
  innerAspect?: "cover" | "9/16" | "1/1";
  comingSoon?: boolean;
  extraStyle?: React.CSSProperties;
}) {
  const hasSrc  = !!src && !comingSoon;
  const isSide  = innerAspect !== "cover";

  // Video element styles — aspect ratio lives here, NOT on the outer container
  const videoStyle: React.CSSProperties = isSide
    ? { height: "100%", width: "auto", aspectRatio: innerAspect, objectFit: "cover", display: "block", flexShrink: 0 }
    : { width: "100%", height: "100%", objectFit: "cover", display: "block" };

  // Soft edge fade for side cards — prevents harsh cropping where video meets container edge
  const sideMask = isSide ? {
    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)",
    maskImage:       "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
  } : {};

  return (
    <div
      style={{
        width,
        height:         PREVIEW_HEIGHT,
        background:     "#070F1A",
        border:         "1px solid rgba(45,212,191,0.16)",
        borderRadius:   0,
        overflow:       "hidden",
        flexShrink:     0,
        position:       "relative",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow: [
          "0 0 0 1px rgba(14,165,160,0.06)",
          "0 8px 32px rgba(0,0,0,0.55)",
        ].join(", "),
        ...sideMask,
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
        /* Graceful placeholder — same shape, no broken state */
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 7,
          background: "linear-gradient(160deg, #050F1A 0%, #0B1C2E 100%)",
        }}>
          {/* Small play icon */}
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
          {/* Model label — only show for large enough blocks */}
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onUpload?:       () => void;
  onSamplePrompt?: () => void;
  /** Current cinematic sample prompt to preview — rotates on each click */
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
  const preview = getPreviewSet(previewKey ?? DEFAULT_PREVIEW_KEY);

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            0,
        height:         "100%",
        padding:        "24px 32px 40px",
        textAlign:      "center",
        userSelect:     "none",
      }}
    >
      {/* ── 3-video preview showcase ──────────────────────────────────────────── */}
      {/* All 3 cards share PREVIEW_HEIGHT — layout defines container, AR lives inside */}
      <div style={{
        position:        "relative",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "100%",
        maxWidth:        600,
        height:          PREVIEW_HEIGHT,
        marginBottom:    32,
        flexShrink:      0,
        filter:          "drop-shadow(0 0 40px rgba(14,165,160,0.12))",
      }}>
        {/* 9:16 vertical — left front */}
        <PreviewBlock
          src={preview.vertical}
          label={preview.label}
          width={110}
          innerAspect="9/16"
          comingSoon={preview.comingSoon}
          extraStyle={{
            zIndex:      2,
            transform:   "rotate(-8deg) scale(0.92) translateY(4px)",
            marginRight: -18,
            filter:      "brightness(0.75) contrast(0.95)",
            boxShadow: [
              "-4px 6px 28px rgba(0,0,0,0.65)",
              "0 0 16px rgba(14,165,160,0.10)",
            ].join(", "),
          }}
        />

        {/* 16:9 landscape — center anchor (hero, full brightness, pushed forward) */}
        <PreviewBlock
          src={preview.landscape}
          label={preview.label}
          width={380}
          innerAspect="cover"
          comingSoon={preview.comingSoon}
          extraStyle={{
            zIndex:    3,
            transform: "scale(1.12)",
            filter:    "brightness(1.05) contrast(1.05)",
            boxShadow: [
              "0 0 40px rgba(14,165,160,0.14)",
              "0 16px 48px rgba(0,0,0,0.65)",
            ].join(", "),
          }}
        />

        {/* 1:1 square — right front */}
        <PreviewBlock
          src={preview.square}
          label={preview.label}
          width={190}
          innerAspect="1/1"
          comingSoon={preview.comingSoon}
          extraStyle={{
            zIndex:     2,
            transform:  "rotate(8deg) scale(0.92) translateY(2px)",
            marginLeft: -18,
            filter:     "brightness(0.75) contrast(0.95)",
            boxShadow: [
              "4px 6px 28px rgba(0,0,0,0.65)",
              "0 0 16px rgba(14,165,160,0.10)",
            ].join(", "),
          }}
        />
      </div>

      {/* ── Model label strip ─────────────────────────────────────────────────── */}
      <div style={{
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
        style={{
          fontSize:      26,
          fontWeight:    800,
          color:         "#F1F5F9",
          margin:        "0 0 12px",
          letterSpacing: "-0.025em",
          lineHeight:    1.15,
        }}
      >
        Create cinematic AI videos
      </h2>

      {/* ── Subtext ───────────────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize:     16,
          color:        "#64748B",
          margin:       "0 0 32px",
          maxWidth:     380,
          lineHeight:   1.65,
        }}
      >
        Start with a prompt or upload a reference frame to guide your generation
      </p>

      {/* ── CTA buttons ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={onUpload}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            8,
            padding:        "13px 26px",
            borderRadius:   10,
            border:         "1px solid rgba(14,165,160,0.40)",
            background:     "rgba(14,165,160,0.09)",
            color:          "#0EA5A0",
            fontSize:       15,
            fontWeight:     600,
            cursor:         "pointer",
            transition:     "all 0.2s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background    = "rgba(14,165,160,0.15)";
            el.style.borderColor   = "rgba(14,165,160,0.55)";
            el.style.boxShadow     = "0 0 20px rgba(14,165,160,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background    = "rgba(14,165,160,0.09)";
            el.style.borderColor   = "rgba(14,165,160,0.40)";
            el.style.boxShadow     = "none";
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
            transition:   "all 0.2s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background    = "rgba(37,99,235,0.15)";
            el.style.borderColor   = "rgba(37,99,235,0.55)";
            el.style.boxShadow     = "0 0 20px rgba(37,99,235,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background    = "rgba(37,99,235,0.09)";
            el.style.borderColor   = "rgba(37,99,235,0.38)";
            el.style.boxShadow     = "none";
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
          display: "flex", gap: 8, flexWrap: "wrap",
          justifyContent: "center", marginTop: 28, opacity: 0.6,
        }}>
          {["Cinematic", "Slow Motion", "Aerial Shot"].map(hint => (
            <span
              key={hint}
              style={{
                fontSize:   12,
                color:      "#475569",
                background: "rgba(255,255,255,0.04)",
                border:     "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding:    "4px 12px",
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
