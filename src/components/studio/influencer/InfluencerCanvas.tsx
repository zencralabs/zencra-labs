"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Canvas — Center panel
// Manages 3 states: empty → candidates → selected
// Pack sections animate into view below the hero. Progressive reveal only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CanvasState, ActiveInfluencer } from "./AIInfluencerBuilder";
import type { PackType, StyleCategory } from "@/lib/influencer/types";
import { formatHandle } from "@/lib/ai-influencer/format-handle";
import CandidateCarousel      from "./candidate/CandidateCarousel";
import CandidatePreviewModal  from "./candidate/CandidatePreviewModal";
import CandidateCompareTray   from "./candidate/CandidateCompareTray";
import CandidateControls      from "./candidate/CandidateControls";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:      "#07090f",
  border:  "#111827",
  surface: "#0b0e17",
  text:    "#e8eaf0",
  muted:   "#8b92a8",
  ghost:   "#3d4560",
  amber:   "#f59e0b",
  green:   "#10b981",
} as const;

// ── Category visual palette ───────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<StyleCategory, string> = {
  "hyper-real":       "#f59e0b",
  "3d-animation":     "#38bdf8",
  "anime-manga":      "#f472b6",
  "fine-art":         "#d4a054",
  "game-concept":     "#8b5cf6",
  "physical-texture": "#c2715a",
  "retro-pixel":      "#84cc16",
};

function getCategoryAccent(cat?: StyleCategory | null): string {
  return cat ? (CATEGORY_ACCENT[cat] ?? "#f59e0b") : "#f59e0b";
}

// ── Pack action definitions ───────────────────────────────────────────────────

