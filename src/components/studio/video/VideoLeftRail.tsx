"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoLeftRail — Controls only (no tool switcher — moved to header bar)
// Width: 220px | Compact spacing | Collapsible Camera
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { CAMERA_PRESET_LABELS, type VideoModel, type CameraPreset } from "@/lib/ai/video-model-registry";
import type { FrameMode, VideoAR, Quality } from "./types";

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#475569",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Collapsible({
  label,
  defaultOpen = true,
  children,
}: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 5px",
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#475569"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ── Pill row ──────────────────────────────────────────────────────────────────

function PillRow<T extends string | number>({
  options,
  value,
  onChange,
  getLabel,
  disabled,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  getLabel?: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(opt => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            onClick={() => !disabled && onChange(opt)}
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 7,
              border: active
                ? "1px solid rgba(14,165,160,0.5)"
                : "1px solid rgba(255,255,255,0.06)",
              background: active
                ? "rgba(14,165,160,0.14)"
                : "rgba(255,255,255,0.02)",
              color: active ? "#22D3EE" : "#64748B",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {getLabel ? getLabel(opt) : String(opt)}
          </button>
        );
      })}
    </div>
  );
}

// ── Frame mode options ────────────────────────────────────────────────────────

interface FrameModeOption {
  value: FrameMode;
  label: string;
  requiresCap?: keyof import("@/lib/ai/video-model-registry").VideoModelCapabilities;
}

const FRAME_MODES: FrameModeOption[] = [
  { value: "text_to_video", label: "Text to Video",  requiresCap: "textToVideo"  },
  { value: "start_frame",   label: "Start Frame",    requiresCap: "startFrame"   },
  { value: "start_end",     label: "Start + End",    requiresCap: "endFrame"     },
  { value: "extend",        label: "Extend Video",   requiresCap: "extendVideo"  },
  { value: "lip_sync",      label: "Lip Sync",       requiresCap: "lipSync"      },
];

// ── Camera preset list ────────────────────────────────────────────────────────

function CameraPresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: CameraPreset[];
  value: CameraPreset | null;
  onChange: (v: CameraPreset | null) => void;
}) {
  const options: Array<CameraPreset | null> = [null, ...presets];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {options.map(p => {
        const label = p ? CAMERA_PRESET_LABELS[p] : "None";
        const active = value === p;
        return (
          <button
            key={p ?? "none"}
            onClick={() => onChange(p)}
            style={{
              padding: "6px 10px",
              borderRadius: 7,
              border: active
                ? "1px solid rgba(14,165,160,0.35)"
                : "1px solid transparent",
              background: active
                ? "rgba(14,165,160,0.1)"
                : "transparent",
              color: active ? "#22D3EE" : "#64748B",
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={e => {
              if (!active) (e.currentTarget as HTMLElement).style.color = "#94A3B8";
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLElement).style.color = "#64748B";
            }}
          >
            {active && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

const Divider = () => (
  <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "4px 0" }} />
);

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  frameMode: FrameMode;
  aspectRatio: VideoAR;
  quality: Quality;
  duration: number;
  cameraPreset: CameraPreset | null;
  onFrameMode: (m: FrameMode) => void;
  onAspectRatio: (ar: VideoAR) => void;
  onQuality: (q: Quality) => void;
  onDuration: (d: number) => void;
  onCameraPreset: (p: CameraPreset | null) => void;
  model: VideoModel | null;
  userCredits: number;
  creditEstimate: number;
}

export default function VideoLeftRail({
  frameMode,
  aspectRatio,
  quality,
  duration,
  cameraPreset,
  onFrameMode,
  onAspectRatio,
  onQuality,
  onDuration,
  onCameraPreset,
  model,
  userCredits,
  creditEstimate,
}: Props) {
  const caps = model?.capabilities;
  const availableARs  = (caps?.aspectRatios as VideoAR[]) ?? ["16:9"];
  const availableDurs = caps?.durations ?? [5];
  const hasPro        = caps?.proMode ?? false;
  const hasCamera     = (caps?.cameraControl && (caps?.cameraPresets?.length ?? 0) > 1) ?? false;
  const insufficient  = userCredits < creditEstimate && !(model?.comingSoon);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.06) transparent",
      }}
    >
      {/* ── Mode ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Mode</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {FRAME_MODES.map(opt => {
            const supported = opt.requiresCap
              ? (caps?.[opt.requiresCap] as boolean) ?? false
              : true;
            const active = frameMode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => supported && onFrameMode(opt.value)}
                style={{
                  width: "100%",
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: active
                    ? "1px solid rgba(14,165,160,0.35)"
                    : "1px solid transparent",
                  background: active ? "rgba(14,165,160,0.1)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: supported ? "pointer" : "not-allowed",
                  opacity: supported ? 1 : 0.3,
                  transition: "all 0.15s",
                  color: active ? "#22D3EE" : "#64748B",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => {
                  if (supported && !active)
                    (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                }}
                onMouseLeave={e => {
                  if (supported && !active)
                    (e.currentTarget as HTMLElement).style.color = "#64748B";
                }}
              >
                {opt.label}
                {!supported && (
                  <span style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "0.05em" }}>
                    N/A
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── Duration ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Duration</SectionLabel>
        <PillRow
          options={availableDurs}
          value={duration}
          onChange={onDuration}
          getLabel={v => `${v}s`}
        />
      </div>

      {/* ── Aspect Ratio ─────────────────────────────────────────── */}
      <div>
        <SectionLabel>Aspect Ratio</SectionLabel>
        <PillRow
          options={availableARs}
          value={aspectRatio}
          onChange={onAspectRatio}
        />
      </div>

      {/* ── Quality ──────────────────────────────────────────────── */}
      {hasPro && (
        <div>
          <SectionLabel>Quality</SectionLabel>
          <PillRow
            options={["std", "pro"] as Quality[]}
            value={quality}
            onChange={onQuality}
            getLabel={v => v === "std" ? "Standard" : "Pro"}
          />
        </div>
      )}

      {/* ── Camera Motion (collapsible) ───────────────────────────── */}
      {hasCamera && caps?.cameraPresets && (
        <>
          <Divider />
          <Collapsible label="Camera Motion" defaultOpen={false}>
            <CameraPresetPicker
              presets={caps.cameraPresets.filter(p => p !== "simple") as CameraPreset[]}
              value={cameraPreset}
              onChange={onCameraPreset}
            />
          </Collapsible>
        </>
      )}

      {/* ── Spacer ───────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Credit summary ───────────────────────────────────────── */}
      <div
        style={{
          padding: "11px 13px",
          borderRadius: 10,
          background: insufficient
            ? "rgba(239,68,68,0.05)"
            : "rgba(14,165,160,0.05)",
          border: `1px solid ${insufficient ? "rgba(239,68,68,0.18)" : "rgba(14,165,160,0.12)"}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Credits
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#64748B" }}>This generation</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0EA5A0" }}>~{creditEstimate}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#64748B" }}>Balance</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: insufficient ? "#EF4444" : "#94A3B8" }}>
            {userCredits}
          </span>
        </div>

        {insufficient && (
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "#EF4444",
              fontWeight: 600,
              textAlign: "center",
              padding: "5px 8px",
              borderRadius: 6,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
            }}
          >
            Insufficient — top up to continue
          </div>
        )}
      </div>
    </div>
  );
}
