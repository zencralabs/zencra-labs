"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoLeftRail — Controls: Mode, Duration, AR, Quality, Resolution, Motion Control
// Width 260px. No tool switcher. No credits (lives in right panel only).
// Camera Motion (native API dropdown) and Motion Style (prompt chips) are
// merged into a single "Motion Control" section — prompt-layer only.
// ─────────────────────────────────────────────────────────────────────────────

import { type VideoModel } from "@/lib/ai/video-model-registry";
import type { FrameMode, VideoAR, Quality } from "./types";

// ── Mode icons (inline SVG) ───────────────────────────────────────────────────

const MODE_ICONS: Record<FrameMode, React.ReactNode> = {
  text_to_video: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  ),
  // Start Frame = Image Reference mode. End Frame zone shows conditionally inside this mode.
  start_frame: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="14" rx="2"/>
      <path d="M16 8l5 4-5 4"/>
    </svg>
  ),
  extend: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="10" height="12" rx="2"/>
      <path d="M14 12h8"/>
      <path d="M18 9l3 3-3 3"/>
    </svg>
  ),
  lip_sync: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="9" y1="22" x2="15" y2="22"/>
    </svg>
  ),
  motion_control: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M6 16c0-2 2.686-3 6-3s6 1 6 3v1H6v-1z"/>
      <path d="M20 8l2 2-2 2"/>
      <path d="M4 8L2 10l2 2"/>
    </svg>
  ),
};

const MODE_LABELS: Record<FrameMode, string> = {
  text_to_video:  "Text to Video",
  start_frame:    "Source Frame",  // Image → Video. End Frame zone shown conditionally inside this mode.
  extend:         "Extend Video",
  lip_sync:       "Lip Sync",
  motion_control: "Motion Control",
};

const MODE_SUBLABELS: Partial<Record<FrameMode, string>> = {
  text_to_video:  "Prompt → video",
  start_frame:    "Image → video",
  extend:         "Continue a clip",
  lip_sync:       "Face + audio",
  motion_control: "Kling 3.0",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// UI Label category: 13px / semibold 600 / uppercase / tracking 0.14em
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function PillRow<T extends string | number>({
  options, value, onChange, getLabel,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  getLabel?: (v: T) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(opt => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            style={{
              flex: 1, padding: "8px 4px",
              borderRadius: 7,
              border: active ? "1px solid rgba(14,165,160,0.6)" : "1px solid rgba(255,255,255,0.12)",
              background: active ? "rgba(14,165,160,0.15)" : "rgba(255,255,255,0.03)",
              color: active ? "#F8FAFC" : "#94A3B8",
              /* Chip: 13px / medium 500 active 600 / tracking -0.005em */
              fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: "-0.005em",
              cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: active ? "0 0 10px rgba(14,165,160,0.3)" : "none",
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#CBD5F5";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
              }
            }}
          >
            {getLabel ? getLabel(opt) : String(opt)}
          </button>
        );
      })}
    </div>
  );
}

const Divider = () => <div style={{ height: 1, background: "rgba(255,255,255,0.09)", margin: "4px 0" }} />;

// ── Motion Control Preset System ──────────────────────────────────────────────
// Unified cinematic movement system — prompt-layer only.
// Replaces Camera Motion (native API dropdown) + Motion Style (old chip grid).
// Capability gating via existing registry flags (cameraControl + motionControl).
// Disabled presets rendered at opacity 0.35 with not-allowed cursor.

const MOTION_PRESETS: Array<{ value: string; label: string; fullLabel: string }> = [
  { value: "none",          label: "None",      fullLabel: "No motion preset" },
  { value: "cinematic_push",label: "Push In",   fullLabel: "Push In — slow cinematic dolly toward the subject" },
  { value: "pull_back",     label: "Pull Back", fullLabel: "Pull Back — slow cinematic reveal of the scene" },
  { value: "orbit_left",    label: "Orbit L",   fullLabel: "Orbit Left — camera arcs left around the subject" },
  { value: "orbit_right",   label: "Orbit R",   fullLabel: "Orbit Right — camera arcs right around the subject" },
  { value: "walk_forward",  label: "Walk",      fullLabel: "Walk Forward — subject moves naturally toward camera" },
  { value: "handheld",      label: "Handheld",  fullLabel: "Handheld — organic stabilized camera shake" },
  { value: "slow_drift",    label: "Drift",     fullLabel: "Slow Drift — gentle lateral camera drift" },
  { value: "reveal",        label: "Reveal",    fullLabel: "Reveal — pulls back to unveil the full scene" },
];

