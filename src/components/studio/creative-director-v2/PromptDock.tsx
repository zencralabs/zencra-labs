"use client";

/**
 * PromptDock — Phase B.2.7: Director Console upgrade.
 *
 * Layout (150px outer — unchanged so DIRECTOR_BOTTOM math stays correct):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Model Pills (scroll)    AssetTray  Quality  [— hide]   │  44px
 *   ├──────────────────────────────────────────────────────────┤  1px
 *   │  [textarea]                [AR] [N×]                     │  flex:1
 *   │  [@tag chips — 1 row]     [🎬 Refine Prompt] [▸ Gen]    │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Phase B.2.7 additions:
 *
 * Multiline textarea
 *   Input replaced with <textarea>. Enter = newline (native). Cmd/Ctrl+Enter
 *   calls onGenerate. resize: none. Fills available height via flexbox.
 *
 * Tag chips (compact, 1 row, max overflow hidden)
 *   Derived from STORE STATE — NOT text parsing:
 *   - One chip per element type present (@subject @world @atm @object)
 *   - @identity when mode === "locked"
 *   - @style when any refinement is set
 *   - @img1 @img2 @img3 from uploadedAssets (max 3)
 *   Chips sit inline below textarea, compact ~18px height strip.
 *
 * 🎬 Refine Prompt button
 *   Client-side cinematic rewrite of prompt text.
 *   Opens a glass preview card (position:absolute, bottom:calc(100%+8px),
 *   center-aligned, max-width 420px). Apply → setDirectInput. No API call.
 *   Separate from AI Assist Bar's "Direct Scene" — this rewrites prompt text
 *   while the AI Bar generates structural direction notes.
 *
 * Dock Hide / Mini mode
 *   — button in top row collapses dock to a 28px glass strip.
 *   — Mini strip: glass, "Open Console" label, hover glow.
 *   — When isGenerating, auto-restores (dock cannot be hidden during generation).
 *   — Outer container stays at 150px (no layout shift for AIAssistBar/DirectorPanel).
 *   — Background becomes transparent when hidden so canvas shows through.
 *
 * Visual hierarchy
 *   Subtle linear-gradient top shimmer. Input inner glow on focus.
 *   Row separator unchanged.
 *
 * Generation behavior
 *   All existing generate logic preserved. No backend changes.
 */

import { useState, useMemo, useEffect, useCallback }  from "react";
import {
  useDirectionStore,
  CD_MODELS,
  buildCharacterDirectionSuffix,
}                                                      from "@/lib/creative-director/store";
import { AssetTray }                                   from "./AssetTray";

// ─────────────────────────────────────────────────────────────────────────────

