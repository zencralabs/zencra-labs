"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoPromptPanel
// Order: Prompt → Presets → Chips → Negative Prompt → Unified Credits+Generate Card
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { Zap } from "lucide-react";
import type { VideoModel } from "@/lib/ai/video-model-registry";
import type { FrameMode, ImageSlot } from "./types";
import type { LipSyncState } from "@/hooks/useLipSync";
import type { LipSyncQuality } from "@/lib/lipsync/status";
import { useAuth } from "@/components/auth/AuthContext";
import PromptEnhancerPanel from "@/components/studio/prompt/PromptEnhancerPanel";

// ── Credit estimation ─────────────────────────────────────────────────────────

const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30": { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26": { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25": { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(id: string, q: string, d: number) {
  return CREDIT_RATES[id]?.[q]?.[d] ?? Math.round(d * 5);
}

// ── Prompt presets ────────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "Music Video",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    ),
    text: "Cinematic music video, dynamic camera movements, neon-lit stage, artist performing, slow motion effects, atmospheric lighting, high energy, film grain",
  },
  {
    label: "Cinematic Scene",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 2l-4 5-4-5"/>
      </svg>
    ),
    text: "Epic cinematic scene, dramatic lighting, sweeping aerial camera, ultra realistic, anamorphic lens flares, shallow depth of field, movie quality, 8K",
  },
  {
    label: "Product Shot",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
    text: "Premium product reveal, rotating slow-motion showcase, studio lighting, clean white background, sharp focus, glossy reflections, professional commercial",
  },
  {
    label: "Character Animation",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
      </svg>
    ),
    text: "Animated character performance, expressive facial expressions, fluid body movement, detailed costume, soft volumetric lighting, character animation quality",
  },
];

// ── Chip strip ────────────────────────────────────────────────────────────────

