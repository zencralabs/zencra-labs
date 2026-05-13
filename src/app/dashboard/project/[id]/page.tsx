"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft, ImageIcon, Clock, ChevronRight, Layers,
  Zap, CheckCircle, Circle, Star, Pencil, Check, X, Wand2, Sparkles,
  Film, Music, User2, Clapperboard,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { FullscreenPreview } from "@/components/ui/FullscreenPreview";

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
  scores: Record<string, number> | null;
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

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft:               { color: "#64748B", bg: "rgba(100,116,139,0.12)", label: "Draft"          },
  concepts_generated:  { color: "#2563EB", bg: "rgba(37,99,235,0.12)",  label: "Concepts Ready"  },
  rendering:           { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Rendering"       },
  completed:           { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Completed"       },
};

function studioIcon(studio: string, size = 13) {
  switch (studio) {
    case "image":     return <ImageIcon size={size} />;
    case "video":     return <Film size={size} />;
    case "audio":     return <Music size={size} />;
    case "character": return <User2 size={size} />;
    case "cd":        return <Clapperboard size={size} />;
    case "lipsync":   return <Music size={size} />;
    default:          return <Layers size={size} />;
  }
}

function isVideoAsset(asset: Asset): boolean {
  return asset.studio === "video" || asset.studio === "lipsync";
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable project title (unchanged)
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
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void commit(); if (e.key === "Escape") cancel(); }}
          maxLength={80}
          style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", fontFamily: "var(--font-display, 'Syne', sans-serif)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(37,99,235,0.5)", borderRadius: 8, padding: "4px 10px", outline: "none", width: "340px" }} />
        <button onClick={() => void commit()} disabled={saving}
          style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#60A5FA" }}>
          <Check size={13} />
        </button>
        <button onClick={cancel}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B" }}>
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} title="Click to rename"
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", margin: 0, fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>{value}</h1>
      <Pencil size={13} style={{ color: "#475569", opacity: 0.7, flexShrink: 0 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover mosaic — up to 4 asset thumbnails in a grid
// ─────────────────────────────────────────────────────────────────────────────

function CoverMosaic({ assets, coverUrl, projectName }: { assets: Asset[]; coverUrl: string | null; projectName: string }) {
  // Prefer images for the mosaic
  const imageAssets = assets.filter(a => a.url && a.studio === "image").slice(0, 4);
  const anyAssets   = assets.filter(a => a.url).slice(0, 4);
  const mosaicUrls  = imageAssets.length > 0 ? imageAssets.map(a => a.url!) : anyAssets.map(a => a.url!);

  if (coverUrl) {
    return (
      <div style={{ height: 180, background: `url(${coverUrl}) center/cover no-repeat`, borderRadius: "14px 14px 0 0", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)", borderRadius: "14px 14px 0 0" }} />
      </div>
    );
  }

  if (mosaicUrls.length === 0) {
    // No assets at all — gradient placeholder
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
    const hue  = Math.abs(hash) % 360;
    const hue2 = (hue + 40) % 360;
    return (
      <div style={{
        height: 120, borderRadius: "14px 14px 0 0", position: "relative",
        background: `linear-gradient(135deg, hsl(${hue},55%,12%) 0%, hsl(${hue2},60%,8%) 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Layers size={22} style={{ color: "rgba(255,255,255,0.35)" }} />
        </div>
      </div>
    );
  }

  if (mosaicUrls.length === 1) {
    return (
      <div style={{ height: 180, background: `url(${mosaicUrls[0]}) center/cover no-repeat`, borderRadius: "14px 14px 0 0", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)", borderRadius: "14px 14px 0 0" }} />
      </div>
    );
  }

  if (mosaicUrls.length === 2) {
    return (
      <div style={{ height: 160, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, borderRadius: "14px 14px 0 0", overflow: "hidden", position: "relative" }}>
        {mosaicUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
      </div>
    );
  }

  // 3 or 4 thumbnails — 2×2 grid
  return (
    <div style={{ height: 160, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2, borderRadius: "14px 14px 0 0", overflow: "hidden", position: "relative" }}>
      {mosaicUrls.slice(0, 4).map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session timeline card
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session, conceptCount, assetCount, projectId }: {
  session: ProjectSession;
  conceptCount: number;
  assetCount: number;
  projectId: string;
}) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.draft;
  const briefName = (session.brief_json as { projectName?: string })?.projectName ?? session.name ?? "Unnamed session";
  const router = useRouter();

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "14px 18px",
      display: "flex", alignItems: "center", gap: 14,
      transition: "border-color 0.15s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}>
      {/* Status indicator */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        {session.status === "completed"
          ? <CheckCircle size={18} style={{ color: "#10B981" }} />
          : <Circle size={18} style={{ color: cfg.color }} />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
          {briefName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 5, padding: "1px 8px" }}>
            {cfg.label}
          </span>
          {conceptCount > 0 && (
            <span style={{ fontSize: 11, color: "#475569" }}>{conceptCount} concept{conceptCount !== 1 ? "s" : ""}</span>
          )}
          {assetCount > 0 && (
            <span style={{ fontSize: 11, color: "#475569" }}>{assetCount} output{assetCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Time + Resume CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
          <Clock size={10} />{timeAgo(session.updated_at)}
        </span>
        <button
          onClick={() => router.push(`/studio/image?mode=creative-director&project=${projectId}`)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA",
          }}>
          <Wand2 size={10} /> Resume
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset thumbnail — uses FullscreenPreview on click
// ─────────────────────────────────────────────────────────────────────────────

function AssetThumb({ asset, onOpen }: { asset: Asset; onOpen: (a: Asset) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => asset.url && onOpen(asset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${hovered ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.08)"}`,
        cursor: asset.url ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
    >
      {asset.url ? (
        isVideoAsset(asset) ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.prompt ?? "Generated output"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
        )
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ImageIcon size={22} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      )}

      {/* Studio badge */}
      <div style={{
        position: "absolute", top: 6, left: 6,
        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 3,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {studioIcon(asset.studio, 9)}
        {asset.studio}
      </div>

      {/* Favorite badge */}
      {asset.is_favorite && (
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <Star size={13} fill="#F59E0B" style={{ color: "#F59E0B" }} />
        </div>
      )}

      {/* Hover overlay */}
      {hovered && asset.url && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", padding: 8 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {asset.prompt ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept row — with score visualization
// ─────────────────────────────────────────────────────────────────────────────

function ConceptRow({ concept }: { concept: Concept }) {
  const score = concept.scores ? Math.round(Object.values(concept.scores).reduce((s, v) => s + v, 0) / Math.max(1, Object.values(concept.scores).length)) : null;

  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: concept.is_selected ? "rgba(37,99,235,0.04)" : "transparent",
      borderLeft: concept.is_selected ? "2px solid rgba(37,99,235,0.5)" : "2px solid transparent",
      transition: "background 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {concept.is_selected
          ? <CheckCircle size={14} style={{ color: "#2563EB", marginTop: 2, flexShrink: 0 }} />
          : <Circle size={14} style={{ color: "#334155", marginTop: 2, flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)", flex: 1 }}>
              {concept.title}
            </div>
            {score !== null && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 5, padding: "1px 7px", flexShrink: 0 }}>
                {score}%
              </span>
            )}
          </div>
          {concept.summary && (
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {concept.summary}
            </div>
          )}
          {score !== null && (
            <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, score)}%`, borderRadius: 3, background: concept.is_selected ? "#2563EB" : "#475569", transition: "width 0.3s" }} />
            </div>
          )}
          {concept.recommended_provider && (
            <span style={{ fontSize: 10, color: "#2563EB", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 5, padding: "1px 7px", marginTop: 8, display: "inline-block" }}>
              {concept.recommended_provider}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty outputs state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyOutputs({ projectId }: { projectId: string }) {
  const router = useRouter();
  return (
    <div style={{ padding: "44px 24px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.01)" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px", background: "linear-gradient(135deg, rgba(37,99,235,0.14), rgba(14,165,160,0.09))", border: "1px solid rgba(37,99,235,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sparkles size={24} style={{ color: "#2563EB" }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--page-text)", marginBottom: 8 }}>No outputs yet</div>
      <div style={{ fontSize: 13, color: "#64748B", maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Open Creative Director to start generating — outputs are automatically linked to this project.
      </div>
      <button
        onClick={() => router.push(`/studio/image?mode=creative-director&project=${projectId}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9, background: "linear-gradient(135deg, #2563EB, #1d4ed8)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <Wand2 size={13} /> Start creating
      </button>
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

  const [data, setData]               = useState<OverviewData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [lightboxAsset, setLightboxAsset] = useState<Asset | null>(null);

  const isInvalidId = !projectId || projectId === "[id]" || !/^[0-9a-f-]{36}$/.test(projectId);

  const load = useCallback(async () => {
    if (isInvalidId) { setLoading(false); setError("Invalid project link — please go back and select a project."); return; }
    setLoading(true); setError(null);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token ?? session?.access_token;
      if (!token) { setError("Not authenticated"); setLoading(false); return; }
      const res = await fetch(`/api/projects/${projectId}/overview`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) { setError("Project not found"); setLoading(false); return; }
      if (!res.ok) throw new Error("Failed to load project");
      const json = (await res.json()) as { success: boolean; data: OverviewData };
      setData(json.data);
      setProjectName(json.data.project.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); }
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

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dashboard-content" style={{ maxWidth: "none" }}>
        <div style={{ height: 16, width: 160, borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ height: 220, borderRadius: 14, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 180, borderRadius: 14, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
          <div style={{ height: 320, borderRadius: 14, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="dashboard-content" style={{ maxWidth: "none" }}>
        <button onClick={() => router.push("/dashboard/projects")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, marginBottom: 24, padding: 0 }}>
          <ChevronLeft size={14} /> Back to Projects
        </button>
        <div style={{ padding: "24px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 14 }}>
          {error ?? "Project not found"}
        </div>
      </div>
    );
  }

  const { project, sessions, assets, concepts, stats } = data;

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

      {/* ── Breadcrumb ── */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 22 }}>
        <button onClick={() => router.push("/dashboard/projects")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "5px 11px", cursor: "pointer", color: "#64748B", fontSize: 12, fontWeight: 600 }}>
          <ChevronLeft size={13} /> Projects
        </button>
        <ChevronRight size={12} style={{ color: "#334155" }} />
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {projectName || project.name}
        </span>
      </nav>

      {/* ── Project header card ── */}
      <div style={{
        background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden", marginBottom: 24,
      }}>
        {/* Cover mosaic */}
        <CoverMosaic assets={assets} coverUrl={project.cover_url} projectName={project.name} />

        {/* Header body */}
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Label row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Creative Project</span>
              <span style={{
                fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px",
                color: project.visibility === "public" ? "#10B981" : "#64748B",
                background: project.visibility === "public" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${project.visibility === "public" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
              }}>
                {project.visibility === "public" ? "Public" : "Private"}
              </span>
            </div>

            <EditableTitle value={projectName || project.name} onSave={renameProject} />

            {project.description && (
              <p style={{ fontSize: 13, color: "#64748B", margin: "6px 0 0", lineHeight: 1.6, maxWidth: 540 }}>{project.description}</p>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
              {[
                { icon: Layers,    value: stats.total_sessions,  label: "sessions",  color: "#2563EB" },
                { icon: ImageIcon, value: stats.total_assets,    label: "outputs",   color: "#0EA5A0" },
                { icon: Zap,       value: stats.total_concepts,  label: "concepts",  color: "#A855F7" },
              ].map(({ icon: Icon, value, label, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
                  <Icon size={13} style={{ color }} />
                  <strong style={{ color: "var(--page-text)", fontWeight: 800 }}>{value}</strong> {label}
                </div>
              ))}
              <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} /> Updated {timeAgo(project.updated_at)}
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => router.push(`/studio/image?mode=creative-director&project=${project.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "linear-gradient(135deg, #2563EB, #1d4ed8)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Wand2 size={13} /> Continue in CD
            </button>
            <button
              onClick={() => router.push(`/studio/image?project=${project.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: "rgba(14,165,160,0.1)", border: "1px solid rgba(14,165,160,0.25)", color: "#2DD4BF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ImageIcon size={13} /> Image Studio
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* ── Left column: Sessions + Outputs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Sessions */}
          <div style={{ background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Sessions</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "1px 7px" }}>{sessions.length}</span>
              </div>
              <button
                onClick={() => router.push(`/studio/image?mode=creative-director&project=${project.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                <Wand2 size={11} /> New session
              </button>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
                  No sessions yet. Generate concepts in the Creative Director to create one.
                </div>
              ) : (
                sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    conceptCount={conceptsBySession[s.id] ?? 0}
                    assetCount={assetsBySession[s.id] ?? 0}
                    projectId={project.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* Outputs */}
          <div style={{ background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Outputs</span>
                {assets.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "1px 7px" }}>{assets.length}</span>
                )}
              </div>
              {assets.length > 0 && (
                <button
                  onClick={() => router.push(`/dashboard/generated?project_id=${project.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  View all <ChevronRight size={12} />
                </button>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {assets.length === 0 ? (
                <EmptyOutputs projectId={project.id} />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {assets.map((a) => (
                    <AssetThumb key={a.id} asset={a} onOpen={setLightboxAsset} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: Concepts ── */}
        <div style={{
          background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden",
          position: "sticky", top: 80,
        }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--page-text)" }}>Concepts</span>
              {concepts.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "1px 7px" }}>{concepts.length}</span>
              )}
            </div>
            {concepts.filter(c => c.is_selected).length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 5, padding: "1px 7px" }}>
                {concepts.filter(c => c.is_selected).length} selected
              </span>
            )}
          </div>
          {concepts.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
              Concepts appear here once you generate them in the Creative Director.
            </div>
          ) : (
            <div>
              {concepts.map((c) => <ConceptRow key={c.id} concept={c} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── FullscreenPreview lightbox ── */}
      {lightboxAsset?.url && (
        <FullscreenPreview
          type={isVideoAsset(lightboxAsset) ? "video" : "image"}
          url={lightboxAsset.url}
          metadata={{
            prompt:      lightboxAsset.prompt    ?? undefined,
            createdAt:   lightboxAsset.created_at ? new Date(lightboxAsset.created_at).getTime() : undefined,
            creditsUsed: lightboxAsset.credits_cost ?? undefined,
            visibility:  lightboxAsset.visibility,
            projectId:   project.id,
            projectName: project.name,
            sourceStudio: lightboxAsset.studio,
          }}
          onClose={() => setLightboxAsset(null)}
          zIndex={9800}
        />
      )}
    </div>
  );
}
