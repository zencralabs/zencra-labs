"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PromptEnhancerPanel — AI Prompt Co-Pilot UX Layer
//
// Shared across Image Studio, Video Studio, and Creative Director.
// Shows original vs enhanced prompt in a split view.
// User is always in control — never auto-replaced.
//
// Props:
//   open            — panel visibility
//   originalPrompt  — what the user typed
//   enhancedPrompt  — null while loading, string once AI responds
//   isLoading       — controls shimmer skeleton
//   onEnhance       — called to (re)trigger AI enhancement
//   onApply(str)    — called when user accepts a prompt (enhanced or edited)
//   onClose         — called when user cancels
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

export interface PromptEnhancerPanelProps {
  open: boolean;
  originalPrompt: string;
  enhancedPrompt: string | null;
  isLoading: boolean;
  onEnhance: () => void;
  onApply: (prompt: string) => void;
  onClose: () => void;
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function ShimmerLine({ width = "100%", height = 12, mb = 8 }: { width?: string; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "pepShimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PromptEnhancerPanel({
  open,
  originalPrompt,
  enhancedPrompt,
  isLoading,
  onEnhance,
  onApply,
  onClose,
}: PromptEnhancerPanelProps) {
  const [editMode, setEditMode]         = useState(false);
  const [editValue, setEditValue]       = useState("");
  const editRef                         = useRef<HTMLTextAreaElement>(null);

  // Reset edit mode when panel closes or new result arrives
  useEffect(() => {
    if (!open) {
      setEditMode(false);
      setEditValue("");
    }
  }, [open]);

  useEffect(() => {
    if (enhancedPrompt !== null && !editMode) {
      setEditValue(enhancedPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancedPrompt]);

  useEffect(() => {
    if (editMode && editRef.current) {
      editRef.current.focus();
      // Auto-height
      editRef.current.style.height = "auto";
      editRef.current.style.height = editRef.current.scrollHeight + "px";
    }
  }, [editMode]);

  if (!open) return null;

  const currentValue = editMode ? editValue : (enhancedPrompt ?? "");
  const canApply     = !isLoading && currentValue.trim().length > 0;
  const canEdit      = !isLoading && enhancedPrompt !== null;

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 10,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(8,17,31,0.97)",
        padding: "16px",
        boxShadow: "0 0 30px rgba(59,130,246,0.12), 0 8px 32px rgba(0,0,0,0.5)",
        animation: "pepSlideIn 0.16s ease-out",
      }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F7FF", marginBottom: 2 }}>
              ✨ AI Prompt Enhancer
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              Refine your prompt for better visual results
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.35)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginLeft: 12,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Split view ────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}>
          {/* Original */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6,
            }}>
              Original
            </div>
            <div style={{
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 12px",
              fontSize: 13,
              color: "rgba(255,255,255,0.65)",
              lineHeight: "1.55",
              minHeight: 80,
              wordBreak: "break-word",
            }}>
              {originalPrompt || <span style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No prompt</span>}
            </div>
          </div>

          {/* Enhanced */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "rgba(59,130,246,0.8)",
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              Enhanced
              {!isLoading && enhancedPrompt !== null && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                  background: "rgba(59,130,246,0.15)", color: "rgba(99,179,237,0.9)",
                  letterSpacing: "0.04em",
                }}>AI</span>
              )}
            </div>

            {isLoading ? (
              /* Shimmer skeleton */
              <div style={{
                borderRadius: 12,
                background: "rgba(59,130,246,0.05)",
                border: "1px solid rgba(59,130,246,0.15)",
                padding: "10px 12px",
                minHeight: 80,
              }}>
                <ShimmerLine width="95%" height={11} mb={7} />
                <ShimmerLine width="88%" height={11} mb={7} />
                <ShimmerLine width="75%" height={11} mb={7} />
                <ShimmerLine width="60%" height={11} mb={0} />
                <div style={{
                  marginTop: 10, fontSize: 11, color: "rgba(99,179,237,0.5)",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    border: "1.5px solid rgba(99,179,237,0.3)",
                    borderTopColor: "rgba(99,179,237,0.8)",
                    animation: "pepSpin 0.7s linear infinite", flexShrink: 0,
                  }} />
                  Enhancing your prompt…
                </div>
              </div>
            ) : editMode ? (
              /* Edit textarea */
              <textarea
                ref={editRef}
                value={editValue}
                onChange={e => {
                  setEditValue(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                style={{
                  width: "100%", boxSizing: "border-box",
                  borderRadius: 12,
                  background: "rgba(59,130,246,0.07)",
                  border: "1px solid rgba(99,179,237,0.4)",
                  padding: "10px 12px",
                  fontSize: 13, color: "#F5F7FF", lineHeight: "1.55",
                  minHeight: 80, resize: "none",
                  outline: "none", fontFamily: "inherit",
                  boxShadow: "0 0 0 2px rgba(59,130,246,0.15)",
                  transition: "border-color 0.15s",
                }}
              />
            ) : (
              /* Display enhanced text */
              <div style={{
                borderRadius: 12,
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(99,179,237,0.25)",
                padding: "10px 12px",
                fontSize: 13, color: "#F5F7FF", lineHeight: "1.55",
                minHeight: 80, wordBreak: "break-word",
                boxShadow: enhancedPrompt ? "0 0 20px rgba(59,130,246,0.10)" : "none",
                animation: enhancedPrompt ? "pepEnhancedFadeIn 0.3s ease" : "none",
              }}>
                {enhancedPrompt ?? <span style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Waiting…</span>}
              </div>
            )}
          </div>
        </div>

        {/* ── Action row ────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8, flexWrap: "wrap",
        }}>
          {/* Left: secondary actions */}
          <div style={{ display: "flex", gap: 7 }}>
            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                padding: "7px 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
              }}
            >
              Cancel
            </button>

            {/* Regenerate */}
            {!isLoading && (
              <button
                onClick={() => {
                  setEditMode(false);
                  onEnhance();
                }}
                style={{
                  padding: "7px 14px", borderRadius: 9,
                  border: "1px solid rgba(99,179,237,0.22)",
                  background: "rgba(59,130,246,0.06)",
                  color: "rgba(147,197,253,0.75)",
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.14)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,179,237,0.4)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(147,197,253,0.95)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.06)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,179,237,0.22)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(147,197,253,0.75)";
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Regenerate
              </button>
            )}

            {/* Edit / Done */}
            {canEdit && (
              <button
                onClick={() => {
                  if (editMode) {
                    setEditMode(false);
                  } else {
                    setEditValue(enhancedPrompt ?? "");
                    setEditMode(true);
                  }
                }}
                style={{
                  padding: "7px 14px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: editMode ? "rgba(255,255,255,0.06)" : "transparent",
                  color: editMode ? "#F5F7FF" : "rgba(255,255,255,0.5)",
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
                  (e.currentTarget as HTMLElement).style.color = "#F5F7FF";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
                  (e.currentTarget as HTMLElement).style.color = editMode ? "#F5F7FF" : "rgba(255,255,255,0.5)";
                }}
              >
                {editMode ? "✓ Done" : "✎ Edit"}
              </button>
            )}
          </div>

          {/* Right: primary action */}
          <button
            onClick={() => onApply(editMode ? editValue.trim() : (enhancedPrompt ?? originalPrompt))}
            disabled={!canApply}
            style={{
              padding: "8px 18px", borderRadius: 10,
              background: canApply
                ? "linear-gradient(135deg, #3B82F6, #6366F1)"
                : "rgba(59,130,246,0.15)",
              border: "1px solid rgba(99,130,246,0.4)",
              color: canApply ? "#fff" : "rgba(255,255,255,0.35)",
              fontSize: 13, fontWeight: 700,
              cursor: canApply ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: canApply ? "0 0 18px rgba(59,130,246,0.28)" : "none",
              transition: "all 0.18s ease",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={e => {
              if (canApply) {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(59,130,246,0.45), 0 0 0 1px rgba(99,130,246,0.6)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={e => {
              if (canApply) {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 18px rgba(59,130,246,0.28)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }
            }}
          >
            Use Enhanced Prompt
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Keyframes ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pepSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pepShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pepSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes pepEnhancedFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pepApplyFlash {
          0%   { box-shadow: 0 0 0 2px rgba(59,130,246,0.8), 0 0 20px rgba(59,130,246,0.4); border-color: rgba(99,179,237,0.8); }
          100% { box-shadow: none; border-color: transparent; }
        }
      `}</style>
    </>
  );
}
