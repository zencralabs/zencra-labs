"use client";

/**
 * PromptDock — 80px premium generate bar.
 *
 * [  Direct scene… freetext input (flex:1)  ]  [ AR ]  [ 1× 2× 4× ]  [▸ Generate]
 *
 * Generate button: 52px height, gradient CTA, glow pulse animation when idle.
 * Direct Scene input: 48px height, larger font, premium focus ring.
 */

import { useState }          from "react";
import { useDirectionStore } from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

const COUNT_OPTIONS = [1, 2, 4] as const;
const AR_OPTIONS    = ["1:1", "16:9", "9:16", "4:5"] as const;

interface PromptDockProps {
  onGenerate:   (count: number, aspectRatio: string) => void;
  isFullscreen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

export function PromptDock({ onGenerate, isFullscreen }: PromptDockProps) {
  const { isGenerating, mode, sceneIntent, elements, directionCreated } = useDirectionStore();

  const [count, setCount]           = useState<1 | 2 | 4>(1);
  const [ar, setAr]                 = useState<string>("1:1");
  const [directInput, setDirectInput] = useState("");
  const [genHover, setGenHover]     = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const canGenerate =
    !isGenerating &&
    (directionCreated || sceneIntent.text.trim().length > 0 || elements.length > 0);

  const isLocked = mode === "locked";

  const genBg = !canGenerate
    ? "rgba(255,255,255,0.05)"
    : isLocked
      ? `linear-gradient(135deg, rgba(251,191,36,${genHover ? "1" : "0.92"}) 0%, rgba(217,119,6,${genHover ? "1" : "0.92"}) 100%)`
      : `linear-gradient(135deg, rgba(139,92,246,${genHover ? "1" : "0.92"}) 0%, rgba(109,40,217,${genHover ? "1" : "0.92"}) 100%)`;

  const genGlow = !canGenerate ? "none"
    : isLocked
      ? "0 0 32px rgba(251,191,36,0.4), 0 6px 24px rgba(0,0,0,0.5)"
      : "0 0 32px rgba(139,92,246,0.4), 0 6px 24px rgba(0,0,0,0.5)";

  const genAnimation = canGenerate && !isGenerating
    ? (isLocked ? "cd-locked-pulse 3s ease-in-out infinite" : "cd-generate-pulse 3s ease-in-out infinite")
    : "none";

  return (
    <div
      style={{
        height:          isFullscreen ? 88 : 80,
        flexShrink:      0,
        display:         "flex",
        alignItems:      "center",
        gap:             10,
        padding:         isFullscreen ? "0 24px" : "0 16px",
        borderTop:       "1px solid rgba(255,255,255,0.07)",
        background:      "rgba(6,6,9,0.99)",
        zIndex:          10,
        boxShadow:       "0 -1px 0 rgba(255,255,255,0.04)",
        transition:      "height 0.3s ease, padding 0.3s ease",
      }}
    >
      {/* ── Direct Scene input ──────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <input
          value={directInput}
          onChange={(e) => setDirectInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onGenerate(count, ar); }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Direct scene… add a free prompt to guide this generation"
          style={{
            width:          "100%",
            boxSizing:      "border-box",
            background:     inputFocused ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
            border:         `1px solid ${inputFocused ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
            borderRadius:   10,
            color:          "rgba(255,255,255,0.85)",
            fontSize:       14,
            fontFamily:     "var(--font-sans)",
            padding:        "0 16px",
            height:         48,
            outline:        "none",
            transition:     "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
            boxShadow:      inputFocused ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
          }}
        />
      </div>

      {/* ── Aspect Ratio ────────────────────────────────────────────────── */}
      <div
        style={{
          display:       "flex",
          gap:           2,
          background:    "rgba(255,255,255,0.03)",
          border:        "1px solid rgba(255,255,255,0.08)",
          borderRadius:  10,
          padding:       "3px",
          height:        48,
          alignItems:    "center",
        }}
      >
        {AR_OPTIONS.map((ratio) => (
          <button
            key={ratio}
            onClick={() => setAr(ratio)}
            style={{
              background:    ar === ratio ? "rgba(255,255,255,0.09)" : "transparent",
              border:        "none",
              borderRadius:  7,
              color:         ar === ratio ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
              fontSize:      11,
              fontFamily:    "var(--font-sans)",
              cursor:        "pointer",
              padding:       "5px 9px",
              transition:    "all 0.15s ease",
              letterSpacing: "0.02em",
              height:        38,
            }}
          >
            {ratio}
          </button>
        ))}
      </div>

      {/* ── Count selector ──────────────────────────────────────────────── */}
      <div
        style={{
          display:    "flex",
          gap:        2,
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding:    3,
          height:     48,
          alignItems: "center",
        }}
      >
        {COUNT_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setCount(n as 1 | 2 | 4)}
            style={{
              background:   count === n
                ? (isLocked ? "rgba(251,191,36,0.15)" : "rgba(139,92,246,0.15)")
                : "transparent",
              border:       "none",
              borderRadius: 7,
              color:        count === n
                ? (isLocked ? "rgba(251,191,36,1)" : "rgba(139,92,246,1)")
                : "rgba(255,255,255,0.3)",
              fontSize:     12,
              fontFamily:   "var(--font-sans)",
              fontWeight:   count === n ? 700 : 400,
              cursor:       "pointer",
              padding:      "5px 11px",
              transition:   "all 0.15s ease",
              height:       38,
            }}
          >
            {n}×
          </button>
        ))}
      </div>

      {/* ── Generate CTA ────────────────────────────────────────────────── */}
      <button
        onClick={() => canGenerate && onGenerate(count, ar)}
        disabled={!canGenerate}
        onMouseEnter={() => setGenHover(true)}
        onMouseLeave={() => setGenHover(false)}
        style={{
          background:    genBg,
          border:        "none",
          borderRadius:  12,
          color:         !canGenerate ? "rgba(255,255,255,0.2)" : "white",
          fontSize:      14,
          fontFamily:    "var(--font-display)",
          fontWeight:    700,
          cursor:        canGenerate ? "pointer" : "not-allowed",
          padding:       "0 28px",
          height:        52,
          display:       "flex",
          alignItems:    "center",
          gap:           9,
          whiteSpace:    "nowrap",
          letterSpacing: "0.02em",
          transition:    "transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease",
          transform:     genHover && canGenerate ? "translateY(-2px)" : "translateY(0)",
          boxShadow:     genGlow,
          animation:     genAnimation,
          flexShrink:    0,
        }}
      >
        {isGenerating ? (
          <>
            <div
              style={{
                width: 16, height: 16, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.25)",
                borderTopColor: "white",
                animation: "cd-spin 0.7s linear infinite",
                flexShrink: 0,
              }}
            />
            Generating…
          </>
        ) : (
          <>
            {isLocked
              ? <span style={{ fontSize: 14 }}>🔒</span>
              : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            }
            Generate
            <span
              style={{
                fontSize:   10,
                color:      !canGenerate ? "rgba(255,255,255,0.15)" : isLocked ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}
            >
              {count}×
            </span>
          </>
        )}
      </button>
    </div>
  );
}
