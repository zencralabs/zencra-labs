"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ConceptBoard — Center column of the AI Creative Director
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptCard {
  id: string;
  title: string;
  summary: string;
  rationale?: string;
  layoutStrategy?: string;
  typographyStrategy?: string;
  colorStrategy?: string;
  recommendedProvider: string;
  recommendedUseCase?: string;
  scores: {
    textAccuracy: number;
    cinematicImpact: number;
    designControl: number;
    speed: number;
  };
  // ── Cinematic 2.0 fields (optional — populated from concept_payload if present) ──
  /** Full narrative story for this concept direction */
  narrativeStory?: string;
  /** 2–3 concrete execution ideas/angles */
  executionAngles?: string[];
  /** Best suited use-case context (e.g. "Ads / Social", "Brand Film", "Landing") */
  bestFor?: string;
  /** Applied character Soul ID — optional cross-studio identity linkage */
  appliedCharacterId?: string;
  appliedCharacterName?: string;
}

interface ConceptBoardProps {
  state: "empty" | "loading" | "results" | "detail";
  concepts: ConceptCard[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string) => void;
  onGenerateConcept: (id: string) => void;
  onExpandConcept: (id: string) => void;
  /** Whether any renders have been produced — used to determine flow step 4/5 */
  hasGenerations?: boolean;
  /** Apply a character to a concept — wires Soul ID to concept for render */
  onApplyCharacter?: (conceptId: string, characterId: string | null) => void;
  /** Currently applied character name (for display in concept card) */
  appliedCharacterName?: string;
}

// ── Zencra tokens ─────────────────────────────────────────────────────────────
const Z = {
  textPrimary:   "#F5F7FF",
  textSecondary: "#A7B0C5",
  textMuted:     "#6F7893",
  borderSubtle:  "rgba(120,160,255,0.18)",
  borderActive:  "rgba(86,140,255,0.55)",
  glowPrimary:   "0 0 16px rgba(86,140,255,0.35)",
  glowWhite:     "0 0 10px rgba(255,255,255,0.15)",
  accentBlue:    "#3B82F6",
  accentViolet:  "#8B5CF6",
  accentCyan:    "#22D3EE",
} as const;

// ── Gradient preview backgrounds per concept index ────────────────────────────
// Each card has a distinct cinematic identity:
// 0 — Cinematic Blue (deep navy, electric blue undertones)
// 1 — Rich Violet   (deep indigo, luminous purple)
// 2 — Teal / Moody  (dark ocean, emerald undertones)
const PREVIEW_GRADIENTS = [
  "linear-gradient(148deg, #060E28 0%, #0C1E48 48%, #05112A 100%)",
  "linear-gradient(148deg, #130930 0%, #240F56 48%, #0B0524 100%)",
  "linear-gradient(148deg, #031419 0%, #072D35 48%, #020C10 100%)",
];

const PREVIEW_ACCENTS = [
  // Cinematic blue: strong electric blue + cyan glint
  { a: "rgba(37,99,235,0.5)",  b: "rgba(6,182,212,0.3)"   },
  // Rich violet: deep violet + rose flare
  { a: "rgba(109,40,217,0.5)", b: "rgba(219,39,119,0.28)" },
  // Teal/moody: teal + emerald depth
  { a: "rgba(13,148,136,0.5)", b: "rgba(16,185,129,0.28)" },
];

// ── Per-card blob positioning — gives each card a distinct spatial feel ────────
const BLOB_CONFIGS = [
  // Card 0: blobs top-right + bottom-left (diagonal top)
  {
    a: { top: -24, right: -24 } as React.CSSProperties,
    b: { bottom: -14, left: -14 } as React.CSSProperties,
  },
  // Card 1: blobs top-left + bottom-right (diagonal, mirrored)
  {
    a: { top: -24, left: -24 } as React.CSSProperties,
    b: { bottom: -14, right: -14 } as React.CSSProperties,
  },
  // Card 2: blobs centre-right + upper-left (off-axis, moody)
  {
    a: { top: 16, right: -32 } as React.CSSProperties,
    b: { top: -24, left: 24 } as React.CSSProperties,
  },
];

