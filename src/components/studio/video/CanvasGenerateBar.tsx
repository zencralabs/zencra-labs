"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CanvasGenerateBar — Primary CTA bar placed below VideoCanvas.
// Single source of truth for the Generate action in Video Studio.
// Design: sharp/cinematic (border-radius 4px), calm teal glow, no animation.
// Sticky fallback used (position: relative) to avoid gallery overlap.
// ─────────────────────────────────────────────────────────────────────────────

export type CanvasGenerateBarProps = {
  ready:            boolean;
  generating:       boolean;
  comingSoon?:      boolean;
  modelName:        string;
  durationLabel:    string;
  aspectRatioLabel: string;
  qualityLabel:     string;
  creditsLabel:     string;
  onGenerate:       () => void;
};

export default function CanvasGenerateBar({
  ready,
  generating,
  comingSoon = false,
  modelName,
  durationLabel,
  aspectRatioLabel,
  creditsLabel,
  onGenerate,
}: CanvasGenerateBarProps) {
  // Only clickable when ready AND not in-progress AND model is available
  const canClick = ready && !generating && !comingSoon;

  // Left-side labels
  const titleText = generating
    ? "Generating…"
    : comingSoon
    ? modelName
    : ready
    ? "⚡ Ready to generate"
    : "Complete required inputs";

  const subtextText = generating || ready
    ? `${modelName} · ${durationLabel} · ${aspectRatioLabel}`
    : "Add a prompt or required media to continue";

  return (
    <div style={{
      width:          "min(760px, 100%)",
      margin:         "22px auto 32px auto",
      height:         76,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        "12px 14px 12px 18px",
      background:     "linear-gradient(180deg, rgba(8,18,32,0.92), rgba(5,12,22,0.96))",
      border:         "1px solid rgba(45,212,191,0.28)",
      boxShadow: [
        "0 0 0 1px rgba(45,212,191,0.06)",
        "0 18px 48px rgba(0,0,0,0.42)",
        "0 0 32px rgba(45,212,191,0.10)",
      ].join(", "),
      borderRadius:   4,
      backdropFilter: "blur(18px)",
      boxSizing:      "border-box",
    }}>

      {/* ── Left — readiness state ── */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize:      15,
          fontWeight:    700,
          lineHeight:    1.1,
          color:         "#EAFDFB",
          letterSpacing: "-0.01em",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>
          {titleText}
        </div>
        <div style={{
          marginTop:  6,
          fontSize:   12,
          fontWeight: 500,
          color:      "rgba(180,214,230,0.72)",
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {comingSoon ? "This model is coming soon" : subtextText}
        </div>
      </div>

      {/* ── Right — credits + Generate button ── */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
        {/* Credits label */}
        <span style={{
          fontSize:    13,
          fontWeight:  700,
          color:       "#2DD4BF",
          marginRight: 14,
          whiteSpace:  "nowrap",
        }}>
          {comingSoon ? "—" : creditsLabel}
        </span>

        {/* Generate button */}
        <button
          onClick={canClick ? onGenerate : undefined}
          disabled={!canClick}
          style={{
            height:         48,
            minWidth:       190,
            padding:        "0 24px",
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            10,
            fontSize:       15,
            fontWeight:     800,
            letterSpacing:  "-0.01em",
            color:          canClick ? "#021014" : "rgba(2,16,20,0.45)",
            background:     canClick
              ? "linear-gradient(135deg, #19F4D6, #36A8FF)"
              : "rgba(45,212,191,0.12)",
            border:         "1px solid rgba(255,255,255,0.18)",
            boxShadow:      canClick
              ? "0 14px 34px rgba(25,244,214,0.22), inset 0 1px 0 rgba(255,255,255,0.28)"
              : "none",
            borderRadius:   3,
            cursor:         canClick ? "pointer" : "not-allowed",
            opacity:        (!ready && !generating && !comingSoon) ? 0.45 : 1,
            filter:         (!ready && !generating && !comingSoon) ? "grayscale(0.35)" : "none",
            transition:     "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={e => {
            if (canClick) {
              (e.currentTarget as HTMLElement).style.transform  = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 18px 42px rgba(25,244,214,0.28), inset 0 1px 0 rgba(255,255,255,0.34)";
            }
          }}
          onMouseLeave={e => {
            if (canClick) {
              (e.currentTarget as HTMLElement).style.transform  = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 14px 34px rgba(25,244,214,0.22), inset 0 1px 0 rgba(255,255,255,0.28)";
            }
          }}
        >
          {generating ? (
            <>
              {/* Spinner */}
              <div style={{
                width:           14,
                height:          14,
                borderRadius:    "50%",
                border:          "2px solid rgba(0,0,0,0.18)",
                borderTopColor:  "rgba(2,16,20,0.65)",
                animation:       "cgbSpin 0.7s linear infinite",
                flexShrink:      0,
              }} />
              Generating…
            </>
          ) : comingSoon ? (
            <>
              {/* Clock icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Coming Soon
            </>
          ) : (
            <>
              {/* Zap icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Generate Video
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes cgbSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
