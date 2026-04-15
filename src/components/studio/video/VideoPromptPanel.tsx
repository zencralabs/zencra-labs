"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoPromptPanel
// Order: Prompt → Presets → Chips → Negative Prompt → Unified Credits+Generate Card
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { VideoModel } from "@/lib/ai/video-model-registry";
import type { FrameMode } from "./types";

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
              border: on ? "1px solid rgba(34,211,238,0.45)" : "1px solid rgba(255,255,255,0.08)",
              background: on ? "rgba(14,165,160,0.14)" : "rgba(255,255,255,0.03)",
              color: on ? "#22D3EE" : "#7A90A8",
              fontSize: 11, fontWeight: on ? 600 : 400,
              cursor: on ? "default" : "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.color = "#B0C0D4"; }}
            onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.color = "#7A90A8"; }}
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
  onClick,
}: {
  estimate: number; balance: number; modelName: string;
  disabled: boolean; loading: boolean; comingSoon: boolean;
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={low ? "#EF4444" : "#22D3EE"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: low ? "#EF4444" : "#22D3EE" }}>
            {comingSoon ? "—" : `~${estimate} credits`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#475569" }}>{modelName}</span>
      </div>

      {/* Balance row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
        <span style={{ fontSize: 13, color: "#B0C0D4" }}>Your balance</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: low ? "#EF4444" : "#D8E3EE" }}>
          {balance}
          <span style={{ fontSize: 11, fontWeight: 500, color: "#7A90A8", marginLeft: 4 }}>credits</span>
        </span>
      </div>

      {/* Insufficient banner */}
      {low && (
        <div style={{
          padding: "7px 14px",
          background: "rgba(239,68,68,0.1)", borderTop: "1px solid rgba(239,68,68,0.15)",
          fontSize: 11, color: "#EF4444", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Insufficient credits — top up to generate
        </div>
      )}

      {/* Generate button — inside the card */}
      <div style={{ padding: "10px 10px 10px" }}>
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
            fontSize: 15, fontWeight: 700,
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Generate Video
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes ppPulse { 0%,100%{box-shadow:0 0 12px rgba(14,165,160,0.2)} 50%{box-shadow:0 0 28px rgba(14,165,160,0.4)} }
        @keyframes ppSpin  { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Lip Sync Card ─────────────────────────────────────────────────────────────
// Shown in the right panel whenever frameMode === "lip_sync".
// Purple-accented, "Coming Soon" button (not disabled — still styled as CTA).

function LipSyncCard({ provider }: { provider: string | null }) {
  const hasProvider = !!provider;
  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(139,92,246,0.28)",
      background: "rgba(139,92,246,0.06)",
      overflow: "hidden",
    }}>
      {/* Header */}
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
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C4B5FD" }}>Lip Sync</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            color: "#A78BFA",
            background: "rgba(139,92,246,0.18)", borderRadius: 4, padding: "2px 6px",
          }}>
            BETA
          </span>
        </div>
        {hasProvider && (
          <span style={{ fontSize: 11, color: "#6D4FC9" }}>{provider}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "10px 14px" }}>
        <p style={{ fontSize: 12, color: "#7C6FAE", lineHeight: 1.6, margin: 0 }}>
          {hasProvider
            ? `Audio-driven facial animation via ${provider}.`
            : "Powered by a dedicated audio engine. Upload a portrait image and an audio clip — the engine will animate the lips to match."}
        </p>
      </div>

      {/* Provider info */}
      {!hasProvider && (
        <div style={{
          padding: "8px 14px",
          background: "rgba(139,92,246,0.06)",
          borderTop: "1px solid rgba(139,92,246,0.1)",
          fontSize: 11, color: "#6D4FC9",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
          </svg>
          Provider coming soon — HeyGen / ElevenLabs integration in progress
        </div>
      )}

      {/* CTA Button */}
      <div style={{ padding: "10px 10px 10px" }}>
        <button
          onClick={() => {}}
          style={{
            width: "100%", height: 50, borderRadius: 10,
            border: "1px solid rgba(139,92,246,0.45)",
            background: hasProvider
              ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)"
              : "rgba(139,92,246,0.1)",
            color: hasProvider ? "#fff" : "#A78BFA",
            fontSize: 15, fontWeight: 700,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            transition: "all 0.2s", letterSpacing: "-0.01em",
            boxShadow: hasProvider ? "0 0 20px rgba(139,92,246,0.35)" : "none",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.7)";
            (e.currentTarget as HTMLElement).style.background = hasProvider
              ? "linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)"
              : "rgba(139,92,246,0.18)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.45)";
            (e.currentTarget as HTMLElement).style.background = hasProvider
              ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)"
              : "rgba(139,92,246,0.1)";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {hasProvider ? "Generate Lip Sync" : "Coming Soon"}
        </button>
      </div>
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
  lipSyncProvider: string | null;
  onGenerate: () => void;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VideoPromptPanel({
  model, prompt, setPrompt, negPrompt, setNegPrompt,
  quality, duration, generating, userCredits,
  frameMode, lipSyncProvider,
  onGenerate,
}: Props) {
  const [showNeg, setShowNeg]         = useState(true); // open by default
  const [showPresets, setShowPresets] = useState(false);

  const chips = model?.promptChips ?? [
    "cinematic lighting", "slow motion", "aerial shot",
    "dramatic scene", "ultra realistic", "film grain", "smooth camera motion",
  ];

  const estimate            = model ? estimateCredits(model.id, quality, duration) : 0;
  const isComingSoon        = !model?.available;
  const insufficientCredits = userCredits < estimate && !isComingSoon;
  const noPrompt            = prompt.trim().length === 0;
  const isDisabled          = isComingSoon || insufficientCredits || noPrompt || generating;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12,
        paddingBottom: 4,
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent",
      }}>

        {/* Prompt header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#7A90A8", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Prompt
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowPresets(v => !v)}
              style={{
                background: "none", border: "none", fontSize: 11, cursor: "pointer", padding: 0,
                color: showPresets ? "#22D3EE" : "#475569", transition: "color 0.15s", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 4,
              }}
              onMouseEnter={e => { if (!showPresets) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              onMouseLeave={e => { if (!showPresets) (e.currentTarget as HTMLElement).style.color = "#475569"; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Presets
            </button>
            {prompt && (
              <button onClick={() => setPrompt("")}
                style={{ background: "none", border: "none", fontSize: 11, color: "#475569", cursor: "pointer", padding: 0, transition: "color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#475569"; }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

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
                  color: "#94A3B8", fontSize: 12, cursor: "pointer",
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
                <span style={{ color: "#22D3EE", lineHeight: 0, flexShrink: 0 }}>{p.icon}</span>
                <span style={{ fontWeight: 600, color: "#CBD5E1", flexShrink: 0 }}>{p.label}</span>
                <span style={{ color: "#475569", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  — {p.text.substring(0, 46)}…
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
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

        {/* Negative prompt */}
        {model?.capabilities.negativePrompt && (
          <div>
            <button
              onClick={() => setShowNeg(v => !v)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: showNeg ? "#22D3EE" : "#64748B",
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

        {/* Bottom action card — Lip Sync OR Credits+Generate */}
        {frameMode === "lip_sync" ? (
          <LipSyncCard provider={lipSyncProvider} />
        ) : model ? (
          <CreditsGenerateCard
            estimate={estimate}
            balance={userCredits}
            modelName={model.displayName}
            disabled={isDisabled}
            loading={generating}
            comingSoon={!!isComingSoon}
            onClick={onGenerate}
          />
        ) : null}
      </div>
    </div>
  );
}
