"use client";

import { useState } from "react";
import Tooltip from "@/components/ui/Tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// OutputWorkspace — Right column of the AI Creative Director
// ─────────────────────────────────────────────────────────────────────────────

export type OutputAction =
  | "download"
  | "fullscreen"
  | "save"
  | "regenerate"
  | "variation_tray"
  | "adapt_format";

export interface GenerationResult {
  id: string;
  url: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  provider: string;
  model: string;
  creditCost: number;
  variationType?: string;
  generationType: "base" | "variation" | "adaptation" | "fork";
  /** The assets table ID — used by the shell to poll job status for async providers */
  assetId?: string;
}

interface OutputWorkspaceProps {
  generations: GenerationResult[];
  activeVariationTray: string | null;
  onAction: (action: OutputAction, generationId: string) => void;
  onVariation: (variationType: string, generationId: string) => void;
  onAdaptFormat: (format: string, generationId: string) => void;
  /** Whether the user has generated concepts yet — drives context-aware empty state */
  hasConceptsGenerated?: boolean;
  /** Whether the user has selected a concept — drives context-aware empty state */
  hasConceptSelected?: boolean;
  /** Title of the selected concept — shown in the ready-to-render empty state */
  selectedConceptTitle?: string;
}

// ── Zencra brand tokens ────────────────────────────────────────────────────────
const Z = {
  textPrimary:   "#F5F7FF",
  textSecondary: "#A7B0C5",
  textMuted:     "#6F7893",
  borderSubtle:  "rgba(255,255,255,0.06)",
  borderSoft:    "rgba(120,160,255,0.14)",
  bgCard:        "rgba(255,255,255,0.025)",
} as const;

// ── Style constants ────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: Z.textSecondary,
};

const VARIATION_TYPES = [
  { key: "more_premium", label: "More Premium", icon: "◆" },
  { key: "more_minimal", label: "More Minimal", icon: "○" },
  { key: "more_cinematic", label: "More Cinematic", icon: "▣" },
  { key: "text_accuracy", label: "Text Accuracy", icon: "Aa" },
  { key: "product_focus", label: "Product Focus", icon: "◎" },
];

