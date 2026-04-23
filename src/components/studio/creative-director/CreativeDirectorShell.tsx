"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import Tooltip from "@/components/ui/Tooltip";
import BriefBuilder, { type BriefState } from "./BriefBuilder";
import ConceptBoard, { type ConceptCard } from "./ConceptBoard";
import OutputWorkspace, {
  type GenerationResult,
  type OutputAction,
} from "./OutputWorkspace";
import CreativeRenderDock, { type RenderDockSettings } from "./CreativeRenderDock";

// ─────────────────────────────────────────────────────────────────────────────
// CreativeDirectorShell — AI Creative Director main layout + state
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BRIEF: BriefState = {
  projectName: "",
  projectType: "",
  brandName: "",
  audience: "",
  platform: "",
  goal: "",
  headline: "",
  subheadline: "",
  cta: "",
  additionalNotes: "",
  stylePreset: "",
  moodTags: [],
  visualIntensity: "balanced",
  textRenderingIntent: "none",
  realismVsDesign: 50,
  colorPreference: "",
  aspectRatio: "1:1",
  outputCount: 1,
  advancedOpen: false,
  preferredProvider: "Auto",
  avoidElements: "",
  compositionPreference: "",
};

// ── Brief API serializer ──────────────────────────────────────────────────────
// BriefState.realismVsDesign is stored as 0–100 (integer slider).
// The API schema expects a 0–1 float. Normalise at the boundary so nothing
// inside the app ever needs to think about which scale is which.
function serializeBriefForApi(b: BriefState): Record<string, unknown> {
  const raw = b.realismVsDesign;
  const normalized =
    typeof raw === "number" && !Number.isNaN(raw)
      ? Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw))
      : 0.5; // safe default if somehow undefined/NaN

  return {
    ...b,
    realismVsDesign: normalized,
    // Schema validator reads `additionalCopyNotes` — BriefState uses `additionalNotes`.
    // Explicitly remap so the field is not silently dropped on every brief save.
    additionalCopyNotes: b.additionalNotes,
  };
}

// ── Generation row → GenerationResult mapper ─────────────────────────────────
// All CD generation API routes return raw DB rows (snake_case).
// GenerationResult is camelCase. This mapper normalises at the shell boundary.
// The `url` field comes from the image generate route for synchronous providers
// (e.g. GPT Image). Async providers (NB, Kling) return null initially; the
// poll loop fills it in once the job completes.
function mapGenerationRow(row: Record<string, unknown>): GenerationResult {
  return {
    id:             String(row.id ?? ""),
    url:            typeof row.url === "string" ? row.url : null,
    status:         (row.status as GenerationResult["status"]) ?? "processing",
    provider:       String(row.provider ?? ""),
    model:          String(row.model ?? ""),
    creditCost:     typeof row.credit_cost === "number" ? row.credit_cost : 0,
    variationType:  typeof row.variation_type === "string" ? row.variation_type : undefined,
    generationType: (row.generation_type as GenerationResult["generationType"]) ?? "base",
    assetId:        typeof row.asset_id === "string" ? row.asset_id : undefined,
  };
}

// ── DB row → UI type mapper ───────────────────────────────────────────────────
// The concepts API returns raw snake_case DB rows (CreativeConceptRow).
// ConceptCard is camelCase. This mapper normalises at the shell boundary.
interface ConceptRow {
  id: string;
  title: string;
  summary: string;
  rationale?: string | null;
  layout_strategy?: string | null;
  typography_strategy?: string | null;
  color_strategy?: string | null;
  recommended_provider?: string | null;
  recommended_use_case?: string | null;
  scores?: Record<string, number> | null;
}

function mapConceptRowToCard(row: ConceptRow): ConceptCard {
  const scores = (row.scores ?? {}) as Record<string, number>;
  return {
    id:                   row.id,
    title:                row.title,
    summary:              row.summary,
    rationale:            row.rationale ?? undefined,
    layoutStrategy:       row.layout_strategy ?? undefined,
    typographyStrategy:   row.typography_strategy ?? undefined,
    colorStrategy:        row.color_strategy ?? undefined,
    recommendedProvider:  row.recommended_provider ?? "openai",
    recommendedUseCase:   row.recommended_use_case ?? undefined,
    scores: {
      textAccuracy:      scores.textAccuracy      ?? 0,
      cinematicImpact:   scores.cinematicImpact   ?? 0,
      designControl:     scores.designControl     ?? 0,
      speed:             scores.speed             ?? 0,
    },
  };
}

