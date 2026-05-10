"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Canvas — Center panel
// Manages 3 states: empty → candidates → selected
// Pack sections animate into view below the hero. Progressive reveal only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import type { CanvasState, ActiveInfluencer } from "./AIInfluencerBuilder";
import type { PackType, StyleCategory } from "@/lib/influencer/types";
import { formatHandle } from "@/lib/ai-influencer/format-handle";
import { supabase }        from "@/lib/supabase";
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import { startPolling }    from "@/lib/jobs/job-polling";
import type { GenerationStatus } from "@/lib/jobs/job-status-normalizer";
import CandidateCarousel      from "./candidate/CandidateCarousel";
import CandidatePreviewModal  from "./candidate/CandidatePreviewModal";
import CandidateCompareTray   from "./candidate/CandidateCompareTray";
import CandidateControls      from "./candidate/CandidateControls";

// ── Auth header helper ────────────────────────────────────────────────────────
// All character API routes use requireAuthUser which reads ONLY the
// Authorization: Bearer header (not cookies). Resolve a fresh token every call.
// Hard 4-second timeout guard: supabase.auth.getSession() can hang indefinitely
// on stale BroadcastChannel sessions (Supabase mutex contention). If it doesn't
// resolve in time we fall back to {} and let the server return 401, which is
// caught by the caller's error handler — far better than an infinite UI hang.
async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 4000),
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    if (result && "data" in result && result.data.session?.access_token) {
      return { Authorization: `Bearer ${result.data.session.access_token}` };
    }
  } catch { /* ignore */ }
  return {};
}

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
  candidateCount:        number;        // 1–4; controls credit display in dock button
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
  onCreateClick, isCreating, createError, selectedStyleCategory, candidateCount,
}: Props) {
  const [packOutputs, setPackOutputs]   = useState<PackOutput[]>([]);
  const [activePack,  setActivePack]    = useState<PackType | null>(null);
  const packSectionRef = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLDivElement>(null);

  // ── Auth token ref — kept current via onAuthStateChange ─────────────────────
  // Used by startPolling so every poll tick reads a live JWT even if the token
  // rotated while look-pack jobs are in progress (up to 10 min).
  const authTokenRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => { authTokenRef.current = session?.access_token ?? null; })
      .catch(() => { /* ignore */ });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      authTokenRef.current = sess?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

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

      // ── Step 6B: Look Pack uses universal polling via FLUX Kontext ────────────
      // All other pack types continue to use the generic /packs route + pollJobForUrl
      // until they are upgraded in a future phase.
      if (packType === "look-pack") {
        try {
          const authHeader = await getAuthHeader();
          const res = await fetch(
            `/api/character/ai-influencers/${active.influencer.id}/look-pack`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader },
              body: JSON.stringify({
                identity_lock_id:   active.identity_lock_id,
                canonical_asset_id: active.canonical_asset_id,
              }),
            },
          );

          if (!res.ok) {
            setPackOutputs(prev =>
              prev.map(p => p.type === "look-pack" ? { ...p, status: "failed" } : p),
            );
            return;
          }

          const data = await res.json();
          const jobs: Array<{ jobId: string; label: string }> = data.data?.jobs ?? [];

          if (jobs.length === 0) {
            setPackOutputs(prev =>
              prev.map(p => p.type === "look-pack" ? { ...p, status: "failed" } : p),
            );
            return;
          }

          // ── Activity Center integration (universal polling engine) ─────────────
          // Each look-pack job is registered in the pending-job-store and polled via
          // job-polling.ts — identical lifecycle to Video/Image/CDv2 jobs.
          // When all jobs resolve, packOutputs transitions to "complete".
          const store = getPendingJobStoreState();
          let resolvedCount = 0;
          const completedImages: Array<{ url: string; label: string }> = [];

          const onJobResolved = (url?: string, label?: string) => {
            if (url && label) completedImages.push({ url, label });
            resolvedCount++;
            if (resolvedCount === jobs.length) {
              setPackOutputs(prev =>
                prev.map(p =>
                  p.type === "look-pack"
                    ? { ...p, status: completedImages.length > 0 ? "complete" : "failed", images: completedImages }
                    : p,
                ),
              );
              // Keep look-pack as the active output panel
              setActivePack("look-pack");
            }
          };

          for (const { jobId, label } of jobs) {
            store.registerJob({
              jobId,
              studio:     "image",          // BFL Kontext dispatches as image studio
              modelKey:   "bfl-kontext",    // direct BFL API — NOT fal-hosted flux-kontext
              modelLabel: "Look Pack",
              prompt:     `Look variation — ${label} for @${active.influencer.handle ?? ""}`,
              createdAt:  new Date().toISOString(),
            });

            startPolling({
              jobId,
              studio:   "image",
              // getToken reads ref so JWT rotation during long polls is safe
              getToken: () => authTokenRef.current,
              onComplete: (update) => {
                store.completeJob(jobId, update.url ?? "");
                onJobResolved(update.url, label);
              },
              onError: (update) => {
                store.failJob(
                  jobId,
                  update.status as Extract<GenerationStatus, "failed" | "refunded" | "stale" | "cancelled">,
                  update.error,
                );
                onJobResolved(); // still count toward total so canvas unblocks
              },
              onUpdate: (update) => {
                store.updateJob(jobId, { status: update.status });
              },
            });
          }
        } catch (err) {
          console.error("[triggerPack/look-pack]", err);
          setPackOutputs(prev =>
            prev.map(p => p.type === "look-pack" ? { ...p, status: "failed" } : p),
          );
        }
        return; // look-pack handled — exit early
      }

      // ── All other pack types: existing route + local polling ──────────────────
      try {
        const authHeader = await getAuthHeader();
        const res = await fetch(
          `/api/character/ai-influencers/${active.influencer.id}/packs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
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
    [canvasState, authTokenRef],
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
            onImageFlow={goImageFlow}
            onVideoFlow={goVideoFlow}
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
        candidateCount={candidateCount}
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
  jobIds,
  accent,
}: {
  // influencer_id and onReady are no longer used here — the canvas transition is
  // driven by AIInfluencerBuilder via startPolling onComplete/onError callbacks.
  // The job IDs are kept as a prop so the shimmer skeleton count is accurate.
  influencer_id?: string;  // retained for compatibility, not used
  jobIds: string[];
  accent: string;
  onReady?: (influencer_id: string, urls: string[]) => void;  // retained, not used
}) {
  const [progress, setProgress] = useState(0);
  const [lineIdx,  setLineIdx]  = useState(0);
  const total = jobIds.length || 4;

  // Ambient progress creep — cinematic feel while the universal engine polls
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

  // NOTE: Polling is now handled by the universal engine (job-polling.ts) wired
  // in AIInfluencerBuilder.handleCreateInfluencer via startPolling(). Jobs are
  // registered in the Activity Center (pending-job-store). When all complete,
  // handleCandidatesReady() is called directly — no local polling loop here.

  const displayProgress = progress;

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
      const authHeader = await getAuthHeader();
      const res = await fetch(
        `/api/character/ai-influencers/${influencer_id}/select`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
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

// ── STATE 3: Selected — Identity Reveal ──────────────────────────────────────
//
// This is the dopamine moment. After candidate lock, the canvas transforms into
// a premium reveal screen: "Your Digital Human is Ready."
//
// Layout (top → bottom):
//   1. RevealHeader        — success headline + shimmer badge
//   2. IdentityRevealCard  — portrait + handle + style category + lock badge
//   3. AssetPackGrid       — 5 pack type cards (foundation first)
//   4. ActionRow           — 4 CTA buttons
//   5. PackOutputPanel     — appears below once a pack is triggered

function SelectedState({
  active,
  accent,
  packOutputs,
  activePack,
  onTriggerPack,
  onSetActivePack,
  packSectionRef,
  onImageFlow,
  onVideoFlow,
}: {
  active:            ActiveInfluencer;
  accent:            string;
  packOutputs:       PackOutput[];
  activePack:        PackType | null;
  onTriggerPack:     (type: PackType) => void;
  onSetActivePack:   (type: PackType) => void;
  packSectionRef:    React.RefObject<HTMLDivElement | null>;
  onImageFlow:       () => void;
  onVideoFlow:       () => void;
}) {
  const [mounted,       setMounted]       = useState(false);
  const [savingId,      setSavingId]      = useState(false);
  const [savedId,       setSavedId]       = useState(false);

  const activeOutput = packOutputs.find(p => p.type === activePack) ?? null;
  const activeDef    = activePack ? PACK_ACTIONS.find(p => p.type === activePack) ?? null : null;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSaveIdentity() {
    if (savingId || savedId) return;
    setSavingId(true);
    try {
      const authHeader = await getAuthHeader();
      await fetch(
        `/api/character/ai-influencers/${active.influencer.id}/save-identity`,
        { method: "POST", headers: { "Content-Type": "application/json", ...authHeader } },
      );
      setSavedId(true);
    } catch { /* silent */ }
    finally { setSavingId(false); }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      opacity:   mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
    }}>

      {/* ── 1. Reveal header ─────────────────────────────────────────────── */}
      <RevealHeader accent={accent} />

      {/* ── 2. Identity card ─────────────────────────────────────────────── */}
      <IdentityRevealCard active={active} accent={accent} />

      {/* ── 3. Asset pack grid ───────────────────────────────────────────── */}
      <AssetPackGrid
        packOutputs={packOutputs}
        activePack={activePack}
        onTrigger={onTriggerPack}
        onSelect={onSetActivePack}
      />

      {/* ── 4. Action row ─────────────────────────────────────────────────── */}
      <IdentityActionRow
        accent={accent}
        savingId={savingId}
        savedId={savedId}
        onImageFlow={onImageFlow}
        onVideoFlow={onVideoFlow}
        onCreatePack={() => onTriggerPack("identity-sheet")}
        onSaveIdentity={handleSaveIdentity}
      />

      {/* ── 5. Pack output (renders below once a pack triggers) ───────────── */}
      <div ref={packSectionRef}>
        {activePack && activeDef && (
          <div key={activePack}>
            <PackOutputPanel output={activeOutput} packDef={activeDef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reveal Header ─────────────────────────────────────────────────────────────
// "Your Digital Human is Ready" — the dopamine headline.

function RevealHeader({ accent }: { accent: string }) {
  return (
    <div style={{
      padding: "40px 32px 0",
      textAlign: "center",
      position: "relative",
    }}>
      <style>{`
        @keyframes revealShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes revealGlow {
          0%, 100% { opacity: 0.5; transform: scale(0.98); }
          50%       { opacity: 1;   transform: scale(1.01); }
        }
        @keyframes packGenerating {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1;   }
        }
      `}</style>

      {/* Ambient radial glow behind text */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% 0%, ${accent}18 0%, transparent 55%)`,
        animation: "revealGlow 4s ease-in-out infinite",
      }} aria-hidden="true" />

      {/* Badge chip */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 14px",
        background: "rgba(16,185,129,0.08)",
        border: "1px solid rgba(16,185,129,0.24)",
        marginBottom: 16,
        position: "relative",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#10b981",
          boxShadow: "0 0 8px #10b981, 0 0 16px rgba(16,185,129,0.4)",
          flexShrink: 0,
        }} />
        {/* UI Label: 11px / 700 / 0.14em */}
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          color: "#10b981", textTransform: "uppercase" as const,
        }}>
          Identity Locked
        </span>
      </div>

      {/* Main headline — cinematic override: clamp + 800 intentional for hero reveal */}
      <h2
        className="font-display tracking-tight"
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-display), Syne, system-ui, sans-serif",
          fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 800,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          textShadow: "0 0 14px rgba(255,255,255,0.08)",
          /* Shimmer gradient text — must stay inline (dynamic accent color) */
          background: `linear-gradient(110deg,
            rgba(255,255,255,0.70) 0%,
            rgba(255,255,255,1.00) 40%,
            ${accent} 55%,
            rgba(255,255,255,0.80) 70%,
            rgba(255,255,255,0.60) 100%
          )`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "revealShimmer 3.5s linear infinite",
          position: "relative",
        }}
      >
        Your Digital Human is Ready
      </h2>

      {/* Sub-line */}
      <p style={{
        margin: 0,
        fontSize: 14, fontWeight: 400, lineHeight: 1.6,
        color: "rgba(255,255,255,0.44)",
        maxWidth: 420, marginInline: "auto",
      }}>
        Your identity is locked across every studio. Generate packs, animate, or go live.
      </p>
    </div>
  );
}

