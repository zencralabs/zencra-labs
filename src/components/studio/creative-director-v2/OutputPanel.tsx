"use client";

/**
 * OutputPanel — Right zone of Creative Director v2.
 *
 * Renders the direction output stream:
 *   - Locked mode  → best output first (completions sorted by status)
 *   - Explore mode → latest output first (chronological)
 *
 * Outputs come from generation API response stored in useDirectionStore.
 * Never fetched directly from DB in this component.
 *
 * States:
 *   empty      → empty state with guidance
 *   generating → skeleton cards while isGenerating
 *   loaded     → OutputCard grid
 */

import { useDirectionStore, selectOutputs, selectMode, selectIsGenerating } from "@/lib/creative-director/store";
import { OutputCard } from "./OutputCard";

// ─────────────────────────────────────────────────────────────────────────────

export function OutputPanel() {
  const outputs      = useDirectionStore(selectOutputs);
  const mode         = useDirectionStore(selectMode);
  const isGenerating = useDirectionStore(selectIsGenerating);
  const lastGenError = useDirectionStore((s) => s.lastGenError);

  // Sort: locked → completed first; explore → newest first (already newest-first from store)
  const sorted = mode === "locked"
    ? [...outputs].sort((a, b) => {
        const order = { completed: 0, processing: 1, failed: 2 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
      })
    : outputs;

  return (
    <div
      style={{
        height:         "100%",
        display:        "flex",
        flexDirection:  "column",
        background:     "rgba(8,8,8,0.98)",
        overflow:       "hidden",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:      "14px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink:   0,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize:      11,
            color:         "rgba(255,255,255,0.35)",
            fontFamily:    "var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Outputs
          {outputs.length > 0 && (
            <span
              style={{
                marginLeft:   6,
                fontSize:     10,
                background:   "rgba(255,255,255,0.07)",
                borderRadius: 100,
                padding:      "1px 7px",
                color:        "rgba(255,255,255,0.5)",
              }}
            >
              {outputs.length}
            </span>
          )}
        </span>

        {mode === "locked" && (
          <span
            style={{
              fontSize:   9,
              color:      "rgba(251,191,36,0.7)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Best first
          </span>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {lastGenError && (
        <div
          style={{
            padding:    "8px 14px",
            background: "rgba(239,68,68,0.08)",
            borderBottom: "1px solid rgba(239,68,68,0.15)",
            fontSize:   11,
            color:      "rgba(239,68,68,0.8)",
            fontFamily: "var(--font-sans)",
            flexShrink: 0,
          }}
        >
          {lastGenError}
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────── */}
      <div
        style={{
          flex:       1,
          overflowY:  "auto",
          padding:    12,
          display:    "flex",
          flexDirection: "column",
          gap:        10,
          scrollbarWidth: "none",
        }}
      >
        {/* Generating skeleton cards */}
        {isGenerating && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Outputs */}
        {sorted.map((output) => (
          <OutputCard key={output.id} output={output} />
        ))}

        {/* Empty state */}
        {!isGenerating && outputs.length === 0 && <EmptyState mode={mode} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ mode }: { mode: string }) {
  return (
    <div
      style={{
        flex:           1,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            12,
        padding:        24,
        textAlign:      "center",
      }}
    >
      <div
        style={{
          width:        48,
          height:       48,
          borderRadius: "50%",
          background:   "rgba(139,92,246,0.08)",
          border:       "1px solid rgba(139,92,246,0.15)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          fontSize:     20,
        }}
      >
        ✦
      </div>
      <div>
        <p
          style={{
            fontSize:   13,
            fontFamily: "var(--font-display)",
            color:      "rgba(255,255,255,0.5)",
            margin:     "0 0 6px",
          }}
        >
          {mode === "locked" ? "Scene committed" : "Build your scene"}
        </p>
        <p
          style={{
            fontSize:   11,
            fontFamily: "var(--font-sans)",
            color:      "rgba(255,255,255,0.2)",
            margin:     0,
            lineHeight: 1.5,
          }}
        >
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
    <div
      style={{
        aspectRatio:  "1 / 1",
        borderRadius: 8,
        background:   "rgba(255,255,255,0.03)",
        border:       "1px solid rgba(139,92,246,0.15)",
        animation:    "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
