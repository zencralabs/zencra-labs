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
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import { startPolling }    from "@/lib/jobs/job-polling";
import type { GenerationStatus } from "@/lib/jobs/job-status-normalizer";
import type { AIInfluencer, StyleCategory } from "@/lib/influencer/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  // Page shell
  pageBg:      "#05070d",
  // Left roster — slightly warmer, elevated
  leftBg:      "#080b14",
  leftBorder:  "rgba(255,255,255,0.09)",
  // Center canvas — deepest cinematic black
  centerBg:    "#03050a",
  // Right controls — slightly blue-tinted surface
  rightBg:     "#07091a",
  rightBorder: "rgba(255,255,255,0.09)",
  // Shared
  border:   "rgba(255,255,255,0.07)",
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
  | { phase: "candidates"; influencer_id: string; candidates: string[]; style_category: StyleCategory; expected_count: number }
  | { phase: "selected"; active: ActiveInfluencer };

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInfluencerBuilder() {
  const { session } = useAuth();

  const [canvasState, setCanvasState] = useState<CanvasState>({ phase: "empty" });
  const [libraryKey,  setLibraryKey]  = useState(0);

  // ── Lifted form state (shared between Controls → Canvas) ──────────────────
  const [styleCategory,   setStyleCategory]   = useState<StyleCategory>("hyper-real");
  const [gender,          setGender]          = useState("");
  const [ageRange,        setAgeRange]        = useState("");
  const [skinTone,        setSkinTone]        = useState("");
  const [faceStruct,      setFaceStruct]      = useState("");
  const [fashion,         setFashion]         = useState("");
  const [realism,         setRealism]         = useState("photorealistic");
  const [mood,            setMood]            = useState<string[]>([]);
  const [platforms,       setPlatforms]       = useState<string[]>([]);
  const [notes,           setNotes]           = useState("");
  // Ethnicity/Region — drives region-aware naming + facial genetics in prompts
  const [ethnicityRegion,    setEthnicityRegion]    = useState("");
  // Mixed/Blended region selection — 2–4 regions injected as blended-heritage prompt
  const [mixedBlendRegions,  setMixedBlendRegions]  = useState<string[]>([]);
  // Identity Options — how many candidates to generate (1–4, default 4)
  const [candidateCount,  setCandidateCount]  = useState(4);
  // Library tags — user-defined labels for filtering in the AI Talent Roster
  const [tags,            setTags]            = useState<string[]>([]);

  // ── Phase A — Advanced Identity Traits ────────────────────────────────────
  const [species,       setSpecies]       = useState<string>("");
  const [hairIdentity,  setHairIdentity]  = useState<string>("");
  const [eyeColor,      setEyeColor]      = useState<string>("");
  const [eyeType,       setEyeType]       = useState<string>("");
  const [skinMarks,     setSkinMarks]     = useState<string[]>([]);
  const [earType,       setEarType]       = useState<string>("");
  const [hornType,      setHornType]      = useState<string>("");

  // ── Auth token ref — kept current from the session provided by AuthContext ─
  // Used by startPolling so every poll tick reads a live JWT even if the
  // token rotated while candidate generation was in progress (up to 10 min).
  //
  // We deliberately do NOT register a second onAuthStateChange listener or
  // call supabase.auth.getSession() here.  Both operations compete for the
  // Supabase auth lock ("lock:zencra-auth-token") with AuthContext's own
  // listener, causing lock-contention errors and a 1–2 s UI freeze on mount.
  // The session prop from AuthContext is already kept live by its listener, so
  // syncing from it is sufficient and lock-free.
  const authTokenRef = useRef<string | null>(null);
  useEffect(() => {
    authTokenRef.current = session?.access_token ?? null;
  }, [session]);

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
    (influencer_id: string, candidateUrls: string[], expectedCount: number) => {
      setCanvasState(prev => ({
        phase:          "candidates",
        influencer_id,
        candidates:     candidateUrls,
        expected_count: expectedCount,
        style_category: prev.phase === "generating" ? prev.style_category : "hyper-real",
      }));
    },
    [],
  );

  // ── SINGLE SOURCE OF TRUTH: all creation logic lives here ─────────────────
  const handleCreateInfluencer = useCallback(async () => {
    // ── Activate generating state IMMEDIATELY ────────────────────────────────
    // setIsCreating(true) must be the very first statement so the canvas
    // transitions to its shimmer/generating phase before any async work begins.
    // Previously this was preceded by await supabase.auth.getSession() which
    // competed for the Supabase auth lock and caused a 2–3 s dead pause with
    // no visible UI change while the lock resolved.
    setIsCreating(true);
    setCreateError(null);

    try {
      // Use the live token from authTokenRef — kept current by the useEffect
      // that syncs from the session prop on every AuthContext update.
      // This eliminates the supabase.auth.getSession() call that previously
      // acquired the auth lock here and caused "lock:zencra-auth-token" errors.
      const token = authTokenRef.current ?? session?.access_token ?? null;

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
          ethnicity_region:  ethnicityRegion || null,
          // Mixed heritage persistence fix — now stored in profile, not just ephemeral
          mixed_blend_regions: mixedBlendRegions.length >= 2 ? mixedBlendRegions : [],
          tags,
          // Phase A — Advanced Identity Traits
          species:       species       || null,
          hair_identity: hairIdentity  || null,
          eye_color:     eyeColor      || null,
          eye_type:      eyeType       || null,
          skin_marks:    skinMarks,
          ear_type:      earType       || null,
          horn_type:     hornType      || null,
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
        body: JSON.stringify({
            influencer_id:       influencer.id,
            candidate_count:     candidateCount,
            // Only sent when user has chosen Mixed/Blended with ≥2 regions.
            // Route ignores undefined — falls back to single-region or Auto.
            mixed_blend_regions: mixedBlendRegions.length >= 2 ? mixedBlendRegions : undefined,
          }),
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
            expected_count: mockCandidates.length,
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
              handleCandidatesReady(influencer.id, completedUrls, jobs.length);
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
    fashion, realism, mood, platforms, notes, ethnicityRegion, mixedBlendRegions,
    candidateCount, tags,
    species, hairIdentity, eyeColor, eyeType, skinMarks, earType, hornType,
    handleCreated, handleCandidatesReady,
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
    // Reset all form state so the next candidate run starts clean
    setStyleCategory("hyper-real");
    setGender("");
    setAgeRange("");
    setSkinTone("");
    setFaceStruct("");
    setFashion("");
    setRealism("photorealistic");
    setMood([]);
    setPlatforms([]);
    setNotes("");
    setEthnicityRegion("");
    setMixedBlendRegions([]);
    setCandidateCount(4);
    setTags([]);
    // Phase A — Biological Identity
    setSkinMarks([]);
    setSpecies("");
    setHairIdentity("");
    setEyeColor("");
    setEyeType("");
    setEarType("");
    setHornType("");
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
      background:  T.pageBg,
      overflow:    "hidden",
      fontFamily:  "var(--font-sans, system-ui, sans-serif)",
      color:       T.text,
    }}>

      {/* ── Left: Influencer Library ─────────────────────────────────────── */}
      <div style={{
        width: 268, flexShrink: 0,
        background: T.leftBg,
        borderRight: `1px solid ${T.leftBorder}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        // Subtle inner top highlight — makes the panel feel elevated
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04), 2px 0 16px rgba(0,0,0,0.25)",
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
        background: T.centerBg,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        // Subtle radial glow to add depth to the deep canvas
        backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.018) 0%, transparent 55%)",
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
        width: 332, flexShrink: 0,
        background: T.rightBg,
        borderLeft: `1px solid ${T.rightBorder}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "inset 1px 0 0 rgba(255,255,255,0.04), -2px 0 16px rgba(0,0,0,0.30)",
      }}>
        <InfluencerControls
          canvasState={canvasState}
          activeInfluencer={activeInfluencer}
          styleCategory={styleCategory}          setStyleCategory={setStyleCategory}
          gender={gender}                        setGender={setGender}
          ageRange={ageRange}                    setAgeRange={setAgeRange}
          skinTone={skinTone}                    setSkinTone={setSkinTone}
          faceStruct={faceStruct}                setFaceStruct={setFaceStruct}
          fashion={fashion}                      setFashion={setFashion}
          realism={realism}                      setRealism={setRealism}
          mood={mood}                            setMood={setMood}
          platforms={platforms}                  setPlatforms={setPlatforms}
          notes={notes}                          setNotes={setNotes}
          ethnicityRegion={ethnicityRegion}           setEthnicityRegion={setEthnicityRegion}
          mixedBlendRegions={mixedBlendRegions}      setMixedBlendRegions={setMixedBlendRegions}
          candidateCount={candidateCount}            setCandidateCount={setCandidateCount}
          tags={tags}                                setTags={setTags}
          species={species}                          setSpecies={setSpecies}
          hairIdentity={hairIdentity}                setHairIdentity={setHairIdentity}
          eyeColor={eyeColor}                        setEyeColor={setEyeColor}
          eyeType={eyeType}                          setEyeType={setEyeType}
          skinMarks={skinMarks}                      setSkinMarks={setSkinMarks}
          earType={earType}                          setEarType={setEarType}
          hornType={hornType}                        setHornType={setHornType}
        />
      </div>

    </div>
  );
}
