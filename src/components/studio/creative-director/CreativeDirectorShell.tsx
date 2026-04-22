"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthContext";
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

// ── Toast component ────────────────────────────────────────────────────────────
function ToastBar({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: "8px 16px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background:
              toast.type === "error"
                ? "rgba(220,38,38,0.9)"
                : toast.type === "warning"
                ? "rgba(217,119,6,0.9)"
                : "rgba(37,99,235,0.9)",
            border:
              toast.type === "error"
                ? "1px solid rgba(248,113,113,0.4)"
                : toast.type === "warning"
                ? "1px solid rgba(251,191,36,0.4)"
                : "1px solid rgba(96,165,250,0.4)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
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
  const [creditsEstimate, setCreditsEstimate] = useState<number | null>(0.5);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [isGeneratingOutputs, setIsGeneratingOutputs] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const authHeader = useCallback((): HeadersInit => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session]);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "error") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
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
    if (!session) {
      addToast("Sign in to generate concepts.", "warning");
      return;
    }
    if (isGeneratingConcepts) return;

    setIsGeneratingConcepts(true);
    setConceptBoardState("loading");

    try {
      let currentProjectId = projectId;
      let currentBriefId = briefId;

      // 1. Create project if none
      if (!currentProjectId) {
        const projRes = await fetch("/api/creative-director/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
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
          projectId: string;
          briefId: string;
        };
        currentProjectId = projData.projectId;
        currentBriefId = projData.briefId;
        setProjectId(currentProjectId);
        setBriefId(currentBriefId);
      }

      // 2. Update brief
      const briefRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/brief`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify(brief),
        }
      );
      if (!briefRes.ok) {
        const err = await briefRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save brief");
      }
      if (!currentBriefId) {
        const briefData = (await briefRes.json()) as { briefId?: string };
        if (briefData.briefId) {
          currentBriefId = briefData.briefId;
          setBriefId(currentBriefId);
        }
      }

      // 3. Generate concepts
      const conceptsRes = await fetch(
        `/api/creative-director/projects/${currentProjectId}/concepts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
        }
      );
      if (!conceptsRes.ok) {
        const err = await conceptsRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate concepts");
      }

      const conceptsData = (await conceptsRes.json()) as { concepts: ConceptCard[] };
      setConcepts(conceptsData.concepts ?? []);
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
    session,
    isGeneratingConcepts,
    projectId,
    briefId,
    projectName,
    brief,
    authHeader,
    addToast,
    concepts.length,
  ]);

  // ── Improve brief ─────────────────────────────────────────────────────────────
  const handleImproveBrief = useCallback(async () => {
    if (!session) {
      addToast("Sign in to use Improve Brief.", "warning");
      return;
    }
    try {
      const res = await fetch("/api/creative-director/improve-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify(brief),
      });
      if (!res.ok) throw new Error("Improve brief failed");
      const data = (await res.json()) as { brief?: Partial<BriefState> };
      if (data.brief) {
        setBrief((prev) => ({ ...prev, ...data.brief }));
        addToast("Brief improved.", "info");
      }
    } catch {
      addToast("Could not improve brief. Try again.", "error");
    }
  }, [session, brief, authHeader, addToast]);

  // ── Poll generation status ────────────────────────────────────────────────────
  const pollGeneration = useCallback(
    async (genId: string) => {
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
          const res = await fetch(`/api/studio/jobs/${genId}/status`, {
            headers: authHeader(),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            status: GenerationResult["status"];
            url?: string;
          };
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === genId
                  ? { ...g, status: data.status, url: data.url ?? g.url }
                  : g
              )
            );
          }
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
      if (!session) {
        addToast("Sign in to generate outputs.", "warning");
        return;
      }
      if (isGeneratingOutputs) return;

      setIsGeneratingOutputs(true);

      try {
        // 1. Select concept
        await fetch(`/api/creative-director/concepts/${conceptId}/select`, {
          method: "POST",
          headers: authHeader(),
        });

        // 2. Generate outputs — use dock settings if provided, else brief fallback
        const count = dockSettings?.outputCount ?? brief.outputCount ?? 1;
        const res = await fetch(
          `/api/creative-director/concepts/${conceptId}/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader(),
            },
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

        const data = (await res.json()) as { generations: GenerationResult[] };
        const newGens = data.generations ?? [];
        setGenerations((prev) => [...newGens, ...prev]);

        // 3. Poll each
        newGens.forEach((g) => {
          if (g.status === "queued" || g.status === "processing") {
            pollGeneration(g.id);
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
    [session, isGeneratingOutputs, brief.outputCount, authHeader, addToast, pollGeneration]
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
            const res = await fetch(
              `/api/creative-director/generations/${generationId}/regenerate`,
              {
                method: "POST",
                headers: authHeader(),
              }
            );
            if (!res.ok) throw new Error("Regenerate failed");
            const data = (await res.json()) as { generationId?: string };
            const newId = data.generationId ?? generationId;
            if (newId !== generationId) {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === generationId
                    ? { ...g, id: newId, status: "processing" }
                    : g
                )
              );
              pollGeneration(newId);
            } else {
              pollGeneration(generationId);
            }
          } catch {
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === generationId ? { ...g, status: "failed" } : g
              )
            );
            addToast("Regenerate failed. Try again.", "error");
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
          addToast("Saved to your library.", "info");
          break;
        }
        default:
          break;
      }
    },
    [generations, authHeader, addToast, pollGeneration]
  );

  // ── Variation flow ──────────────────────────────────────────────────────────────
  const handleVariation = useCallback(
    async (variationType: string, generationId: string) => {
      if (!session) return;
      setActiveVariationTray(null);
      try {
        const res = await fetch(
          `/api/creative-director/generations/${generationId}/variation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader(),
            },
            body: JSON.stringify({ variationType }),
          }
        );
        if (!res.ok) throw new Error("Variation failed");
        const data = (await res.json()) as { generation: GenerationResult };
        const newGen = data.generation;
        setGenerations((prev) => [newGen, ...prev]);
        if (newGen.status === "queued" || newGen.status === "processing") {
          pollGeneration(newGen.id);
        }
      } catch {
        addToast("Could not create variation. Try again.", "error");
      }
    },
    [session, authHeader, addToast, pollGeneration]
  );

  // ── Format adaptation flow ──────────────────────────────────────────────────────
  const handleAdaptFormat = useCallback(
    async (format: string, generationId: string) => {
      if (!session) return;
      try {
        const res = await fetch(
          `/api/creative-director/generations/${generationId}/adapt-format`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader(),
            },
            body: JSON.stringify({ format }),
          }
        );
        if (!res.ok) throw new Error("Adapt format failed");
        const data = (await res.json()) as { generation: GenerationResult };
        const newGen = data.generation;
        setGenerations((prev) => [newGen, ...prev]);
        if (newGen.status === "queued" || newGen.status === "processing") {
          pollGeneration(newGen.id);
        }
      } catch {
        addToast("Format adaptation failed. Try again.", "error");
      }
    },
    [session, authHeader, addToast, pollGeneration]
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
