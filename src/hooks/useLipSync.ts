"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useLipSync — Frontend hook for the Lip Sync workflow
//
// Manages the full lifecycle:
//   upload face → upload audio → create generation → poll status → show output
//
// Provider availability is checked on mount via GET /api/lipsync/providers.
// When no provider is ready, the UI shows "Coming Soon".
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import type { LipSyncQuality, LipSyncStatus } from "@/lib/lipsync/status";
import { getLipSyncCredits }        from "@/lib/lipsync/credits";
import { validateAudioDuration }    from "@/lib/lipsync/validation";
import { getPendingJobStoreState }  from "@/lib/jobs/pending-job-store";
import { useAuth }                  from "@/components/auth/AuthContext";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS        = 90; // 6 minutes max

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LipSyncAssetState {
  assetId:    string | null;
  url:        string | null;        // server-side signed URL
  previewUrl: string | null;        // local blob preview
  name:       string | null;
  status:     "idle" | "uploading" | "ready" | "error";
  error:      string | null;
}

export interface LipSyncHistoryItem {
  id:              string;
  status:          LipSyncStatus;
  qualityLabel:    string;
  qualityMode:     LipSyncQuality;
  durationSeconds: number | null;
  aspectRatio:     string | null;
  outputUrl:       string | null;
  thumbnailUrl:    string | null;
  creditsUsed:     number;
  failureReason:   string | null;
  createdAt:       string;
  completedAt:     string | null;
}

export interface LipSyncState {
  // Provider availability
  providerReady:    boolean;
  standardReady:    boolean;
  proReady:         boolean;
  // Uploads
  face:             LipSyncAssetState;
  audio:            LipSyncAssetState;
  audioDuration:    number | null;
  // Generation config
  qualityMode:      LipSyncQuality;
  estimatedCredits: number;
  // Generation state
  generationId:     string | null;
  generationStatus: LipSyncStatus | null;
  generationProgress: number | null;
  outputUrl:        string | null;
  thumbnailUrl:     string | null;
  errorMessage:     string | null;
  // Overall readiness
  canGenerate:      boolean;
  isGenerating:     boolean;
}

