"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoLeftRail — Controls: Mode, Duration, AR, Quality, Camera, Motion
// Width 240px. No tool switcher. No credits (lives in right panel only).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { CAMERA_PRESET_LABELS, type VideoModel, type CameraPreset } from "@/lib/ai/video-model-registry";
import type { FrameMode, VideoAR, Quality } from "./types";

// ── Mode icons (inline SVG) ───────────────────────────────────────────────────

const MODE_ICONS: Record<FrameMode, React.ReactNode> = {
  text_to_video: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  ),
  start_frame: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="14" rx="2"/>
      <path d="M16 8l5 4-5 4"/>
    </svg>
  ),
  start_end: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="9" height="9" rx="1.5"/>
      <rect x="14" y="4" width="9" height="9" rx="1.5"/>
      <path d="M10 8.5h4"/>
      <path d="M12.5 6.5l2 2-2 2"/>
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
  start_frame:    "Start Frame",
  start_end:      "Start + End",
  extend:         "Extend Video",
  lip_sync:       "Lip Sync",
  motion_control: "Motion Control",
};

// ── Camera preset icons ───────────────────────────────────────────────────────

const CAMERA_ICONS: Record<CameraPreset | "none", React.ReactNode> = {
  none: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  simple: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="3 2"/>
    </svg>
  ),
  down_back: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14"/><path d="M5 12l7 7 7-7"/>
    </svg>
  ),
  forward_up: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>
    </svg>
  ),
  right_turn_forward: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
    </svg>
  ),
  left_turn_forward: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
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
              flex: 1, padding: "7px 4px",
              borderRadius: 7,
              border: active ? "1px solid rgba(34,211,238,0.45)" : "1px solid rgba(255,255,255,0.07)",
              background: active ? "rgba(14,165,160,0.14)" : "rgba(255,255,255,0.02)",
              color: active ? "#22D3EE" : "#64748B",
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          >
            {getLabel ? getLabel(opt) : String(opt)}
          </button>
        );
      })}
    </div>
  );
}

const Divider = () => <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />;

// ── Camera Dropdown ───────────────────────────────────────────────────────────