function ChipStrip({ chips, prompt, setPrompt }: { chips: string[]; prompt: string; setPrompt: (v: string) => void }) {
  function append(chip: string) {
    if (prompt.toLowerCase().includes(chip.toLowerCase())) return;
    setPrompt(prompt.trim() ? `${prompt.trim()}, ${chip}` : chip);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {chips.map(chip => {
        const on = prompt.toLowerCase().includes(chip.toLowerCase());
        return (
          <button
            key={chip}
            onClick={() => append(chip)}
            style={{
              padding: "4px 10px", borderRadius: 20,
              border: on ? "1px solid rgba(14,165,160,0.6)" : "1px solid rgba(255,255,255,0.08)",
              background: on ? "rgba(14,165,160,0.14)" : "rgba(255,255,255,0.03)",
              color: on ? "#0EA5A0" : "#94A3B8",
              fontSize: 13, fontWeight: on ? 600 : 400,
              cursor: on ? "default" : "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.color = "#CBD5F5"; }}
            onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

// ── Unified Credits + Generate Card ──────────────────────────────────────────

function CreditsGenerateCard({
  estimate, balance, modelName,
  disabled, loading, comingSoon,
  hideGenerateButton = false,
  onClick,
}: {
  estimate: number; balance: number; modelName: string;
  disabled: boolean; loading: boolean; comingSoon: boolean;
  hideGenerateButton?: boolean;
  onClick: () => void;
}) {
  const low   = balance < estimate && !comingSoon;
  const ready = !disabled && !loading;

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${low ? "rgba(239,68,68,0.25)" : "rgba(14,165,160,0.18)"}`,
      background: low ? "rgba(239,68,68,0.05)" : "rgba(14,165,160,0.06)",
      overflow: "hidden",
    }}>
      {/* Cost estimate + model name */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px",
        borderBottom: `1px solid ${low ? "rgba(239,68,68,0.12)" : "rgba(14,165,160,0.1)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={low ? "#EF4444" : "#0EA5A0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style={{ /* Chip: 13px / semibold 600 / tracking -0.005em — color is semantic */ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: low ? "#EF4444" : "#0EA5A0" }}>
            {comingSoon ? "—" : `~${estimate} credits`}
          </span>
        </div>
        <span style={{ /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B" }}>{modelName}</span>
      </div>

      {/* Balance row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
        <span style={{ fontSize: 13, color: "#94A3B8" }}>Your balance</span>
        <span style={{ /* Button: 15px / semibold 600 (fontWeight 800 violation fixed) — color is semantic */ fontSize: 15, fontWeight: 600, color: low ? "#EF4444" : "#F8FAFC" }}>
          {balance}
          <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#94A3B8", marginLeft: 4 }}>credits</span>
        </span>
      </div>

      {/* Insufficient banner */}
      {low && (
        <div style={{
          padding: "7px 14px",
          background: "rgba(239,68,68,0.1)", borderTop: "1px solid rgba(239,68,68,0.15)",
          /* Micro: 11px / semibold 600 / tracking 0.12em — color #EF4444 is semantic red */
          fontSize: 11, color: "#EF4444", fontWeight: 600, letterSpacing: "0.12em",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Insufficient credits — top up to generate
        </div>
      )}

      {/* Generate button — suppressed when CanvasGenerateBar owns the CTA */}
      {!hideGenerateButton && <div style={{ padding: "10px 10px 10px" }}>
        <button
          onClick={ready ? onClick : undefined}
          style={{
            width: "100%", height: 50, borderRadius: 10,
            border: ready ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
            background: loading
              ? "rgba(14,165,160,0.2)"
              : disabled
              ? "rgba(255,255,255,0.04)"
              : "linear-gradient(135deg, #0EA5A0 0%, #22D3EE 100%)",
            color: loading ? "#94A3B8" : disabled ? "#334155" : "#020617",
            /* Button: 15px / semibold 600 / tracking -0.01em (already present) */
            fontSize: 15, fontWeight: 600,
            cursor: disabled || loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            transition: "all 0.2s", letterSpacing: "-0.01em",
            boxShadow: ready ? "0 0 20px rgba(14,165,160,0.4), 0 4px 16px rgba(0,0,0,0.4)" : "none",
            animation: loading ? "ppPulse 1.5s ease-in-out infinite" : "none",
          }}
          onMouseEnter={e => {
            if (ready) {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 32px rgba(14,165,160,0.6), 0 6px 24px rgba(0,0,0,0.5)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={e => {
            if (ready) {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(14,165,160,0.4), 0 4px 16px rgba(0,0,0,0.4)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#94A3B8",
                animation: "ppSpin 0.7s linear infinite",
              }} />
              Generating…
            </>
          ) : comingSoon ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Coming Soon
            </>
          ) : (
            <>
              <Zap size={14} />
              Generate Video
            </>
          )}
        </button>
      </div>}

      <style>{`
        @keyframes ppPulse   { 0%,100%{box-shadow:0 0 12px rgba(14,165,160,0.2)} 50%{box-shadow:0 0 28px rgba(14,165,160,0.4)} }
        @keyframes ppSpin    { to { transform: rotate(360deg); } }
        @keyframes vpEnhSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Lip Sync Status Row ───────────────────────────────────────────────────────

function LipSyncStatusRow({ label, status }: {
  label: string;
  status: "idle" | "uploading" | "ready" | "error";
}) {
  const isReady    = status === "ready";
  const isError    = status === "error";
  const isUploading = status === "uploading";

  const iconColor = isReady ? "#22C55E" : isError ? "#EF4444" : isUploading ? "#A78BFA" : "#334155";
  const textColor = isReady ? "#CBD5E1" : "#64748B";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `1.5px solid ${iconColor}`,
        background: isReady ? "rgba(34,197,94,0.1)" : isError ? "rgba(239,68,68,0.1)" : isUploading ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isReady ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : isError ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : isUploading ? (
          <div style={{ width: 6, height: 6, borderRadius: "50%", border: "1.5px solid #A78BFA", borderTopColor: "transparent", animation: "lsSpinRow 0.7s linear infinite" }} />
        ) : null}
      </div>
      <span style={{ color: textColor }}>
        {label}
        {status === "uploading" && <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em */ color: "#6B7280", marginLeft: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em" }}>uploading…</span>}
      </span>
    </div>
  );
}

// ── Lip Sync Card ─────────────────────────────────────────────────────────────
// Dynamically driven by LipSyncState — shows the full state machine.

function LipSyncCard({
  state,
  onQualityMode,
  onGenerate,
  onRetry,
  onReset,
  userCredits,
}: {
  state: LipSyncState;
  onQualityMode: (m: LipSyncQuality) => void;
  onGenerate: () => void;
  onRetry: () => void;
  onReset: () => void;
  userCredits: number;
}) {
  const {
    providerReady, standardReady, proReady,
    face, audio,
    qualityMode, estimatedCredits,
    generationStatus, generationProgress,
    outputUrl, errorMessage,
    canGenerate, isGenerating,
  } = state;

  const isCompleted = generationStatus === "completed";
  const isFailed    = generationStatus === "failed";
  const lowCredits  = providerReady && userCredits < estimatedCredits && !isGenerating && !isCompleted;
  const showQualitySelector = standardReady && proReady;

  // CTA label + enabled state
  let ctaLabel = "Coming Soon";
  let ctaEnabled = false;
  if (providerReady) {
    if (isGenerating) {
      ctaLabel  = "Generating…";
      ctaEnabled = false;
    } else if (isCompleted) {
      ctaLabel  = "Done";
      ctaEnabled = false;
    } else if (isFailed) {
      ctaLabel  = "Retry";
      ctaEnabled = true;
    } else if (face.status !== "ready") {
      ctaLabel  = "Upload portrait image";
      ctaEnabled = false;
    } else if (audio.status !== "ready") {
      ctaLabel  = "Upload audio clip";
      ctaEnabled = false;
    } else if (lowCredits) {
      ctaLabel  = "Insufficient credits";
      ctaEnabled = false;
    } else {
      ctaLabel  = "Generate Lip Sync";
      ctaEnabled = canGenerate;
    }
  }

  const handleCta = () => {
    if (!ctaEnabled) return;
    if (isFailed) { onRetry(); return; }
    onGenerate();
  };

  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(139,92,246,0.28)",
      background: "rgba(139,92,246,0.06)",
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid rgba(139,92,246,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
          <span style={{ /* Chip: 13px / semibold 600 / tracking -0.005em — color #C4B5FD is semantic purple */ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "#C4B5FD" }}>Lip Sync</span>
          <span style={{
            /* Micro: 11px (was 9px — below system minimum) / semibold 600 / tracking 0.12em */
            fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
            color: "#A78BFA", background: "rgba(139,92,246,0.18)",
            borderRadius: 4, padding: "2px 6px",
          }}>BETA</span>
        </div>
        {/* Credit estimate (only when provider ready + not terminal) */}
        {providerReady && !isCompleted && !isFailed && (
          <span style={{ /* Chip: 13px / medium 500 / tracking -0.005em — color is semantic */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: lowCredits ? "#EF4444" : "#A78BFA" }}>
            ~{estimatedCredits} credits
          </span>
        )}
        {/* Reset button after completion */}
        {isCompleted && (
          <button
            onClick={onReset}
            style={{ background: "none", border: "none", cursor: "pointer", /* Micro: 11px / semibold 600 / tracking 0.12em */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#6B7280", padding: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#A78BFA"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
          >
            New Lip Sync
          </button>
        )}
      </div>

      {/* ── Provider not ready → Coming Soon ── */}
      {!providerReady && (
        <>
          <div style={{ padding: "10px 14px" }}>
            <p style={{ /* Chip: 13px / medium 500 / tracking -0.005em — color #7C6FAE is semantic purple */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#7C6FAE", lineHeight: 1.6, margin: 0 }}>
              Upload a portrait image and an audio clip — the engine will animate the lips to match the audio.
            </p>
          </div>
          <div style={{ padding: "0 14px 10px" }}>
            <div style={{
              borderRadius: 8, border: "1px solid rgba(139,92,246,0.15)",
              background: "rgba(139,92,246,0.06)", padding: "7px 10px",
              /* Micro: 11px / semibold 600 / tracking 0.12em — color #6D4FC9 is semantic purple */
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#6D4FC9",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
              </svg>
              Integration in progress — provider coming soon
            </div>
          </div>
        </>
      )}

      {/* ── Provider ready → Full UI ── */}
      {providerReady && (
        <>
          {/* Quality selector — only when both tiers available */}
          {showQualitySelector && !isCompleted && !isGenerating && (
            <div style={{ padding: "10px 14px 0", display: "flex", gap: 5 }}>
              {(["standard", "pro"] as LipSyncQuality[]).map(m => {
                const active = qualityMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => onQualityMode(m)}
                    style={{
                      flex: 1, padding: "5px 0", borderRadius: 8, /* Chip: 13px / active 600 inactive 500 / tracking -0.005em */ fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: "-0.005em",
                      border: active ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)",
                      color: active ? "#C4B5FD" : "#64748B",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#A78BFA"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
                  >
                    {m === "standard" ? "Standard" : "Pro"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Status checklist — show when not completed */}
          {!isCompleted && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              <LipSyncStatusRow label="Character image" status={face.status} />
              <LipSyncStatusRow label="Audio clip"     status={audio.status} />
            </div>
          )}

          {/* Balance row */}
          {!isCompleted && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "4px 14px 8px",
            }}>
              <span style={{ /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#94A3B8" }}>Your balance</span>
              <span style={{ /* Chip: 13px / semibold 600 / tracking -0.005em — color is semantic */ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: lowCredits ? "#EF4444" : "#F8FAFC" }}>
                {userCredits}
                <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#94A3B8", marginLeft: 3 }}>credits</span>
              </span>
            </div>
          )}

          {/* Low credits warning */}
          {lowCredits && (
            <div style={{
              margin: "0 14px 8px",
              padding: "7px 10px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, /* Micro: 11px / semibold 600 / tracking 0.12em — color #EF4444 semantic */
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#EF4444",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Insufficient credits — top up to continue
            </div>
          )}

          {/* Error message */}
          {isFailed && errorMessage && (
            <div style={{
              margin: "0 14px 8px",
              padding: "7px 10px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, /* Micro: 11px / semibold 600 / tracking 0.12em — color #EF4444 semantic */
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#EF4444",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {errorMessage}
            </div>
          )}

          {/* Progress bar — when generating and progress known */}
          {isGenerating && generationProgress != null && (
            <div style={{ margin: "0 14px 8px", height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.round(generationProgress)}%`,
                background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
                borderRadius: 2, transition: "width 0.3s ease",
              }} />
            </div>
          )}

          {/* Completion output — download / play */}
          {isCompleted && outputUrl && (
            <div style={{ padding: "10px 14px" }}>
              <video
                src={outputUrl}
                controls
                style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(139,92,246,0.2)" }}
              />
              <a
                href={outputUrl}
                download="lip-sync.mp4"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginTop: 8, padding: "7px 14px", borderRadius: 8, /* Chip: 13px / semibold 600 / tracking -0.005em */ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
                  border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.1)",
                  color: "#C4B5FD", textDecoration: "none", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.1)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
            </div>
          )}

          {/* Completion — no URL */}
          {isCompleted && !outputUrl && (
            <div style={{ padding: "10px 14px", textAlign: "center", /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B" }}>
              Generation complete — no output URL available yet
            </div>
          )}
        </>
      )}

      {/* ── CTA Button ── */}
      <div style={{ padding: "10px 10px 10px" }}>
        <button
          onClick={handleCta}
          disabled={!ctaEnabled}
          style={{
            width: "100%", height: 50, borderRadius: 10,
            border: ctaEnabled
              ? "1px solid rgba(139,92,246,0.5)"
              : "1px solid rgba(139,92,246,0.15)",
            background: ctaEnabled
              ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)"
              : isCompleted
              ? "rgba(34,197,94,0.12)"
              : "rgba(139,92,246,0.06)",
            color: ctaEnabled ? "#fff" : isCompleted ? "#22C55E" : "#6B4FA8",
            /* Button: 15px / semibold 600 / tracking -0.01em (already present) */
            fontSize: 15, fontWeight: 600,
            cursor: ctaEnabled ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            transition: "all 0.2s", letterSpacing: "-0.01em",
            boxShadow: ctaEnabled ? "0 0 20px rgba(139,92,246,0.3), 0 4px 16px rgba(0,0,0,0.4)" : "none",
            animation: isGenerating ? "lsPulse 1.5s ease-in-out infinite" : "none",
          }}
          onMouseEnter={e => {
            if (ctaEnabled) {
              (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={e => {
            if (ctaEnabled) {
              (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }
          }}
        >
          {isGenerating ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#C4B5FD", animation: "lsSpinBtn 0.7s linear infinite" }} />
              Generating…
            </>
          ) : isCompleted ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Done
            </>
          ) : isFailed ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/>
              </svg>
              Retry
            </>
          ) : !providerReady ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Coming Soon
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              {ctaLabel}
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes lsPulse   { 0%,100%{box-shadow:0 0 12px rgba(139,92,246,0.2)} 50%{box-shadow:0 0 28px rgba(139,92,246,0.5)} }
        @keyframes lsSpinBtn { to { transform: rotate(360deg); } }
        @keyframes lsSpinRow { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  model: VideoModel | null;
  prompt: string;
  setPrompt: (v: string) => void;
  negPrompt: string;
  setNegPrompt: (v: string) => void;
  quality: string;
  duration: number;
  generating: boolean;
  userCredits: number;
  frameMode: FrameMode;
  // Lip Sync
  lipSyncState:         LipSyncState;
  onLipSyncQualityMode: (m: LipSyncQuality) => void;
  onLipSyncGenerate:    () => void;
  onLipSyncRetry:       () => void;
  onLipSyncReset:       () => void;
  // Kling / standard video generate
  onGenerate: () => void;
  // AI Influencer — passed from VideoStudioShell (single source of truth)
  detectedHandles:  string[];
  handleReadiness:  Record<string, boolean>;        // {} = loading/unknown, false = not ready
  handleAvatarUrls: Record<string, string | null>;  // hero asset URL per handle, or null
  useStartFrame:    boolean;
  setUseStartFrame: (v: boolean) => void;
  // End Frame — controller props (upload lives in VideoCanvas; this card is display + clear)
  endSlot:         ImageSlot;
  onClearEndSlot:  () => void;
  // Audio mode
  audioMode:    "none" | "scene" | "voiceover";
  setAudioMode: (m: "none" | "scene" | "voiceover") => void;
  // Zencra Voice Engine — voiceover script state (lifted to Shell so it survives re-renders)
  voiceoverScript:    string;
  setVoiceoverScript: (v: string) => void;
  // Layout — suppress Generate button when CanvasGenerateBar owns the CTA
  hideGenerateButton?: boolean;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoPromptPanel({
  model, prompt, setPrompt, negPrompt, setNegPrompt,
  quality, duration, generating, userCredits,
  frameMode,
  lipSyncState, onLipSyncQualityMode, onLipSyncGenerate, onLipSyncRetry, onLipSyncReset,
  onGenerate,
  detectedHandles, handleReadiness, handleAvatarUrls, useStartFrame, setUseStartFrame,
  endSlot, onClearEndSlot,
  audioMode, setAudioMode,
  voiceoverScript, setVoiceoverScript,
  hideGenerateButton = false,
}: Props) {
  const [showNeg, setShowNeg]         = useState(true); // open by default
  const [showPresets, setShowPresets] = useState(false);

  // ── Prompt enhancement ────────────────────────────────────────────────────
  const { user } = useAuth();
  const [enhancing, setEnhancing]               = useState(false);
  const [preEnhancePrompt, setPreEnhancePrompt] = useState<string | null>(null);
  const [enhanceError, setEnhanceError]         = useState<string | null>(null);
  // Panel state — never auto-replaces prompt
  const [enhancerOpen, setEnhancerOpen]     = useState(false);
  const [enhancedResult, setEnhancedResult] = useState<string | null>(null);

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    if (!user) return; // auth guard — VideoStudioShell handles login prompt elsewhere

    // Open panel immediately — loading state shows right away
    setEnhancerOpen(true);
    setEnhancedResult(null);
    setPreEnhancePrompt(prompt);
    setEnhanceError(null);
    setEnhancing(true);

    try {
      const res = await fetch("/api/studio/prompt/enhance", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          prompt,
          studioType: "video",
          modelHint:  model?.id ?? "",
        }),
      });

      const json = await res.json() as { enhancedPrompt?: string; error?: string };

      if (res.ok && json.enhancedPrompt) {
        setEnhancedResult(json.enhancedPrompt);
        setEnhanceError(null);
      } else {
        console.warn("[video-prompt-enhance] failed:", json.error);
        setEnhancedResult(null);
        setEnhanceError("Enhancement failed — please try again");
      }
    } catch (err) {
      console.warn("[video-prompt-enhance] network error:", err);
      setEnhancedResult(null);
      setEnhanceError("Network error — please check your connection");
    } finally {
      setEnhancing(false);
    }
  }, [prompt, enhancing, user, model]);

  const handleApplyEnhanced = useCallback((enhanced: string) => {
    setPrompt(enhanced);
    setEnhancerOpen(false);
    setEnhancedResult(null);
    setPreEnhancePrompt(null);
  }, [setPrompt]);

  const chips = model?.promptChips ?? [
    "cinematic lighting", "slow motion", "aerial shot",
    "dramatic scene", "ultra realistic", "film grain", "smooth camera motion",
  ];

  const estimate            = model ? estimateCredits(model.id, quality, duration) : 0;
  const isComingSoon        = !model?.available;
  const insufficientCredits = userCredits < estimate && !isComingSoon;
  const noPrompt            = prompt.trim().length === 0;

  // Start frame identity block — user has opted in but canonical is confirmed not ready.
  // We block Generate here (don't silently downgrade to prompt-only).
  const primaryHandle          = detectedHandles[0] ?? null;
  const startFrameReadinessKnown = primaryHandle !== null && primaryHandle in handleReadiness;
  const notReadyAndWantsStartFrame =
    startFrameReadinessKnown &&
    handleReadiness[primaryHandle!] === false &&
    useStartFrame;

  const isDisabled = isComingSoon || insufficientCredits || noPrompt || generating || notReadyAndWantsStartFrame;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12,
        paddingBottom: 4,
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent",
      }}>

        {/* Prompt header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ /* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase — color #94A3B8 neutral */ fontSize: 13, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Prompt
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* ✦ Enhance button — always rendered, fades in when prompt has content */}
            <div style={{
              opacity: prompt.trim() ? 1 : 0.35,
              pointerEvents: prompt.trim() ? "auto" : "none",
              transition: "opacity 0.15s ease-out",
            }}>
              <button
                onClick={() => void handleEnhance()}
                disabled={enhancing || !prompt.trim()}
                title={enhancing ? "Enhancing…" : "Enhance prompt with AI"}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 8, /* Chip: 13px / semibold 600 */ fontSize: 13, fontWeight: 600,
                  border: "1px solid rgba(139,92,246,0.35)",
                  background: enhancing ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.12)",
                  color: enhancing ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.9)",
                  cursor: enhancing ? "not-allowed" : "pointer",
                  transition: "all 0.15s", letterSpacing: "-0.005em",
                }}
                onMouseEnter={e => {
                  if (!enhancing) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.22)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.6)";
                    (e.currentTarget as HTMLElement).style.color = "#C4B5FD";
                  }
                }}
                onMouseLeave={e => {
                  if (!enhancing) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.35)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(167,139,250,0.9)";
                  }
                }}
              >
                {enhancing ? (
                  <>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      border: "1.5px solid rgba(167,139,250,0.25)",
                      borderTopColor: "rgba(167,139,250,0.7)",
                      animation: "vpEnhSpin 0.7s linear infinite", flexShrink: 0,
                    }} />
                    Enhancing…
                  </>
                ) : <>✦ Enhance</>}
              </button>
            </div>
            <button
              onClick={() => setShowPresets(v => !v)}
              style={{
                background: "none", border: "none", /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, letterSpacing: "-0.005em", cursor: "pointer", padding: 0,
                color: showPresets ? "#0EA5A0" : "#64748B", transition: "color 0.15s", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 4,
              }}
              onMouseEnter={e => { if (!showPresets) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              onMouseLeave={e => { if (!showPresets) (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Presets
            </button>
            {prompt && (
              <button onClick={() => { setPrompt(""); setPreEnhancePrompt(null); setEnhanceError(null); }}
                style={{ background: "none", border: "none", /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B", cursor: "pointer", padding: 0, transition: "color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Prompt Enhancer Panel ─────────────────────────────────────────── */}
        <PromptEnhancerPanel
          open={enhancerOpen}
          originalPrompt={preEnhancePrompt ?? prompt}
          enhancedPrompt={enhancedResult}
          isLoading={enhancing}
          onEnhance={handleEnhance}
          onApply={handleApplyEnhanced}
          onClose={() => {
            setEnhancerOpen(false);
            setEnhancedResult(null);
            setPreEnhancePrompt(null);
          }}
        />

        {/* ── AI Influencer identity badges ─────────────────────────────────── */}
        {detectedHandles.length > 0 && (
          <>
            <style>{`
              @keyframes lockIn {
                from { transform: scale(0.96); opacity: 0.55; }
                to   { transform: scale(1);    opacity: 1;    }
              }
            `}</style>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6,
              padding: "0 14px 10px",
            }}>
              {detectedHandles.map(handle => {
                const avatarUrl = handleAvatarUrls[handle] ?? null;
                return (
                  <div
                    key={handle}
                    title={`@${handle} · Identity Locked`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: avatarUrl ? "3px 10px 3px 4px" : "4px 10px",
                      borderRadius: 20,
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.28)",
                      boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.10)",
                      /* Micro: 11px / semibold 600 / tracking 0.12em */
                      fontSize: 11, letterSpacing: "0.12em",
                    }}
                  >
                    {/* Avatar — who (face) */}
                    {avatarUrl && (
                      <img
                        src={avatarUrl}
                        alt={`@${handle}`}
                        style={{
                          width: 20, height: 20,
                          borderRadius: 0,        // sharp corners — design system rule
                          objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.14)",
                          flexShrink: 0,
                          display: "block",
                        }}
                      />
                    )}
                    {/* Lock — state (trust signal). Smaller + dimmer when avatar present. */}
                    <span style={{
                      /* Micro: 11px minimum — was 8/9px below system minimum */
                      fontSize: 11,
                      color: avatarUrl ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.48)",
                      lineHeight: 1,
                      display: "inline-block",
                      animation: "lockIn 140ms ease-out forwards",
                      flexShrink: 0,
                    }}>🔒</span>
                    <span style={{
                      /* Chip active: semibold 600 */
                      fontWeight: 600, color: "#fff",
                      maxWidth: 160, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>@{handle}</span>
                    <span style={{
                      /* Micro: 11px (was 10px — below system minimum) / medium 500 / tracking 0.12em */
                      fontWeight: 500, color: "rgba(255,255,255,0.48)",
                      fontSize: 11, letterSpacing: "0.12em", flexShrink: 0,
                    }}>· Identity Locked</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Identity Start Frame Card ──────────────────────────────────────── */}
        {/* Always renders when a handle is detected.
            isStartFrameReady: true = canonical known good, false = known not ready, undefined = loading (optimistic).
            When not ready: show disabled state, lock toggle, prevent wasted roundtrip. */}
        {detectedHandles.length > 0 && (() => {
          const primaryHandle   = detectedHandles[0];
          // undefined = readiness data not yet fetched (show optimistic/active state)
          // true      = canonical exists
          // false     = canonical missing — show disabled state
          const readinessKnown  = primaryHandle in handleReadiness;
          const isStartFrameReady = readinessKnown ? handleReadiness[primaryHandle] : true;

          const cardDisabled    = !isStartFrameReady;
          const activeAndOn     = !cardDisabled && useStartFrame;
          const cardAvatarUrl   = handleAvatarUrls[primaryHandle] ?? null;

          return (
            <div style={{
              borderRadius: 12,
              border: cardDisabled
                ? "1px solid rgba(255,255,255,0.06)"
                : activeAndOn
                  ? "1px solid rgba(245,158,11,0.32)"
                  : "1px solid rgba(255,255,255,0.07)",
              background: cardDisabled
                ? "rgba(255,255,255,0.01)"
                : activeAndOn
                  ? "rgba(245,158,11,0.06)"
                  : "rgba(255,255,255,0.02)",
              padding: "10px 14px",
              opacity: cardDisabled ? 0.5 : 1,
              transition: "border-color 0.2s ease, background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease",
              boxShadow: activeAndOn ? "0 0 18px rgba(245,158,11,0.07)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Icon / Avatar — avatar takes the icon slot when URL is known */}
                {cardAvatarUrl && !cardDisabled ? (
                  <div style={{
                    width: 30, height: 30, flexShrink: 0,
                    borderRadius: 0,          // sharp corners — design system rule
                    border: activeAndOn
                      ? "1px solid rgba(245,158,11,0.38)"
                      : "1px solid rgba(255,255,255,0.14)",
                    overflow: "hidden",
                    transition: "border-color 0.2s ease",
                  }}>
                    <img
                      src={cardAvatarUrl}
                      alt={`@${primaryHandle}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: cardDisabled
                      ? "rgba(255,255,255,0.03)"
                      : activeAndOn ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                    border: cardDisabled
                      ? "1px solid rgba(255,255,255,0.06)"
                      : activeAndOn ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke={cardDisabled ? "#334155" : activeAndOn ? "#F59E0B" : "#475569"} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18"/>
                      <circle cx="9" cy="15" r="2"/>
                    </svg>
                  </div>
                )}

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    /* Chip: 13px / semibold 600 / tracking -0.005em — color is semantic */
                    fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
                    color: cardDisabled ? "#334155" : activeAndOn ? "#FCD34D" : "#64748B",
                    transition: "color 0.2s ease",
                  }}>
                    {cardDisabled ? "Start frame not ready" : "Start Frame Identity"}
                  </div>
                  <div style={{ /* Micro: 11px / semibold 600 / tracking 0.12em — color is semantic */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: cardDisabled ? "#1E293B" : "#475569", marginTop: 2 }}>
                    {cardDisabled
                      ? `@${primaryHandle} needs identity selection first`
                      : `Pin @${primaryHandle} hero as video start frame`}
                  </div>
                </div>

                {/* Toggle pill — non-interactive when disabled */}
                <button
                  onClick={cardDisabled ? undefined : () => setUseStartFrame(!useStartFrame)}
                  aria-label={cardDisabled
                    ? "Identity not ready"
                    : useStartFrame ? "Disable start frame identity" : "Enable start frame identity"}
                  style={{
                    width: 38, height: 22, borderRadius: 11, flexShrink: 0,
                    border: "none", padding: 2,
                    cursor: cardDisabled ? "not-allowed" : "pointer",
                    background: cardDisabled
                      ? "rgba(255,255,255,0.06)"
                      : activeAndOn ? "#F59E0B" : "rgba(255,255,255,0.09)",
                    display: "flex", alignItems: "center",
                    justifyContent: activeAndOn ? "flex-end" : "flex-start",
                    transition: "background 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: activeAndOn ? "0 0 10px rgba(245,158,11,0.45)" : "none",
                    pointerEvents: cardDisabled ? "none" : "auto",
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: cardDisabled ? "#1E293B" : "#fff",
                    boxShadow: cardDisabled ? "none" : "0 1px 4px rgba(0,0,0,0.35)",
                  }} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── End Frame Card ────────────────────────────────────────────────────
            Controller only — upload lives in VideoCanvas (end slot area).
            Always renders when model supports endFrame + frameMode is start_frame.
            Dependency rule: when @handle exists, Start Frame must be ON.
            When that rule is violated, the card dims and explains why.          */}
        {frameMode === "start_frame" && model?.capabilities.endFrame && (() => {
          const hasEndFrame       = !!endSlot.url;
          // Dependency: identity requires Start Frame ON when a handle is present
          const depBlocked        = detectedHandles.length > 0 && !useStartFrame;
          // Visual state flags
          const cardActive        = hasEndFrame && !depBlocked;

          return (
            <div style={{
              borderRadius: 12,
              border: depBlocked
                ? "1px solid rgba(255,255,255,0.05)"
                : hasEndFrame
                  ? "1px solid rgba(255,255,255,0.14)"
                  : "1px solid rgba(255,255,255,0.07)",
              background: depBlocked
                ? "rgba(255,255,255,0.01)"
                : hasEndFrame
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(255,255,255,0.02)",
              padding: "10px 14px",
              opacity: depBlocked ? 0.45 : 1,
              transition: "border-color 0.2s ease, background 0.2s ease, opacity 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                {/* Left — thumbnail when set, SVG icon when empty */}
                {hasEndFrame && endSlot.preview ? (
                  <div style={{
                    width: 30, height: 30, flexShrink: 0,
                    borderRadius: 0,         // sharp corners — design system rule
                    border: "1px solid rgba(255,255,255,0.14)",
                    overflow: "hidden",
                  }}>
                    <img
                      src={endSlot.preview}
                      alt="End frame"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {/* Film end / last-frame icon */}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 15h18"/>
                      <circle cx="15" cy="9" r="2"/>
                    </svg>
                  </div>
                )}

                {/* Middle — label + subtext */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    /* Chip: 13px / semibold 600 / tracking -0.005em — color is semantic */
                    fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
                    color: depBlocked ? "#334155" : cardActive ? "#CBD5F5" : "#64748B",
                    transition: "color 0.2s ease",
                  }}>
                    End Frame
                  </div>
                  <div style={{
                    /* Micro: 11px / semibold 600 / tracking 0.12em — color is semantic */
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", marginTop: 2,
                    color: depBlocked ? "#1E293B" : hasEndFrame ? "#475569" : "#334155",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {depBlocked
                      ? "Enable Start Frame first for @handle continuity"
                      : hasEndFrame
                        ? "Image set — will close the shot"
                        : "Set end frame image in canvas above"}
                  </div>
                </div>

                {/* Right — Clear button when end frame is set */}
                {hasEndFrame && !depBlocked && (
                  <button
                    onClick={onClearEndSlot}
                    title="Remove end frame"
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#64748B", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", transition: "all 0.15s",
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.10)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.25)";
                      (e.currentTarget as HTMLElement).style.color = "#EF4444";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                      (e.currentTarget as HTMLElement).style.color = "#64748B";
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Presets dropdown */}
        {showPresets && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setPrompt(p.text); setShowPresets(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8, width: "100%", textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#94A3B8", /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.3)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "#CBD5E1";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                }}
              >
                <span style={{ color: "#0EA5A0", lineHeight: 0, flexShrink: 0 }}>{p.icon}</span>
                <span style={{ fontWeight: 600, color: "#CBD5E1", flexShrink: 0 }}>{p.label}</span>
                <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em */ color: "#475569", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  — {p.text.substring(0, 46)}…
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={prompt}
          onChange={e => {
            setPrompt(e.target.value);
            // Manual edit dismisses undo + error state (same as Image Studio)
            if (preEnhancePrompt !== null) setPreEnhancePrompt(null);
            if (enhanceError !== null)     setEnhanceError(null);
          }}
          placeholder="Describe your video — setting, mood, movement, lighting…"
          rows={5}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.11)",
            borderRadius: 12, padding: "12px 14px",
            fontSize: 14, color: "#ECF2F8",
            resize: "vertical", outline: "none", lineHeight: 1.65,
            fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,160,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.07)"; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.boxShadow = "none"; }}
        />

        {/* Chips */}
        <ChipStrip chips={chips} prompt={prompt} setPrompt={setPrompt} />

        {/* Undo enhanced prompt — stays visible until user edits, clears, or enhances again */}
        {preEnhancePrompt !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em — color semantic purple */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(167,139,250,0.55)" }}>
              ✦ Prompt enhanced by AI
            </span>
            <button
              onClick={() => { setPrompt(preEnhancePrompt); setPreEnhancePrompt(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 6, /* Micro: 11px / semibold 600 / tracking 0.12em */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)",
                cursor: "pointer", transition: "all 0.12s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
              }}
            >
              ← Undo
            </button>
          </div>
        )}

        {/* Enhance error — shown when AI call fails; dismissed on next attempt or manual edit */}
        {enhanceError !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em — color #F87171 semantic red */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(248,113,113,0.8)" }}>
              ⚠ {enhanceError}
            </span>
            <button
              onClick={() => setEnhanceError(null)}
              style={{
                padding: "2px 7px", borderRadius: 5, /* Micro: 11px (was 10px — below system minimum) / semibold 600 / tracking 0.12em */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                border: "1px solid rgba(248,113,113,0.2)",
                background: "transparent", color: "rgba(248,113,113,0.5)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Negative prompt */}
        {model?.capabilities.negativePrompt && (
          <div>
            <button
              onClick={() => setShowNeg(v => !v)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", gap: 5,
                /* Chip: 13px / medium 500 / tracking -0.005em — colors semantic */
                fontSize: 13, letterSpacing: "-0.005em", color: showNeg ? "#0EA5A0" : "#64748B",
                fontWeight: 500, transition: "color 0.15s",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showNeg ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Negative Prompt
            </button>
            {showNeg && (
              <textarea
                value={negPrompt}
                onChange={e => setNegPrompt(e.target.value)}
                placeholder="What to avoid: blur, watermark, distorted hands…"
                rows={2}
                style={{
                  marginTop: 8, width: "100%",
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 10, padding: "9px 12px",
                  fontSize: 13, color: "#94A3B8",
                  resize: "vertical", outline: "none", lineHeight: 1.5,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; }}
                onBlur={e =>  { e.currentTarget.style.borderColor = "rgba(239,68,68,0.15)"; }}
              />
            )}
          </div>
        )}

        {/* ── Audio Mode Selector ───────────────────────────────────────────────
            Shown for all standard video modes (not lip_sync).
            "Use Scene Audio" only renders when the selected model supports nativeAudio.
            "Add Voiceover" is always shown — voice generation is model-independent. */}
        {frameMode !== "lip_sync" && model && (
          <div>
            {/* Section header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              <span style={{
                /* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase — color #94A3B8 neutral */
                fontSize: 13, fontWeight: 600, color: "#94A3B8",
                letterSpacing: "0.14em", textTransform: "uppercase",
              }}>
                Audio
              </span>
            </div>

            {/* Mode pills */}
            <div style={{ display: "flex", gap: 6 }}>
              {/* No Audio — always shown */}
              {(["none", ...(model.capabilities.nativeAudio ? ["scene"] : []), "voiceover"] as ("none" | "scene" | "voiceover")[]).map(mode => {
                const active = audioMode === mode;
                const label  = mode === "none" ? "No Audio" : mode === "scene" ? "Scene Audio" : "Add Voiceover";
                const accent = mode === "scene" ? "#0EA5A0" : mode === "voiceover" ? "#C6FF00" : "#475569";
                return (
                  <button
                    key={mode}
                    onClick={() => setAudioMode(mode)}
                    style={{
                      flex: 1, padding: "7px 4px", borderRadius: 8, /* Chip: 13px / active 600 inactive 500 / tracking -0.005em */ fontSize: 13, letterSpacing: "-0.005em",
                      fontWeight: active ? 600 : 500,
                      border: active
                        ? `1px solid ${accent}55`
                        : "1px solid rgba(255,255,255,0.08)",
                      background: active
                        ? `${accent}18`
                        : "rgba(255,255,255,0.03)",
                      color: active ? accent : "#475569",
                      cursor: "pointer", transition: "all 0.15s",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#475569"; }}
                  >
                    <span style={{ whiteSpace: "nowrap" }}>{label}</span>
                    {mode === "voiceover" && (
                      <span style={{
                        /* Micro: 11px (was 9px — below system minimum) / semibold 600 / tracking 0.12em — color semantic amber */
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                        color: active ? "#D97706" : "#92500A",
                        background: active ? "rgba(217,119,6,0.18)" : "rgba(217,119,6,0.10)",
                        borderRadius: 3, padding: "1px 5px",
                      }}>+ Voice</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Prompt-aware speech suggestion — shown when keywords imply dialogue/narration */}
            {(() => {
              const speechWords = ["speaks", "talking", "dialogue", "narrator", "says"];
              const hasSpeech   = speechWords.some(w => prompt.toLowerCase().includes(w));
              return hasSpeech && audioMode !== "voiceover" ? (
                <div style={{
                  marginTop: 8, padding: "8px 11px", borderRadius: 8,
                  border: "1px solid rgba(245,158,11,0.18)",
                  background: "rgba(245,158,11,0.05)",
                  fontSize: 11, color: "#92714A", lineHeight: 1.55,
                  display: "flex", gap: 6, alignItems: "flex-start",
                }}>
                  <svg style={{ flexShrink: 0, marginTop: 1 }} width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(245,158,11,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <circle cx="12" cy="16" r="0.5" fill="rgba(245,158,11,0.6)"/>
                  </svg>
                  <span>
                    <span style={{ color: "rgba(245,158,11,0.75)", fontWeight: 600 }}>Speech detected.</span>
                    {" For clean speech, use Voiceover + Lip Sync. Scene Audio is better for ambience."}
                  </span>
                </div>
              ) : null;
            })()}

            {/* Mode helper text — shows below pills for whichever mode is active */}
            {audioMode === "scene" && model.capabilities.nativeAudio && (
              <div style={{
                marginTop: 8, padding: "8px 11px", borderRadius: 8,
                border: "1px solid rgba(14,165,160,0.18)",
                background: "rgba(14,165,160,0.06)",
                /* Chip: 13px / medium 500 / tracking -0.005em */
                fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B", lineHeight: 1.55,
              }}>
                Cinematic sound generated with the video — ambience, movement, and atmosphere.
              </div>
            )}
            {audioMode === "voiceover" && (
              <div style={{
                marginTop: 8, padding: "8px 11px", borderRadius: 8,
                border: "1px solid rgba(198,255,0,0.16)",
                background: "rgba(198,255,0,0.04)",
                lineHeight: 1.55,
              }}>
                <span style={{ /* Chip: 13px / medium 500 / tracking -0.005em */ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#64748B", display: "block" }}>
                  Controlled speech and narration. Best for dialogue, character voice, and explainers.
                </span>
                <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em — color #5E6A30 semantic olive */ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#5E6A30", display: "block", marginTop: 4 }}>
                  Voiceover adds +3–5 credits depending on length and quality.
                </span>
              </div>
            )}

            {/* Voiceover panel — shown when "Add Voiceover" is selected */}
            {audioMode === "voiceover" && (
              <div style={{
                marginTop: 8, padding: "10px 12px", borderRadius: 10,
                border: "1px solid rgba(198,255,0,0.22)",
                background: "rgba(198,255,0,0.04)",
              }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="#C6FF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#C6FF00" }}>Zencra Voice Engine</span>
                </div>

                {/* Voice script textarea — wired to Shell state */}
                <textarea
                  value={voiceoverScript}
                  onChange={e => setVoiceoverScript(e.target.value)}
                  placeholder="Write the voiceover script — narration, character dialogue, or scene description…"
                  rows={3}
                  style={{
                    width: "100%",
                    background: "rgba(198,255,0,0.03)",
                    border: "1px solid rgba(198,255,0,0.18)",
                    borderRadius: 8, padding: "9px 11px",
                    fontSize: 13, color: "#CBD5E1",
                    resize: "vertical", outline: "none", lineHeight: 1.55,
                    fontFamily: "inherit", boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(198,255,0,0.45)"; e.currentTarget.style.background = "rgba(198,255,0,0.06)"; }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = "rgba(198,255,0,0.18)";  e.currentTarget.style.background = "rgba(198,255,0,0.03)"; }}
                />

                {/* Voice selector — placeholder */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", borderRadius: 7,
                  border: "1px solid rgba(198,255,0,0.15)",
                  background: "rgba(255,255,255,0.02)",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4l3 3"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "#4B5563", flex: 1 }}>
                    Voice selection · Zencra Voice Engine coming soon
                  </span>
                  <span style={{ fontSize: 10, color: "#374151", fontWeight: 600, letterSpacing: "0.04em" }}>
                    +3–5 CR
                  </span>
                </div>
              </div>
            )}

            {/* ── Lip Sync teaser — ladder cap ─────────────────────────────────
                Always visible in the audio section. No interaction, no backend.
                Communicates the ceiling: Scene Audio → Voiceover → Lip Sync.  */}
            <div style={{
              marginTop: 8, padding: "10px 12px", borderRadius: 10,
              border: "1px solid rgba(198,255,0,0.08)",
              background: "rgba(198,255,0,0.02)",
              opacity: 0.65,
              userSelect: "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 5,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Lock icon */}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="#5E6A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span style={{ /* Chip: 13px / semibold 600 / tracking -0.005em — color #5E6A30 semantic olive */
                    fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "#5E6A30" }}>Lip Sync</span>
                </div>
                <span style={{
                  /* Micro: 11px (was 9px — below system minimum) / semibold 600 / tracking 0.12em — color semantic olive */
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                  color: "#5E6A30", background: "rgba(198,255,0,0.10)",
                  borderRadius: 4, padding: "2px 6px",
                }}>COMING NEXT</span>
              </div>
              <p style={{
                margin: 0, /* Micro: 11px / semibold 600 / tracking 0.12em — color #4A5520 semantic olive */
                fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#4A5520", lineHeight: 1.55,
              }}>
                Make characters speak with synced voice and performance timing.
              </p>
            </div>
          </div>
        )}

        {/* Start frame identity block banner — shown when toggle ON + canonical not ready.
            Intent is preserved (toggle stays ON), generation is blocked with a clear reason.
            Tone: restrained, not glowing — blocked ≠ active. */}
        {notReadyAndWantsStartFrame && primaryHandle && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "9px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(245,158,11,0.13)",
          }}>
            <svg style={{ flexShrink: 0, marginTop: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="rgba(245,158,11,0.45)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <circle cx="12" cy="16" r="0.5" fill="rgba(245,158,11,0.45)"/>
            </svg>
            <span style={{ /* Micro: 11px / semibold 600 / tracking 0.12em — color semantic amber-gold */
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(203,177,100,0.65)", lineHeight: 1.55 }}>
              Start frame identity is not ready for @{primaryHandle}. Please finish identity selection first.
            </span>
          </div>
        )}

        {/* Bottom action card — Lip Sync OR Credits+Generate */}
        {frameMode === "lip_sync" ? (
          <LipSyncCard
            state={lipSyncState}
            onQualityMode={onLipSyncQualityMode}
            onGenerate={onLipSyncGenerate}
            onRetry={onLipSyncRetry}
            onReset={onLipSyncReset}
            userCredits={userCredits}
          />
        ) : model ? (
          <>
            <CreditsGenerateCard
              estimate={estimate}
              balance={userCredits}
              modelName={model.displayName}
              disabled={isDisabled}
              loading={generating}
              comingSoon={!!isComingSoon}
              hideGenerateButton={hideGenerateButton}
              onClick={onGenerate}
            />
            {/* Audio credit breakdown — shown when voiceover or scene audio is active */}
            {audioMode !== "none" && !isComingSoon && (
              <div style={{
                marginTop: -6, padding: "8px 14px",
                borderRadius: "0 0 12px 12px",
                border: "1px solid rgba(167,139,250,0.15)",
                borderTop: "none",
                background: "rgba(139,92,246,0.04)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ /* Chip: 13px / medium 500 / tracking -0.005em */
                  fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#6B7280", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                  {audioMode === "voiceover" ? "Voiceover" : "Scene Audio"}
                </span>
                <span style={{ /* Chip: 13px / semibold 600 / tracking -0.005em — color #A78BFA semantic purple */
                  fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "#A78BFA" }}>
                  {audioMode === "voiceover" ? "+3–5 credits" : "+0 credits"}
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
