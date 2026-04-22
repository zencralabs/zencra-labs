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

// ── Score bar component ────────────────────────────────────────────────────────
function ScoreBar({
  label,
  value,
  color = "#2563EB",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
          {value}/10
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(value / 10) * 100}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "18px 20px",
        animation: `skeletonPulse 1.6s ease-in-out ${index * 0.2}s infinite`,
      }}
    >
      {/* Badge placeholder */}
      <div
        style={{
          width: 28,
          height: 20,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          marginBottom: 12,
        }}
      />
      {/* Title placeholder */}
      <div
        style={{
          width: "70%",
          height: 14,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      {/* Summary lines */}
      <div
        style={{
          width: "100%",
          height: 10,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 3,
          marginBottom: 5,
        }}
      />
      <div
        style={{
          width: "85%",
          height: 10,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 3,
          marginBottom: 14,
        }}
      />
      {/* Provider tag */}
      <div
        style={{
          width: 80,
          height: 18,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 20,
          marginBottom: 14,
        }}
      />
      {/* Score bars */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ width: 70, height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 2 }} />
            <div style={{ width: 24, height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 2 }} />
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2 }} />
        </div>
      ))}
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
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? "rgba(37,99,235,0.06)"
          : "rgba(255,255,255,0.02)",
        border: isSelected
          ? "1px solid rgba(37,99,235,0.25)"
          : "1px solid rgba(255,255,255,0.07)",
        borderLeft: isSelected
          ? "3px solid rgba(37,99,235,0.7)"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        position: "relative",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: isSelected ? "#93c5fd" : "rgba(255,255,255,0.25)",
            background: isSelected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.05)",
            border: isSelected ? "1px solid rgba(37,99,235,0.2)" : "1px solid rgba(255,255,255,0.07)",
            borderRadius: 4,
            padding: "3px 7px",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* Provider badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 20,
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.2)",
            color: "#c4b5fd",
            letterSpacing: "0.03em",
          }}
        >
          {concept.recommendedProvider}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#fff",
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {concept.title}
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        {concept.summary}
      </div>

      {/* Score bars */}
      <div style={{ marginBottom: 14 }}>
        <ScoreBar label="Text Accuracy" value={concept.scores.textAccuracy} color="#2563EB" />
        <ScoreBar label="Cinematic Impact" value={concept.scores.cinematicImpact} color="#7C3AED" />
        <ScoreBar label="Design Control" value={concept.scores.designControl} color="#0891B2" />
        <ScoreBar label="Speed" value={concept.scores.speed} color="#059669" />
      </div>

      {/* Action row */}
      <div
        style={{ display: "flex", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        {[
          { key: "expand", label: "Preview Details", action: onExpand },
          { key: "generate", label: "Generate This", action: onGenerate },
          { key: "more", label: "More Like This", action: () => {} },
        ].map(({ key, label, action }) => (
          <button
            key={key}
            onClick={action}
            onMouseEnter={() => setHoveredAction(key)}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              flex: key === "generate" ? 1.5 : 1,
              padding: "6px 8px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              border:
                key === "generate"
                  ? "1px solid rgba(37,99,235,0.35)"
                  : "1px solid rgba(255,255,255,0.09)",
              background:
                key === "generate"
                  ? hoveredAction === "generate"
                    ? "rgba(37,99,235,0.2)"
                    : "rgba(37,99,235,0.12)"
                  : hoveredAction === key
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(255,255,255,0.04)",
              color:
                key === "generate"
                  ? "#93c5fd"
                  : "rgba(255,255,255,0.5)",
              cursor: "pointer",
              transition: "all 0.12s ease",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function ConceptDetailPanel({
  concept,
  onGenerate,
  onBack,
}: {
  concept: ConceptCard;
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
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          fontWeight: 600,
          padding: "0 0 16px 0",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ← Back to Concepts
      </button>

      <div
        style={{
          background: "rgba(37,99,235,0.05)",
          border: "1px solid rgba(37,99,235,0.15)",
          borderLeft: "3px solid rgba(37,99,235,0.6)",
          borderRadius: 12,
          padding: "20px 22px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "#93c5fd",
            marginBottom: 8,
          }}
        >
          CONCEPT DIRECTION
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          {concept.title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          {concept.summary}
        </div>
      </div>

      {/* Detail sections */}
      {[
        { label: "Rationale", content: concept.rationale },
        { label: "Layout Strategy", content: concept.layoutStrategy },
        { label: "Typography Approach", content: concept.typographyStrategy },
        { label: "Color Strategy", content: concept.colorStrategy },
        { label: "Recommended Use Case", content: concept.recommendedUseCase },
      ].map(({ label, content }) =>
        content ? (
          <div
            key={label}
            style={{
              marginBottom: 14,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
                marginBottom: 6,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              {content}
            </div>
          </div>
        ) : null
      )}

      {/* Provider recommendation */}
      <div
        style={{
          background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.15)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(196,181,253,0.5)",
            marginBottom: 6,
          }}
        >
          Recommended Provider
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd" }}>
          {concept.recommendedProvider}
        </div>
      </div>

      {/* Score bars */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)",
            marginBottom: 12,
          }}
        >
          Performance Scores
        </div>
        <ScoreBar label="Text Accuracy" value={concept.scores.textAccuracy} color="#2563EB" />
        <ScoreBar label="Cinematic Impact" value={concept.scores.cinematicImpact} color="#7C3AED" />
        <ScoreBar label="Design Control" value={concept.scores.designControl} color="#0891B2" />
        <ScoreBar label="Speed" value={concept.scores.speed} color="#059669" />
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        style={{
          width: "100%",
          padding: "13px 0",
          background: "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(124,58,237,0.18))",
          border: "1px solid rgba(37,99,235,0.35)",
          borderRadius: 10,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          letterSpacing: "0.02em",
        }}
      >
        <span>✦</span>
        Generate 4 Outputs
        <span
          style={{
            fontSize: 10,
            padding: "2px 6px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 4,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 600,
          }}
        >
          2 cr
        </span>
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

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "none",
        padding: "20px 20px",
      }}
    >
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .concept-card:hover { border-color: rgba(255,255,255,0.12) !important; }
      `}</style>

      {/* ── Empty state ── */}
      {state === "empty" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: 360,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.1)",
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            ✦
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              marginBottom: 10,
              letterSpacing: "0.01em",
            }}
          >
            No concepts yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.2)",
              lineHeight: 1.6,
              maxWidth: 280,
            }}
          >
            Fill in your brief and generate creative directions — AI will produce 3 strategic concepts for your campaign.
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Thinking through concepts…
          </div>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </div>
      )}

      {/* ── Results state ── */}
      {state === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {concepts.length} Creative Direction{concepts.length !== 1 ? "s" : ""}
          </div>
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
      )}

      {/* ── Detail state ── */}
      {state === "detail" && selectedConcept && (
        <ConceptDetailPanel
          concept={selectedConcept}
          onGenerate={() => onGenerateConcept(selectedConcept.id)}
          onBack={() => onSelectConcept(selectedConcept.id)}
        />
      )}
    </div>
  );
}
