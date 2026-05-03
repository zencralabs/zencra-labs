"use client";

/**
 * AIAssistBar — Phase B.2.6 AI Co-Director Layer.
 *
 * A slim floating pill bar (44px fixed height) positioned at
 * bottom: DIRECTOR_BOTTOM + 8px above the DirectorHandle.
 *
 * Three action buttons — all client-side, zero API calls, zero credits:
 *
 * ✨ Enhance Scene
 *   Reads current element labels and generates cinematic enrichment.
 *   Shows a preview card (before → after) with [Apply] / [Cancel].
 *   Apply calls updateElement({ label }) + fires a silent PATCH to DB.
 *
 * ⚡ Auto Build
 *   Detects which scene roles are missing (subject/world/atmosphere/object).
 *   Shows a confirm card listing what will be added (max 3 suggestions).
 *   Confirm calls onAddElement() sequentially for each suggestion.
 *
 * 🎬 Direct Scene
 *   Generates a cinematic direction paragraph from current elements.
 *   Shows a preview card. [Apply] copies the text to clipboard.
 *
 * Suggestion chips:
 *   Float above the bar (marginBottom: 8px stack). Appear 1.5–1.75s
 *   after elements.length changes, only when no card is open.
 *   Max 3 chips. Auto-dismiss after 8s. Click calls onAddElement().
 *
 * Visibility:
 *   Entire bar: opacity 0 + pointerEvents none when directorPanelOpen.
 *   Outer wrapper: pointerEvents none always — inner bar opts back in.
 *
 * Positioning:
 *   position: absolute inside the center column (position: relative).
 *   bottom: bottomOffset (pass DIRECTOR_BOTTOM + 8 = 194 from CDv2Shell).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useDirectionStore, selectMode }             from "@/lib/creative-director/store";
import type { DirectionElementType }                 from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<DirectionElementType, string> = {
  subject:    "rgba(59,130,246,1)",
  world:      "rgba(34,197,94,1)",
  atmosphere: "rgba(139,92,246,1)",
  object:     "rgba(249,115,22,1)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure, deterministic scene-intelligence helpers

/**
 * Enrich a label with role-specific cinematic language.
 * Avoids re-enriching already-detailed labels (checks for ", " separator).
 */
function enrichLabel(label: string, type: DirectionElementType): string {
  const base = label.trim();
  if (base.includes(" — ")) return base; // already enriched
  const suffixes: Record<DirectionElementType, string[]> = {
    subject:    [
      "sharp focal plane, expressive motivated lighting",
      "cinematic depth, intentional compositional framing",
      "dramatic silhouette, high contrast key light",
    ],
    world:      [
      "immersive environment, rich foreground texture",
      "expansive setting, environmental storytelling at edges",
      "layered depth planes, atmospheric peripheral detail",
    ],
    atmosphere: [
      "ethereal mood, warm color-temperature grade",
      "soft diffused fill light, cinematic haze overlay",
      "emotional tonal palette — cool detachment vs. warm intimacy",
    ],
    object:     [
      "purposeful compositional placement, narrative weight",
      "textured detail in frame, deliberate shallow focus",
      "symbolic framing, secondary focal anchor",
    ],
  };
  const opts   = suffixes[type];
  const suffix = opts[base.length % opts.length];
  return `${base} — ${suffix}`;
}

interface BuildSuggestion {
  type:  DirectionElementType;
  label: string;
}

function buildSuggestionsFor(elements: { type: string }[]): BuildSuggestion[] {
  const types = new Set(elements.map((e) => e.type));
  const out: BuildSuggestion[] = [];
  if (!types.has("subject"))    out.push({ type: "subject",    label: "Primary Subject"   });
  if (!types.has("world"))      out.push({ type: "world",      label: "Scene Environment" });
  if (!types.has("atmosphere")) out.push({ type: "atmosphere", label: "Atmospheric Mood"  });
  if (!types.has("object"))     out.push({ type: "object",     label: "Key Object"        });
  return out.slice(0, 3);
}

