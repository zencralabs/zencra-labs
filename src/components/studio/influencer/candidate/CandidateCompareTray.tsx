"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CandidateCompareTray — compare tray rendered as a flex column item
//
// Appears when compareUrls.length >= 2, slides up with CSS.
// Shows up to 3 thumbnails with remove buttons + empty slot placeholders.
// "Compare & Select" CTA: selects the first URL in compareUrls.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_COMPARE = 3;

// ── Video URL detection ───────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CandidateCompareTrayProps {
  compareUrls:  string[];
  accent:       string;
  isLocking:    boolean;
  onRemove:     (url: string) => void;
  onSelectOne:  (url: string) => void;  // "Compare & Select" picks the first
  onClearAll:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateCompareTray({
  compareUrls, accent, isLocking, onRemove, onSelectOne, onClearAll,
}: CandidateCompareTrayProps) {
  // Only render when 2+ candidates are in the compare list
  if (compareUrls.length < 2) return null;

  return (
    <>
      <style>{`
        @keyframes compareTrayIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0px); }
        }
      `}</style>

      <div style={{
        width:       "100%",
        background:  "rgba(5,7,13,0.95)",
        borderTop:   `1px solid ${accent}28`,
        padding:     "14px 24px 16px",
        display:     "flex",
        alignItems:  "center",
        gap:         16,
        animation:   "compareTrayIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards",
        flexShrink:  0,
      }}>

        {/* ── Label ──────────────────────────────────────────────────────── */}
        {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
        <div style={{
          fontSize:   13, fontWeight: 600, letterSpacing: "0.14em",
          color:      "rgba(255,255,255,0.42)",
          textTransform: "uppercase" as const,
          flexShrink: 0,
          minWidth:   72,
        }}>
          Compare
        </div>

        {/* ── Thumbnail slots ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          {Array.from({ length: MAX_COMPARE }).map((_, i) => {
            const url = compareUrls[i];

            if (!url) {
              // Empty slot placeholder
              return (
                <div key={`slot-${i}`} style={{
                  width:        56, height: 72,
                  border:       "1px dashed rgba(255,255,255,0.12)",
                  background:   "rgba(255,255,255,0.02)",
                  flexShrink:   0,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                }}>
                  {/* Plus icon — muted */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.18)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              );
            }

            // Filled slot
            return (
              <div key={url} style={{
                width:    56, height: 72,
                position: "relative",
                flexShrink: 0,
                overflow: "hidden",
                border:   `1px solid ${accent}55`,
              }}>
                {/* Thumbnail media */}
                {isVideoUrl(url) ? (
                  <video
                    src={url}
                    muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Compare candidate ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}

                {/* Remove button — overlays top-right */}
                <button
                  onClick={() => onRemove(url)}
                  disabled={isLocking}
                  aria-label={`Remove candidate ${i + 1} from compare`}
                  style={{
                    position:   "absolute", top: 0, right: 0,
                    width:      18, height: 18,
                    background: "rgba(0,0,0,0.80)",
                    border:     "none",
                    color:      "rgba(255,255,255,0.75)",
                    cursor:     isLocking ? "not-allowed" : "pointer",
                    display:    "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding:    0,
                    zIndex:     2,
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isLocking) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.85)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.80)";
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Candidate index badge */}
                <div style={{
                  position:   "absolute", bottom: 0, left: 0, right: 0,
                  /* Micro: 11px / semibold 600 / tracking 0.12em */
                  fontSize:   9, fontWeight: 600, letterSpacing: "0.08em",
                  color:      "rgba(255,255,255,0.80)",
                  background: "rgba(0,0,0,0.60)",
                  textAlign:  "center",
                  padding:    "2px 0",
                  textTransform: "uppercase" as const,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: count + CTAs ─────────────────────────────────────────── */}
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        10,
          flexShrink: 0,
        }}>
          {/* Count chip */}
          <div style={{
            padding:  "3px 10px",
            background: `${accent}18`,
            border:   `1px solid ${accent}38`,
            /* Chip: 13px / semibold 600 / -0.005em */
            fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
            color:    `${accent}dd`,
          }}>
            {compareUrls.length}/{MAX_COMPARE}
          </div>

          {/* Clear all — ghost */}
          <button
            onClick={onClearAll}
            disabled={isLocking}
            style={{
              height:   32, padding: "0 12px",
              background: "transparent",
              border:   "1px solid rgba(255,255,255,0.10)",
              color:    "rgba(255,255,255,0.42)",
              /* Chip: 13px / medium 500 / -0.005em */
              fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
              cursor:   isLocking ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              if (!isLocking) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.70)";
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.42)";
            }}
          >
            Clear
          </button>

          {/* Compare & Select — primary */}
          <button
            onClick={() => { if (!isLocking && compareUrls[0]) onSelectOne(compareUrls[0]); }}
            disabled={isLocking || compareUrls.length < 2}
            style={{
              height:   36, padding: "0 18px",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              border:   "none",
              color:    "#ffffff",
              /* Button: 15px / semibold 600 / -0.01em */
              fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
              cursor:   isLocking ? "not-allowed" : "pointer",
              opacity:  isLocking ? 0.55 : 1,
              boxShadow: "0 3px 16px rgba(99,102,241,0.32)",
              transition: "box-shadow 0.15s ease, opacity 0.2s ease",
              whiteSpace: "nowrap" as const,
            }}
            onMouseEnter={e => {
              if (!isLocking) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 5px 24px rgba(99,102,241,0.50)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 3px 16px rgba(99,102,241,0.32)";
            }}
          >
            {isLocking ? "Locking…" : "Compare & Select"}
          </button>
        </div>
      </div>
    </>
  );
}
