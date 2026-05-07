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
  | "adapt_format"
  /** Workflow: animate — open Video Studio with this image as start frame (auto-animate) */
  | "video_animate"
  /** Workflow: send output to Video Studio as start frame */
  | "video_start_frame"
  /** Workflow: send output to Video Studio as end frame */
  | "video_end_frame";

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
  /** Concept this output was generated from — for grouping in the stream */
  conceptId?: string;
  conceptTitle?: string;
  conceptIndex?: number;
  /** Local-only published state — no DB change */
  published?: boolean;
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
  /** 0-based index of the selected concept — used to show matching gradient preview */
  selectedConceptIndex?: number;
  /** True while a render is actively in progress — shows skeleton hint */
  isGeneratingOutputs?: boolean;
  /** Called when user clicks a generation card to re-open the preview modal */
  onOpenPreview?: (generationId: string) => void;
  /** Called when user selects "Retry with another model" from a failed card */
  onRetryWithModel?: (generationId: string, model: string) => void;
}

// Gradient/accent pairs — mirror ConceptBoard so the preview block feels connected
const CONCEPT_GRADIENTS = [
  "linear-gradient(148deg, #060E28 0%, #0C1E48 48%, #05112A 100%)",
  "linear-gradient(148deg, #130930 0%, #240F56 48%, #0B0524 100%)",
  "linear-gradient(148deg, #031419 0%, #072D35 48%, #020C10 100%)",
];
const CONCEPT_ACCENTS = [
  { a: "rgba(37,99,235,0.55)", b: "rgba(6,182,212,0.3)"   },
  { a: "rgba(109,40,217,0.55)", b: "rgba(219,39,119,0.28)" },
  { a: "rgba(13,148,136,0.55)", b: "rgba(16,185,129,0.28)" },
];

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

// Model options for "retry with another model" dropdown
const RETRY_MODELS = [
  { value: "gpt-image-1",     label: "GPT Image 2"       },
  { value: "nano-banana-pro", label: "Nano Banana Pro"   },
  { value: "nano-banana-2",   label: "Nano Banana 2"     },
  { value: "seedream-v5",     label: "Seedream v5" },
  { value: "flux-kontext",    label: "Flux Kontext Max"  },
];