const EMPTY_ASSET: LipSyncAssetState = {
  assetId: null, url: null, previewUrl: null,
  name: null, status: "idle", error: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLipSync(authToken: string | null) {
  const { user }         = useAuth();
  const [standardReady, setStandardReady] = useState(false);
  const [proReady,       setProReady]     = useState(false);
  const [face,           setFace]         = useState<LipSyncAssetState>(EMPTY_ASSET);
  const [audio,          setAudio]        = useState<LipSyncAssetState>(EMPTY_ASSET);
  const [audioDuration,  setAudioDuration] = useState<number | null>(null);
  const [qualityMode,    setQualityMode]  = useState<LipSyncQuality>("standard");
  const [generationId,   setGenerationId] = useState<string | null>(null);
  const [genStatus,      setGenStatus]    = useState<LipSyncStatus | null>(null);
  const [genProgress,    setGenProgress]  = useState<number | null>(null);
  const [outputUrl,      setOutputUrl]    = useState<string | null>(null);
  const [thumbnailUrl,   setThumbnailUrl] = useState<string | null>(null);
  const [errorMessage,   setErrorMessage] = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollsRef   = useRef(0);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const providerReady    = standardReady || proReady;
  const effectiveQuality: LipSyncQuality = (!proReady && qualityMode === "pro") ? "standard" : qualityMode;
  const estimatedCredits = getLipSyncCredits({
    qualityMode:     effectiveQuality,
    durationSeconds: audioDuration ?? 0,
  });
  const canGenerate =
    providerReady &&
    face.status  === "ready" &&
    audio.status === "ready" &&
    !!audioDuration &&
    !genStatus;
  const isGenerating = genStatus === "queued" || genStatus === "processing";

  // ── Auth headers helper ──────────────────────────────────────────────────────
  const authHeaders = useCallback((): HeadersInit => {
    return authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {};
  }, [authToken]);

  // ── Check provider availability on mount ─────────────────────────────────────
  // Auto-selects "pro" if that is the only available tier.
  useEffect(() => {
    fetch("/api/lipsync/providers")
      .then(r => r.json())
      .then((d: { standard?: boolean; pro?: boolean }) => {
        const stdReady = !!d.standard;
        const proReady = !!d.pro;
        setStandardReady(stdReady);
        setProReady(proReady);
        // Auto-select pro when it's the only available tier
        if (proReady && !stdReady) {
          setQualityMode("pro");
        }
      })
      .catch(() => { /* providers unavailable — Coming Soon */ });
  }, []);

  // ── Upload face image ─────────────────────────────────────────────────────────
  const uploadFace = useCallback(async (file: File, previewUrl: string) => {
    setFace({ assetId: null, url: null, previewUrl, name: file.name, status: "uploading", error: null });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch("/api/lipsync/upload/face", {
        method: "POST",
        headers: authHeaders(),
        body:   formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFace(prev => ({ ...prev, status: "error", error: data.error ?? "Upload failed" }));
        return;
      }

      setFace({
        assetId:    data.assetId,
        url:        data.url,
        previewUrl,
        name:       file.name,
        status:     "ready",
        error:      null,
      });
    } catch (err) {
      setFace(prev => ({ ...prev, status: "error", error: err instanceof Error ? err.message : "Upload error" }));
    }
  }, [authHeaders]);

  // ── Upload audio ──────────────────────────────────────────────────────────────
  const uploadAudio = useCallback(async (file: File, durationSeconds: number) => {
    // Validate duration before uploading
    const durVal = validateAudioDuration(durationSeconds);
    if (!durVal.valid) {
      setAudio({ assetId: null, url: null, previewUrl: null, name: file.name, status: "error", error: durVal.error! });
      return;
    }

    setAudio({ assetId: null, url: null, previewUrl: null, name: file.name, status: "uploading", error: null });
    setAudioDuration(durationSeconds);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("duration_seconds", String(durationSeconds));

    try {
      const res  = await fetch("/api/lipsync/upload/audio", {
        method: "POST",
        headers: authHeaders(),
        body:   formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAudio(prev => ({ ...prev, status: "error", error: data.error ?? "Upload failed" }));
        return;
      }

      setAudio({
        assetId:    data.assetId,
        url:        data.url,
        previewUrl: null,
        name:       file.name,
        status:     "ready",
        error:      null,
      });
      setAudioDuration(data.durationSeconds ?? durationSeconds);
    } catch (err) {
      setAudio(prev => ({ ...prev, status: "error", error: err instanceof Error ? err.message : "Upload error" }));
    }
  }, [authHeaders]);

  // ── Stop any running poll ─────────────────────────────────────────────────────
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollsRef.current = 0;
  }, []);

  // ── Poll generation status ────────────────────────────────────────────────────
  // Named attachLipSyncPolling (not startPolling) to avoid import conflicts with
  // the universal job-polling engine. LipSync uses its own status endpoint
  // (/api/lipsync/${id}/status) and status vocabulary, so it keeps its own loop.
  const attachLipSyncPolling = useCallback((id: string) => {
    stopPoll();
    pollsRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollsRef.current++;

      if (pollsRef.current > MAX_POLLS) {
        stopPoll();
        setGenStatus("failed");
        setErrorMessage("Generation timed out");
        getPendingJobStoreState().failJob(id, "stale", "Generation timed out.");
        return;
      }

      try {
        const res  = await fetch(`/api/lipsync/${id}/status`, { headers: authHeaders() });
        const data = await res.json();

        if (!res.ok) {
          stopPoll();
          setGenStatus("failed");
          setErrorMessage(data.error ?? "Status check failed");
          return;
        }

        setGenProgress(data.progress ?? null);
        setGenStatus(data.status);

        if (data.status === "completed") {
          stopPoll();
          setOutputUrl(data.output_url ?? null);
          setThumbnailUrl(data.thumbnail_url ?? null);
          getPendingJobStoreState().completeJob(id, data.output_url ?? "", null);
        } else if (data.status === "failed") {
          stopPoll();
          setErrorMessage(data.failure_reason ?? "Generation failed");
          getPendingJobStoreState().failJob(id, "failed", data.failure_reason ?? "Generation failed");
        } else if (data.status === "cancelled") {
          stopPoll();
          getPendingJobStoreState().failJob(id, "cancelled", "Generation cancelled.");
        }
      } catch { /* ignore transient errors */ }
    }, POLL_INTERVAL_MS);
  }, [authHeaders, stopPoll]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create generation ─────────────────────────────────────────────────────────
  const create = useCallback(async (aspectRatio: string = "9:16") => {
    if (!canGenerate) return;
    if (!face.assetId || !audio.assetId) return;

    setGenStatus("queued");
    setGenProgress(null);
    setOutputUrl(null);
    setThumbnailUrl(null);
    setErrorMessage(null);

    try {
      const res  = await fetch("/api/lipsync/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body:    JSON.stringify({
          source_face_asset_id:  face.assetId,
          source_audio_asset_id: audio.assetId,
          quality_mode:          effectiveQuality,
          duration_seconds:      audioDuration,
          aspect_ratio:          aspectRatio,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setGenStatus("failed");
        setErrorMessage(data.error ?? "Creation failed");
        return;
      }

      setGenerationId(data.generation_id);
      setGenStatus("processing");

      // Register with Activity Center — generation_id is already the canonical job id.
      // Only called after a successful create response so no orphan cards are created.
      getPendingJobStoreState().registerJob({
        jobId:      data.generation_id,
        assetId:    data.generation_id,
        studio:     "lipsync",
        modelKey:   `lipsync_${effectiveQuality}`,
        modelLabel: effectiveQuality === "standard" ? "Lip Sync Standard" : "Lip Sync Pro",
        prompt:     "",
        status:     "processing",
        creditCost: audioDuration
          ? getLipSyncCredits({ qualityMode: effectiveQuality, durationSeconds: audioDuration })
          : undefined,
        createdAt:  new Date().toISOString(),
        userId:     user?.id,
      });

      attachLipSyncPolling(data.generation_id);
    } catch (err) {
      setGenStatus("failed");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [canGenerate, face.assetId, audio.assetId, effectiveQuality, audioDuration, authHeaders, attachLipSyncPolling, user]);

  // ── Retry failed generation ──────────────────────────────────────────────────
  const retry = useCallback(async () => {
    if (!generationId || genStatus !== "failed") return;

    setGenStatus("queued");
    setErrorMessage(null);

    const res  = await fetch(`/api/lipsync/${generationId}/retry`, {
      method: "POST", headers: authHeaders(),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setGenStatus("failed");
      setErrorMessage(data.error ?? "Retry failed");
      return;
    }

    setGenStatus("processing");

    // Re-register with same jobId to overwrite the terminal "failed" card.
    // updateJob() is terminal-guarded and would be a no-op on "failed" status.
    getPendingJobStoreState().registerJob({
      jobId:      generationId,
      assetId:    generationId,
      studio:     "lipsync",
      modelKey:   `lipsync_${effectiveQuality}`,
      modelLabel: effectiveQuality === "standard" ? "Lip Sync Standard" : "Lip Sync Pro",
      prompt:     "",
      status:     "processing",
      createdAt:  new Date().toISOString(),
      userId:     user?.id,
    });

    attachLipSyncPolling(generationId);
  }, [generationId, genStatus, authHeaders, attachLipSyncPolling, effectiveQuality, user]);

  // ── Reset for a new generation ────────────────────────────────────────────────
  const reset = useCallback(() => {
    stopPoll();
    setFace(EMPTY_ASSET);
    setAudio(EMPTY_ASSET);
    setAudioDuration(null);
    setGenerationId(null);
    setGenStatus(null);
    setGenProgress(null);
    setOutputUrl(null);
    setThumbnailUrl(null);
    setErrorMessage(null);
  }, [stopPoll]);

  // ── Fetch history ─────────────────────────────────────────────────────────────
  const listHistory = useCallback(async (limit = 20, offset = 0): Promise<LipSyncHistoryItem[]> => {
    try {
      const res  = await fetch(`/api/lipsync/mine?limit=${limit}&offset=${offset}`, { headers: authHeaders() });
      const data = await res.json();
      return data.generations ?? [];
    } catch {
      return [];
    }
  }, [authHeaders]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => () => stopPoll(), [stopPoll]);

  // ── Exposed state + methods ───────────────────────────────────────────────────
  const state: LipSyncState = {
    providerReady,
    standardReady,
    proReady,
    face,
    audio,
    audioDuration,
    qualityMode:      effectiveQuality,
    estimatedCredits,
    generationId,
    generationStatus: genStatus,
    generationProgress: genProgress,
    outputUrl,
    thumbnailUrl,
    errorMessage,
    canGenerate,
    isGenerating,
  };

  return {
    state,
    setQualityMode,
    uploadFace,
    uploadAudio,
    create,
    retry,
    reset,
    listHistory,
  };
}