const COUNT_OPTIONS  = [1, 2, 4] as const;
const AR_OPTIONS     = ["1:1", "16:9", "9:16", "4:5"] as const;
const QUALITY_OPTIONS: Array<{ key: "standard" | "hd"; label: string }> = [
  { key: "standard", label: "STD" },
  { key: "hd",       label: "HD"  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface PromptDockProps {
  onGenerate:    (count: number, aspectRatio: string, quality?: string) => void;
  isFullscreen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper — deterministic prompt enrichment (no API, no credits)

function buildRefinedPrompt(
  promptText: string,
  elements:   { type: string; label: string; weight?: number | null }[],
  charSuffix: string
): string {
  const base        = promptText.trim();
  const subjects    = elements.filter((e) => e.type === "subject");
  const worlds      = elements.filter((e) => e.type === "world");
  const atmospheres = elements.filter((e) => e.type === "atmosphere");

  const parts: string[] = [];
  if (base) parts.push(base);

  if (subjects.length > 0) {
    parts.push(
      `${subjects.map((s) => s.label).join(" and ")} — sharp focal plane, motivated cinematic lighting`
    );
  }
  if (worlds.length > 0) {
    parts.push(`${worlds[0].label}, layered environmental depth`);
  }
  if (atmospheres.length > 0) {
    parts.push(`${atmospheres[0].label}, intentional color grade`);
  } else if (base || subjects.length > 0) {
    parts.push("high production value, cinematic composition");
  }
  if (charSuffix) parts.push(charSuffix);

  return parts.filter(Boolean).join(", ");
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
    uploadedAssets,
    refinements,
    characterDirection,
  } = useDirectionStore();

  const [count,        setCount]        = useState<1 | 2 | 4>(1);
  const [ar,           setAr]           = useState<string>("1:1");
  const [quality,      setQuality]      = useState<"standard" | "hd">("standard");
  const [directInput,  setDirectInput]  = useState("");
  const [genHover,     setGenHover]     = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Dock hide / mini mode
  const [dockHidden,   setDockHidden]   = useState(false);
  const [hideHovered,  setHideHovered]  = useState(false);

  // Refine Prompt card
  const [refineOpen,    setRefineOpen]    = useState(false);
  const [refinePreview, setRefinePreview] = useState("");
  const [refineHover,   setRefineHover]   = useState(false);

  // Auto-restore dock when generating (cannot hide during generation)
  useEffect(() => {
    if (isGenerating) setDockHidden(false);
  }, [isGenerating]);

  // ── Derived ───────────────────────────────────────────────────────────────
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

  const px = isFullscreen ? "24px" : "14px";

  // ── Tag chips — derived from store state, NOT text parsing ───────────────
  const tagChips = useMemo(() => {
    const chips: { label: string; color: string }[] = [];
    const presentTypes = new Set(elements.map((e) => e.type));

    if (presentTypes.has("subject"))    chips.push({ label: "@subject",  color: "rgba(59,130,246,0.8)"  });
    if (presentTypes.has("world"))      chips.push({ label: "@world",    color: "rgba(34,197,94,0.8)"   });
    if (presentTypes.has("atmosphere")) chips.push({ label: "@atmosphere", color: "rgba(139,92,246,0.8)"  });
    if (presentTypes.has("object"))     chips.push({ label: "@object",   color: "rgba(249,115,22,0.8)"  });
    if (isLocked)                       chips.push({ label: "@identity", color: "rgba(251,191,36,0.8)"  });

    // @style: any refinement key has a non-null/non-empty value
    const hasStyle = refinements != null && Object.values(refinements).some(
      (v) => v !== null && v !== undefined && v !== ""
    );
    if (hasStyle) chips.push({ label: "@style", color: "rgba(236,72,153,0.8)" });

    // @img1, @img2, @img3 from uploaded assets (max 3)
    (uploadedAssets ?? []).slice(0, 3).forEach((_, i) => {
      chips.push({ label: `@img${i + 1}`, color: "rgba(255,255,255,0.38)" });
    });

    return chips;
  }, [elements, isLocked, refinements, uploadedAssets]);

  // ── Refine Prompt ─────────────────────────────────────────────────────────
  const handleRefine = useCallback(() => {
    const suffix  = buildCharacterDirectionSuffix(characterDirection);
    const refined = buildRefinedPrompt(directInput, elements, suffix);
    setRefinePreview(refined);
    setRefineOpen(true);
  }, [directInput, elements, characterDirection]);

  const handleApplyRefine = useCallback(() => {
    setDirectInput(refinePreview);
    setRefineOpen(false);
  }, [refinePreview]);

  // ── Textarea key handler ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canGenerate) onGenerate(count, ar, quality);
      }
      // Plain Enter → native newline, no interception needed
    },
    [canGenerate, count, ar, quality, onGenerate]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height:          150,
        flexShrink:      0,
        position:        "relative",
        display:         "flex",
        flexDirection:   "column",
        borderTop:       dockHidden ? "none" : "1px solid rgba(255,255,255,0.07)",
        background:      dockHidden ? "transparent" : "rgba(6,6,9,0.99)",
        zIndex:          10,
        transition:      "background 0.3s ease",
        // Subtle top shimmer when visible
        ...(dockHidden ? {} : {
          backgroundImage:  "linear-gradient(to bottom, rgba(255,255,255,0.018) 0%, transparent 40%)",
          backgroundRepeat: "no-repeat",
          backgroundSize:   "100% 44px",
        }),
      }}
    >
      {/* ── Refine Prompt preview card ─────────────────────────────────── */}
      {refineOpen && (
        <div
          style={{
            position:             "absolute",
            bottom:               "calc(100% + 8px)",
            left:                 "50%",
            transform:            "translateX(-50%)",
            width:                "calc(100% - 28px)",
            maxWidth:             420,
            background:           "rgba(8,6,18,0.97)",
            border:               "1px solid rgba(255,255,255,0.09)",
            borderRadius:         14,
            backdropFilter:       "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow:            "0 8px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding:              "14px 16px",
            zIndex:               40,
            animation:            "cd-slide-up 0.2s ease",
          }}
        >
          <div style={{
            fontSize:      10,
            fontFamily:    "var(--font-sans)",
            color:         "rgba(255,255,255,0.42)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom:  10,
          }}>
            🎬 Refine Prompt Preview
          </div>
          <p style={{
            fontSize:   13,
            fontFamily: "var(--font-sans)",
            color:      "rgba(255,255,255,0.8)",
            lineHeight: 1.6,
            margin:     "0 0 12px",
            wordBreak:  "break-word",
          }}>
            {refinePreview || "Add a prompt or scene elements to refine."}
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => setRefineOpen(false)}
              onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              style={{
                background:    "transparent",
                border:        "1px solid rgba(255,255,255,0.1)",
                borderRadius:  8,
                color:         "rgba(255,255,255,0.35)",
                fontSize:      11,
                fontFamily:    "var(--font-sans)",
                padding:       "5px 14px",
                cursor:        "pointer",
                transition:    "color 0.15s ease",
              }}
            >
              Cancel
            </button>
            {refinePreview && (
              <button
                onClick={handleApplyRefine}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                style={{
                  background:    "linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(109,40,217,0.9) 100%)",
                  border:        "none",
                  borderRadius:  8,
                  color:         "white",
                  fontSize:      11,
                  fontFamily:    "var(--font-sans)",
                  fontWeight:    600,
                  padding:       "5px 16px",
                  cursor:        "pointer",
                  boxShadow:     "0 2px 12px rgba(139,92,246,0.35)",
                  transition:    "transform 0.15s ease",
                }}
              >
                Apply
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mini "Open Console" glass strip ───────────────────────────── */}
      {dockHidden ? (
        <div
          onClick={() => setDockHidden(false)}
          onMouseEnter={() => setHideHovered(true)}
          onMouseLeave={() => setHideHovered(false)}
          style={{
            position:             "absolute",
            top:                  0,
            left:                 0,
            right:                0,
            height:               28,
            display:              "flex",
            alignItems:           "center",
            justifyContent:       "center",
            gap:                  6,
            cursor:               "pointer",
            background:           hideHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
            borderTop:            `1px solid ${hideHovered ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.07)"}`,
            boxShadow:            hideHovered
              ? "0 0 20px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "inset 0 1px 0 rgba(255,255,255,0.03)",
            backdropFilter:       "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            transition:           "all 0.2s ease",
          }}
        >
          {/* Up chevron */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.45 }}>
            <path d="M2 6.5L5 3.5L8 6.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            fontSize:      9,
            fontFamily:    "var(--font-sans)",
            color:         hideHovered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            transition:    "color 0.2s ease",
          }}>
            Open Console
          </span>
        </div>
      ) : (
        /* ── Full dock content ──────────────────────────────────────────── */
        <>
          {/* ── Top row: model pills + AssetTray + quality + hide ──────── */}
          <div
            style={{
              height:     44,
              flexShrink: 0,
              display:    "flex",
              alignItems: "center",
              gap:        8,
              padding:    `0 ${px}`,
              overflow:   "hidden",
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

            {/* Asset tray */}
            <AssetTray />

            {/* Quality toggle */}
            <div style={{
              display:      "flex",
              gap:          2,
              background:   "rgba(255,255,255,0.03)",
              border:       "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding:      2,
              flexShrink:   0,
            }}>
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

            {/* Hide / minimize button — disabled during generation */}
            {!isGenerating && (
              <button
                onClick={() => setDockHidden(true)}
                title="Minimize console  (click strip to restore)"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color        = "rgba(255,255,255,0.6)";
                  e.currentTarget.style.borderColor  = "rgba(255,255,255,0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color        = "rgba(255,255,255,0.25)";
                  e.currentTarget.style.borderColor  = "rgba(255,255,255,0.08)";
                }}
                style={{
                  background:    "transparent",
                  border:        "1px solid rgba(255,255,255,0.08)",
                  borderRadius:  6,
                  color:         "rgba(255,255,255,0.25)",
                  fontSize:      12,
                  fontFamily:    "var(--font-sans)",
                  cursor:        "pointer",
                  padding:       "2px 8px",
                  flexShrink:    0,
                  lineHeight:    1,
                  transition:    "all 0.15s ease",
                }}
              >
                —
              </button>
            )}
          </div>

          {/* ── Row divider ──────────────────────────────────────────────── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />

          {/* ── Bottom row: input column + right controls ────────────────── */}
          <div
            style={{
              flex:        1,
              display:     "flex",
              alignItems:  "flex-start",
              gap:         10,
              padding:     `9px ${px} 10px`,
            }}
          >
            {/* ── Left: textarea + tag chips ───────────────────────────── */}
            <div
              style={{
                flex:          1,
                alignSelf:     "stretch",
                display:       "flex",
                flexDirection: "column",
                gap:           5,
              }}
            >
              <textarea
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Direct scene… (Cmd+Enter to generate)"
                style={{
                  flex:          1,
                  width:         "100%",
                  boxSizing:     "border-box",
                  resize:        "none",
                  background:    inputFocused ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
                  border:        `1px solid ${inputFocused ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius:  10,
                  color:         "rgba(255,255,255,0.85)",
                  fontSize:      13,
                  fontFamily:    "var(--font-sans)",
                  lineHeight:    1.55,
                  padding:       "9px 12px",
                  outline:       "none",
                  scrollbarWidth:"none",
                  transition:    "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
                  boxShadow:     inputFocused
                    ? "0 0 0 3px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : "inset 0 1px 0 rgba(255,255,255,0.025)",
                }}
              />

              {/* Tag chips — compact single row, derived from store state */}
              {tagChips.length > 0 && (
                <div
                  style={{
                    display:    "flex",
                    gap:        4,
                    overflow:   "hidden",
                    flexWrap:   "nowrap",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {tagChips.map((chip, i) => {
                    // Convert "rgba(r,g,b,0.8)" → "rgba(r,g,b,X)" safely
                    const dimBg  = chip.color.replace(/[\d.]+\)$/, "0.09)");
                    const dimBdr = chip.color.replace(/[\d.]+\)$/, "0.2)");
                    return (
                      <span
                        key={i}
                        style={{
                          fontSize:      9,
                          fontFamily:    "var(--font-sans)",
                          fontWeight:    500,
                          color:         chip.color,
                          background:    dimBg,
                          border:        `1px solid ${dimBdr}`,
                          borderRadius:  100,
                          padding:       "1px 7px",
                          letterSpacing: "0.04em",
                          whiteSpace:    "nowrap",
                          flexShrink:    0,
                          lineHeight:    1.6,
                        }}
                      >
                        {chip.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right: controls column ──────────────────────────────── */}
            <div
              style={{
                display:        "flex",
                flexDirection:  "column",
                gap:            6,
                flexShrink:     0,
                alignSelf:      "stretch",
                justifyContent: "space-between",
              }}
            >
              {/* AR + Count row */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                {/* Aspect Ratio */}
                <div style={{
                  display:      "flex",
                  gap:          2,
                  background:   "rgba(255,255,255,0.03)",
                  border:       "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9,
                  padding:      2,
                  alignItems:   "center",
                }}>
                  {AR_OPTIONS.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAr(ratio)}
                      style={{
                        background:    ar === ratio ? "rgba(255,255,255,0.09)" : "transparent",
                        border:        "none",
                        borderRadius:  6,
                        color:         ar === ratio ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.28)",
                        fontSize:      10,
                        fontFamily:    "var(--font-sans)",
                        cursor:        "pointer",
                        padding:       "3px 8px",
                        transition:    "all 0.15s ease",
                        letterSpacing: "0.02em",
                        whiteSpace:    "nowrap",
                      }}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                {/* Count */}
                <div style={{
                  display:      "flex",
                  gap:          2,
                  background:   "rgba(255,255,255,0.03)",
                  border:       "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9,
                  padding:      2,
                  alignItems:   "center",
                }}>
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n as 1 | 2 | 4)}
                      style={{
                        background:   count === n
                          ? (isLocked ? "rgba(251,191,36,0.15)" : "rgba(139,92,246,0.15)")
                          : "transparent",
                        border:       "none",
                        borderRadius: 6,
                        color:        count === n
                          ? (isLocked ? "rgba(251,191,36,1)" : "rgba(139,92,246,1)")
                          : "rgba(255,255,255,0.28)",
                        fontSize:     11,
                        fontFamily:   "var(--font-sans)",
                        fontWeight:   count === n ? 700 : 400,
                        cursor:       "pointer",
                        padding:      "3px 10px",
                        transition:   "all 0.15s ease",
                      }}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>

              {/* 🎬 Refine Prompt + Generate row */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                {/* Refine Prompt button */}
                <button
                  onClick={handleRefine}
                  onMouseEnter={() => setRefineHover(true)}
                  onMouseLeave={() => setRefineHover(false)}
                  style={{
                    background:    refineHover
                      ? "rgba(139,92,246,0.12)"
                      : "rgba(255,255,255,0.04)",
                    border:        `1px solid ${refineHover ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius:  10,
                    color:         refineHover
                      ? "rgba(139,92,246,0.9)"
                      : "rgba(255,255,255,0.4)",
                    fontSize:      11,
                    fontFamily:    "var(--font-sans)",
                    cursor:        "pointer",
                    padding:       "0 14px",
                    height:        42,
                    display:       "flex",
                    alignItems:    "center",
                    gap:           5,
                    whiteSpace:    "nowrap",
                    transition:    "all 0.15s ease",
                    letterSpacing: "0.02em",
                    flexShrink:    0,
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>🎬</span>
                  Refine Prompt
                </button>

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
                    height:        42,
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
                      <div style={{
                        width: 13, height: 13, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.25)",
                        borderTopColor: "white",
                        animation: "cd-spin 0.7s linear infinite",
                        flexShrink: 0,
                      }} />
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
          </div>
        </>
      )}
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
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "rgba(139,92,246,1)", flexShrink: 0,
          boxShadow: "0 0 6px rgba(139,92,246,1)",
        }} />
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
