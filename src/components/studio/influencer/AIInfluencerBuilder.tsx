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
import { AuthModal }       from "@/components/auth/AuthModal";
import PricingOverlay      from "@/components/pricing/PricingOverlay";
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import { startPolling }    from "@/lib/jobs/job-polling";
import type { GenerationStatus } from "@/lib/jobs/job-status-normalizer";
import type { AIInfluencer, StyleCategory } from "@/lib/influencer/types";

// ── Pending session hydration ─────────────────────────────────────────────────
// Shape returned by GET /api/character/ai-influencers/pending-session

interface PendingSessionProfile {
  gender:              string | null;
  age_range:           string | null;
  skin_tone:           string | null;
  face_structure:      string | null;
  fashion_style:       string | null;
  realism_level:       string | null;
  mood:                string[];
  platform_intent:     string[];
  ethnicity_region:    string | null;
  mixed_blend_regions: string[];
  species:             string | null;
  hair_identity:       string | null;
  eye_color:           string | null;
  eye_type:            string | null;
  skin_marks:          string[];
  ear_type:            string | null;
  horn_type:           string | null;
}

interface PendingSession {
  influencer_id:  string;
  style_category: StyleCategory;
  candidate_urls: string[];
  expected_count: number;
  snapshot_extra: {
    bodyType: string;
    leftArm:  string;
    rightArm: string;
    leftLeg:  string;
    rightLeg: string;
    skinArt:  string[];
  };
  tags:    string[];
  profile: PendingSessionProfile;
}

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

// ── Candidate snapshot — frozen at dispatch time, shown in preview modal ──────
// Captures every builder selection the user made for a given generation run.
// Stored on CanvasState.candidates so the preview always shows what created
// that specific batch, even if the user changes controls afterward.

