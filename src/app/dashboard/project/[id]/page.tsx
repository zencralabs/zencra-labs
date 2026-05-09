"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ImageIcon, Clock, ChevronRight, Layers,
  Zap, CheckCircle, Circle, Star, Pencil, Check, X, Wand2, Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  visibility: "private" | "public";
  asset_count: number | null;
  created_at: string;
  updated_at: string;
}

interface ProjectSession {
  id: string;
  project_id: string;
  name: string | null;
  type: string;
  status: string;
  selected_concept_id: string | null;
  brief_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Asset {
  id: string;
  studio: string;
  provider: string;
  model_key: string;
  status: string;
  url: string | null;
  prompt: string | null;
  aspect_ratio: string | null;
  credits_cost: number | null;
  is_favorite: boolean;
  visibility: string;
  session_id: string | null;
  concept_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Concept {
  id: string;
  title: string;
  summary: string;
  rationale: string | null;
  recommended_provider: string | null;
  recommended_use_case: string | null;
  is_selected: boolean;
  session_id: string | null;
  created_at: string;
}

interface OverviewData {
  project: Project;
  sessions: ProjectSession[];
  assets: Asset[];
  concepts: Concept[];
  stats: {
    total_sessions: number;
    total_assets: number;
    total_concepts: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  draft:               "#64748B",
  concepts_generated:  "#2563EB",
  rendering:           "#F59E0B",
  completed:           "#10B981",
};

const STATUS_LABELS: Record<string, string> = {
  draft:               "Draft",
  concepts_generated:  "Concepts Ready",
  rendering:           "Rendering",
  completed:           "Completed",
};

// ─────────────────────────────────────────────────────────────────────────────
// Editable project title
// ─────────────────────────────────────────────────────────────────────────────

function EditableTitle({ value, onSave }: { value: string; onSave: (next: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setEditing(false); setDraft(value); return; }
    setSaving(true);
    try { await onSave(trimmed); } finally { setSaving(false); setEditing(false); }
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void commit(); if (e.key === "Escape") cancel(); }}
          maxLength={80}
          style={{
            fontSize: 22, fontWeight: 800, color: "var(--page-text)",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(37,99,235,0.5)",
            borderRadius: 8, padding: "4px 10px", outline: "none", width: "320px",
          }}
        />
        <button onClick={() => void commit()} disabled={saving} style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#60A5FA" }}>
          <Check size={13} />
        </button>
        <button onClick={cancel} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#64748B" }}>
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} title="Click to rename"
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>{value}</h1>
      <Pencil size={13} style={{ color: "#475569", opacity: 0.7, flexShrink: 0 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset thumbnail
// ─────────────────────────────────────────────────────────────────────────────

function AssetThumb({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${hovered ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.08)"}`,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      {asset.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url}
          alt={asset.prompt ?? "Generated output"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ImageIcon size={22} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      )}

      {/* Favorite badge */}
      {asset.is_favorite && (
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <Star size={13} fill="#F59E0B" style={{ color: "#F59E0B" }} />
        </div>
      )}

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "flex-end", padding: 8,
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {asset.prompt ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session row
// ─────────────────────────────────────────────────────────────────────────────

function SessionRow({ session, conceptCount, assetCount }: {
  session: ProjectSession;
  conceptCount: number;
  assetCount: number;
}) {
  const color = STATUS_COLORS[session.status] ?? "#64748B";
  const label = STATUS_LABELS[session.status] ?? session.status;
  const briefName = (session.brief_json as { projectName?: string })?.projectName ?? session.name ?? "Unnamed session";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      {/* Status icon */}
      <div style={{ flexShrink: 0 }}>
        {session.status === "completed"
          ? <CheckCircle size={16} style={{ color: "#10B981" }} />
          : <Circle size={16} style={{ color }} />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {briefName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 5, padding: "1px 7px" }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>{conceptCount} concept{conceptCount !== 1 ? "s" : ""}</span>
          <span style={{ fontSize: 11, color: "#475569" }}>{assetCount} output{assetCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Time */}
      <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <Clock size={10} />
        {timeAgo(session.updated_at)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state for outputs
// ─────────────────────────────────────────────────────────────────────────────

function EmptyOutputs({ projectId, onOpen }: { projectId: string; onOpen: () => void }) {
  void projectId; // used via onOpen closure
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center",
      border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14,
      background: "rgba(255,255,255,0.01)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
        background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(14,165,160,0.1))",
        border: "1px solid rgba(37,99,235,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Sparkles size={28} style={{ color: "#2563EB" }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--page-text)", marginBottom: 8 }}>This project is empty</div>
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20, maxWidth: 300, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Open Creative Director to start building here — your generated outputs will be linked to this project automatically.
      </div>
      <button
        onClick={onOpen}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "10px 22px", borderRadius: 10,
          background: "linear-gradient(135deg, #2563EB, #1d4ed8)",
          border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Wand2 size={14} />
        Start creating inside this project
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept list row
// ─────────────────────────────────────────────────────────────────────────────

function ConceptRow({ concept }: { concept: Concept }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      {concept.is_selected
        ? <CheckCircle size={15} style={{ color: "#10B981", marginTop: 2, flexShrink: 0 }} />
        : <Circle size={15} style={{ color: "#334155", marginTop: 2, flexShrink: 0 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>
          {concept.title}
        </div>
        {concept.summary && (
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 3, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {concept.summary}
          </div>
        )}
        {concept.recommended_provider && (
          <span style={{ fontSize: 10, color: "#2563EB", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 5, padding: "1px 7px", marginTop: 6, display: "inline-block" }}>
            {concept.recommended_provider}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [data, setData]             = useState<OverviewData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");

  // Guard against unresolved route params (literal "[id]" in the URL)
  const isInvalidId = !projectId || projectId === "[id]" || !/^[0-9a-f-]{36}$/.test(projectId);

  const load = useCallback(async () => {
    if (isInvalidId) { setLoading(false); setError("Invalid project link — please go back and select a project."); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token ?? session?.access_token;
      if (!token) { setError("Not authenticated"); setLoading(false); return; }

      const res = await fetch(`/api/projects/${projectId}/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) { setError("Project not found"); setLoading(false); return; }
      if (!res.ok) throw new Error("Failed to load project");
      const json = (await res.json()) as { success: boolean; data: OverviewData };
      setData(json.data);
      setProjectName(json.data.project.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [session, projectId, isInvalidId]);

  useEffect(() => { void load(); }, [load]);

  const renameProject = async (name: string) => {
    const { data: { session: live } } = await supabase.auth.getSession();
    const token = live?.access_token ?? session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setProjectName(name);
      setData(prev => prev ? { ...prev, project: { ...prev.project, name } } : prev);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dashboard-content" style={{ maxWidth: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 80, height: 16, borderRadius: 6, background: "rgba(255,255,255,0.06)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ height: 120, borderRadius: 14, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ height: 200, borderRadius: 14, background: "rgba(255,255,255,0.04)" }} />
          </div>
          <div style={{ height: 300, borderRadius: 14, background: "rgba(255,255,255,0.04)" }} />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="dashboard-content" style={{ maxWidth: "none" }}>
        <button onClick={() => router.push("/dashboard/projects")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
        <div style={{ padding: "24px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 14 }}>
          {error ?? "Project not found"}
        </div>
      </div>
    );
  }

  const { project, sessions, assets, concepts, stats } = data;

  // Group: concept count and asset count per session
  const conceptsBySession = concepts.reduce<Record<string, number>>((acc, c) => {
    if (c.session_id) acc[c.session_id] = (acc[c.session_id] ?? 0) + 1;
    return acc;
  }, {});
  const assetsBySession = assets.reduce<Record<string, number>>((acc, a) => {
    if (a.session_id) acc[a.session_id] = (acc[a.session_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>
      {/* ── Back nav ── */}
      <button
        onClick={() => router.push("/dashboard/projects")}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, marginBottom: 20, padding: 0 }}
      >
        <ArrowLeft size={14} /> Back to Projects
      </button>

      {/* ── Project header ── */}
      <div style={{
        background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: "20px 24px", marginBottom: 24,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Visibility badge + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Creative Project</span>
            <span style={{
              fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
              color: project.visibility === "public" ? "#10B981" : "#64748B",
              background: project.visibility === "public" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${project.visibility === "public" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
            }}>
              {project.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>
          <EditableTitle value={projectName || project.name} onSave={renameProject} />
          {project.description && (
            <p style={{ fontSize: 13, color: "#64748B", margin: "6px 0 0", lineHeight: 1.6, maxWidth: 580 }}>{project.description}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
            {[
              { icon: Layers,    value: stats.total_sessions,  label: "sessions",  color: "#2563EB" },
              { icon: ImageIcon, value: stats.total_assets,    label: "outputs",   color: "#0EA5A0" },
              { icon: Zap,       value: stats.total_concepts,  label: "concepts",  color: "#A855F7" },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
                <Icon size={13} style={{ color }} />
                <strong style={{ color: "var(--page-text)", fontWeight: 700 }}>{value}</strong> {label}
              </div>
            ))}
            <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} />
              Updated {timeAgo(project.updated_at)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => router.push(`/studio/image?mode=creative-director&project=${project.id}`)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "10px 18px", borderRadius: 10,
              background: "linear-gradient(135deg, #2563EB, #1d4ed8)",
              border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Wand2 size={13} />
            Continue in CD
          </button>
          <button
            onClick={() => router.push(`/studio/image?project=${project.id}`)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "10px 16px", borderRadius: 10,
              background: "rgba(14,165,160,0.12)", border: "1px solid rgba(14,165,160,0.25)",
              color: "#2DD4BF", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <ImageIcon size={13} />
            Image Studio
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* Left: Sessions + Outputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Sessions */}
          <div style={{
            background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Sessions</span>
              <span style={{ fontSize: 11, color: "#475569" }}>{sessions.length} total</span>
            </div>
            {sessions.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "#475569", fontSize: 13 }}>
                No sessions yet. Generate concepts to create one.
              </div>
            ) : (
              sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  conceptCount={conceptsBySession[s.id] ?? 0}
                  assetCount={assetsBySession[s.id] ?? 0}
                />
              ))
            )}
          </div>

          {/* Outputs grid */}
          <div style={{
            background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Outputs</span>
              {assets.length > 0 && (
                <button
                  onClick={() => router.push(`/dashboard/generated?project_id=${project.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  View all <ChevronRight size={12} />
                </button>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {assets.length === 0 ? (
                <EmptyOutputs
                  projectId={project.id}
                  onOpen={() => router.push(`/studio/image?mode=creative-director&project=${project.id}`)}
                />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {assets.map((a) => (
                    <AssetThumb key={a.id} asset={a} onClick={() => a.url && setLightboxUrl(a.url)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Concepts */}
        <div style={{
          background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden",
          position: "sticky", top: 80,
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Concepts</span>
            <span style={{ fontSize: 11, color: "#475569" }}>{concepts.length} generated</span>
          </div>
          {concepts.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              Concepts appear here once you generate them in the Creative Director.
            </div>
          ) : (
            <div>
              {concepts.map((c) => <ConceptRow key={c.id} concept={c} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Output preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