function cinematicDirection(elements: { type: string; label: string }[]): string {
  const subjects    = elements.filter((e) => e.type === "subject");
  const worlds      = elements.filter((e) => e.type === "world");
  const atmospheres = elements.filter((e) => e.type === "atmosphere");
  const parts: string[] = [];

  if (subjects.length > 0) {
    parts.push(
      `Lead with ${subjects.map((s) => s.label).join(" and ")} as the focal anchor — ` +
      `tight depth of field, motivated key light from a strong direction.`
    );
  } else {
    parts.push(
      `Establish a clear focal subject before composing — ` +
      `give the viewer an unambiguous anchor point.`
    );
  }

  if (worlds.length > 0) {
    parts.push(
      `Let ${worlds[0].label} breathe into the frame edges — ` +
      `environmental storytelling through texture and peripheral detail.`
    );
  }

  if (atmospheres.length > 0) {
    parts.push(
      `Use ${atmospheres[0].label} to set emotional temperature — ` +
      `push the color grade toward warmth or cool detachment.`
    );
  } else {
    parts.push(
      `Define atmospheric intent — is this intimate and warm, or cold and expansive?`
    );
  }

  parts.push(
    `Compose with 2.39:1 cinematic tension in mind even if delivering square — ` +
    `fill the frame intentionally, nothing accidental.`
  );

  return parts.join(" ");
}

interface SuggestionChip {
  id:    string;
  type:  DirectionElementType;
  label: string;
  desc:  string;
}