const PACK_ACTIONS: Array<{
  type: PackType;
  label: string;
  cta: string;
  accent: string;
  descriptor: string;
}> = [
  { type: "identity-sheet", label: "Identity Sheet", cta: "Build Sheet",       accent: "#e2e8f0", descriptor: "5-angle character reference" },
  { type: "look-pack",      label: "Look Pack",      cta: "Create Looks",      accent: "#f59e0b", descriptor: "Outfit variations for your influencer" },
  { type: "scene-pack",     label: "Scene Pack",     cta: "Build Scenes",      accent: "#10b981", descriptor: "Place them in real-world environments" },
  { type: "pose-pack",      label: "Pose Pack",      cta: "Create Poses",      accent: "#3b82f6", descriptor: "Dynamic body positions and angles" },
  { type: "social-pack",    label: "Social Pack",    cta: "Create Social",     accent: "#a855f7", descriptor: "Formats ready for every platform" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  canvasState:           CanvasState;
  onCandidatesReady:     (influencer_id: string, candidateUrls: string[]) => void;
  onSelected:            (active: ActiveInfluencer) => void;
  onCreateClick:         () => void;   // handleCreateInfluencer — single source of truth
  isCreating:            boolean;      // true while API calls are in flight
  createError:           string | null;
  selectedStyleCategory: StyleCategory; // drives dock button color in empty phase
}

// ── Pack output state ─────────────────────────────────────────────────────────

interface PackOutput {
  type:    PackType;
  label:   string;
  accent:  string;
  descriptor: string;
  status:  "loading" | "complete" | "failed";
  images:  Array<{ url: string; label: string }>;
}

// ── Pack UI state ─────────────────────────────────────────────────────────────

type PackUiState = "locked" | "ready" | "generating" | "completed";

/**
 * Derives the cinematic UI state for a pack.
 * Source of truth: packOutputs (generation status) + sequential unlock rule.
 * - Identity Sheet (idx 0) is always "ready" on load
 * - Each subsequent pack unlocks only after the previous one completes
 * - "failed" → treated as "ready" so the user can retry
 */
function getPackUiState(packType: PackType, packOutputs: PackOutput[]): PackUiState {
  const output = packOutputs.find(p => p.type === packType);

  if (output) {
    if (output.status === "loading")  return "generating";
    if (output.status === "complete") return "completed";
    return "ready"; // failed → retry
  }

  const idx = PACK_ACTIONS.findIndex(p => p.type === packType);
  if (idx === 0) return "ready"; // Identity Sheet is always the foundation

  const prevType   = PACK_ACTIONS[idx - 1].type;
  const prevOutput = packOutputs.find(p => p.type === prevType);
  return prevOutput?.status === "complete" ? "ready" : "locked";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InfluencerCanvas({
  canvasState, onCandidatesReady, onSelected,
  onCreateClick, isCreating, createError, selectedStyleCategory,
}: Props) {
  const [packOutputs, setPackOutputs]   = useState<PackOutput[]>([]);
  const [activePack,  setActivePack]    = useState<PackType | null>(null);
  const packSectionRef = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLDivElement>(null);

  // Reset packs when influencer changes
  useEffect(() => {
    setPackOutputs([]);
    setActivePack(null);
  }, [canvasState.phase === "selected" ? canvasState.active?.influencer.id : null]);

  const handleTriggerPack = useCallback(
    async (packType: PackType) => {
      if (canvasState.phase !== "selected") return;
      const { active } = canvasState;
      if (!active.identity_lock_id || !active.canonical_asset_id) return;

      const packDef = PACK_ACTIONS.find(p => p.type === packType)!;

      // Add loading section immediately — then animate in
      setPackOutputs(prev => {
        if (prev.some(p => p.type === packType)) return prev; // already triggered
        return [...prev, {
          type:       packType,
          label:      packDef.label,
          accent:     packDef.accent,
          descriptor: packDef.descriptor,
          status:     "loading",
          images:     [],
        }];
      });
      setActivePack(packType);

      // Scroll to pack section after animation frame
      setTimeout(() => {
        packSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 320);

      // Dispatch pack generation
      try {
        const res = await fetch(
          `/api/character/ai-influencers/${active.influencer.id}/packs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              pack_type:          packType,
              identity_lock_id:   active.identity_lock_id,
              canonical_asset_id: active.canonical_asset_id,
            }),
          },
        );

        if (!res.ok) {
          setPackOutputs(prev =>
            prev.map(p => p.type === packType ? { ...p, status: "failed" } : p),
          );
          return;
        }

        const data = await res.json();
        const jobs: Array<{ jobId: string; label: string }> = data.data?.jobs ?? [];

        // Poll each job for its result URL
        const images: Array<{ url: string; label: string }> = [];
        await Promise.all(
          jobs.map(async ({ jobId, label }) => {
            const url = await pollJobForUrl(jobId);
            if (url) images.push({ url, label });
          }),
        );

        setPackOutputs(prev =>
          prev.map(p =>
            p.type === packType
              ? { ...p, status: images.length > 0 ? "complete" : "failed", images }
              : p,
          ),
        );
        // Auto-focus the output panel on the pack that just completed
        setActivePack(packType);
      } catch (err) {
        console.error("[triggerPack]", err);
        setPackOutputs(prev =>
          prev.map(p => p.type === packType ? { ...p, status: "failed" } : p),
        );
      }
    },
    [canvasState],
  );

  // ── Derive accent from current category ─────────────────────────────────────
  // In empty phase, track the form's selected style category so the dock button
  // colour updates live as the user picks a style in the right panel.

  const currentAccent = (() => {
    if (canvasState.phase === "generating" || canvasState.phase === "candidates") {
      return getCategoryAccent(canvasState.style_category);
    }
    if (canvasState.phase === "selected") {
      return getCategoryAccent(canvasState.active.influencer.style_category);
    }
    // empty — use the form's currently selected category
    return getCategoryAccent(selectedStyleCategory);
  })();

  const isPixelArt =
    (canvasState.phase === "generating" || canvasState.phase === "candidates")
      ? canvasState.style_category === "retro-pixel"
      : canvasState.phase === "selected"
        ? canvasState.active.influencer.style_category === "retro-pixel"
        : false;

  // ── Cross-studio routing ────────────────────────────────────────────────────

  const router = useRouter();

  function goImageFlow() {
    if (canvasState.phase === "selected") {
      const { active } = canvasState;
      const params = new URLSearchParams({
        influencer_id:    active.influencer.id,
        identity_lock_id: active.identity_lock_id ?? "",
      });
      router.push(`/studio/image?${params.toString()}`);
    } else {
      router.push("/studio/image");
    }
  }

  function goVideoFlow() {
    if (canvasState.phase === "selected") {
      const { active } = canvasState;
      const params = new URLSearchParams({
        influencer_id:    active.influencer.id,
        identity_lock_id: active.identity_lock_id ?? "",
        mode:             "start-frame",
      });
      router.push(`/studio/video?${params.toString()}`);
    } else {
      router.push("/studio/video");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasSelected = canvasState.phase === "selected";

  return (
    <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>

      {/* Scrollable canvas area */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          overflowY: "auto",
          background: T.bg,
          display: "flex",
          flexDirection: "column",
          // Subtle pixel grid overlay for retro-pixel category
          backgroundImage: isPixelArt
            ? "linear-gradient(rgba(132,204,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(132,204,22,0.04) 1px, transparent 1px)"
            : undefined,
          backgroundSize: isPixelArt ? "8px 8px" : undefined,
          paddingBottom: 80, // room for the dock
        }}
      >
        {canvasState.phase === "empty"      && <EmptyState accent={currentAccent} />}
        {canvasState.phase === "generating" && (
          <GeneratingState
            influencer_id={canvasState.influencer_id}
            jobIds={canvasState.jobs}
            accent={currentAccent}
            onReady={onCandidatesReady}
          />
        )}
        {canvasState.phase === "candidates" && (
          <CandidatesState
            influencer_id={canvasState.influencer_id}
            candidates={canvasState.candidates}
            accent={currentAccent}
            onSelected={onSelected}
          />
        )}
        {canvasState.phase === "selected" && (
          <SelectedState
            active={canvasState.active}
            accent={currentAccent}
            packOutputs={packOutputs}
            activePack={activePack}
            onTriggerPack={handleTriggerPack}
            onSetActivePack={setActivePack}
            packSectionRef={packSectionRef}
          />
        )}
      </div>

      {/* ── Floating Action Dock ──────────────────────────────────────── */}
      <CanvasDock
        phase={canvasState.phase}
        accent={currentAccent}
        hasSelected={hasSelected}
        onImageFlow={goImageFlow}
        onVideoFlow={goVideoFlow}
        onCreateClick={onCreateClick}
        isCreating={isCreating}
        createError={createError}
      />
    </div>
  );
}

// ── STATE 1: Empty ────────────────────────────────────────────────────────────

// Shared label style for all composition frame annotations
const FRAME_LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 10, left: 12,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.32)",
  fontWeight: 500,
  lineHeight: 1,
  pointerEvents: "none",
  userSelect: "none",
};

function EmptyState({ accent }: { accent: string }) {
  return (
    <div style={{
      flex: 1, position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 32px", textAlign: "center",
      overflow: "hidden",
    }}>

      {/* ── Keyframes ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes canvasBreath {
          0%,  100% { box-shadow: inset 0 0 40px rgba(255,255,255,0.018), 0 0 60px  rgba(245,158,11,0.05); }
          50%        { box-shadow: inset 0 0 40px rgba(255,255,255,0.028), 0 0 100px rgba(245,158,11,0.09); }
        }
        @keyframes canvasBreathOuter {
          0%,  100% { box-shadow: 0 0 60px  rgba(245,158,11,0.05); }
          50%        { box-shadow: 0 0 100px rgba(245,158,11,0.10); }
        }
        @keyframes iconPulse {
          0%,  100% { transform: scale(1);    opacity: 0.9; }
          50%        { transform: scale(1.06); opacity: 1;   }
        }
      `}</style>

      {/* ── Layer 1: soft amber radial behind center ─────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle at 50% 46%, rgba(245,158,11,0.13), transparent 38%)",
      }} />

      {/* ── Layer 2: faint cinematic grid ───────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: [
          "linear-gradient(to right,  rgba(255,255,255,0.035) 1px, transparent 1px)",
          "linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "96px 96px",
        opacity: 0.12,
      }} />

      {/* ── Layer 3: bottom vignette ─────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: "auto 0 0 0",
        height: 288, pointerEvents: "none",
        background: "linear-gradient(to top, rgba(0,0,0,0.60), transparent)",
      }} />

      {/* ── Composition stage — 16:9 outer + inner guides ───────────── */}
      {/* zIndex: 1 keeps this behind the message content at zIndex: 10  */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(92%, 1280px)",
        maxHeight: "85%",
        aspectRatio: "16 / 9",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.012)",
        flexShrink: 0,
        pointerEvents: "none",
        transform: "perspective(1200px) rotateX(2deg)",
        animation: "canvasBreathOuter 6s ease-in-out infinite",
      }}>
        {/* "Cinematic" label — outer 16:9 frame annotation */}
        <span style={FRAME_LABEL_STYLE}>Cinematic</span>

        {/* 9:16 vertical guide — influencer / full-body, left of center */}
        <div style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%) perspective(1200px) rotateX(2deg) scale(0.98)",
          left: "34%",
          height: "84%", aspectRatio: "9 / 16",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.018)",
          borderRadius: 0,
          opacity: 0.8,
          animation: "canvasBreath 8s ease-in-out infinite",
        }}>
          <span style={FRAME_LABEL_STYLE}>Influencer</span>
        </div>

        {/* 1:1 square guide — social avatar / profile, right of center */}
        <div style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%) perspective(1200px) rotateX(2deg) scale(0.98)",
          left: "52%",
          height: "56%", aspectRatio: "1 / 1",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.018)",
          borderRadius: 0,
          opacity: 0.8,
          animation: "canvasBreath 8s ease-in-out infinite",
        }}>
          <span style={FRAME_LABEL_STYLE}>Profile</span>
        </div>
      </div>

      {/* ── Message — absolute over the stage, z-10 ──────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 10, pointerEvents: "none",
      }}>
        {/* Icon halo + icon */}
        <div style={{
          width: 120, height: 120, borderRadius: "50%", marginBottom: 32,
          background: `radial-gradient(ellipse, ${accent}22 0%, transparent 70%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          transition: "background 0.4s ease",
        }}>
          {/* Halo ring — pulses slowly */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            boxShadow: "0 0 40px rgba(245,158,11,0.25), 0 0 80px rgba(245,158,11,0.10)",
            animation: "iconPulse 4s ease-in-out infinite",
            pointerEvents: "none",
          }} />
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `${accent}12`,
            border: `1px solid ${accent}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 40px ${accent}22`,
            transition: "all 0.4s ease",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
        </div>

        <h2 style={{
          fontSize: 22, fontWeight: 800, color: T.text,
          letterSpacing: "-0.02em", marginBottom: 10,
          pointerEvents: "auto",
        }}>
          Create Your Digital Human
        </h2>
        <p style={{
          fontSize: 15, color: T.muted, lineHeight: 1.65,
          maxWidth: 380, marginBottom: 0,
          pointerEvents: "auto",
        }}>
          Create a realistic digital creator and build content-ready visuals — reusable across every studio.
        </p>
      </div>

    </div>
  );
}

// ── STATE 2: Generating — Cinematic shimmer (NO spinner) ─────────────────────

const GENERATING_LINES = [
  "Rendering identity candidates…",
  "Building facial geometry…",
  "Applying style signatures…",
  "Compositing lighting pass…",
  "Finalising candidates…",
];

function GeneratingState({
  influencer_id,
  jobIds,
  accent,
  onReady,
}: {
  influencer_id: string;
  jobIds: string[];
  accent: string;
  onReady: (influencer_id: string, urls: string[]) => void;
}) {
  const [progress,   setProgress]   = useState(0);
  const [completed,  setCompleted]  = useState(0);
  const [lineIdx,    setLineIdx]    = useState(0);
  const total = jobIds.length || 4;

  // Ambient progress creep
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 4, 78));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Rotate status text every 2.8s
  useEffect(() => {
    const interval = setInterval(() => {
      setLineIdx(i => (i + 1) % GENERATING_LINES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Poll all jobs
  useEffect(() => {
    if (jobIds.length === 0) return;
    let cancelled = false;

    async function pollAll() {
      const results = await Promise.all(
        jobIds.map(async jobId => {
          const url = await pollJobForUrl(jobId);
          if (!cancelled) setCompleted(c => c + 1);
          return url;
        }),
      );
      if (cancelled) return;
      const urls = results.filter((u): u is string => !!u);
      setProgress(100);
      setTimeout(() => { if (!cancelled) onReady(influencer_id, urls); }, 400);
    }

    pollAll().catch(console.error);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIds.join(",")]);

  const displayProgress = jobIds.length > 0
    ? Math.round((completed / total) * 100)
    : progress;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "32px 32px 24px", gap: 0,
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes genShimmerSweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
        @keyframes genShimmerPulse {
          0%, 100% { opacity: 0.28; }
          50%       { opacity: 0.50; }
        }
        @keyframes genGlowBreath {
          0%, 100% { opacity: 0.20; }
          50%       { opacity: 0.40; }
        }
        @keyframes genTextFade {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0);  }
          85%  { opacity: 1; transform: translateY(0);  }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>

      {/* ── Ambient glow behind cards ─────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% 50%, ${accent}14, transparent 55%)`,
        animation: "genGlowBreath 4s ease-in-out infinite",
      }} aria-hidden="true" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 2, marginBottom: 24, flexShrink: 0 }}>
        {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
        <div style={{
          fontSize: 13, fontWeight: 600, letterSpacing: "0.14em",
          color: `${accent}cc`,
          textTransform: "uppercase" as const,
          marginBottom: 8,
        }}>
          AI Casting Studio
        </div>
        {/* Studio Title: 30px / 700 / -0.02em */}
        <div style={{
          fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
          color: "#ffffff", lineHeight: 1.1, marginBottom: 6,
        }}>
          Building your AI influencer
        </div>
        {/* Animated status line */}
        <div
          key={lineIdx}
          style={{
            /* Body: 16px / 400 / leading 1.65 */
            fontSize: 16, fontWeight: 400, lineHeight: 1.65,
            color: "rgba(255,255,255,0.50)",
            animation: "genTextFade 2.8s ease forwards",
          }}
        >
          {GENERATING_LINES[lineIdx]}
          {jobIds.length > 0 && (
            <span style={{
              marginLeft: 12,
              /* Chip: 13px / semibold 600 / -0.005em */
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em",
              color: `${accent}bb`,
            }}>
              {completed}/{total}
            </span>
          )}
        </div>
      </div>

      {/* ── Shimmer skeleton cards ───────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", gap: 16,
        flex: 1, minHeight: 0,
        overflow: "hidden",
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            flex: "1 1 0",
            minWidth: 0,
            borderRadius: 0,               // sharp — cinematic
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.025)",
            position: "relative",
            overflow: "hidden",
            animation: `genShimmerPulse 2.2s ease-in-out ${i * 0.3}s infinite`,
          }}>
            {/* Shimmer sweep */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: "55%",
              background: `linear-gradient(
                105deg,
                transparent 0%,
                ${accent}0d 50%,
                transparent 100%
              )`,
              animation: `genShimmerSweep 2.6s ease-in-out ${i * 0.3}s infinite`,
            }} aria-hidden="true" />

            {/* Bottom info area */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: 72,
              background: "rgba(0,0,0,0.32)",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              padding: "14px 14px",
            }}>
              {/* Candidate number stub */}
              <div style={{
                width: 24, height: 7,
                background: "rgba(255,255,255,0.08)",
                marginBottom: 10,
              }} />
              {/* Label stub */}
              <div style={{
                width: "72%", height: 6,
                background: "rgba(255,255,255,0.045)",
              }} />
            </div>

            {/* Top badge stub */}
            <div style={{
              position: "absolute", top: 10, left: 10,
              width: 28, height: 18,
              background: "rgba(255,255,255,0.055)",
            }} />
          </div>
        ))}
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 2,
        marginTop: 20, flexShrink: 0,
      }}>
        <div style={{
          height: 2,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: `linear-gradient(to right, ${accent}, ${accent}88)`,
            width: `${displayProgress}%`,
            transition: "width 0.9s ease",
          }} />
        </div>
        {/* Micro: 11px / semibold 600 / tracking 0.12em */}
        <div style={{
          marginTop: 8,
          fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.30)",
          textTransform: "uppercase" as const,
        }}>
          {displayProgress < 100 ? "Generating" : "Almost ready"}
        </div>
      </div>
    </div>
  );
}

