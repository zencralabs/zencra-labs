"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudioShell — Master layout + state + generation logic
// Design system: #020617 base · #1A1A1A canvas · per-model pill colors
// Cinema focus mode: canvas glow intensifies on active mode
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useFlowStore } from "@/lib/flow/store";
import { createWorkflow, addWorkflowStep } from "@/lib/flow/actions";
import FlowBar from "@/components/studio/flow/FlowBar";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  VIDEO_MODEL_REGISTRY,
  type VideoModel,
} from "@/lib/ai/video-model-registry";
import { getMotionPresetsForModel } from "./VideoLeftRail";
import type { FrameMode, VideoAR, Quality, ImageSlot, AudioSlot, GeneratedVideo } from "./types";
import { EMPTY_SLOT, EMPTY_AUDIO } from "./types";
import { supabase }            from "@/lib/supabase";
import { useLipSync }          from "@/hooks/useLipSync";
import type { LipSyncQuality } from "@/lib/lipsync/status";
import { useAuth }             from "@/components/auth/AuthContext";
import { AuthModal }           from "@/components/auth/AuthModal";
import VideoLeftRail       from "./VideoLeftRail";
import VideoCanvas, { MotionFlowStrip } from "./VideoCanvas";
import VideoPromptPanel    from "./VideoPromptPanel";
import VideoResultsLibrary from "./VideoResultsLibrary";
import CanvasGenerateBar   from "./CanvasGenerateBar";
import { FullscreenPreview } from "@/components/ui/FullscreenPreview";
import { useSequenceState } from "@/hooks/useSequenceState";
import { ShotStack }        from "./ShotStack";
import { getGenerationCreditCost } from "@/lib/credits/model-costs";
import { startPolling as startUniversalPolling } from "@/lib/jobs/job-polling";
import { getPendingJobStoreState }               from "@/lib/jobs/pending-job-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_CREDITS  = 500;
const POLL_INTERVAL           = 4000;
const MAX_POLLS               = 60;   // 60 × 4s = 4 min — normal jobs
const MAX_POLLS_SCENE_AUDIO   = 75;   // 75 × 4s = 5 min — Scene Audio gets extra time before fallback
const SIDE_GUTTER   = 20;

// ── Type for a raw history asset row returned by /api/assets ─────────────────
interface HistoryAsset {
  id:             string;
  status:         string;
  url:            string | null;
  prompt:         string | null;
  model_key:      string;
  provider:       string | null;
  aspect_ratio:   string | null;
  credits_cost:   number | null;
  visibility:     string | null;
  is_favorite:    boolean | null;
  created_at:     string;
  error_message:  string | null;
  audio_detected: boolean | null;
}

// ── Per-model accent color ────────────────────────────────────────────────────

function modelAccentColor(m: VideoModel): string {
  if (m.badgeColor) return m.badgeColor;
  if (m.provider === "kling") return "#0EA5A0";
  return "#0EA5A0";
}

// ── Credit estimate ───────────────────────────────────────────────────────────
// Uses the shared getGenerationCreditCost() utility which mirrors credit_model_costs DB table.
// Duration scaling: Math.ceil(durationSeconds / 5) × base_credits (same as hooks.ts)
function estimateCredits(id: string, _q: string, d: number): number {
  return getGenerationCreditCost(id, { durationSeconds: d }) ?? 0;
}

// ── Family accent colors ──────────────────────────────────────────────────────

const FAMILY_ACCENT: Record<string, string> = {
  kling:    "#0EA5A0",
  seedance: "#6366F1",
  minimax:  "#8B5CF6",
};

function familyAccent(provider: string): string {
  return FAMILY_ACCENT[provider] ?? "#0EA5A0";
}

// ── Family Dropdown (Kling / Seedance) ────────────────────────────────────────

