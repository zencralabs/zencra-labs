"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmptyStateMascot — Premium canvas empty state with Zencra mascot
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onUpload?: () => void;
  onSamplePrompt?: () => void;
  /** Current cinematic sample prompt to preview — rotates on each click */
  samplePrompt?: string;
}

// Inline SVG mascot — stylized clapperboard with teal/blue glow identity
function ZencraClapperMascot() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer glow */}
      <circle cx="48" cy="48" r="46" fill="url(#mascotGlow)" opacity="0.15" />

      {/* Clapperboard body */}
      <rect x="16" y="34" width="64" height="46" rx="8" fill="rgba(14,165,160,0.12)" stroke="#0EA5A0" strokeWidth="1.5" />

      {/* Clapperboard top stripe bar */}
      <rect x="16" y="20" width="64" height="18" rx="6" fill="rgba(14,165,160,0.2)" stroke="#0EA5A0" strokeWidth="1.5" />

      {/* Diagonal stripes on top bar */}
      <clipPath id="barClip">
        <rect x="16" y="20" width="64" height="18" rx="6" />
      </clipPath>
      <g clipPath="url(#barClip)">
        <line x1="30" y1="20" x2="22" y2="38" stroke="#0EA5A0" strokeWidth="3.5" opacity="0.5" />
        <line x1="44" y1="20" x2="36" y2="38" stroke="#0EA5A0" strokeWidth="3.5" opacity="0.5" />
        <line x1="58" y1="20" x2="50" y2="38" stroke="#0EA5A0" strokeWidth="3.5" opacity="0.5" />
        <line x1="72" y1="20" x2="64" y2="38" stroke="#0EA5A0" strokeWidth="3.5" opacity="0.5" />
        <line x1="86" y1="20" x2="78" y2="38" stroke="#0EA5A0" strokeWidth="3.5" opacity="0.5" />
      </g>

      {/* "Clapper" hinge dots */}
      <circle cx="16" cy="29" r="4" fill="#0EA5A0" opacity="0.7" />
      <circle cx="80" cy="29" r="4" fill="#0EA5A0" opacity="0.7" />

      {/* Play button triangle inside body */}
      <path
        d="M40 46 L40 68 L62 57 Z"
        fill="url(#playGrad)"
        opacity="0.9"
      />

      {/* Subtle film dots inside body */}
      <circle cx="28" cy="57" r="2.5" fill="rgba(14,165,160,0.25)" />
      <circle cx="28" cy="68" r="2.5" fill="rgba(14,165,160,0.25)" />
      <circle cx="69" cy="57" r="2.5" fill="rgba(37,99,235,0.25)" />
      <circle cx="69" cy="68" r="2.5" fill="rgba(37,99,235,0.25)" />

      {/* Small sparkle top-right */}
      <g opacity="0.7">
        <line x1="76" y1="10" x2="76" y2="16" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="73" y1="13" x2="79" y2="13" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g opacity="0.5">
        <line x1="84" y1="5" x2="84" y2="9" stroke="#0EA5A0" strokeWidth="1" strokeLinecap="round" />
        <line x1="82" y1="7" x2="86" y2="7" stroke="#0EA5A0" strokeWidth="1" strokeLinecap="round" />
      </g>

      {/* Gradient defs */}
      <defs>
        <radialGradient id="mascotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0EA5A0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="playGrad" x1="40" y1="46" x2="62" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5A0" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function VideoEmptyStateMascot({ onUpload, onSamplePrompt, samplePrompt }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        height: "100%",
        padding: "40px 32px",
        textAlign: "center",
        userSelect: "none",
      }}
    >
      {/* Mascot with halo rings */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 36,
        }}
      >
        {/* Outer halo */}
        <div
          style={{
            position: "absolute",
            width: 184,
            height: 184,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,160,0.07) 0%, transparent 70%)",
            border: "1px solid rgba(14,165,160,0.10)",
          }}
        />
        {/* Inner halo */}
        <div
          style={{
            position: "absolute",
            width: 148,
            height: 148,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,160,0.10) 0%, transparent 70%)",
            border: "1px solid rgba(14,165,160,0.15)",
          }}
        />
        {/* Mascot icon */}
        <div
          style={{
            width: 110,
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 0 28px rgba(14,165,160,0.40))",
          }}
        >
          <ZencraClapperMascot />
        </div>
      </div>

      {/* Headline */}
      <h2
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "#F1F5F9",
          margin: "0 0 12px",
          letterSpacing: "-0.025em",
          lineHeight: 1.15,
        }}
      >
        Create cinematic AI videos
      </h2>

      {/* Subtext */}
      <p
        style={{
          fontSize: 16,
          color: "#64748B",
          margin: "0 0 36px",
          maxWidth: 380,
          lineHeight: 1.65,
        }}
      >
        Start with a prompt or upload a reference frame to guide your generation
      </p>

      {/* CTA Buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={onUpload}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 26px",
            borderRadius: 10,
            border: "1px solid rgba(14,165,160,0.40)",
            background: "rgba(14,165,160,0.09)",
            color: "#0EA5A0",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(14,165,160,0.15)";
            el.style.borderColor = "rgba(14,165,160,0.55)";
            el.style.boxShadow = "0 0 20px rgba(14,165,160,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(14,165,160,0.08)";
            el.style.borderColor = "rgba(14,165,160,0.35)";
            el.style.boxShadow = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          Upload Image
        </button>

        <button
          onClick={onSamplePrompt}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 26px",
            borderRadius: 10,
            border: "1px solid rgba(37,99,235,0.38)",
            background: "rgba(37,99,235,0.09)",
            color: "#60A5FA",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(37,99,235,0.15)";
            el.style.borderColor = "rgba(37,99,235,0.55)";
            el.style.boxShadow = "0 0 20px rgba(37,99,235,0.2)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(37,99,235,0.08)";
            el.style.borderColor = "rgba(37,99,235,0.35)";
            el.style.boxShadow = "none";
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Try Sample Prompt
        </button>
      </div>

      {/* Sample prompt preview + style chips */}
      {samplePrompt ? (
        <div style={{
          marginTop: 24,
          maxWidth: 400,
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(37,99,235,0.22)",
          background: "rgba(37,99,235,0.06)",
          fontSize: 13,
          color: "#94A3B8",
          lineHeight: 1.55,
          fontStyle: "italic",
          textAlign: "center",
        }}>
          &ldquo;{samplePrompt}&rdquo;
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 30, opacity: 0.65 }}>
          {["Cinematic", "Slow Motion", "Aerial Shot"].map(hint => (
            <span
              key={hint}
              style={{
                fontSize: 12,
                color: "#475569",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: "4px 12px",
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
