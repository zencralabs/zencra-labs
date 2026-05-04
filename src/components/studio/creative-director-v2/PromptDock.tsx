"use client";

/**
 * PromptDock — Phase B.2.7: Director Console upgrade.
 *
 * Layout (150px outer — unchanged so DIRECTOR_BOTTOM math stays correct):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Model Group Selector    AssetTray  Quality  [— hide]   │  44px
 *   ├──────────────────────────────────────────────────────────┤  1px
 *   │  [textarea]                [AR] [N×]                     │  flex:1
 *   │  [@tag chips — 1 row]     [🎬 Refine Prompt] [▸ Gen]    │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Usability pass (FIX 2 + FIX 3 + FIX 5):
 *
 * FIX 3 — ModelGroupSelector replaces horizontal pill scroll:
 *   4 brand group buttons (GPT Image, Nano Banana, Seedream, Flux).
 *   Each button shows the active model label if one from that group is
 *   selected, otherwise the brand name. Click → vertical dropdown listing
 *   all models in that group. Click-outside closes. 36px height, 14px text.
 *
 * FIX 2 — Typography upgrades:
 *   Textarea: 13→16px. Tag chips: 9→11px. Refine Prompt: 11→13px.
 *   Quality / AR / Count buttons: bumped to 11–12px.
 *
 * FIX 5 — Visual hierarchy color tokens:
 *   Textarea color → #E8ECF5. Active states use full role/accent colors.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useDirectionStore,
  CD_MODELS,
  STYLE_MOOD_PRESETS,
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

// Brand groups for the model selector.
// models[] order = oldest → newest (top → bottom when dropdown opens upward).
// defaultLabel = shown on the group button when no model from this group is selected.
const MODEL_GROUPS = [
  {
    key:          "gpt-image",
    label:        "GPT Image",
    defaultLabel: "GPT Image 2",
    models:       ["gpt-image-1", "gpt-image-2"] as const,
  },
  {
    key:          "nano-banana",
    label:        "Nano Banana",
    defaultLabel: "Nano Banana 2",
    models:       ["nano-banana-standard", "nano-banana-pro", "nano-banana-2"] as const,
  },
  {
    key:          "seedream",
    label:        "Seedream",
    defaultLabel: "Seedream 5.0 Lite",
    models:       ["seedream-4-5", "seedream-v5"] as const,
  },
  {
    key:          "flux",
    label:        "Flux",
    defaultLabel: "Flux.2 Max",
    models:       ["flux-kontext", "flux-2-image", "flux-2-max"] as const,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface PromptDockProps {
  onGenerate:         (count: number, aspectRatio: string, quality?: string, sceneOverride?: string) => void;
  isFullscreen?:      boolean;
  defaultAr?:         string;
  /** Controlled from CDv2Shell — true when the entire bottom stack is slid away */
  isMinimized?:       boolean;
  /** Fired when the dock's internal minimize button is clicked */
  onMinimizedChange?: (minimized: boolean) => void;
  /**
   * Phase 4.2 — Director Flow.
   * When true (a filled frame is selected), the Generate CTA changes label
   * to "Update Scene" to signal that generation will overwrite the existing result.
   * The underlying onGenerate logic is identical.
   */
  selectedFrameIsFilled?: boolean;
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