function FamilyPill({
  models,
  selectedId,
  onSelect,
  accent,
  defaultId,
}: {
  models: VideoModel[];
  selectedId: string;
  onSelect: (id: string) => void;
  accent: string;
  defaultId: string;   // flagship — shown on pill when no family model is selected
}) {
  // Hover-driven — no click needed to open. onMouseEnter/Leave on the wrapper.
  const [open, setOpen] = useState(false);

  // If the selected model belongs to this family, show it. Otherwise show flagship.
  const selected  = models.find(m => m.id === selectedId);
  const flagship  = models.find(m => m.id === defaultId) ?? models[0];
  const displayed = selected ?? flagship;
  const isActive  = !!selected; // true only when a model from THIS family is selected

  // Dropdown shows every model in the family EXCEPT the one currently on the pill
  const dropdownModels = models.filter(m => m.id !== displayed.id);

  // Omni treatment — only when Kling 3.0 Omni is the displayed + active model
  const isOmniActive = isActive && displayed.id === "kling-30-omni";

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <style>{`
        @keyframes omniShimmer {
          0%,100% { box-shadow: 0 0 16px rgba(14,165,160,0.40), 0 0 4px rgba(34,211,238,0.15); }
          50%     { box-shadow: 0 0 32px rgba(14,165,160,0.65), 0 0 8px rgba(34,211,238,0.30); }
        }
      `}</style>
      {/* Pill trigger — no onClick, hover on parent wrapper opens the panel */}
      <button
        style={{
          padding: "9px 14px 9px 18px",
          borderRadius: 10,
          border: isActive
            ? isOmniActive
              ? `1px solid ${accent}`           // fully opaque border for Omni
              : `1px solid ${accent}99`
            : open
              ? "1px solid rgba(255,255,255,0.15)"
              : "1px solid rgba(255,255,255,0.08)",
          background: isActive
            ? `${accent}22`
            : open
              ? "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.03)",
          color: (isActive || open) ? "#F8FAFC" : "#CBD5F5",
          fontSize: 14, fontWeight: isActive ? 700 : 500,
          cursor: "default",          // pointer is on the wrapper, not the button
          transition: isOmniActive ? "border-color 0.15s ease" : "all 0.15s ease",
          display: "flex", alignItems: "center", gap: 6,
          // Omni: animation handles box-shadow; standard: static glow
          boxShadow: isOmniActive ? undefined : (isActive ? `0 0 15px ${accent}44` : "none"),
          animation: isOmniActive ? "omniShimmer 3.6s ease-in-out infinite" : "none",
          whiteSpace: "nowrap",
          pointerEvents: "none",      // let the wrapper handle all mouse events
        }}
      >
        {displayed.displayName}
        {/* Badge shown inline on the pill (e.g. "Seedance 2.0 NEW", "Kling 3.0 HOT") */}
        {displayed.badge && (
          <span style={{
            fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 4,
            letterSpacing: "0.06em",
            background: isActive ? `${accent}33` : "rgba(255,255,255,0.08)",
            color: isActive ? accent : "#94A3B8",
            border: `1px solid ${isActive ? accent + "55" : "rgba(255,255,255,0.12)"}`,
          }}>
            {displayed.badge}
          </span>
        )}
        <ChevronDown
          size={12}
          style={{
            color: isActive ? accent : open ? "#94A3B8" : "#64748B",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Dropdown panel — visible while wrapper is hovered */}
      {open && dropdownModels.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100,
          // Invisible bridge so moving the mouse into the panel doesn't fire onMouseLeave
          paddingTop: 6,
        }}>
          <div style={{
            background: "rgba(8,14,28,0.98)", border: `1px solid ${accent}22`,
            borderRadius: 12, padding: 6, minWidth: 185,
            backdropFilter: "blur(20px)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          }}>
          {dropdownModels.map(m => {
            const isSel = m.id === selectedId;
            return (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); setOpen(false); }}
                style={{
                  display: "flex", width: "100%", alignItems: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 8, border: "none",
                  background: isSel ? `${accent}18` : "transparent",
                  color: isSel ? "#F8FAFC" : "#94A3B8",
                  fontSize: 14, fontWeight: isSel ? 600 : 400,
                  cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!isSel) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}}
                onMouseLeave={e => { if (!isSel) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: isSel ? accent : "transparent",
                  boxShadow: isSel ? `0 0 6px ${accent}` : "none",
                  border: isSel ? "none" : "1px solid rgba(255,255,255,0.15)",
                }} />
                {m.displayName}
                {m.badge && (
                  <span style={{
                    marginLeft: "auto", fontSize: 9, fontWeight: 800,
                    padding: "2px 6px", borderRadius: 4,
                    background: `${accent}22`, color: accent, border: `1px solid ${accent}55`,
                  }}>
                    {m.badge}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool bar with family dropdowns + flat SOON pills ──────────────────────────

// ── Vertical chip divider ─────────────────────────────────────────────────────

function ChipDivider() {
  return (
    <div style={{
      width: 1, height: 20, flexShrink: 0,
      background: "rgba(255,255,255,0.10)",
      marginLeft: 6, marginRight: 6,
      // Subtle hover glow handled by parent group if needed
    }} />
  );
}

// ── Tool bar with family dropdowns + flat SOON pills ──────────────────────────

function FamilyDropdownBar({
  selectedId,
  onSelect,
  onScrollToGallery,
  onPreviewHover,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onScrollToGallery?: () => void;
  onPreviewHover?: (key: string | null) => void;
}) {
  const klingModels    = VIDEO_MODEL_REGISTRY.filter(m => m.provider === "kling");
  const seedanceModels = VIDEO_MODEL_REGISTRY.filter(m => m.provider === "seedance");
  const minimaxModels  = VIDEO_MODEL_REGISTRY.filter(m => m.provider === "minimax");
  // "heygen" is hidden from the model bar — provider code and routing remain intact
  const otherModels    = VIDEO_MODEL_REGISTRY.filter(
    m => m.provider !== "kling" && m.provider !== "seedance" &&
         m.provider !== "minimax" && m.provider !== "heygen"
  );

  // All "slots" in order: kling, seedance, ...others
  const totalSlots = 2 + otherModels.length;

  return (
    // OUTER: position + z-index so dropdown renders above the sticky left rail.
    // overflow: visible is critical — scroll containers clip absolute children.
    <div style={{
      position: "relative",
      zIndex: 50,
      overflow: "visible",
      paddingBottom: 18,
      paddingLeft: SIDE_GUTTER,
      paddingRight: SIDE_GUTTER,
    }}>
      {/* INNER: flex row — no overflowX:auto here (would clip the dropdown) */}
      <div style={{ display: "flex", alignItems: "center" }}>

        {/* Kling family — pill shows Kling 3.0 Omni by default; dropdown: Kling 3.0, Kling 2.6, Kling 2.5 Turbo */}
        <div
          onMouseEnter={() => onPreviewHover?.("kling")}
          onMouseLeave={() => onPreviewHover?.(null)}
        >
          <FamilyPill
            models={klingModels}
            selectedId={selectedId}
            onSelect={onSelect}
            accent={familyAccent("kling")}
            defaultId="kling-30"
          />
        </div>
        <ChipDivider />

        {/* Seedance family — pill shows Seedance 2.0 NEW by default; dropdown: 2.0 FAST, 1.5 Pro */}
        <div
          onMouseEnter={() => onPreviewHover?.("seedance")}
          onMouseLeave={() => onPreviewHover?.(null)}
        >
          <FamilyPill
            models={seedanceModels}
            selectedId={selectedId}
            onSelect={onSelect}
            accent={familyAccent("seedance")}
            defaultId="seedance-20"
          />
        </div>
        <ChipDivider />

        {/* MiniMax Hailuo family — pill shows Hailuo 2.3 by default; dropdown: 2.3 Fast, Hailuo 02 */}
        <div
          onMouseEnter={() => onPreviewHover?.("minimax")}
          onMouseLeave={() => onPreviewHover?.(null)}
        >
          <FamilyPill
            models={minimaxModels}
            selectedId={selectedId}
            onSelect={onSelect}
            accent={familyAccent("minimax")}
            defaultId="minimax-hailuo-23"
          />
        </div>

        {/* Flat pills for other models */}
        {otherModels.map((m, i) => {
          const active = m.id === selectedId;
          const accent = modelAccentColor(m);
          const isLast = (2 + i) === totalSlots - 1;
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Divider before every flat pill (including the first one) */}
              <ChipDivider />
              <button
                onClick={() => onSelect(m.id)}
                style={{
                  flexShrink: 0,
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: active ? `1px solid ${accent}99` : "1px solid rgba(255,255,255,0.08)",
                  background: active ? `${accent}22` : "rgba(255,255,255,0.03)",
                  color: active ? "#F8FAFC" : "#CBD5F5",
                  fontSize: 14, fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: active ? `0 0 15px ${accent}44` : "none",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  onPreviewHover?.(m.provider);
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#F8FAFC";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                  }
                }}
                onMouseLeave={e => {
                  onPreviewHover?.(null);
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#CBD5F5";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }
                }}
              >
                {m.displayName}
                {m.badge && (() => {
                  const isSoon  = m.badge === "SOON";
                  const bgColor = isSoon ? "rgba(245,158,11,0.15)" : `${accent}22`;
                  const bdColor = isSoon ? "#F59E0B" : accent;
                  const txColor = isSoon ? "#FCD34D" : accent;
                  return (
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 6px",
                      borderRadius: 4, letterSpacing: "0.07em",
                      background: bgColor, color: txColor, border: `1px solid ${bdColor}`,
                    }}>
                      {m.badge}
                    </span>
                  );
                })()}
              </button>
              {/* Divider after each flat pill except the last */}
              {!isLast && <ChipDivider />}
            </div>
          );
        })}

        {/* ── Right-side controls: Gallery ── */}
        <div style={{
          marginLeft:  "auto",
          paddingLeft: 12,
          display:     "flex",
          alignItems:  "center",
          gap:         8,
          flexShrink:  0,
        }}>
          {/* Gallery — always visible */}
          <button
            onClick={onScrollToGallery}
            style={{
              padding:      "6px 13px",
              borderRadius: 8,
              border:       "1px solid rgba(255,255,255,0.08)",
              background:   "rgba(255,255,255,0.04)",
              color:        "#64748B",
              fontSize:     12,
              fontWeight:   500,
              cursor:       "pointer",
              transition:   "background 0.15s, color 0.15s",
              whiteSpace:   "nowrap",
              display:      "flex",
              alignItems:   "center",
              gap:          5,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "#94A3B8";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color = "#64748B";
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M9 8l7 4-7 4V8z"/>
            </svg>
            Gallery
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Omni: Shot entry type ─────────────────────────────────────────────────────

interface OmniShotEntry {
  id:          string;
  prompt:      string;
  duration:    5 | 10;
  composition: "Wide" | "Close-up" | "OTS" | "Reveal" | "Action";
}

// ── Omni: Shot Stack — Left Panel ─────────────────────────────────────────────

function OmniShotStack({
  shots, onAdd, onUpdate, onRemove,
}: {
  shots:    OmniShotEntry[];
  onAdd:    () => void;
  onUpdate: (id: string, patch: Partial<OmniShotEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const ACCENT = "#0EA5A0";
  const COMPS  = ["Wide", "Close-up", "OTS", "Reveal", "Action"] as const;
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "rgba(4,8,20,0.94)",
      border: "1px solid rgba(14,165,160,0.18)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 0 40px rgba(14,165,160,0.06), inset 0 0 60px rgba(0,0,0,0.3)",
    }}>
      {/* Header */}
      <div style={{
        padding: "15px 16px 13px",
        borderBottom: "1px solid rgba(14,165,160,0.14)",
        background: "rgba(14,165,160,0.04)",
        backdropFilter: "blur(8px)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`,
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: ACCENT, textTransform: "uppercase" }}>
            Shot Stack
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#334155", marginTop: 4, paddingLeft: 14 }}>
          {shots.length} shot{shots.length !== 1 ? "s" : ""} · cinematic sequence
        </div>
      </div>

      {/* Shot cards */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 12px 8px",
        display: "flex", flexDirection: "column", gap: 6,
        scrollbarWidth: "thin", scrollbarColor: "rgba(14,165,160,0.08) transparent",
      }}>
        {shots.map((shot, idx) => {
          const isLast = idx === shots.length - 1;
          return (
            <div key={shot.id} style={{ position: "relative" }}>
              {/* Timeline vertical connector */}
              {!isLast && (
                <div style={{
                  position: "absolute", left: 21, top: "100%",
                  width: 1, height: 6,
                  background: `linear-gradient(to bottom, rgba(14,165,160,0.30), transparent)`,
                  zIndex: 1,
                }} />
              )}
              <div style={{
                background: "linear-gradient(135deg, rgba(14,165,160,0.10) 0%, rgba(4,8,20,0.96) 55%)",
                border: "1px solid rgba(14,165,160,0.22)",
                borderRadius: 10,
                padding: "11px 11px 10px",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,160,0.42)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(14,165,160,0.10)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,160,0.22)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* Shot header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}08)`,
                      border: `1px solid ${ACCENT}55`,
                      boxShadow: `0 0 12px ${ACCENT}20`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 900, color: ACCENT, letterSpacing: "0.06em",
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#CBD5F5", letterSpacing: "0.01em" }}>
                      Shot {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {shots.length > 1 && (
                    <button onClick={() => onRemove(shot.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 5px", color: "#1E293B", lineHeight: 1, borderRadius: 4, transition: "all 0.12s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#EF4444"; (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#1E293B"; (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Prompt */}
                <textarea value={shot.prompt} onChange={e => onUpdate(shot.id, { prompt: e.target.value })}
                  placeholder="Describe this shot…" rows={2}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, color: "#CBD5F5", fontSize: 12, padding: "7px 9px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.55, transition: "border-color 0.15s" }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}60`; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                />
                {/* Duration + composition */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", background: "rgba(0,0,0,0.40)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: 2, gap: 2, flexShrink: 0 }}>
                    {([5, 10] as const).map(d => (
                      <button key={d} onClick={() => onUpdate(shot.id, { duration: d })}
                        style={{ padding: "3px 10px", borderRadius: 4, border: "none", fontSize: 11, fontWeight: 700, background: shot.duration === d ? `${ACCENT}28` : "transparent", color: shot.duration === d ? ACCENT : "#334155", cursor: "pointer", transition: "all 0.12s", boxShadow: shot.duration === d ? `0 0 8px ${ACCENT}20` : "none" }}
                      >{d}s</button>
                    ))}
                  </div>
                  {COMPS.map(c => (
                    <button key={c} onClick={() => onUpdate(shot.id, { composition: c })}
                      style={{ padding: "3px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, border: shot.composition === c ? `1px solid ${ACCENT}60` : "1px solid rgba(255,255,255,0.06)", background: shot.composition === c ? `${ACCENT}18` : "rgba(255,255,255,0.02)", color: shot.composition === c ? ACCENT : "#334155", cursor: "pointer", transition: "all 0.12s", letterSpacing: "0.02em" }}
                      onMouseEnter={e => { if (shot.composition !== c) { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}}
                      onMouseLeave={e => { if (shot.composition !== c) { (e.currentTarget as HTMLElement).style.color = "#334155"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}}
                    >{c}</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {/* Add Shot */}
        <button onClick={onAdd}
          style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1px dashed rgba(14,165,160,0.28)", background: "rgba(14,165,160,0.03)", color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s", marginTop: 2, letterSpacing: "0.02em" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.10)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,160,0.50)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(14,165,160,0.10)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,160,0.28)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Shot
        </button>
      </div>
    </div>
  );
}

// ── Omni: Director Board — Center Canvas ──────────────────────────────────────

function OmniDirectorBoard({
  shots, startSlot, endSlot, motionVideoUrl, generating,
  onAddReferenceImage, onAddReferenceVideo, onTryStoryboardPrompt,
  onSwapFrames, onRemoveVideo,
}: {
  shots:                 OmniShotEntry[];
  startSlot:             ImageSlot;
  endSlot:               ImageSlot;
  motionVideoUrl:        string | null;
  generating:            boolean;
  onAddReferenceImage:   () => void;
  onAddReferenceVideo:   () => void;
  onTryStoryboardPrompt: () => void;
  onSwapFrames:          () => void;
  onRemoveVideo:         () => void;
}) {
  const ACCENT = "#0EA5A0";
  const hasStart = !!startSlot.url;
  const hasEnd   = !!endSlot.url;
  const hasVideo = !!motionVideoUrl;

  const FLOW_STEPS = ["Prompt", "Elements", "Motion", "Output"] as const;
  const activeStep = hasStart || hasEnd || hasVideo ? 1 : 0;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      minHeight: 440,
      background: [
        "radial-gradient(ellipse at 22% 15%, rgba(14,165,160,0.14), transparent 50%)",
        "radial-gradient(ellipse at 78% 82%, rgba(34,211,238,0.09), transparent 48%)",
        "radial-gradient(ellipse at 50% 50%, rgba(8,13,28,0.6), transparent 80%)",
        "#080D18",
      ].join(", "),
      border: "1px solid rgba(14,165,160,0.28)",
      borderRadius: 14,
      boxShadow: [
        "0 0 80px rgba(14,165,160,0.08)",
        "0 0 160px rgba(14,165,160,0.04)",
        "inset 0 0 120px rgba(0,0,0,0.50)",
        "0 24px 64px rgba(0,0,0,0.70)",
      ].join(", "),
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes omniGenSpin  { to { transform: rotate(360deg); } }
        @keyframes omniGenPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(14,165,160,0); } 50% { box-shadow: 0 0 48px 12px rgba(14,165,160,0.22); } }
        @keyframes omniBeamPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes omniShotDotPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes omniDockPop { 0% { opacity: 0; transform: translateY(-50%) translateX(-6px) scale(0.97); } 100% { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 22px 12px",
        borderBottom: "1px solid rgba(14,165,160,0.13)",
        background: "rgba(4,8,20,0.75)",
        backdropFilter: "blur(20px)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Kling badge */}
          <div style={{
            padding: "4px 12px", borderRadius: 6,
            background: `linear-gradient(135deg, ${ACCENT}22, rgba(34,211,238,0.12))`,
            border: `1px solid ${ACCENT}55`,
            fontSize: 10, fontWeight: 900, color: ACCENT, letterSpacing: "0.09em",
            boxShadow: `0 0 12px ${ACCENT}22`,
          }}>
            KLING 3.0 OMNI
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#475569", letterSpacing: "0.02em" }}>
            Cinematic Director Mode
          </span>
        </div>

        {/* Flow pipeline indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {FLOW_STEPS.map((label, i, arr) => {
            const isActive = i === activeStep;
            const isPast   = i < activeStep;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: isActive ? ACCENT : isPast ? `${ACCENT}66` : "rgba(255,255,255,0.10)",
                    boxShadow: isActive ? `0 0 8px ${ACCENT}` : "none",
                    animation: isActive ? "omniBeamPulse 2s ease-in-out infinite" : "none",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: isActive ? 700 : 500,
                    color: isActive ? ACCENT : isPast ? "#475569" : "#253045",
                    letterSpacing: "0.04em",
                  }}>
                    {label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke={isPast ? `${ACCENT}44` : "rgba(255,255,255,0.10)"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main board ── */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "26px 22px",
        gap: 22,
        /* Subtle film-grain texture overlay via CSS gradient noise */
        backgroundImage: [
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.015) 1px, transparent 0)",
        ].join(", "),
        backgroundSize: "32px 32px",
      }}>
        {generating ? (
          /* ── Generating state ── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
            animation: "omniGenPulse 2.2s ease-in-out infinite",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: `linear-gradient(135deg, ${ACCENT}24, rgba(34,211,238,0.12))`,
              border: `1px solid ${ACCENT}66`,
              boxShadow: `0 0 32px ${ACCENT}33, inset 0 0 24px rgba(0,0,0,0.4)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: "omniGenSpin 1.2s linear infinite" }}>
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.01em" }}>
                Generating Omni Scene…
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6, letterSpacing: "0.01em" }}>
                {shots.length} shot{shots.length !== 1 ? "s" : ""} · cinematic sequence rendering
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Reference thumbnails — appear when assets are attached ── */}
            {(hasStart || hasEnd || hasVideo) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 0, rowGap: 14, alignItems: "flex-start", justifyContent: "center", marginBottom: 2 }}>
                {/* Start Frame */}
                {hasStart && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      Start Frame
                    </div>
                    <div style={{
                      position: "relative", width: 188, height: 116, borderRadius: 10,
                      overflow: "hidden",
                      border: `2px solid ${ACCENT}88`,
                      boxShadow: `0 0 32px ${ACCENT}44, 0 0 64px ${ACCENT}1a, 0 0 0 1px ${ACCENT}22`,
                      flexShrink: 0,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={startSlot.preview ?? startSlot.url ?? ""} alt="start frame"
                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }} />
                      <div style={{
                        position: "absolute", inset: 0,
                        background: `linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)`,
                        pointerEvents: "none",
                      }} />
                      <div style={{
                        position: "absolute", bottom: 7, left: 8,
                        fontSize: 9, fontWeight: 900, color: "#fff",
                        background: `${ACCENT}cc`, padding: "2px 8px",
                        borderRadius: 4, letterSpacing: "0.08em",
                      }}>START FRAME</div>
                    </div>
                  </div>
                )}

                {/* Swap button — only when both frames exist */}
                {hasStart && hasEnd && (
                  <div style={{ display: "flex", alignItems: "center", padding: "0 10px", marginTop: 34 }}>
                    <button
                      onClick={onSwapFrames}
                      title="Swap start ↔ end"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "rgba(14,165,160,0.10)",
                        border: "1px solid rgba(14,165,160,0.30)",
                        color: ACCENT, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.18s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = `${ACCENT}28`;
                        el.style.boxShadow = `0 0 18px ${ACCENT}44`;
                        el.style.transform = "scale(1.12)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = "rgba(14,165,160,0.10)";
                        el.style.boxShadow = "none";
                        el.style.transform = "none";
                      }}
                    >
                      {/* ⇄ arrows */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 3 21 3 21 8"/>
                        <line x1="4" y1="20" x2="21" y2="3"/>
                        <polyline points="21 16 21 21 16 21"/>
                        <line x1="3" y1="4" x2="21" y2="21"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Gap between start and end when no swap button */}
                {hasStart && !hasEnd && hasVideo && <div style={{ width: 10 }} />}
                {!hasStart && hasEnd && <div style={{ width: 0 }} />}

                {/* End Frame */}
                {hasEnd && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#F59E0B", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      End Frame
                    </div>
                    <div style={{
                      position: "relative", width: 188, height: 116, borderRadius: 10,
                      overflow: "hidden",
                      border: "2px solid rgba(245,158,11,0.70)",
                      boxShadow: "0 0 32px rgba(245,158,11,0.38), 0 0 64px rgba(245,158,11,0.14), 0 0 0 1px rgba(245,158,11,0.15)",
                      flexShrink: 0,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={endSlot.preview ?? endSlot.url ?? ""} alt="end frame"
                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }} />
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)",
                        pointerEvents: "none",
                      }} />
                      <div style={{
                        position: "absolute", bottom: 7, left: 8,
                        fontSize: 9, fontWeight: 900, color: "#fff",
                        background: "rgba(245,158,11,0.80)", padding: "2px 8px",
                        borderRadius: 4, letterSpacing: "0.08em",
                      }}>END FRAME</div>
                    </div>
                  </div>
                )}

                {/* Video Reference — marginLeft only applies on the same row; when wrapped it centers automatically */}
                {hasVideo && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginLeft: (hasStart || hasEnd) ? 10 : 0, flexBasis: "auto" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#818CF8", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      Motion Ref
                    </div>
                    <div style={{
                      position: "relative",
                      width: 140, height: 116, borderRadius: 10,
                      border: "1px solid rgba(99,102,241,0.50)",
                      background: "rgba(99,102,241,0.10)",
                      boxShadow: "0 0 24px rgba(99,102,241,0.22)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 8, flexShrink: 0,
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#818CF8", letterSpacing: "0.06em" }}>
                        VIDEO REF
                      </span>
                      {/* ✕ Remove overlay button */}
                      <button
                        onClick={onRemoveVideo}
                        title="Remove video reference"
                        style={{
                          position: "absolute", top: 6, right: 6,
                          width: 20, height: 20, borderRadius: 6,
                          background: "rgba(0,0,0,0.70)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#94A3B8", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "rgba(239,68,68,0.80)";
                          el.style.color = "#fff";
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "rgba(0,0,0,0.70)";
                          el.style.color = "#94A3B8";
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Headline ── */}
            <div style={{ textAlign: "center", maxWidth: 440 }}>
              <div style={{
                fontSize: 26, fontWeight: 900, color: "#F8FAFC",
                letterSpacing: "-0.02em", lineHeight: 1.18, marginBottom: 10,
                textShadow: `0 0 40px ${ACCENT}33`,
              }}>
                Direct cinematic<br />multi-shot scenes
              </div>
              <div style={{
                fontSize: 13, color: "#3D5070", lineHeight: 1.70, margin: "0 auto",
              }}>
                Build a shot stack on the left, add reference frames or motion video,
                then let Kling 3.0 Omni compose your vision across multiple camera angles.
              </div>
            </div>

            {/* ── Shot progress bar ── */}
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {shots.map((_, i) => (
                <div key={i} style={{
                  width: i === 0 ? 36 : 24, height: 3, borderRadius: 2,
                  background: i === 0
                    ? `linear-gradient(to right, ${ACCENT}, #22D3EE)`
                    : `rgba(14,165,160,0.20)`,
                  boxShadow: i === 0 ? `0 0 8px ${ACCENT}55` : "none",
                  transition: "all 0.2s",
                  animation: `omniShotDotPop 0.25s ease both`,
                  animationDelay: `${i * 0.04}s`,
                }} />
              ))}
              <span style={{ fontSize: 10, fontWeight: 600, color: "#2D4060", marginLeft: 4, letterSpacing: "0.04em" }}>
                {shots.length} SHOT{shots.length !== 1 ? "S" : ""}
              </span>
            </div>

            {/* ── CTA buttons ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {[
                { label: "Add Reference Image",    icon: "image",   action: onAddReferenceImage,   color: ACCENT },
                { label: "Add Reference Video",    icon: "video",   action: onAddReferenceVideo,   color: "#818CF8" },
                { label: "Try Storyboard Prompt",  icon: "sparkle", action: onTryStoryboardPrompt, color: "#F59E0B" },
              ].map(({ label, icon, action, color }) => (
                <button key={label} onClick={action}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                    borderRadius: 9, fontSize: 12, fontWeight: 600,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    background: "rgba(255,255,255,0.03)",
                    backdropFilter: "blur(8px)",
                    color: "#64748B", cursor: "pointer", transition: "all 0.18s",
                    letterSpacing: "0.01em",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = `${color}14`;
                    el.style.color = color;
                    el.style.borderColor = `${color}44`;
                    el.style.boxShadow = `0 0 20px ${color}18`;
                    el.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "rgba(255,255,255,0.03)";
                    el.style.color = "#64748B";
                    el.style.borderColor = "rgba(255,255,255,0.08)";
                    el.style.boxShadow = "none";
                    el.style.transform = "none";
                  }}
                >
                  {icon === "image"   && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                  {icon === "video"   && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
                  {icon === "sparkle" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Omni: Controls Panel — Left Panel (visible inputs, no hiding) ─────────────

function OmniControlsPanel({
  prompt, setPrompt, negPrompt, setNegPrompt,
  quality, setQuality, audioMode, setAudioMode,
  startSlot, setStartSlot, endSlot, setEndSlot,
  motionVideoUrl, setMotionVideoUrl, setMotionVideoName,
}: {
  prompt:             string;
  setPrompt:          (v: string) => void;
  negPrompt:          string;
  setNegPrompt:       (v: string) => void;
  quality:            Quality;
  setQuality:         (q: Quality) => void;
  audioMode:          "none" | "scene" | "voiceover";
  setAudioMode:       (m: "none" | "scene" | "voiceover") => void;
  startSlot:          ImageSlot;
  setStartSlot:       (s: ImageSlot) => void;
  endSlot:            ImageSlot;
  setEndSlot:         (s: ImageSlot) => void;
  motionVideoUrl:     string | null;
  setMotionVideoUrl:  (u: string | null) => void;
  setMotionVideoName: (n: string | null) => void;
}) {
  const ACCENT  = "#0EA5A0";
  const GLASS   = "rgba(4,8,20,0.92)";

  const inputBase: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.38)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8, color: "#CBD5F5", fontSize: 13,
    padding: "9px 12px", outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s",
  };

  const Section = ({
    label, color = ACCENT, children,
  }: { label: string; color?: string; children: React.ReactNode }) => (
    <div style={{
      background: GLASS,
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `2px solid ${color}66`,
      borderRadius: 10,
      padding: "14px 14px 16px",
      boxShadow: "inset 0 0 24px rgba(0,0,0,0.20)",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: color,
        letterSpacing: "0.08em", textTransform: "uppercase" as const,
        marginBottom: 11, opacity: 0.85,
      }}>{label}</div>
      {children}
    </div>
  );

  // Collapsible section — chevron toggle, 220ms height animation
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    exclude: true,
    frameRate: true,
    advanced: true,
  });
  const toggleSection = (key: string) =>
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const CollapsibleSection = ({
    sectionKey, label, color = "#475569", children,
  }: { sectionKey: string; label: string; color?: string; children: React.ReactNode }) => {
    const collapsed = collapsedSections[sectionKey] ?? true;
    return (
      <div style={{
        background: GLASS,
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `2px solid ${color}55`,
        borderRadius: 10,
        boxShadow: "inset 0 0 24px rgba(0,0,0,0.20)",
        overflow: "hidden",
      }}>
        <button
          onClick={() => toggleSection(sectionKey)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 14px",
            background: "none", border: "none", cursor: "pointer",
            textAlign: "left" as const,
          }}
        >
          <span style={{
            fontSize: 10, fontWeight: 800, color: color,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            opacity: 0.85,
          }}>{label}</span>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{
              flexShrink: 0, opacity: 0.7,
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.22s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div style={{
          maxHeight: collapsed ? 0 : 400,
          overflow: "hidden",
          transition: "max-height 0.22s ease",
        }}>
          <div style={{ padding: "0 14px 14px" }}>
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "rgba(4,8,20,0.82)",
      border: "1px solid rgba(14,165,160,0.16)",
      borderRadius: 14,
      boxShadow: "0 0 48px rgba(14,165,160,0.05), inset 0 0 60px rgba(0,0,0,0.28)",
      overflow: "hidden",
    }}>
      {/* ── Panel header ── */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(4,8,20,0.72)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", lineHeight: 1 }}>Omni Controls</div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Production configuration</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable sections ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 12px 16px", overflowY: "auto" }}>

        {/* Scene Prompt */}
        <Section label="Scene Direction" color={ACCENT}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Overall scene mood, tone, and cinematic direction…" rows={4}
            style={{ ...inputBase, resize: "none", lineHeight: 1.55 }}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}55`; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
          />
        </Section>

        {/* Negative Prompt — collapsible, default collapsed */}
        <CollapsibleSection sectionKey="exclude" label="Exclude" color="#475569">
          <textarea value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
            placeholder="Elements to exclude from the output…" rows={2}
            style={{ ...inputBase, resize: "none", lineHeight: 1.55 }}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}55`; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
          />
        </CollapsibleSection>

        {/* Reference Frames */}
        <Section label="Reference Frames" color="#22D3EE">
          <div style={{ display: "flex", gap: 8 }}>
            {/* Start frame */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", marginBottom: 6, letterSpacing: "0.06em" }}>START FRAME</div>
              {startSlot.url ? (
                <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 7, overflow: "hidden", border: `1px solid ${ACCENT}55`, boxShadow: `0 0 16px ${ACCENT}22` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={startSlot.preview ?? startSlot.url} alt="start" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }} />
                  {/* Action overlay on hover */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.48)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0)"; }}
                  >
                    {/* Replace */}
                    <label style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 5, background: "rgba(14,165,160,0.85)", cursor: "pointer", fontSize: 9, fontWeight: 700, color: "#fff", opacity: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                    >
                      Replace
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setStartSlot({ url, preview: url }); }} />
                    </label>
                    {/* Clear */}
                    <button onClick={() => setStartSlot(EMPTY_SLOT)}
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 5, background: "rgba(239,68,68,0.80)", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 700, color: "#fff", opacity: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "16/9", borderRadius: 7, border: "1px dashed rgba(14,165,160,0.22)", background: "rgba(14,165,160,0.03)", cursor: "pointer", gap: 5, transition: "all 0.18s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.border = `1px dashed ${ACCENT}55`; el.style.background = `rgba(14,165,160,0.08)`; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.border = "1px dashed rgba(14,165,160,0.22)"; el.style.background = "rgba(14,165,160,0.03)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{ fontSize: 9, color: "#2D4060", fontWeight: 600 }}>Upload</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setStartSlot({ url, preview: url }); }} />
                </label>
              )}
            </div>
            {/* End frame */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", marginBottom: 6, letterSpacing: "0.06em" }}>END FRAME</div>
              {endSlot.url ? (
                <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 7, overflow: "hidden", border: "1px solid rgba(245,158,11,0.60)", boxShadow: "0 0 16px rgba(245,158,11,0.22)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={endSlot.preview ?? endSlot.url} alt="end" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }} />
                  {/* Action overlay on hover */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.48)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0)"; }}
                  >
                    {/* Replace */}
                    <label style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 5, background: "rgba(245,158,11,0.85)", cursor: "pointer", fontSize: 9, fontWeight: 700, color: "#fff", opacity: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                    >
                      Replace
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setEndSlot({ url, preview: url }); }} />
                    </label>
                    {/* Clear */}
                    <button onClick={() => setEndSlot(EMPTY_SLOT)}
                      style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 5, background: "rgba(239,68,68,0.80)", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 700, color: "#fff", opacity: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "16/9", borderRadius: 7, border: "1px dashed rgba(245,158,11,0.20)", background: "rgba(245,158,11,0.02)", cursor: "pointer", gap: 5, transition: "all 0.18s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.border = "1px dashed rgba(245,158,11,0.55)"; el.style.background = "rgba(245,158,11,0.07)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.border = "1px dashed rgba(245,158,11,0.20)"; el.style.background = "rgba(245,158,11,0.02)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{ fontSize: 9, color: "#2D4060", fontWeight: 600 }}>Upload</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setEndSlot({ url, preview: url }); }} />
                </label>
              )}
            </div>
          </div>
        </Section>

        {/* Reference Video */}
        <Section label="Motion Reference" color="#818CF8">
          {motionVideoUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.28)", borderRadius: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <span style={{ fontSize: 11, color: "#818CF8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Reference attached</span>
              <button onClick={() => { setMotionVideoUrl(null); setMotionVideoName(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <label
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(99,102,241,0.03)", border: "1px dashed rgba(99,102,241,0.18)", borderRadius: 8, cursor: "pointer", transition: "all 0.18s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.border = "1px dashed rgba(99,102,241,0.50)"; el.style.background = "rgba(99,102,241,0.10)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.border = "1px dashed rgba(99,102,241,0.18)"; el.style.background = "rgba(99,102,241,0.03)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <span style={{ fontSize: 12, color: "#3D5070" }}>Upload motion reference video</span>
              <input type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setMotionVideoUrl(url); setMotionVideoName(f.name); }} />
            </label>
          )}
        </Section>

        {/* Quality */}
        <Section label="Output Quality" color="#F59E0B">
          <div style={{ display: "flex", background: "rgba(0,0,0,0.30)", borderRadius: 8, padding: 3, gap: 2, border: "1px solid rgba(255,255,255,0.05)" }}>
            {([{ label: "Standard", value: "std" as Quality }, { label: "Pro", value: "pro" as Quality }]).map(({ label, value }) => (
              <button key={value} onClick={() => setQuality(value)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 6, border: "none",
                  fontSize: 12, fontWeight: quality === value ? 700 : 500,
                  background: quality === value ? "rgba(245,158,11,0.16)" : "transparent",
                  color: quality === value ? "#F59E0B" : "#334155",
                  cursor: "pointer", transition: "all 0.14s",
                  boxShadow: quality === value ? "0 0 12px rgba(245,158,11,0.18)" : "none",
                }}
              >{label}</button>
            ))}
          </div>
        </Section>

        {/* Audio */}
        <Section label="Audio Mode" color="#64748B">
          <div style={{ display: "flex", gap: 6 }}>
            {([{ label: "No Audio", value: "none" as const }, { label: "Scene Audio", value: "scene" as const }]).map(({ label, value }) => (
              <button key={value} onClick={() => setAudioMode(value)}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 7,
                  fontSize: 12, fontWeight: audioMode === value ? 600 : 500,
                  border: audioMode === value ? `1px solid ${ACCENT}55` : "1px solid rgba(255,255,255,0.07)",
                  background: audioMode === value ? `${ACCENT}15` : "rgba(255,255,255,0.02)",
                  color: audioMode === value ? ACCENT : "#475569",
                  cursor: "pointer", transition: "all 0.14s",
                }}
              >{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#1E293B", marginTop: 8, lineHeight: 1.5 }}>
            Lip sync not available for multi-shot Omni scenes.
          </div>
        </Section>

        {/* Frame Rate — collapsible, default collapsed */}
        <CollapsibleSection sectionKey="frameRate" label="Frame Rate" color="#818CF8">
          <div style={{ display: "flex", background: "rgba(0,0,0,0.30)", borderRadius: 8, padding: 3, gap: 2, border: "1px solid rgba(255,255,255,0.05)" }}>
            {([{ label: "24 fps", value: "24" }, { label: "30 fps", value: "30" }]).map(({ label, value }) => (
              <button key={value}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "none",
                  fontSize: 12, fontWeight: 500,
                  background: "transparent",
                  color: "#334155",
                  cursor: "pointer", transition: "all 0.14s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(129,140,248,0.12)";
                  el.style.color = "#818CF8";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = "#334155";
                }}
              >{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#1E293B", marginTop: 8, lineHeight: 1.5 }}>
            Frame rate control coming in a future Omni update.
          </div>
        </CollapsibleSection>

        {/* Advanced — collapsible placeholder */}
        <CollapsibleSection sectionKey="advanced" label="Advanced" color="#334155">
          <div style={{
            padding: "10px 0 2px",
            fontSize: 11, color: "#334155", lineHeight: 1.6,
            textAlign: "center" as const,
          }}>
            Advanced controls coming soon.
          </div>
        </CollapsibleSection>

      </div>
    </div>
  );
}

// ── Omni: Generate Bar ────────────────────────────────────────────────────────

function OmniGenerateBar({
  shots, prompt, generating, canGenerate, creditEstimate, onGenerate,
}: {
  shots:          OmniShotEntry[];
  prompt:         string;
  generating:     boolean;
  canGenerate:    boolean;
  creditEstimate: number;
  onGenerate:     () => void;
}) {
  const ACCENT    = "#0EA5A0";
  const AMBER     = "#F59E0B";
  const hasPrompt = prompt.trim().length > 0;

  const checks = [
    { label: "Scene prompt",     done: hasPrompt },
    { label: "Shot stack ready", done: shots.length >= 1 },
    { label: "Quality selected", done: true },
  ];

  return (
    <div style={{
      background: [
        "linear-gradient(180deg, rgba(4,8,20,0.92) 0%, rgba(2,5,14,0.97) 100%)",
      ].join(", "),
      borderTop: "1px solid rgba(14,165,160,0.20)",
      padding: "16px 22px",
      display: "flex", alignItems: "center", gap: 18,
      boxShadow: "inset 0 1px 0 rgba(14,165,160,0.06)",
    }}>
      {/* ── Readiness checklist ── */}
      <div style={{ display: "flex", gap: 16, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
              background: c.done ? `${ACCENT}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${c.done ? `${ACCENT}88` : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: c.done ? `0 0 8px ${ACCENT}33` : "none",
              transition: "all 0.2s",
            }}>
              {c.done && (
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none"
                  stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <span style={{
              fontSize: 11, fontWeight: c.done ? 600 : 400,
              color: c.done ? "#64748B" : "#253045",
              letterSpacing: "0.01em",
            }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Credit estimate ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0,
        padding: "6px 14px",
        background: `rgba(245,158,11,0.06)`,
        border: `1px solid rgba(245,158,11,0.18)`,
        borderRadius: 8,
      }}>
        <div style={{
          fontSize: 20, fontWeight: 900, color: AMBER, lineHeight: 1,
          textShadow: `0 0 20px ${AMBER}44`,
        }}>
          {creditEstimate}
        </div>
        <div style={{ fontSize: 9, color: "#92400E", fontWeight: 700, letterSpacing: "0.07em", marginTop: 1 }}>
          CREDITS
        </div>
      </div>

      {/* ── Generate button ── */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        style={{
          padding: "12px 26px", borderRadius: 10, border: "none", flexShrink: 0,
          background: canGenerate
            ? `linear-gradient(135deg, ${ACCENT} 0%, #22D3EE 100%)`
            : "rgba(255,255,255,0.04)",
          color: canGenerate ? "#020C14" : "#253045",
          fontSize: 13, fontWeight: 800,
          cursor: canGenerate ? "pointer" : "default",
          transition: "all 0.22s",
          letterSpacing: "0.02em", whiteSpace: "nowrap",
          boxShadow: canGenerate
            ? `0 0 36px rgba(14,165,160,0.55), 0 0 72px rgba(14,165,160,0.22), 0 0 120px rgba(14,165,160,0.08), 0 4px 18px rgba(0,0,0,0.45)`
            : "none",
          display: "flex", alignItems: "center", gap: 8,
        }}
        onMouseEnter={e => {
          if (!canGenerate) return;
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = `0 0 52px rgba(14,165,160,0.70), 0 0 100px rgba(14,165,160,0.30), 0 0 160px rgba(14,165,160,0.12), 0 4px 22px rgba(0,0,0,0.55)`;
          el.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          if (!canGenerate) return;
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = `0 0 36px rgba(14,165,160,0.55), 0 0 72px rgba(14,165,160,0.22), 0 0 120px rgba(14,165,160,0.08), 0 4px 18px rgba(0,0,0,0.45)`;
          el.style.transform = "none";
        }}
      >
        {generating ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: "omniGenSpin 1s linear infinite" }}>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        )}
        {generating ? "Generating…" : "Generate Omni Scene"}
      </button>
    </div>
  );
}

