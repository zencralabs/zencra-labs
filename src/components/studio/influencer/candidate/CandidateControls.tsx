"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CandidateControls — bottom confirmation row for candidate selection
//
// Shows:
//   - Active candidate indicator (URL truncated)
//   - "Confirm Identity" button (gradient CTA)
//   - Subtle "Re-generate" ghost option (future: triggers a re-run)
// ─────────────────────────────────────────────────────────────────────────────

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CandidateControlsProps {
  activeUrl:   string | null;
  accent:      string;
  isLocking:   boolean;
  candidateIndex: number | null;   // 1-based index of the active candidate
  onConfirm:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateControls({
  activeUrl, accent, isLocking, candidateIndex, onConfirm,
}: CandidateControlsProps) {
  const hasSelection = !!activeUrl;

  return (
    <div style={{
      width:        "100%",
      padding:      "16px 24px 20px",
      background:   "rgba(5,7,13,0.98)",
      borderTop:    "1px solid rgba(255,255,255,0.06)",
      display:      "flex",
      alignItems:   "center",
      gap:          16,
      flexShrink:   0,
    }}>

      {/* ── Left: candidate indicator ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {hasSelection ? (
          <>
            {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
            <div style={{
              fontSize:   13, fontWeight: 600, letterSpacing: "0.14em",
              color:      "rgba(255,255,255,0.35)",
              textTransform: "uppercase" as const,
              marginBottom: 2,
            }}>
              Selected
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Accent dot */}
              <div style={{
                width: 6, height: 6,
                background:   accent,
                flexShrink:   0,
                borderRadius: 99,
                boxShadow: `0 0 8px ${accent}88`,
              }} />
              {/* Chip: 13px / semibold 600 / -0.005em */}
              <span style={{
                fontSize:     13, fontWeight: 600, letterSpacing: "-0.005em",
                color:        "#ffffff",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap" as const,
              }}>
                Candidate {candidateIndex !== null ? String(candidateIndex).padStart(2, "0") : "—"}
              </span>
            </div>
          </>
        ) : (
          /* Micro: 11px / semibold 600 / tracking 0.12em */
          <div style={{
            fontSize:      11, fontWeight: 600, letterSpacing: "0.12em",
            color:         "rgba(255,255,255,0.28)",
            textTransform: "uppercase" as const,
          }}>
            No candidate selected
          </div>
        )}
      </div>

      {/* ── Right: actions ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

        {/* Confirm Identity — primary CTA */}
        <button
          onClick={() => { if (!isLocking && hasSelection) onConfirm(); }}
          disabled={!hasSelection || isLocking}
          style={{
            height:   44, padding: "0 28px",
            background: hasSelection
              ? "linear-gradient(135deg, #2563eb, #7c3aed)"
              : "rgba(255,255,255,0.06)",
            border:   hasSelection ? "none" : "1px solid rgba(255,255,255,0.10)",
            color:    hasSelection ? "#ffffff" : "rgba(255,255,255,0.28)",
            /* Button: 15px / semibold 600 / -0.01em */
            fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
            cursor:   hasSelection && !isLocking ? "pointer" : "not-allowed",
            opacity:  isLocking ? 0.55 : 1,
            boxShadow: hasSelection ? "0 4px 20px rgba(99,102,241,0.32)" : "none",
            transition: "all 0.22s ease",
          }}
          onMouseEnter={e => {
            if (hasSelection && !isLocking)
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(99,102,241,0.52)";
          }}
          onMouseLeave={e => {
            if (hasSelection)
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(99,102,241,0.32)";
          }}
        >
          {isLocking
            ? "Locking Identity…"
            : hasSelection
              ? "Confirm Identity"
              : "Select a Candidate"}
        </button>
      </div>
    </div>
  );
}
