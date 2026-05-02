"use client";

/**
 * OutputPanel — Right zone of Creative Director v2.
 *
 * Layout: 2-column CSS grid for outputs.
 * Sorting: locked → completed first; explore → newest first.
 * isBest flag: first completed output in locked mode gets "✦ Best" badge.
 *
 * Outputs come from useDirectionStore — never fetched directly from DB here.
 */

import { useMemo }       from "react";
import { useDirectionStore, selectOutputs, selectMode, selectIsGenerating } from "@/lib/creative-director/store";
import { OutputCard }    from "./OutputCard";

// ─────────────────────────────────────────────────────────────────────────────

export function OutputPanel() {
  const outputs      = useDirectionStore(selectOutputs);
  const mode         = useDirectionStore(selectMode);
  const isGenerating = useDirectionStore(selectIsGenerating);
  const lastGenError = useDirectionStore((s) => s.lastGenError);

  const sorted = useMemo(() => {
    if (mode === "locked") {
      return [...outputs].sort((a, b) => {
        const order = { completed: 0, processing: 1, failed: 2 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
      });
    }
    return outputs; // already newest-first from store
  }, [outputs, mode]);

  // First completed output in locked mode gets the "Best" badge
  const bestId = useMemo(() => {
    if (mode !== "locked") return null;
    return sorted.find((o) => o.status === "completed")?.id ?? null;
  }, [sorted, mode]);

  const hasOutputs = outputs.length > 0;

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
        {/* Generating skeletons + real outputs in 2-col grid */}
        {(isGenerating || hasOutputs) && (
          <div style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 10,
          }}>
            {/* Skeleton cards while generating */}
            {isGenerating && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {/* Real output cards */}
            {sorted.map((output) => (
              <OutputCard
                key={output.id}
                output={output}
                isBest={output.id === bestId}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !hasOutputs && <EmptyState mode={mode} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
      {/* Icon ring */}
      <div style={{
        width:        56,
        height:       56,
        borderRadius: "50%",
        background:   "rgba(139,92,246,0.07)",
        border:       "1px solid rgba(139,92,246,0.18)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        fontSize:     22,
        color:        "rgba(139,92,246,0.45)",
        position:     "relative",
      }}>
        {/* Outer dashed ring */}
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
      aspectRatio:  "1 / 1",
      borderRadius: 12,
      background:   "rgba(255,255,255,0.03)",
      border:       "1px solid rgba(139,92,246,0.12)",
      animation:    "cd-shimmer 1.6s ease-in-out infinite",
      backgroundSize: "200% 100%",
      backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(139,92,246,0.06) 50%, rgba(255,255,255,0.02) 100%)",
    }} />
  );
}