function chipsFor(elements: { type: string; label: string }[]): SuggestionChip[] {
  const types = new Set(elements.map((e) => e.type));
  const out: SuggestionChip[] = [];
  if (elements.length === 0) {
    out.push({ id: "sub0", type: "subject",    label: "+ Add Subject",      desc: "Start with a focal subject" });
  }
  if (!types.has("atmosphere")) {
    out.push({ id: "atm0", type: "atmosphere", label: "+ Atmospheric Mood", desc: "Add a mood layer"           });
  }
  if (!types.has("world")) {
    out.push({ id: "wld0", type: "world",      label: "+ World Context",    desc: "Add an environment"         });
  }
  if (!types.has("object")) {
    out.push({ id: "obj0", type: "object",     label: "+ Key Object",       desc: "Add a focal object"         });
  }
  return out.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────

type ActiveCard = "enhance" | "confirm-build" | "direct" | null;

interface EnhancePreview {
  id:     string;
  before: string;
  after:  string;
}

interface AIAssistBarProps {
  onAddElement: (type: DirectionElementType, label: string) => Promise<void>;
  bottomOffset: number; // e.g. DIRECTOR_BOTTOM + 8 = 194
}

// ─────────────────────────────────────────────────────────────────────────────

export function AIAssistBar({ onAddElement, bottomOffset }: AIAssistBarProps) {
  const { elements, directorPanelOpen, updateElement } = useDirectionStore();
  const mode = useDirectionStore(selectMode);

  const [activeCard,       setActiveCard]       = useState<ActiveCard>(null);
  const [buildSuggestions, setBuildSuggestions] = useState<BuildSuggestion[]>([]);
  const [enhancePreviews,  setEnhancePreviews]  = useState<EnhancePreview[]>([]);
  const [directText,       setDirectText]       = useState("");
  const [chips,            setChips]            = useState<SuggestionChip[]>([]);
  const [chipsVisible,     setChipsVisible]     = useState(false);
  const [btnHover,         setBtnHover]         = useState<string | null>(null);
  const [building,         setBuilding]         = useState(false);
  const [applying,         setApplying]         = useState(false);
  const [copied,           setCopied]           = useState(false);

  // Ref so chip timer can read activeCard without stale closure
  const activeCardRef    = useRef<ActiveCard>(null);
  const chipTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeCardRef.current = activeCard; }, [activeCard]);

  // ── Suggestion chips: fire 1.5–1.75s after elements.length changes ────────
  useEffect(() => {
    if (chipTimerRef.current)   clearTimeout(chipTimerRef.current);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setChipsVisible(false);

    const delay = elements.length === 0 ? 1500 : 1750;
    chipTimerRef.current = setTimeout(() => {
      if (activeCardRef.current !== null) return;
      const newChips = chipsFor(elements);
      if (newChips.length === 0) return;
      setChips(newChips);
      setChipsVisible(true);
      autoDismissRef.current = setTimeout(() => setChipsVisible(false), 8000);
    }, delay);

    return () => {
      if (chipTimerRef.current)   clearTimeout(chipTimerRef.current);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements.length]);

  // Dismiss chips when any card opens
  useEffect(() => {
    if (activeCard !== null) {
      setChipsVisible(false);
      if (chipTimerRef.current)   clearTimeout(chipTimerRef.current);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    }
  }, [activeCard]);

  // ── Button handlers ───────────────────────────────────────────────────────

  const handleEnhanceScene = useCallback(() => {
    if (elements.length === 0) return;
    const previews = elements
      .map((el) => ({
        id:     el.id,
        before: el.label,
        after:  enrichLabel(el.label, el.type as DirectionElementType),
      }))
      .filter((p) => p.before !== p.after);
    setEnhancePreviews(previews);
    setActiveCard("enhance");
  }, [elements]);

  const handleApplyEnhance = useCallback(async () => {
    setApplying(true);
    for (const p of enhancePreviews) {
      updateElement(p.id, { label: p.after });
      // Best-effort DB sync — silent if offline
      fetch(`/api/creative-director/elements/${p.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ label: p.after }),
      }).catch(() => {});
    }
    setApplying(false);
    setActiveCard(null);
  }, [enhancePreviews, updateElement]);

  const handleAutoBuild = useCallback(() => {
    const suggestions = buildSuggestionsFor(elements);
    if (suggestions.length === 0) return;
    setBuildSuggestions(suggestions);
    setActiveCard("confirm-build");
  }, [elements]);

  const handleConfirmBuild = useCallback(async () => {
    setBuilding(true);
    for (const s of buildSuggestions) {
      await onAddElement(s.type, s.label);
    }
    setBuilding(false);
    setActiveCard(null);
  }, [buildSuggestions, onAddElement]);

  const handleDirectScene = useCallback(() => {
    setDirectText(cinematicDirection(elements));
    setActiveCard("direct");
  }, [elements]);

  const handleApplyDirect = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(directText);
      setCopied(true);
      setTimeout(() => { setCopied(false); setActiveCard(null); }, 1500);
    } catch {
      setActiveCard(null);
    }
  }, [directText]);

  const handleChipClick = useCallback(async (chip: SuggestionChip) => {
    setChipsVisible(false);
    await onAddElement(chip.type, chip.label.replace(/^\+ /, ""));
  }, [onAddElement]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isHidden      = directorPanelOpen;
  const autoBuildOpts = buildSuggestionsFor(elements);
  const _ = mode; // referenced so linter doesn't drop import — mode may be used for future theming

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position:      "absolute",
        bottom:        bottomOffset,
        left:          0,
        right:         0,
        zIndex:        30,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        padding:       "0 16px",
      }}
    >
      {/* ── Suggestion chips ─────────────────────────────────────────────── */}
      {chipsVisible && chips.length > 0 && (
        <div
          style={{
            display:      "flex",
            gap:          6,
            marginBottom: 8,
            animation:    "cd-slide-up 0.25s ease",
            alignItems:   "center",
          }}
        >
          {chips.map((chip) => (
            <ChipButton key={chip.id} chip={chip} onClick={() => void handleChipClick(chip)} />
          ))}
          <button
            onClick={() => setChipsVisible(false)}
            style={{
              background:    "transparent",
              border:        "none",
              color:      "rgba(255,255,255,0.2)",
              fontSize:   10,
              cursor:     "pointer",
              padding:    "5px 6px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Preview / Confirm card ───────────────────────────────────────── */}
      {activeCard !== null && (
        <div
          style={{
            width:               "100%",
            maxWidth:            420,
            marginBottom:        8,
            background:          "rgba(8,6,18,0.96)",
            border:              "1px solid rgba(255,255,255,0.09)",
            borderRadius:        14,
            backdropFilter:      "blur(24px)",
            WebkitBackdropFilter:"blur(24px)",
            boxShadow:           "0 8px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding:   "14px 16px",
            animation: "cd-slide-up 0.2s ease",
            maxHeight:           260,
            overflowY:           "auto",
            scrollbarWidth:      "none",
          }}
        >
          {/* ── Enhance Scene card ───────────────────────────────────────── */}
          {activeCard === "enhance" && (
            <>
              <CardHeader>✨ Enhance Scene Preview</CardHeader>
              {enhancePreviews.length === 0 ? (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", margin: "0 0 12px" }}>
                  Labels are already fully detailed — nothing to enhance.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {enhancePreviews.map((p) => (
                    <div key={p.id} style={{ fontSize: 12, fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
                      <span style={{ color: "rgba(255,255,255,0.28)", textDecoration: "line-through" }}>
                        {p.before}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.18)", margin: "0 6px" }}>→</span>
                      <span style={{ color: "rgba(139,92,246,0.9)" }}>{p.after}</span>
                    </div>
                  ))}
                </div>
              )}
              <CardActions
                onApply={enhancePreviews.length > 0 ? () => void handleApplyEnhance() : undefined}
                onCancel={() => setActiveCard(null)}
                applyLabel={applying ? "Applying…" : "Apply"}
              />
            </>
          )}

          {/* ── Auto Build confirm card ──────────────────────────────────── */}
          {activeCard === "confirm-build" && (
            <>
              <CardHeader>
                ⚡ Auto Build — Adding {buildSuggestions.length} Element{buildSuggestions.length !== 1 ? "s" : ""}
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {buildSuggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: ROLE_COLORS[s.type],
                      flexShrink: 0,
                      boxShadow:  `0 0 6px ${ROLE_COLORS[s.type].replace("1)", "0.6)")}`,
                    }} />
                    <span style={{
                      fontSize:      9,
                      fontFamily:    "var(--font-sans)",
                      color:         ROLE_COLORS[s.type].replace("1)", "0.65)"),
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      width:         54,
                      flexShrink:    0,
                    }}>
                      {s.type}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.75)" }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <CardActions
                onApply={() => void handleConfirmBuild()}
                onCancel={() => setActiveCard(null)}
                applyLabel={building ? "Building…" : "Confirm"}
              />
            </>
          )}

          {/* ── Direct Scene card ────────────────────────────────────────── */}
          {activeCard === "direct" && (
            <>
              <CardHeader>🎬 Cinematic Direction</CardHeader>
              <p style={{
                fontSize:   13,
                fontFamily: "var(--font-sans)",
                color:      "rgba(255,255,255,0.75)",
                lineHeight: 1.65,
                margin:     "0 0 12px",
              }}>
                {directText}
              </p>
              <CardActions
                onApply={() => void handleApplyDirect()}
                onCancel={() => setActiveCard(null)}
                applyLabel={copied ? "Copied! ✓" : "Copy to Clipboard"}
              />
            </>
          )}
        </div>
      )}

      {/* ── 44px pill bar ────────────────────────────────────────────────── */}
      <div
        style={{
          display:             "flex",
          alignItems:          "center",
          justifyContent:      "center",
          gap:                 4,
          height:              44,
          padding:             "0 10px",
          background:          "rgba(8,6,18,0.90)",
          border:              "1px solid rgba(255,255,255,0.07)",
          borderRadius:        100,
          backdropFilter:      "blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          boxShadow:           "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          opacity:             isHidden ? 0 : 1,
          pointerEvents:       isHidden ? "none" : "auto",
          transition:          "opacity 0.25s ease",
        }}
      >
        <BarButton
          emoji="✨"
          label="Enhance Scene"
          color="rgba(251,191,36,1)"
          active={activeCard === "enhance"}
          hovered={btnHover === "enhance"}
          disabled={elements.length === 0}
          onMouseEnter={() => setBtnHover("enhance")}
          onMouseLeave={() => setBtnHover(null)}
          onClick={handleEnhanceScene}
        />

        <Divider />

        <BarButton
          emoji="⚡"
          label="Auto Build"
          color="rgba(34,197,94,1)"
          active={activeCard === "confirm-build"}
          hovered={btnHover === "build"}
          disabled={autoBuildOpts.length === 0}
          onMouseEnter={() => setBtnHover("build")}
          onMouseLeave={() => setBtnHover(null)}
          onClick={handleAutoBuild}
        />

        <Divider />

        <BarButton
          emoji="🎬"
          label="Direct Scene"
          color="rgba(139,92,246,1)"
          active={activeCard === "direct"}
          hovered={btnHover === "direct"}
          disabled={false}
          onMouseEnter={() => setBtnHover("direct")}
          onMouseLeave={() => setBtnHover(null)}
          onClick={handleDirectScene}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components

function Divider() {
  return <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)", flexShrink: 0, margin: "0 2px" }} />;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:      10,
      fontFamily:    "var(--font-sans)",
      color:         "rgba(255,255,255,0.45)",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      marginBottom:  10,
    }}>
      {children}
    </div>
  );
}

function CardActions({
  onApply,
  onCancel,
  applyLabel,
}: {
  onApply?:    () => void;
  onCancel:    () => void;
  applyLabel:  string;
}) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <button
        onClick={onCancel}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.38)"; }}
        style={{
          background:    "transparent",
          border:        "1px solid rgba(255,255,255,0.1)",
          borderRadius:  8,
          color:         "rgba(255,255,255,0.38)",
          fontSize:      11,
          fontFamily:    "var(--font-sans)",
          padding:       "5px 14px",
          cursor:        "pointer",
          transition:    "color 0.15s ease",
        }}
      >
        Cancel
      </button>
      {onApply && (
        <button
          onClick={onApply}
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
          {applyLabel}
        </button>
      )}
    </div>
  );
}

function BarButton({
  emoji, label, active, hovered, disabled, color,
  onClick, onMouseEnter, onMouseLeave,
}: {
  emoji:        string;
  label:        string;
  active:       boolean;
  hovered:      boolean;
  disabled:     boolean;
  color:        string;
  onClick:      () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const bg  = active   ? color.replace("1)", "0.12)") : hovered ? "rgba(255,255,255,0.06)" : "transparent";
  const bdr = active   ? `1px solid ${color.replace("1)", "0.28)")}` : "1px solid transparent";
  const clr = disabled ? "rgba(255,255,255,0.18)"
    : active            ? color.replace("1)", "0.9)")
    : hovered           ? "rgba(255,255,255,0.8)"
    :                     "rgba(255,255,255,0.42)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      style={{
        background:    bg,
        border:        bdr,
        borderRadius:  100,
        color:         clr,
        cursor:        disabled ? "not-allowed" : "pointer",
        padding:       "5px 13px",
        fontSize:      11,
        fontFamily:    "var(--font-sans)",
        display:       "flex",
        alignItems:    "center",
        gap:           5,
        whiteSpace:    "nowrap",
        transition:    "all 0.15s ease",
        letterSpacing: "0.02em",
        height:        32,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      {label}
    </button>
  );
}

function ChipButton({
  chip,
  onClick,
}: {
  chip:    SuggestionChip;
  onClick: () => void;
}) {
  const color = ROLE_COLORS[chip.type];
  return (
    <button
      onClick={onClick}
      title={chip.desc}
      onMouseEnter={(e) => {
        e.currentTarget.style.background  = "rgba(20,14,36,0.96)";
        e.currentTarget.style.transform   = "translateY(-2px)";
        e.currentTarget.style.boxShadow   = `0 6px 20px rgba(0,0,0,0.5), 0 0 12px ${color.replace("1)", "0.2)")}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background  = "rgba(10,8,20,0.92)";
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = `0 4px 16px rgba(0,0,0,0.4), 0 0 8px ${color.replace("1)", "0.12)")}`;
      }}
      style={{
        background:          "rgba(10,8,20,0.92)",
        border:              `1px solid ${color.replace("1)", "0.3)")}`,
        borderRadius:        100,
        color:               color.replace("1)", "0.85)"),
        fontSize:            11,
        fontFamily:          "var(--font-sans)",
        padding:             "5px 13px",
        cursor:              "pointer",
        backdropFilter:      "blur(16px)",
        WebkitBackdropFilter:"blur(16px)",
        boxShadow:           `0 4px 16px rgba(0,0,0,0.4), 0 0 8px ${color.replace("1)", "0.12)")}`,
        transition:          "all 0.15s ease",
        whiteSpace:          "nowrap",
      }}
    >
      {chip.label}
    </button>
  );
}