export interface CandidateSnapshot {
  styleCategory:     StyleCategory;
  gender:            string;
  ageRange:          string;
  skinTone:          string;
  faceStruct:        string;
  fashion:           string;
  realism:           string;
  ethnicityRegion:   string;
  mixedBlendRegions: string[];
  mood:              string[];
  platforms:         string[];
  tags:              string[];
  // Phase A — Biological Identity
  species:           string;
  hairIdentity:      string;
  eyeColor:          string;
  eyeType:           string;
  skinMarks:         string[];
  earType:           string;
  hornType:          string;
  // Phase B — Body Architecture (transient casting params, not persisted to DB)
  bodyType:          string;
  leftArm:           string;
  rightArm:          string;
  leftLeg:           string;
  rightLeg:          string;
  skinArt:           string[];
}

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
  | { phase: "candidates"; influencer_id: string; candidates: string[]; style_category: StyleCategory; expected_count: number; snapshot: CandidateSnapshot }
  | { phase: "selected"; active: ActiveInfluencer };

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInfluencerBuilder() {
  const { user, session } = useAuth();

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

  // ── Phase B — Body Architecture (transient casting params) ────────────────
  const [bodyType,    setBodyType]    = useState<string>("");
  const [leftArm,     setLeftArm]     = useState<string>("");
  const [rightArm,    setRightArm]    = useState<string>("");
  const [leftLeg,     setLeftLeg]     = useState<string>("");
  const [rightLeg,    setRightLeg]    = useState<string>("");
  const [skinArt,     setSkinArt]     = useState<string[]>([]);

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

  // ── Pending "+ New" confirmation state ────────────────────────────────────
  // When user clicks "+ New" while candidates are visible, we need to confirm
  // they want to discard the pending session before resetting.
  const [pendingNewConfirm, setPendingNewConfirm] = useState(false);

  // ── Candidate session hydration on mount ──────────────────────────────────
  // If the user refreshes after generation completes, restore the candidate
  // selection state from the persisted session. Fire-and-forget — never blocks
  // the UI. Runs once when the auth token is first available.
  const sessionHydratedRef = useRef(false);
  useEffect(() => {
    const token = authTokenRef.current ?? session?.access_token;
    if (!token || sessionHydratedRef.current) return;
    sessionHydratedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/character/ai-influencers/pending-session", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const ps: PendingSession | null = data?.data?.session ?? null;
        if (!ps || !ps.candidate_urls.length) return;

        // Reconstruct CandidateSnapshot from persisted profile + snapshot_extra
        const prof = ps.profile;
        const snapshot: CandidateSnapshot = {
          styleCategory:     ps.style_category,
          gender:            prof.gender            ?? "",
          ageRange:          prof.age_range         ?? "",
          skinTone:          prof.skin_tone         ?? "",
          faceStruct:        prof.face_structure    ?? "",
          fashion:           prof.fashion_style     ?? "",
          realism:           prof.realism_level     ?? "photorealistic",
          ethnicityRegion:   prof.ethnicity_region  ?? "",
          mixedBlendRegions: prof.mixed_blend_regions ?? [],
          mood:              prof.mood              ?? [],
          platforms:         prof.platform_intent   ?? [],
          tags:              ps.tags                ?? [],
          species:           prof.species           ?? "",
          hairIdentity:      prof.hair_identity     ?? "",
          eyeColor:          prof.eye_color         ?? "",
          eyeType:           prof.eye_type          ?? "",
          skinMarks:         prof.skin_marks        ?? [],
          earType:           prof.ear_type          ?? "",
          hornType:          prof.horn_type         ?? "",
          // Phase B — transient body arch params, stored in snapshot_extra
          bodyType:          ps.snapshot_extra.bodyType,
          leftArm:           ps.snapshot_extra.leftArm,
          rightArm:          ps.snapshot_extra.rightArm,
          leftLeg:           ps.snapshot_extra.leftLeg,
          rightLeg:          ps.snapshot_extra.rightLeg,
          skinArt:           ps.snapshot_extra.skinArt,
        };

        // Restore canvas to candidate selection phase
        setCanvasState({
          phase:          "candidates",
          influencer_id:  ps.influencer_id,
          candidates:     ps.candidate_urls,
          expected_count: ps.expected_count,
          snapshot,
          style_category: ps.style_category,
        });

        console.info(
          `[AIInfluencerBuilder] hydrated pending session: ${ps.candidate_urls.length} candidates for influencer ${ps.influencer_id}`,
        );
      } catch (err) {
        // Non-fatal — user just sees empty builder
        console.warn("[AIInfluencerBuilder] pending session hydration failed:", err);
      }
    })();
  }, [session]); // re-run if session changes (e.g. login after render)

  // ── Auth modal — shown when guest clicks Create Influencer ───────────────
  const [authModal, setAuthModal] = useState(false);

  // ── Pricing overlay — shown when ineligible signed-in user tries to create ─
  const [showPricingOverlay, setShowPricingOverlay] = useState(false);

  const ENTITLEMENT_CODES = new Set([
    "FREE_LIMIT_REACHED",
    "SUBSCRIPTION_REQUIRED",
    "SUBSCRIPTION_INACTIVE",
    "TRIAL_EXPIRED",
    "TRIAL_EXHAUSTED",
    "INSUFFICIENT_CREDITS",
  ]);

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
    (influencer_id: string, candidateUrls: string[], expectedCount: number, snapshot: CandidateSnapshot) => {
      setCanvasState(prev => ({
        phase:          "candidates",
        influencer_id,
        candidates:     candidateUrls,
        expected_count: expectedCount,
        snapshot,
        style_category: prev.phase === "generating" ? prev.style_category : "hyper-real",
      }));

      // ── Persist candidate session so it survives a page refresh ─────────────
      // Fire-and-forget — if this fails the user still sees candidates in the
      // current session; the only loss is that refresh won't restore them.
      const token = authTokenRef.current;
      if (token && candidateUrls.length > 0) {
        void fetch(`/api/character/ai-influencers/${influencer_id}`, {
          method:  "PATCH",
          headers: {
            "Content-Type":  "application/json",
            Authorization:   `Bearer ${token}`,
          },
          body: JSON.stringify({
            candidate_session: {
              status:         "ready",
              candidate_urls: candidateUrls,
              expected_count: expectedCount,
              // Phase B body arch params are transient — not in profile, must be stored here
              snapshot_extra: {
                bodyType: snapshot.bodyType,
                leftArm:  snapshot.leftArm,
                rightArm: snapshot.rightArm,
                leftLeg:  snapshot.leftLeg,
                rightLeg: snapshot.rightLeg,
                skinArt:  snapshot.skinArt,
              },
            },
          }),
        }).catch(err =>
          console.warn("[AIInfluencerBuilder] failed to persist candidate session:", err),
        );
      }
    },
    [],
  );

  // ── SINGLE SOURCE OF TRUTH: all creation logic lives here ─────────────────
  const handleCreateInfluencer = useCallback(async () => {
    // ── Guest guard ──────────────────────────────────────────────────────────
    if (!user) { setAuthModal(true); return; }

    // ── Activate generating state IMMEDIATELY ────────────────────────────────
    // setIsCreating(true) must be the very first statement so the canvas
    // transitions to its shimmer/generating phase before any async work begins.
    // Previously this was preceded by await supabase.auth.getSession() which
    // competed for the Supabase auth lock and caused a 2–3 s dead pause with
    // no visible UI change while the lock resolved.
    setIsCreating(true);
    setCreateError(null);

    // ── Freeze builder state at dispatch time ─────────────────────────────────
    // All 4 candidates in this run share the same builder config, so snapshot
    // once here and carry it through to CanvasState.candidates.snapshot.
    // The preview modal reads this — NOT live builder state — so changing controls
    // after generation never corrupts what a candidate actually shows.
    const snapshot: CandidateSnapshot = {
      styleCategory, gender, ageRange, skinTone, faceStruct, fashion, realism,
      ethnicityRegion, mixedBlendRegions, mood, platforms, tags,
      species, hairIdentity, eyeColor, eyeType, skinMarks, earType, hornType,
      bodyType, leftArm, rightArm, leftLeg, rightLeg, skinArt,
    };

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
            // Body Architecture — transient casting params
            body_type:  bodyType  || undefined,
            left_arm:   leftArm   || undefined,
            right_arm:  rightArm  || undefined,
            left_leg:   leftLeg   || undefined,
            right_leg:  rightLeg  || undefined,
            skin_art:   skinArt.length > 0 ? skinArt : undefined,
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
            snapshot,
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
              handleCandidatesReady(influencer.id, completedUrls, jobs.length, snapshot);
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
        if (errBody.code && ENTITLEMENT_CODES.has(errBody.code)) {
          setIsCreating(false);  // reset loading/shimmer state — no infinite shimmer
          setShowPricingOverlay(true);
          return;  // do NOT call handleCreated
        }
        // Non-fatal for other errors — enter generating state with empty jobs
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
    bodyType, leftArm, rightArm, leftLeg, rightLeg, skinArt,
    handleCreated, handleCandidatesReady, user,
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

  // ── Internal reset — clears all form + canvas state ─────────────────────
  const doResetBuilder = useCallback(() => {
    setCanvasState({ phase: "empty" });
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
    // Phase B — Body Architecture
    setBodyType("");
    setLeftArm("");
    setRightArm("");
    setLeftLeg("");
    setRightLeg("");
    setSkinArt([]);
  }, []);

  // ── Discard the active candidate session ─────────────────────────────────
  // Marks the session discarded in DB (keeps images in gallery) then resets UI.
  const handleDiscardCandidates = useCallback(() => {
    const state = canvasState;
    if (state.phase === "candidates") {
      const token = authTokenRef.current;
      if (token) {
        void fetch(`/api/character/ai-influencers/${state.influencer_id}`, {
          method:  "PATCH",
          headers: {
            "Content-Type":  "application/json",
            Authorization:   `Bearer ${token}`,
          },
          body: JSON.stringify({
            candidate_session: { status: "discarded" },
          }),
        }).catch(err =>
          console.warn("[AIInfluencerBuilder] discard session PATCH failed:", err),
        );
      }
    }
    doResetBuilder();
    setPendingNewConfirm(false);
    // Refresh library in case slot state changed
    setLibraryKey(k => k + 1);
  }, [canvasState, doResetBuilder]);

  // ── "+ New" — guarded: shows confirmation if candidates are pending ───────
  const handleNewInfluencer = useCallback(() => {
    if (canvasState.phase === "candidates") {
      // Don't reset immediately — ask the user to confirm discarding the batch
      setPendingNewConfirm(true);
      return;
    }
    doResetBuilder();
  }, [canvasState.phase, doResetBuilder]);

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
        position: "relative", // needed for confirmation overlay absolute positioning
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
          onDiscardCandidates={handleDiscardCandidates}
        />

        {/* ── Pending "+ New" confirmation overlay ────────────────────── */}
        {pendingNewConfirm && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 900,
            background: "rgba(3,5,10,0.88)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "#0b0e1a",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: 14,
              padding: "32px 36px",
              maxWidth: 420, width: "100%",
              display: "flex", flexDirection: "column", gap: 18,
              boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.12)",
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 15, fontWeight: 700,
                color: "#e8eaf0", letterSpacing: "0.01em",
              }}>
                Discard candidate set?
              </div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 13, color: "rgba(232,234,240,0.65)", lineHeight: 1.6,
              }}>
                You have generated candidates that are not locked yet. Starting over will discard this candidate set.
                Your generated images will remain in Image Studio gallery and credits are not refunded.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setPendingNewConfirm(false)}
                  style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    color: "rgba(232,234,240,0.6)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, padding: "8px 20px",
                    cursor: "pointer",
                  }}
                >
                  Keep candidates
                </button>
                <button
                  onClick={handleDiscardCandidates}
                  style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 700,
                    color: "#111",
                    background: "#f59e0b",
                    border: "none",
                    borderRadius: 8, padding: "8px 20px",
                    cursor: "pointer",
                  }}
                >
                  Discard & Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Auth modal — shown when guest clicks Create Influencer ──────── */}
      {authModal && (
        <AuthModal defaultTab="login" onClose={() => setAuthModal(false)} />
      )}

      {/* ── Pricing overlay — shown when ineligible signed-in user creates ─ */}
      {showPricingOverlay && (
        <PricingOverlay onClose={() => setShowPricingOverlay(false)} />
      )}

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
          styleCategory={styleCategory}         setStyleCategory={setStyleCategory}
          gender={gender}                       setGender={setGender}
          ageRange={ageRange}                   setAgeRange={setAgeRange}
          skinTone={skinTone}                   setSkinTone={setSkinTone}
          faceStruct={faceStruct}               setFaceStruct={setFaceStruct}
          ethnicityRegion={ethnicityRegion}     setEthnicityRegion={setEthnicityRegion}
          mixedBlendRegions={mixedBlendRegions} setMixedBlendRegions={setMixedBlendRegions}
          candidateCount={candidateCount}       setCandidateCount={setCandidateCount}
          species={species}                     setSpecies={setSpecies}
          hairIdentity={hairIdentity}           setHairIdentity={setHairIdentity}
          eyeColor={eyeColor}                   setEyeColor={setEyeColor}
          eyeType={eyeType}                     setEyeType={setEyeType}
          skinMarks={skinMarks}                 setSkinMarks={setSkinMarks}
          earType={earType}                     setEarType={setEarType}
          hornType={hornType}                   setHornType={setHornType}
          bodyType={bodyType}                   setBodyType={setBodyType}
          leftArm={leftArm}                     setLeftArm={setLeftArm}
          rightArm={rightArm}                   setRightArm={setRightArm}
          leftLeg={leftLeg}                     setLeftLeg={setLeftLeg}
          rightLeg={rightLeg}                   setRightLeg={setRightLeg}
          skinArt={skinArt}                     setSkinArt={setSkinArt}
        />
      </div>

    </div>
  );
}