// ── Strength bar (shown only on selected card) ─────────────────────────────────
function StrengthBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: Z.textMuted, letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ fontSize: 11, color: Z.textSecondary, fontWeight: 600 }}>{value}/10</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${(value / 10) * 100}%`,
            background: "linear-gradient(to right, #3FA9F5, #6C5CE7)",
            borderRadius: 2,
            transition: "width 0.7s ease",
          }}
        />
      </div>
    </div>
  );
}

// ── Score bar (used in detail panel only) ─────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: Z.textMuted, letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ fontSize: 12, color: Z.textSecondary, fontWeight: 600 }}>{value}/10</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${(value / 10) * 100}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.7s ease",
          }}
        />
      </div>
    </div>
  );
}

// ── Chip tag ──────────────────────────────────────────────────────────────────
function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "6px 12px",
        borderRadius: 20,
        background: color ? `${color}18` : "rgba(120,160,255,0.1)",
        border: `1px solid ${color ? color + "35" : "rgba(120,160,255,0.25)"}`,
        color: color ?? Z.textSecondary,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Animated concept preview ──────────────────────────────────────────────────
function ConceptPreview({ index, isSelected, isHovered }: { index: number; isSelected: boolean; isHovered?: boolean }) {
  const grad     = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  const acc      = PREVIEW_ACCENTS[index % PREVIEW_ACCENTS.length];
  const blobPos  = BLOB_CONFIGS[index % BLOB_CONFIGS.length];
  const blobDelay = `${index * 1.2}s`;

  return (
    <div
      style={{
        height: 200,
        background: grad,
        borderRadius: "14px 14px 0 0",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Animated ambient blob A — position varies per card */}
      <div
        style={{
          position: "absolute",
          width: 170,
          height: 170,
          borderRadius: "50%",
          background: acc.a,
          filter: "blur(52px)",
          ...blobPos.a,
          pointerEvents: "none",
          animation: `conceptBlobA 8s ease-in-out ${blobDelay} infinite`,
        }}
      />
      {/* Animated ambient blob B — position varies per card */}
      <div
        style={{
          position: "absolute",
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: acc.b,
          filter: "blur(40px)",
          ...blobPos.b,
          pointerEvents: "none",
          animation: `conceptBlobB 10s ease-in-out ${blobDelay} infinite`,
        }}
      />

      {/* Cinematic light-shift sweep — slow, always on */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(108deg, transparent 15%, rgba(255,255,255,0.055) 50%, transparent 85%)",
          animation: `lightShift 10s ease-in-out ${index * 2.2}s infinite`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {/* Hover shimmer — faster pulse on hover */}
      {isHovered && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(108deg, transparent 10%, rgba(255,255,255,0.04) 50%, transparent 90%)",
            animation: "lightShift 3.5s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {/* Number badge — top-left */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          zIndex: 2,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: isSelected ? "#93c5fd" : "rgba(255,255,255,0.45)",
          background: isSelected ? "rgba(59,130,246,0.22)" : "rgba(0,0,0,0.38)",
          border: `1px solid ${isSelected ? "rgba(59,130,246,0.38)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 6,
          padding: "3px 7px",
          backdropFilter: "blur(4px)",
          transition: "all 0.2s ease",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Center icon */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${isSelected ? Z.borderActive : "rgba(255,255,255,0.12)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: isSelected ? Z.glowPrimary : "none",
            transition: "all 0.2s ease",
          }}
        >
          ✦
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card (matches new card shape) ────────────────────────────────────
function SkeletonCard({ index }: { index: number }) {
  const grad = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
        border: "1px solid rgba(120,160,255,0.1)",
        borderRadius: 18,
        overflow: "hidden",
        animation: `skeletonPulse 1.8s ease-in-out ${index * 0.25}s infinite`,
      }}
    >
      {/* Preview placeholder */}
      <div style={{ height: 200, background: grad, opacity: 0.4 }} />
      <div style={{ padding: "16px 16px 22px" }}>
        {/* Title */}
        <div style={{ width: "65%", height: 16, background: "rgba(255,255,255,0.07)", borderRadius: 6, marginBottom: 12 }} />
        {/* Description lines */}
        <div style={{ width: "100%", height: 11, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: "80%", height: 11, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 16 }} />
        {/* Tags */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 70, height: 24, background: "rgba(255,255,255,0.05)", borderRadius: 20 }} />
          <div style={{ width: 90, height: 24, background: "rgba(255,255,255,0.05)", borderRadius: 20 }} />
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1.6, height: 38, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 38, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