function CameraDropdown({ presets, value, onChange }: {
  presets: CameraPreset[];
  value: CameraPreset | null;
  onChange: (v: CameraPreset | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedLabel = value ? CAMERA_PRESET_LABELS[value] : "None";
  const selectedIcon  = CAMERA_ICONS[value ?? "none"];
  const options: Array<CameraPreset | null> = [null, ...presets];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderRadius: 8,
          border: open ? "1px solid rgba(34,211,238,0.35)" : "1px solid rgba(255,255,255,0.08)",
          background: open ? "rgba(14,165,160,0.08)" : "rgba(255,255,255,0.03)",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: value ? "#94A3B8" : "#475569" }}>
          <span style={{ lineHeight: 0, color: value ? "#22D3EE" : "#475569" }}>{selectedIcon}</span>
          <span style={{ fontSize: 12, fontWeight: value ? 600 : 400, color: value ? "#CBD5E1" : "#475569" }}>
            {selectedLabel}
          </span>
        </div>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
            background: "#0C1220",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(14,165,160,0.08)",
            overflow: "hidden",
            animation: "dropdownIn 0.12s ease-out",
          }}
        >
          {options.map(p => {
            const label  = p ? CAMERA_PRESET_LABELS[p] : "None";
            const icon   = CAMERA_ICONS[p ?? "none"];
            const active = value === p;
            return (
              <button
                key={p ?? "none"}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px",
                  background: active ? "rgba(14,165,160,0.12)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer", transition: "background 0.12s",
                  color: active ? "#22D3EE" : "#94A3B8",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  textAlign: "left",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ lineHeight: 0, color: active ? "#22D3EE" : "#475569", flexShrink: 0 }}>{icon}</span>
                {label}
                {active && (
                  <span style={{ marginLeft: "auto" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Motion Strength Slider ────────────────────────────────────────────────────

function MotionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = value < 25 ? "Subtle" : value < 50 ? "Gentle" : value < 75 ? "Moderate" : "Strong";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#22D3EE" }}>{value}</span>
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
              border: active ? "1px solid rgba(34,211,238,0.35)" : "1px solid transparent",
              background: active ? "rgba(14,165,160,0.1)" : "transparent",
              color: active ? "#22D3EE" : "#64748B",
              fontSize: 12, fontWeight: active ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 7,
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
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
  frameMode:    FrameMode;
  aspectRatio:  VideoAR;
  quality:      Quality;
  duration:     number;
  cameraPreset: CameraPreset | null;
  motionStrength: number;
  motionArea:   string;
  onFrameMode:  (m: FrameMode) => void;
  onAspectRatio:(ar: VideoAR) => void;
  onQuality:    (q: Quality) => void;
  onDuration:   (d: number) => void;
  onCameraPreset:(p: CameraPreset | null) => void;
  onMotionStrength: (v: number) => void;
  onMotionArea: (v: string) => void;
  model:        VideoModel | null;
}

export default function VideoLeftRail({
  frameMode, aspectRatio, quality, duration, cameraPreset,
  motionStrength, motionArea,
  onFrameMode, onAspectRatio, onQuality, onDuration, onCameraPreset,
  onMotionStrength, onMotionArea,
  model,
}: Props) {
  const caps           = model?.capabilities;
  const availableARs   = (caps?.aspectRatios as VideoAR[]) ?? ["16:9"];
  const availableDurs  = caps?.durations ?? [5];
  const hasPro         = caps?.proMode ?? false;
  const hasCamera      = (caps?.cameraControl && (caps?.cameraPresets?.length ?? 0) > 1) ?? false;
  const isMotionMode   = frameMode === "motion_control";

  const MODES: FrameMode[] = ["text_to_video", "start_frame", "start_end", "extend", "lip_sync", "motion_control"];
  const modeAllowed: Record<FrameMode, boolean> = {
    text_to_video:  caps?.textToVideo    ?? true,
    start_frame:    caps?.startFrame     ?? false,
    start_end:      caps?.endFrame       ?? false,
    extend:         caps?.extendVideo    ?? false,
    lip_sync:       caps?.lipSync        ?? false,
    motion_control: caps?.motionControl  ?? false,
  };

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 14,
        height: "100%", overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.06) transparent",
        paddingBottom: 16,
      }}
    >
      {/* ── Mode ─────────────────────────────────────────────────────────── */}
      <div>
        <SLabel>Mode</SLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {MODES.map(mode => {
            const allowed = modeAllowed[mode];
            const active  = frameMode === mode;
            return (
              <button
                key={mode}
                onClick={() => allowed && onFrameMode(mode)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: active ? "1px solid rgba(34,211,238,0.35)" : "1px solid transparent",
                  background: active ? "rgba(14,165,160,0.1)" : "transparent",
                  display: "flex", alignItems: "center", gap: 8,
                  cursor: allowed ? "pointer" : "not-allowed",
                  opacity: allowed ? 1 : 0.25,
                  transition: "all 0.15s",
                  color: active ? "#22D3EE" : "#94A3B8",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => { if (allowed && !active) (e.currentTarget as HTMLElement).style.color = "#CBD5E1"; }}
                onMouseLeave={e => { if (allowed && !active) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              >
                <span style={{ flexShrink: 0, lineHeight: 0 }}>{MODE_ICONS[mode]}</span>
                {MODE_LABELS[mode]}
                {!allowed && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "0.05em" }}>
                    N/A
                  </span>
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

      {/* ── Camera Motion ────────────────────────────────────────────────── */}
      {hasCamera && caps?.cameraPresets && (
        <>
          <Divider />
          <div>
            <SLabel>Camera Motion</SLabel>
            <CameraDropdown
              presets={caps.cameraPresets.filter(p => p !== "simple") as CameraPreset[]}
              value={cameraPreset}
              onChange={onCameraPreset}
            />
          </div>
        </>
      )}

      {/* ── Motion Controls (visible only in motion_control mode) ─────────── */}
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