const FORMAT_OPTIONS = [
  { key: "9:16", label: "Story", sub: "9:16" },
  { key: "1:1", label: "Square", sub: "1:1" },
  { key: "16:9", label: "Banner", sub: "16:9" },
];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: GenerationResult["status"] }) {
  const configs: Record<
    GenerationResult["status"],
    { color: string; bg: string; label: string; dot?: boolean }
  > = {
    queued: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)", label: "Queued" },
    processing: { color: "#60a5fa", bg: "rgba(37,99,235,0.12)", label: "Processing", dot: true },
    completed: { color: "#34d399", bg: "rgba(5,150,105,0.1)", label: "Done" },
    failed: { color: "#f87171", bg: "rgba(239,68,68,0.1)", label: "Failed" },
  };
  const c = configs[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 20,
        background: c.bg,
        color: c.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        letterSpacing: "0.03em",
      }}
    >
      {c.dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#60a5fa",
            animation: "cdPulse 1.4s ease-in-out infinite",
            display: "inline-block",
          }}
        />
      )}
      {c.label}
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: GenerationResult["generationType"] }) {
  if (type === "base") return null;
  const labels: Record<string, { label: string; color: string }> = {
    variation: { label: "Variation", color: "rgba(124,58,237,0.6)" },
    adaptation: { label: "Adapted", color: "rgba(8,145,178,0.6)" },
    fork: { label: "Fork", color: "rgba(245,158,11,0.6)" },
  };
  const cfg = labels[type];
  if (!cfg) return null;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 3,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${cfg.color}`,
        color: cfg.color,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Single generation card ────────────────────────────────────────────────────
function GenerationCard({
  gen,
  isVariationTrayOpen,
  onAction,
  onVariation,
  onAdaptFormat,
}: {
  gen: GenerationResult;
  isVariationTrayOpen: boolean;
  onAction: (action: OutputAction) => void;
  onVariation: (variationType: string) => void;
  onAdaptFormat: (format: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [publishPulse, setPublishPulse] = useState(false);

  function handlePublish() {
    if (publishPulse) return;
    setPublishPulse(true);
    setTimeout(() => setPublishPulse(false), 2000);
  }

  const isLoading = gen.status === "queued" || gen.status === "processing";
  const isCompleted = gen.status === "completed";
  const isFailed = gen.status === "failed";

  return (
    <div
      style={{
        background: Z.bgCard,
        border: `1px solid ${isHovered ? "rgba(120,160,255,0.2)" : Z.borderSubtle}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.18s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image area */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "rgba(0,0,0,0.3)" }}>
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: "rgba(5,8,22,0.85)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: "2px solid rgba(37,99,235,0.3)",
                borderTop: "2px solid #2563EB",
                borderRadius: "50%",
                animation: "cdSpin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
              {gen.status === "queued" ? "Queued…" : "Generating…"}
            </span>
          </div>
        )}

        {isFailed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "rgba(5,8,22,0.85)",
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
            <span style={{ fontSize: 11, color: "rgba(248,113,113,0.8)", fontWeight: 600 }}>
              Generation failed
            </span>
            <button
              onClick={() => onAction("regenerate")}
              style={{
                marginTop: 4,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isCompleted && gen.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gen.url}
            alt="Generated output"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}

        {/* Hover overlay actions */}
        {isCompleted && isHovered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {[
              { key: "download",   icon: "↓", title: "Download"   },
              { key: "fullscreen", icon: "⤢", title: "Fullscreen" },
              { key: "save",       icon: "♡", title: "Save"       },
              { key: "regenerate", icon: "⟳", title: "Regenerate" },
            ].map(({ key, icon, title }) => (
              <Tooltip key={key} content={title}>
                <button
                  onClick={() => onAction(key as OutputAction)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.12s ease",
                  }}
                >
                  {icon}
                </button>
              </Tooltip>
            ))}

            {/* Publish — coming soon */}
            <Tooltip content="Gallery publish coming soon">
              <button
                onClick={handlePublish}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: publishPulse
                    ? "1px solid rgba(251,191,36,0.4)"
                    : "1px solid rgba(251,191,36,0.2)",
                  background: publishPulse
                    ? "rgba(251,191,36,0.15)"
                    : "rgba(251,191,36,0.06)",
                  color: publishPulse ? "rgba(251,191,36,0.9)" : "rgba(251,191,36,0.5)",
                  fontSize: publishPulse ? 9 : 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.18s ease",
                  letterSpacing: publishPulse ? "0.03em" : "0",
                }}
              >
                {publishPulse ? "Soon" : "↑"}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Info row */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <StatusBadge status={gen.status} />
          <TypeBadge type={gen.generationType} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            {gen.model}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {gen.creditCost} cr
          </span>
        </div>
      </div>

      {/* Action row */}
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 8,
        }}
      >
        {[
          { key: "download", label: "↓", title: "Download" },
          { key: "fullscreen", label: "⤢", title: "Fullscreen" },
          { key: "save", label: "♡", title: "Save" },
          { key: "regenerate", label: "⟳", title: "Regenerate" },
        ].map(({ key, label, title }) => (
          <Tooltip key={key} content={title}>
          <button
            onClick={() => onAction(key as OutputAction)}
            disabled={!isCompleted && key !== "regenerate"}
            onMouseEnter={() => setHoveredBtn(key)}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: hoveredBtn === key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              color: isCompleted || key === "regenerate"
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.2)",
              fontSize: 13,
              cursor: isCompleted || key === "regenerate" ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.12s ease",
            }}
          >
            {label}
          </button>
          </Tooltip>
        ))}

        {/* Publish pill — coming soon */}
        <Tooltip content="Gallery publish coming soon">
          <button
            onClick={handlePublish}
            onMouseEnter={() => setHoveredBtn("publish")}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              padding: "0 9px",
              height: 28,
              borderRadius: 6,
              border: publishPulse
                ? "1px solid rgba(251,191,36,0.38)"
                : hoveredBtn === "publish"
                ? "1px solid rgba(251,191,36,0.28)"
                : "1px solid rgba(251,191,36,0.16)",
              background: publishPulse
                ? "rgba(251,191,36,0.12)"
                : hoveredBtn === "publish"
                ? "rgba(251,191,36,0.08)"
                : "rgba(251,191,36,0.04)",
              color: publishPulse
                ? "rgba(251,191,36,0.9)"
                : "rgba(251,191,36,0.45)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s ease",
              letterSpacing: "0.01em",
            }}
          >
            {publishPulse ? "Coming soon" : "↑ Publish"}
          </button>
        </Tooltip>

        {/* Variations button */}
        <button
          onClick={() => onAction("variation_tray")}
          disabled={!isCompleted}
          onMouseEnter={() => setHoveredBtn("variations")}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            marginLeft: "auto",
            padding: "0 10px",
            height: 28,
            borderRadius: 6,
            border: isVariationTrayOpen
              ? "1px solid rgba(124,58,237,0.4)"
              : "1px solid rgba(255,255,255,0.08)",
            background: isVariationTrayOpen
              ? "rgba(124,58,237,0.12)"
              : hoveredBtn === "variations"
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.03)",
            color: isVariationTrayOpen ? "#c4b5fd" : "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: isCompleted ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "all 0.12s ease",
            opacity: isCompleted ? 1 : 0.4,
          }}
        >
          Variations{" "}
          <span style={{ fontSize: 9, transform: isVariationTrayOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            ▾
          </span>
        </button>
      </div>

      {/* Variation tray */}
      {isVariationTrayOpen && (
        <div
          style={{
            padding: "0 12px 10px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <div style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
            {VARIATION_TYPES.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => onVariation(key)}
                style={{
                  flexShrink: 0,
                  padding: "5px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(124,58,237,0.2)",
                  background: "rgba(124,58,237,0.08)",
                  color: "#c4b5fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  transition: "all 0.12s ease",
                }}
              >
                <span style={{ fontSize: 10 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Format adaptation row */}
      {isCompleted && (
        <div
          style={{
            padding: "0 16px 12px",
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ ...labelStyle, alignSelf: "center", marginRight: 4, flexShrink: 0 }}>
            Adapt:
          </span>
          {FORMAT_OPTIONS.map(({ key, label, sub }) => (
            <button
              key={key}
              onClick={() => onAdaptFormat(key)}
              onMouseEnter={() => setHoveredBtn(`format_${key}`)}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: "4px 9px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.08)",
                background: hoveredBtn === `format_${key}`
                  ? "rgba(8,145,178,0.1)"
                  : "rgba(255,255,255,0.03)",
                color: hoveredBtn === `format_${key}`
                  ? "rgba(103,232,249,0.8)"
                  : "rgba(255,255,255,0.4)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                lineHeight: 1.2,
                transition: "all 0.12s ease",
              }}
            >
              {label}
              <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>{sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OutputWorkspace({
  generations,
  activeVariationTray,
  onAction,
  onVariation,
  onAdaptFormat,
  hasConceptsGenerated = false,
  hasConceptSelected = false,
  selectedConceptTitle,
}: OutputWorkspaceProps) {
  const isEmpty = generations.length === 0;

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "none",
        padding: "20px 16px",
      }}
    >
      <style>{`
        @keyframes cdSpin { to { transform: rotate(360deg); } }
        @keyframes cdPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: Z.textPrimary,
              margin: 0,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Outputs
            {generations.length > 0 && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: Z.textMuted,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${Z.borderSubtle}`,
                  borderRadius: 20,
                  padding: "2px 9px",
                }}
              >
                {generations.length}
              </span>
            )}
          </h3>
          {generations.length > 0 && (
            <button
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 7,
                border: `1px solid ${Z.borderSubtle}`,
                background: "rgba(255,255,255,0.03)",
                color: Z.textSecondary,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "all 0.15s ease",
              }}
            >
              ↓ Download All
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: 15,
            color: Z.textMuted,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Generated concept outputs appear here and are saved to your project.
        </p>
      </div>

      {/* ── CD output destination note ── */}
      <div
        style={{
          marginBottom: 16,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(59,130,246,0.07)",
          border: "1px solid rgba(120,160,255,0.22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>◈</span>
        <p style={{ fontSize: 14, color: Z.textSecondary, margin: 0, lineHeight: 1.65 }}>
          Outputs are saved to this project and also appear in{" "}
          <span style={{ color: "#93c5fd", fontWeight: 600 }}>Image Studio → History</span>{" "}
          tagged with <span style={{ color: Z.textSecondary, fontWeight: 600 }}>Creative Director</span> so you can find them anytime.
        </p>
      </div>

      {/* ── Empty state — context-aware ── */}
      {isEmpty && (
        <>
          {/* State A: concept selected — ready to render */}
          {hasConceptSelected && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 11,
                  background: "rgba(59,130,246,0.07)",
                  border: "1px solid rgba(86,140,255,0.26)",
                  boxShadow: "0 0 16px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(59,130,246,0.18)",
                      border: "1px solid rgba(86,140,255,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#93c5fd",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
                    Ready to render
                  </span>
                </div>
                {selectedConceptTitle && (
                  <div
                    style={{
                      fontSize: 12,
                      color: Z.textMuted,
                      paddingLeft: 28,
                      lineHeight: 1.45,
                    }}
                  >
                    Concept: <span style={{ color: Z.textSecondary, fontWeight: 500 }}>{selectedConceptTitle}</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: Z.textMuted, paddingLeft: 28, marginTop: 3 }}>
                  Configure options in the dock below, then click <span style={{ color: Z.textSecondary, fontWeight: 600 }}>Generate</span>
                </div>
              </div>
            </div>
          )}

          {/* State B: concepts generated but none selected */}
          {hasConceptsGenerated && !hasConceptSelected && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 11,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(120,160,255,0.16)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 15, color: "rgba(120,160,255,0.5)", flexShrink: 0 }}>←</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: Z.textSecondary, marginBottom: 2 }}>
                    Select a concept to begin
                  </div>
                  <div style={{ fontSize: 11, color: Z.textMuted, lineHeight: 1.4 }}>
                    Choose a direction from the center panel to unlock rendering
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slot grid — always shown in empty state */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1 / 1",
                  background: hasConceptSelected
                    ? "rgba(59,130,246,0.04)"
                    : "rgba(120,160,255,0.04)",
                  border: hasConceptSelected
                    ? "1px dashed rgba(86,140,255,0.28)"
                    : "1px dashed rgba(140,185,255,0.22)",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = hasConceptSelected
                    ? "rgba(86,140,255,0.48)"
                    : "rgba(140,185,255,0.38)";
                  (e.currentTarget as HTMLDivElement).style.background = hasConceptSelected
                    ? "rgba(59,130,246,0.07)"
                    : "rgba(120,160,255,0.07)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = hasConceptSelected
                    ? "rgba(86,140,255,0.28)"
                    : "rgba(140,185,255,0.22)";
                  (e.currentTarget as HTMLDivElement).style.background = hasConceptSelected
                    ? "rgba(59,130,246,0.04)"
                    : "rgba(120,160,255,0.04)";
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    border: hasConceptSelected
                      ? "1px dashed rgba(86,140,255,0.35)"
                      : "1px dashed rgba(120,160,255,0.25)",
                    background: hasConceptSelected
                      ? "rgba(59,130,246,0.1)"
                      : "rgba(120,160,255,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: hasConceptSelected
                      ? "rgba(147,197,253,0.55)"
                      : "rgba(120,160,255,0.35)",
                    fontSize: 14,
                  }}
                >
                  ✦
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: hasConceptSelected
                      ? "rgba(147,197,253,0.4)"
                      : "rgba(167,176,197,0.3)",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                  }}
                >
                  {i === 0 ? "Output 1" : `Slot ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Generation grid ── */}
      {!isEmpty && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {generations.map((gen) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              isVariationTrayOpen={activeVariationTray === gen.id}
              onAction={(action) => onAction(action, gen.id)}
              onVariation={(variationType) => onVariation(variationType, gen.id)}
              onAdaptFormat={(format) => onAdaptFormat(format, gen.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
