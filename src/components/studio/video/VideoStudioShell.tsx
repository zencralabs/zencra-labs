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
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  VIDEO_MODEL_REGISTRY,
  type VideoModel,
  type CameraPreset,
} from "@/lib/ai/video-model-registry";
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
import { FullscreenPreview } from "@/components/ui/FullscreenPreview";

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_CREDITS  = 500;
const POLL_INTERVAL = 4000;
const MAX_POLLS     = 60;
const SIDE_GUTTER   = 20;

// ── Per-model accent color ────────────────────────────────────────────────────

function modelAccentColor(m: VideoModel): string {
  if (m.badgeColor) return m.badgeColor;
  if (m.provider === "kling") return "#0EA5A0";
  return "#0EA5A0";
}

// ── Credit estimate ───────────────────────────────────────────────────────────

const CREDIT_RATES: Record<string, Record<string, Record<number, number>>> = {
  "kling-30": { std: { 5: 38, 10: 68 }, pro: { 5: 58, 10: 98 } },
  "kling-26": { std: { 5: 28, 10: 48 }, pro: { 5: 45, 10: 78 } },
  "kling-25": { std: { 5: 18, 10: 32 }, pro: { 5: 28, 10: 52 } },
};
function estimateCredits(id: string, q: string, d: number) {
  return CREDIT_RATES[id]?.[q]?.[d] ?? Math.round(d * 5);
}

// ── Family accent colors ──────────────────────────────────────────────────────

