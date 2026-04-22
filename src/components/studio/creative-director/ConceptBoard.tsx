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
  borderActive:  "rgba(86,140,255,0.42)",
  glowPrimary:   "0 0 16px rgba(86,140,255,0.35)",
  glowWhite:     "0 0 10px rgba(255,255,255,0.15)",
  accentBlue:    "#3B82F6",
  accentViolet:  "#8B5CF6",
  accentCyan:    "#22D3EE",
} as const;

// ── Gradient preview backgrounds per concept index ────────────────────────────
const PREVIEW_GRADIENTS = [
  "linear-gradient(135deg, #0F1B3A 0%, #1A2850 40%, #0D1428 100%)",
  "linear-gradient(135deg, #1A0F3A 0%, #2D1850 40%, #100D28 100%)",
  "linear-gradient(135deg, #0A1F2E 0%, #0D2E40 40%, #061420 100%)",
];

const PREVIEW_ACCENTS = [
  { a: "rgba(59,130,246,0.25)", b: "rgba(139,92,246,0.15)" },
  { b: "rgba(139,92,246,0.25)", a: "rgba(236,72,153,0.15)" },
  { a: "rgba(34,211,238,0.2)",  b: "rgba(59,130,246,0.2)"  },
];

// ── Score bar ─────────────────────────────────────────────────────────────────
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
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
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

// ── Preview placeholder ────────────────────────────────────────────────────────
function ConceptPreview({ index, isSelected }: { index: number; isSelected: boolean }) {
  const grad = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  const acc  = PREVIEW_ACCENTS[index % PREVIEW_ACCENTS.length];
  return (
    <div
      style={{
        height: 180,
        background: grad,
        borderRadius: "14px 14px 0 0",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Ambient blobs */}
      <div
        style={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: acc.a,
          filter: "blur(48px)",
          top: -20,
          right: -20,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: acc.b,
          filter: "blur(36px)",
          bottom: -10,
          left: -10,
          pointerEvents: "none",
        }}
      />
      {/* Center icon */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
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
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Concept {index + 1}
        </span>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
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
      <div style={{ height: 180, background: grad, opacity: 0.4 }} />
      <div style={{ padding: 16 }}>
        {/* Title */}
        <div style={{ width: "65%", height: 14, background: "rgba(255,255,255,0.07)", borderRadius: 6, marginBottom: 10 }} />
        {/* Description lines */}
        <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 5 }} />
        <div style={{ width: "80%", height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 14 }} />
        {/* Tags */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 60, height: 20, background: "rgba(255,255,255,0.05)", borderRadius: 20 }} />
          <div style={{ width: 80, height: 20, background: "rgba(255,255,255,0.05)", borderRadius: 20 }} />
          <div style={{ width: 50, height: 20, background: "rgba(255,255,255,0.05)", borderRadius: 20 }} />
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ flex: 1.5, height: 36, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