// ── Single generation card ────────────────────────────────────────────────────
function GenerationCard({
  gen,
  isVariationTrayOpen,
  onAction,
  onVariation,
  onAdaptFormat,
  onRetryWithModel,
}: {
  gen: GenerationResult;
  isVariationTrayOpen: boolean;
  onAction: (action: OutputAction) => void;
  onVariation: (variationType: string) => void;
  onAdaptFormat: (format: string) => void;
  onRetryWithModel?: (model: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(gen.published ?? false);
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [animateOpen, setAnimateOpen] = useState(false);

  function handlePublish() {
    setIsPublished(true);
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
      {/* Image area — 4:3 ratio feels more generous in a single-col layout */}
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: "rgba(0,0,0,0.3)" }}>
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
              padding: "0 16px",
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
            <span style={{ fontSize: 11, color: "rgba(248,113,113,0.8)", fontWeight: 600, textAlign: "center" }}>
              Generation failed
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={() => onAction("regenerate")}
                style={{
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
              {onRetryWithModel && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowRetryMenu((v) => !v)}
                    style={{
                      padding: "5px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid rgba(120,160,255,0.22)",
                      background: "rgba(37,99,235,0.1)",
                      color: "rgba(147,197,253,0.8)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Try another model
                    <span style={{ fontSize: 9 }}>▾</span>
                  </button>
                  {showRetryMenu && (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 490 }}
                        onClick={() => setShowRetryMenu(false)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 6px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#0A1120",
                          border: "1px solid rgba(120,160,255,0.18)",
                          borderRadius: 10,
                          overflow: "hidden",
                          zIndex: 495,
                          minWidth: 160,
                          boxShadow: "0 16px 40px rgba(0,0,0,0.75)",
                        }}
                      >
                        {RETRY_MODELS.filter((m) => m.value !== gen.model).map((m) => (
                          <button
                            key={m.value}
                            onClick={() => {
                              setShowRetryMenu(false);
                              onRetryWithModel(m.value);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              display: "block",
                              padding: "9px 14px",
                              border: "none",
                              background: "transparent",
                              color: "rgba(245,247,255,0.8)",
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "background 0.1s ease",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,99,235,0.15)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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

            {/* Publish to Image Studio */}
            <Tooltip content={isPublished ? "Published to Image Studio" : "Publish to Image Studio"}>
              <button
                onClick={handlePublish}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: isPublished
                    ? "1px solid rgba(52,211,153,0.5)"
                    : "1px solid rgba(251,191,36,0.2)",
                  background: isPublished
                    ? "rgba(5,150,105,0.2)"
                    : "rgba(251,191,36,0.06)",
                  color: isPublished ? "rgba(52,211,153,0.9)" : "rgba(251,191,36,0.5)",
                  fontSize: isPublished ? 14 : 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.18s ease",
                }}
              >
                {isPublished ? "✓" : "↑"}
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

        {/* Publish pill */}
        <Tooltip content={isPublished ? "Published to Image Studio" : "Publish to Image Studio"}>
          <button
            onClick={handlePublish}
            onMouseEnter={() => setHoveredBtn("publish")}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              padding: "0 9px",
              height: 28,
              borderRadius: 6,
              border: isPublished
                ? "1px solid rgba(52,211,153,0.45)"
                : hoveredBtn === "publish"
                ? "1px solid rgba(251,191,36,0.28)"
                : "1px solid rgba(251,191,36,0.16)",
              background: isPublished
                ? "rgba(5,150,105,0.15)"
                : hoveredBtn === "publish"
                ? "rgba(251,191,36,0.08)"
                : "rgba(251,191,36,0.04)",
              color: isPublished
                ? "rgba(52,211,153,0.9)"
                : "rgba(251,191,36,0.45)",
              fontSize: 11,
              fontWeight: 600,
              cursor: isPublished ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s ease",
              letterSpacing: "0.01em",
            }}
          >
            {isPublished ? "✓ Published" : "↑ Publish"}
          </button>
        </Tooltip>

        {/* Animate → Video Studio button + dropdown */}
        {isCompleted && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setAnimateOpen(v => !v)}
              onMouseEnter={() => setHoveredBtn("animate")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: "0 9px",
                height: 28,
                borderRadius: 6,
                border: animateOpen
                  ? "1px solid rgba(14,165,160,0.5)"
                  : hoveredBtn === "animate"
                  ? "1px solid rgba(14,165,160,0.35)"
                  : "1px solid rgba(14,165,160,0.2)",
                background: animateOpen
                  ? "rgba(14,165,160,0.15)"
                  : hoveredBtn === "animate"
                  ? "rgba(14,165,160,0.1)"
                  : "rgba(14,165,160,0.05)",
                color: "rgba(94,234,212,0.85)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.12s ease",
              }}
            >
              ▶ Animate
              <span style={{ fontSize: 8, transform: animateOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
            </button>
            {animateOpen && (
              <>
                {/* Close backdrop */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 300 }}
                  onClick={() => setAnimateOpen(false)}
                />
                <div style={{
                  position: "absolute", bottom: "calc(100% + 5px)", left: 0,
                  background: "#141420",
                  border: "1px solid rgba(14,165,160,0.3)",
                  borderRadius: 8, overflow: "hidden", zIndex: 301,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
                  minWidth: 160,
                }}>
                  {[
                    { action: "video_start_frame" as const, label: "Use as Start Frame", desc: "Opens as first frame" },
                    { action: "video_end_frame"   as const, label: "Use as End Frame",   desc: "Opens as last frame"  },
                  ].map(({ action, label, desc }, idx) => (
                    <button
                      key={action}
                      onClick={() => { setAnimateOpen(false); onAction(action); }}
                      style={{
                        width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
                        padding: "9px 12px", border: "none", background: "transparent",
                        color: "#fff", cursor: "pointer", transition: "background 0.1s",
                        borderBottom: idx === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

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
  selectedConceptIndex = 0,
  isGeneratingOutputs = false,
  onOpenPreview,
  onRetryWithModel,
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
            {/* Live rendering pulse dot */}
            {isGeneratingOutputs && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(96,165,250,0.85)",
                  letterSpacing: "0.02em",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#3B82F6",
                    animation: "cdPulse 1.2s ease-in-out infinite",
                    display: "inline-block",
                  }}
                />
                Rendering
              </span>
            )}
          </h3>

          {/* Header actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* View full gallery */}
            <a
              href="/studio/image?source=creative-director"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 7,
                border: `1px solid ${Z.borderSubtle}`,
                background: "rgba(255,255,255,0.02)",
                color: "rgba(147,197,253,0.6)",
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "all 0.15s ease",
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(147,197,253,0.9)";
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(86,140,255,0.28)";
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(37,99,235,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(147,197,253,0.6)";
                (e.currentTarget as HTMLAnchorElement).style.borderColor = Z.borderSubtle;
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.02)";
              }}
            >
              Image Studio →
            </a>

            {/* Download all */}
            {generations.length > 0 && (
              <button
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 7,
                  border: `1px solid ${Z.borderSubtle}`,
                  background: "rgba(255,255,255,0.03)",
                  color: Z.textSecondary,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = Z.borderSubtle;
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLButtonElement).style.color = Z.textSecondary;
                }}
              >
                ↓ All
              </button>
            )}
          </div>
        </div>
        <p
          style={{
            fontSize: 13,
            color: Z.textMuted,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Outputs are saved to your project and{" "}
          <span style={{ color: "#93c5fd", fontWeight: 600 }}>Image Studio → History</span>.
        </p>
      </div>

      {/* spacer — the destination note is now inline in the header subtitle */}

      {/* ── Empty state — context-aware ── */}
      {isEmpty && (
        <>
          {/* State A: concept selected — strong CTA with gradient preview */}
          {hasConceptSelected && (
            <div style={{ marginBottom: 16 }}>
              {/* Mini concept gradient preview */}
              <div
                style={{
                  height: 100,
                  borderRadius: "12px 12px 0 0",
                  background: CONCEPT_GRADIENTS[selectedConceptIndex % 3],
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Ambient blobs */}
                <div
                  style={{
                    position: "absolute", width: 120, height: 120, borderRadius: "50%",
                    background: CONCEPT_ACCENTS[selectedConceptIndex % 3].a,
                    filter: "blur(40px)", top: -20, right: -20, pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute", width: 90, height: 90, borderRadius: "50%",
                    background: CONCEPT_ACCENTS[selectedConceptIndex % 3].b,
                    filter: "blur(32px)", bottom: -14, left: -10, pointerEvents: "none",
                  }}
                />
                {/* Center icon */}
                <div
                  style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 34, height: 34, borderRadius: 11,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(86,140,255,0.35)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, color: "rgba(147,197,253,0.8)",
                      boxShadow: "0 0 14px rgba(59,130,246,0.25)",
                    }}
                  >
                    ✦
                  </div>
                </div>
                {/* Concept name chip — top right */}
                {selectedConceptTitle && (
                  <div
                    style={{
                      position: "absolute", top: 8, right: 10,
                      fontSize: 10, fontWeight: 600, color: "rgba(147,197,253,0.8)",
                      background: "rgba(0,0,0,0.42)", border: "1px solid rgba(86,140,255,0.28)",
                      borderRadius: 6, padding: "3px 8px", backdropFilter: "blur(4px)",
                      maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {selectedConceptTitle}
                  </div>
                )}
              </div>

              {/* CTA panel */}
              <div
                style={{
                  padding: "14px 16px 16px",
                  background: "rgba(59,130,246,0.06)",
                  border: "1px solid rgba(86,140,255,0.22)",
                  borderTop: "none",
                  borderRadius: "0 0 12px 12px",
                  boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: Z.textPrimary,
                    marginBottom: 4,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Render this concept into visuals
                </div>
                <div style={{ fontSize: 12, color: Z.textMuted, lineHeight: 1.5 }}>
                  Set your options in the dock below↓ and click{" "}
                  <span style={{ color: Z.textSecondary, fontWeight: 600 }}>Generate</span>.
                  Your outputs will appear here.
                </div>
              </div>
            </div>
          )}

          {/* State B: concepts generated, none selected */}
          {hasConceptsGenerated && !hasConceptSelected && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 11,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(120,160,255,0.14)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                marginBottom: 14,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18, color: "rgba(120,160,255,0.45)", flexShrink: 0, marginTop: 1 }}>←</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: Z.textSecondary, marginBottom: 3 }}>
                  Select a concept to begin rendering
                </div>
                <div style={{ fontSize: 12, color: Z.textMuted, lineHeight: 1.5 }}>
                  Choose one of the directions from the center panel — then come back here to generate visuals.
                </div>
              </div>
            </div>
          )}

          {/* Calm empty hint — no slot grid */}
          {!hasConceptSelected && !hasConceptsGenerated && (
            <div
              style={{
                padding: "32px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                opacity: 0.5,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px dashed rgba(120,160,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  color: "rgba(120,160,255,0.4)",
                }}
              >
                ✦
              </div>
              <span style={{ fontSize: 12, color: "rgba(167,176,197,0.45)", fontWeight: 500, textAlign: "center" }}>
                Your renders will appear here
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Generation stream — grouped by concept ── */}
      {!isEmpty && (
        <>
          {/* All-processing hint — shown only when every output is still queued/processing */}
          {generations.every((g) => g.status === "processing" || g.status === "queued") && (
            <div
              style={{
                fontSize: 12,
                color: Z.textMuted,
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#60a5fa",
                  animation: "cdPulse 1.4s ease-in-out infinite",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              Rendering in progress — outputs will appear here as they complete.
            </div>
          )}

          {(() => {
            // Group generations by concept (preserve insertion order per group)
            const groups: Array<{ conceptId?: string; conceptTitle?: string; conceptIndex: number; items: GenerationResult[] }> = [];
            const seenConcepts = new Map<string, number>(); // conceptId → group index

            for (const gen of generations) {
              const key = gen.conceptId ?? "__ungrouped__";
              if (seenConcepts.has(key)) {
                groups[seenConcepts.get(key)!].items.push(gen);
              } else {
                const idx = groups.length;
                seenConcepts.set(key, idx);
                groups.push({
                  conceptId:    gen.conceptId,
                  conceptTitle: gen.conceptTitle,
                  conceptIndex: gen.conceptIndex ?? 0,
                  items:        [gen],
                });
              }
            }

            return groups.map((group, gi) => (
              <div key={group.conceptId ?? gi} style={{ marginBottom: gi < groups.length - 1 ? 20 : 0 }}>
                {/* Concept group label — always shown when a title exists */}
                {group.conceptTitle && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      paddingBottom: 8,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {/* Mini concept accent dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: [
                          "rgba(37,99,235,0.8)",
                          "rgba(109,40,217,0.8)",
                          "rgba(13,148,136,0.8)",
                        ][group.conceptIndex % 3],
                        boxShadow: [
                          "0 0 8px rgba(37,99,235,0.4)",
                          "0 0 8px rgba(109,40,217,0.4)",
                          "0 0 8px rgba(13,148,136,0.4)",
                        ][group.conceptIndex % 3],
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(167,176,197,0.65)",
                        letterSpacing: "0.01em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group.conceptTitle}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(100,120,155,0.5)",
                        flexShrink: 0,
                      }}
                    >
                      {group.items.length} output{group.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Grid for this group */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: group.items.length === 1 ? "1fr" : "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {group.items.map((gen) => (
                    <GenerationCard
                      key={gen.id}
                      gen={gen}
                      isVariationTrayOpen={activeVariationTray === gen.id}
                      onAction={(action) => {
                        // Re-open the preview modal when clicking fullscreen on a completed card
                        if (action === "fullscreen" && onOpenPreview) {
                          onOpenPreview(gen.id);
                          return;
                        }
                        onAction(action, gen.id);
                      }}
                      onVariation={(variationType) => onVariation(variationType, gen.id)}
                      onAdaptFormat={(format) => onAdaptFormat(format, gen.id)}
                      onRetryWithModel={onRetryWithModel ? (model) => onRetryWithModel(gen.id, model) : undefined}
                    />
                  ))}
                </div>
              </div>
            ));
          })()}
        </>
      )}
    </div>
  );
}