const FAMILY_ACCENT: Record<string, string> = {
  kling:    "#0EA5A0",
  seedance: "#6366F1",
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

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Pill trigger — no onClick, hover on parent wrapper opens the panel */}
      <button
        style={{
          padding: "9px 14px 9px 18px",
          borderRadius: 10,
          border: isActive
            ? `1px solid ${accent}99`
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
          transition: "all 0.15s ease",
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: isActive ? `0 0 15px ${accent}44` : "none",
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
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const klingModels    = VIDEO_MODEL_REGISTRY.filter(m => m.provider === "kling");
  const seedanceModels = VIDEO_MODEL_REGISTRY.filter(m => m.provider === "seedance");
  const otherModels    = VIDEO_MODEL_REGISTRY.filter(m => m.provider !== "kling" && m.provider !== "seedance");

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

        {/* Kling family — pill shows Kling 3.0 by default; dropdown: Kling 2.6, Kling 2.5 Turbo */}
        <FamilyPill
          models={klingModels}
          selectedId={selectedId}
          onSelect={onSelect}
          accent={familyAccent("kling")}
          defaultId="kling-30"
        />
        <ChipDivider />

        {/* Seedance family — pill shows Seedance 2.0 NEW by default; dropdown: 2.0 FAST, 1.5 Pro */}
        <FamilyPill
          models={seedanceModels}
          selectedId={selectedId}
          onSelect={onSelect}
          accent={familyAccent("seedance")}
          defaultId="seedance-20"
        />

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
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#F8FAFC";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                  }
                }}
                onMouseLeave={e => {
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
      </div>
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
          Add <code style={{ color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>SEEDANCE_15_MODEL_ID</code> to your <code style={{ color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>.env.local</code> and redeploy.
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
    (startFrameParam || flowParam === "animate" || flowParam === "start-frame") ? "start_frame" : "text_to_video"
  );
  const [aspectRatio,    setAspectRatio]    = useState<VideoAR>("16:9");
  const [quality,        setQuality]        = useState<Quality>("std");
  const [duration,       setDuration]       = useState<number>(5);
  const [cameraPreset,   setCameraPreset]   = useState<CameraPreset | null>(null);
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
  const [prompt,    setPrompt]    = useState(searchParams.get("prompt") ?? "");
  const [negPrompt, setNegPrompt] = useState("");

  // Generation (Kling/video)
  const [generating, setGenerating] = useState(false);
  const [videos,     setVideos]     = useState<GeneratedVideo[]>([]);

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

  // ── Auth token for Lip Sync ────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastState, setToastState] = useState<{ msg: string; variant: "success" | "error" | "info" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, variant: "success" | "error" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState({ msg, variant });
    toastTimerRef.current = setTimeout(() => setToastState(null), 3200);
  }, []);

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
      lip_sync:       true,
      motion_control: caps.motionControl,
    };
    if (!allowed[frameMode]) setFrameMode("text_to_video");
    if (!caps.durations.includes(duration))       setDuration(caps.durations[0] ?? 5);
    if (!caps.aspectRatios.includes(aspectRatio)) setAspectRatio((caps.aspectRatios[0] ?? "16:9") as VideoAR);
    // Reset resolution to first supported value when switching models
    if (caps.resolutions && caps.resolutions.length > 0 && !caps.resolutions.includes(resolution)) {
      setResolution(caps.resolutions[0]);
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
      status: "generating",
      provider: model.provider,
      creditsUsed: estimateCredits(model.id, quality, duration),
      createdAt: Date.now(),
      isPublic: false,
    };
    setVideos(prev => [newVideo, ...prev]);

    // Scroll to the new card after React paints it
    setTimeout(() => {
      const cardEl = videoCardRefs.current[newVideo.id];
      if (cardEl && !isElementMostlyVisible(cardEl)) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (!cardEl) {
        // Fallback to gallery container if card ref not mounted yet
        const el = videoResultsRef.current;
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);

    try {
      // motion_control routes to its own dedicated backend provider — do NOT send to kling-30
      const modelKey = frameMode === "motion_control" ? "kling-motion-control" : model.id;

      console.log("[VideoStudio] dispatch", { modelKey, prompt, aspectRatio, durationSeconds: duration });

      const body: Record<string, unknown> = {
        modelKey,
        prompt,
        negativePrompt:  negPrompt || undefined,
        durationSeconds: duration,
        aspectRatio,
        providerParams: {
          videoMode: quality,
          ...(resolution   ? { resolution }   : {}),
          ...(cameraPreset ? { cameraPreset } : {}),
        },
      };

      // start_frame = Image Reference. imageUrl = start frame; endImageUrl = end frame.
      if (frameMode === "start_frame" && startSlot.url)                              body.imageUrl    = startSlot.url;
      if (frameMode === "start_frame" && endSlot.url && model.capabilities.endFrame) body.endImageUrl = endSlot.url;

      // motion_control: referenceVideoUrl = motion reference video; imageUrl = subject image
      if (frameMode === "motion_control" && motionVideoUrl) body.referenceVideoUrl = motionVideoUrl;
      if (frameMode === "motion_control" && startSlot.url)  body.imageUrl          = startSlot.url;

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
        try { const e = await res.json(); if (e.error) errMsg = e.error; } catch { /* ignore */ }
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

      let polls = 0;
      const poll = setInterval(async () => {
        polls++;
        if (polls > MAX_POLLS) {
          clearInterval(poll);
          setVideos(prev => prev.map(v =>
            v.id === newVideo.id ? { ...v, status: "error", error: "Timed out" } : v,
          ));
          showToast("Generation timed out — please try again", "error");
          setGenerating(false);
          return;
        }
        try {
          const sr = await fetch(`/api/studio/jobs/${jobId}/status`, {
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${user.accessToken}`,
            },
          });
          const sd     = await sr.json() as { data?: { status: string; url?: string; error?: string } };
          const status = sd.data?.status;
          const url    = sd.data?.url;
          if (status === "success" && url) {
            clearInterval(poll);
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id
                ? { ...v, status: "done", url, thumbnailUrl: null }
                : v,
            ));
            void recordFlowStep({
              modelKey:    modelKey,
              prompt:      prompt,
              resultUrl:   url,
              aspectRatio: aspectRatio,
            });
            setGenerating(false);
          } else if (status === "error") {
            clearInterval(poll);
            const errMsg = sd.data?.error ?? "Generation failed";
            setVideos(prev => prev.map(v =>
              v.id === newVideo.id ? { ...v, status: "error", error: errMsg } : v,
            ));
            showToast("Generation failed — please try again", "error");
            setGenerating(false);
          }
        } catch { /* ignore transient poll errors */ }
      }, POLL_INTERVAL);
    } catch (err) {
      setVideos(prev => prev.map(v =>
        v.id === newVideo.id ? { ...v, status: "error", error: String(err) } : v,
      ));
      showToast("Generation failed — please try again", "error");
      setGenerating(false);
    }
  }, [
    user, frameMode, model, generating, prompt, negPrompt, duration, aspectRatio,
    quality, resolution, cameraPreset, startSlot, endSlot, motionVideoUrl,
    motionStrength, motionArea, lipSyncCreate, recordFlowStep, showToast,
  ]);


  const handleReusePrompt = useCallback((video: GeneratedVideo) => {
    setPrompt(video.prompt ?? "");
    setNegPrompt(video.negPrompt ?? "");
  }, []);

  const handleDelete = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
    showToast("Video removed from session", "info");
  }, [showToast]);

  // Cinema focus mode — canvas glows more when actively working
  const cinemaModeActive = frameMode !== "text_to_video";

  const effectiveGenerating = frameMode === "lip_sync"
    ? lipSyncState.isGenerating
    : generating;

  const creditEstimate = model ? estimateCredits(model.id, quality, duration) : 0;
  void creditEstimate;

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
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      paddingTop: 80,
      boxSizing: "border-box",
    }}>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <Breadcrumb modelName={model?.displayName ?? "Video Studio"} />

      {/* ── Tool bar — family dropdowns for Kling & Seedance ─────── */}
      <FamilyDropdownBar selectedId={selectedModelId} onSelect={setSelectedModelId} />

      {/* ── 3-column workspace ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr 340px",
        columnGap: 14,
        alignItems: "start",
        width: "100%",
        paddingBottom: 28,
        boxSizing: "border-box",
      }}>

        {/* Left rail — z-index:10 keeps it below the tool-bar dropdown (z-index:50) */}
        <div style={{
          paddingLeft: SIDE_GUTTER,
          paddingRight: 12,
          paddingTop: 14,
          paddingBottom: 14,
          height: "100%",
          minHeight: 0,
          position: "sticky",
          top: 88,
          zIndex: 10,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.28)",
          borderRadius: 12,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          opacity: cinemaModeActive ? 0.88 : 1,
          transition: "opacity 0.35s ease",
          boxSizing: "border-box",
        }}>
          <VideoLeftRail
            frameMode={frameMode}
            aspectRatio={aspectRatio}
            quality={quality}
            duration={duration}
            resolution={resolution}
            cameraPreset={cameraPreset}
            motionStrength={motionStrength}
            motionArea={motionArea}
            onFrameMode={setFrameMode}
            onAspectRatio={setAspectRatio}
            onQuality={setQuality}
            onDuration={setDuration}
            onResolution={setResolution}
            onCameraPreset={setCameraPreset}
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
          {/* ── Motion Flow strip — workflow context above canvas ─── */}
          <MotionFlowStrip
            frameMode={frameMode}
            endFrameEnabled={model?.capabilities.endFrame}
            hasStartSlot={!!startSlot.url}
            hasEndSlot={!!endSlot.url}
          />

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
            />
          )}
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
          />
        </div>
      </div>

      {/* ── Gallery — full viewport width ──────────────────────── */}
      <div
        ref={videoResultsRef}
        style={{
          width: "100%",
          borderTop: videoGlow ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.06)",
          paddingTop: 28,
          paddingLeft: SIDE_GUTTER,
          paddingRight: SIDE_GUTTER,
          paddingBottom: 48,
          boxSizing: "border-box",
          transition: "border-color 0.6s ease-out",
          boxShadow: videoGlow ? "0 0 28px rgba(59,130,246,0.14)" : "none",
        }}
      >
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#475569",
          letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 20,
        }}>
          Your Videos
        </div>
        <VideoResultsLibrary
          videos={videos}
          onReusePrompt={handleReusePrompt}
          onDelete={handleDelete}
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
