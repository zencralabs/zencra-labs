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
}

interface ConceptBoardProps {
  state: "empty" | "loading" | "results" | "detail";
  concepts: ConceptCard[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string) => void;
  onGenerateConcept: (id: string) => void;
  onExpandConcept: (id: string) => void;
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
function ConceptPreview({ index, isSelected }: { index: number; isSelected: boolean }) {
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
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const tags: { label: string; color?: string }[] = [
    { label: concept.recommendedProvider, color: Z.accentViolet },
    ...(concept.recommendedUseCase ? [{ label: concept.recommendedUseCase }] : []),
    ...(concept.scores.cinematicImpact >= 8 ? [{ label: "Cinematic", color: Z.accentCyan }] : []),
    ...(concept.scores.textAccuracy >= 8 ? [{ label: "Text-first" }] : []),
  ].slice(0, 3);

  const cardGlow = isSelected
    ? `0 0 0 0px transparent, 0 0 28px rgba(86,140,255,0.28), 0 8px 32px rgba(0,0,0,0.45)`
    : isHovered
    ? `0 0 0 0px transparent, 0 8px 28px rgba(86,140,255,0.1), 0 4px 20px rgba(0,0,0,0.3)`
    : "0 2px 12px rgba(0,0,0,0.25)";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
        border: isSelected
          ? "1.5px solid rgba(86,140,255,0.6)"
          : `1px solid ${isHovered ? "rgba(120,160,255,0.3)" : Z.borderSubtle}`,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.22s ease",
        boxShadow: cardGlow,
        transform: isHovered && !isSelected ? "translateY(-3px)" : "translateY(0)",
        width: "100%",
      }}
    >
      {/* Preview area */}
      <ConceptPreview index={index} isSelected={isSelected} />

      {/* Card body */}
      <div style={{ padding: "16px 16px 22px" }}>

        {/* Selected pill (only when selected) */}
        {isSelected && (
          <div style={{ marginBottom: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#93c5fd",
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.28)",
                borderRadius: 20,
                padding: "3px 9px",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                boxShadow: "0 0 12px rgba(86,140,255,0.2)",
              }}
            >
              ✓ Selected
            </span>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: Z.textPrimary,
            marginBottom: 8,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {concept.title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 15,
            color: Z.textSecondary,
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          {concept.summary}
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {tags.map((tag, i) => (
              <Chip key={i} label={tag.label} color={tag.color} />
            ))}
          </div>
        )}

        {/* Strength bars — only on selected card */}
        {isSelected && (
          <div style={{ marginBottom: 14 }}>
            <StrengthBar label="Creativity"        value={concept.scores.cinematicImpact} />
            <StrengthBar label="Commercial Appeal" value={concept.scores.designControl}   />
            <StrengthBar label="Visual Impact"     value={concept.scores.textAccuracy}    />
          </div>
        )}

        {/* Actions */}
        <div
          style={{ display: "flex", gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Select Concept — dominant CTA */}
          <button
            onClick={onSelect}
            onMouseEnter={() => setHoveredAction("select")}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              flex: 1.6,
              height: 38,
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              border: isSelected
                ? "1px solid rgba(86,140,255,0.5)"
                : hoveredAction === "select"
                ? "1px solid rgba(59,130,246,0.5)"
                : "1px solid rgba(59,130,246,0.3)",
              background: isSelected
                ? "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(79,70,229,0.22))"
                : hoveredAction === "select"
                ? "rgba(59,130,246,0.18)"
                : "rgba(59,130,246,0.1)",
              color: isSelected ? "#93c5fd" : "#6BA8FF",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isSelected ? "0 0 12px rgba(86,140,255,0.22)" : "none",
              letterSpacing: "0.01em",
            }}
          >
            {isSelected ? "✓ Selected" : "Select Concept"}
          </button>

          {/* Preview — visually lighter / subordinate */}
          <button
            onClick={onExpand}
            onMouseEnter={() => setHoveredAction("preview")}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              flex: 1,
              height: 38,
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.07)",
              background: hoveredAction === "preview"
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.02)",
              color: hoveredAction === "preview"
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.28)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Preview
          </button>
        </div>
      </div>
    </div>
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
                    Concept selected — ready to render
                  </div>
                  <div style={{ fontSize: 11, color: Z.textMuted, marginTop: 2 }}>
                    Set your options in the dock below and click Generate
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
