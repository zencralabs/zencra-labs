"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoLeftRail — Left sidebar: tool switcher, frame mode, settings, credits
// ─────────────────────────────────────────────────────────────────────────────

import { VIDEO_MODEL_REGISTRY, type VideoModel, CAMERA_PRESET_LABELS, type CameraPreset } from "@/lib/ai/video-model-registry";
import type { FrameMode, VideoAR, Quality } from "./types";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#334155",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          paddingBottom: 4,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Pill row selector ─────────────────────────────────────────────────────────

function PillRow<T extends string>({
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
            key={opt}
            onClick={() => !disabled && onChange(opt)}
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 8,
              border: active
                ? "1px solid rgba(14,165,160,0.5)"
                : "1px solid rgba(255,255,255,0.06)",
              background: active ? "rgba(14,165,160,0.14)" : "rgba(255,255,255,0.025)",
              color: active ? "#0EA5A0" : "#475569",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {getLabel ? getLabel(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Camera preset selector ────────────────────────────────────────────────────

function CameraPresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: CameraPreset[];
  value: CameraPreset | null;
  onChange: (v: CameraPreset | null) => void;
}) {
  const allPresets: Array<CameraPreset | null> = [null, ...presets];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {allPresets.map(p => {
        const label = p ? CAMERA_PRESET_LABELS[p] : "None";
        const active = value === p;
        return (
          <button
            key={p ?? "none"}
            onClick={() => onChange(p)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: active
                ? "1px solid rgba(14,165,160,0.4)"
                : "1px solid rgba(255,255,255,0.05)",
              background: active ? "rgba(14,165,160,0.1)" : "rgba(255,255,255,0.02)",
              color: active ? "#0EA5A0" : "#475569",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {active && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

// ── Tool switcher ─────────────────────────────────────────────────────────────

function ToolSwitcher({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const models = VIDEO_MODEL_REGISTRY;

  const providerGroups = [
    { key: "kling",     label: "Kling",    color: "#0EA5A0" },
    { key: "seedance",  label: "Seedance", color: "#A855F7" },
    { key: "runway",    label: "Runway",   color: "#F59E0B" },
    { key: "veo",       label: "Veo",      color: "#10B981" },
    { key: "ltx",       label: "LTX",      color: "#6366F1" },
    { key: "heygen",    label: "HeyGen",   color: "#EC4899" },
    { key: "luma",      label: "Luma",     color: "#64748B" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {providerGroups.map(({ key, label, color }) => {
        const groupModels = models.filter(m => m.provider === key);
        if (groupModels.length === 0) return null;

        return (
          <div key={key}>
            {/* Provider label */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#334155",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "6px 2px 4px",
              }}
            >
              {label}
            </div>

            {/* Model buttons */}
            {groupModels.map(model => {
              const active = model.id === selectedId;
              return (
                <button
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: active
                      ? `1px solid ${color}55`
                      : "1px solid transparent",
                    background: active
                      ? `${color}18`
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        color: active ? color : "#94A3B8",
                      }}
                    >
                      {model.displayName}
                    </span>
                    {active && (
                      <span style={{ fontSize: 10, color: "#475569", lineHeight: 1.3 }}>
                        {model.description.length > 38
                          ? model.description.slice(0, 38) + "…"
                          : model.description}
                      </span>
                    )}
                  </div>

                  {/* Badge */}
                  {model.badge && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        color: model.badgeColor ?? color,
                        background: `${model.badgeColor ?? color}22`,
                        border: `1px solid ${model.badgeColor ?? color}44`,
                        borderRadius: 4,
                        padding: "2px 5px",
                        flexShrink: 0,
                      }}
                    >
                      {model.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Frame mode option ─────────────────────────────────────────────────────────

interface FrameModeOption {
  value: FrameMode;
  label: string;
  icon: React.ReactNode;
  requiresCap?: keyof import("@/lib/ai/video-model-registry").VideoModelCapabilities;
}

const FRAME_MODE_OPTIONS: FrameModeOption[] = [
  {
    value: "text_to_video",
    label: "Text to Video",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
      </svg>
    ),
    requiresCap: "textToVideo",
  },
  {
    value: "start_frame",
    label: "Start Frame",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    requiresCap: "startFrame",
  },
  {
    value: "start_end",
    label: "Start + End",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="9" height="9" rx="1" /><rect x="13" y="3" width="9" height="9" rx="1" /><line x1="6.5" y1="12" x2="6.5" y2="21" /><line x1="17.5" y1="12" x2="17.5" y2="21" /><line x1="6.5" y1="17" x2="17.5" y2="17" />
      </svg>
    ),
    requiresCap: "endFrame",
  },
  {
    value: "extend",
    label: "Extend",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 12 19 12" /><polyline points="15 8 19 12 15 16" />
      </svg>
    ),
    requiresCap: "extendVideo",
  },
  {
    value: "lip_sync",
    label: "Lip Sync",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      </svg>
    ),
    requiresCap: "lipSync",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  selectedModelId: string;
  frameMode: FrameMode;
  aspectRatio: VideoAR;
  quality: Quality;
  duration: number;
  cameraPreset: CameraPreset | null;
  onModelSelect: (id: string) => void;
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
  selectedModelId,
  frameMode,
  aspectRatio,
  quality,
  duration,
  cameraPreset,
  onModelSelect,
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

  const availableFrameModes = FRAME_MODE_OPTIONS.filter(opt => {
    if (!opt.requiresCap) return true;
    return caps ? (caps[opt.requiresCap] as boolean) : false;
  });

  const availableDurations = caps?.durations ?? [5];
  const availableARs: VideoAR[] = (caps?.aspectRatios as VideoAR[]) ?? ["16:9"];
  const hasCamera = caps?.cameraControl && (caps?.cameraPresets?.length ?? 0) > 1;
  const hasPro = caps?.proMode;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        height: "100%",
        overflowY: "auto",
        paddingRight: 2,
        // Custom scrollbar
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.08) transparent",
      }}
    >

      {/* ── 1. Tool Switcher ─────────────────────────────────────────────── */}
      <Section label="Model">
        <ToolSwitcher selectedId={selectedModelId} onSelect={onModelSelect} />
      </Section>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />

      {/* ── 2. Frame Mode ────────────────────────────────────────────────── */}
      <Section label="Mode">
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {FRAME_MODE_OPTIONS.map(opt => {
            const available = availableFrameModes.some(a => a.value === opt.value);
            const active = frameMode === opt.value;

            return (
              <button
                key={opt.value}
                onClick={() => available && onFrameMode(opt.value)}
                title={available ? undefined : `${opt.label} not supported by ${model?.displayName}`}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: active
                    ? "1px solid rgba(14,165,160,0.4)"
                    : "1px solid transparent",
                  background: active ? "rgba(14,165,160,0.1)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: available ? "pointer" : "not-allowed",
                  opacity: available ? 1 : 0.3,
                  transition: "all 0.15s",
                  color: active ? "#0EA5A0" : "#64748B",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => {
                  if (available && !active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                  }
                }}
                onMouseLeave={e => {
                  if (available && !active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "#64748B";
                  }
                }}
              >
                {opt.icon}
                {opt.label}
                {!available && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "0.05em" }}>
                    N/A
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />

      {/* ── 3. Duration ──────────────────────────────────────────────────── */}
      <Section label="Duration">
        <PillRow
          options={availableDurations as unknown as string[]}
          value={String(duration)}
          onChange={v => onDuration(Number(v))}
          getLabel={v => `${v}s`}
        />
      </Section>

      {/* ── 4. Aspect Ratio ──────────────────────────────────────────────── */}
      <Section label="Aspect Ratio">
        <PillRow
          options={availableARs}
          value={aspectRatio}
          onChange={onAspectRatio}
        />
      </Section>

      {/* ── 5. Quality ───────────────────────────────────────────────────── */}
      {hasPro && (
        <Section label="Quality">
          <PillRow
            options={["std", "pro"] as Quality[]}
            value={quality}
            onChange={onQuality}
            getLabel={v => v === "std" ? "Standard" : "Pro"}
          />
        </Section>
      )}

      {/* ── 6. Camera presets ────────────────────────────────────────────── */}
      {hasCamera && caps?.cameraPresets && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />
          <Section label="Camera Motion">
            <CameraPresetPicker
              presets={caps.cameraPresets.filter(p => p !== "simple") as CameraPreset[]}
              value={cameraPreset}
              onChange={onCameraPreset}
            />
          </Section>
        </>
      )}

      {/* ── 7. Credit estimate card ──────────────────────────────────────── */}
      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(14,165,160,0.04)",
            border: "1px solid rgba(14,165,160,0.12)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Credits
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>This generation</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0EA5A0" }}>~{creditEstimate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>Your balance</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: userCredits < creditEstimate ? "#EF4444" : "#94A3B8",
              }}
            >
              {userCredits}
            </span>
          </div>
          {userCredits < creditEstimate && (
            <div
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 7,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                fontSize: 11,
                color: "#EF4444",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              Insufficient — top up to generate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