// ── Identity Reveal Card ──────────────────────────────────────────────────────
// Portrait + @handle + style category chip + lock badge.

function IdentityRevealCard({ active, accent }: { active: ActiveInfluencer; accent: string }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const categoryLabel = active.influencer.style_category
    ? active.influencer.style_category.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Hyper-Real";

  return (
    <div style={{
      display: "flex", justifyContent: "center",
      padding: "32px 24px 24px",
    }}>
      {/* Card container */}
      <div style={{
        position: "relative",
        maxWidth: 220, width: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 14,
      }}>

        {/* Portrait */}
        <div style={{
          width: "100%",
          aspectRatio: "2/3",
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${accent}30`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 0 60px ${accent}20, 0 32px 80px rgba(0,0,0,0.60)`,
          position: "relative",
          transition: "box-shadow 0.4s ease",
        }}>
          {active.hero_url ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(ellipse at 50% 30%, ${accent}18, transparent 60%)`,
                  animation: "pulse 1.8s ease-in-out infinite",
                }} />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.hero_url}
                alt={active.influencer.name ?? active.influencer.handle ?? ""}
                onLoad={() => setImgLoaded(true)}
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  display: imgLoaded ? "block" : "none",
                }}
              />
            </>
          ) : (
            <div style={{
              width: "100%", height: "100%",
              background: `radial-gradient(ellipse at 50% 30%, ${accent}1e, transparent 65%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="#3d4560" strokeWidth="1.2" strokeLinecap="round">
                <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </div>
          )}

          {/* Subtle bottom vignette over portrait */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "35%",
            background: "linear-gradient(to top, rgba(7,9,15,0.80) 0%, transparent 100%)",
            pointerEvents: "none",
          }} aria-hidden="true" />
        </div>

        {/* Handle — below portrait */}
        <div style={{
          fontSize: 20, fontWeight: 800,
          color: "#ffffff", letterSpacing: "-0.02em",
          textAlign: "center",
          textShadow: `0 0 20px ${accent}40`,
        }}>
          {formatHandle(active.influencer.handle)}
        </div>

        {/* Style category chip */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px",
          background: `${accent}12`,
          border: `1px solid ${accent}35`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: accent, flexShrink: 0,
          }} />
          {/* Chip: 11px / 700 / 0.10em */}
          <span style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: "0.10em",
            color: accent,
            textTransform: "uppercase" as const,
          }}>
            {categoryLabel}
          </span>
        </div>

        {/* Identity lock badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.20)",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: "#10b981", textTransform: "uppercase" as const,
          }}>
            Identity Locked
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Asset Pack Grid ───────────────────────────────────────────────────────────
// 5 pack type cards in a 2+3 visual grid. Foundation pack is visually dominant.
// Clicking a ready/completed card triggers or surfaces that pack.

function AssetPackGrid({
  packOutputs,
  activePack,
  onTrigger,
  onSelect,
}: {
  packOutputs: PackOutput[];
  activePack:  PackType | null;
  onTrigger:   (type: PackType) => void;
  onSelect:    (type: PackType) => void;
}) {
  // Separate foundation (identity-sheet) from the rest
  const [foundation, ...extras] = PACK_ACTIONS;

  return (
    <div style={{ padding: "8px 24px 24px" }}>
      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
        color: T.muted, textTransform: "uppercase" as const,
        marginBottom: 14,
      }}>
        Asset Packs
      </div>

      {/* Foundation card — full width */}
      <AssetPackCard
        pack={foundation}
        idx={0}
        uiState={getPackUiState(foundation.type, packOutputs)}
        isActive={activePack === foundation.type}
        isFoundation
        onTrigger={onTrigger}
        onSelect={onSelect}
      />

      {/* Remaining 4 packs — 2-column grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, marginTop: 8,
      }}>
        {extras.map((pack, i) => (
          <AssetPackCard
            key={pack.type}
            pack={pack}
            idx={i + 1}
            uiState={getPackUiState(pack.type, packOutputs)}
            isActive={activePack === pack.type}
            isFoundation={false}
            onTrigger={onTrigger}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function AssetPackCard({
  pack, idx, uiState, isActive, isFoundation, onTrigger, onSelect,
}: {
  pack:        typeof PACK_ACTIONS[0];
  idx:         number;
  uiState:     PackUiState;
  isActive:    boolean;
  isFoundation: boolean;
  onTrigger:   (type: PackType) => void;
  onSelect:    (type: PackType) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isLocked = uiState === "locked";

  function handleClick() {
    if (isLocked) return;
    if (uiState === "completed") onSelect(pack.type);
    else onTrigger(pack.type);
  }

  const stateColor = (() => {
    if (uiState === "completed")  return pack.accent;
    if (uiState === "generating") return pack.accent;
    if (uiState === "ready")      return "rgba(255,255,255,0.55)";
    return "rgba(255,255,255,0.18)";
  })();

  const cardBg = (() => {
    if (uiState === "completed")          return `${pack.accent}0e`;
    if (uiState === "generating")         return `${pack.accent}0a`;
    if (uiState === "ready" && hovered)   return "rgba(255,255,255,0.04)";
    return "rgba(255,255,255,0.018)";
  })();

  const cardBorder = (() => {
    if (uiState === "completed")          return `1px solid ${pack.accent}45`;
    if (uiState === "generating")         return `1px solid ${pack.accent}50`;
    if (uiState === "ready" && hovered)   return "1px solid rgba(255,255,255,0.14)";
    if (uiState === "ready")              return "1px solid rgba(255,255,255,0.08)";
    return "1px solid rgba(255,255,255,0.04)";
  })();

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: isFoundation ? "row" : "column",
        alignItems: isFoundation ? "center" : "flex-start",
        gap: isFoundation ? 14 : 6,
        padding: isFoundation ? "16px 18px" : "14px 14px",
        background: cardBg,
        border: cardBorder,
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.38 : 1,
        textAlign: "left",
        outline: "none",
        width: "100%",
        transition: "all 0.18s ease",
        animation: uiState === "generating"
          ? "packGenerating 1.6s ease-in-out infinite"
          : "none",
        boxShadow: isActive && uiState !== "locked"
          ? `0 0 18px ${pack.accent}22`
          : "none",
        marginBottom: isFoundation ? 0 : undefined,
      }}
    >
      {/* Accent dot */}
      <div style={{
        width: isFoundation ? 10 : 8, height: isFoundation ? 10 : 8,
        borderRadius: "50%",
        background: isLocked ? T.ghost : pack.accent,
        flexShrink: 0,
        boxShadow: !isLocked
          ? `0 0 8px ${pack.accent}60`
          : "none",
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Pack name */}
        <div style={{
          fontSize: isFoundation ? 14 : 12,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: isLocked ? T.ghost : stateColor,
          lineHeight: 1.2,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {pack.label}
          {isFoundation && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
              color: T.ghost, textTransform: "uppercase" as const,
              padding: "2px 6px",
              border: "1px solid rgba(255,255,255,0.10)",
            }}>
              Foundation
            </span>
          )}
        </div>

        {/* Descriptor */}
        <div style={{
          fontSize: 11, lineHeight: 1.45,
          color: isLocked ? "rgba(255,255,255,0.18)" : T.ghost,
          marginTop: 3,
          whiteSpace: isFoundation ? undefined : "nowrap",
          overflow: isFoundation ? undefined : "hidden",
          textOverflow: isFoundation ? undefined : "ellipsis",
        }}>
          {pack.descriptor}
        </div>
      </div>

      {/* State indicator — right side */}
      <div style={{
        flexShrink: 0,
        fontSize: 10, fontWeight: 700,
        letterSpacing: "0.06em",
        color: stateColor,
        textTransform: "uppercase" as const,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>
        {uiState === "locked"     && "Locked"}
        {uiState === "ready"      && (isFoundation ? "Start here →" : "Build")}
        {uiState === "generating" && "…"}
        {uiState === "completed"  && "✓ Done"}
      </div>
    </button>
  );
}

