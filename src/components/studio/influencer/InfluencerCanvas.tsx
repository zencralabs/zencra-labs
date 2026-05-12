"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Canvas — Center panel
// Manages 3 states: empty → candidates → selected
// Pack sections animate into view below the hero. Progressive reveal only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import type { CanvasState, ActiveInfluencer, CandidateSnapshot } from "./AIInfluencerBuilder";
import type { PackType, StyleCategory } from "@/lib/influencer/types";
import { formatHandle }    from "@/lib/ai-influencer/format-handle";
import { downloadAsset }   from "@/lib/client/downloadAsset";
import { supabase }        from "@/lib/supabase";
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import { startPolling }    from "@/lib/jobs/job-polling";
import type { GenerationStatus } from "@/lib/jobs/job-status-normalizer";
import CandidateCarousel      from "./candidate/CandidateCarousel";
import CandidatePreviewModal  from "./candidate/CandidatePreviewModal";
import CandidateCompareTray   from "./candidate/CandidateCompareTray";
import CandidateControls      from "./candidate/CandidateControls";
import { FullscreenPreview }  from "@/components/ui/FullscreenPreview";

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

// Unified accent palette — exact match to InfluencerLibrary CHIP_PALETTE RGB values.
// Drives: dock CTA gradient, canvas glow, ambient radial, identity reveal.
// hyper-real stays amber (white looks washed-out as a button gradient on dark bg).
const CATEGORY_ACCENT: Record<StyleCategory, string> = {
  "hyper-real":       "#f59e0b", // amber
  "3d-animation":     "#06b6d4", // cyan
  "anime-manga":      "#f472b6", // pink
  "fine-art":         "#fb923c", // warm orange
  "game-concept":     "#8b5cf6", // violet
  "physical-texture": "#c27844", // warm clay / terracotta
  "retro-pixel":      "#84cc16", // lime
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
  onCandidatesReady:     (influencer_id: string, candidateUrls: string[], expectedCount: number, snapshot: CandidateSnapshot) => void;
  onSelected:            (active: ActiveInfluencer) => void;
  onCandidateLocked?:    (active: ActiveInfluencer) => void; // multi-lock: each locked candidate
  onCreateClick:         () => void;   // handleCreateInfluencer — single source of truth
  isCreating:            boolean;      // true while API calls are in flight
  createError:           string | null;
  selectedStyleCategory: StyleCategory; // drives dock button color in empty phase
  candidateCount:        number;        // 1–4; controls credit display in dock button
}

// ── Pack output state ─────────────────────────────────────────────────────────