// ── Toast types ───────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  message: string;
  type: "error" | "warning" | "info";
}

// ── Inline editable project name ──────────────────────────────────────────────
function InlineProjectName({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed || "Untitled Project");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(37,99,235,0.35)",
          borderRadius: 6,
          padding: "4px 10px",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          outline: "none",
          width: 240,
        }}
      />
    );
  }

  return (
    <Tooltip content="Click to rename project">
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        background:   "rgba(255,255,255,0.05)",
        border:       "1px solid rgba(255,255,255,0.16)",  /* always-visible border */
        borderRadius: 8,
        padding:      "5px 12px",
        color:        "#F0F3FF",
        fontSize:     14,
        fontWeight:   600,
        cursor:       "text",
        transition:   "all 0.15s ease",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(86,140,255,0.45)";
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(86,140,255,0.08)";
        (e.currentTarget as HTMLButtonElement).style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.16)";
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLButtonElement).style.color = "#F0F3FF";
      }}
    >
      {value}
      {/* Edit icon — clearly visible, not faint */}
      <span
        style={{
          fontSize:   13,
          color:      "rgba(147,197,253,0.7)",
          fontWeight: 400,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ✎
      </span>
    </button>
    </Tooltip>
  );
}

// ── Toast copy map ────────────────────────────────────────────────────────────
// Maps raw API / internal strings → polished user-facing copy.
// Add entries here instead of scattering rewrites across handlers.
const TOAST_COPY: Record<string, string> = {
  // API credit errors
  "Credit deduction failed":
    "Unable to start generation — credits could not be deducted. Please try again.",
  "Insufficient credits":
    "You don't have enough credits for this generation. Top up and try again.",
  "Credit deduction failed (concepts)":
    "Concept generation could not start — credits could not be deducted. Please try again.",

  // Auth gates
  "Sign in to generate concepts.":
    "Please sign in to generate concepts.",
  "Sign in to generate outputs.":
    "Please sign in to generate outputs.",
  "Sign in to use Improve Brief.":
    "Please sign in to use Improve Brief.",

  // Workflow gates
  "Generate concepts first to enable Improve Brief.":
    "Generate concepts first to unlock Improve Brief.",

  // Brief
  "Brief improved.": "Brief improved successfully.",
  "Could not improve brief. Try again.":
    "Improve Brief failed. Please try again.",

  // Generation
  "Regenerate failed. Try again.":
    "Regeneration failed. Please try again.",
  "Could not create variation. Try again.":
    "Could not create a variation. Please try again.",
  "Format adaptation failed. Try again.":
    "Format adaptation failed. Please try again.",

  // Auth failures
  "Unauthorized": "Session expired — please refresh the page and try again.",

  // Generic fallbacks already shown with good copy — keep as-is
  "Failed to create project": "Failed to create project. Please try again.",
  "Failed to save brief": "Failed to save brief. Please try again.",
  "Failed to generate concepts":
    "Concept generation failed. Please try again.",
  "Failed to start generation":
    "Generation could not start. Please try again.",
  "Regenerate failed": "Regeneration failed. Please try again.",
  "Variation failed": "Could not create a variation. Please try again.",
  "Adapt format failed": "Format adaptation failed. Please try again.",
};