// ── Identity Action Row ───────────────────────────────────────────────────────
// 4 CTA buttons: Use in Image Studio, Use in Video Studio, Create Content Pack, Save Identity.

function IdentityActionRow({
  accent,
  savingId,
  savedId,
  onImageFlow,
  onVideoFlow,
  onCreatePack,
  onSaveIdentity,
}: {
  accent:         string;
  savingId:       boolean;
  savedId:        boolean;
  onImageFlow:    () => void;
  onVideoFlow:    () => void;
  onCreatePack:   () => void;
  onSaveIdentity: () => void;
}) {
  return (
    <div style={{ padding: "0 24px 32px" }}>
      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
        color: T.muted, textTransform: "uppercase" as const,
        marginBottom: 12,
      }}>
        Launch
      </div>

      {/* Primary — Create Content Pack */}
      <button
        onClick={onCreatePack}
        style={{
          width: "100%", padding: "14px 20px",
          background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
          border: "none", cursor: "pointer", marginBottom: 8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: `0 4px 24px ${accent}44`,
          transition: "all 0.2s ease",
          outline: "none",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="rgba(0,0,0,0.7)" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          <path d="M9 8l3 3 3-3" />
        </svg>
        <span style={{
          fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em",
          color: "rgba(0,0,0,0.80)",
        }}>
          Create Content Pack
        </span>
      </button>

      {/* Secondary row — 2 equal buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <ActionBtn
          label="Image Studio"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          }
          onClick={onImageFlow}
        />
        <ActionBtn
          label="Video Studio"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          }
          onClick={onVideoFlow}
        />
      </div>

      {/* Tertiary — Save Identity */}
      <button
        onClick={onSaveIdentity}
        disabled={savingId || savedId}
        style={{
          width: "100%", padding: "11px 20px",
          background: savedId
            ? "rgba(16,185,129,0.10)"
            : "rgba(255,255,255,0.04)",
          border: savedId
            ? "1px solid rgba(16,185,129,0.28)"
            : "1px solid rgba(255,255,255,0.10)",
          cursor: (savingId || savedId) ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: savingId ? 0.6 : 1,
          transition: "all 0.2s ease",
          outline: "none",
        }}
      >
        {savedId ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        )}
        <span style={{
          fontSize: 13, fontWeight: 600, letterSpacing: "0.01em",
          color: savedId ? "#10b981" : "rgba(255,255,255,0.40)",
        }}>
          {savedId ? "Identity Saved" : savingId ? "Saving…" : "Save Identity"}
        </span>
      </button>
    </div>
  );
}

