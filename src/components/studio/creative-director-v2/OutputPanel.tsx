"use client";

/**
 * OutputPanel — Right zone of Creative Director v2.
 *
 * Layout: 2-column CSS grid for outputs.
 * Sorting: locked → completed first; explore → newest first.
 * isBest flag: first completed output in locked mode gets "✦ Best" badge.
 *
 * Outputs come from useDirectionStore — never fetched directly from DB here.
 * Gallery link: "Open Image Gallery" → /studio/image (opens in same tab).
 *
 * Collapse:
 *   Expanded: 320px, full output grid.
 *   Collapsed: 78px, vertical strip of latest 3–4 completed thumbnails.
 *   Hover on thumbnail shows a 160px preview to the left of the strip.
 *   If no outputs: glowing ✦ CD icon centered.
 *   Parent (CDv2Shell) controls grid column width; collapse state signalled
 *   via onCollapsedChange callback.
 */

import { useMemo, useState } from "react";
import {
  useDirectionStore,
  selectOutputs,
  selectMode,
  selectIsGenerating,
} from "@/lib/creative-director/store";
import type { CDGenerationOutput } from "@/lib/creative-director/store";
import { OutputCard }        from "./OutputCard";

// ─────────────────────────────────────────────────────────────────────────────

interface OutputPanelProps {
  onCollapsedChange?:  (collapsed: boolean) => void;
  onReEditInDirector?: (url: string) => void;
  onRegenVariation?:   () => void;
}