// ── Toast component ────────────────────────────────────────────────────────────
function ToastBar({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 112,           // sits above the dock
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: "14px 28px",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.45,
            color: "#fff",
            maxWidth: 520,
            textAlign: "center",
            wordBreak: "break-word",
            background:
              toast.type === "error"
                ? "rgba(185,28,28,0.97)"
                : toast.type === "warning"
                ? "rgba(180,83,9,0.97)"
                : "rgba(29,78,216,0.97)",
            border:
              toast.type === "error"
                ? "1px solid rgba(252,165,165,0.35)"
                : toast.type === "warning"
                ? "1px solid rgba(253,211,77,0.35)"
                : "1px solid rgba(147,197,253,0.35)",
            backdropFilter: "blur(12px)",
            boxShadow:
              toast.type === "error"
                ? "0 8px 32px rgba(185,28,28,0.45), 0 2px 8px rgba(0,0,0,0.5)"
                : toast.type === "warning"
                ? "0 8px 32px rgba(180,83,9,0.4), 0 2px 8px rgba(0,0,0,0.5)"
                : "0 8px 32px rgba(29,78,216,0.4), 0 2px 8px rgba(0,0,0,0.5)",
            letterSpacing: "-0.01em",
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// ── Main shell ─────────────────────────────────────────────────────────────────
export default function CreativeDirectorShell() {
  const { session } = useAuth();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [brief, setBrief] = useState<BriefState>(DEFAULT_BRIEF);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [conceptBoardState, setConceptBoardState] = useState<
    "empty" | "loading" | "results" | "detail"
  >("empty");
  const [concepts, setConcepts] = useState<ConceptCard[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<GenerationResult[]>([]);
  const [activeVariationTray, setActiveVariationTray] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [autosaveState, setAutosaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [creditsEstimate, setCreditsEstimate] = useState<number | null>(1);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [isGeneratingOutputs, setIsGeneratingOutputs] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Sync authHeader — used only in the poll loop (fire-and-forget, session stale is tolerable)
  const authHeader = useCallback((): HeadersInit => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session]);

  // Async getAuthHeaders — used in all user-initiated action handlers.
  // Reads the live token from supabase's in-memory state (handles auto-refresh).
  // Falls back to React session state if supabase.auth.getSession() fails.
  const getAuthHeaders = useCallback(
    async (): Promise<HeadersInit> => {
      try {
        const { data: { session: live } } = await supabase.auth.getSession();
        const token = live?.access_token ?? session?.access_token;
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      } catch {
        const token = session?.access_token;
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      }
    },
    [session]
  );

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "error") => {
      const id = Math.random().toString(36).slice(2);
      // Humanise known raw API error strings before displaying
      const display = TOAST_COPY[message] ?? message;
      setToasts((prev) => [...prev, { id, message: display, type }]);
      // Errors and warnings stay longer so they're never missed
      const duration = type === "info" ? 4500 : 7000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  // Brief change handler — marks unsaved
  const handleBriefChange = useCallback((updates: Partial<BriefState>) => {
    setBrief((prev) => ({ ...prev, ...updates }));
    setAutosaveState("unsaved");
  }, []);

  // ── Generate concepts flow ────────────────────────────────────────────────────
  const handleGenerateConcepts = useCallback(async () => {
    if (isGeneratingConcepts) return;

    // Get a live token once — used for all three requests in this flow.
    // getAuthHeaders() reads from supabase's in-memory state which handles
    // auto-refresh, so this is safe even if the React session state is stale.
    const authH = await getAuthHeaders();
    if (!("Authorization" in authH)) {
      addToast("Session expired — please refresh the page and try again.", "warning");
      return;
    }

    const jsonHeaders: HeadersInit = { "Content-Type": "application/json", ...authH };

    setIsGeneratingConcepts(true);
    setConceptBoardState("loading");

    try {
      let currentProjectId = projectId;
      let currentBriefId = briefId;

      // 1. Create project if none
      if (!currentProjectId) {
        const projRes = await fetch("/api/creative-director/projects", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            title: projectName || brief.projectName || "Untitled Project",
            projectType: brief.projectType,
          }),
        });

        if (!projRes.ok) {
          const err = await projRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Failed to create project");
        }

        const projData = (await projRes.json()) as {
          project: { id: string };
          brief: { id: string };
        };
        currentProjectId = projData.project.id;
        currentBriefId = projData.brief.id;
        setProjectId(currentProjectId);
        setBriefId(currentBriefId);
      }

      // 2. Update brief
      const briefRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/brief`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(serializeBriefForApi(brief)),
        }
      );
      if (!briefRes.ok) {
        const err = await briefRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save brief");
      }
      if (!currentBriefId) {
        const briefData = (await briefRes.json()) as { brief?: { id: string } };
        if (briefData.brief?.id) {
          currentBriefId = briefData.brief.id;
          setBriefId(currentBriefId);
        }
      }

      // 3. Generate concepts
      const conceptsRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/concepts`,
        {
          method: "POST",
          headers: jsonHeaders,
        }
      );
      if (!conceptsRes.ok) {
        const err = await conceptsRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate concepts");
      }

      const conceptsData = (await conceptsRes.json()) as { concepts: ConceptRow[]; estimatedGenerationCredits?: number };
      setConcepts((conceptsData.concepts ?? []).map(mapConceptRowToCard));
      if (conceptsData.estimatedGenerationCredits != null) {
        setCreditsEstimate(conceptsData.estimatedGenerationCredits);
      }
      setConceptBoardState("results");
      setAutosaveState("saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong generating concepts.";
      addToast(message, "error");
      setConceptBoardState(concepts.length > 0 ? "results" : "empty");
    } finally {
      setIsGeneratingConcepts(false);
    }
  }, [
    isGeneratingConcepts,
    projectId,
    briefId,
    projectName,
    brief,
    getAuthHeaders,
    addToast,
    concepts.length,
  ]);

  // ── Improve brief ─────────────────────────────────────────────────────────────
  const handleImproveBrief = useCallback(async () => {
    if (!projectId) {
      addToast("Generate concepts first to unlock Improve Brief.", "warning");
      return;
    }
    const authH = await getAuthHeaders();
    if (!("Authorization" in authH)) {
      addToast("Session expired — please refresh the page and try again.", "warning");
      return;
    }
    try {
      const res = await fetch(
        `/api/creative-director/projects/${projectId}/brief/improve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authH },
          body: JSON.stringify(serializeBriefForApi(brief)),
        }
      );
      if (!res.ok) throw new Error("Improve brief failed");
      const data = (await res.json()) as { brief?: Partial<BriefState> };
      if (data.brief) {
        setBrief((prev) => ({ ...prev, ...data.brief }));
        addToast("Brief improved successfully.", "info");
      }
    } catch {
      addToast("Improve Brief failed. Please try again.", "error");
    }
  }, [projectId, brief, getAuthHeaders, addToast]);

  // ── Poll generation status ────────────────────────────────────────────────────
  // Polls the studio job status endpoint. genId is the creative_generation.id
  // used to find the card in state. assetId is the assets table row ID that the
  // status route actually expects — for async providers these are different.
  // The status route returns: { success: true, data: { status: "success"|"pending"|"failed", url? } }
  const pollGeneration = useCallback(
    async (genId: string, assetId?: string) => {
      // Without an assetId we can't poll — the status route requires it
      if (!assetId) return;

      const MAX_POLLS = 60;
      let polls = 0;
      const interval = setInterval(async () => {
        polls++;
        if (polls > MAX_POLLS) {
          clearInterval(interval);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === genId ? { ...g, status: "failed" } : g
            )
          );
          return;
        }
        try {
          const res = await fetch(`/api/studio/jobs/${assetId}/status`, {
            headers: authHeader(),
          });
          if (!res.ok) return;
          const envelope = (await res.json()) as {
            success?: boolean;
            data?: { status?: string; url?: string };
          };
          const jobStatus = envelope.data?.status;
          if (jobStatus === "success" || jobStatus === "failed") {
            clearInterval(interval);
            const cdStatus: GenerationResult["status"] =
              jobStatus === "success" ? "completed" : "failed";
            const url = envelope.data?.url ?? null;
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === genId
                  ? { ...g, status: cdStatus, url: url ?? g.url }
                  : g
              )
            );
          }
          // "pending" → keep polling
        } catch {
          // silent poll failure — keep polling
        }
      }, 5000);
      return () => clearInterval(interval);
    },
    [authHeader]
  );

  // ── Generate outputs ───────────────────────────────────────────────────────────
  const handleGenerateConcept = useCallback(
    async (conceptId: string, dockSettings?: RenderDockSettings) => {
      if (isGeneratingOutputs) return;

      const authH = await getAuthHeaders();
      if (!("Authorization" in authH)) {
        addToast("Session expired — please refresh the page and try again.", "warning");
        return;
      }

      setIsGeneratingOutputs(true);

      try {
        // 1. Select concept
        await fetch(`/api/creative-director/concepts/${conceptId}/select`, {
          method: "POST",
          headers: authH,
        });

        // 2. Generate outputs — use dock settings if provided, else brief fallback
        const count = dockSettings?.outputCount ?? brief.outputCount ?? 1;
        const res = await fetch(
          `/api/creative-director/concepts/${conceptId}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authH },
            body: JSON.stringify({
              count,
              model:        dockSettings?.model,
              quality:      dockSettings?.quality,
              resolution:   dockSettings?.resolution,
              aspectRatio:  dockSettings?.aspectRatio,
              promptText:   dockSettings?.promptText,
              referenceImages: dockSettings?.referenceImages,
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Failed to start generation");
        }

        const data = (await res.json()) as { generations: Record<string, unknown>[] };
        const newGens = (data.generations ?? []).map(mapGenerationRow);
        setGenerations((prev) => [...newGens, ...prev]);

        // 3. Poll each async generation (sync providers already have status=completed + url)
        newGens.forEach((g) => {
          if ((g.status === "queued" || g.status === "processing") && g.assetId) {
            pollGeneration(g.id, g.assetId);
          }
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed. Please try again.";
        addToast(message, "error");
      } finally {
        setIsGeneratingOutputs(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGeneratingOutputs, brief.outputCount, getAuthHeaders, addToast, pollGeneration]
  );

  // ── Select / expand concept ────────────────────────────────────────────────────
  const handleSelectConcept = useCallback(
    (id: string) => {
      if (selectedConceptId === id && conceptBoardState === "detail") {
        // Already in detail — go back to results
        setConceptBoardState("results");
      } else {
        setSelectedConceptId(id);
        if (conceptBoardState !== "detail") {
          // Just select, don't go to detail
        }
      }
    },
    [selectedConceptId, conceptBoardState]
  );

  const handleExpandConcept = useCallback(
    (id: string) => {
      setSelectedConceptId(id);
      setConceptBoardState("detail");
    },
    []
  );

  // ── Output actions ─────────────────────────────────────────────────────────────
  const handleOutputAction = useCallback(
    async (action: OutputAction, generationId: string) => {
      switch (action) {
        case "variation_tray": {
          setActiveVariationTray((prev) =>
            prev === generationId ? null : generationId
          );
          break;
        }
        case "regenerate": {
          const gen = generations.find((g) => g.id === generationId);
          if (!gen) return;
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId ? { ...g, status: "queued", url: null } : g
            )
          );
          try {
            const authH = await getAuthHeaders();
            const res = await fetch(
              `/api/creative-director/generations/${generationId}/regenerate`,
              {
                method: "POST",
                headers: authH,
              }
            );
            if (!res.ok) throw new Error("Regenerate failed");
            const data = (await res.json()) as {
              generationId?: string;
              generation?: Record<string, unknown>;
            };
            const newId = data.generationId ?? generationId;
            const newGen = data.generation ? mapGenerationRow(data.generation) : null;
            if (newId !== generationId) {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === generationId
                    ? (newGen ?? { ...g, id: newId, status: "processing", url: null })
                    : g
                )
              );
              if (newGen?.status === "processing" && newGen.assetId) {
                pollGeneration(newId, newGen.assetId);
              }
            } else {
              // Same ID (shouldn't happen), just poll with existing assetId
              const existing = generations.find((g) => g.id === generationId);
              if (existing?.assetId) pollGeneration(generationId, existing.assetId);
            }
          } catch {
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === generationId ? { ...g, status: "failed" } : g
              )
            );
            addToast("Regeneration failed. Please try again.", "error");
          }
          break;
        }
        case "download": {
          const gen = generations.find((g) => g.id === generationId);
          if (gen?.url) {
            const a = document.createElement("a");
            a.href = gen.url;
            a.download = `zencra-output-${generationId}.png`;
            a.click();
          }
          break;
        }
        case "fullscreen": {
          const gen = generations.find((g) => g.id === generationId);
          if (gen?.url) {
            window.open(gen.url, "_blank", "noopener,noreferrer");
          }
          break;
        }
        case "save": {
          addToast("Saved to your library.", "info"); // already clear
          break;
        }
        default:
          break;
      }
    },
    [generations, getAuthHeaders, addToast, pollGeneration]
  );

  // ── Variation flow ──────────────────────────────────────────────────────────────
  const handleVariation = useCallback(
    async (variationType: string, generationId: string) => {
      setActiveVariationTray(null);
      const authH = await getAuthHeaders();
      try {
        const res = await fetch(
          `/api/creative-director/generations/${generationId}/variation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authH },
            body: JSON.stringify({ variationType }),
          }
        );
        if (!res.ok) throw new Error("Variation failed");
        const data = (await res.json()) as { generation: Record<string, unknown> };
        const newGen = mapGenerationRow(data.generation);
        setGenerations((prev) => [newGen, ...prev]);
        if ((newGen.status === "queued" || newGen.status === "processing") && newGen.assetId) {
          pollGeneration(newGen.id, newGen.assetId);
        }
      } catch {
        addToast("Could not create a variation. Please try again.", "error");
      }
    },
    [getAuthHeaders, addToast, pollGeneration]
  );

  // ── Format adaptation flow ──────────────────────────────────────────────────────
  const handleAdaptFormat = useCallback(
    async (format: string, generationId: string) => {
      const authH = await getAuthHeaders();
      try {
        const res = await fetch(
          `/api/creative-director/generations/${generationId}/adapt-format`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authH },
            body: JSON.stringify({ format }),
          }
        );
        if (!res.ok) throw new Error("Adapt format failed");
        const data = (await res.json()) as { generation: Record<string, unknown> };
        const newGen = mapGenerationRow(data.generation);
        setGenerations((prev) => [newGen, ...prev]);
        if ((newGen.status === "queued" || newGen.status === "processing") && newGen.assetId) {
          pollGeneration(newGen.id, newGen.assetId);
        }
      } catch {
        addToast("Format adaptation failed. Please try again.", "error");
      }
    },
    [getAuthHeaders, addToast, pollGeneration]
  );

  // ── Autosave project name ──────────────────────────────────────────────────────
  const handleProjectNameChange = (name: string) => {
    setProjectName(name);
    setBrief((prev) => ({ ...prev, projectName: name }));
    setAutosaveState("unsaved");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#050816",
        color: "#F5F7FF",
        fontFamily: "inherit",
      }}
    >
      <style>{`
        .cd-col::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Top header bar ── */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0B1022",
          flexShrink: 0,
          gap: 20,
          position: "relative",   /* enables absolute centering of project name */
        }}
      >
        {/* Left: workflow subtitle only — no title duplication */}
        <div style={{ flexShrink: 0 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "rgba(167,176,197,0.5)",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            Brief → Concepts → Campaign-ready visuals
          </span>
        </div>

        {/* Center: editable project name — truly centered over full bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>
            <InlineProjectName
              value={projectName}
              onChange={handleProjectNameChange}
            />
          </div>
        </div>

        {/* Right: autosave + credits + actions — pushed to far right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            marginLeft: "auto",
          }}
        >
          {/* Autosave indicator */}
          <span
            style={{
              fontSize: 10,
              color:
                autosaveState === "saved"
                  ? "rgba(52,211,153,0.6)"
                  : autosaveState === "saving"
                  ? "rgba(96,165,250,0.6)"
                  : "rgba(255,255,255,0.25)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {autosaveState === "saved"
              ? "✓ Saved"
              : autosaveState === "saving"
              ? "Saving…"
              : "Unsaved"}
          </span>

          {/* Credits estimate pill */}
          {creditsEstimate !== null && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 20,
                background: "rgba(37,99,235,0.1)",
                border: "1px solid rgba(37,99,235,0.2)",
                color: "rgba(147,197,253,0.7)",
                letterSpacing: "0.04em",
              }}
            >
              ~{creditsEstimate} cr / run
            </span>
          )}

          {/* Save button */}
          <button
            onClick={() => {
              setAutosaveState("saving");
              setTimeout(() => setAutosaveState("saved"), 800);
            }}
            style={{
              padding: "7px 14px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Save
          </button>

          {/* History button */}
          <button
            style={{
              padding: "7px 14px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            History
          </button>

          {/* New project */}
          <button
            onClick={() => {
              setBrief(DEFAULT_BRIEF);
              setProjectId(null);
              setBriefId(null);
              setConcepts([]);
              setGenerations([]);
              setSelectedConceptId(null);
              setConceptBoardState("empty");
              setProjectName("Untitled Project");
              setAutosaveState("saved");
            }}
            style={{
              padding: "7px 14px",
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 6,
              border: "1px solid rgba(37,99,235,0.3)",
              background: "rgba(37,99,235,0.1)",
              color: "#93c5fd",
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 320px",
          gap: "20px",
          height: "calc(100vh - 48px)",
          overflow: "hidden",
          padding: "0 20px",
          background: "#050816",
        }}
      >
        {/* Left: BriefBuilder — paddingBottom leaves space for dock */}
        <div
          className="cd-col"
          style={{
            borderRadius: "0 0 12px 12px",
            overflowY: "auto",
            scrollbarWidth: "none",
            background: "#0B1022",
            paddingBottom: 176,
          }}
        >
          <BriefBuilder
            brief={brief}
            onChange={handleBriefChange}
            onImproveBrief={handleImproveBrief}
            isLoading={isGeneratingConcepts}
          />
        </div>

        {/* Center: ConceptBoard */}
        <div
          className="cd-col"
          style={{
            borderRadius: "0 0 12px 12px",
            overflowY: "auto",
            scrollbarWidth: "none",
            background: "#070B1D",
            paddingBottom: 176,
          }}
        >
          <ConceptBoard
            state={conceptBoardState}
            concepts={concepts}
            selectedConceptId={selectedConceptId}
            onSelectConcept={handleSelectConcept}
            onGenerateConcept={handleGenerateConcept}
            onExpandConcept={handleExpandConcept}
            hasGenerations={generations.length > 0}
          />
        </div>

        {/* Right: OutputWorkspace */}
        <div
          className="cd-col"
          style={{
            borderRadius: "0 0 12px 12px",
            overflowY: "auto",
            scrollbarWidth: "none",
            background: "#0B1022",
            paddingBottom: 176,
          }}
        >
          <OutputWorkspace
            generations={generations}
            activeVariationTray={activeVariationTray}
            onAction={handleOutputAction}
            hasConceptsGenerated={conceptBoardState === "results" || conceptBoardState === "detail"}
            hasConceptSelected={!!selectedConceptId}
            selectedConceptTitle={concepts.find((c) => c.id === selectedConceptId)?.title}
            selectedConceptIndex={concepts.findIndex((c) => c.id === selectedConceptId) >= 0
              ? concepts.findIndex((c) => c.id === selectedConceptId)
              : 0}
            onVariation={handleVariation}
            onAdaptFormat={handleAdaptFormat}
          />
        </div>
      </div>

      {/* ── Toast notifications ── */}
      <ToastBar toasts={toasts} />

      {/* ── Render Dock — floating bottom command bar ── */}
      <CreativeRenderDock
        selectedConceptId={selectedConceptId}
        conceptRecommendedProvider={
          concepts.find((c) => c.id === selectedConceptId)?.recommendedProvider ?? null
        }
        projectType={brief.projectType}
        isGenerating={isGeneratingOutputs}
        isVariationMode={false}
        conceptsExist={concepts.length > 0}
        isGeneratingConcepts={isGeneratingConcepts}
        onGenerateConcepts={handleGenerateConcepts}
        onGenerate={(settings) => {
          if (selectedConceptId) {
            handleGenerateConcept(selectedConceptId, settings);
          }
        }}
      />
    </div>
  );
}