// ── Ghost empty card — matches new card shape ─────────────────────────────────
function GhostCard({ index }: { index: number }) {
  const grad       = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  const acc        = PREVIEW_ACCENTS[index % PREVIEW_ACCENTS.length];
  const baseOpacity = 1 - index * 0.18;
  const breathDelay = `${index * 0.55}s`;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
        border: `1px dashed rgba(140,185,255,${0.28 - index * 0.06})`,
        borderRadius: 18,
        overflow: "hidden",
        ["--ghost-opacity" as string]: baseOpacity,
        animation: `ghostBreath 3s ease-in-out ${breathDelay} infinite`,
        boxShadow: index === 0
          ? "0 0 18px rgba(86,140,255,0.07), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "none",
      }}
    >
      {/* Preview area */}
      <div
        style={{
          height: 200,
          background: grad,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient blob */}
        <div
          style={{
            position: "absolute", width: 100, height: 100, borderRadius: "50%",
            background: acc.a, filter: "blur(32px)", opacity: 0.45, top: 10, right: 10,
          }}
        />
        {/* Number badge */}
        <div
          style={{
            position: "absolute", top: 10, left: 12, zIndex: 2,
            fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
            color: "rgba(140,185,255,0.5)",
            background: "rgba(0,0,0,0.32)",
            border: "1px dashed rgba(140,185,255,0.28)",
            borderRadius: 6, padding: "3px 7px",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        {/* Center icon */}
        <div
          style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 44, height: 44, borderRadius: 13,
              border: "1px dashed rgba(140,185,255,0.42)",
              background: "rgba(120,160,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(140,185,255,0.65)", fontSize: 18,
            }}
          >
            ✦
          </div>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 16px 22px" }}>
        {/* Title */}
        <div style={{ width: "62%", height: 15, background: "rgba(255,255,255,0.07)", borderRadius: 5, marginBottom: 12 }} />
        {/* Description */}
        <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: "78%", height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 16 }} />
        {/* Tags */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 65, height: 24, background: "rgba(120,160,255,0.07)", border: "1px dashed rgba(120,160,255,0.15)", borderRadius: 20 }} />
          <div style={{ width: 85, height: 24, background: "rgba(120,160,255,0.05)", border: "1px dashed rgba(120,160,255,0.1)", borderRadius: 20 }} />
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1.6, height: 38, background: "rgba(59,130,246,0.07)", border: "1px dashed rgba(59,130,246,0.18)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 38, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

// ── Flow strip — 5-step progress indicator ────────────────────────────────────
function FlowStrip({
  state,
  selectedConceptId,
  hasGenerations,
}: {
  state: ConceptBoardProps["state"];
  selectedConceptId: string | null;
  hasGenerations: boolean;
}) {
  // Derive active step (0-indexed)
  // 0=Brief, 1=Concepts, 2=Select, 3=Render, 4=Outputs
  let activeStep = 0;
  if (state === "loading") activeStep = 1;
  else if (state === "results" || state === "detail") {
    if (!selectedConceptId) activeStep = 2;
    else if (!hasGenerations) activeStep = 3;
    else activeStep = 4;
  }

  const steps = ["Brief", "Concepts", "Select", "Render", "Outputs"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "10px 0 16px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {steps.map((label, i) => {
        const isDone    = i < activeStep;
        const isCurrent = i === activeStep;
        const isFuture  = i > activeStep;

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* Step node */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                  background: isDone
                    ? "rgba(59,130,246,0.25)"
                    : isCurrent
                    ? "rgba(59,130,246,0.18)"
                    : "rgba(255,255,255,0.04)",
                  border: isDone
                    ? "1px solid rgba(86,140,255,0.45)"
                    : isCurrent
                    ? "1.5px solid rgba(86,140,255,0.55)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: isDone
                    ? "#93c5fd"
                    : isCurrent
                    ? "#93c5fd"
                    : Z.textMuted,
                  boxShadow: isCurrent ? "0 0 8px rgba(59,130,246,0.3)" : "none",
                }}
              >
                {isDone ? "✓" : String(i + 1)}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 500,
                  color: isDone
                    ? Z.textSecondary
                    : isCurrent
                    ? "#93c5fd"
                    : isFuture
                    ? "rgba(111,120,147,0.55)"
                    : Z.textMuted,
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 18,
                  height: 1,
                  margin: "0 4px",
                  background: i < activeStep
                    ? "rgba(86,140,255,0.3)"
                    : "rgba(255,255,255,0.07)",
                  flexShrink: 0,
                  transition: "background 0.3s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Story Preview Modal ────────────────────────────────────────────────────────