export function OutputPanel({
  onCollapsedChange,
  onReEditInDirector,
  onRegenVariation,
}: OutputPanelProps) {
  const outputs      = useDirectionStore(selectOutputs);
  const mode         = useDirectionStore(selectMode);
  const isGenerating = useDirectionStore(selectIsGenerating);
  const lastGenError = useDirectionStore((s) => s.lastGenError);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  const sorted = useMemo(() => {
    if (mode === "locked") {
      return [...outputs].sort((a, b) => {
        const order = { completed: 0, processing: 1, failed: 2 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
      });
    }
    return outputs;
  }, [outputs, mode]);

  const bestId = useMemo(() => {
    if (mode !== "locked") return null;
    return sorted.find((o) => o.status === "completed")?.id ?? null;
  }, [sorted, mode]);

  const hasOutputs = outputs.length > 0;

  // ── Collapsed: 78px thumbnail strip ───────────────────────────────────────
  if (isCollapsed) {
    const completed = outputs
      .filter((o) => o.status === "completed" && o.url)
      .slice(0, 4);

    return (
      <div
        style={{
          height:        "100%",
          display:       "flex",
          flexDirection: "column",
          background:    "rgba(7,7,10,0.99)",
          overflow:      "visible", // allow thumbnail preview to escape into canvas column
          position:      "relative",
          zIndex:        10,
        }}
      >
        {/* Expand button */}
        <div
          style={{
            display:        "flex",
            justifyContent: "center",
            padding:        "10px 0 6px",
            flexShrink:     0,
          }}
        >
          <ChevronBtn direction="right" onToggle={handleToggleCollapse} tooltip="Expand outputs" />
        </div>

        {/* Thin divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 10px 8px", flexShrink: 0 }} />

        {/* Thumbnails or empty icon */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            6,
            padding:        "0 6px 12px",
            overflowY:      "hidden",
          }}
        >
          {completed.length > 0 ? (
            completed.map((o) => (
              <ThumbCard key={o.id} output={o} />
            ))
          ) : (
            <CollapsedEmptyIcon isGenerating={isGenerating} />
          )}
        </div>
      </div>
    );
  }

  // ── Expanded: full panel ───────────────────────────────────────────────────
  return (
    <div style={{
      height:        "100%",
      display:       "flex",
      flexDirection: "column",
      background:    "rgba(7,7,10,0.99)",
      overflow:      "hidden",
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding:        "14px 16px 12px",
        borderBottom:   "1px solid rgba(255,255,255,0.05)",
        flexShrink:     0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8, color: "rgba(139,92,246,0.5)" }}>✦</span>
          <span style={{
            fontSize:      10,
            color:         "rgba(255,255,255,0.35)",
            fontFamily:    "var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.09em",
          }}>
            Outputs
          </span>
          {hasOutputs && (
            <span style={{
              fontSize:     9,
              background:   "rgba(255,255,255,0.07)",
              borderRadius: 100,
              padding:      "2px 8px",
              color:        "rgba(255,255,255,0.4)",
              fontFamily:   "var(--font-sans)",
            }}>
              {outputs.length}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mode === "locked" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 8, color: "rgba(251,191,36,0.5)" }}>◆</span>
              <span style={{
                fontSize:      9,
                color:         "rgba(251,191,36,0.6)",
                fontFamily:    "var(--font-sans)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                Best first
              </span>
            </div>
          )}
          <GalleryLink />

          {/* Collapse button */}
          <ChevronBtn direction="left" onToggle={handleToggleCollapse} tooltip="Collapse outputs" />
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {lastGenError && (
        <div style={{
          padding:      "9px 16px",
          background:   "rgba(239,68,68,0.07)",
          borderBottom: "1px solid rgba(239,68,68,0.12)",
          fontSize:     11,
          color:        "rgba(239,68,68,0.8)",
          fontFamily:   "var(--font-sans)",
          flexShrink:   0,
          lineHeight:   1.4,
        }}>
          {lastGenError}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{
        flex:           1,
        overflowY:      "auto",
        padding:        14,
        scrollbarWidth: "none",
      }}>
        {(isGenerating || hasOutputs) && (
          <div style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 10,
          }}>
            {isGenerating && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}
            {sorted.map((output) => (
              <OutputCard
                key={output.id}
                output={output}
                isBest={output.id === bestId}
                onReEditInDirector={
                  output.url
                    ? () => onReEditInDirector?.(output.url!)
                    : undefined
                }
                onRegenVariation={onRegenVariation}
              />
            ))}
          </div>
        )}
        {!isGenerating && !hasOutputs && <EmptyState mode={mode} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsed strip sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ThumbCard({ output }: { output: CDGenerationOutput }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Thumbnail */}
      <div
        style={{
          width:        62,
          height:       62,
          borderRadius: 8,
          overflow:     "hidden",
          border:       `1px solid ${hov ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
          background:   "rgba(255,255,255,0.03)",
          transition:   "border-color 0.15s ease, transform 0.15s ease",
          transform:    hov ? "scale(1.04)" : "scale(1)",
          cursor:       "default",
          flexShrink:   0,
        }}
      >
        {output.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={output.url}
            alt="output"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </div>

      {/* Left-side hover preview */}
      {hov && output.url && (
        <div
          style={{
            position:     "absolute",
            right:        70,
            top:          "50%",
            transform:    "translateY(-50%)",
            width:        160,
            height:       160,
            borderRadius: 10,
            overflow:     "hidden",
            border:       "1px solid rgba(139,92,246,0.3)",
            boxShadow:    "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)",
            zIndex:       50,
            pointerEvents: "none",
            background:   "#03040a",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={output.url}
            alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}

function CollapsedEmptyIcon({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div
      style={{
        flex:           1,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            8,
        paddingBottom:  24,
      }}
    >
      <div
        style={{
          width:          40,
          height:         40,
          borderRadius:   "50%",
          background:     "rgba(139,92,246,0.07)",
          border:         "1px solid rgba(139,92,246,0.2)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       16,
          color:          "rgba(139,92,246,0.45)",
          animation:      isGenerating ? "cd-node-glow 2s ease-in-out infinite" : "none",
        }}
      >
        ✦
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Chevron collapse / expand button — direction controls which way it points */
function ChevronBtn({
  direction,
  onToggle,
  tooltip,
}: {
  direction: "left" | "right";
  onToggle:  () => void;
  tooltip:   string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      title={tooltip}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:          28,
        height:         28,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border:         `1px solid ${hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:   7,
        cursor:         "pointer",
        flexShrink:     0,
        transition:     "all 0.15s ease",
        padding:        0,
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ transform: direction === "right" ? "rotate(180deg)" : "none" }}
      >
        <path
          d="M6.5 2L3.5 5L6.5 8"
          stroke={hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)"}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded panel sub-components (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function GalleryLink() {
  const [hov, setHov] = useState(false);
  return (
    <a
      href="/studio/image"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            5,
        fontSize:       9,
        fontFamily:     "var(--font-sans)",
        letterSpacing:  "0.06em",
        textTransform:  "uppercase",
        color:          hov ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.25)",
        textDecoration: "none",
        background:     hov ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)",
        border:         `1px solid ${hov ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius:   7,
        padding:        "3px 8px",
        transition:     "all 0.15s ease",
        flexShrink:     0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <rect x="1" y="1" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
        <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
        <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      Gallery
      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
        <path d="M1 6L6 1M6 1H3M6 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </a>
  );
}

function EmptyState({ mode }: { mode: string }) {
  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:            16,
      padding:        32,
      textAlign:      "center",
      minHeight:      240,
    }}>
      <div style={{
        width:          56,
        height:         56,
        borderRadius:   "50%",
        background:     "rgba(139,92,246,0.07)",
        border:         "1px solid rgba(139,92,246,0.18)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontSize:       22,
        color:          "rgba(139,92,246,0.45)",
        position:       "relative",
      }}>
        <div style={{
          position:     "absolute",
          inset:        -8,
          borderRadius: "50%",
          border:       "1px dashed rgba(139,92,246,0.1)",
        }} />
        ✦
      </div>
      <div>
        <p style={{
          fontSize:   14,
          fontFamily: "var(--font-display)",
          color:      "rgba(255,255,255,0.45)",
          margin:     "0 0 6px",
        }}>
          {mode === "locked" ? "Scene committed" : "Build your scene"}
        </p>
        <p style={{
          fontSize:   11,
          fontFamily: "var(--font-sans)",
          color:      "rgba(255,255,255,0.2)",
          margin:     0,
          lineHeight: 1.6,
          maxWidth:   180,
        }}>
          {mode === "locked"
            ? "Hit Generate to produce campaign-grade outputs."
            : "Add subjects, moods, and elements — then generate."}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      aspectRatio:     "1 / 1",
      borderRadius:    12,
      background:      "rgba(255,255,255,0.03)",
      border:          "1px solid rgba(139,92,246,0.12)",
      animation:       "cd-shimmer 1.6s ease-in-out infinite",
      backgroundSize:  "200% 100%",
      backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(139,92,246,0.06) 50%, rgba(255,255,255,0.02) 100%)",
    }} />
  );
}
