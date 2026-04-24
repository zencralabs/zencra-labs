"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import Tooltip from "@/components/ui/Tooltip";
import BriefBuilder, { type BriefState } from "./BriefBuilder";
import { CharacterPanel } from "./CharacterPanel";
import ConceptBoard, { type ConceptCard } from "./ConceptBoard";
import OutputWorkspace, {
  type GenerationResult,
  type OutputAction,
} from "./OutputWorkspace";
import CreativeRenderDock, { type RenderDockSettings } from "./CreativeRenderDock";
import OutputPreviewModal from "./OutputPreviewModal";
import WorkflowTransitionModal, { type WorkflowFlow, type WorkflowTransitionAsset } from "@/components/studio/workflow/WorkflowTransitionModal";

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
  concept_payload?: Record<string, unknown> | null;
}

function mapConceptRowToCard(row: ConceptRow): ConceptCard {
  const scores   = (row.scores ?? {}) as Record<string, number>;
  const payload  = (row.concept_payload ?? {}) as Record<string, unknown>;

  // Extract cinematic 2.0 fields from concept_payload (if the LLM included them)
  // Fall back gracefully: derive angles from rationale if payload doesn't have them
  const payloadAngles = Array.isArray(payload.executionAngles)
    ? (payload.executionAngles as string[])
    : null;
  const derivedAngles = row.rationale
    ? row.rationale
        .split(/[.!?]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12)
        .slice(0, 3)
    : [];
  const executionAngles = payloadAngles ?? (derivedAngles.length > 0 ? derivedAngles : undefined);

  const narrativeStory = (payload.narrativeStory as string | undefined)
    ?? row.rationale
    ?? undefined;

  const bestFor = (payload.bestFor as string | undefined)
    ?? row.recommended_use_case
    ?? undefined;

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
    narrativeStory,
    executionAngles,
    bestFor,
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
        bottom: 200,           // sits above the dock (dock height ~156px + 24px offset = 180px)
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
  const router       = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [brief, setBrief] = useState<BriefState>(DEFAULT_BRIEF);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  /** Unified project_sessions.id — links this CD run to the projects/assets system */
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  // ── Character / Soul ID state ─────────────────────────────────────────────────
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // ── Left panel tab ─────────────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState<"brief" | "characters">("brief");

  // ── Output Preview Modal ──────────────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  /** IDs of the most recent render batch — used to track the modal's generation */
  const [previewBatchIds, setPreviewBatchIds] = useState<string[]>([]);
  /** ID the user clicked to re-open the preview from the right panel */
  const [previewFocusId, setPreviewFocusId] = useState<string | null>(null);

  // ── Workflow transition modal ─────────────────────────────────────────────────
  const [workflowModal, setWorkflowModal] = useState<{
    open: boolean;
    defaultFlow: WorkflowFlow;
    asset: WorkflowTransitionAsset | null;
  }>({ open: false, defaultFlow: "animate", asset: null });

  // ── Render cancel support ─────────────────────────────────────────────────────
  const renderControllerRef = useRef<AbortController | null>(null);

  const handleCancelRender = useCallback(() => {
    renderControllerRef.current?.abort();
    renderControllerRef.current = null;
    setIsGeneratingOutputs(false);
    // Don't close the modal — let user see the failed state
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Sync authHeader — used only in the poll loop (fire-and-forget, session stale is tolerable)
  const authHeader = useCallback((): HeadersInit => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session]);

  // Async getAuthHeaders — used in all user-initiated action handlers.
  // 1. Try live session from Supabase's in-memory state.
  // 2. If no token found (stale or not yet hydrated), force a refreshSession() call.
  // 3. Falls back to React session state as last resort.
  const getAuthHeaders = useCallback(
    async (): Promise<HeadersInit> => {
      try {
        const { data: { session: live } } = await supabase.auth.getSession();
        let token: string | undefined = live?.access_token ?? session?.access_token;

        // If still no token, force a network refresh — handles stale/expired tokens
        if (!token) {
          console.warn("[CD] getAuthHeaders: no token from getSession, attempting refreshSession");
          const { data: { session: refreshed } } = await supabase.auth.refreshSession();
          token = refreshed?.access_token;
        }

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

  // ── Session persistence — localStorage ───────────────────────────────────────
  // Load saved session on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("zencra-cd-session");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        projectId?: string;
        briefId?: string;
        sessionId?: string | null;
        projectName?: string;
        brief?: Partial<BriefState>;
        concepts?: ConceptCard[];
        generations?: GenerationResult[];
        selectedConceptId?: string | null;
        conceptBoardState?: "empty" | "loading" | "results" | "detail";
      };
      if (!saved.projectId) return;
      setProjectId(saved.projectId);
      if (saved.briefId) setBriefId(saved.briefId);
      if (saved.sessionId) setSessionId(saved.sessionId);
      if (saved.projectName) setProjectName(saved.projectName);
      if (saved.brief) setBrief((prev) => ({ ...prev, ...saved.brief }));
      if (saved.concepts?.length) {
        setConcepts(saved.concepts);
        setConceptBoardState(saved.conceptBoardState ?? "results");
      }
      if (saved.generations?.length) setGenerations(saved.generations);
      if (saved.selectedConceptId) setSelectedConceptId(saved.selectedConceptId);
    } catch {
      // corrupt localStorage — ignore silently
    }
  }, []); // only on mount

  // Save session whenever key state changes
  useEffect(() => {
    if (!projectId) return; // nothing to save yet
    try {
      const toSave = {
        projectId, briefId, sessionId, projectName, brief,
        concepts, generations,
        selectedConceptId, conceptBoardState,
      };
      localStorage.setItem("zencra-cd-session", JSON.stringify(toSave));
    } catch {
      // localStorage full or unavailable — ignore
    }
  }, [projectId, briefId, sessionId, projectName, brief, concepts, generations, selectedConceptId, conceptBoardState]);

  // Brief change handler — marks unsaved
  const handleBriefChange = useCallback((updates: Partial<BriefState>) => {
    setBrief((prev) => ({ ...prev, ...updates }));
    setAutosaveState("unsaved");
  }, []);

  // ── Generate concepts flow ────────────────────────────────────────────────────
  const handleGenerateConcepts = useCallback(async () => {
    if (isGeneratingConcepts) return;

    console.log("[CD] handleGenerateConcepts: triggered");

    // Show loading state IMMEDIATELY so the button visually responds on click.
    // If auth then fails, we reset these below before returning.
    setIsGeneratingConcepts(true);
    setConceptBoardState("loading");

    // Get a live token once — used for all three requests in this flow.
    // getAuthHeaders() reads from supabase's in-memory state which handles
    // auto-refresh, so this is safe even if the React session state is stale.
    // Pre-flight validation — surface field errors before hitting the API
    if (!brief.projectType || brief.projectType.trim() === "") {
      setIsGeneratingConcepts(false);
      setConceptBoardState(concepts.length > 0 ? "results" : "empty");
      addToast("Please select a Project Type before generating concepts.", "warning");
      return;
    }

    // ── Set up abort controller BEFORE auth so the 2-min timeout ALWAYS fires.
    // Critical: getAuthHeaders() can internally call supabase.auth.refreshSession()
    // which may hang on a slow network — without an outer guard the button stays
    // locked forever. By creating the controller first, flowTimeout is guaranteed
    // to fire regardless of whether auth completes.
    const flowController = new AbortController();
    const flowTimeout = setTimeout(() => {
      flowController.abort();
    }, 120_000);

    // 8-second toast — surface a "still working" message so the UI never
    // looks frozen during the AI inference phase.
    const slowTimer = setTimeout(() => {
      addToast("Still working… AI is thinking through your concepts.", "info");
    }, 8000);

    // Resolve auth with a 15-second cap so a hung Supabase refreshSession()
    // never freezes the button permanently.
    let authH: HeadersInit;
    try {
      authH = await Promise.race([
        getAuthHeaders(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("auth-timeout")), 15_000)
        ),
      ]);
    } catch (authErr) {
      clearTimeout(slowTimer);
      clearTimeout(flowTimeout);
      setIsGeneratingConcepts(false);
      setConceptBoardState(concepts.length > 0 ? "results" : "empty");
      const isAuthTimeout = authErr instanceof Error && authErr.message === "auth-timeout";
      addToast(
        isAuthTimeout
          ? "Session check timed out — please refresh the page and try again."
          : "Session expired — please sign in and try again.",
        "error"
      );
      return;
    }
    console.log("[CD] getAuthHeaders result:", "Authorization" in authH ? "✓ token present" : "✗ no token");

    if (!("Authorization" in authH)) {
      clearTimeout(slowTimer);
      clearTimeout(flowTimeout);
      setIsGeneratingConcepts(false);
      setConceptBoardState(concepts.length > 0 ? "results" : "empty");
      addToast("Session expired — please sign in and try again.", "error");
      return;
    }

    const jsonHeaders: HeadersInit = { "Content-Type": "application/json", ...authH };

    try {
      let currentProjectId = projectId;
      let currentBriefId = briefId;

      console.log("[CD] step 1: create/reuse project", { currentProjectId, currentBriefId });

      // 1. Create project if none
      if (!currentProjectId) {
        const projRes = await fetch("/api/creative-director/projects", {
          method: "POST",
          headers: jsonHeaders,
          signal: flowController.signal,
          body: JSON.stringify({
            title: projectName || brief.projectName || "Untitled Project",
            projectType: brief.projectType,
          }),
        });

        console.log("[CD] project create response:", projRes.status);

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
        console.log("[CD] project created:", currentProjectId);
      }

      // 1b. Atomically create project + session via /api/projects/ensure-session.
      // A single round-trip guarantees both records exist together — no orphaned projects.
      // Non-fatal: if this call fails we log a warning and continue — CD still works.
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        try {
          const ensureRes = await fetch("/api/projects/ensure-session", {
            method: "POST",
            headers: jsonHeaders,
            signal: flowController.signal,
            body: JSON.stringify({
              name:        projectName || brief.projectName || "Untitled Project",
              description: brief.goal || "",
              sessionType: "creative-director",
              sessionName: projectName || brief.projectName || "Session 1",
            }),
          });
          if (ensureRes.ok) {
            const ensureData = (await ensureRes.json()) as {
              success: boolean;
              project?: { id: string };
              session?: { id: string };
            };
            if (ensureData.success && ensureData.project?.id && ensureData.session?.id) {
              currentSessionId = ensureData.session.id;
              setSessionId(currentSessionId);
              console.log("[CD] project+session created:", ensureData.project.id, currentSessionId);
            }
          } else {
            console.warn("[CD] non-fatal: ensure-session returned", ensureRes.status);
          }
        } catch (sessionErr) {
          console.warn("[CD] non-fatal: failed to create project+session —", sessionErr);
        }
      }

      console.log("[CD] step 2: save brief", { currentProjectId });

      // 2. Update brief
      const briefRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/brief`,
        {
          method: "POST",
          headers: jsonHeaders,
          signal: flowController.signal,
          body: JSON.stringify(serializeBriefForApi(brief)),
        }
      );

      console.log("[CD] brief save response:", briefRes.status);

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

      console.log("[CD] step 3: generate concepts", { currentProjectId });

      // 3. Generate concepts (two sequential OpenAI calls — can take 30–90s)
      const conceptsRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/concepts`,
        {
          method: "POST",
          headers: jsonHeaders,
          signal: flowController.signal,
        }
      );

      console.log("[CD] concepts response:", conceptsRes.status);

      if (!conceptsRes.ok) {
        const err = await conceptsRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate concepts");
      }

      const conceptsData = (await conceptsRes.json()) as { concepts: ConceptRow[]; estimatedGenerationCredits?: number };
      console.log("[CD] concepts received:", conceptsData.concepts?.length ?? 0);
      setConcepts((conceptsData.concepts ?? []).map(mapConceptRowToCard));
      if (conceptsData.estimatedGenerationCredits != null) {
        setCreditsEstimate(conceptsData.estimatedGenerationCredits);
      }
      setConceptBoardState("results");
      setAutosaveState("saved");

      // 4. Stamp session_id on the generated concepts + advance session status.
      // Fire-and-forget: non-blocking, non-fatal — does not affect CD UX.
      if (currentSessionId) {
        const conceptIds = (conceptsData.concepts ?? []).map((c) => c.id).filter(Boolean);
        if (conceptIds.length > 0) {
          fetch(`/api/sessions/${currentSessionId}/concepts`, {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({ concept_ids: conceptIds }),
          }).catch((e) => console.warn("[CD] non-fatal: concept session stamp failed —", e));
        }
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      const message = isAbort
        ? "Concept generation timed out — please try again."
        : err instanceof Error
          ? err.message
          : "Something went wrong generating concepts.";
      console.error("[CD] handleGenerateConcepts failed:", isAbort ? "timeout (2 min)" : message);
      addToast(message, "error");
      setConceptBoardState(concepts.length > 0 ? "results" : "empty");
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(flowTimeout);
      setIsGeneratingConcepts(false);
    }
  }, [
    isGeneratingConcepts,
    projectId,
    briefId,
    sessionId,
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
      console.log("[CD] handleGenerateConcept: triggered", { conceptId, dockSettings });
      if (isGeneratingOutputs) {
        console.log("[CD] handleGenerateConcept: already generating — bailed");
        return;
      }

      // ── Open preview modal IMMEDIATELY — before any async work ───────────────
      // This is the key UX upgrade: user gets instant visual feedback on click.
      setPreviewBatchIds([]);    // clear prior batch
      setPreviewFocusId(null);
      setPreviewOpen(true);
      setIsGeneratingOutputs(true);
      console.log("[CD] render: loading state set + preview modal open");

      // 90-second hard abort for the entire render flow
      const renderController = new AbortController();
      renderControllerRef.current = renderController;
      const renderTimeout = setTimeout(() => {
        renderController.abort();
      }, 90_000);

      // Resolve concept metadata for enriching generation records
      const selectedConceptObj = concepts.find((c) => c.id === conceptId);
      const selectedConceptIdx = concepts.findIndex((c) => c.id === conceptId);

      try {
        const authH = await getAuthHeaders();
        console.log("[CD] render: auth result", Object.keys(authH));
        if (!("Authorization" in authH)) {
          addToast("Session expired — please refresh the page and try again.", "warning");
          return;
        }

        // 1. Select concept
        console.log("[CD] render: selecting concept", conceptId);
        await fetch(`/api/creative-director/concepts/${conceptId}/select`, {
          method: "POST",
          headers: authH,
          signal: renderController.signal,
        });

        // 2. Generate outputs — use dock settings if provided, else brief fallback
        const count = dockSettings?.outputCount ?? brief.outputCount ?? 1;

        // ── Model routing: derive providerOverride from dock model key ───────
        // The render route expects { modelOverride, providerOverride }.
        // The dock sends { model } (e.g. "nano-banana-pro", "gpt-image-1").
        // We must map model → provider so the provider-router honours the selection.
        const modelKey = dockSettings?.model;
        const modelOverride = modelKey ?? undefined;
        const providerOverride = modelKey
          ? ((): string => {
              if (modelKey === "gpt-image-1")                                                    return "openai";
              if (modelKey === "nano-banana-pro" || modelKey === "nano-banana-2" || modelKey === "nano-banana-standard") return "nano-banana";
              if (modelKey.startsWith("seedream"))                                            return "seedream";
              if (modelKey.startsWith("flux"))                                                return "flux";
              return "openai";
            })()
          : undefined;

        console.log("[CD] render: starting generation", { count, modelOverride, providerOverride });
        const res = await fetch(
          `/api/creative-director/concepts/${conceptId}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authH },
            body: JSON.stringify({
              count,
              modelOverride,     // renamed from "model" — matches validateGenerateRender schema
              providerOverride,  // derived from model key so provider-router honours selection
              aspectRatio:  dockSettings?.aspectRatio,
              promptText:   dockSettings?.promptText,
              referenceImages: dockSettings?.referenceImages,
              session_id:   sessionId ?? undefined,   // propagate to creative_generations row
            }),
            signal: renderController.signal,
          }
        );

        console.log("[CD] render: response status", res.status);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Failed to start generation");
        }

        const data = (await res.json()) as { generations: Record<string, unknown>[] };
        console.log("[CD] render: generations received", data.generations?.length ?? 0);

        // Enrich each generation with concept metadata for grouping in the stream
        const newGens = (data.generations ?? []).map((row) => ({
          ...mapGenerationRow(row),
          conceptId:    conceptId,
          conceptTitle: selectedConceptObj?.title,
          conceptIndex: selectedConceptIdx >= 0 ? selectedConceptIdx : 0,
        }));

        setGenerations((prev) => [...newGens, ...prev]);

        // Track this batch so the preview modal can show the first generation
        const batchIds = newGens.map((g) => g.id);
        setPreviewBatchIds(batchIds);
        console.log("[CD] render: state updated — outputs appended, batch tracked", batchIds.length);

        // 3. Poll each async generation (sync providers already have status=completed + url)
        newGens.forEach((g) => {
          if ((g.status === "queued" || g.status === "processing") && g.assetId) {
            pollGeneration(g.id, g.assetId);
          }
        });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const message = isAbort
          ? "Render timed out (90s) — please try again."
          : err instanceof Error ? err.message : "Generation failed. Please try again.";
        console.error("[CD] handleGenerateConcept failed:", isAbort ? "timeout (90s)" : message);
        addToast(message, "error");
        // Don't auto-close modal on failure — let user see the failed state and dismiss
      } finally {
        clearTimeout(renderTimeout);
        renderControllerRef.current = null;
        setIsGeneratingOutputs(false);
        console.log("[CD] render: finally — loading cleared");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGeneratingOutputs, brief.outputCount, concepts, sessionId, getAuthHeaders, addToast, pollGeneration]
  );

  // ── Select / expand concept ────────────────────────────────────────────────────
  const handleSelectConcept = useCallback(
    async (id: string) => {
      if (selectedConceptId === id && conceptBoardState === "detail") {
        // Already in detail — go back to results
        setConceptBoardState("results");
      } else {
        setSelectedConceptId(id);
        // Stamp selected_concept_id on the session (non-blocking, non-fatal)
        if (sessionId) {
          getAuthHeaders()
            .then((authH) =>
              fetch(`/api/sessions/${sessionId}/select`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authH },
                body: JSON.stringify({ concept_id: id }),
              })
            )
            .catch((e) => console.warn("[CD] non-fatal: session concept select failed —", e));
        }
      }
    },
    [selectedConceptId, conceptBoardState, sessionId, getAuthHeaders]
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
        case "video_animate":
        case "video_start_frame":
        case "video_end_frame": {
          // ── Workflow: open transition modal to send CD output to Video Studio ──
          const gen = generations.find((g) => g.id === generationId);
          if (!gen?.url) {
            addToast("Output is not yet ready to animate.", "error");
            return;
          }
          const flow: WorkflowFlow =
            action === "video_animate"     ? "animate"      :
            action === "video_start_frame" ? "start-frame"  : "end-frame";
          setWorkflowModal({
            open: true,
            defaultFlow: flow,
            asset: {
              url:       gen.url,
              assetId:   gen.assetId   || undefined,
              conceptId: gen.conceptId || undefined,
              projectId: projectId     || undefined,
              sessionId: sessionId     || undefined,
            },
          });
          break;
        }
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generations, getAuthHeaders, addToast, pollGeneration, projectId, sessionId, router]
  );

  // ── Retry with another model ──────────────────────────────────────────────────
  const handleRetryWithModel = useCallback(
    async (generationId: string, modelKey: string) => {
      // Find the failed generation to get its conceptId
      const gen = generations.find((g) => g.id === generationId);
      if (!gen?.conceptId) {
        addToast("Could not find concept for this generation.", "error");
        return;
      }
      const conceptId = gen.conceptId;
      const selectedConceptObj = concepts.find((c) => c.id === conceptId);
      const selectedConceptIdx = concepts.findIndex((c) => c.id === conceptId);

      const providerOverride = ((): string => {
        if (modelKey === "gpt-image-1")                               return "openai";
        if (modelKey === "nano-banana-pro" || modelKey === "nano-banana-2") return "nano-banana";
        if (modelKey.startsWith("seedream"))                          return "seedream";
        if (modelKey.startsWith("flux"))                              return "flux";
        return "openai";
      })();

      try {
        const authH = await getAuthHeaders();
        const res = await fetch(
          `/api/creative-director/concepts/${conceptId}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authH },
            body: JSON.stringify({
              count: 1,
              modelOverride: modelKey,
              providerOverride,
            }),
          }
        );
        if (!res.ok) throw new Error("Retry generation failed");
        const data = (await res.json()) as { generations: Record<string, unknown>[] };
        const newGens = (data.generations ?? []).map((row) => ({
          ...mapGenerationRow(row),
          conceptId,
          conceptTitle: selectedConceptObj?.title,
          conceptIndex: selectedConceptIdx >= 0 ? selectedConceptIdx : 0,
        }));
        setGenerations((prev) => [...newGens, ...prev]);
        newGens.forEach((g) => {
          if ((g.status === "queued" || g.status === "processing") && g.assetId) {
            pollGeneration(g.id, g.assetId);
          }
        });
        addToast(`Retrying with ${modelKey}…`, "info");
      } catch {
        addToast("Could not retry with that model. Please try again.", "error");
      }
    },
    [generations, concepts, getAuthHeaders, addToast, pollGeneration]
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
        .cd-col { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
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
              setPreviewOpen(false);
              setPreviewBatchIds([]);
              // Clear persisted session so we start fresh
              try { localStorage.removeItem("zencra-cd-session"); } catch { /* ignore */ }
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
        {/* Left: BriefBuilder + CharacterPanel (tabbed) */}
        <div
          className="cd-col"
          style={{
            borderRadius: "0 0 12px 12px",
            overflowY: "hidden",
            scrollbarWidth: "none",
            background: "#0B1022",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Tab strip */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: "10px 16px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            {(["brief", "characters"] as const).map((tab) => {
              const isActive = leftTab === tab;
              const label = tab === "brief" ? "Brief" : "Characters";
              const badge = tab === "characters" && selectedCharacterId ? "●" : null;
              return (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  style={{
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: "7px 7px 0 0",
                    border: "none",
                    background: isActive
                      ? "rgba(59,130,246,0.12)"
                      : "transparent",
                    color: isActive ? "#93c5fd" : "rgba(140,165,200,0.5)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    borderBottom: isActive ? "2px solid rgba(86,140,255,0.6)" : "2px solid transparent",
                    display: "flex", alignItems: "center", gap: 6,
                    letterSpacing: "0.01em",
                  }}
                >
                  {label}
                  {badge && (
                    <span style={{ fontSize: 8, color: "#6ee7b7", lineHeight: 1 }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content — scrollable */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              scrollbarWidth: "none",
              paddingBottom: 176,
              padding: leftTab === "brief" ? "0 0 176px" : "16px 16px 176px",
            }}
          >
            {leftTab === "brief" ? (
              <BriefBuilder
                brief={brief}
                onChange={handleBriefChange}
                onImproveBrief={handleImproveBrief}
                isLoading={isGeneratingConcepts}
                hasConceptsGenerated={concepts.length > 0}
              />
            ) : (
              <CharacterPanel
                getAuthHeaders={getAuthHeaders as () => Promise<Record<string, string>>}
                selectedCharacterId={selectedCharacterId}
                onSelectCharacter={setSelectedCharacterId}
              />
            )}
          </div>
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
            isGeneratingOutputs={isGeneratingOutputs}
            onOpenPreview={(genId) => {
              setPreviewFocusId(genId);
              setPreviewOpen(true);
            }}
            onRetryWithModel={(genId, model) => handleRetryWithModel(genId, model)}
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
        onCancel={handleCancelRender}
        onGenerate={(settings) => {
          if (selectedConceptId) {
            handleGenerateConcept(selectedConceptId, settings);
          }
        }}
      />

      {/* ── Output Preview Modal — instant-open on Render click ── */}
      {(() => {
        // Determine which generation to preview:
        // 1. If user clicked a specific card → show that generation
        // 2. Otherwise show first generation from the latest render batch
        const focusId = previewFocusId ?? previewBatchIds[0] ?? null;
        const previewGen = focusId ? (generations.find((g) => g.id === focusId) ?? null) : null;
        const previewConcept = previewGen?.conceptTitle
          ?? (selectedConceptId ? concepts.find((c) => c.id === selectedConceptId)?.title : undefined);

        return (
          <OutputPreviewModal
            isOpen={previewOpen}
            generation={previewGen}
            batchCount={previewBatchIds.length}
            conceptTitle={previewConcept}
            modelLabel={previewGen?.model}
            onClose={() => {
              setPreviewOpen(false);
              setPreviewFocusId(null);
            }}
            onDownload={(id) => handleOutputAction("download", id)}
            onVariation={(id) => {
              setPreviewOpen(false);
              setPreviewFocusId(null);
              setActiveVariationTray(id);
            }}
            onRetryWithModel={(model) => {
              const focusId = previewFocusId ?? previewBatchIds[0] ?? null;
              if (focusId) handleRetryWithModel(focusId, model);
              setPreviewOpen(false);
              setPreviewFocusId(null);
            }}
          />
        );
      })()}

      {/* ── Workflow Transition Modal ─────────────────────────────────────────── */}
      <WorkflowTransitionModal
        open={workflowModal.open}
        onClose={() => setWorkflowModal(s => ({ ...s, open: false }))}
        origin="creative-director"
        asset={workflowModal.asset}
        defaultFlow={workflowModal.defaultFlow}
      />
    </div>
  );
}
