"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoPromptPanel — Right-side prompt input, chips, credits, generate button
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { VideoModel } from "@/lib/ai/video-model-registry";

// Credit costs per model / quality / duration
const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30":  { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26":  { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25":  { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};

function estimateCredits(modelId: string, quality: string, duration: number): number {
  return CREDIT_RATES[modelId]?.[quality]?.[duration] ?? Math.round(duration * 5);
}

// ── Chip strip ────────────────────────────────────────────────────────────────

interface ChipStripProps {
  chips: string[];
  prompt: string;
  setPrompt: (v: string) => void;
}

function ChipStrip({ chips, prompt, setPrompt }: ChipStripProps) {
  function appendChip(chip: string) {
    const base = prompt.trim();
    if (base.toLowerCase().includes(chip.toLowerCase())) return;
    setPrompt(base ? `${base}, ${chip}` : chip);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map(chip => {
        const active = prompt.toLowerCase().includes(chip.toLowerCase());
        return (
          <button
            key={chip}
            onClick={() => appendChip(chip)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: active
                ? "1px solid rgba(14,165,160,0.55)"
                : "1px solid rgba(255,255,255,0.07)",
              background: active
                ? "rgba(14,165,160,0.14)"
                : "rgba(255,255,255,0.03)",
              color: active ? "#0EA5A0" : "#64748B",
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              cursor: active ? "default" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,160,0.3)";
                (e.currentTarget as HTMLElement).style.color = "#94A3B8";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.color = "#64748B";
              }
            }}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

// ── Credit estimate card ──────────────────────────────────────────────────────

interface CreditCardProps {
  estimate: number;
  balance: number;
  modelName: string;
}

function CreditCard({ estimate, balance, modelName }: CreditCardProps) {
  const insufficient = balance < estimate;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: insufficient
          ? "rgba(239,68,68,0.06)"
          : "rgba(14,165,160,0.05)",
        border: `1px solid ${insufficient ? "rgba(239,68,68,0.2)" : "rgba(14,165,160,0.15)"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={insufficient ? "#EF4444" : "#0EA5A0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ fontSize: 12, color: insufficient ? "#EF4444" : "#0EA5A0", fontWeight: 600 }}>
            ~{estimate} credits
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>for {modelName}</span>
        </div>
        <div style={{ fontSize: 12, color: insufficient ? "#EF4444" : "#64748B" }}>
          Balance: <span style={{ fontWeight: 600, color: insufficient ? "#EF4444" : "#94A3B8" }}>{balance}</span>
        </div>
      </div>
      {insufficient && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Insufficient credits — top up to generate
        </div>
      )}
    </div>
  );
}

// ── Generate button ───────────────────────────────────────────────────────────

interface GenButtonProps {
  disabled: boolean;
  loading: boolean;
  comingSoon: boolean;
  insufficientCredits: boolean;
  noPrompt: boolean;
  onClick: () => void;
}

function GenerateButton({ disabled, loading, comingSoon, insufficientCredits, noPrompt, onClick }: GenButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = comingSoon
    ? "This model is coming soon"
    : insufficientCredits
    ? "Insufficient credits — top up to generate"
    : noPrompt
    ? "Enter a prompt to generate"
    : null;

  const bgColor = loading
    ? "rgba(14,165,160,0.5)"
    : disabled
    ? "rgba(14,165,160,0.15)"
    : "rgba(14,165,160,1)";

  const textColor = disabled && !loading ? "#334155" : "#0A0F1A";

  return (
    <div style={{ position: "relative" }}>
      {showTooltip && tooltipText && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1E293B",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "#94A3B8",
            whiteSpace: "nowrap",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {tooltipText}
          <div
            style={{
              position: "absolute",
              top: "100%", left: "50%",
              transform: "translateX(-50%)",
              border: "5px solid transparent",
              borderTopColor: "#1E293B",
            }}
          />
        </div>
      )}

      <button
        onClick={disabled || loading ? undefined : onClick}
        style={{
          width: "100%",
          padding: "14px 24px",
          borderRadius: 12,
          border: loading
            ? "1px solid rgba(14,165,160,0.4)"
            : disabled
            ? "1px solid rgba(14,165,160,0.15)"
            : "1px solid rgba(14,165,160,0.8)",
          background: bgColor,
          color: loading ? "#E2E8F0" : textColor,
          fontSize: 15,
          fontWeight: 700,
          cursor: disabled || loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          transition: "all 0.2s",
          letterSpacing: "-0.01em",
          boxShadow: disabled || loading
            ? "none"
            : "0 0 24px rgba(14,165,160,0.35), 0 4px 16px rgba(14,165,160,0.2)",
          animation: loading ? "btn-pulse 1.5s ease-in-out infinite" : "none",
        }}
        onMouseEnter={e => {
          if (!disabled && !loading) {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 32px rgba(14,165,160,0.5), 0 6px 20px rgba(14,165,160,0.3)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }
          setShowTooltip(true);
        }}
        onMouseLeave={e => {
          if (!disabled && !loading) {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 24px rgba(14,165,160,0.35), 0 4px 16px rgba(14,165,160,0.2)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }
          setShowTooltip(false);
        }}
      >
        {loading ? (
          <>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2.5px solid rgba(255,255,255,0.3)",
                borderTopColor: "#E2E8F0",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Generating…
          </>
        ) : comingSoon ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Coming Soon
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Generate Video
          </>
        )}
      </button>

      <style>{`
        @keyframes btn-pulse {
          0%, 100% { box-shadow: 0 0 16px rgba(14,165,160,0.3); }
          50% { box-shadow: 0 0 28px rgba(14,165,160,0.5); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  onGenerate: () => void;
}

export default function VideoPromptPanel({
  model,
  prompt,
  setPrompt,
  negPrompt,
  setNegPrompt,
  quality,
  duration,
  generating,
  userCredits,
  onGenerate,
}: Props) {
  const [showNeg, setShowNeg] = useState(false);

  const chips = model?.promptChips ?? [
    "cinematic lighting",
    "slow motion",
    "aerial shot",
    "dramatic scene",
    "ultra realistic",
    "film grain",
    "smooth camera motion",
  ];

  const estimate = model
    ? estimateCredits(model.id, quality, duration)
    : 0;

  const isComingSoon = model ? !model.available : false;
  const insufficientCredits = userCredits < estimate && !isComingSoon;
  const noPrompt = prompt.trim().length === 0;
  const isDisabled = isComingSoon || insufficientCredits || noPrompt || generating;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100%",
      }}
    >
      {/* ── Prompt label ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Prompt
        </span>
        <button
          onClick={() => setPrompt("")}
          style={{
            background: "none",
            border: "none",
            fontSize: 11,
            color: "#334155",
            cursor: "pointer",
            padding: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#334155"; }}
        >
          Clear
        </button>
      </div>

      {/* ── Main textarea ────────────────────────────────────────────────── */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe your video in detail — setting, mood, movement, lighting…"
        rows={5}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "14px 16px",
          fontSize: 15,
          color: "#E2E8F0",
          resize: "vertical",
          outline: "none",
          lineHeight: 1.6,
          fontFamily: "inherit",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxSizing: "border-box",
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = "rgba(14,165,160,0.4)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(14,165,160,0.06)";
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {/* ── Prompt chips ─────────────────────────────────────────────────── */}
      <ChipStrip chips={chips} prompt={prompt} setPrompt={setPrompt} />

      {/* ── Negative prompt toggle ───────────────────────────────────────── */}
      {model?.capabilities.negativePrompt && (
        <div>
          <button
            onClick={() => setShowNeg(v => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: showNeg ? "#0EA5A0" : "#475569",
              fontWeight: 500,
              transition: "color 0.15s",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: showNeg ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Negative Prompt
          </button>

          {showNeg && (
            <textarea
              value={negPrompt}
              onChange={e => setNegPrompt(e.target.value)}
              placeholder="What to avoid: blur, watermark, low quality, distorted hands…"
              rows={2}
              style={{
                marginTop: 8,
                width: "100%",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#94A3B8",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.5,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.15)"; }}
            />
          )}
        </div>
      )}

      {/* ── Spacer ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Credit estimate ──────────────────────────────────────────────── */}
      {model && !isComingSoon && (
        <CreditCard
          estimate={estimate}
          balance={userCredits}
          modelName={model.displayName}
        />
      )}

      {/* ── Generate button ──────────────────────────────────────────────── */}
      <GenerateButton
        disabled={isDisabled}
        loading={generating}
        comingSoon={isComingSoon}
        insufficientCredits={insufficientCredits}
        noPrompt={noPrompt && !isComingSoon}
        onClick={onGenerate}
      />
    </div>
  );
}