// ── Full set: cameraControl + motionControl both true (Kling 3.0 Omni, Kling 3.0)
// ── Limited:  all other available models (Kling 2.6, Kling 2.5, Seedance family)
// ── None:     model is null or not available
export function getMotionPresetsForModel(model: VideoModel | null): string[] {
  if (!model?.available) return [];
  const caps = model.capabilities;
  if (caps.cameraControl && caps.motionControl) {
    // Full cinematic set — orbit, walk, handheld, reveal all enabled
    return MOTION_PRESETS.map(p => p.value);
  }
  // Basic prompt-level motion only — camera push/pull/drift safe for all providers
  return ["none", "cinematic_push", "pull_back", "slow_drift"];
}

// 2-column chip grid — compact premium glass style with per-model capability gating
function MotionPresetSelector({
  value,
  onChange,
  model,
}: {
  value: string;
  onChange: (v: string) => void;
  model: VideoModel | null;
}) {
  const enabledPresets = getMotionPresetsForModel(model);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {MOTION_PRESETS.map(p => {
        const active   = value === p.value;
        const disabled = !enabledPresets.includes(p.value);
        return (
          <button
            key={p.value}
            onClick={() => { if (!disabled) onChange(p.value); }}
            title={disabled ? "Not available for this model" : p.fullLabel}
            style={{
              height: 34,
              borderRadius: 10,
              border: active
                ? "1px solid rgba(14,165,160,0.65)"
                : "1px solid rgba(255,255,255,0.08)",
              background: active
                ? "rgba(14,165,160,0.16)"
                : "rgba(255,255,255,0.03)",
              color: active ? "#F8FAFC" : "#94A3B8",
              /* Chip: 13px / active 600 inactive 500 / tracking -0.005em */
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              letterSpacing: "-0.005em",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.35 : 1,
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: active ? "0 0 10px rgba(14,165,160,0.28)" : "none",
            }}
            onMouseEnter={e => {
              if (!active && !disabled) {
                (e.currentTarget as HTMLElement).style.color = "#CBD5F5";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }
            }}
            onMouseLeave={e => {
              if (!active && !disabled) {
                (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Motion Strength Slider ────────────────────────────────────────────────────

function MotionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = value < 25 ? "Subtle" : value < 50 ? "Gentle" : value < 75 ? "Moderate" : "Strong";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        {/* Chip: 13px / medium 500 / tracking -0.005em */}
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em", color: "#CBD5F5" }}>{label}</span>
        {/* Chip: 13px / semibold 600 / tracking -0.005em — color #0EA5A0 is semantic (active teal) */}
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "#0EA5A0" }}>{value}</span>
      </div>
      <div style={{ position: "relative" }}>
        <input
          type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: "100%", height: 4, appearance: "none", WebkitAppearance: "none",
            background: `linear-gradient(to right, #22D3EE ${value}%, rgba(255,255,255,0.1) ${value}%)`,
            borderRadius: 2, cursor: "pointer", outline: "none",
          }}
        />
      </div>
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #22D3EE;
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ── Motion Area Focus Select ──────────────────────────────────────────────────

function MotionAreaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: "full_body",   label: "Full Body" },
    { value: "upper_body",  label: "Upper Body" },
    { value: "face",        label: "Face" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "7px 10px", borderRadius: 7, textAlign: "left",
              border: active ? "1px solid rgba(14,165,160,0.5)" : "1px solid transparent",
              background: active ? "rgba(14,165,160,0.12)" : "transparent",
              color: active ? "#F8FAFC" : "#94A3B8",
              /* Chip: 13px / active 600 inactive 500 / tracking -0.005em */
              fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: "-0.005em",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 7,
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#CBD5F5"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          >
            {active && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  frameMode:      FrameMode;
  aspectRatio:    VideoAR;
  quality:        Quality;
  duration:       number;
  resolution:     string;
  // motionPreset — unified cinematic movement preset ("none" = off).
  // Sent as motionControl: { preset, intensity } to backend for prompt-layer injection.
  motionPreset:   string;
  motionStrength: number;
  motionArea:     string;
  onFrameMode:    (m: FrameMode) => void;
  onAspectRatio:  (ar: VideoAR) => void;
  onQuality:      (q: Quality) => void;
  onDuration:     (d: number) => void;
  onResolution:   (r: string) => void;
  onMotionPreset: (v: string) => void;
  onMotionStrength: (v: number) => void;
  onMotionArea:   (v: string) => void;
  model:          VideoModel | null;
}

export default function VideoLeftRail({
  frameMode, aspectRatio, quality, duration, resolution,
  motionPreset, motionStrength, motionArea,
  onFrameMode, onAspectRatio, onQuality, onDuration, onResolution,
  onMotionPreset, onMotionStrength, onMotionArea,
  model,
}: Props) {
  const caps           = model?.capabilities;
  const availableARs   = (caps?.aspectRatios as VideoAR[]) ?? ["16:9"];
  const availableDurs  = caps?.durations ?? [5];
  const hasPro         = caps?.proMode ?? false;
  const isMotionMode   = frameMode === "motion_control";

  // Resolution — show pill row only if model declares supported resolutions
  const availableResolutions = caps?.resolutions ?? [];
  const hasResolution        = availableResolutions.length > 0;

  // Frame rate — read-only info label (not a control)
  const frameRate = caps?.frameRate;

  // Modes available for this model.
  // "start_frame" = Image Reference mode. The canvas conditionally shows the End Frame zone
  // inside this mode when model.capabilities.endFrame is true.
  const MODES: FrameMode[] = ["text_to_video", "start_frame", "extend", "lip_sync", "motion_control"];
  const modeAllowed: Record<FrameMode, boolean> = {
    text_to_video:  caps?.textToVideo    ?? true,
    start_frame:    caps?.startFrame     ?? false,
    extend:         caps?.extendVideo    ?? false,
    lip_sync:       true,
    motion_control: caps?.motionControl  ?? false,
  };

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        paddingBottom: 16,
      }}
    >
      {/* ── Mode ─────────────────────────────────────────────────────────── */}
      <div>
        <SLabel>Mode</SLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {MODES.map(mode => {
            const allowed = modeAllowed[mode];
            const active  = frameMode === mode;
            const sub     = MODE_SUBLABELS[mode];
            return (
              <button
                key={mode}
                onClick={() => allowed && onFrameMode(mode)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 9,
                  border: active
                    ? "1px solid rgba(14,165,160,0.65)"
                    : "1px solid rgba(255,255,255,0.06)",
                  background: active
                    ? "rgba(14,165,160,0.14)"
                    : "rgba(255,255,255,0.02)",
                  display: "flex", alignItems: "center", gap: 9,
                  cursor: allowed ? "pointer" : "not-allowed",
                  opacity: allowed ? 1 : 0.22,
                  transition: "all 0.18s ease",
                  boxShadow: active
                    ? "0 0 0 1px rgba(14,165,160,0.10) inset, 0 0 14px rgba(14,165,160,0.15)"
                    : "none",
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (allowed && !active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }
                }}
                onMouseLeave={e => {
                  if (allowed && !active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }
                }}
              >
                {/* Icon box */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? "rgba(14,165,160,0.22)" : "rgba(255,255,255,0.04)",
                  border: active ? "1px solid rgba(34,211,238,0.25)" : "1px solid rgba(255,255,255,0.07)",
                  color: active ? "#22D3EE" : "#64748B",
                  transition: "all 0.18s",
                }}>
                  {MODE_ICONS[mode]}
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Chip: 13px / active 600 inactive 500 / tracking -0.005em */}
                  <div style={{
                    fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: "-0.005em",
                    color: active ? "#F8FAFC" : "#94A3B8",
                    lineHeight: 1.2, transition: "color 0.18s",
                  }}>
                    {MODE_LABELS[mode]}
                  </div>
                  {sub && (
                    // Micro: 11px / semibold 600 — no forced uppercase (sublabel descriptor)
                    <div style={{
                      fontSize: 11, color: active ? "rgba(34,211,238,0.65)" : "#475569",
                      marginTop: 1, fontWeight: 600,
                    }}>
                      {sub}
                    </div>
                  )}
                </div>

                {/* Badge for locked/special modes */}
                {!allowed && (
                  // Micro: 11px / semibold 600 / tracking 0.12em (was 9px — below system minimum)
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                    color: mode === "motion_control" ? "#7C5ABF" : "#3A4F62",
                    background: mode === "motion_control" ? "rgba(124,90,191,0.15)" : "transparent",
                    borderRadius: 4,
                    padding: mode === "motion_control" ? "2px 5px" : "0",
                    flexShrink: 0,
                  }}>
                    {mode === "motion_control" ? "Kling 3.0" : mode === "start_frame" ? "No I2V" : "N/A"}
                  </span>
                )}

                {/* Active indicator dot */}
                {active && (
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "#22D3EE", flexShrink: 0,
                    boxShadow: "0 0 6px rgba(34,211,238,0.6)",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── Duration ─────────────────────────────────────────────────────── */}
      <div>
        <SLabel>Duration</SLabel>
        <PillRow options={availableDurs} value={duration} onChange={onDuration} getLabel={v => `${v}s`} />
      </div>

      {/* ── Aspect Ratio ─────────────────────────────────────────────────── */}
      <div>
        <SLabel>Aspect Ratio</SLabel>
        <PillRow options={availableARs} value={aspectRatio} onChange={onAspectRatio} />
      </div>

      {/* ── Resolution ───────────────────────────────────────────────────── */}
      {hasResolution && (
        <div>
          <SLabel>Resolution</SLabel>
          <PillRow options={availableResolutions} value={resolution} onChange={onResolution} />
        </div>
      )}

      {/* ── Frame Rate (read-only info label) ────────────────────────────── */}
      {frameRate && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 10px", borderRadius: 7,
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748B" }}>
            Frame Rate
          </span>
          {/* Chip: 13px / semibold 600 / tracking -0.005em */}
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", color: "#475569" }}>
            {frameRate} fps
          </span>
        </div>
      )}

      {/* ── Quality ──────────────────────────────────────────────────────── */}
      {hasPro && (
        <div>
          <SLabel>Quality</SLabel>
          <PillRow
            options={["std", "pro"] as Quality[]}
            value={quality}
            onChange={onQuality}
            getLabel={v => v === "std" ? "Standard" : "Pro"}
          />
        </div>
      )}

      {/* ── Motion Control ───────────────────────────────────────────────────
          Unified cinematic movement system.
          Replaces "Camera Motion" (native API dropdown) + "Motion Style" (old prompt chips).
          Prompt-layer only — no provider routing changes. Sends motionControl: { preset, intensity }
          to backend which injects the corresponding cinematography direction into the prompt.
          Capability gating: full 9-preset set for Kling 3.0 / Omni (cameraControl + motionControl).
          Limited 4-preset set for Kling 2.6 / 2.5 / Seedance (basic push/pull/drift only).
          Disabled chips show at opacity 0.35 with not-allowed cursor + tooltip.
          Changing model resets unsupported preset to "none" (handled in VideoStudioShell).
          Hidden in motion_control frameMode (reference video) and lip_sync mode.           */}
      {model?.available && !isMotionMode && frameMode !== "lip_sync" && (
        <>
          <Divider />
          <div>
            <SLabel>Motion Control</SLabel>
            <MotionPresetSelector value={motionPreset} onChange={onMotionPreset} model={model} />
          </div>
        </>
      )}

      {/* ── Motion Controls (visible only in motion_control reference video mode) */}
      {isMotionMode && (
        <>
          <Divider />
          <div>
            <SLabel>Motion Strength</SLabel>
            <MotionSlider value={motionStrength} onChange={onMotionStrength} />
          </div>
          <div>
            <SLabel>Motion Area Focus</SLabel>
            <MotionAreaSelect value={motionArea} onChange={onMotionArea} />
          </div>
        </>
      )}
    </div>
  );
}