export function PromptDock({ onGenerate, isFullscreen, defaultAr, isMinimized, onMinimizedChange, selectedFrameIsFilled }: PromptDockProps) {
  const {
    isGenerating,
    mode,
    sceneIntent,
    elements,
    frames,
    connections,
    textNodes,
    selectedModel,
    setSelectedModel,
    uploadedAssets,
    refinements,
    characterDirection,
    activeStyleMood,
  } = useDirectionStore();

  const [count,        setCount]        = useState<1 | 2 | 4>(1);
  const [ar,           setAr]           = useState<string>("1:1");
  const [quality,      setQuality]      = useState<"standard" | "hd">("standard");
  const [directInput,  setDirectInput]  = useState("");
  const [genHover,     setGenHover]     = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Ref for tag chip click-to-insert (focus after appending tag text)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dock hide / mini mode
  const [dockHidden,   setDockHidden]   = useState(false);
  const [hideHovered,  setHideHovered]  = useState(false);

  // Sync: when parent (CDv2Shell) opens the dock via the shell-level mini strip,
  // reset internal dockHidden so the full console content shows.
  useEffect(() => {
    if (isMinimized === false) setDockHidden(false);
  }, [isMinimized]);

  // Refine Prompt card
  const [refineOpen,    setRefineOpen]    = useState(false);
  const [refinePreview, setRefinePreview] = useState("");
  const [refineHover,   setRefineHover]   = useState(false);

  // Sync AR from selected frame (one-way: frame → dock)
  useEffect(() => {
    if (defaultAr) setAr(defaultAr);
  }, [defaultAr]);

  // Auto-restore dock when generating (cannot hide during generation)
  useEffect(() => {
    if (isGenerating) setDockHidden(false);
  }, [isGenerating]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Signal-based: ANY meaningful input = allow generation.
  // This is a graph system — the button must activate the moment the user has
  // built something worth generating from, regardless of which signal they used.
  const hasFrame       = frames.length > 0;
  const hasConnections = connections.length > 0;
  const hasTextNode    = textNodes.some((t) => t.text.trim().length > 0);
  const hasSceneNodes  = elements.length > 0;
  const hasDirectInput = directInput.trim().length > 0;
  const hasSceneIntent = sceneIntent.text.trim().length > 0;

  const canGenerate =
    !isGenerating &&
    (hasFrame || hasConnections || hasTextNode || hasSceneNodes || hasDirectInput || hasSceneIntent);

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

    if (presentTypes.has("subject"))    chips.push({ label: "@subject",    color: "rgba(59,130,246,0.85)"  });
    if (presentTypes.has("world"))      chips.push({ label: "@world",      color: "rgba(34,197,94,0.85)"   });
    if (presentTypes.has("atmosphere")) chips.push({ label: "@atmosphere", color: "rgba(139,92,246,0.85)"  });
    if (presentTypes.has("object"))     chips.push({ label: "@object",     color: "rgba(249,115,22,0.85)"  });
    if (isLocked)                       chips.push({ label: "@identity",   color: "rgba(251,191,36,0.85)"  });

    // @style: any refinement key has a non-null/non-empty value
    const hasStyle = refinements != null && Object.values(refinements).some(
      (v) => v !== null && v !== undefined && v !== ""
    );
    if (hasStyle) chips.push({ label: "@style", color: "rgba(236,72,153,0.85)" });

    // @img1, @img2, @img3 from uploaded assets (max 3)
    (uploadedAssets ?? []).slice(0, 3).forEach((_, i) => {
      chips.push({ label: `@img${i + 1}`, color: "rgba(255,255,255,0.45)" });
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

  // ── Director active-state labels ─────────────────────────────────────────
  // Builds a compact label list from any active characterDirection field or
  // activeStyleMood. Capped at 4 entries for the narrow pill strip.
  const activeDirectorLabels = useMemo(() => {
    const labels: string[] = [];

    if (activeStyleMood) {
      const def = STYLE_MOOD_PRESETS.find((p) => p.key === activeStyleMood);
      if (def) labels.push(def.label);
    }

    const cd = characterDirection;
    if (cd) {
      if (cd.bodyView)       labels.push(cd.bodyView.replace(/-/g, " "));
      if (cd.headDirection)  labels.push(cd.headDirection.replace(/-/g, " "));
      if (cd.faceExpression) labels.push(cd.faceExpression.replace(/-/g, " "));
      if (cd.poseAction)     labels.push(cd.poseAction.replace(/-/g, " "));
      if (cd.eyeDirection)   labels.push(cd.eyeDirection.replace(/-/g, " "));
      if (cd.hairstyleLock)  labels.push("Hair Locked");
      if (cd.outfitLock)     labels.push("Outfit Locked");
    }

    return labels.slice(0, 4);
  }, [activeStyleMood, characterDirection]);

  // ── Textarea key handler ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canGenerate) onGenerate(count, ar, quality, directInput.trim() || undefined);
      }
      // Plain Enter → native newline, no interception needed
    },
    [canGenerate, count, ar, quality, directInput, onGenerate]
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
        borderTop:       dockHidden ? "none" : "1px solid rgba(120,160,255,0.25)",
        // Bottom border ensures the dock edge is always visible above the viewport floor
        borderBottom:    dockHidden ? "none" : "2px solid rgba(120,160,255,0.08)",
        background:      dockHidden ? "transparent" : "rgba(8,10,18,0.95)",
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
            background:           "rgba(8,10,18,0.97)",
            border:               "1px solid rgba(120,160,255,0.25)",
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
            fontSize:      11,
            fontFamily:    "var(--font-sans)",
            color:         "rgba(255,255,255,0.5)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom:  10,
          }}>
            🎬 Refine Prompt Preview
          </div>
          <p style={{
            fontSize:   14,
            fontFamily: "var(--font-sans)",
            color:      "#B8C0D4",
            lineHeight: 1.6,
            margin:     "0 0 12px",
            wordBreak:  "break-word",
          }}>
            {refinePreview || "Add a prompt or scene elements to refine."}
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => setRefineOpen(false)}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#B8C0D4"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              style={{
                background:    "transparent",
                border:        "1px solid rgba(255,255,255,0.1)",
                borderRadius:  8,
                color:         "rgba(255,255,255,0.35)",
                fontSize:      12,
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
                  fontSize:      12,
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
            borderTop:            `1px solid ${hideHovered ? "rgba(139,92,246,0.35)" : "rgba(120,160,255,0.18)"}`,
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
            fontSize:      10,
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
          {/* ── Top row: model group selector + AssetTray + quality + hide ── */}
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
            {/* FIX 3 — Brand-grouped model selector */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <ModelGroupSelector
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
              />
            </div>

            {/* Asset tray — click thumbnail to insert @imgN tag into prompt */}
            <AssetTray
              onInsertTag={(tag) => {
                const sep = directInput && !directInput.endsWith(" ") ? " " : "";
                setDirectInput((prev) => prev + sep + tag + " ");
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
            />

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
                    color:         quality === key ? "#E8ECF5" : "rgba(255,255,255,0.35)",
                    fontSize:      11,
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
                onClick={() => { setDockHidden(true); onMinimizedChange?.(true); }}
                title="Minimize console  (click strip to restore)"
                className="cd-btn-lift"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color        = "#B8C0D4";
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
              padding:     `9px ${px} 12px`,
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
              {/* FIX 2 — textarea 13→16px, color upgraded */}
              <textarea
                ref={textareaRef}
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
                  color:         "#E8ECF5",
                  fontSize:      16,
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

              {/* FIX 2 — Tag chips 9→11px, colors boosted */}
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
                    const dimBg  = chip.color.replace(/[\d.]+\)$/, "0.1)");
                    const dimBdr = chip.color.replace(/[\d.]+\)$/, "0.22)");
                    return (
                      <button
                        key={i}
                        className="cd-tag-chip"
                        title={`Insert ${chip.label} into prompt`}
                        onClick={() => {
                          // Append the tag to directInput, ensuring a space separator
                          const sep = directInput && !directInput.endsWith(" ") ? " " : "";
                          setDirectInput((prev) => prev + sep + chip.label + " ");
                          // Re-focus textarea so user can keep typing
                          setTimeout(() => textareaRef.current?.focus(), 0);
                        }}
                        style={{
                          fontSize:      11,
                          fontFamily:    "var(--font-sans)",
                          fontWeight:    500,
                          color:         chip.color,
                          background:    dimBg,
                          border:        `1px solid ${dimBdr}`,
                          borderRadius:  100,
                          padding:       "2px 8px",
                          letterSpacing: "0.03em",
                          whiteSpace:    "nowrap",
                          flexShrink:    0,
                          lineHeight:    1.6,
                          cursor:        "pointer",
                          transition:    "background 0.12s ease, box-shadow 0.12s ease",
                        }}
                      >
                        {chip.label}
                      </button>
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
                        color:         ar === ratio ? "#E8ECF5" : "rgba(255,255,255,0.32)",
                        fontSize:      12,
                        fontFamily:    "var(--font-sans)",
                        fontWeight:    ar === ratio ? 600 : 400,
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
                          : "rgba(255,255,255,0.32)",
                        fontSize:     12,
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

              {/* ── Director active-state strip ────────────────────── */}
              {activeDirectorLabels.length > 0 && (
                <div
                  style={{
                    display:    "flex",
                    gap:        4,
                    alignItems: "center",
                    overflow:   "hidden",
                    flexWrap:   "nowrap",
                  }}
                >
                  {activeDirectorLabels.map((label, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize:      8,
                        fontFamily:    "var(--font-sans)",
                        fontWeight:    600,
                        color:         "rgba(139,92,246,0.85)",
                        background:    "rgba(139,92,246,0.08)",
                        border:        "1px solid rgba(139,92,246,0.2)",
                        borderRadius:  100,
                        padding:       "2px 7px",
                        letterSpacing: "0.04em",
                        whiteSpace:    "nowrap",
                        textTransform: "capitalize" as const,
                        lineHeight:    1.5,
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* 🎬 Refine Prompt + Generate row */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                {/* FIX 2 — Refine Prompt button 11→13px */}
                <button
                  onClick={handleRefine}
                  onMouseEnter={() => setRefineHover(true)}
                  onMouseLeave={() => setRefineHover(false)}
                  className="cd-btn-lift"
                  style={{
                    background:    refineHover
                      ? "rgba(139,92,246,0.12)"
                      : "rgba(255,255,255,0.04)",
                    border:        `1px solid ${refineHover ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius:  10,
                    color:         refineHover
                      ? "rgba(139,92,246,0.95)"
                      : "#9AA3B2",
                    fontSize:      13,
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
                  <span style={{ fontSize: 14, lineHeight: 1 }}>🎬</span>
                  Refine Prompt
                </button>

                {/* Generate CTA */}
                <button
                  onClick={() => canGenerate && onGenerate(count, ar, quality, directInput.trim() || undefined)}
                  disabled={!canGenerate}
                  onMouseEnter={() => setGenHover(true)}
                  onMouseLeave={() => setGenHover(false)}
                  className={canGenerate ? "cd-btn-lift" : undefined}
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
                    transition:    "box-shadow 0.2s ease, background 0.2s ease",
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
                      {selectedFrameIsFilled ? "Update Scene" : "Generate"}
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
// FIX 3 — ModelGroupSelector: brand-grouped dropdown selector
//
// Dropdown renders via createPortal into document.body (position:fixed) to
// fully escape any parent overflow:hidden / stacking-context clipping.
// Opens on mouseenter, closes on mouseleave (150ms grace delay so the cursor
// can move from the button into the dropdown without it disappearing).

function ModelGroupSelector({
  selectedModel,
  setSelectedModel,
}: {
  selectedModel: string;
  setSelectedModel: (key: string) => void;
}) {
  const [openGroup,  setOpenGroup]  = useState<string | null>(null);
  const [portalPos,  setPortalPos]  = useState<{ bottom: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRefs    = useRef<Record<string, HTMLButtonElement | null>>({});

  // Clear any pending close timer
  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Schedule a close after 150 ms (cancelled if cursor re-enters)
  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpenGroup(null), 150);
  };

  // Open a group and record where to paint the portal dropdown
  const openDropdown = (groupKey: string) => {
    clearClose();
    const btn = btnRefs.current[groupKey];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPortalPos({
        // "bottom" in fixed coords = distance from viewport bottom to button top − 8px gap
        bottom: window.innerHeight - rect.top + 8,
        left:   rect.left,
      });
    }
    setOpenGroup(groupKey);
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearClose(), []);

  const currentGroup = MODEL_GROUPS.find((g) => g.key === openGroup);

  return (
    <>
      {/* ── Group button row ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {MODEL_GROUPS.map((group) => {
          const isOpen       = openGroup === group.key;
          const groupModels  = group.models as readonly string[];
          const activeModel  = CD_MODELS.find(
            (m) => groupModels.includes(m.key) && m.key === selectedModel
          );
          const groupSelected = !!activeModel;
          const buttonLabel   = activeModel ? activeModel.label : group.defaultLabel;

          return (
            <div
              key={group.key}
              onMouseEnter={() => openDropdown(group.key)}
              onMouseLeave={scheduleClose}
            >
              <button
                ref={(el) => { btnRefs.current[group.key] = el; }}
                className={!isOpen ? "cd-btn-lift" : undefined}
                style={{
                  height:     36,
                  padding:    "0 12px",
                  background: groupSelected
                    ? "rgba(139,92,246,0.18)"
                    : isOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    groupSelected
                      ? "rgba(139,92,246,0.45)"
                      : isOpen ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"
                  }`,
                  borderRadius:  8,
                  color:         groupSelected
                    ? "rgba(139,92,246,1)"
                    : isOpen ? "#B8C0D4" : "#9AA3B2",
                  fontSize:      14,
                  fontFamily:    "var(--font-sans)",
                  fontWeight:    groupSelected ? 700 : 400,
                  cursor:        "pointer",
                  whiteSpace:    "nowrap",
                  display:       "flex",
                  alignItems:    "center",
                  gap:           6,
                  transition:    "all 0.15s ease",
                  boxShadow:     groupSelected ? "0 0 12px rgba(139,92,246,0.25)" : "none",
                }}
              >
                {/* Active dot */}
                {groupSelected && (
                  <span style={{
                    width:        5,
                    height:       5,
                    borderRadius: "50%",
                    background:   "rgba(139,92,246,1)",
                    boxShadow:    "0 0 6px rgba(139,92,246,1)",
                    flexShrink:   0,
                  }} />
                )}

                {buttonLabel}

                {/* Chevron */}
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  style={{
                    opacity:    0.45,
                    transform:  isOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Portal dropdown — escapes overflow:hidden via document.body ──── */}
      {openGroup && currentGroup && portalPos && typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
            style={{
              position:             "fixed",
              bottom:               portalPos.bottom,
              left:                 portalPos.left,
              background:           "#0E0F1A",
              border:               "1px solid rgba(255,255,255,0.10)",
              borderRadius:         10,
              padding:              4,
              zIndex:               100001, // above CDv2Shell fullscreen portal (99999)
              minWidth:             160,
              boxShadow:            "0 -8px 32px rgba(0,0,0,0.7), 0 -2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              backdropFilter:       "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              animation:            "cd-slide-up 0.15s ease",
            }}
          >
            {currentGroup.models.map((modelKey) => {
              const modelDef  = CD_MODELS.find((m) => m.key === modelKey);
              if (!modelDef) return null;
              const isActive   = selectedModel === modelKey;
              const isDisabled = !modelDef.active;

              return (
                <button
                  key={modelKey}
                  onClick={() => {
                    if (!isDisabled) {
                      setSelectedModel(modelKey);
                      setOpenGroup(null);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isActive) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                  style={{
                    display:     "flex",
                    alignItems:  "center",
                    gap:         8,
                    width:       "100%",
                    padding:     "7px 10px",
                    background:  isActive ? "rgba(139,92,246,0.15)" : "transparent",
                    border:      "none",
                    borderRadius: 7,
                    color:        isActive
                      ? "rgba(139,92,246,1)"
                      : isDisabled ? "rgba(255,255,255,0.22)" : "#B8C0D4",
                    fontSize:    13,
                    fontFamily:  "var(--font-sans)",
                    fontWeight:  isActive ? 600 : 400,
                    cursor:      isDisabled ? "not-allowed" : "pointer",
                    textAlign:   "left",
                    whiteSpace:  "nowrap",
                    transition:  "background 0.1s ease",
                    boxShadow:   isActive ? "inset 3px 0 0 rgba(139,92,246,0.7)" : "none",
                  }}
                >
                  {/* Active dot */}
                  {isActive && (
                    <span style={{
                      width:        5,
                      height:       5,
                      borderRadius: "50%",
                      background:   "rgba(139,92,246,1)",
                      flexShrink:   0,
                    }} />
                  )}

                  {modelDef.label}

                  {/* Soon badge */}
                  {modelDef.soon && (
                    <span style={{
                      fontSize:      8,
                      background:    "rgba(255,255,255,0.07)",
                      border:        "1px solid rgba(255,255,255,0.11)",
                      borderRadius:  4,
                      padding:       "1px 5px",
                      color:         "rgba(255,255,255,0.28)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginLeft:    "auto",
                    }}>
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )
      }
    </>
  );
}