// ── Coming soon screen ────────────────────────────────────────────────────────

function ComingSoonScreen({ model }: { model: VideoModel }) {
  const accent = modelAccentColor(model);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", width: "100%", aspectRatio: "16 / 9",
      gap: 18, textAlign: "center", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "#1A1A1A",
      boxShadow: [
        "0 0 0 1px rgba(255,255,255,0.06)",
        `0 0 40px ${accent}2E`,
        "0 16px 64px rgba(0,0,0,0.8)",
      ].join(", "),
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        border: `1px solid ${accent}33`,
        background: `${accent}11`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC", marginBottom: 8 }}>
          {model.displayName}
        </div>
        <div style={{ fontSize: 15, color: "#94A3B8", maxWidth: 320, lineHeight: 1.65 }}>
          {model.description}
        </div>
      </div>
      {model.badge && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "4px 14px",
          borderRadius: 20, letterSpacing: "0.06em",
          background: "rgba(245,158,11,0.15)",
          color: "#FCD34D",
          border: "1px solid #F59E0B",
        }}>
          {model.badge}
        </span>
      )}
    </div>
  );
}

// ── Not configured screen (env var absent) ───────────────────────────────────

function NotConfiguredScreen({ model }: { model: VideoModel }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", width: "100%", aspectRatio: "16 / 9",
      gap: 18, textAlign: "center", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "#1A1A1A",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 16px 64px rgba(0,0,0,0.8)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>
          {model.displayName} — Not Configured
        </div>
        <div style={{ fontSize: 14, color: "#64748B", maxWidth: 340, lineHeight: 1.65 }}>
          This model requires a server environment variable that has not been set.
          Add the model&apos;s API ID variable to your{" "}
          <code style={{ color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>.env.local</code>{" "}
          and redeploy.
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 800, padding: "4px 14px",
        borderRadius: 20, letterSpacing: "0.06em",
        background: "rgba(255,255,255,0.05)",
        color: "#475569", border: "1px solid rgba(255,255,255,0.1)",
      }}>
        NOT CONFIGURED
      </span>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ modelName }: { modelName: string }) {
  const crumbStyle: React.CSSProperties = {
    fontSize: 13, color: "#64748B", textDecoration: "none", transition: "color 0.15s",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      paddingBottom: 14, paddingLeft: SIDE_GUTTER,
    }}>
      <a href="/studio" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
      >Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <a href="/studio/video" style={crumbStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
      >Video Studio</a>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="#3A4F62" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>{modelName}</span>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function VideoStudioShell() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user }     = useAuth();

  const defaultModelId = VIDEO_MODEL_REGISTRY.find(m => m.available)?.id ?? VIDEO_MODEL_REGISTRY[0].id;
  // "model" param: catalog ID from VIDEO_MODEL_REGISTRY (e.g. "kling-30").
  // Falls back to defaultModelId if param is missing or doesn't match any registry entry.
  const modelParam = searchParams.get("model") ?? "";
  const resolvedModelId = VIDEO_MODEL_REGISTRY.some(m => m.id === modelParam)
    ? modelParam
    : defaultModelId;
  const [selectedModelId, setSelectedModelId] = useState(resolvedModelId);
  const model = VIDEO_MODEL_REGISTRY.find(m => m.id === selectedModelId) ?? null;

  // Auth gate — opened when non-member tries to generate/download
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // ── Workflow context from URL params ──────────────────────────────────────────
  // Supports "startFrame" (new) and legacy "imageUrl" (backward compat) for the start image.
  // All state is seeded ONCE via useState initial values — user edits are never overwritten.
  const startFrameParam = searchParams.get("startFrame") || searchParams.get("imageUrl") || "";
  const endFrameParam   = searchParams.get("endFrame")   || "";
  const flowParam       = searchParams.get("flow")       || "";
  const fromParam       = searchParams.get("from")       || "";

  // Context metadata carried from the originating studio — stored for telemetry / future use
  const [flowContext] = useState({
    assetId:   searchParams.get("assetId")   || null,
    projectId: searchParams.get("projectId") || null,
    sessionId: searchParams.get("sessionId") || null,
    conceptId: searchParams.get("conceptId") || null,
    from:      fromParam,
    flow:      flowParam,
  });
  void flowContext; // currently consumed by future workflow persistence; avoids lint warning

  // Source badge — shown when arriving from any studio's animate flow
  const fromStudio = fromParam === "image-studio" || fromParam === "creative-director";
  const fromStudioLabel = fromParam === "creative-director"
    ? "Image loaded from Creative Director — ready to animate"
    : "Image loaded from Image Studio — ready to animate";

  // Controls
  // Open in start_frame mode when a start image is provided or flow indicates frame-level use
  const [frameMode,      setFrameMode]      = useState<FrameMode>(
    (startFrameParam || endFrameParam || flowParam === "animate" || flowParam === "start-frame" || flowParam === "end-frame") ? "start_frame" : "text_to_video"
  );
  // Aspect ratio — seed from ?aspectRatio= when arriving from Image Studio / Creative Director.
  // Only accept valid VideoAR values; fall back to 16:9 for anything unknown.
  const VALID_VIDEO_ARS: VideoAR[] = ["16:9", "9:16", "1:1"];
  const arParam = searchParams.get("aspectRatio") ?? "";
  const seedAR: VideoAR = (VALID_VIDEO_ARS as string[]).includes(arParam)
    ? (arParam as VideoAR)
    : "16:9";
  const [aspectRatio,    setAspectRatio]    = useState<VideoAR>(seedAR);
  const [quality,        setQuality]        = useState<Quality>("std");
  const [duration,       setDuration]       = useState<number>(5);
  // Motion preset — prompt-layer cinematic movement instruction.
  // "none" = no motion instruction injected. Any other value appends a direction to the prompt.
  // This is independent of frameMode — works across all modes (text_to_video, start_frame, etc.).
  const [motionPreset,   setMotionPreset]   = useState<string>("none");
  const [motionStrength, setMotionStrength] = useState(50);
  const [motionArea,     setMotionArea]     = useState("full_body");
  const [resolution,     setResolution]     = useState<string>("720p");

  // Canvas slots — pre-fill from URL params (one-time init via useState)
  const [startSlot,       setStartSlot]       = useState<ImageSlot>(
    startFrameParam ? { url: startFrameParam, preview: startFrameParam } : EMPTY_SLOT
  );
  // endFrame: pre-populate the end slot; generation payload already gates endImageUrl
  // via model.capabilities.endFrame — safe to set the slot regardless of selected model
  const [endSlot,         setEndSlot]         = useState<ImageSlot>(
    endFrameParam ? { url: endFrameParam, preview: endFrameParam } : EMPTY_SLOT
  );
  const [audioSlot,       setAudioSlot]       = useState<AudioSlot>(EMPTY_AUDIO);
  const [motionVideoUrl,  setMotionVideoUrl]  = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string | null>(null);

  // Prompt — pre-fill from URL param (works from any studio source)
  // ?handle=amanda → @Amanda  |  ?prompt=... takes precedence when both present
  const [prompt,    setPrompt]    = useState(() => {
    const p = searchParams.get("prompt");
    if (p) return p;
    const h = searchParams.get("handle");
    return h ? `@${h.charAt(0).toUpperCase()}${h.slice(1)}` : "";
  });
  const [negPrompt, setNegPrompt] = useState("");

  // ── Audio mode ────────────────────────────────────────────────────────────────
  // "none"      = silent video (default for all current models)
  // "scene"     = generate with native scene audio (requires model.capabilities.nativeAudio)
  // "voiceover" = add ElevenLabs voiceover after video generation
  const [audioMode, setAudioMode] = useState<"none" | "scene" | "voiceover">("none");

  // ── Zencra Voice Engine — voiceover script ────────────────────────────────────
  // Lifted to Shell so it persists across re-renders and is captured correctly
  // in the handleGenerate closure. Cleared after each voiceover dispatch is NOT
  // desired — user may want to re-use the same script for a retried generation.
  const [voiceoverScript, setVoiceoverScript] = useState("");

  // ── AI Influencer @handle detection ──────────────────────────────────────────
  // Syntactic only — no DB call. Computed here (single source of truth) and
  // passed down to VideoPromptPanel so both badge and start-frame card share it.
  const detectedHandles = useMemo(
    () => [
      ...new Set(
        [...prompt.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{0,30})/g)]
          .map(m => m[1])
          .filter(h => !/^img\d+$/i.test(h) && !/^image\d+$/i.test(h)),
      ),
    ],
    [prompt],
  );

  // Identity start frame — default ON so the feature is immediately useful
  const [useStartFrame, setUseStartFrame] = useState(true);

  // ── Canonical readiness — drives UI disabled state in Start Frame card ────────
  // Also carries avatarUrl for @handle badge rendering.
  // Fetched whenever detected handles change. Prevents a failed generate roundtrip
  // when the influencer hasn't completed identity selection yet.
  const [handleReadiness,  setHandleReadiness]  = useState<Record<string, boolean>>({});
  const [handleAvatarUrls, setHandleAvatarUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (detectedHandles.length === 0) {
      setHandleReadiness({});
      setHandleAvatarUrls({});
      return;
    }
    const token = user?.accessToken;
    if (!token) return;

    const params = new URLSearchParams({ handles: detectedHandles.join(",") });
    fetch(`/api/studio/influencer/readiness?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok
        ? res.json() as Promise<Record<string, { ready: boolean; avatarUrl: string | null }>>
        : Promise.resolve({})
      )
      .then(data => {
        const readiness:  Record<string, boolean>         = {};
        const avatarUrls: Record<string, string | null>   = {};
        for (const [handle, val] of Object.entries(data)) {
          const v = val as { ready: boolean; avatarUrl: string | null };
          readiness[handle]  = v.ready;
          avatarUrls[handle] = v.avatarUrl;
        }
        setHandleReadiness(readiness);
        setHandleAvatarUrls(avatarUrls);
      })
      .catch(() => { /* non-critical — leave existing readiness state */ });
  }, [detectedHandles, user?.accessToken]);

  // Generation (Kling/video)
  const [generating,      setGenerating]      = useState(false);
  const [videos,          setVideos]          = useState<GeneratedVideo[]>([]);
  // Canvas preview — tracks the ID of the video currently shown in the main canvas overlay.
  // Derived: canvasPreviewVideo = videos.find(v => v.id === canvasPreviewId) ?? null
  const [canvasPreviewId, setCanvasPreviewId] = useState<string | null>(null);
  const canvasPreviewVideo = canvasPreviewId
    ? (videos.find(v => v.id === canvasPreviewId) ?? null)
    : null;

  // ── Creative Flow store ──────────────────────────────────────────────────────
  const flowStore = useFlowStore();

  const recordFlowStep = useCallback(async (params: {
    modelKey:    string;
    prompt:      string;
    resultUrl:   string;
    aspectRatio?: string;
  }) => {
    if (!user) return;
    try {
      let wfId = useFlowStore.getState().workflowId;
      if (!wfId) {
        const wfResult = await createWorkflow(user.id);
        if (!wfResult.ok) return;
        wfId = wfResult.workflowId;
        flowStore.initWorkflow(wfId);
      }
      const stepResult = await addWorkflowStep({
        workflowId:  wfId,
        userId:      user.id,
        studioType:  "video",
        modelKey:    params.modelKey,
        prompt:      params.prompt,
        aspectRatio: params.aspectRatio,
        resultUrl:   params.resultUrl,
        status:      "success",
      });
      if (stepResult.ok) flowStore.pushStep(stepResult.step);
    } catch {
      // Non-critical
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Scroll to top on mount (prevents browser scroll restoration mis-position) ─
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  // ── Auth token for Lip Sync + polling ─────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | null>(null);
  // Ref mirrors authToken — passed as a `getToken` callback to startPolling()
  // so every poll reads the live JWT instead of a stale closure capture.
  const authTokenRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  // Keep ref in sync so getToken callbacks always read the freshest token
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // ── Gallery history — load all user's video assets from DB on mount ──────────
  // Fires once when authToken becomes available. Maps DB assets to GeneratedVideo[]
  // and merges into gallery state. Live-generated videos added during the session
  // are prepended by handleGenerate / handleShotCompleted; deduplication prevents
  // duplicates if they arrived before this fetch returns.
  //
  // Safety guarantees:
  //   • NEVER overwrites existing state with empty data (guard on line 863)
  //   • Merge is additive — never drops session videos (existingIds dedup)
  //   • Retries up to 2× on auth/network failure (1-second delay between retries)
  //   • "pending" DB assets (tab closed mid-generation) are shown as "generating"
  //     so the user sees the card rather than having it silently disappear
  //   • audio_detected from DB is mapped so AudioBadge survives page refreshes
  // ── Gallery history — stable refreshVideoHistory callback ───────────────────
  //
  // Design guarantees:
  //   • NEVER overwrites existing state with empty data (guard on empty response)
  //   • Merge is additive — never drops session videos (existingIds dedup)
  //   • Retries up to 2× on auth/network failure (1-second delay between retries)
  //   • "pending" DB assets (tab closed mid-generation) shown as "generating"
  //   • audio_detected from DB mapped so AudioBadge survives page refreshes
  //   • localStorage per-user cache: hydrates immediately on mount, written on each
  //     successful server fetch so gallery is never empty on tab re-open
  //   • Rehydrates on visibilitychange / window focus / pageshow (bfcache)
  //   • Called after each polling completion so the gallery reflects the final state
  const mapHistoryAsset = useCallback((a: HistoryAsset): GeneratedVideo => ({
    id:            a.id,
    url:           a.url ?? null,
    thumbnailUrl:  null,
    prompt:        a.prompt ?? "",
    negPrompt:     "",
    modelId:       a.model_key,
    modelName:     VIDEO_MODEL_REGISTRY.find(m => m.id === a.model_key)?.displayName ?? a.model_key,
    duration:      5,
    aspectRatio:   (a.aspect_ratio ?? "16:9") as VideoAR,
    frameMode:     "text_to_video" as const,
    // DB status mapping:
    //   "failed"  → "error"      (show error card)
    //   "pending" → "generating" (tab closed mid-generation — show spinner)
    //   anything else ("ready")  → "done"
    status:        a.status === "failed"
                     ? "error" as const
                     : a.status === "pending"
                     ? "generating" as const
                     : "done" as const,
    error:         a.error_message ?? undefined,
    provider:      a.provider ?? undefined,
    creditsUsed:   a.credits_cost ?? 0,
    createdAt:     new Date(a.created_at).getTime(),
    isPublic:      a.visibility === "public",
    is_favorite:   a.is_favorite ?? false,
    // Audio detection persisted by mirrorVideoToStorage (migration 046).
    // All video history defaults to audioMode="scene" (voiceover is session-only).
    audioMode:     "scene" as const,
    audioDetected: a.audio_detected ?? null,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshVideoHistory = useCallback(async (attempt = 1): Promise<void> => {
    if (!authToken) return;
    const cacheKey = `zencra_video_history_${user?.id ?? "anon"}`;
    try {
      const res = await fetch("/api/assets?studio=video&limit=100&include_failed=true", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000));
          return refreshVideoHistory(attempt + 1);
        }
        console.warn(`[VideoStudio] history fetch failed after ${attempt} attempts: HTTP ${res.status}`);
        return;
      }
      const json = await res.json() as { success: boolean; data?: HistoryAsset[] };
      // GUARD: never overwrite existing state with empty response
      if (!json.success || !json.data?.length) {
        console.log(`[VideoStudio] history fetch returned 0 assets (attempt ${attempt})`);
        return;
      }
      console.log(`[VideoStudio] history fetch returned ${json.data.length} assets`);
      const historyVideos: GeneratedVideo[] = json.data.map(mapHistoryAsset);

      // Write to localStorage cache (per user) so next mount is instant
      try {
        localStorage.setItem(cacheKey, JSON.stringify(historyVideos));
      } catch { /* ignore — storage full or private browsing */ }

      // MERGE: keep all session-generated videos, append history entries not already present
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const newHistory  = historyVideos.filter(v => !existingIds.has(v.id));
        return newHistory.length > 0 ? [...prev, ...newHistory] : prev;
      });
    } catch (err) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000));
        return refreshVideoHistory(attempt + 1);
      }
      console.warn("[VideoStudio] history fetch threw after max retries:", err);
    }
  }, [authToken, user?.id, mapHistoryAsset]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hydrate from localStorage cache immediately on mount (per user) ──────────
  useEffect(() => {
    if (!user?.id) return;
    const cacheKey = `zencra_video_history_${user.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedVideos = JSON.parse(cached) as GeneratedVideo[];
        if (cachedVideos.length > 0) {
          console.log(`[VideoStudio] hydrating ${cachedVideos.length} videos from localStorage cache`);
          setVideos(prev => {
            const existingIds  = new Set(prev.map(v => v.id));
            const newFromCache = cachedVideos.filter(v => !existingIds.has(v.id));
            return newFromCache.length > 0 ? [...prev, ...newFromCache] : prev;
          });
        }
      }
    } catch { /* ignore — JSON parse error or SSR guard */ }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial server fetch on auth ready ────────────────────────────────────
  useEffect(() => {
    if (!authToken) return;
    void refreshVideoHistory();
  }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rehydration listeners — re-fetch when user returns to tab ─────────────
  // Covers: alt-tab back, cmd-tab, browser back via bfcache, screen lock/wake.
  useEffect(() => {
    if (!authToken) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[VideoStudio] tab visible — rehydrating gallery");
        void refreshVideoHistory();
      }
    };
    const handleFocus = () => {
      console.log("[VideoStudio] window focus — rehydrating gallery");
      void refreshVideoHistory();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log("[VideoStudio] pageshow bfcache — rehydrating gallery");
        void refreshVideoHistory();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [authToken, refreshVideoHistory]);

  // ── Recovered job completion bridge ──────────────────────────────────────────
  // When the global job-recovery engine completes a video job (after a page refresh,
  // tab reopen, etc.), it dispatches a DOM CustomEvent so this studio shell can:
  //   1. Update the video in the gallery from "generating" → "done" with the URL
  //   2. Set the canvas preview to the just-completed video
  //   3. Trigger a full history refresh to sync gallery metadata (favs, etc.)
  useEffect(() => {
    const handleJobComplete = (e: Event) => {
      const detail = (e as CustomEvent<{
        jobId:         string;
        assetId:       string;
        studio:        string;
        url:           string;
        audioDetected: boolean | null;
      }>).detail;

      if (detail.studio !== "video") return;
      console.log("[VideoStudio] recovered job complete — assetId=%s url=%s", detail.assetId, detail.url);

      // Instantly update the gallery entry from "generating" → "done"
      setVideos(prev => prev.map(v =>
        v.id === detail.assetId
          ? { ...v, status: "done" as const, url: detail.url, audioDetected: detail.audioDetected }
          : v
      ));

      // Show the completed video in the canvas preview
      setCanvasPreviewId(detail.assetId);

      // Full refresh to pick up authoritative server state (aspect ratio, is_favorite, etc.)
      void refreshVideoHistory();
    };

    window.addEventListener("zencra:job:complete", handleJobComplete);
    return () => window.removeEventListener("zencra:job:complete", handleJobComplete);
  }, [refreshVideoHistory]);

  // ── Omni Cinematic Director Mode ──────────────────────────────────────────
  const isOmni = selectedModelId === "kling-30-omni";

  const [omniShots, setOmniShots] = useState<OmniShotEntry[]>(() => [{
    id:          Math.random().toString(36).slice(2),
    prompt:      "",
    duration:    5,
    composition: "Wide",
  }]);
  const handleOmniAddShot = useCallback(() => {
    setOmniShots(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      prompt: "",
      duration: 5,
      composition: "Wide",
    }]);
  }, []);
  const handleOmniUpdateShot = useCallback((id: string, patch: Partial<OmniShotEntry>) => {
    setOmniShots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);
  const handleOmniRemoveShot = useCallback((id: string) => {
    setOmniShots(prev => prev.filter(s => s.id !== id));
  }, []);
  const handleOmniStoryboardPrompt = useCallback(() => {
    setPrompt("A lone explorer discovers an ancient temple in a misty jungle — wide establishing shot, close-up of discovery, dramatic reveal with golden light streaming through the canopy");
  }, [setPrompt]);

  // Hidden file input refs for Omni CTA buttons
  const omniRefImageInputRef = useRef<HTMLInputElement>(null);
  const omniRefVideoInputRef = useRef<HTMLInputElement>(null);

  // ── Sequence mode — cinematic shot stack ──────────────────────────────────
  const [sequenceMode, setSequenceMode] = useState(false);

  // Ref always reflects the latest generation params so the gallery callback
  // can build a GeneratedVideo without closing over stale state.
  const seqGenParamsRef = useRef({ modelId: selectedModelId, modelName: model?.displayName ?? selectedModelId, aspectRatio, duration });
  seqGenParamsRef.current = { modelId: selectedModelId, modelName: model?.displayName ?? selectedModelId, aspectRatio, duration };

  // Called by useSequenceState when a shot finishes — appends to gallery + shows canvas preview
  const handleShotCompleted = useCallback((assetId: string, url: string, prompt: string) => {
    const p = seqGenParamsRef.current;
    const newVideo: GeneratedVideo = {
      id:           assetId,
      url,
      thumbnailUrl: null,
      prompt,
      negPrompt:    "",
      modelId:      p.modelId,
      modelName:    p.modelName,
      duration:     p.duration,
      aspectRatio:  p.aspectRatio,
      frameMode:    "text_to_video",
      status:       "done",
      creditsUsed:  0,
      createdAt:    Date.now(),
      isPublic:     false,
      is_favorite:  false,
    };
    setVideos(prev => [newVideo, ...prev]);
    // Show the completed shot in the canvas preview (Part 5 — sequence support)
    setCanvasPreviewId(assetId);
  }, []);

  const { state: seqState, actions: seqActions } = useSequenceState(authToken, handleShotCompleted);
  // Capability gate — only Kling 3.0 and 3.0 Omni carry supportsSequence: true
  const modelSupportsSequence = !!(model?.supportsSequence);

  // ── Lip Sync hook ──────────────────────────────────────────────────────────
  const {
    state:          lipSyncState,
    setQualityMode: setLipSyncQuality,
    uploadFace:     lipSyncUploadFace,
    uploadAudio:    lipSyncUploadAudio,
    create:         lipSyncCreate,
    retry:          lipSyncRetry,
    reset:          lipSyncReset,
  } = useLipSync(authToken);

  const handleLipSyncFaceFile = useCallback((file: File, previewUrl: string) => {
    lipSyncUploadFace(file, previewUrl);
  }, [lipSyncUploadFace]);

  // ── Cinematic prompt bank ─────────────────────────────────────────────────
  const CINEMATIC_PROMPTS = [
    "A lone astronaut floats above a glowing Earth at golden hour, slow cinematic drift, lens flare, IMAX quality",
    "Aerial shot of a neon-lit cyberpunk city at night, rain-soaked streets reflecting orange and blue light, filmic grain",
    "A vintage steam train cuts through a misty mountain valley at dawn, slow motion smoke trails, 8K cinematic",
    "Close-up of a dancer's hands moving through falling cherry blossoms in slow motion, shallow depth of field",
    "Timelapse of storm clouds rolling over a vast desert landscape, dramatic crepuscular rays, golden hour colors",
    "A lighthouse beam sweeps across dark ocean waves at night, bioluminescent foam, Terrence Malick style",
    "Macro shot of raindrops falling on a forest floor in slow motion, emerald greens, anamorphic bokeh",
    "A samurai stands at the edge of a cliff overlooking misty mountains, wind moving through tall grass, epic wide shot",
  ] as const;

  const samplePromptIndexRef  = useRef(0);
  // Auto-scroll to gallery on generate
  const videoResultsRef  = useRef<HTMLDivElement>(null);
  // Card-level scroll targeting — keyed by video id
  const videoCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [videoGlow,  setVideoGlow]  = useState(false);
  // Fullscreen video preview
  const [viewingVideo, setViewingVideo] = useState<GeneratedVideo | null>(null);
  const [mascotSamplePrompt, setMascotSamplePrompt] = useState<string | undefined>(undefined);
  // Preview key — hovered model family drives the empty canvas showcase
  const [hoveredModelPreviewKey, setHoveredModelPreviewKey] = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastState, setToastState] = useState<{ msg: string; variant: "success" | "error" | "info" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, variant: "success" | "error" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState({ msg, variant });
    toastTimerRef.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  // ── Auto-exit Sequence Mode when switching to an unsupported model ─────────
  // Only reacts to model changes — sequenceMode/modelSupportsSequence intentionally
  // omitted from deps to avoid firing on every Sequence toggle.
  // clearSequence() also cancels all active poll timers — prevents stale shot state
  // if the user switches away mid-sequence and returns later.
  useEffect(() => {
    if (sequenceMode && !modelSupportsSequence) {
      setSequenceMode(false);
      seqActions.clearSequence();
      showToast("Sequence Mode is only available for Kling 3.0 models", "info");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  // Pre-compute variant styles outside JSX (avoids recalculation every render)
  const TOAST_VARIANT_STYLES = useMemo(() => ({
    success: { border: "rgba(16,185,129,0.45)", bg: "rgba(16,185,129,0.10)", dot: "#34D399" },
    error:   { border: "rgba(239,68,68,0.45)",  bg: "rgba(239,68,68,0.10)",  dot: "#FCA5A5" },
    info:    { border: "rgba(37,99,235,0.35)",  bg: "rgba(37,99,235,0.10)",  dot: "#60A5FA" },
  }), []);

  const handleSamplePrompt = useCallback(() => {
    const idx = samplePromptIndexRef.current % CINEMATIC_PROMPTS.length;
    const nextPrompt = CINEMATIC_PROMPTS[idx];
    samplePromptIndexRef.current += 1;
    setMascotSamplePrompt(nextPrompt);
    setPrompt(nextPrompt);
  }, [setPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMascotUpload = useCallback((_file: File, _previewUrl: string) => {
    // File is already set in onStartSlot by VideoCanvas — switch to Start Frame (Image Reference) mode
    setFrameMode("start_frame");
  }, []);

  const handleLipSyncAudioFile = useCallback((file: File, durationSeconds: number) => {
    lipSyncUploadAudio(file, durationSeconds);
  }, [lipSyncUploadAudio]);

  // Reset mode/duration/AR when switching models
  useEffect(() => {
    if (!model) return;
    const caps = model.capabilities;
    const allowed: Record<FrameMode, boolean> = {
      text_to_video:  caps.textToVideo,
      // start_frame = Image Reference mode. End Frame zone shows conditionally inside the canvas
      // when model.capabilities.endFrame is true. No separate start_end mode.
      start_frame:    caps.startFrame,
      extend:         caps.extendVideo,
      // Lip Sync only allowed on kling-lip-sync model (capabilities.lipSync = true).
      // All normal Kling models have lipSync: false — this removes Lip Sync from their mode list.
      lip_sync:       caps.lipSync,
      motion_control: caps.motionControl,
    };
    if (!allowed[frameMode]) {
      // Auto-select the first mode the new model actually supports.
      // This ensures kling-lip-sync (lipSync-only) jumps directly to lip_sync
      // instead of incorrectly defaulting to text_to_video.
      const modeOrder: FrameMode[] = ["text_to_video", "start_frame", "extend", "lip_sync", "motion_control"];
      const firstAllowed = modeOrder.find(m => allowed[m]);
      setFrameMode(firstAllowed ?? "text_to_video");
    }
    if (!caps.durations.includes(duration))       setDuration(caps.durations[0] ?? 5);
    if (!caps.aspectRatios.includes(aspectRatio)) setAspectRatio((caps.aspectRatios[0] ?? "16:9") as VideoAR);
    // Reset resolution to first supported value when switching models
    if (caps.resolutions && caps.resolutions.length > 0 && !caps.resolutions.includes(resolution)) {
      setResolution(caps.resolutions[0]);
    }
    // Reset motionPreset if the new model doesn't support the current preset.
    // getMotionPresetsForModel returns [] for unavailable models, full list for Kling 3.0/Omni,
    // and the limited set for Kling 2.6/2.5 and all Seedance models.
    const supportedPresets = getMotionPresetsForModel(model);
    if (motionPreset !== "none" && !supportedPresets.includes(motionPreset)) {
      setMotionPreset("none");
      showToast("Motion preset reset — not supported for this model", "info");
    }
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate — routes to Lip Sync or Kling
  function isElementMostlyVisible(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 80 && rect.bottom <= window.innerHeight - 120;
  }

  const handleGenerate = useCallback(async () => {
    // Auth gate — non-members see sign-up modal, no API call is made
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (frameMode === "lip_sync") {
      lipSyncCreate(aspectRatio);
      return;
    }

    if (!model || generating) return;

    // No silent fallback — model.id maps 1:1 to backend modelKey
    if (!model.id) {
      console.error("[VideoStudio] model.id is missing — generation aborted.");
      return;
    }

    setGenerating(true);
    setVideoGlow(true);
    setTimeout(() => setVideoGlow(false), 700);

    const newVideo: GeneratedVideo = {
      id: crypto.randomUUID(),
      url: null, thumbnailUrl: null,
      prompt, negPrompt,
      modelId: model.id, modelName: model.displayName,
      duration, aspectRatio, frameMode,
      // Store audio mode so canvas badge and future components know what was requested
      audioMode,
      status: "generating",
      provider: model.provider,
      creditsUsed: estimateCredits(model.id, quality, duration),
      createdAt: Date.now(),
      isPublic: false,
      is_favorite: false,
    };
    setVideos(prev => [newVideo, ...prev]);
    // Show the canvas preview immediately — no page scroll
    setCanvasPreviewId(newVideo.id);

    try {
      // Model key — always use the registry model ID directly.
      // No per-mode overrides: motion_control frameMode (reference video) routes through
      // the same provider pipeline as the selected model. The motionControl prompt layer
      // (cinematic presets) is a separate mechanism sent as a body field, not a model switch.
      const modelKey = model.id;

      const sceneAudioRequested = audioMode === "scene" && model.capabilities.nativeAudio;
      console.log("[VideoStudio] dispatch", { modelKey, prompt, aspectRatio, durationSeconds: duration, audioMode, sceneAudioRequested });

      // When arriving via Animate Start/End Frame the prompt may be empty.
      // Supply a cinematic default so the server validator (min 3 chars) passes.
      const effectivePrompt =
        prompt.trim().length > 0
          ? prompt
          : (frameMode === "start_frame" && (startSlot.url || endSlot.url))
            ? "Animate this image"
            : prompt;

      const body: Record<string, unknown> = {
        modelKey,
        prompt: effectivePrompt,
        negativePrompt:  negPrompt || undefined,
        durationSeconds: duration,
        aspectRatio,
        providerParams: {
          videoMode: quality,
          ...(resolution ? { resolution } : {}),
          // Scene Audio — native cinematic ambience/audio from the model.
          // Only forwarded when the user selected "scene" mode AND the selected model
          // declares nativeAudio capability. Translated to provider-specific field in kling.ts.
          ...(audioMode === "scene" && model.capabilities.nativeAudio ? { nativeAudio: true } : {}),
        },
      };

      // Motion Control — prompt-layer cinematic direction.
      // preset: unified key (e.g. "cinematic_push", "orbit_left") — no translation layer.
      // intensity: defaults to "medium"; future UI will expose low/medium/high.
      // Backend appends cinematography direction + intensity hint to resolvedPrompt.
      // Identity-safe and aggressive-motion guard rules applied server-side when @handle present.
      if (motionPreset !== "none") {
        body.motionControl = { preset: motionPreset, intensity: "medium" };
      }

      // start_frame = Image Reference. imageUrl = start frame; endImageUrl = end frame.
      if (frameMode === "start_frame" && startSlot.url)                              body.imageUrl    = startSlot.url;
      // End frame: only send when model supports it.
      // If @handle is present, Start Frame must be ON — otherwise identity drift is likely.
      // No handle → generic video → no dependency restriction.
      if (frameMode === "start_frame" && endSlot.url && model.capabilities.endFrame) {
        const endFrameAllowed = detectedHandles.length === 0 || useStartFrame;
        if (endFrameAllowed) body.endImageUrl = endSlot.url;
      }

      // motion_control: referenceVideoUrl = motion reference video; imageUrl = subject image
      if (frameMode === "motion_control" && motionVideoUrl) body.referenceVideoUrl = motionVideoUrl;
      if (frameMode === "motion_control" && startSlot.url)  body.imageUrl          = startSlot.url;

      // Identity start frame — signal backend to attach canonical hero as imageUrl.
      // Gate: flag ON + handle detected + model supports startFrame + no user image or motion ref.
      // Note: readiness is NOT gated here — the UI blocks generation before this runs
      // when the frontend knows canonical is missing. The backend 400 is the final authority.
      if (
        useStartFrame &&
        detectedHandles.length > 0 &&
        model.capabilities.startFrame &&
        !startSlot.url &&
        !motionVideoUrl
      ) {
        body.useIdentityStartFrame = true;
      }

      // ── Pre-dispatch safety check: verify displayed cost matches live DB cost ──
      {
        const displayedCost = getGenerationCreditCost(model.id, { durationSeconds: duration });
        try {
          const costsRes = await fetch("/api/credits/model-costs", {
            headers: { "Authorization": `Bearer ${authToken ?? ""}` },
          });
          if (costsRes.ok) {
            const costsData = await costsRes.json();
            const liveCost: number | undefined = costsData?.data?.[model.id];
            if (liveCost !== undefined && displayedCost !== null && liveCost !== displayedCost) {
              showToast("Credit estimate changed. Please refresh and try again.", "error");
              setGenerating(false);
              setVideos(prev => prev.filter(v => v.id !== newVideo.id));
              return;
            }
          }
        } catch {
          // Non-fatal: if the safety check fails, allow generation to proceed
        }
      }

      const res = await fetch("/api/studio/video/generate", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errMsg = `API error: ${res.status}`;
        let errCode: string | undefined;
        try { const e = await res.json(); if (e.error) errMsg = e.error; if (e.code) errCode = e.code; } catch { /* ignore */ }

        // ── Free-tier limit reached — redirect to pricing ─────────────────────
        if (errCode === "FREE_LIMIT_REACHED") {
          router.push("/pricing");
          setGenerating(false);
          return;
        }

        // ── Kling model account gate — friendly surface ───────────────────────
        // When Kling returns code 1201 ("model is not supported"), the provider
        // throws a specific message. Route converts this to PROVIDER_ERROR 502.
        // Surface a dedicated toast so the user knows what to fix.
        if (errMsg.includes("is not enabled for this API account")) {
          showToast(
            `${model?.displayName ?? "This model"} is not enabled for this API account. ` +
            "Enable model access in your Kling console resource packs, then retry.",
            "error"
          );
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id
              ? { ...v, status: "error" as const, error: "Model not enabled for this account" }
              : v,
          ));
          setGenerating(false);
          return;
        }
        // ── Image source error — blob: URL or corrupt encoding ────────────────
        // Thrown by normalizeKlingImageInput() when the image cannot be resolved
        // server-side (e.g. the frontend sent a blob: URL instead of a data URL).
        if (
          errMsg.includes("Invalid image source") ||
          errMsg.includes("Image input error") ||
          errMsg.includes("End frame image input error") ||
          errMsg.includes("blob:")
        ) {
          showToast(
            "Image could not be processed. Try re-uploading or use a different image.",
            "error"
          );
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id
              ? { ...v, status: "error" as const, error: "Image could not be processed — try re-uploading" }
              : v,
          ));
          setGenerating(false);
          return;
        }
        throw new Error(errMsg);
      }

      // All video generation is async — route always returns 202 + jobId, never a direct URL
      const resData = await res.json() as { data?: { jobId?: string; assetId?: string; status?: string } };
      const jobId   = resData.data?.jobId;

      if (!jobId) {
        throw new Error("Video generation accepted but no jobId returned — cannot poll for result.");
      }

      setVideos(prev => prev.map(v =>
        v.id === newVideo.id ? { ...v, status: "polling", taskId: jobId } : v,
      ));

      // ── Register in the global job store (cross-tab recovery + drawer) ────────
      const jobStore     = getPendingJobStoreState();
      const jobCreatedAt = new Date().toISOString();
      jobStore.registerJob({
        jobId,
        assetId:    resData.data?.assetId ?? jobId,
        studio:     "video",
        modelKey,
        modelLabel: model.displayName,
        prompt:     effectivePrompt.slice(0, 120),
        status:     "queued",
        creditCost: getGenerationCreditCost(modelKey, { durationSeconds: duration }) ?? undefined,
        createdAt:  jobCreatedAt,
        parentJobId: null,
        childJobIds: [],
      });

      // Scene Audio adaptive fallback — captured at dispatch time for the onError callback.
      // Sound generation is unstable / account-gated. If the job goes stale, retry
      // without sound_generation so the user always gets a video.
      const sceneAudioActive = audioMode === "scene" && model.capabilities.nativeAudio;

      startUniversalPolling({
        jobId,
        studio:    "video",
        getToken:  () => authTokenRef.current,
        createdAt: jobCreatedAt,

        onUpdate: (update) => {
          jobStore.updateJob(jobId, {
            status: update.status,
            url:    update.url,
            error:  update.error,
          });
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id ? { ...v, status: "polling" as const } : v,
          ));
        },

        onComplete: (update) => {
          const url           = update.url ?? "";
          const audioDetected = update.audioDetected ?? null;

          // ── Derive audioSource from server detection ────────────────────────
          // audioDetected comes from the server-side MP4 binary scanner run
          // at mirror time — authoritative, zero cross-browser issues.
          // Precedence: voiceover pipeline > scene audio detection > none.
          //
          // For scene audio:
          //   true  → "scene"  (audio confirmed)
          //   false → "none"   (no audio confirmed)
          //   null  → "none"   (detection inconclusive — treat as unavailable)
          let audioSource: "scene" | "voiceover" | "none" | "unknown" = "none";
          if (audioMode === "voiceover") {
            audioSource = "voiceover"; // pipeline fires below; set optimistically
          } else if (audioMode === "scene") {
            audioSource = audioDetected === true ? "scene" : "none";
          }

          console.log(
            "[VideoStudio] poll success — audioDetected=%s audioSource=%s sceneAudioActive=%s",
            audioDetected, audioSource, sceneAudioActive
          );

          setVideos(prev => prev.map(v =>
            v.id === newVideo.id
              ? { ...v, status: "done", url, thumbnailUrl: null, audioDetected, audioSource }
              : v,
          ));

          jobStore.completeJob(jobId, url, update.audioDetected ?? undefined);

          // ── Zencra Voice Engine — fire voiceover after video success ────────
          // Fire-and-forget: voiceover failure must NOT fail or block the video.
          if (audioMode === "voiceover" && voiceoverScript.trim()) {
            const videoId      = newVideo.id;
            const scriptToSend = voiceoverScript.trim();

            setVideos(prev => prev.map(v =>
              v.id === videoId
                ? { ...v, voiceoverStatus: "generating" as const, voiceoverScript: scriptToSend }
                : v,
            ));

            void (async () => {
              try {
                const voRes = await fetch("/api/studio/audio/generate", {
                  method:  "POST",
                  headers: {
                    "Content-Type":  "application/json",
                    "Authorization": `Bearer ${user.accessToken}`,
                  },
                  body: JSON.stringify({ modelKey: "elevenlabs", prompt: scriptToSend }),
                });

                if (voRes.ok) {
                  const voData = await voRes.json() as { data?: { url?: string } };
                  const voUrl  = voData.data?.url ?? null;
                  setVideos(prev => prev.map(v =>
                    v.id === videoId
                      ? { ...v, voiceoverStatus: "ready" as const, voiceoverUrl: voUrl }
                      : v,
                  ));
                } else {
                  console.warn("[VideoStudio] Voiceover generation failed:", voRes.status);
                  setVideos(prev => prev.map(v =>
                    v.id === videoId ? { ...v, voiceoverStatus: "error" as const } : v,
                  ));
                }
              } catch (voErr) {
                console.warn("[VideoStudio] Voiceover dispatch error:", voErr);
                setVideos(prev => prev.map(v =>
                  v.id === videoId ? { ...v, voiceoverStatus: "error" as const } : v,
                ));
              }
            })();
          }
          // ── End voiceover dispatch ────────────────────────────────────────

          void recordFlowStep({ modelKey, prompt, resultUrl: url, aspectRatio });
          setGenerating(false);
          void refreshVideoHistory();
        },

        onError: (update) => {
          // ── Scene Audio adaptive fallback ──────────────────────────────────
          // If Scene Audio job goes stale, retry without sound_generation.
          if (sceneAudioActive && update.status === "stale") {
            console.warn("[VideoStudio] Scene Audio timed out — retrying without sound_generation");
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id ? { ...v, status: "generating" as const } : v,
            ));

            void (async () => {
              try {
                const fallbackBody = {
                  ...body,
                  providerParams: {
                    ...(body.providerParams as Record<string, unknown>),
                    nativeAudio: false,
                  },
                };
                const fbRes = await fetch("/api/studio/video/generate", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
                  body:    JSON.stringify(fallbackBody),
                });
                if (!fbRes.ok) throw new Error(`Scene Audio fallback dispatch failed: ${fbRes.status}`);
                const fbData  = await fbRes.json() as { data?: { jobId?: string; assetId?: string } };
                const fbJobId = fbData.data?.jobId;
                if (!fbJobId) throw new Error("No jobId returned from Scene Audio fallback dispatch");

                setVideos(prev => prev.map(v =>
                  v.id === newVideo.id ? { ...v, status: "polling" as const, taskId: fbJobId } : v,
                ));

                const fbCreatedAt = new Date().toISOString();
                jobStore.registerJob({
                  jobId:      fbJobId,
                  assetId:    fbData.data?.assetId ?? fbJobId,
                  studio:     "video",
                  modelKey,
                  modelLabel: model.displayName,
                  prompt:     effectivePrompt.slice(0, 120),
                  status:     "queued",
                  creditCost: getGenerationCreditCost(modelKey, { durationSeconds: duration }) ?? undefined,
                  createdAt:  fbCreatedAt,
                  parentJobId: null,
                  childJobIds: [],
                });

                startUniversalPolling({
                  jobId:     fbJobId,
                  studio:    "video",
                  getToken:  () => authTokenRef.current,
                  createdAt: fbCreatedAt,

                  onUpdate: (fbUpdate) => {
                    jobStore.updateJob(fbJobId, {
                      status: fbUpdate.status,
                      url:    fbUpdate.url,
                      error:  fbUpdate.error,
                    });
                  },

                  onComplete: (fbUpdate) => {
                    const fbUrl = fbUpdate.url ?? "";
                    setVideos(prev => prev.map(v =>
                      v.id === newVideo.id
                        ? { ...v, status: "done" as const, url: fbUrl, thumbnailUrl: null, sceneAudioFallback: true }
                        : v,
                    ));
                    showToast("Video generated — Scene Audio was unavailable for this run", "info");
                    jobStore.completeJob(fbJobId, fbUrl, undefined);
                    void recordFlowStep({ modelKey, prompt, resultUrl: fbUrl, aspectRatio });
                    setGenerating(false);
                    void refreshVideoHistory();
                  },

                  onError: (fbUpdate) => {
                    const fbErrMsg = fbUpdate.error ?? "Generation failed";
                    setVideos(prev => prev.map(v =>
                      v.id === newVideo.id ? { ...v, status: "error" as const, error: fbErrMsg } : v,
                    ));
                    showToast("Generation timed out — please try again", "error");
                    jobStore.failJob(
                      fbJobId,
                      fbUpdate.status === "stale"     ? "stale"     :
                      fbUpdate.status === "refunded"  ? "refunded"  :
                      fbUpdate.status === "cancelled" ? "cancelled" : "failed",
                      fbErrMsg,
                    );
                    setGenerating(false);
                  },
                });
              } catch (fbErr) {
                console.warn("[VideoStudio] Scene Audio fallback dispatch error:", fbErr);
                setVideos(prev => prev.map(v =>
                  v.id === newVideo.id ? { ...v, status: "error" as const, error: "Timed out" } : v,
                ));
                showToast("Generation timed out — please try again", "error");
                setGenerating(false);
              }
            })();
            return;
          }
          // ── End Scene Audio fallback ─────────────────────────────────────────

          // Normal terminal failure
          const terminalStatus =
            update.status === "refunded"  ? "refunded"  as const :
            update.status === "cancelled" ? "cancelled" as const :
            update.status === "stale"     ? "stale"     as const :
            "failed" as const;
          const errMsg = update.error ?? "Generation failed";
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id ? { ...v, status: "error", error: errMsg } : v,
          ));
          showToast("Generation failed — please try again", "error");
          jobStore.failJob(jobId, terminalStatus, errMsg);
          setGenerating(false);
        },
      });
    } catch (err) {
      setVideos(prev => prev.map(v =>
        v.id === newVideo.id ? { ...v, status: "error", error: String(err) } : v,
      ));
      showToast("Generation failed — please try again", "error");
      setGenerating(false);
    }
  }, [
    user, frameMode, model, generating, prompt, negPrompt, duration, aspectRatio,
    quality, resolution, motionPreset, startSlot, endSlot, motionVideoUrl,
    motionStrength, motionArea, lipSyncCreate, recordFlowStep, showToast,
    useStartFrame, detectedHandles, audioMode, voiceoverScript, refreshVideoHistory,
  ]);


  const handleReusePrompt = useCallback((video: GeneratedVideo) => {
    setPrompt(video.prompt ?? "");
    setNegPrompt(video.negPrompt ?? "");
  }, []);

  // Retry a failed video — restores prompt + model + AR then fires generation
  const handleRetry = useCallback((video: GeneratedVideo) => {
    setPrompt(video.prompt ?? "");
    setNegPrompt(video.negPrompt ?? "");
    if (video.modelId) setSelectedModelId(video.modelId);
    if (video.aspectRatio) setAspectRatio(video.aspectRatio as VideoAR);
    // Scroll to top of page so the user sees the canvas start generating
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Use a short defer so state updates settle before generation kicks off
    setTimeout(() => handleGenerate(), 120);
  }, [handleGenerate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gallery card favourite toggle — optimistic update + PATCH
  const handleGalleryFavToggle = useCallback(async (id: string, newFav: boolean) => {
    if (!authToken) return;
    setVideos(prev => prev.map(v => v.id === id ? { ...v, is_favorite: newFav } : v));
    try {
      await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ is_favorite: newFav }),
      });
    } catch {
      setVideos(prev => prev.map(v => v.id === id ? { ...v, is_favorite: !newFav } : v));
    }
  }, [authToken]);

  const handlePreviewReuse = useCallback(() => {
    if (!canvasPreviewVideo) return;
    setPrompt(canvasPreviewVideo.prompt ?? "");
    setNegPrompt(canvasPreviewVideo.negPrompt ?? "");
    setCanvasPreviewId(null);
  }, [canvasPreviewVideo]);

  const handleDelete = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
    showToast("Video removed from session", "info");
  }, [showToast]);

  // ── Canvas preview action handlers ────────────────────────────────────────────

  // Favourite toggle — PATCH /api/assets/{id} with is_favorite, optimistic update
  const handlePreviewFavToggle = useCallback(async () => {
    if (!canvasPreviewVideo || !authToken) return;
    const newFav = !canvasPreviewVideo.is_favorite;
    setVideos(prev => prev.map(v =>
      v.id === canvasPreviewVideo.id ? { ...v, is_favorite: newFav } : v,
    ));
    try {
      await fetch(`/api/assets/${canvasPreviewVideo.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body:    JSON.stringify({ is_favorite: newFav }),
      });
    } catch {
      // Rollback on network error
      setVideos(prev => prev.map(v =>
        v.id === canvasPreviewVideo.id ? { ...v, is_favorite: !newFav } : v,
      ));
    }
  }, [canvasPreviewVideo, authToken]);

  // Delete from canvas — DELETE asset from DB, remove from list, clear preview
  const handlePreviewDelete = useCallback(async () => {
    if (!canvasPreviewVideo || !authToken) return;
    await fetch(`/api/assets/${canvasPreviewVideo.id}`, {
      method:  "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    }).catch(() => { /* silent — still remove locally */ });
    handleDelete(canvasPreviewVideo.id);
    setCanvasPreviewId(null);
  }, [canvasPreviewVideo, authToken, handleDelete]);

  // Cancel generation — POST cancel route; clear preview; set video to error state
  const handlePreviewCancel = useCallback(async () => {
    if (!canvasPreviewVideo?.taskId || !authToken) return;
    const vid = canvasPreviewVideo;
    try {
      await fetch(`/api/studio/jobs/${vid.taskId}/cancel`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${authToken}` },
      });
    } catch { /* silent */ }
    setVideos(prev => prev.map(v =>
      v.id === vid.id ? { ...v, status: "error", error: "Cancelled" } : v,
    ));
    setCanvasPreviewId(null);
    setGenerating(false);
  }, [canvasPreviewVideo, authToken]);

  // Set as Start Frame — inject URL into start slot; conditionally switch mode
  const handlePreviewSetStartFrame = useCallback(() => {
    if (!canvasPreviewVideo?.url) return;
    const url = canvasPreviewVideo.url;
    setStartSlot({ url, preview: url });
    // Only force mode switch when in text_to_video — respect other active modes
    if (frameMode === "text_to_video") setFrameMode("start_frame");
    setCanvasPreviewId(null);
    showToast("Video set as Start Frame", "success");
  }, [canvasPreviewVideo, frameMode, showToast]);

  // Set as End Frame — inject URL into end slot; never force mode switch
  const handlePreviewSetEndFrame = useCallback(() => {
    if (!canvasPreviewVideo?.url) return;
    const url = canvasPreviewVideo.url;
    setEndSlot({ url, preview: url });
    setCanvasPreviewId(null);
    showToast("Video set as End Frame", "success");
  }, [canvasPreviewVideo, showToast]);

  // Cinema focus mode — canvas glows more when actively working
  const cinemaModeActive = frameMode !== "text_to_video";

  const effectiveGenerating = frameMode === "lip_sync"
    ? lipSyncState.isGenerating
    : generating;

  const creditEstimate = model ? estimateCredits(model.id, quality, duration) : 0;

  // Which model family's preview to show in the empty canvas state.
  // Priority: hovering a pill > selected model's provider > "kling" fallback.
  const effectivePreviewKey = hoveredModelPreviewKey ?? model?.provider ?? "kling";

  // Readiness gate — single source of truth for CanvasGenerateBar + right panel
  const barHandleNotReady =
    detectedHandles.length > 0 &&
    detectedHandles[0] in handleReadiness &&
    handleReadiness[detectedHandles[0]] === false &&
    useStartFrame;

  // In start_frame mode a prompt is optional — the image IS the primary input.
  // Allow generate when a frame is loaded even if the textarea is empty.
  const hasFrameInput =
    frameMode === "start_frame" && (!!startSlot.url || !!endSlot.url);

  const canGenerate =
    !!model?.available &&
    USER_CREDITS >= creditEstimate &&
    (prompt.trim().length > 0 || hasFrameInput) &&
    !effectiveGenerating &&
    !barHandleNotReady;

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: [
        "radial-gradient(circle at 20% 30%, rgba(14,165,160,0.12), transparent 40%)",
        "radial-gradient(circle at 80% 70%, rgba(63,169,245,0.10), transparent 40%)",
        "#020617",
      ].join(", "),
      color: "#CBD5F5",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
      paddingTop: 80,
      boxSizing: "border-box",
    }}>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <Breadcrumb modelName={model?.displayName ?? "Video Studio"} />

      {/* ── Tool bar — family dropdowns ── */}
      <FamilyDropdownBar
        selectedId={selectedModelId}
        onSelect={setSelectedModelId}
        onScrollToGallery={() => {
          videoResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onPreviewHover={setHoveredModelPreviewKey}
      />

      {/* ── Hidden file inputs for Omni CTA buttons ── */}
      <input
        ref={omniRefImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          setStartSlot({ url, preview: url });
          e.target.value = "";
        }}
      />
      <input
        ref={omniRefVideoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          setMotionVideoUrl(url);
          setMotionVideoName(file.name);
          e.target.value = "";
        }}
      />

      {/* ── 3-column workspace ─────────────────────────────────── */}
      {isOmni ? (
        /* ═══════════════════════════════════════════════════════════
           OMNI CINEMATIC DIRECTOR MODE — kling-30-omni only
           Three-panel layout: Control Dock | Director Board | Shot Stack
           ═══════════════════════════════════════════════════════════ */
        <div style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr 280px",
          columnGap: 14,
          alignItems: "start",
          width: "100%",
          paddingBottom: 28,
          boxSizing: "border-box",
        }}>
          {/* Omni Left — Controls Panel (visible inputs, creation-first) */}
          <div style={{
            paddingLeft:  SIDE_GUTTER,
            paddingRight: 0,
            position:     "sticky",
            top:          88,
            maxHeight:    "calc(100vh - 100px)",
            overflowY:    "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.04) transparent",
            boxSizing:    "border-box",
          }}>
            <OmniControlsPanel
              prompt={prompt}
              setPrompt={setPrompt}
              negPrompt={negPrompt}
              setNegPrompt={setNegPrompt}
              quality={quality}
              setQuality={setQuality}
              audioMode={audioMode}
              setAudioMode={setAudioMode}
              startSlot={startSlot}
              setStartSlot={setStartSlot}
              endSlot={endSlot}
              setEndSlot={setEndSlot}
              motionVideoUrl={motionVideoUrl}
              setMotionVideoUrl={setMotionVideoUrl}
              setMotionVideoName={setMotionVideoName}
            />
          </div>

          {/* Omni Center — Director Board + Generate Bar */}
          <div style={{ minWidth: 0 }}>
            <OmniDirectorBoard
              shots={omniShots}
              startSlot={startSlot}
              endSlot={endSlot}
              motionVideoUrl={motionVideoUrl}
              generating={generating}
              onAddReferenceImage={() => omniRefImageInputRef.current?.click()}
              onAddReferenceVideo={() => omniRefVideoInputRef.current?.click()}
              onTryStoryboardPrompt={handleOmniStoryboardPrompt}
              onSwapFrames={() => { const t = startSlot; setStartSlot(endSlot); setEndSlot(t); }}
              onRemoveVideo={() => { setMotionVideoUrl(null); setMotionVideoName(null); }}
            />
            <OmniGenerateBar
              shots={omniShots}
              prompt={prompt}
              generating={generating}
              canGenerate={canGenerate}
              creditEstimate={creditEstimate}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Omni Right — Shot Stack */}
          <div style={{
            paddingRight: SIDE_GUTTER,
            paddingLeft:  0,
            position:     "sticky",
            top:          88,
            maxHeight:    "calc(100vh - 100px)",
            overflowY:    "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.04) transparent",
            boxSizing:    "border-box",
          }}>
            <OmniShotStack
              shots={omniShots}
              onAdd={handleOmniAddShot}
              onUpdate={handleOmniUpdateShot}
              onRemove={handleOmniRemoveShot}
            />
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════
           STANDARD VIDEO STUDIO — all models except kling-30-omni
           Three-panel: Left Rail | Canvas | Prompt Panel
           ═══════════════════════════════════════════════════════════ */
        <div style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 340px",
          columnGap: 14,
          alignItems: "start",
          width: "100%",
          paddingBottom: 28,
          boxSizing: "border-box",
        }}>

        {/* Left panel — VideoLeftRail */}
        <div style={{
          paddingLeft:    SIDE_GUTTER,
          paddingRight:   12,
          paddingTop:     14,
          paddingBottom:  14,
          height:         "100%",
          minHeight:      0,
          position:       "sticky",
          top:            88,
          zIndex:         10,
          maxHeight:      "calc(100vh - 100px)",
          overflowY:      "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background:     "rgba(0,0,0,0.28)",
          borderRadius:   12,
          borderRight:    "1px solid rgba(255,255,255,0.05)",
          opacity:        cinemaModeActive ? 0.88 : 1,
          transition:     "opacity 0.35s ease",
          boxSizing:      "border-box",
        }}>
          <VideoLeftRail
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            resolution={resolution}
            motionPreset={motionPreset}
            motionStrength={motionStrength}
            motionArea={motionArea}
            onFrameMode={setFrameMode}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onResolution={setResolution}
            onMotionPreset={setMotionPreset}
            onMotionStrength={setMotionStrength}
            onMotionArea={setMotionArea}
            model={model}
          />
        </div>

        {/* Canvas — fills 1fr, glow intensifies in cinema mode */}
        <div style={{
          minWidth: 0,
          transition: "filter 0.35s ease",
          filter: cinemaModeActive ? "brightness(1.04)" : "brightness(1)",
        }}>
          {/* ── Premium arrival banner — shown when arriving from any studio ─── */}
          {fromStudio && (() => {
            const isCD     = fromParam === "creative-director";
            const accent   = isCD ? "#0EA5A0" : "#6366F1";
            const accentLo = isCD ? "rgba(14,165,160,0.14)" : "rgba(99,102,241,0.12)";
            const accentBd = isCD ? "rgba(14,165,160,0.28)" : "rgba(99,102,241,0.26)";
            const accentTx = isCD ? "rgba(94,234,212,0.9)"  : "rgba(165,180,252,0.9)";
            const originLabel = isCD ? "Creative Director" : "Image Studio";
            const flowLabel   =
              flowParam === "start-frame" ? "Start Frame loaded" :
              flowParam === "end-frame"   ? "End Frame loaded"   :
              "Image loaded — ready to animate";
            return (
              <div style={{
                marginBottom: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: accentLo,
                border: `1px solid ${accentBd}`,
                boxShadow: `0 0 24px ${accentLo}`,
                animation: "vsArrivalFadeIn 0.4s ease",
              }}>
                {/* Breadcrumb row */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  marginBottom: 5,
                }}>
                  <span style={{ fontSize: 10.5, color: accentTx, fontWeight: 500, opacity: 0.75 }}>
                    {originLabel}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                    Video Studio
                  </span>
                </div>
                {/* Status row */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: accentTx,
                    letterSpacing: "0.01em",
                  }}>
                    {flowLabel}
                  </span>
                </div>
              </div>
            );
          })()}
          <style>{`
            @keyframes vsArrivalFadeIn {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes importedFrameGlow {
              0%   { box-shadow: 0 0 0 2px rgba(99,102,241,0.6), 0 0 24px rgba(99,102,241,0.3); }
              50%  { box-shadow: 0 0 0 2px rgba(99,102,241,0.9), 0 0 40px rgba(99,102,241,0.5); }
              100% { box-shadow: 0 0 0 2px rgba(99,102,241,0.6), 0 0 24px rgba(99,102,241,0.3); }
            }
          `}</style>
          {/* ── Canvas wrapper — relative so MotionFlowStrip can float above ── */}
          <div style={{ position: "relative" }}>
            {/* MotionFlowStrip — floats centered at top of canvas */}
            <div style={{
              position: "absolute",
              top: 17,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              pointerEvents: "none",
            }}>
              <MotionFlowStrip
                frameMode={frameMode}
                endFrameEnabled={model?.capabilities.endFrame}
                hasStartSlot={!!startSlot.url}
                hasEndSlot={!!endSlot.url}
              />
            </div>

            {model && !model.available ? (
              <ComingSoonScreen model={model} />
            ) : model && model.apiModelId === "" ? (
              <NotConfiguredScreen model={model} />
            ) : (
              <VideoCanvas
                frameMode={frameMode}
                aspectRatio={aspectRatio}
                generating={effectiveGenerating}
                cinemaModeActive={cinemaModeActive}
                endFrameEnabled={model?.capabilities.endFrame ?? false}
                startSlot={startSlot}
                endSlot={endSlot}
                audioSlot={audioSlot}
                motionVideoUrl={motionVideoUrl}
                motionVideoName={motionVideoName}
                onStartSlot={setStartSlot}
                onEndSlot={setEndSlot}
                onAudioSlot={setAudioSlot}
                onMotionVideo={(url, name) => { setMotionVideoUrl(url); setMotionVideoName(name); }}
                onMotionVideoRemove={() => { setMotionVideoUrl(null); setMotionVideoName(null); }}
                onLipSyncFaceFile={handleLipSyncFaceFile}
                onLipSyncAudioFile={handleLipSyncAudioFile}
                onMascotUpload={handleMascotUpload}
                onSamplePrompt={handleSamplePrompt}
                mascotSamplePrompt={mascotSamplePrompt}
                previewKey={effectivePreviewKey}
                previewVideo={canvasPreviewVideo}
                onClosePreview={() => setCanvasPreviewId(null)}
                onOpenFullscreen={(v) => setViewingVideo(v)}
                previewIsFavorite={canvasPreviewVideo?.is_favorite ?? false}
                onPreviewFavToggle={handlePreviewFavToggle}
                onPreviewDownload={
                  canvasPreviewVideo?.url
                    ? () => { import("@/lib/client/downloadAsset").then(({ downloadAsset }) => downloadAsset(canvasPreviewVideo.url!, `zencra-${canvasPreviewVideo.id}.mp4`)); }
                    : undefined
                }
                onPreviewCopyPrompt={undefined}
                onPreviewDelete={handlePreviewDelete}
                onPreviewCancel={handlePreviewCancel}
                onPreviewSetStartFrame={handlePreviewSetStartFrame}
                onPreviewSetEndFrame={model?.capabilities.endFrame ? handlePreviewSetEndFrame : undefined}
                onPreviewReuse={handlePreviewReuse}
              />
            )}
          </div>

          {/* ── Canvas Audio Status Badge ──────────────────────────────────────── */}
          {/* Shown when audio mode was "scene" or "voiceover" AND video is done.    */}
          {/*                                                                          */}
          {/* Scene audio states (driven by server-side MP4 detection):               */}
          {/*   audioDetected=true  → lime  ♪  "Scene Audio included"                */}
          {/*   audioDetected=false → amber ⚠  "Scene Audio unavailable — pack req'd"*/}
          {/*   audioDetected=null  → gray  ?  "Scene Audio status unknown"           */}
          {/*   sceneAudioFallback=true (fallback dispatch path) → amber ⚠           */}
          {/*                                                                          */}
          {/* Voiceover states (driven by voiceoverStatus):                            */}
          {/*   generating → grey  "Voiceover generating…"                            */}
          {/*   ready      → lime  ♬  "Voiceover ready"                              */}
          {/*   error      → amber ⚠  "Voiceover failed"                             */}
          {(() => {
            const v = canvasPreviewVideo;
            if (!v || v.status !== "done") return null;

            // ── Scene Audio badge ─────────────────────────────────────────────
            if (v.audioMode === "scene") {
              // Fallback dispatch path: audio was never requested
              if (v.sceneAudioFallback && v.audioDetected === undefined) {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 12px",
                    background: "rgba(255,160,0,0.10)",
                    borderTop: "1px solid rgba(255,160,0,0.25)", borderBottom: "1px solid rgba(255,160,0,0.25)",
                    fontSize: 11, letterSpacing: "0.02em", color: "#FFA000",
                  }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>⚠</span>
                    <span>Scene Audio unavailable — Sound Generation pack required in Kling console</span>
                  </div>
                );
              }
              // Server-side detection result
              if (v.audioDetected === true) {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 12px",
                    background: "rgba(198,255,0,0.07)",
                    borderTop: "1px solid rgba(198,255,0,0.18)", borderBottom: "1px solid rgba(198,255,0,0.18)",
                    fontSize: 11, letterSpacing: "0.02em", color: "#C6FF00",
                  }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>♪</span>
                    <span>Scene Audio included</span>
                  </div>
                );
              }
              // audioDetected === false OR null → amber "unavailable"
              // null means detection was inconclusive — for scene audio this is
              // almost always Kling silently omitting audio (no Sound Gen pack).
              // We treat it as unavailable rather than showing a confusing "unknown" state.
              return (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 12px",
                  background: "rgba(255,160,0,0.10)",
                  borderTop: "1px solid rgba(255,160,0,0.25)", borderBottom: "1px solid rgba(255,160,0,0.25)",
                  fontSize: 11, letterSpacing: "0.02em", color: "#FFA000",
                }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>⚠</span>
                  <span>Scene Audio unavailable — Sound Generation pack required in Kling console</span>
                </div>
              );
            }

            // ── Voiceover badge ───────────────────────────────────────────────
            if (v.audioMode === "voiceover") {
              if (v.voiceoverStatus === "generating") {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 12px",
                    background: "rgba(255,255,255,0.04)",
                    borderTop: "1px solid rgba(255,255,255,0.10)", borderBottom: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 11, letterSpacing: "0.02em", color: "#888",
                  }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>♬</span>
                    <span>Voiceover generating…</span>
                  </div>
                );
              }
              if (v.voiceoverStatus === "ready") {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 12px",
                    background: "rgba(198,255,0,0.07)",
                    borderTop: "1px solid rgba(198,255,0,0.18)", borderBottom: "1px solid rgba(198,255,0,0.18)",
                    fontSize: 11, letterSpacing: "0.02em", color: "#C6FF00",
                  }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>♬</span>
                    <span>Voiceover ready</span>
                  </div>
                );
              }
              if (v.voiceoverStatus === "error") {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 12px",
                    background: "rgba(255,160,0,0.10)",
                    borderTop: "1px solid rgba(255,160,0,0.25)", borderBottom: "1px solid rgba(255,160,0,0.25)",
                    fontSize: 11, letterSpacing: "0.02em", color: "#FFA000",
                  }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>⚠</span>
                    <span>Voiceover failed</span>
                  </div>
                );
              }
            }

            return null;
          })()}

          {/* ── Generate Bar — single CTA between canvas and gallery ── */}
          <CanvasGenerateBar
            ready={canGenerate}
            generating={effectiveGenerating}
            comingSoon={model ? !model.available : false}
            modelName={model?.displayName ?? ""}
            durationLabel={`${duration}s`}
            aspectRatioLabel={aspectRatio}
            qualityLabel={quality}
            creditsLabel={
              audioMode === "voiceover" && voiceoverScript.trim()
                ? `${creditEstimate}+3 CR`
                : `${creditEstimate} CR`
            }
            onGenerate={handleGenerate}
          />
        </div>

        {/* Right panel — prompt */}
        <div style={{
          paddingRight: SIDE_GUTTER,
          paddingLeft: 12,
          paddingTop: 14,
          paddingBottom: 14,
          position: "sticky",
          top: 88,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.22)",
          borderRadius: 12,
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          boxSizing: "border-box",
        }}>
          <VideoPromptPanel
            model={model}
            prompt={prompt}
            setPrompt={setPrompt}
            negPrompt={negPrompt}
            setNegPrompt={setNegPrompt}
            quality={quality}
            duration={duration}
            generating={generating}
            userCredits={USER_CREDITS}
            frameMode={frameMode}
            lipSyncState={lipSyncState}
            onLipSyncQualityMode={setLipSyncQuality as (m: LipSyncQuality) => void}
            onLipSyncGenerate={handleGenerate}
            onLipSyncRetry={lipSyncRetry}
            onLipSyncReset={lipSyncReset}
            onGenerate={handleGenerate}
            detectedHandles={detectedHandles}
            handleReadiness={handleReadiness}
            handleAvatarUrls={handleAvatarUrls}
            useStartFrame={useStartFrame}
            setUseStartFrame={setUseStartFrame}
            endSlot={endSlot}
            onClearEndSlot={() => setEndSlot(EMPTY_SLOT)}
            audioMode={audioMode}
            setAudioMode={setAudioMode}
            voiceoverScript={voiceoverScript}
            setVoiceoverScript={setVoiceoverScript}
            hideGenerateButton
          />
        </div>
        </div>
      )}

      {/* ── Gallery — full viewport width ──────────────────────── */}
      {/* Padding/border/header now owned by VideoResultsLibrary */}
      <div ref={videoResultsRef} style={{ width: "100%", boxSizing: "border-box" }}>
        <VideoResultsLibrary
          videos={videos}
          onReusePrompt={handleReusePrompt}
          onDelete={handleDelete}
          onFavToggle={handleGalleryFavToggle}
          onRetry={handleRetry}
          onAuthRequired={() => setAuthModalOpen(true)}
          onPreview={(v) => setViewingVideo(v)}
          onCardRef={(id, el) => { videoCardRefs.current[id] = el; }}
        />
      </div>

      {/* ── Fullscreen video preview ─────────────────────────────────────── */}
      {viewingVideo?.url && (
        <FullscreenPreview
          type="video"
          url={viewingVideo.url}
          thumbnailUrl={viewingVideo.thumbnailUrl ?? undefined}
          metadata={{
            prompt:      viewingVideo.prompt,
            modelName:   viewingVideo.modelName,
            aspectRatio: viewingVideo.aspectRatio,
            creditsUsed: viewingVideo.creditsUsed,
            createdAt:   viewingVideo.createdAt,
            duration:    viewingVideo.duration,
          }}
          onClose={() => setViewingVideo(null)}
          zIndex={9800}
        />
      )}

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toastState && (() => {
        const vs = TOAST_VARIANT_STYLES[toastState.variant];
        return (
          <div style={{
            position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
            zIndex: 99999,
            background: vs.bg, backdropFilter: "blur(14px)",
            border: `1px solid ${vs.border}`,
            borderRadius: 12, padding: "10px 18px",
            fontSize: 13, fontWeight: 500, color: "#F1F5F9",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            animation: "fadeIn 0.18s ease",
            whiteSpace: "nowrap", pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: vs.dot, flexShrink: 0 }} />
            {toastState.msg}
          </div>
        );
      })()}

      {/* ── Auth gate modal — opens when non-member clicks Generate ── */}
      {authModalOpen && (
        <AuthModal
          defaultTab="signup"
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {/* ── Creative Flow overlays ────────────────────────────────────────── */}
      <FlowBar />

    </div>
  );
}
