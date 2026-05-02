"use client";

/**
 * PromptDock — 124px premium generate bar.
 *
 * Layout (124px total):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Model Pills (scrollable)           Quality Toggle   │  ← 44px
 *   ├──────────────────────────────────────────────────────┤  ← 1px divider
 *   │  Direct scene input (flex:1)  [ AR ] [ 1× ] [▸ Gen] │  ← 79px
 *   └──────────────────────────────────────────────────────┘
 *
 * Model pills: CD_MODELS active/soon pills, horizontally scrollable.
 * Quality: standard / hd — two-pill toggle.
 * Generate button: 52px, gradient CTA, glow pulse when idle.
 */

import { useState }                        from "react";
import { useDirectionStore, CD_MODELS }    from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

const COUNT_OPTIONS  = [1, 2, 4] as const;
const AR_OPTIONS     = ["1:1", "16:9", "9:16", "4:5"] as const;
const QUALITY_OPTIONS: Array<{ key: "standard" | "hd"; label: string }> = [
  { key: "standard", label: "STD"  },
  { key: "hd",       label: "HD"   },
];

interface PromptDockProps {
  onGenerate:    (count: number, aspectRatio: string, quality?: string) => void;
  isFullscreen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

export function PromptDock({ onGenerate, isFullscreen }: PromptDockProps) {
  const {
    isGenerating,
    mode,
    sceneIntent,
    elements,
    directionCreated,
    selectedModel,
    setSelectedModel,
  } = useDirectionStore();

  const [count,         setCount]         = useState<1 | 2 | 4>(1);
  const [ar,            setAr]            = useState<string>("1:1");
  const [quality,       setQuality]       = useState<"standard" | "hd">("standard");
  const [directInput,   setDirectInput]   = useState("");
  const [genHover,      setGenHover]      = useState(false);
  const [inputFocused,  setInputFocused]  = useState(false);

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
        height:          150,
        flexShrink:      0,
        display:         "flex",
        flexDirection:   "column",
        borderTop:       "1px solid rgba(255,255,255,0.07)",
        background:      "rgba(6,6,9,0.99)",
        zIndex:          10,
        boxShadow:       "0 -1px 0 rgba(255,255,255,0.04)",
        transition:      "height 0.3s ease",
      }}
    >
      {/* ── Top row: model pills + quality ──────────────────────────────── */}
      <div
        style={{
          height:      44,
          flexShrink:  0,
          display:     "flex",
          alignItems:  "center",
          gap:         8,
          padding:     isFullscreen ? "0 24px" : "0 14px",
          overflow:    "hidden",
        }}
      >
        {/* Scrollable model pills */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            alignItems:     "center",
            gap:            5,
            overflowX:      "auto",
            scrollbarWidth: "none",
            paddingRight:   4,
          }}
        >
          {CD_MODELS.map((m) => (
            <ModelPill
              key={m.key}
              modelKey={m.key}
              label={m.label}
              active={selectedModel === m.key}
              disabled={!m.active}
              soon={m.soon}
              onClick={() => m.active && setSelectedModel(m.key)}
            />
          ))}
        </div>

        {/* Quality toggle */}
        <div
          style={{
            display:      "flex",
            gap:          2,
            background:   "rgba(255,255,255,0.03)",
            border:       "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            padding:      2,
            flexShrink:   0,
          }}
        >
          {QUALITY_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setQuality(key)}
              className="cd-model-pill"
              style={{
                background:    quality === key ? "rgba(255,255,255,0.1)" : "transparent",
                border:        `1px solid ${quality === key ? "rgba(255,255,255,0.18)" : "transparent"}`,
                borderRadius:  6,
                color:         quality === key ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                fontSize:      9,
                fontFamily:    "var(--font-sans)",
                fontWeight:    quality === key ? 700 : 400,
                cursor:        "pointer",
                padding:       "3px 9px",
                letterSpacing: "0.07em",
                transition:    "all 0.15s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row divider ─────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />

      {/* ── Bottom row: input + AR + count + generate ───────────────────── */}
      <div
        style={{
          flex:        1,
          display:     "flex",
          alignItems:  "center",
          gap:         10,
          padding:     isFullscreen ? "0 24px" : "0 14px",
        }}
      >
        {/* Direct Scene input */}
        <div style={{ flex: 1, position: "relative" }}>
          <input
            value={directInput}
            onChange={(e) => setDirectInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onGenerate(count, ar, quality); }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Direct scene… add a free prompt to guide this generation"
            style={{
              width:        "100%",
              boxSizing:    "border-box",
              background:   inputFocused ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
              border:       `1px solid ${inputFocused ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10,
              color:        "rgba(255,255,255,0.85)",
              fontSize:     14,
              fontFamily:   "var(--font-sans)",
              padding:      "0 16px",
              minHeight:    62,
              outline:      "none",
              transition:   "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
              boxShadow:    inputFocused ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
            }}
          />
        </div>

        {/* Aspect Ratio */}
        <div
          style={{
            display:      "flex",
            gap:          2,
            background:   "rgba(255,255,255,0.03)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding:      3,
            height:       54,
            alignItems:   "center",
            flexShrink:   0,
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
                padding:       "4px 9px",
                transition:    "all 0.15s ease",
                letterSpacing: "0.02em",
                height:        44,
                whiteSpace:    "nowrap",
              }}
            >
              {ratio}
            </button>
          ))}
        </div>

        {/* Count selector */}
        <div
          style={{
            display:      "flex",
            gap:          2,
            background:   "rgba(255,255,255,0.03)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding:      3,
            height:       54,
            alignItems:   "center",
            flexShrink:   0,
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
                padding:      "4px 12px",
                transition:   "all 0.15s ease",
                height:       44,
              }}
            >
              {n}×
            </button>
          ))}
        </div>

        {/* Generate CTA */}
        <button
          onClick={() => canGenerate && onGenerate(count, ar, quality)}
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
            padding:       "0 26px",
            height:        58,
            display:       "flex",
            alignItems:    "center",
            gap:           8,
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
                  width: 14, height: 14, borderRadius: "50%",
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
                ? <span style={{ fontSize: 12 }}>🔒</span>
                : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7h9M8 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              }
              Generate
              <span style={{
                fontSize:   9,
                color:      !canGenerate ? "rgba(255,255,255,0.15)" : isLocked ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}>
                {count}×
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ModelPill({
  modelKey, label, active, disabled, soon, onClick,
}: {
  modelKey: string;
  label:    string;
  active:   boolean;
  disabled: boolean;
  soon?:    boolean;
  onClick:  () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      disabled={disabled}
      title={modelKey}
      style={{
        background:    active
          ? "rgba(139,92,246,0.18)"
          : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border:        `1px solid ${
          active
            ? "rgba(139,92,246,0.45)"
            : hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"
        }`,
        borderRadius:  100,
        color:         active
          ? "rgba(139,92,246,1)"
          : disabled ? "rgba(255,255,255,0.2)" : hov ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)",
        fontSize:      10,
        fontFamily:    "var(--font-sans)",
        fontWeight:    active ? 700 : 400,
        cursor:        disabled ? "not-allowed" : "pointer",
        padding:       "3px 10px",
        whiteSpace:    "nowrap",
        flexShrink:    0,
        letterSpacing: "0.03em",
        display:       "flex",
        alignItems:    "center",
        gap:           5,
        transition:    "all 0.15s ease",
        boxShadow:     active ? "0 0 10px rgba(139,92,246,0.25)" : "none",
      }}
    >
      {active && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(139,92,246,1)", flexShrink: 0, boxShadow: "0 0 6px rgba(139,92,246,1)" }} />
      )}
      {label}
      {soon && (
        <span style={{
          fontSize:      7,
          background:    "rgba(255,255,255,0.08)",
          border:        "1px solid rgba(255,255,255,0.12)",
          borderRadius:  4,
          padding:       "1px 4px",
          color:         "rgba(255,255,255,0.3)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          Soon
        </span>
      )}
    </button>
  );
}