function ActionBtn({
  label, icon, onClick,
}: { label: string; icon: React.ReactNode; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "11px 12px",
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        color: hovered ? T.text : "rgba(255,255,255,0.55)",
        transition: "all 0.18s ease",
        outline: "none",
      }}
    >
      {icon}
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.01em" }}>
        {label}
      </span>
    </button>
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
      const authHeader = await getAuthHeader();
      await fetch(`/api/character/ai-influencers/${influencer_id}/save-identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
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
  candidateCount,
}: {
  phase:          CanvasState["phase"];
  accent:         string;
  hasSelected:    boolean;
  onImageFlow:    () => void;
  onVideoFlow:    () => void;
  onCreateClick:  () => void;
  isCreating:     boolean;
  createError:    string | null;
  candidateCount: number;
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
        {/* Typography locked: var(--font-display) / Syne 16px / 700 / gap-8 / padding-11-26 — exact match Image Studio Generate CTA */}
        <button
          onClick={onCreateClick}
          disabled={locked}
          style={{
            // Layout
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            gap: 8,                                      // gap-8 — matches Image Studio Generate CTA
            // Expand on creating — smooth padding growth
            padding: isCreating ? "11px 32px" : "11px 26px",   // height by padding — matches Image Studio
            borderRadius: 13,                            // matches Image Studio
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
              : (!locked ? `0 0 20px ${accent}30, 0 2px 8px rgba(0,0,0,0.4)` : "none"),
            // Animate glow pulse only when creating
            animation: isCreating ? "canvasDockGlow 1.2s ease-in-out infinite" : undefined,
            // Type — locked to exact Image Studio Generate CTA values
            fontSize: 16,                                // matches Image Studio
            fontWeight: 700,                             // matches Image Studio
            letterSpacing: "-0.01em",                   // matches Image Studio
            fontFamily: "var(--font-display)",           // Syne — matches Image Studio
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

          {/* Icon: spinner when creating, Zap icon when idle (matches Image Studio CTA) */}
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
            <Zap size={14} strokeWidth={2.5} style={{ color: "#fece01", flexShrink: 0 }} />
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

          {/* Credit cost — updates live as candidateCount changes */}
          {!isCreating && !isGenerating && (
            <span style={{
              fontFamily: "var(--font-display)",        // Syne — matches Image Studio credit span
              fontSize: 16,
              fontWeight: 700,
              opacity: 0.7,
              letterSpacing: "-0.01em",
            }}>
              {candidateCount * 8} cr
            </span>
          )}
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
      const authHeader = await getAuthHeader();
      const res = await fetch(`/api/studio/jobs/${jobId}/status`, {
        headers: { ...authHeader },
      });
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
