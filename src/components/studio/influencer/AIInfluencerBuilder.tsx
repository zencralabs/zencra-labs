"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Builder — Main Shell
// 3-column layout: Library (260px) | Canvas (flex) | Controls (320px)
// Fixed-height viewport — no scrolling at the shell level.
//
// Single source of truth for:
//   • All influencer form state (lifted from BuilderTab)
//   • handleCreateInfluencer() — the ONLY place where API calls happen
//   • isCreating / createError — threaded down to Canvas dock button
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";
import InfluencerLibrary   from "./InfluencerLibrary";
import InfluencerCanvas    from "./InfluencerCanvas";
import InfluencerControls  from "./InfluencerControls";
import { useAuth }         from "@/components/auth/AuthContext";
import { supabase }        from "@/lib/supabase";
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import { startPolling }    from "@/lib/jobs/job-polling";
import type { GenerationStatus } from "@/lib/jobs/job-status-normalizer";
import type { AIInfluencer, StyleCategory } from "@/lib/influencer/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:       "#07090f",
  border:   "#111827",
  surface:  "#0b0e17",
  text:     "#e8eaf0",
  muted:    "#8b92a8",
  ghost:    "#3d4560",
  amber:    "#f59e0b",
} as const;

// ── Active influencer state ───────────────────────────────────────────────────

export interface ActiveInfluencer {
  influencer:         AIInfluencer;
  hero_url:           string | null;
  identity_lock_id:   string | null;
  canonical_asset_id: string | null;
}

// ── Canvas state type ─────────────────────────────────────────────────────────