// ── STATE 2b: Cinematic Candidate Selection (carousel architecture) ───────────
//
// New layout (flex column):
//   1. Header row (label + title + subtitle)
//   2. CandidateCarousel (horizontal snap-scroll)
//   3. CandidateCompareTray (slides up when ≥2 compare)
//   4. CandidateControls (confirm row, always visible)
//
// CandidatePreviewModal is portal-style (position: fixed)
// Identity lock API: POST /api/character/ai-influencers/:id/select
// Max compare = 3; auto-select candidates[0] on arrival.

const MAX_COMPARE = 3;

function CandidatesState({
  influencer_id,
  candidates,
  accent,
  onSelected,
}: {
  influencer_id: string;
  candidates:    string[];
  accent:        string;
  onSelected:    (active: ActiveInfluencer) => void;
}) {
  const [activeUrl,   setActiveUrl]   = useState<string | null>(null);
  const [compareUrls, setCompareUrls] = useState<string[]>([]);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [locking,     setLocking]     = useState(false);
  const [lockError,   setLockError]   = useState<string | null>(null);
  const [mounted,     setMounted]     = useState(false);

  // Entry animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  // Auto-select first candidate when candidates arrive
  useEffect(() => {
    if (!activeUrl && candidates.length > 0) {
      setActiveUrl(candidates[0]);
    }
  }, [candidates, activeUrl]);

  // ── Toggle compare (max 3) ──────────────────────────────────────────────────
  function toggleCompare(url: string) {
    setCompareUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, url];
    });
  }

  // ── Identity lock ───────────────────────────────────────────────────────────
  async function handleConfirm(targetUrl?: string) {
    const urlToLock = targetUrl ?? activeUrl;
    if (!urlToLock || locking) return;
    setLocking(true);
    setLockError(null);
    setPreviewUrl(null); // close modal if open
    try {
      const res = await fetch(
        `/api/character/ai-influencers/${influencer_id}/select`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ candidate_url: urlToLock }),
        },
      );
      if (!res.ok) {
        setLockError("Couldn't lock this identity. Please try again.");
        setLocking(false);
        return;
      }
      const data = await res.json();
      onSelected({
        influencer:         data.data.influencer,
        hero_url:           data.data.hero_url,
        identity_lock_id:   data.data.identity_lock_id,
        canonical_asset_id: data.data.canonical_asset_id,
      });
      // component unmounts on success — no setLocking(false) needed
    } catch (err) {
      console.error(err);
      setLockError("Couldn't lock this identity. Please try again.");
      setLocking(false);
    }
  }

  const maxCompareReached   = compareUrls.length >= MAX_COMPARE;
  const activeIndex         = activeUrl ? candidates.indexOf(activeUrl) + 1 : null;

  // Derive style category for the modal from the parent accent (we don't have it
  // directly here — but InfluencerCanvas passes the influencer's style_category
  // through canvasState; we thread it via a prop in the upgrade below)
  // For the modal we pass a synthetic styleCategory via closure.

  return (
    <>
      {/* ── Preview modal (fixed viewport) ───────────────────────────────── */}
      {previewUrl && (() => {
        const previewIndex = candidates.indexOf(previewUrl) + 1;
        const isInCompare  = compareUrls.includes(previewUrl);
        const maxReached   = maxCompareReached && !isInCompare;
        return (
          <CandidatePreviewModal
            url={previewUrl}
            index={previewIndex}
            accent={accent}
            styleCategory="hyper-real"   /* best-effort; real category comes from parent */
            isInCompare={isInCompare}
            maxCompare={maxReached}
            isLocking={locking}
            onClose={() => setPreviewUrl(null)}
            onSelect={() => handleConfirm(previewUrl)}
            onCompare={() => toggleCompare(previewUrl)}
          />
        );
      })()}

      {/* ── Canvas panel ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100%", width: "100%",
        background: "#05070D",
        opacity:   mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(18px)",
        transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        position: "relative", overflow: "hidden",
      }}>

        {/* Ambient radial glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: [
            "radial-gradient(circle at 50% 10%, rgba(59,130,246,0.15), transparent 36%)",
            "radial-gradient(circle at 80% 80%, rgba(168,85,247,0.12), transparent 34%)",
          ].join(", "),
        }} aria-hidden="true" />

        {/* Content — above glow */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column",
          height: "100%",
        }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div style={{ padding: "24px 32px 16px", flexShrink: 0 }}>
            {/* UI Label: 13px / semibold 600 / tracking 0.14em / uppercase */}
            <div style={{
              fontSize: 13, fontWeight: 600, letterSpacing: "0.14em",
              color: `${accent}cc`,
              textTransform: "uppercase" as const,
              marginBottom: 8,
            }}>
              AI Casting Studio
            </div>
            {/* Studio Title: 30px / 700 / -0.02em */}
            <div style={{
              fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: "#ffffff", lineHeight: 1.1, marginBottom: 6,
            }}>
              Choose your digital human
            </div>
            {/* Body: 16px / 400 / leading 1.65 */}
            <div style={{
              fontSize: 16, fontWeight: 400, lineHeight: 1.65,
              color: "rgba(255,255,255,0.50)", maxWidth: 560,
            }}>
              Pick one candidate to lock the identity. Every future image, video, and pack will follow this face.
            </div>
            {lockError && (
              /* Micro: 11px / semibold 600 / 0.12em */
              <div style={{
                marginTop: 8,
                fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
                color: "#fca5a5",
                textTransform: "uppercase" as const,
              }}>
                {lockError}
              </div>
            )}
          </div>

          {/* ── Carousel ─────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, paddingBottom: 4 }}>
            <CandidateCarousel
              candidates={candidates}
              activeUrl={activeUrl}
              compareUrls={compareUrls}
              accent={accent}
              isLocking={locking}
              onSetActive={setActiveUrl}
              onPreview={url => { setActiveUrl(url); setPreviewUrl(url); }}
              onToggleCompare={toggleCompare}
              onSelect={url => handleConfirm(url)}
            />
          </div>

          {/* Flex spacer so tray+controls stay at bottom */}
          <div style={{ flex: 1 }} />

          {/* ── Compare Tray (slides up when ≥ 2) ────────────────────── */}
          <CandidateCompareTray
            compareUrls={compareUrls}
            accent={accent}
            isLocking={locking}
            onRemove={url => setCompareUrls(prev => prev.filter(u => u !== url))}
            onSelectOne={url => handleConfirm(url)}
            onClearAll={() => setCompareUrls([])}
          />

          {/* ── Controls (confirm row) ────────────────────────────────── */}
          <CandidateControls
            activeUrl={activeUrl}
            accent={accent}
            isLocking={locking}
            candidateIndex={activeIndex}
            onConfirm={() => handleConfirm()}
          />
        </div>
      </div>
    </>
  );
}