function StoryPreviewModal({
  concept,
  index,
  onClose,
}: {
  concept: ConceptCard;
  index: number;
  onClose: () => void;
}) {
  const grad = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  const acc  = PREVIEW_ACCENTS[index % PREVIEW_ACCENTS.length];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4, 6, 18, 0.88)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(600px, 100%)",
          maxHeight: "82vh",
          overflowY: "auto",
          scrollbarWidth: "none",
          background: "linear-gradient(180deg, #0F1629 0%, #09101F 100%)",
          border: "1px solid rgba(86,140,255,0.3)",
          borderRadius: 20,
          boxShadow:
            "0 0 0 1px rgba(86,140,255,0.08), 0 40px 80px rgba(0,0,0,0.85), 0 0 60px rgba(59,130,246,0.14)",
          overflow: "hidden",
        }}
      >
        {/* Hero */}
        <div
          style={{
            height: 130,
            background: grad,
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 200, height: 200, borderRadius: "50%",
              background: acc.a, filter: "blur(60px)",
              top: -50, left: "20%", pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 150, height: 150, borderRadius: "50%",
              background: acc.b, filter: "blur(48px)",
              bottom: -40, right: "12%", pointerEvents: "none",
            }}
          />
          {/* Light shift */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(108deg, transparent 15%, rgba(255,255,255,0.06) 50%, transparent 85%)",
              animation: "lightShift 7s ease-in-out infinite",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          {/* Number */}
          <div
            style={{
              position: "absolute", top: 14, left: 16, zIndex: 3,
              fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
              color: "#93c5fd",
              background: "rgba(59,130,246,0.22)",
              border: "1px solid rgba(59,130,246,0.4)",
              borderRadius: 6, padding: "3px 8px",
              backdropFilter: "blur(4px)",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 3,
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.65)",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            ✕
          </button>
          {/* Center diamond */}
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 46, height: 46, borderRadius: 14,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(86,140,255,0.42)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 0 28px rgba(86,140,255,0.32)",
              }}
            >
              ✦
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 26px 30px" }}>

          {/* Provider + Best For */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.32)",
                color: "#c4b5fd", letterSpacing: "0.02em",
              }}
            >
              {concept.recommendedProvider}
            </span>
            {concept.bestFor && (
              <span
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)",
                  color: "#6ee7b7", letterSpacing: "0.01em",
                }}
              >
                Best for: {concept.bestFor}
              </span>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 22, fontWeight: 800, color: Z.textPrimary,
              marginBottom: 14, lineHeight: 1.2, letterSpacing: "-0.025em",
            }}
          >
            {concept.title}
          </div>

          {/* Narrative */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                color: "rgba(160,180,210,0.45)", textTransform: "uppercase", marginBottom: 8,
              }}
            >
              Concept Narrative
            </div>
            <div
              style={{
                fontSize: 14, color: "#B8C8DE", lineHeight: 1.72,
                fontStyle: "italic",
              }}
            >
              {concept.narrativeStory ?? concept.summary}
            </div>
          </div>

          {/* Execution angles */}
          {concept.executionAngles && concept.executionAngles.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                  color: "rgba(160,180,210,0.45)", textTransform: "uppercase", marginBottom: 10,
                }}
              >
                Creative Angles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {concept.executionAngles.map((angle, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span
                      style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: "rgba(86,140,255,0.12)",
                        border: "1px solid rgba(86,140,255,0.28)",
                        color: "#93c5fd", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13.5, color: "#A8BECC", lineHeight: 1.58 }}>{angle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scores */}
          <div
            style={{
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                color: "rgba(160,180,210,0.45)", textTransform: "uppercase", marginBottom: 10,
              }}
            >
              Signal Scores
            </div>
            <StrengthBar label="Creative Impact" value={concept.scores.cinematicImpact} />
            <StrengthBar label="Brand Fit"       value={concept.scores.designControl}   />
            <StrengthBar label="Clarity"         value={concept.scores.textAccuracy}    />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Full concept card ─────────────────────────────────────────────────────────
function ConceptCardView({
  concept,
  index,
  isSelected,
  onSelect,
  onGenerate: _onGenerate,
  onExpand,
}: {
  concept: ConceptCard;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onGenerate: () => void;
  onExpand: () => void;
}) {
  const [isHovered,     setIsHovered]     = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [showStory,     setShowStory]     = useState(false);

  const cardGlow = isSelected
    ? `0 0 0 1.5px rgba(86,140,255,0.5), 0 0 32px rgba(59,130,246,0.2), 0 12px 40px rgba(0,0,0,0.5)`
    : isHovered
    ? `0 0 0 1px rgba(120,160,255,0.2), 0 8px 28px rgba(86,140,255,0.1), 0 4px 20px rgba(0,0,0,0.3)`
    : "0 2px 12px rgba(0,0,0,0.25)";

  const hasAngles = concept.executionAngles && concept.executionAngles.length > 0;

  return (
    <>
      {showStory && (
        <StoryPreviewModal
          concept={concept}
          index={index}
          onClose={() => setShowStory(false)}
        />
      )}

      <div
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
          border: isSelected
            ? "1.5px solid rgba(86,140,255,0.55)"
            : `1px solid ${isHovered ? "rgba(120,160,255,0.28)" : Z.borderSubtle}`,
          borderRadius: 18,
          overflow: "hidden",
          cursor: "pointer",
          transition: "all 0.22s ease",
          boxShadow: cardGlow,
          transform: isSelected
            ? "translateY(-2px)"
            : isHovered
            ? "translateY(-3px)"
            : "translateY(0)",
          width: "100%",
        }}
      >
        {/* Hero — animated with light shift */}
        <ConceptPreview index={index} isSelected={isSelected} isHovered={isHovered} />

        {/* Selected banner */}
        {isSelected && (
          <div
            style={{
              background: "linear-gradient(90deg, rgba(37,99,235,0.2) 0%, rgba(79,70,229,0.12) 100%)",
              borderBottom: "1px solid rgba(86,140,255,0.25)",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 16, height: 16, borderRadius: "50%",
                background: "rgba(59,130,246,0.3)",
                border: "1px solid rgba(86,140,255,0.6)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "#93c5fd", fontWeight: 800, flexShrink: 0,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.03em" }}>
              Direction Selected
            </span>
            <span style={{ fontSize: 11, color: "rgba(147,197,253,0.55)", marginLeft: 2 }}>
              — use the dock below to render
            </span>
          </div>
        )}

        {/* Card body */}
        <div style={{ padding: "14px 16px 18px" }}>

          {/* Provider row + Best For tag */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.32)",
                color: "#c4b5fd", letterSpacing: "0.02em", whiteSpace: "nowrap",
              }}
            >
              {concept.recommendedProvider}
            </span>
            {concept.bestFor && (
              <span
                style={{
                  fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                  background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.26)",
                  color: "#6ee7b7", letterSpacing: "0.01em", whiteSpace: "nowrap",
                }}
              >
                Best for: {concept.bestFor}
              </span>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 18, fontWeight: 700, color: Z.textPrimary,
              marginBottom: 9, lineHeight: 1.25, letterSpacing: "-0.02em",
            }}
          >
            {concept.title}
          </div>

          {/* Concept Narrative — replaces plain summary */}
          <div style={{ marginBottom: 11 }}>
            <div
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                color: "rgba(160,185,215,0.38)", textTransform: "uppercase", marginBottom: 5,
              }}
            >
              Concept Narrative
            </div>
            <div
              style={{
                fontSize: 13, color: "#9AAEC0", lineHeight: 1.62,
                fontStyle: "italic",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              } as React.CSSProperties}
            >
              {concept.narrativeStory ?? concept.summary}
            </div>
          </div>

          {/* Execution angles — 2–3 bullet ideas */}
          {hasAngles && (
            <div style={{ marginBottom: 13 }}>
              <div
                style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                  color: "rgba(160,185,215,0.38)", textTransform: "uppercase", marginBottom: 6,
                }}
              >
                Creative Angles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {concept.executionAngles!.slice(0, 3).map((angle, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: "rgba(86,140,255,0.55)",
                        flexShrink: 0, marginTop: 7,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12, color: "#7A96B0", lineHeight: 1.52,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      } as React.CSSProperties}
                    >
                      {angle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score bars — always visible, cinematic labels */}
          <div style={{ marginBottom: 14 }}>
            <StrengthBar label="Creative Impact" value={concept.scores.cinematicImpact} />
            <StrengthBar label="Brand Fit"       value={concept.scores.designControl}   />
            <StrengthBar label="Clarity"         value={concept.scores.textAccuracy}    />
          </div>

          {/* Actions */}
          <div
            style={{ display: "flex", gap: 7 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Select Direction */}
            <button
              onClick={onSelect}
              onMouseEnter={() => setHoveredAction("select")}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                flex: 1.4,
                height: 34,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 9,
                border: isSelected
                  ? "1px solid rgba(86,140,255,0.45)"
                  : hoveredAction === "select"
                  ? "1px solid rgba(59,130,246,0.5)"
                  : "1px solid rgba(59,130,246,0.28)",
                background: isSelected
                  ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(79,70,229,0.18))"
                  : hoveredAction === "select"
                  ? "rgba(59,130,246,0.16)"
                  : "rgba(59,130,246,0.09)",
                color: isSelected ? "#93c5fd" : "#6BA8FF",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isSelected ? "0 0 14px rgba(86,140,255,0.2)" : "none",
                letterSpacing: "0.01em",
              }}
            >
              {isSelected ? "✓ Selected" : "Select Direction"}
            </button>

            {/* Preview Story */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowStory(true); }}
              onMouseEnter={() => setHoveredAction("story")}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                flex: 1.1,
                height: 34,
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 9,
                border: hoveredAction === "story"
                  ? "1px solid rgba(139,92,246,0.45)"
                  : "1px solid rgba(139,92,246,0.22)",
                background: hoveredAction === "story"
                  ? "rgba(139,92,246,0.14)"
                  : "rgba(139,92,246,0.07)",
                color: hoveredAction === "story"
                  ? "#c4b5fd"
                  : "rgba(185,160,240,0.55)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                letterSpacing: "0.01em",
              }}
            >
              Preview Story
            </button>

            {/* Details */}
            <button
              onClick={onExpand}
              onMouseEnter={() => setHoveredAction("details")}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                flex: 0.75,
                height: 34,
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.07)",
                background: hoveredAction === "details"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.02)",
                color: hoveredAction === "details"
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.22)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function ConceptDetailPanel({
  concept,
  index,
  onGenerate,
  onBack,
}: {
  concept: ConceptCard;
  index: number;
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <div style={{ padding: "0 4px" }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: Z.textMuted,
          fontSize: 13,
          fontWeight: 600,
          padding: "0 0 20px 0",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = Z.textSecondary)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = Z.textMuted)}
      >
        ← Back to Concepts
      </button>

      {/* Preview */}
      <div style={{ borderRadius: "14px 14px 0 0", overflow: "hidden", marginBottom: 0 }}>
        <ConceptPreview index={index} isSelected />
      </div>

      <div
        style={{
          background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
          border: `1px solid ${Z.borderActive}`,
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          padding: "20px 20px",
          marginBottom: 16,
          boxShadow: Z.glowPrimary,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#93c5fd", marginBottom: 8, textTransform: "uppercase" }}>
          Concept Direction
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: Z.textPrimary, marginBottom: 8, letterSpacing: "-0.01em" }}>
          {concept.title}
        </div>
        <div style={{ fontSize: 13.5, color: Z.textSecondary, lineHeight: 1.6 }}>
          {concept.summary}
        </div>
      </div>

      {/* Detail sections */}
      {[
        { label: "Rationale",            content: concept.rationale          },
        { label: "Layout Strategy",      content: concept.layoutStrategy     },
        { label: "Typography Approach",  content: concept.typographyStrategy },
        { label: "Color Strategy",       content: concept.colorStrategy      },
        { label: "Recommended Use Case", content: concept.recommendedUseCase },
      ].map(({ label, content }) =>
        content ? (
          <div
            key={label}
            style={{
              marginBottom: 12,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${Z.borderSubtle}`,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: Z.textMuted, marginBottom: 7 }}>
              {label}
            </div>
            <div style={{ fontSize: 13.5, color: Z.textSecondary, lineHeight: 1.6 }}>
              {content}
            </div>
          </div>
        ) : null
      )}

      {/* Provider */}
      <div
        style={{
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.18)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(196,181,253,0.5)", marginBottom: 6 }}>
          Recommended Provider
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#c4b5fd" }}>
          {concept.recommendedProvider}
        </div>
      </div>

      {/* Score bars */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${Z.borderSubtle}`,
          borderRadius: 12,
          padding: "16px",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: Z.textMuted, marginBottom: 14 }}>
          Performance Scores
        </div>
        <ScoreBar label="Text Accuracy"    value={concept.scores.textAccuracy}   color={Z.accentBlue}   />
        <ScoreBar label="Cinematic Impact" value={concept.scores.cinematicImpact} color={Z.accentViolet} />
        <ScoreBar label="Design Control"   value={concept.scores.designControl}  color={Z.accentCyan}   />
        <ScoreBar label="Speed"            value={concept.scores.speed}          color="#10B981"        />
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        style={{
          width: "100%",
          padding: "14px 0",
          background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(79,70,229,0.22))",
          border: `1px solid ${Z.borderActive}`,
          borderRadius: 12,
          color: Z.textPrimary,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          letterSpacing: "0.02em",
          boxShadow: Z.glowPrimary,
          transition: "all 0.2s ease",
        }}
      >
        <span>✦</span>
        Render Concept
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ConceptBoard({
  state,
  concepts,
  selectedConceptId,
  onSelectConcept,
  onGenerateConcept,
  onExpandConcept,
  hasGenerations = false,
}: ConceptBoardProps) {
  const selectedConcept = concepts.find((c) => c.id === selectedConceptId) ?? null;
  const selectedIndex   = concepts.findIndex((c) => c.id === selectedConceptId);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "none",
        padding: "20px",
      }}
    >
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1;    }
        }
        @keyframes ghostBreath {
          0%, 100% { opacity: var(--ghost-opacity); box-shadow: 0 0 0 0 rgba(120,160,255,0); }
          50%       { opacity: calc(var(--ghost-opacity) * 1.12); box-shadow: 0 0 14px rgba(120,160,255,0.08); }
        }
        @keyframes conceptBlobA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(15px, -10px) scale(1.1); }
          66%       { transform: translate(-10px, 12px) scale(0.95); }
        }
        @keyframes conceptBlobB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(-12px, 8px) scale(0.92); }
          66%       { transform: translate(10px, -15px) scale(1.08); }
        }
        @keyframes lightShift {
          0%    { transform: translateX(-100%); opacity: 0;   }
          12%   { opacity: 1; }
          50%   { transform: translateX(110%);  opacity: 0.9; }
          65%   { opacity: 0; }
          100%  { transform: translateX(110%);  opacity: 0;   }
        }
        .concept-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .concept-grid { grid-template-columns: 1fr; }
        }
        @media (min-width: 1600px) {
          .concept-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      {/* ── Flow strip — always visible ── */}
      <FlowStrip
        state={state}
        selectedConceptId={selectedConceptId}
        hasGenerations={hasGenerations}
      />

      {/* ── Empty state ── */}
      {state === "empty" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
          <div style={{ textAlign: "center", padding: "32px 20px 28px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(120,160,255,0.2)",
                fontSize: 22,
                marginBottom: 16,
                boxShadow: "0 0 20px rgba(59,130,246,0.08)",
              }}
            >
              ✦
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: Z.textPrimary,
                marginBottom: 10,
                letterSpacing: "-0.01em",
              }}
            >
              Start your creative direction
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: Z.textMuted,
                lineHeight: 1.6,
                maxWidth: 300,
                margin: "0 auto",
              }}
            >
              Fill in your brief and click Generate Concepts — the AI art director will produce 3 strategic directions.
            </div>
          </div>

          {/* Value callout */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            7,
              padding:        "14px 16px",
              background:     "rgba(254,206,1,0.04)",
              border:         "1px solid rgba(254,206,1,0.13)",
              borderRadius:   10,
              marginBottom:   16,
              boxShadow:      "inset 0 1px 0 rgba(254,206,1,0.05)",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>✨</span>
            <span
              style={{
                fontSize:      15,
                fontWeight:    500,
                color:         "rgba(252,211,77,0.68)",
                letterSpacing: "0.01em",
                lineHeight:    1,
              }}
            >
              AI will generate 3 strategic directions for your campaign
            </span>
          </div>

          {/* Ghost cards — responsive grid */}
          <div className="concept-grid">
            {[0, 1, 2].map((i) => (
              <GhostCard key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ padding: "20px 0 24px" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: Z.textMuted,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: Z.accentBlue,
                  boxShadow: `0 0 8px ${Z.accentBlue}`,
                  animation: "skeletonPulse 1.2s ease-in-out infinite",
                }}
              />
              Thinking through concepts…
            </div>
          </div>
          <div className="concept-grid">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Results state ── */}
      {state === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ padding: "0 0 16px" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: Z.textPrimary,
                marginBottom: 12,
                letterSpacing: "-0.01em",
              }}
            >
              {concepts.length} Creative Direction{concepts.length !== 1 ? "s" : ""}
            </div>

            {/* Step indicator — changes based on selection state */}
            {selectedConceptId ? (
              /* Selected: confirmation banner */
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(86,140,255,0.28)",
                  boxShadow: "0 0 18px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(59,130,246,0.18)",
                    border: "1px solid rgba(86,140,255,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#93c5fd",
                    flexShrink: 0,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd", lineHeight: 1.35 }}>
                    Now render this concept into visuals
                  </div>
                  <div style={{ fontSize: 11, color: Z.textMuted, marginTop: 2 }}>
                    Set your options in the dock below, then click Generate
                  </div>
                </div>
              </div>
            ) : (
              /* Not selected: directive prompt */
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(120,160,255,0.18)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(120,160,255,0.1)",
                    border: "1px solid rgba(120,160,255,0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: Z.textMuted,
                    flexShrink: 0,
                    fontWeight: 600,
                  }}
                >
                  2
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: Z.textSecondary, lineHeight: 1.35 }}>
                    Select a concept to continue
                  </div>
                  <div style={{ fontSize: 11, color: Z.textMuted, marginTop: 2 }}>
                    Pick the direction that best fits your brief, then render it
                  </div>
                </div>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 16,
                    color: "rgba(120,160,255,0.35)",
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
              </div>
            )}
          </div>

          <div className="concept-grid">
            {concepts.map((concept, i) => (
              <ConceptCardView
                key={concept.id}
                concept={concept}
                index={i}
                isSelected={concept.id === selectedConceptId}
                onSelect={() => onSelectConcept(concept.id)}
                onGenerate={() => onGenerateConcept(concept.id)}
                onExpand={() => onExpandConcept(concept.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Detail state ── */}
      {state === "detail" && selectedConcept && (
        <ConceptDetailPanel
          concept={selectedConcept}
          index={selectedIndex >= 0 ? selectedIndex : 0}
          onGenerate={() => onGenerateConcept(selectedConcept.id)}
          onBack={() => onSelectConcept(selectedConcept.id)}
        />
      )}
    </div>
  );
}