export type CanvasState =
  | { phase: "empty" }
  | { phase: "generating"; influencer_id: string; jobs: string[]; style_category: StyleCategory }
  | { phase: "candidates"; influencer_id: string; candidates: string[]; style_category: StyleCategory }
  | { phase: "selected"; active: ActiveInfluencer };

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInfluencerBuilder() {
  const { session } = useAuth();

  const [canvasState, setCanvasState] = useState<CanvasState>({ phase: "empty" });
  const [libraryKey,  setLibraryKey]  = useState(0);

  // ── Lifted form state (shared between Controls → Canvas) ──────────────────
  const [styleCategory,  setStyleCategory]  = useState<StyleCategory>("hyper-real");
  const [gender,         setGender]         = useState("");
  const [ageRange,       setAgeRange]       = useState("");
  const [skinTone,       setSkinTone]       = useState("");
  const [faceStruct,     setFaceStruct]     = useState("");
  const [fashion,        setFashion]        = useState("");
  const [realism,        setRealism]        = useState("photorealistic");
  const [mood,           setMood]           = useState<string[]>([]);
  const [platforms,      setPlatforms]      = useState<string[]>([]);
  const [notes,          setNotes]          = useState("");
  // Identity Options — how many candidates to generate (1–4, default 4)
  const [candidateCount, setCandidateCount] = useState(4);

  // ── Auth token ref — kept current via onAuthStateChange ──────────────────
  // Used by startPolling so every poll tick reads a live JWT even if the
  // token rotated while candidate generation was in progress (up to 10 min).
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

  // ── Creation state — driven by canvas dock button ─────────────────────────
  const [isCreating,  setIsCreating]  = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Internal: transition canvas to generating state ───────────────────────
  const handleCreated = useCallback((influencer: AIInfluencer, jobIds: string[]) => {
    setCanvasState({
      phase:          "generating",
      influencer_id:  influencer.id,
      jobs:           jobIds,
      style_category: influencer.style_category ?? "hyper-real",
    });
  }, []);

  // ── Canvas state transitions ──────────────────────────────────────────────
  const handleCandidatesReady = useCallback(
    (influencer_id: string, candidateUrls: string[]) => {
      setCanvasState(prev => ({
        phase:          "candidates",
        influencer_id,
        candidates:     candidateUrls,
        style_category: prev.phase === "generating" ? prev.style_category : "hyper-real",
      }));
    },
    [],
  );

  // ── SINGLE SOURCE OF TRUTH: all creation logic lives here ─────────────────
  const handleCreateInfluencer = useCallback(async () => {
    setCreateError(null);
    setIsCreating(true);

    try {
      // Resolve a fresh access token — getSession() reads from localStorage
      // and is always valid for the current session. Falls back to the context
      // session if getSession() is unavailable (e.g. SSR edge case).
      let token: string | null = session?.access_token ?? null;
      try {
        const { data: { session: fresh } } = await supabase.auth.getSession();
        if (fresh?.access_token) token = fresh.access_token;
      } catch { /* ignore — fall back to context token */ }

      if (!token) {
        setCreateError("Session expired. Please refresh and try again.");
        return;
      }

      const authHeader = { Authorization: `Bearer ${token}` };

      // Step 1: Create influencer record — backend auto-generates the handle
      const createRes = await fetch("/api/character/ai-influencers", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          style_category:    styleCategory,
          gender,
          age_range:         ageRange,
          skin_tone:         skinTone,
          face_structure:    faceStruct,
          fashion_style:     fashion,
          realism_level:     realism,
          mood,
          platform_intent:   platforms,
          appearance_notes:  notes,
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        console.error("[AIInfluencerBuilder] create failed:", createRes.status, errBody);
        setCreateError("Could not create influencer. Try again.");
        return;
      }

      const createData = await createRes.json();
      const influencer = createData.data?.influencer;
      if (!influencer) { setCreateError("Unexpected response."); return; }

      // Step 2: Trigger generation
      const generateRes = await fetch("/api/character/ai-influencers/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ influencer_id: influencer.id, candidate_count: candidateCount }),
      });

      if (generateRes.ok) {
        const generateData = await generateRes.json();
        const mockCandidates: string[] = generateData.data?.mock_candidates ?? [];

        if (mockCandidates.length > 0) {
          // Provider not live — jump straight to candidates (no polling needed)
          console.info("[AIInfluencerBuilder] mock candidates received — jumping to candidates state");
          setCanvasState({
            phase:          "candidates",
            influencer_id:  influencer.id,
            candidates:     mockCandidates,
            style_category: (influencer.style_category ?? "hyper-real") as StyleCategory,
          });
          return;
        }

        // Real async jobs — transition canvas to shimmer state
        const jobs: Array<{ jobId: string }> = generateData.data?.jobs ?? [];
        const jobIds = jobs.map((j: { jobId: string }) => j.jobId);
        handleCreated(influencer, jobIds);

        if (jobs.length > 0) {
          // ── Activity Center integration (universal polling engine) ──────────
          // Each influencer candidate job is registered in the pending-job-store
          // and polled via job-polling.ts — identical lifecycle to Video/Image/CDv2.
          // When all jobs resolve, handleCandidatesReady transitions the canvas.
          const store = getPendingJobStoreState();
          let resolvedCount = 0;
          const completedUrls: string[] = [];

          const onJobResolved = (url?: string) => {
            if (url) completedUrls.push(url);
            resolvedCount++;
            if (resolvedCount === jobs.length) {
              handleCandidatesReady(influencer.id, completedUrls);
            }
          };

          for (const { jobId } of jobs) {
            store.registerJob({
              jobId,
              studio:     "character",
              modelKey:   "influencer-candidate",
              modelLabel: "AI Influencer",
              prompt:     `Candidate for @${influencer.handle ?? ""}`,
              createdAt:  new Date().toISOString(),
            });

            startPolling({
              jobId,
              studio:   "character",
              // getToken reads ref so JWT rotation during long polls is safe
              getToken: () => authTokenRef.current,
              onComplete: (update) => {
                store.completeJob(jobId, update.url ?? "");
                onJobResolved(update.url);
              },
              onError: (update) => {
                store.failJob(
                  jobId,
                  update.status as Extract<GenerationStatus, "failed" | "refunded" | "stale" | "cancelled">,
                  update.error,
                );
                onJobResolved(); // still count toward completion so canvas unblocks
              },
              onUpdate: (update) => {
                store.updateJob(jobId, { status: update.status });
              },
            });
          }
        }
      } else {
        const errBody = await generateRes.json().catch(() => ({}));
        console.warn("[AIInfluencerBuilder] generate returned non-ok:", generateRes.status, errBody);
        // Non-fatal — enter generating state with empty jobs (canvas stays in shimmer)
        handleCreated(influencer, []);
      }
    } catch (err) {
      console.error(err);
      setCreateError("Something went wrong. Try again.");
    } finally {
      setIsCreating(false);
    }
  }, [
    session, styleCategory, gender, ageRange, skinTone, faceStruct,
    fashion, realism, mood, platforms, notes, candidateCount, handleCreated, handleCandidatesReady,
  ]);

  const handleSelected = useCallback(
    (active: ActiveInfluencer) => {
      setCanvasState({ phase: "selected", active });
      setLibraryKey(k => k + 1); // refresh library to show new active influencer
    },
    [],
  );

  // Multi-lock: called each time a candidate is locked — bumps library to show it
  const handleCandidateLocked = useCallback(
    (_active: ActiveInfluencer) => {
      setLibraryKey(k => k + 1);
    },
    [],
  );

  const handleNewInfluencer = useCallback(() => {
    setCanvasState({ phase: "empty" });
  }, []);

  const handleSelectFromLibrary = useCallback((influencer: AIInfluencer) => {
    if (influencer.identity_lock_id && influencer.hero_asset_id) {
      setCanvasState({
        phase:  "selected",
        active: {
          influencer,
          hero_url:           influencer.thumbnail_url,
          identity_lock_id:   influencer.identity_lock_id,
          canonical_asset_id: influencer.hero_asset_id,
        },
      });
    }
  }, []);

  const activeInfluencer =
    canvasState.phase === "selected" ? canvasState.active : null;

  return (
    <div style={{
      height:      "100%",   // fills the page wrapper (100dvh - 76px)
      display:     "flex",
      background:  T.bg,
      overflow:    "hidden",
      fontFamily:  "var(--font-sans, system-ui, sans-serif)",
      color:       T.text,
    }}>

      {/* ── Left: Influencer Library ─────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerLibrary
          key={libraryKey}
          onNew={handleNewInfluencer}
          onSelect={handleSelectFromLibrary}
          activeId={activeInfluencer?.influencer.id ?? null}
        />
      </div>

      {/* ── Center: Canvas ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerCanvas
          canvasState={canvasState}
          onCandidatesReady={handleCandidatesReady}
          onSelected={handleSelected}
          onCandidateLocked={handleCandidateLocked}
          onCreateClick={handleCreateInfluencer}
          isCreating={isCreating}
          createError={createError}
          selectedStyleCategory={styleCategory}
          candidateCount={candidateCount}
        />
      </div>

      {/* ── Right: Controls ──────────────────────────────────────────────── */}
      <div style={{
        width: 320, flexShrink: 0,
        borderLeft: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerControls
          canvasState={canvasState}
          activeInfluencer={activeInfluencer}
          styleCategory={styleCategory}    setStyleCategory={setStyleCategory}
          gender={gender}                  setGender={setGender}
          ageRange={ageRange}              setAgeRange={setAgeRange}
          skinTone={skinTone}              setSkinTone={setSkinTone}
          faceStruct={faceStruct}          setFaceStruct={setFaceStruct}
          fashion={fashion}                setFashion={setFashion}
          realism={realism}                setRealism={setRealism}
          mood={mood}                      setMood={setMood}
          platforms={platforms}            setPlatforms={setPlatforms}
          notes={notes}                    setNotes={setNotes}
          candidateCount={candidateCount}  setCandidateCount={setCandidateCount}
        />
      </div>

    </div>
  );
}