interface PackOutput {
  type:       PackType;
  label:      string;
  accent:     string;
  descriptor: string;
  status:     "loading" | "complete" | "failed";
  images:     Array<{ url: string; label: string }>;
  totalJobs?: number;  // known upfront for look-pack; drives mixed skeleton+reveal
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
  canvasState, onCandidatesReady, onSelected, onCandidateLocked,
  onCreateClick, isCreating, createError, selectedStyleCategory, candidateCount,
}: Props) {
  const [packOutputs, setPackOutputs]   = useState<PackOutput[]>([]);
  const [activePack,  setActivePack]    = useState<PackType | null>(null);
  const packSectionRef  = useRef<HTMLDivElement>(null);
  const canvasRef       = useRef<HTMLDivElement>(null);
  // Keeps a current snapshot of packOutputs accessible inside async callbacks
  // without stale-closure issues. Updated in sync via the effect below.
  const packOutputsRef  = useRef<PackOutput[]>([]);
  useEffect(() => { packOutputsRef.current = packOutputs; }, [packOutputs]);

  /**
   * In-flight guard — prevents duplicate pack dispatches.
   * Identity-sheet chain blocks server-side for ~5 min; look-pack polls for up to 10 min.
   * Without this guard a second click re-dispatches the chain AND resets packOutputs,
   * wiping completed images from the first chain (Bug 1 root cause).
   */
  const inFlightPacks = useRef<Set<PackType>>(new Set());

  /**
   * Reverts activePack to "identity-sheet" when a pack fails AND identity-sheet
   * has already-rendered images. This prevents the user from being stranded on
   * an error panel — they drop back to their identity sheet automatically.
   * Uses packOutputsRef (not state) so it's safe inside async callbacks.
   */
  const revertToIdentitySheet = useCallback(() => {
    const idSheet = packOutputsRef.current.find(p => p.type === "identity-sheet");
    if (idSheet?.status === "complete" && idSheet.images.length > 0) {
      setActivePack("identity-sheet");
    }
  }, []);

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

  // Hydrate Identity Sheet from persisted influencer_assets on influencer load.
  // Fires when the selected influencer's identity_lock_id becomes available.
  // If a chain is already in-flight (status="loading"), this is a no-op — the
  // in-flight guard and the "loading" check inside setPackOutputs protect state.
  useEffect(() => {
    if (canvasState.phase !== "selected") return;
    const { active } = canvasState;
    if (!active.identity_lock_id) return;

    const influencerId   = active.influencer.id;
    const identityLockId = active.identity_lock_id;

    (async () => {
      const headers = await getAuthHeader();
      try {
        const res = await fetch(
          `/api/character/ai-influencers/${influencerId}/packs` +
          `?asset_type=identity-sheet&identity_lock_id=${encodeURIComponent(identityLockId)}`,
          { headers },
        );
        if (!res.ok) return;  // silent — no assets yet, or auth issue

        const json = await res.json();
        const assets: Array<{ url: string; label: string }> = Array.isArray(json?.data?.assets)
          ? json.data.assets
          : [];
        if (assets.length === 0) return;

        const packDef = PACK_ACTIONS.find(p => p.type === "identity-sheet")!;

        setPackOutputs(prev => {
          const existing = prev.find(p => p.type === "identity-sheet");

          // Don't disturb an in-flight or already-complete entry
          if (existing?.status === "loading") return prev;

          // If a freshly-completed chain just wrote "complete", merge without
          // overwriting — DB images win for ordering, new chain images are appended
          // as any that didn't yet make it into the DB response.
          if (existing?.status === "complete") {
            const existingUrls = new Set(existing.images.map(i => i.url));
            const newImages = assets.filter(a => !existingUrls.has(a.url));
            if (newImages.length === 0) return prev;  // already in sync
            return prev.map(p =>
              p.type === "identity-sheet"
                ? { ...p, images: [...assets, ...existing.images.filter(i => !assets.some(a => a.url === i.url))], totalJobs: Math.max(existing.totalJobs ?? 0, assets.length) }
                : p,
            );
          }

          // Fresh hydration — no entry exists yet
          return [...prev, {
            type:       "identity-sheet",
            label:      packDef.label,
            accent:     packDef.accent,
            descriptor: packDef.descriptor,
            status:     "complete",
            images:     assets,
            totalJobs:  assets.length,
          }];
        });
        // Open the PackOutputPanel so the hydrated images are visible.
        // activePack is null on fresh load (reset when influencer changes) so
        // this is safe — it only reveals identity-sheet if nothing is already open.
        setActivePack(prev => prev ?? "identity-sheet");
      } catch {
        // Silent — hydration is best-effort; missing images don't break the page
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasState.phase === "selected" ? canvasState.active?.identity_lock_id : null,
  ]);

  const handleTriggerPack = useCallback(
    async (packType: PackType) => {
      if (canvasState.phase !== "selected") return;
      const { active } = canvasState;
      if (!active.identity_lock_id || !active.canonical_asset_id) return;

      // ── Duplicate dispatch guard ──────────────────────────────────────────────
      // Identity-sheet blocks for ~5 min server-side. Without this guard, a second
      // click re-dispatches the chain AND resets packOutputs — wiping completed
      // images from the first chain before they can render (Bug 1 root cause).
      if (inFlightPacks.current.has(packType)) return;
      inFlightPacks.current.add(packType);

      const packDef = PACK_ACTIONS.find(p => p.type === packType)!;

      // Add loading section immediately — then animate in.
      // Safety: if an entry already exists AND is currently "loading", keep it
      // as-is (inFlightPacks guard above already prevents re-entry, but this
      // protects against any unexpected concurrent state).
      setPackOutputs(prev => {
        const existing = prev.find(p => p.type === packType);
        if (existing?.status === "loading") return prev; // already generating — no-op
        if (existing) {
          // Retry after failure or re-trigger from complete
          return prev.map(p =>
            p.type === packType ? { ...p, status: "loading", images: [], totalJobs: undefined } : p,
          );
        }
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
            revertToIdentitySheet();
            return;
          }

          const data = await res.json();
          const jobs: Array<{ jobId: string; label: string }> = data.data?.jobs ?? [];

          if (jobs.length === 0) {
            setPackOutputs(prev =>
              prev.map(p => p.type === "look-pack" ? { ...p, status: "failed" } : p),
            );
            revertToIdentitySheet();
            return;
          }

          // ── Step 6D: Set totalJobs immediately so PackOutputPanel can render
          // labelled skeleton cards equal to the number of in-flight jobs.
          setPackOutputs(prev =>
            prev.map(p =>
              p.type === "look-pack" ? { ...p, totalJobs: jobs.length } : p,
            ),
          );

          // ── Activity Center integration (universal polling engine) ─────────────
          // Each look-pack job is registered in the pending-job-store and polled via
          // job-polling.ts — identical lifecycle to Video/Image/CDv2 jobs.
          // Step 6D: Images are added progressively one-by-one as each job resolves
          // so the output panel reveals cards in real time, not all at once.
          const store = getPendingJobStoreState();
          let resolvedCount = 0;

          const onJobResolved = (url?: string, label?: string) => {
            // Progressive reveal — push each image as it lands
            if (url && label) {
              setPackOutputs(prev =>
                prev.map(p =>
                  p.type === "look-pack"
                    ? { ...p, images: [...p.images, { url, label }] }
                    : p,
                ),
              );
            }
            resolvedCount++;
            if (resolvedCount === jobs.length) {
              // All done — flip status; images already accumulated progressively
              setPackOutputs(prev =>
                prev.map(p =>
                  p.type === "look-pack"
                    ? { ...p, status: p.images.length > 0 ? "complete" : "failed" }
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
          revertToIdentitySheet();
        } finally {
          // Release guard — look-pack jobs are handed off to startPolling callbacks
          // at this point; the canvas is no longer "in flight" for dispatch purposes.
          inFlightPacks.current.delete(packType);
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
        const jobs: Array<{ jobId: string; label: string; status?: string; url?: string }> =
          data.data?.jobs ?? [];

        const images: Array<{ url: string; label: string }> = [];

        if (data.data?.chain_mode === true) {
          // ── Identity Sheet: chain already completed server-side ──────────────
          // The packs route ran buildIdentityChain() synchronously and returned
          // confirmed permanent URLs on each completed shot. Extract directly —
          // no polling needed for shots that already have a URL.
          for (const { label, status, url } of jobs) {
            if (status === "completed" && url) {
              images.push({ url, label });
            }
          }
        } else {
          // ── Non-chain pack types: poll each job for its result URL ───────────
          await Promise.all(
            jobs.map(async ({ jobId, label }) => {
              const url = await pollJobForUrl(jobId);
              if (url) images.push({ url, label });
            }),
          );
        }

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
      } finally {
        // Release guard — chain is complete (or failed/timed out).
        inFlightPacks.current.delete(packType);
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
      // ── Identity Bridge — full context encoded in URL params ──────────────────
      // Image Studio reads these to pre-fill @handle in prompt, show identity chip,
      // and silently attach the canonical reference image via handle-resolver.
      // mode=influencer signals the arrival context (distinct from creative-director).
      const params = new URLSearchParams();
      params.set("influencer_id",    active.influencer.id);
      params.set("identity_lock_id", active.identity_lock_id ?? "");
      params.set("mode",             "influencer");
      if (active.influencer.handle)       params.set("handle",             active.influencer.handle);
      if (active.influencer.display_name) params.set("display_name",       active.influencer.display_name);
      if (active.canonical_asset_id)      params.set("canonical_asset_id", active.canonical_asset_id);
      if (active.hero_url)                params.set("reference_url",       active.hero_url);
      router.push(`/studio/image?${params.toString()}`);
    } else {
      router.push("/studio/image");
    }
  }

  function goVideoFlow() {
    if (canvasState.phase === "selected") {
      const { active } = canvasState;
      const params = new URLSearchParams();
      params.set("influencer_id",    active.influencer.id);
      params.set("identity_lock_id", active.identity_lock_id ?? "");
      params.set("flow",             "start-frame");   // Video Studio reads ?flow= (not ?mode=)
      params.set("mode",             "influencer");    // signals influencer arrival context
      if (active.influencer.handle)       params.set("handle",       active.influencer.handle);
      if (active.influencer.display_name) params.set("display_name", active.influencer.display_name);
      if (active.hero_url) {
        params.set("startFrame",    active.hero_url);   // pre-populates start-frame slot
        params.set("reference_url", active.hero_url);   // identity portrait reference
      }
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
        {/* Empty: hide CTA immediately when isCreating fires — skeleton shows below */}
        {canvasState.phase === "empty" && !isCreating && <EmptyState accent={currentAccent} />}

        {/* ── Instant shimmer transition ──────────────────────────────────────
            Render GeneratingState as soon as isCreating becomes true (the moment
            the user clicks Create), BEFORE the API calls complete and canvasState
            transitions to "generating".  GeneratingState derives skeleton count
            from candidateCount (known at click time) so the cards appear instantly.
            When handleCreated() fires with real job IDs, canvasState moves to
            "generating" and this block continues rendering with no visual jump. */}
        {(canvasState.phase === "generating" || (canvasState.phase === "empty" && isCreating)) && (
          <GeneratingState
            influencer_id={canvasState.phase === "generating" ? canvasState.influencer_id : ""}
            jobIds={canvasState.phase === "generating" ? canvasState.jobs : []}
            accent={currentAccent}
            candidateCount={candidateCount}
            onReady={onCandidatesReady}
          />
        )}
        {canvasState.phase === "candidates" && (
          <CandidatesState
            influencer_id={canvasState.influencer_id}
            candidates={canvasState.candidates}
            failedCount={Math.max(0, canvasState.expected_count - canvasState.candidates.length)}
            snapshot={canvasState.snapshot}
            accent={currentAccent}
            onSelected={onSelected}
            onCandidateLocked={onCandidateLocked}
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
  candidateCount,
}: {
  // influencer_id and onReady are no longer used here — the canvas transition is
  // driven by AIInfluencerBuilder via startPolling onComplete/onError callbacks.
  // The job IDs are kept as a prop so the shimmer skeleton count is accurate.
  influencer_id?: string;  // retained for compatibility, not used
  jobIds: string[];
  accent: string;
  candidateCount: number;
  onReady?: (influencer_id: string, urls: string[], expectedCount: number, snapshot: CandidateSnapshot) => void;  // retained, not used
}) {
  const [progress, setProgress] = useState(0);
  const [lineIdx,  setLineIdx]  = useState(0);
  // Use candidateCount as the authoritative skeleton count — it's known the moment
  // the user clicks Create (before the API responds and jobIds is populated).
  const total = jobIds.length || candidateCount;

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
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 0.85; }
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
          fontFamily: "'Syne', sans-serif",
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
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: "1 1 0",
            minWidth: 0,
            borderRadius: 0,               // sharp — cinematic
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            position: "relative",
            overflow: "hidden",
            boxShadow: [
              "inset 0 0 0 1px rgba(56,189,248,0.06)",
              "0 0 24px rgba(56,189,248,0.06)",
              "0 0 0 1px rgba(255,255,255,0.04)",
            ].join(", "),
            animation: `genShimmerPulse 2.2s ease-in-out ${i * 0.3}s infinite`,
          }}>
            {/* Shimmer sweep — bright silver/white diagonal */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: "55%",
              background: `linear-gradient(
                105deg,
                transparent 0%,
                rgba(255,255,255,0.06) 35%,
                rgba(255,255,255,0.18) 50%,
                rgba(255,255,255,0.06) 65%,
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

// Locked item — info returned from lock-candidate after success
interface LockedItem {
  url:                string;
  influencer_id:      string;
  identity_lock_id:   string;
  canonical_asset_id: string;
  hero_url:           string;
  handle:             string | null;
  display_name:       string | null;
}

function CandidatesState({
  influencer_id,
  candidates,
  failedCount,
  snapshot,
  accent,
  onSelected,
  onCandidateLocked,
}: {
  influencer_id:      string;
  candidates:         string[];
  failedCount:        number;
  snapshot:           CandidateSnapshot;
  accent:             string;
  onSelected:         (active: ActiveInfluencer) => void;
  onCandidateLocked?: (active: ActiveInfluencer) => void;
}) {
  const [activeUrl,    setActiveUrl]    = useState<string | null>(null);
  const [compareUrls,  setCompareUrls]  = useState<string[]>([]);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [lockingUrl,   setLockingUrl]   = useState<string | null>(null);  // per-card spinner
  const [lockedItems,  setLockedItems]  = useState<LockedItem[]>([]);
  const [lockError,    setLockError]    = useState<string | null>(null);
  const [slotsFull,    setSlotsFull]    = useState(false);
  const [slotsUsed,    setSlotsUsed]    = useState(0);
  const [slotsLimit,   setSlotsLimit]   = useState(8);
  const [mounted,      setMounted]      = useState(false);

  const router = useRouter();

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

  // Fetch slot info on mount
  useEffect(() => {
    (async () => {
      try {
        const authHeader = await getAuthHeader();
        const res = await fetch("/api/character/ai-influencers/slots", { headers: authHeader });
        if (res.ok) {
          const d = await res.json();
          const { used, limit, remaining } = d.data ?? d;
          setSlotsUsed(used ?? 0);
          setSlotsLimit(limit ?? 8);
          setSlotsFull((remaining ?? 1) <= 0);
        }
      } catch { /* non-fatal */ }
    })();
  }, []);

  // ── Toggle compare (max 3) ──────────────────────────────────────────────────
  function toggleCompare(url: string) {
    setCompareUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, url];
    });
  }

  // ── Per-candidate identity lock ─────────────────────────────────────────────
  async function handleLock(url: string) {
    if (lockingUrl || lockedItems.some(l => l.url === url)) return;
    setLockingUrl(url);
    setLockError(null);
    setPreviewUrl(null); // close modal if open
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(
        `/api/character/ai-influencers/${influencer_id}/lock-candidate`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ candidate_url: url }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = d?.error ?? "Couldn't lock this identity. Please try again.";
        setLockError(msg);
        setLockingUrl(null);
        return;
      }
      const data = await res.json();
      const {
        influencer_id:      newInfluencerId,
        identity_lock_id,
        canonical_asset_id,
        hero_url,
        handle,
        display_name,
        slots_remaining,
      } = data.data ?? data;

      const item: LockedItem = {
        url,
        influencer_id:      newInfluencerId,
        identity_lock_id,
        canonical_asset_id,
        hero_url,
        handle:             handle ?? null,
        display_name:       display_name ?? null,
      };

      setLockedItems(prev => [...prev, item]);
      setSlotsUsed(s => s + 1);
      if (slots_remaining <= 0) setSlotsFull(true);

      // Notify parent (bumps libraryKey) — optional callback for multi-lock
      onCandidateLocked?.({
        influencer: {
          id:               newInfluencerId,
          user_id:          "",          // caller doesn't need this
          name:             display_name ?? "",
          handle:           handle ?? null,
          display_name:     display_name ?? null,
          status:           "active",
          style_category:   "hyper-real",
          hero_asset_id:    canonical_asset_id ?? null,
          identity_lock_id: identity_lock_id ?? null,
          thumbnail_url:    hero_url ?? null,
          parent_influencer_id: influencer_id,
          tags:             [],
          created_at:       new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        },
        hero_url:           hero_url ?? null,
        identity_lock_id:   identity_lock_id ?? null,
        canonical_asset_id: canonical_asset_id ?? null,
      });
    } catch (err) {
      console.error(err);
      setLockError("Couldn't lock this identity. Please try again.");
    } finally {
      setLockingUrl(null);
    }
  }

  // ── "View in Library" → go to selected state with first locked item ─────────
  function goToFirst() {
    const first = lockedItems[0];
    if (!first) return;
    onSelected({
      influencer: {
        id:               first.influencer_id,
        user_id:          "",
        name:             first.display_name ?? "",
        handle:           first.handle ?? null,
        display_name:     first.display_name ?? null,
        status:           "active",
        style_category:   "hyper-real",
        hero_asset_id:    first.canonical_asset_id ?? null,
        identity_lock_id: first.identity_lock_id ?? null,
        thumbnail_url:    first.hero_url ?? null,
        parent_influencer_id: influencer_id,
        tags:             [],
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      },
      hero_url:           first.hero_url ?? null,
      identity_lock_id:   first.identity_lock_id ?? null,
      canonical_asset_id: first.canonical_asset_id ?? null,
    });
  }

  const maxCompareReached = compareUrls.length >= MAX_COMPARE;
  const lockedUrls        = lockedItems.map(l => l.url);
  const hasLocked         = lockedItems.length > 0;

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
            styleCategory={snapshot.styleCategory}
            snapshot={snapshot}
            isInCompare={isInCompare}
            maxCompare={maxReached}
            isLocking={!!lockingUrl}
            onClose={() => setPreviewUrl(null)}
            onSelect={() => handleLock(previewUrl)}
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

        {/* Ambient radial glow — purple band removed; subtle blue only */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 50% 10%, rgba(59,130,246,0.10), transparent 36%)",
        }} aria-hidden="true" />

        {/* Content — above glow */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column",
          height: "100%",
        }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div style={{ padding: "24px 32px 16px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                {/* UI Label */}
                <div style={{
                  fontSize: 13, fontWeight: 600, letterSpacing: "0.14em",
                  color: `${accent}cc`,
                  textTransform: "uppercase" as const,
                  marginBottom: 8,
                }}>
                  AI Casting Studio
                </div>
                {/* Studio Title */}
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
                  color: "#ffffff", lineHeight: 1.1, marginBottom: 6,
                }}>
                  {hasLocked ? "Lock more identities" : "Choose your digital human"}
                </div>
                {/* Body */}
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 16, fontWeight: 400, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.50)", maxWidth: 560,
                }}>
                  {hasLocked
                    ? `${lockedItems.length} identit${lockedItems.length === 1 ? "y" : "ies"} locked. Lock more or go to your library.`
                    : "Lock any candidate to create a persistent AI identity. You can lock multiple."}
                </div>
              </div>

              {/* Slot counter chip */}
              <div style={{
                flexShrink: 0,
                padding: "6px 12px",
                background: slotsFull
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(245,158,11,0.10)",
                border: `1px solid ${slotsFull ? "rgba(239,68,68,0.30)" : "rgba(245,158,11,0.25)"}`,
                fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
                color: slotsFull ? "#fca5a5" : "rgba(253,230,138,0.88)",
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap",
              }}>
                {slotsUsed}/{slotsLimit} slots
              </div>
            </div>

            {lockError && (
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
              failedSlots={failedCount}
              activeUrl={activeUrl}
              compareUrls={compareUrls}
              accent={accent}
              isLocking={!!lockingUrl}
              lockedUrls={lockedUrls}
              lockingUrl={lockingUrl}
              slotsFull={slotsFull}
              onSetActive={setActiveUrl}
              onPreview={url => { setActiveUrl(url); setPreviewUrl(url); }}
              onToggleCompare={toggleCompare}
              onSelect={url => handleLock(url)}
            />
          </div>

          {/* Flex spacer so tray+action bar stay at bottom */}
          <div style={{ flex: 1 }} />

          {/* ── Compare Tray (slides up when ≥ 2) ────────────────────── */}
          <CandidateCompareTray
            compareUrls={compareUrls}
            accent={accent}
            isLocking={!!lockingUrl}
            onRemove={url => setCompareUrls(prev => prev.filter(u => u !== url))}
            onSelectOne={url => handleLock(url)}
            onClearAll={() => setCompareUrls([])}
          />

          {/* ── Floating post-lock glass pill — center-bottom ────────────── */}
          {hasLocked && (
            <div style={{
              position: "absolute", bottom: 88, left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 8px 6px 12px",
              background: "rgba(6,8,16,0.88)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(20px) saturate(1.4)",
              boxShadow: [
                "0 8px 40px rgba(0,0,0,0.65)",
                "0 0 0 1px rgba(255,255,255,0.06)",
                "inset 0 1px 0 rgba(255,255,255,0.08)",
              ].join(", "),
              whiteSpace: "nowrap",
              animation: "pillFloat 0.38s cubic-bezier(0.22,1,0.36,1) both",
            }}>
              <style>{`
                @keyframes pillFloat {
                  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
              `}</style>

              {/* Locked count badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.30)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
                color: "rgba(253,230,138,0.90)",
                textTransform: "uppercase" as const,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#f59e0b",
                  boxShadow: "0 0 6px rgba(245,158,11,0.80)",
                }} />
                {lockedItems.length} locked
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.10)", flexShrink: 0 }} />

              {/* View in Library */}
              <button
                onClick={goToFirst}
                style={{
                  height: 32, padding: "0 13px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.82)",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 12, fontWeight: 600, letterSpacing: "-0.005em",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.13)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.82)";
                }}
              >
                View in Library
              </button>

              {/* Image Studio — blue */}
              <button
                onClick={() => {
                  const first = lockedItems[0];
                  if (!first) { router.push("/studio/image"); return; }
                  const params = new URLSearchParams();
                  params.set("influencer_id",    first.influencer_id);
                  params.set("identity_lock_id", first.identity_lock_id ?? "");
                  params.set("mode",             "influencer");
                  if (first.handle)             params.set("handle",             first.handle);
                  if (first.display_name)        params.set("display_name",       first.display_name);
                  if (first.canonical_asset_id)  params.set("canonical_asset_id", first.canonical_asset_id);
                  if (first.hero_url)            params.set("reference_url",       first.hero_url);
                  router.push(`/studio/image?${params.toString()}`);
                }}
                style={{
                  height: 32, padding: "0 13px",
                  background: "rgba(59,130,246,0.10)",
                  border: "1px solid rgba(59,130,246,0.28)",
                  color: "#93c5fd",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.20)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#bfdbfe";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.10)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#93c5fd";
                }}
              >
                Image Studio
              </button>

              {/* Video Studio — amber primary CTA */}
              <button
                onClick={() => {
                  const first = lockedItems[0];
                  if (!first) { router.push("/studio/video"); return; }
                  const params = new URLSearchParams();
                  params.set("influencer_id",    first.influencer_id);
                  params.set("identity_lock_id", first.identity_lock_id ?? "");
                  params.set("flow",             "start-frame");
                  params.set("mode",             "influencer");
                  if (first.handle)       params.set("handle",       first.handle);
                  if (first.display_name) params.set("display_name", first.display_name);
                  if (first.hero_url) {
                    params.set("startFrame",    first.hero_url);
                    params.set("reference_url", first.hero_url);
                  }
                  router.push(`/studio/video?${params.toString()}`);
                }}
                style={{
                  height: 32, padding: "0 14px",
                  background: "linear-gradient(135deg, #d97706, #f59e0b)",
                  border: "none",
                  color: "#000000",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                  cursor: "pointer",
                  boxShadow: "0 2px 14px rgba(245,158,11,0.38)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 22px rgba(245,158,11,0.60)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 14px rgba(245,158,11,0.38)"; }}
              >
                Video Studio
              </button>
            </div>
          )}
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

  const activeOutput           = packOutputs.find(p => p.type === activePack) ?? null;
  const activeDef              = activePack ? PACK_ACTIONS.find(p => p.type === activePack) ?? null : null;
  const isIdentitySheetLoading = packOutputs.some(p => p.type === "identity-sheet" && p.status === "loading");

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
        isIdentitySheetLoading={isIdentitySheetLoading}
        onImageFlow={onImageFlow}
        onVideoFlow={onVideoFlow}
        onCreatePack={() => onTriggerPack("identity-sheet")}
        onSaveIdentity={handleSaveIdentity}
      />

      {/* ── 5. Pack output (renders below once a pack triggers) ───────────── */}
      <div ref={packSectionRef}>
        {activePack && activeDef && (
          <div key={activePack}>
            <PackOutputPanel
              output={activeOutput}
              packDef={activeDef}
              onRetry={() => onTriggerPack(activePack)}
              onImageFlow={onImageFlow}
              onVideoFlow={onVideoFlow}
            />
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
        /* ONE wide cinematic sweep — left-to-right, seamless loop.
           Keyframe: glow starts off-screen left (-50%), exits off-screen right (150%).
           At both endpoints the glow band is outside the element, so the loop
           restart is invisible — text appears as plain white for a beat, then the
           sweep fires again. Accent color spans 30%→70% of gradient width (40pts)
           to produce a single broad reflective band, not two separated spots. */
        @keyframes titleShimmerText {
          0%   { background-position: -50% center; }
          100% { background-position: 150% center; }
        }
        @keyframes packGenerating {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1;   }
        }
        /* Cinematic metallic shimmer — MUST be a stylesheet class, not inline styles.
           background-clip:text + vendor prefix only works reliably via CSS rules.
           width:fit-content is the hard safety net: even if clip fails, the
           background paints only behind the text — never as a full-width bar. */
        .zencra-reveal-h2 {
          display: block;
          width: fit-content;
          margin: 0 auto 10px;
          color: rgba(255,255,255,0.92);
          /* Single wide glow band: base white → accent → bright white peak → accent → base white.
             The 30%–70% accent span (40pts wide) collapses the two separated spots
             into one continuous reflective band. */
          background: linear-gradient(90deg,
            rgba(255,255,255,0.78)  0%,
            rgba(255,255,255,0.78) 20%,
            var(--h2-accent, #f59e0b) 30%,
            rgba(255,255,255,0.97) 50%,
            var(--h2-accent, #f59e0b) 70%,
            rgba(255,255,255,0.78) 80%,
            rgba(255,255,255,0.78) 100%
          );
          background-size: 260% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: titleShimmerText 3.2s ease-in-out infinite;
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

      {/* Main headline — cinematic metallic sweep.
           Class .zencra-reveal-h2 handles background-clip:text via proper CSS rules.
           CSS custom property --h2-accent feeds the dynamic per-category accent colour.
           Typography-only inline style: no background, no clip, no animation. */}
      <h2
        className="font-display tracking-tight zencra-reveal-h2"
        style={{
          fontFamily: "var(--font-display), Syne, system-ui, sans-serif",
          fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 800,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          ["--h2-accent" as string]: accent,
        }}
      >
        Your Digital Human is Ready
      </h2>

      {/* Sub-line — whiteSpace nowrap keeps it on one line on desktop */}
      <p style={{
        margin: 0,
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 14, fontWeight: 400, lineHeight: 1.6,
        color: "rgba(255,255,255,0.50)",
        whiteSpace: "nowrap",
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
      {/* ── Two-column cinematic cast reveal ───────────────────────────────── */}
      {/* Left: handle in negative space / Right: enlarged 9:16 portrait        */}
      <div style={{
        display: "flex", flexDirection: "row",
        alignItems: "flex-start", gap: 44,
      }}>

        {/* ── Left column: handle + metadata — cinematic editorial title ───── */}
        <div style={{
          width: 180, flexShrink: 0,
          display: "flex", flexDirection: "column",
          justifyContent: "flex-start",
          paddingTop: 360,
          position: "relative", zIndex: 2,
        }}>

          {/* @handle — Syne, left-aligned, luxury cast title */}
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 30, fontWeight: 800,
            color: "#ffffff", letterSpacing: "-0.03em",
            textAlign: "left",
            textShadow: `0 0 28px ${accent}50, 0 2px 12px rgba(0,0,0,0.80)`,
            lineHeight: 1.0,
            whiteSpace: "nowrap",
          }}>
            {formatHandle(active.influencer.handle)}
          </div>

          {/* Style category — uppercase meta label */}
          <div style={{
            marginTop: 10,
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 11, fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
          }}>
            {categoryLabel}
          </div>

          {/* Active status dot + label */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 12,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background: "#10b981",
              boxShadow: "0 0 6px rgba(16,185,129,0.65)",
            }} />
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, fontWeight: 600,
              color: "rgba(16,185,129,0.72)",
              letterSpacing: "0.04em",
            }}>
              Active
            </span>
          </div>
        </div>

        {/* ── Right column: enlarged portrait — 300px wide, 9:16, 0 radius ── */}
        <div style={{
          width: 300, flexShrink: 0,
          aspectRatio: "9/16",
          overflow: "hidden",
          borderRadius: 0,
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
                  borderRadius: 0,
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

          {/* Subtle bottom vignette — ~22% black gradient */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "40%",
            background: "linear-gradient(to top, rgba(0,0,0,0.22) 0%, transparent 100%)",
            pointerEvents: "none",
          }} aria-hidden="true" />
        </div>

        {/* Right spacer — mirrors left column width to center the portrait */}
        <div style={{ width: 180, flexShrink: 0 }} />

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
        fontFamily: "'Syne', sans-serif",
        fontSize: 14, fontWeight: 800, letterSpacing: "0.14em",
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
  // Derive which pack must complete before this one unlocks
  const prevPackLabel = idx > 0 ? PACK_ACTIONS[idx - 1].label : null;
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
    return "rgba(255,255,255,0.40)"; // locked — lifted from 0.18 for readability
  })();

  const cardBg = (() => {
    if (uiState === "completed")          return `${pack.accent}0e`;
    if (uiState === "generating")         return `${pack.accent}0a`;
    if (uiState === "ready" && hovered)   return "rgba(255,255,255,0.04)";
    return "rgba(255,255,255,0.018)";
  })();

  const cardBorder = (() => {
    if (uiState === "completed")          return `1px solid ${pack.accent}60`;
    if (uiState === "generating")         return `1px solid ${pack.accent}50`;
    if (uiState === "ready" && hovered)   return "1px solid rgba(255,255,255,0.14)";
    if (uiState === "ready")              return "1px solid rgba(255,255,255,0.08)";
    return "1px solid rgba(255,255,255,0.04)";
  })();

  const cardShadow = (() => {
    if (uiState === "completed") return `0 0 18px ${pack.accent}28, 0 0 36px ${pack.accent}10`;
    if (isActive && uiState !== "locked") return `0 0 18px ${pack.accent}22`;
    return "none";
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
        boxShadow: cardShadow,
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
          fontSize: isFoundation ? 17 : 15,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: isLocked ? "rgba(255,255,255,0.38)" : stateColor,
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
          fontSize: 13, lineHeight: 1.45,
          color: isLocked ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.58)",
          marginTop: 3,
          whiteSpace: isFoundation ? undefined : "nowrap",
          overflow: isFoundation ? undefined : "hidden",
          textOverflow: isFoundation ? undefined : "ellipsis",
        }}>
          {pack.descriptor}
        </div>
      </div>

      {/* State indicator — right side */}
      <div style={{ flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }}>
        {uiState === "locked" && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", lineHeight: 1.3 }}>
            {prevPackLabel ? `After ${prevPackLabel}` : "Locked"}
          </span>
        )}
        {uiState === "ready" && (
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: stateColor, textTransform: "uppercase" as const, lineHeight: 1.3 }}>
            {isFoundation ? "Start here →" : "Build"}
          </span>
        )}
        {uiState === "generating" && (
          <span style={{ fontSize: 12, fontWeight: 600, color: stateColor }}>…</span>
        )}
        {uiState === "completed" && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 9px",
            background: `${pack.accent}1a`,
            border: `1px solid ${pack.accent}55`,
            color: pack.accent,
            fontSize: 10, fontWeight: 800, letterSpacing: "0.10em",
            textTransform: "uppercase" as const,
          }}>
            ✓ DONE
          </span>
        )}
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
  isIdentitySheetLoading,
  onImageFlow,
  onVideoFlow,
  onCreatePack,
  onSaveIdentity,
}: {
  accent:                  string;
  savingId:                boolean;
  savedId:                 boolean;
  isIdentitySheetLoading:  boolean;
  onImageFlow:             () => void;
  onVideoFlow:             () => void;
  onCreatePack:            () => void;
  onSaveIdentity:          () => void;
}) {
  return (
    <div style={{ padding: "0 24px 32px" }}>
      {/* Section label */}
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 14, fontWeight: 800, letterSpacing: "0.14em",
        color: T.muted, textTransform: "uppercase" as const,
        marginBottom: 12,
      }}>
        Launch
      </div>

      {/* Primary — Create Content Pack */}
      <button
        onClick={isIdentitySheetLoading ? undefined : onCreatePack}
        disabled={isIdentitySheetLoading}
        style={{
          width: "100%", padding: "14px 20px",
          background: isIdentitySheetLoading
            ? `linear-gradient(135deg, ${accent}55, ${accent}66)`
            : `linear-gradient(135deg, ${accent}cc, ${accent})`,
          border: "none",
          cursor: isIdentitySheetLoading ? "not-allowed" : "pointer",
          marginBottom: 8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: isIdentitySheetLoading ? "none" : `0 4px 24px ${accent}44`,
          transition: "all 0.2s ease",
          outline: "none",
          opacity: isIdentitySheetLoading ? 0.6 : 1,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="rgba(0,0,0,0.7)" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          <path d="M9 8l3 3 3-3" />
        </svg>
        <span style={{
          fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em",
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
          fontSize: 15, fontWeight: 700, letterSpacing: "0.01em",
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
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.01em" }}>
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
//
// Step 6D: Mixed skeleton+reveal rendering — as jobs complete progressively,
// completed cards reveal with stagger while remaining skeletons keep pulsing.

function PackOutputPanel({
  output,
  packDef,
  onRetry,
  onImageFlow,
  onVideoFlow,
}: {
  output:       PackOutput | null;
  packDef:      typeof PACK_ACTIONS[0];
  onRetry:      () => void;
  onImageFlow?: () => void;
  onVideoFlow?: () => void;
}) {
  const [lightbox,  setLightbox]  = useState<{ url: string; label: string } | null>(null);

  const handlePreview = useCallback((url: string, label: string) => {
    setLightbox({ url, label });
  }, []);

  // How many skeleton cards to show while loading
  const skeletonCount = (() => {
    if (!output || output.status !== "loading") return 0;
    const total = output.totalJobs ?? 4;
    return Math.max(0, total - output.images.length);
  })();

  const isComplete   = output?.status === "complete";
  const isFailed     = output?.status === "failed";
  const hasImages    = (output?.images.length ?? 0) > 0;

  return (
    <div style={{
      padding: "0 24px",
      marginTop: 4,
      marginBottom: 32,
      animation: "packPanelReveal 0.28s ease forwards",
    }}>
      {/* Keyframes */}
      <style>{`
        @keyframes packPulse{0%,100%{opacity:0.35}50%{opacity:0.65}}
        @keyframes packReveal{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes packCompletePulse{0%{box-shadow:0 0 0 0 ${packDef.accent}44}70%{box-shadow:0 0 0 16px ${packDef.accent}00}100%{box-shadow:0 0 0 0 ${packDef.accent}00}}
        @keyframes packPanelReveal{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Section header */}
      <div style={{
        paddingTop: 28, paddingBottom: 14,
        borderTop: `1px solid ${T.border}`,
        marginBottom: 4,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: isComplete ? packDef.accent : T.text,
            marginBottom: 4,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {packDef.label}
            {isComplete && hasImages && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                color: packDef.accent, textTransform: "uppercase",
                padding: "2px 7px",
                border: `1px solid ${packDef.accent}50`,
                background: `${packDef.accent}10`,
                animation: "packCompletePulse 0.8s ease-out",
              }}>
                Complete
              </span>
            )}
            {output?.status === "loading" && hasImages && (
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>
                {output.images.length}/{output.totalJobs ?? "…"} ready
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.ghost }}>
            {packDef.descriptor}
          </div>
        </div>

        {/* Retry button — only shown in failed state */}
        {isFailed && (
          <button
            onClick={onRetry}
            style={{
              padding: "7px 14px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.28)",
              cursor: "pointer", outline: "none",
              fontSize: 12, fontWeight: 700, color: "#ef4444",
              letterSpacing: "0.04em",
              transition: "all 0.14s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.16)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          >
            ↺ Retry
          </button>
        )}
      </div>

      {/* Main image strip — mixed completed + skeleton */}
      {(!isFailed) && (() => {
        const isIdentitySheet = packDef.type === "identity-sheet";
        const stripStyle: React.CSSProperties = isIdentitySheet
          ? { display: "flex", gap: 12, paddingBottom: 8, width: "100%" }
          : { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 };

        return (
          <div style={stripStyle}>
            {/* Completed cards — revealed with stagger */}
            {output?.images.map((img, i) => (
              <PackAssetCard
                key={img.url}
                url={img.url}
                label={img.label}
                accentColor={packDef.accent}
                revealIndex={i}
                isComplete={isComplete}
                fluid={isIdentitySheet}
                onPreview={handlePreview}
                onImageFlow={onImageFlow}
                onVideoFlow={onVideoFlow}
              />
            ))}

            {/* Remaining skeleton cards — shown while jobs still in-flight */}
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={`skel-${i}`} style={{
                ...(isIdentitySheet
                  ? { flex: "1 1 0", minWidth: 140 }
                  : { flexShrink: 0, width: 130 }),
                aspectRatio: "2/3",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                animation: "packPulse 1.8s ease-in-out infinite",
                animationDelay: `${i * 0.22}s`,
                display: "flex", flexDirection: "column",
                justifyContent: "flex-end", padding: 8,
              }}>
                <div style={{
                  height: 7, width: "60%",
                  background: "rgba(255,255,255,0.07)",
                  marginBottom: 4,
                }} />
                <div style={{
                  height: 5, width: "40%",
                  background: "rgba(255,255,255,0.04)",
                }} />
              </div>
            ))}

            {/* Pure loading state — no totalJobs known yet, no images yet */}
            {!output && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                ...(isIdentitySheet
                  ? { flex: "1 1 0", minWidth: 140 }
                  : { flexShrink: 0, width: 130 }),
                aspectRatio: "2/3",
                background: "rgba(255,255,255,0.04)",
                animation: "packPulse 1.8s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
        );
      })()}

      {/* Failed state — no images at all */}
      {isFailed && !hasImages && (
        <div style={{
          padding: "20px 0 8px",
          fontSize: 13, color: "#ef4444", lineHeight: 1.5,
        }}>
          {packDef.type === "identity-sheet"
            ? "Identity Sheet generation timed out. Your jobs may still be completing — check Activity Center."
            : "This pack couldn't be generated. Hit Retry to try again."}
        </div>
      )}

      {/* Failed but some images did land — show what we got */}
      {isFailed && hasImages && (() => {
        const isIdentitySheet = packDef.type === "identity-sheet";
        const stripStyle: React.CSSProperties = isIdentitySheet
          ? { display: "flex", gap: 12, paddingBottom: 8, width: "100%" }
          : { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 };
        return (
          <div style={stripStyle}>
            {output!.images.map((img, i) => (
              <PackAssetCard
                key={img.url}
                url={img.url}
                label={img.label}
                accentColor={packDef.accent}
                revealIndex={i}
                isComplete={false}
                fluid={isIdentitySheet}
                onPreview={handlePreview}
                onImageFlow={onImageFlow}
                onVideoFlow={onVideoFlow}
              />
            ))}
          </div>
        );
      })()}

      {/* Fullscreen cinematic lightbox — portaled to document.body to escape CSS transform stacking context */}
      {lightbox && typeof document !== "undefined" && createPortal(
        <FullscreenPreview
          type="image"
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          zIndex={9900}
        />,
        document.body
      )}
    </div>
  );
}

// ── Pack asset card ────────────────────────────────────────────────────────────
// Step 6D: staggered reveal animation, wired download, SVG icon actions.

function PackAssetCard({
  url, label, accentColor, revealIndex = 0, isComplete = true, fluid = false,
  onPreview, onImageFlow, onVideoFlow,
}: {
  url:          string;
  label:        string;
  accentColor:  string;
  revealIndex?: number;
  isComplete?:  boolean;
  fluid?:       boolean;
  onPreview?:   (url: string, label: string) => void;
  onImageFlow?: () => void;
  onVideoFlow?: () => void;
}) {
  const [hovered,      setHovered]      = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [revealed,     setRevealed]     = useState(false);

  // Staggered entrance — each card reveals slightly after the previous
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), revealIndex * 80 + 40);
    return () => clearTimeout(t);
  }, [revealIndex]);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAsset(url, `look-${label.toLowerCase().replace(/\s+/g, "-")}.jpg`);
    } catch { /* silent */ }
    finally { setDownloading(false); }
  }

  return (
    <div
      style={{
        ...(fluid ? { flex: "1 1 0", minWidth: 140 } : { flexShrink: 0, width: 130 }),
        aspectRatio: "2/3",
        overflow: "hidden", position: "relative",
        cursor: "pointer",
        opacity:   revealed ? 1 : 0,
        transform: revealed ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
        transition: `
          opacity 0.32s ease ${revealIndex * 0.06}s,
          transform 0.32s cubic-bezier(0.22,1,0.36,1) ${revealIndex * 0.06}s
        `,
        boxShadow: isComplete && hovered
          ? `0 8px 28px ${accentColor}22, 0 2px 8px rgba(0,0,0,0.4)`
          : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview?.(url, label)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label}
        loading={revealIndex < 5 ? "eager" : "lazy"}
        style={{
          width: "100%", height: "100%", objectFit: "cover", display: "block",
          transform: hovered ? "scale(1.04)" : "scale(1)",
          transition: "transform 0.32s ease",
        }}
      />

      {/* Hover action overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.22) 56%, transparent 100%)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.18s ease",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-end",
        padding: "10px 8px 10px",
        gap: 7,
      }}>
        {/* Shot label */}
        <div style={{
          fontSize: 12, fontWeight: 800, color: accentColor,
          letterSpacing: "0.07em", lineHeight: 1.2,
          textTransform: "uppercase" as const,
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        }}>
          {label}
        </div>

        {/* Action row — glass pill */}
        <div style={{
          display: "flex", gap: 4,
          background: "rgba(0,0,0,0.38)",
          backdropFilter: "blur(8px)",
          padding: "5px 5px",
          width: "fit-content",
        }}>
          {/* Fullscreen preview */}
          <button
            title="View fullscreen"
            onClick={e => { e.stopPropagation(); onPreview?.(url, label); }}
            style={{
              width: 28, height: 28,
              background: "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>

          {/* Download — wired */}
          <button
            title="Download"
            onClick={handleDownload}
            style={{
              width: 28, height: 28,
              background: downloading ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: downloading ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s ease",
            }}
            onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { if (!downloading) e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
          >
            {downloading ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v20M2 12l10 10 10-10"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
          </button>

          {/* Save as Hero */}
          <button
            title="Save as Hero"
            onClick={e => e.stopPropagation()}
            style={{
              width: 28, height: 28,
              background: "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>

          {/* Image Flow */}
          <button
            title="Open in Image Studio"
            onClick={e => { e.stopPropagation(); onImageFlow?.(); }}
            style={{
              width: 28, height: 28,
              background: "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>

          {/* Video Flow */}
          <button
            title="Use in Video Studio"
            onClick={e => { e.stopPropagation(); onVideoFlow?.(); }}
            style={{
              width: 28, height: 28,
              background: "rgba(255,255,255,0.11)",
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </button>
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
      // Cyan/blue ambient radial layered over the dark scrim
      backgroundImage: [
        "radial-gradient(ellipse 480px 160px at 50% 100%, rgba(56,139,253,0.07) 0%, transparent 70%)",
        "linear-gradient(to top, rgba(7,9,15,0.98) 0%, rgba(7,9,15,0.82) 70%, transparent 100%)",
      ].join(", "),
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
        background: "rgba(6,8,16,0.92)",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: [
          "0 0 0 1px rgba(255,255,255,0.12)",
          "0 0 28px rgba(255,255,255,0.12)",
          "0 18px 60px rgba(0,0,0,0.55)",
          "inset 0 1px 0 rgba(255,255,255,0.10)",
        ].join(", "),
        backdropFilter: "blur(24px) saturate(1.5)",
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
          accent="#2361e2"
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
          accent="#05a09b"
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
