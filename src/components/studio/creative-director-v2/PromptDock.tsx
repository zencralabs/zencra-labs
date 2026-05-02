"use client";

/**
 * PromptDock — fixed bottom bar within the SceneCanvas center zone.
 *
 * Layout:
 *   [Direct Scene input (optional freetext)]   [1×] [2×] [4×]   [Generate ▸]
 *
 * "Direct Scene" is a supplemental prompt that gets appended to the
 * direction prompt built by buildDirectionPrompt. It is sent as part of
 * the request body for the generate route (handled on the API side).
 *
 * Count: 1, 2, or 4 outputs per generate call.
 * Aspect ratio selector: 1:1, 16:9, 9:16 (defaults to 1:1).
 *
 * The Generate button is always enabled when a directionId exists or
 * when sceneIntent text is non-empty (the shell will create direction lazily).
 */

import { useState }            from "react";
import { useDirectionStore }   from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

const COUNT_OPTIONS = [1, 2, 4] as const;
const AR_OPTIONS    = ["1:1", "16:9", "9:16", "4:5"] as const;

interface PromptDockProps {
  onGenerate: (count: number, aspectRatio: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function PromptDock({ onGenerate }: PromptDockProps) {
  const { isGenerating, mode, sceneIntent, elements, directionCreated } = useDirectionStore();

  const [count, setCount]         = useState<1 | 2 | 4>(1);
  const [ar, setAr]               = useState<string>("1:1");
  const [directInput, setDirectInput] = useState("");

  const canGenerate =
    !isGenerating &&
    (directionCreated || sceneIntent.text.trim().length > 0 || elements.length > 0);

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate(count, ar);
  };

  return (
    <div
      style={{
        height:         60,
        flexShrink:     0,
        display:        "flex",
        alignItems:     "center",
        gap:            8,
        padding:        "0 14px",
        borderTop:      "1px solid rgba(255,255,255,0.06)",
        background:     "rgba(8,8,10,0.98)",
        zIndex:         10,
      }}
    >
      {/* ── Direct Scene input ──────────────────────────────────────────── */}
      <input
        value={directInput}
        onChange={(e) => setDirectInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
        placeholder="Direct scene… (optional)"
        style={{
          flex:       1,
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          color:      "rgba(255,255,255,0.8)",
          fontSize:   13,
          fontFamily: "var(--font-sans)",
          padding:    "0 12px",
          height:     38,
          outline:    "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.35)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
      />

      {/* ── Aspect Ratio ────────────────────────────────────────────────── */}
      <div
        style={{
          display:    "flex",
          gap:        3,
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          padding:    3,
        }}
      >
        {AR_OPTIONS.map((ratio) => (
          <button
            key={ratio}
            onClick={() => setAr(ratio)}
            style={{
              background:   ar === ratio ? "rgba(255,255,255,0.08)" : "transparent",
              border:       "none",
              borderRadius: 5,
              color:        ar === ratio ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
              fontSize:     10,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              padding:      "4px 8px",
              transition:   "all 0.15s",
              letterSpacing: "0.02em",
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
          gap:        3,
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          padding:    3,
        }}
      >
        {COUNT_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setCount(n as 1 | 2 | 4)}
            style={{
              background:   count === n ? "rgba(139,92,246,0.15)" : "transparent",
              border:       "none",
              borderRadius: 5,
              color:        count === n ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.3)",
              fontSize:     11,
              fontFamily:   "var(--font-sans)",
              fontWeight:   count === n ? 600 : 400,
              cursor:       "pointer",
              padding:      "4px 9px",
              transition:   "all 0.15s",
            }}
          >
            {n}×
          </button>
        ))}
      </div>

      {/* ── Generate button ─────────────────────────────────────────────── */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        style={{
          background:   !canGenerate
            ? "rgba(255,255,255,0.04)"
            : mode === "locked"
              ? "linear-gradient(135deg, rgba(251,191,36,0.9) 0%, rgba(245,158,11,0.9) 100%)"
              : "linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(109,40,217,0.9) 100%)",
          border:       "none",
          borderRadius: 9,
          color:        !canGenerate ? "rgba(255,255,255,0.2)" : "white",
          fontSize:     13,
          fontFamily:   "var(--font-display)",
          fontWeight:   600,
          cursor:       canGenerate ? "pointer" : "not-allowed",
          padding:      "0 20px",
          height:       38,
          display:      "flex",
          alignItems:   "center",
          gap:          7,
          whiteSpace:   "nowrap",
          transition:   "all 0.2s",
          boxShadow:    canGenerate
            ? mode === "locked"
              ? "0 0 20px rgba(251,191,36,0.25)"
              : "0 0 20px rgba(139,92,246,0.25)"
            : "none",
        }}
      >
        {isGenerating ? (
          <>
            <span
              style={{
                width:        14,
                height:       14,
                borderRadius: "50%",
                border:       "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                animation:    "spin 0.7s linear infinite",
                flexShrink:   0,
              }}
            />
            Generating…
          </>
        ) : (
          <>
            {mode === "locked" ? "🔒" : "◎"} Generate
          </>
        )}
      </button>
    </div>
  );
}