// ── Ghost empty card — visibly distinct, clearly labelled placeholder ─────────
function GhostCard({ index }: { index: number }) {
  const grad = PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length];
  const acc  = PREVIEW_ACCENTS[index % PREVIEW_ACCENTS.length];
  // Opacity cascade: first card fully opaque, each subsequent card 18% dimmer
  const baseOpacity = 1 - index * 0.18;
  // Stagger breathing animation by index
  const breathDelay = `${index * 0.55}s`;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
        border: `1px dashed rgba(140,185,255,${0.28 - index * 0.06})`,
        borderRadius: 18,
        overflow: "hidden",
        /* CSS custom property drives the animation opacity range */
        ["--ghost-opacity" as string]: baseOpacity,
        animation: `ghostBreath 3s ease-in-out ${breathDelay} infinite`,
        boxShadow: index === 0
          ? "0 0 18px rgba(86,140,255,0.07), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "none",
      }}
    >
      {/* Preview area — slightly visible gradient so it reads as a card zone */}
      <div
        style={{
          height: 180,
          background: grad,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ambient blob for depth */}
        <div style={{
          position: "absolute", width: 100, height: 100, borderRadius: "50%",
          background: acc.a, filter: "blur(32px)", opacity: 0.45, top: 10, right: 10,
        }} />
        {/* Card number + placeholder icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              border: "1px dashed rgba(140,185,255,0.38)",
              background: "rgba(120,160,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(140,185,255,0.55)", fontSize: 17,
            }}
          >
            ✦
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            color: "rgba(140,185,255,0.42)", textTransform: "uppercase",
          }}>
            Concept {index + 1}
          </span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Number badge placeholder */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ width: 28, height: 20, background: "rgba(120,160,255,0.07)", border: "1px dashed rgba(120,160,255,0.15)", borderRadius: 6 }} />
          <div style={{ width: 72, height: 20, background: "rgba(120,160,255,0.05)", borderRadius: 20 }} />
        </div>
        {/* Title */}
        <div style={{ width: "62%", height: 13, background: "rgba(255,255,255,0.07)", borderRadius: 5, marginBottom: 10 }} />
        {/* Description lines */}
        <div style={{ width: "100%", height: 9, background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: "78%", height: 9, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 14 }} />
        {/* Tag chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 58, height: 20, background: "rgba(120,160,255,0.07)", border: "1px dashed rgba(120,160,255,0.15)", borderRadius: 20 }} />
          <div style={{ width: 76, height: 20, background: "rgba(120,160,255,0.05)", border: "1px dashed rgba(120,160,255,0.1)", borderRadius: 20 }} />
          <div style={{ width: 52, height: 20, background: "rgba(120,160,255,0.04)", borderRadius: 20 }} />
        </div>
        {/* Action row */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1.6, height: 36, background: "rgba(59,130,246,0.07)", border: "1px dashed rgba(59,130,246,0.18)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
          <div style={{ flex: 1, height: 36, background: "rgba(255,255,255,0.03)", borderRadius: 10 }} />
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
  onGenerate,
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

  // Derive tags from concept data
  const tags: { label: string; color?: string }[] = [
    { label: concept.recommendedProvider, color: Z.accentViolet },
    ...(concept.recommendedUseCase ? [{ label: concept.recommendedUseCase }] : []),
    ...(concept.scores.cinematicImpact >= 8 ? [{ label: "Cinematic", color: Z.accentCyan }] : []),
    ...(concept.scores.textAccuracy >= 8 ? [{ label: "Text-first" }] : []),
  ].slice(0, 4);

  const cardGlow = isSelected
    ? `0 0 0 1px ${Z.borderActive}, ${Z.glowPrimary}, 0 8px 32px rgba(0,0,0,0.4)`
    : isHovered
    ? `0 0 0 1px rgba(120,160,255,0.3), 0 0 12px rgba(86,140,255,0.12), 0 4px 20px rgba(0,0,0,0.3)`
    : "0 2px 12px rgba(0,0,0,0.25)";

  return (
    <div
      className="concept-card-root"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: "linear-gradient(180deg, #0F1629 0%, #0B1022 100%)",
        border: `1px solid ${isSelected ? Z.borderActive : isHovered ? "rgba(120,160,255,0.3)" : Z.borderSubtle}`,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: cardGlow,
        transform: isSelected ? "scale(1.012)" : "scale(1)",
        maxWidth: 420,
        width: "100%",
      }}
    >
      {/* ── Preview area ── */}
      <ConceptPreview index={index} isSelected={isSelected} />

      {/* ── Card body ── */}
      <div style={{ padding: 16 }}>

        {/* Number badge + selected indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: isSelected ? "#93c5fd" : Z.textMuted,
              background: isSelected ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isSelected ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 6,
              padding: "3px 8px",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          {isSelected && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#93c5fd",
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.25)",
                borderRadius: 20,
                padding: "3px 9px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: Z.glowPrimary,
              }}
            >
              ✓ Selected
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 16,
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
            fontSize: 13.5,
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
              marginBottom: 16,
            }}
          >
            {tags.map((tag, i) => (
              <Chip key={i} label={tag.label} color={tag.color} />
            ))}
          </div>
        )}

        {/* Score bars — collapsed when not selected */}
        {isSelected && (
          <div style={{ marginBottom: 14 }}>
            <ScoreBar label="Text Accuracy"   value={concept.scores.textAccuracy}   color={Z.accentBlue}   />
            <ScoreBar label="Cinematic Impact" value={concept.scores.cinematicImpact} color={Z.accentViolet} />
            <ScoreBar label="Design Control"  value={concept.scores.designControl}  color={Z.accentCyan}   />
            <ScoreBar label="Speed"           value={concept.scores.speed}          color="#10B981"        />
          </div>
        )}

        {/* Actions row */}
        <div
          style={{ display: "flex", gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Select Concept — primary */}
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
                ? `1px solid ${Z.borderActive}`
                : `1px solid rgba(59,130,246,0.3)`,
              background: isSelected
                ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(79,70,229,0.2))"
                : hoveredAction === "select"
                ? "rgba(59,130,246,0.15)"
                : "rgba(59,130,246,0.08)",
              color: isSelected ? "#93c5fd" : Z.textSecondary,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isSelected ? Z.glowPrimary : "none",
              letterSpacing: "0.01em",
            }}
          >
            {isSelected ? "✓ Selected" : "Select Concept"}
          </button>

          {/* Preview (detail view) */}
          <button
            onClick={onExpand}
            onMouseEnter={() => setHoveredAction("preview")}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              flex: 1,
              height: 38,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.09)",
              background: hoveredAction === "preview" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              color: Z.textSecondary,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Preview
          </button>

          {/* Refine */}
          <button
            onClick={onExpand}
            onMouseEnter={() => setHoveredAction("refine")}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              flex: 1,
              height: 38,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.09)",
              background: hoveredAction === "refine" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              color: Z.textMuted,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Refine
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
        { label: "Rationale",            content: concept.rationale         },
        { label: "Layout Strategy",      content: concept.layoutStrategy    },
        { label: "Typography Approach",  content: concept.typographyStrategy },
        { label: "Color Strategy",       content: concept.colorStrategy     },
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
          50% { opacity: 1; }
        }
        @keyframes ghostBreath {
          0%, 100% { opacity: var(--ghost-opacity); box-shadow: 0 0 0 0 rgba(120,160,255,0); }
          50% { opacity: calc(var(--ghost-opacity) * 1.12); box-shadow: 0 0 14px rgba(120,160,255,0.08); }
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
                border: `1px solid rgba(120,160,255,0.2)`,
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
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            7,
            padding:        "9px 16px",
            background:     "rgba(254,206,1,0.04)",
            border:         "1px solid rgba(254,206,1,0.11)",
            borderRadius:   10,
            marginBottom:   16,
          }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>✨</span>
            <span style={{
              fontSize:      15,
              fontWeight:    500,
              color:         "rgba(252,211,77,0.68)",
              letterSpacing: "0.01em",
              lineHeight:    1,
            }}>
              AI will generate 3 strategic directions for your campaign
            </span>
          </div>

          {/* Ghost cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <GhostCard key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Results state ── */}
      {state === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
          <div style={{ padding: "0 0 20px" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: Z.textPrimary,
                marginBottom: 6,
                letterSpacing: "-0.01em",
              }}
            >
              {concepts.length} Creative Direction{concepts.length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 13, color: Z.textMuted, lineHeight: 1.5 }}>
              {selectedConceptId
                ? "Concept selected — use the dock below to render."
                : "Select a concept to begin rendering."}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