// ── STATE 3: Selected — the main experience ───────────────────────────────────

function SelectedState({
  active,
  accent,
  packOutputs,
  activePack,
  onTriggerPack,
  onSetActivePack,
  packSectionRef,
}: {
  active: ActiveInfluencer;
  accent: string;
  packOutputs: PackOutput[];
  activePack: PackType | null;
  onTriggerPack: (type: PackType) => void;
  onSetActivePack: (type: PackType) => void;
  packSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const activeOutput = packOutputs.find(p => p.type === activePack) ?? null;
  const activeDef    = activePack ? PACK_ACTIONS.find(p => p.type === activePack) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Hero image — dominant ────────────────────────────────────── */}
      <HeroSection active={active} accent={accent} />

      {/* ── Cinematic pack dock ──────────────────────────────────────── */}
      <PackDock
        packOutputs={packOutputs}
        activePack={activePack}
        onTrigger={onTriggerPack}
        onSelect={onSetActivePack}
      />

      {/* ── Single output panel — one pack at a time ─────────────────── */}
      <div ref={packSectionRef}>
        {activePack && activeDef && (
          <div key={activePack}>
            <PackOutputPanel
              output={activeOutput}
              packDef={activeDef}
            />
          </div>
        )}
      </div>

      {/* ── Save Identity CTA ─────────────────────────────────────────── */}
      {packOutputs.some(p => p.status === "complete") && (
        <SaveIdentityBar influencer_id={active.influencer.id} />
      )}
    </div>
  );
}

// ── Hero section ───────────────────────────────────────────────────────────────

function HeroSection({ active, accent }: { active: ActiveInfluencer; accent: string }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div style={{
      width: "100%",
      background: `radial-gradient(ellipse at 50% 0%, ${accent}0f 0%, transparent 60%), #07090f`,
      display: "flex", justifyContent: "center",
      padding: "28px 24px 0",
      transition: "background 0.4s ease",
    }}>

      {/* Influencer name above */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: T.ghost,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
        }}>
          Identity
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, color: T.text,
          letterSpacing: "-0.02em", marginBottom: 20,
        }}>
          {formatHandle(active.influencer.handle)}
        </div>

        {/* Hero image container */}
        <div style={{
          display: "inline-block", position: "relative",
          maxWidth: 260, width: "100%",
        }}>
          <div style={{
            aspectRatio: "2/3", borderRadius: 16, overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${accent}20`,
            boxShadow: `0 0 60px ${accent}14, 0 20px 60px rgba(0,0,0,0.5)`,
            transition: "border-color 0.4s ease, box-shadow 0.4s ease",
          }}>
            {active.hero_url ? (
              <>
                {!imgLoaded && (
                  <div style={{
                    width: "100%", height: "100%",
                    background: `radial-gradient(ellipse at 50% 30%, ${accent}18, transparent 60%)`,
                    animation: "pulse 1.8s ease-in-out infinite",
                  }} />
                )}
                <img
                  src={active.hero_url}
                  alt={active.influencer.name}
                  onLoad={() => setImgLoaded(true)}
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    display: imgLoaded ? "block" : "none",
                    transition: "opacity 0.3s ease",
                  }}
                />
              </>
            ) : (
              <div style={{
                width: "100%", height: "100%",
                background: `radial-gradient(ellipse at 50% 30%, ${accent}1e, transparent 65%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="#3d4560" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </div>
            )}
          </div>

          {/* Identity locked indicator */}
          <div style={{
            position: "absolute", bottom: -12, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.22)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#10b981", boxShadow: "0 0 7px #10b981",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>
              Identity Locked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cinematic Pack Dock ────────────────────────────────────────────────────────

function PackDock({
  packOutputs,
  activePack,
  onTrigger,
  onSelect,
}: {
  packOutputs: PackOutput[];
  activePack: PackType | null;
  onTrigger: (type: PackType) => void;
  onSelect: (type: PackType) => void;
}) {
  return (
    <div className="pack-dock" style={{
      padding: "28px 24px 20px",
      display: "flex", gap: 10,
      overflowX: "auto",
    }}>
      <style>{`
        .pack-dock::-webkit-scrollbar { display: none; }
        .pack-dock { scrollbar-width: none; }
        @keyframes packGenerating {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1; }
        }
      `}</style>
      {PACK_ACTIONS.map((pack, idx) => {
        const uiState = getPackUiState(pack.type, packOutputs);
        const isActive = activePack === pack.type;
        return (
          <PackCard
            key={pack.type}
            pack={pack}
            idx={idx}
            uiState={uiState}
            isActive={isActive}
            onTrigger={onTrigger}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

function PackCard({
  pack, idx, uiState, isActive, onTrigger, onSelect,
}: {
  pack: typeof PACK_ACTIONS[0];
  idx: number;
  uiState: PackUiState;
  isActive: boolean;
  onTrigger: (type: PackType) => void;
  onSelect: (type: PackType) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isFoundation = idx === 0;
  const isLocked     = uiState === "locked";

  function handleClick() {
    if (isLocked) return;
    if (uiState === "completed") {
      onSelect(pack.type);
    } else {
      onTrigger(pack.type);
    }
  }

  const borderColor = (() => {
    if (uiState === "completed")                         return `${pack.accent}50`;
    if (uiState === "generating")                        return `${pack.accent}55`;
    if (uiState === "ready" && isFoundation)             return "rgba(255,255,255,0.22)";
    if (uiState === "ready")                             return "rgba(255,255,255,0.14)";
    return "rgba(255,255,255,0.05)";
  })();

  const bg = (() => {
    if (uiState === "completed")                         return `${pack.accent}10`;
    if (uiState === "generating")                        return `${pack.accent}0c`;
    if (uiState === "ready" && isFoundation)             return "rgba(255,255,255,0.04)";
    if (uiState === "ready")                             return "rgba(255,255,255,0.025)";
    return "rgba(255,255,255,0.01)";
  })();

  const activeShadow = (() => {
    if (isActive && uiState === "completed")             return `0 0 20px ${pack.accent}28`;
    if (isActive && uiState === "generating")            return `0 0 16px ${pack.accent}22`;
    if (isActive && uiState === "ready" && isFoundation) return "0 0 24px rgba(255,255,255,0.06)";
    return "none";
  })();

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: 160,
        padding: "14px 14px 12px",
        borderRadius: 14,
        border: `1px solid ${isLocked ? "rgba(255,255,255,0.04)" : (hovered || isActive ? borderColor : borderColor)}`,
        background: isLocked ? "rgba(255,255,255,0.005)" : (hovered && !isActive ? bg : bg),
        boxShadow: isActive ? activeShadow : "none",
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.35 : 1,
        textAlign: "left",
        transition: "all 0.2s ease",
        display: "flex", flexDirection: "column", gap: 8,
        animation: uiState === "generating" ? "packGenerating 1.6s ease-in-out infinite" : "none",
        outline: "none",
      }}
    >
      {/* Top row: label + state indicator */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isLocked
            ? T.ghost
            : (uiState === "completed" || uiState === "generating") ? pack.accent : T.text,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}>
          {pack.label}
          {isFoundation && (
            <div style={{
              fontSize: 9, fontWeight: 700, color: T.ghost,
              letterSpacing: "0.1em", textTransform: "uppercase",
              marginTop: 2,
            }}>
              Foundation
            </div>
          )}
        </div>
        <PackStateIndicator uiState={uiState} accent={pack.accent} />
      </div>

      {/* Descriptor */}
      <div style={{
        fontSize: 10,
        color: isLocked ? "rgba(255,255,255,0.18)" : T.ghost,
        lineHeight: 1.5,
      }}>
        {pack.descriptor}
      </div>

      {/* CTA / status line */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: isLocked
          ? "rgba(255,255,255,0.14)"
          : uiState === "completed"
            ? pack.accent
            : uiState === "generating"
              ? `${pack.accent}99`
              : uiState === "ready"
                ? "rgba(255,255,255,0.45)"
                : T.ghost,
        letterSpacing: "0.04em",
        marginTop: 2,
      }}>
        {uiState === "locked"     && "Unlock previous first"}
        {uiState === "ready"      && pack.cta}
        {uiState === "generating" && "Generating…"}
        {uiState === "completed"  && "✓ View output"}
      </div>
    </button>
  );
}

function PackStateIndicator({ uiState, accent }: { uiState: PackUiState; accent: string }) {
  if (uiState === "locked") {
    return (
      <div style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: 5,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.20)" strokeWidth="2.5" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
    );
  }
  if (uiState === "ready") {
    return (
      <div style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: 5,
        border: `1px solid ${accent}40`,
        background: `${accent}10`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke={accent} strokeWidth="2.5" strokeLinecap="round">
          <polyline points="5 12 12 5 19 12" />
          <line x1="12" y1="5" x2="12" y2="19" />
        </svg>
      </div>
    );
  }
  if (uiState === "generating") {
    return (
      <div style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: 5,
        border: `1px solid ${accent}55`,
        background: `${accent}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          width: 8, height: 8,
          border: `1.5px solid ${accent}44`,
          borderTopColor: accent,
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }
  // completed
  return (
    <div style={{
      width: 18, height: 18, flexShrink: 0, borderRadius: 5,
      border: `1px solid ${accent}50`,
      background: `${accent}18`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
        stroke={accent} strokeWidth="3" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

// ── Pack output panel — single, unified, one at a time ───────────────────────
//
// Receives the active pack's output (or null if not yet triggered) and its
// PACK_ACTIONS definition. Remounts via `key={activePack}` in SelectedState,
// which triggers the fade-in animation on every pack switch.

function PackOutputPanel({
  output,
  packDef,
}: {
  output:  PackOutput | null;
  packDef: typeof PACK_ACTIONS[0];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      padding: "0 24px",
      marginTop: 4,
      marginBottom: 32,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.28s ease, transform 0.28s ease",
    }}>
      {/* Section header */}
      <div style={{
        paddingTop: 28, paddingBottom: 14,
        borderTop: `1px solid ${T.border}`,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: packDef.accent,
          marginBottom: 4,
        }}>
          {packDef.label}
        </div>
        <div style={{ fontSize: 13, color: T.ghost }}>
          {packDef.descriptor}
        </div>
      </div>

      {/* Loading skeletons — shown when pack is in-flight OR not yet triggered (ready state) */}
      {(!output || output.status === "loading") && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 120, aspectRatio: "2/3",
              borderRadius: 0, background: "rgba(255,255,255,0.04)",
              animation: "pulse 1.8s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}>
              <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
            </div>
          ))}
        </div>
      )}

      {output?.status === "failed" && (
        <div style={{ padding: "16px 0", fontSize: 13, color: "#ef4444" }}>
          This pack couldn't be generated. Try again.
        </div>
      )}

      {output?.status === "complete" && output.images.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {output.images.map(img => (
            <PackAssetCard
              key={img.url}
              url={img.url}
              label={img.label}
              accentColor={packDef.accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pack asset card ────────────────────────────────────────────────────────────

function PackAssetCard({
  url, label, accentColor,
}: { url: string; label: string; accentColor: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        flexShrink: 0, width: 130, aspectRatio: "2/3",
        borderRadius: 0, overflow: "hidden", position: "relative",
        cursor: "pointer",
        transition: "transform 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Hover action overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.18s ease",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-end",
        padding: "10px 8px",
        gap: 4,
      }}>
        {/* Label */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: accentColor,
          letterSpacing: "0.06em", marginBottom: 6,
        }}>
          {label}
        </div>

        {/* Action icons */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { icon: "⭐", tip: "Save as Hero" },
            { icon: "↺", tip: "Refine" },
            { icon: "⬆", tip: "Upscale" },
            { icon: "⬇", tip: "Download" },
          ].map(action => (
            <button key={action.tip}
              title={action.tip}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer",
                fontSize: 10, color: T.text,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Save Identity bar ─────────────────────────────────────────────────────────

function SaveIdentityBar({ influencer_id }: { influencer_id: string }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/character/ai-influencers/${influencer_id}/save-identity`, {
        method: "POST", credentials: "include",
      });
      setSaved(true);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{
      padding: "20px 24px 36px",
      display: "flex", justifyContent: "center",
    }}>
      <button
        onClick={handleSave}
        disabled={saving || saved}
        style={{
          padding: "13px 28px", borderRadius: 11,
          background: saved
            ? "rgba(16,185,129,0.15)"
            : "linear-gradient(135deg, #92400e, #b45309 40%, #f59e0b)",
          border: saved ? "1px solid rgba(16,185,129,0.30)" : "none",
          color: saved ? "#10b981" : "#060810",
          fontSize: 14, fontWeight: 800,
          cursor: saving || saved ? "not-allowed" : "pointer",
          letterSpacing: "0.02em",
          boxShadow: saved ? "none" : "0 0 32px rgba(245,158,11,0.25), 0 4px 16px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {saved ? "✓ Identity saved" : saving ? "Saving…" : "Save Identity"}
      </button>
    </div>
  );
}

// ── Floating Action Dock ───────────────────────────────────────────────────────

function CanvasDock({
  phase,
  accent,
  hasSelected,
  onImageFlow,
  onVideoFlow,
  onCreateClick,
  isCreating,
  createError,
}: {
  phase:         CanvasState["phase"];
  accent:        string;
  hasSelected:   boolean;
  onImageFlow:   () => void;
  onVideoFlow:   () => void;
  onCreateClick: () => void;
  isCreating:    boolean;
  createError:   string | null;
}) {
  const isGenerating = phase === "generating";
  // Dock button is locked when either the canvas is polling jobs OR a create call is in flight
  const locked = isGenerating || isCreating;

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "14px 24px 18px",
      background: "linear-gradient(to top, rgba(7,9,15,0.98) 0%, rgba(7,9,15,0.82) 70%, transparent 100%)",
      zIndex: 10,
    }}>
      {/* Keyframes — spin + glow pulse + shimmer sweep */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes canvasDockGlow {
          0%   { box-shadow: 0 0 18px ${accent}44, 0 2px 12px rgba(0,0,0,0.42); }
          50%  { box-shadow: 0 0 46px ${accent}99, 0 0 74px ${accent}33, 0 2px 20px rgba(0,0,0,0.55); }
          100% { box-shadow: 0 0 18px ${accent}44, 0 2px 12px rgba(0,0,0,0.42); }
        }
        @keyframes canvasDockShimmer {
          0%   { left: -80%; }
          100% { left: 130%; }
        }
      `}</style>
      {/* Error message above the dock pill */}
      {createError && (
        <div style={{
          marginBottom: 8,
          padding: "7px 14px", borderRadius: 8,
          background: "rgba(239,68,68,0.10)",
          border: "1px solid rgba(239,68,68,0.28)",
          fontSize: 12, color: "#ef4444", lineHeight: 1.5,
          maxWidth: 440, textAlign: "center",
        }}>
          {createError}
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        height: 80,
        padding: "12px 18px", borderRadius: 24,
        background: "rgba(11,14,23,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
      }}>

        {/* Image Flow — left */}
        <DockButton
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          }
          label="Image Flow"
          onClick={onImageFlow}
          active={hasSelected}
          accent={hasSelected ? "#38bdf8" : undefined}
          tip={hasSelected ? "Open in Image Studio with identity context" : "Go to Image Studio"}
        />

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />

        {/* Create Influencer — center, primary CTA — single source of truth */}
        <button
          onClick={onCreateClick}
          disabled={locked}
          style={{
            // Layout
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            gap: 8,
            // Expand on creating — smooth padding growth
            padding: isCreating ? "0 36px" : "0 32px",
            height: 50,
            borderRadius: 11,
            border: "none",
            whiteSpace: "nowrap",
            // Color: full gradient when creating OR idle; dim ghost when generating-only
            background: isCreating
              ? `linear-gradient(135deg, ${accent}cc, ${accent})`
              : isGenerating
                ? `${accent}22`
                : `linear-gradient(135deg, ${accent}99, ${accent})`,
            color: isCreating
              ? "#060810"
              : isGenerating
                ? `${accent}44`
                : "#060810",
            // Scale up on creating
            transform: isCreating ? "scale(1.04)" : "scale(1)",
            // Opacity: near-full while creating (just slightly reduced), dim while generating-only
            opacity: isCreating ? 0.9 : isGenerating ? 0.45 : 1,
            // Box-shadow: glow animation owns it when creating; static glow when idle; none when locked
            boxShadow: isCreating
              ? undefined  // keyframe canvasDockGlow takes over
              : (!locked ? `0 0 24px ${accent}38, 0 2px 12px rgba(0,0,0,0.4)` : "none"),
            // Animate glow pulse only when creating
            animation: isCreating ? "canvasDockGlow 1.2s ease-in-out infinite" : undefined,
            // Type
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: locked ? "not-allowed" : "pointer",
            // Smooth all non-keyframe transitions
            transition: [
              "transform 0.22s ease-out",
              "padding 0.22s ease-out",
              "opacity 0.2s ease-out",
              "background 0.2s ease-out",
            ].join(", "),
          }}
        >
          {/* Shimmer sweep — light pass across button while creating */}
          {isCreating && (
            <span style={{
              position: "absolute",
              top: 0, bottom: 0,
              width: "50%",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.20) 50%, transparent 100%)",
              animation: "canvasDockShimmer 1.9s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}

          {/* Icon: spinner when creating, person+ icon when idle */}
          {isCreating ? (
            <span style={{
              display: "inline-block",
              width: 14, height: 14,
              flexShrink: 0,
              border: "2px solid rgba(6,8,16,0.25)",
              borderTopColor: "#060810",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
            }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 1 0-16 0" />
              <line x1="18" y1="8" x2="22" y2="8" />
              <line x1="20" y1="6" x2="20" y2="10" />
            </svg>
          )}

          {/* Label */}
          <span style={{ position: "relative" }}>
            {isCreating
              ? "Creating Influencer…"
              : isGenerating
                ? "Generating…"
                : phase === "selected"
                  ? "New Influencer"
                  : "Create Influencer"}
          </span>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />

        {/* Video Flow — right */}
        <DockButton
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          }
          label="Video Flow"
          onClick={onVideoFlow}
          active={hasSelected}
          accent={hasSelected ? "#a855f7" : undefined}
          tip={hasSelected ? "Open in Video Studio as start frame" : "Go to Video Studio"}
        />
      </div>
    </div>
  );
}

function DockButton({
  icon, label, onClick, active, accent, tip,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: string;
  tip?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={tip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "8px 12px", borderRadius: 10,
        background: hovered && active
          ? `${accent}18`
          : hovered
            ? "rgba(255,255,255,0.06)"
            : "transparent",
        border: "none",
        color: active ? (accent ?? "#e8eaf0") : "#4a5168",
        cursor: "pointer",
        transition: "all 0.15s",
        minWidth: 120,
      }}
    >
      {icon}
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </button>
  );
}

// ── Job polling helper ────────────────────────────────────────────────────────

async function pollJobForUrl(jobId: string, maxMs = 300_000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`/api/studio/jobs/${jobId}/status`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const job = data.data?.job ?? data.job;
      if (job?.status === "completed" && job?.result?.url) return job.result.url;
      if (job?.status === "failed") return null;
    } catch { return null; }
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}
