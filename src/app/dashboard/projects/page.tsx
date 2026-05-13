"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter }     from "next/navigation";
import {
  FolderOpen, Plus, ImageIcon, Clock, ArrowRight, Layers,
  Pencil, Trash2, Check, X, MoreHorizontal, Wand2, Star,
} from "lucide-react";
import { useAuth }  from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast, ToastStack } from "@/components/ui/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  cover_asset_id: string | null;
  visibility: "private" | "public";
  asset_count: number | null;
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  total_projects: number;
  total_outputs: number;
  total_favorites: number;
}

type SortKey = "updated" | "name" | "outputs";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function projectGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue  = Math.abs(hash) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue},55%,12%) 0%, hsl(${hue2},60%,8%) 100%)`;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create project modal (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function CreateProjectModal({
  onClose,
  onCreated,
  getToken,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
  getToken: () => Promise<string | null>;
}) {
  const [name, setName]     = useState("");
  const [desc, setDesc]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setErr("Project name is required"); return; }
    if (trimmed.length > 80) { setErr("Name must be under 80 characters"); return; }
    setSaving(true); setErr(null);
    try {
      const token = await getToken();
      if (!token) { setErr("Not authenticated"); return; }
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed, description: desc.trim() || null }),
      });
      const json = await res.json() as { success: boolean; data: Project; error?: string };
      if (!res.ok) { setErr(json.error ?? "Failed to create project"); return; }
      onCreated(json.data);
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--page-bg-2)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.09)", padding: "28px 32px", width: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--page-text)", marginBottom: 6 }}>New Project</div>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Create a project to organise your creative work.</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            Project name <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void submit(); if (e.key === "Escape") onClose(); }}
            maxLength={80} placeholder="e.g. Summer Campaign 2025"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--page-text)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            Description <span style={{ color: "#334155" }}>optional</span>
          </label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this project about?" rows={3} maxLength={300}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--page-text)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {err && <div style={{ fontSize: 12, color: "#FCA5A5", marginBottom: 16, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748B", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={() => void submit()} disabled={saving || !name.trim()}
            style={{ padding: "9px 22px", borderRadius: 9, background: saving || !name.trim() ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg, #2563EB, #1d4ed8)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving || !name.trim() ? "default" : "pointer" }}>
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirm modal (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({ project, onClose, onDeleted, getToken }: {
  project: Project; onClose: () => void; onDeleted: (id: string) => void; getToken: () => Promise<string | null>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setErr("Failed to delete project"); setDeleting(false); return; }
      onDeleted(project.id);
    } catch { setErr("Something went wrong."); setDeleting(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9001, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--page-bg-2)", borderRadius: 16, border: "1px solid rgba(239,68,68,0.2)", padding: "28px 32px", width: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--page-text)", marginBottom: 8 }}>Delete project?</div>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
          &ldquo;<strong style={{ color: "#94A3B8" }}>{project.name}</strong>&rdquo; and all its sessions will be removed. Generated outputs remain in your library.
        </div>
        {err && <div style={{ fontSize: 12, color: "#FCA5A5", marginBottom: 14 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748B", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => void confirm()} disabled={deleting}
            style={{ padding: "9px 20px", borderRadius: 9, background: "#EF4444", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1 }}>
            {deleting ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline rename (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function InlineRename({ initial, onSave, onCancel }: { initial: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) onSave(val.trim()); if (e.key === "Escape") onCancel(); }}
        maxLength={80}
        style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(37,99,235,0.5)", borderRadius: 7, padding: "4px 8px", outline: "none", width: "150px" }} />
      <button onClick={() => { if (val.trim()) onSave(val.trim()); }}
        style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: "#60A5FA" }}>
        <Check size={11} />
      </button>
      <button onClick={onCancel}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: "#64748B" }}>
        <X size={11} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state (premium version)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyProjects({ onNew, onCD }: { onNew: () => void; onCD: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(14,165,160,0.1))",
        border: "1px solid rgba(37,99,235,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
        boxShadow: "0 0 40px rgba(37,99,235,0.1)",
      }}>
        <FolderOpen size={32} style={{ color: "#2563EB" }} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--page-text)", margin: 0, fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>No projects yet</h2>
      <p style={{ fontSize: 14, color: "#64748B", marginTop: 10, maxWidth: 360, lineHeight: 1.7 }}>
        Create a project to organise your creative campaigns, or let the Creative Director build one automatically when you generate.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
        <button onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, background: "linear-gradient(135deg, #2563EB, #1d4ed8)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={14} /> Create project
        </button>
        <button onClick={onCD} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", fontSize: 14, cursor: "pointer" }}>
          <Wand2 size={14} /> Open Creative Director
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats bar — v2-G with icon boxes
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: "Projects",  value: stats.total_projects,  color: "#2563EB", bg: "rgba(37,99,235,0.12)",  icon: Layers    },
    { label: "Outputs",   value: stats.total_outputs,   color: "#0EA5A0", bg: "rgba(14,165,160,0.12)", icon: ImageIcon },
    { label: "Favorites", value: stats.total_favorites, color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: Star      },
  ];
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
      {items.map(({ label, value, color, bg, icon: Icon }) => (
        <div key={label} style={{
          flex: 1, background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: bg, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--page-text)", lineHeight: 1, fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort bar
// ─────────────────────────────────────────────────────────────────────────────

function SortBar({ sortKey, onChange, count }: { sortKey: SortKey; onChange: (k: SortKey) => void; count: number }) {
  const options: { key: SortKey; label: string }[] = [
    { key: "updated", label: "Recently Updated" },
    { key: "name",    label: "Name"             },
    { key: "outputs", label: "Outputs"          },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginRight: 4 }}>Sort:</span>
        {options.map(({ key, label }) => (
          <button key={key} onClick={() => onChange(key)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: sortKey === key ? "rgba(37,99,235,0.15)" : "transparent",
              border: sortKey === key ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: sortKey === key ? "#60A5FA" : "#475569",
              transition: "all 0.12s",
            }}>
            {label}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>{count} project{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project card — v2-G with 210px cover
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick, onRename, onDelete }: {
  project: Project;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [hovered,  setHovered]  = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      style={{
        background: "var(--page-bg-2)",
        border: `1px solid ${hovered ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? "0 12px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(37,99,235,0.1)" : "none",
        position: "relative",
      }}
    >
      {/* Cover — 210px */}
      <div style={{
        height: 210,
        background: project.cover_url
          ? `url(${project.cover_url}) center/cover no-repeat`
          : projectGradient(project.name),
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Gradient overlay for readability */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.45) 100%)" }} />

        {/* Placeholder icon when no cover */}
        {!project.cover_url && (
          <div style={{
            width: 52, height: 52, borderRadius: 15,
            background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", zIndex: 1,
          }}>
            <FolderOpen size={24} style={{ color: "rgba(255,255,255,0.45)" }} />
          </div>
        )}

        {/* Visibility badge */}
        <span style={{
          position: "absolute", top: 10, left: 10, zIndex: 2,
          fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
          color: project.visibility === "public" ? "#10B981" : "#64748B",
          background: project.visibility === "public" ? "rgba(16,185,129,0.18)" : "rgba(0,0,0,0.4)",
          border: `1px solid ${project.visibility === "public" ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(8px)",
        }}>
          {project.visibility === "public" ? "PUBLIC" : "PRIVATE"}
        </span>

        {/* Menu button */}
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
            style={{
              position: "absolute", top: 8, right: 8, zIndex: 2,
              background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)", borderRadius: 7, padding: "5px 7px",
              cursor: "pointer", color: "#94A3B8",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <MoreHorizontal size={14} />
          </button>
        )}

        {/* Dropdown menu */}
        {menuOpen && (
          <div onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 38, right: 8, zIndex: 10,
              background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: "4px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 130,
            }}>
            <button
              onClick={() => { setRenaming(true); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 7, background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
              <Pencil size={13} /> Rename
            </button>
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 7, background: "none", border: "none", color: "#EF4444", fontSize: 13, cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        {renaming ? (
          <InlineRename
            initial={project.name}
            onSave={name => { onRename(name); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: project.description ? 5 : 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
        )}
        {project.description && !renaming && (
          <div style={{
            fontSize: 12, color: "#64748B", marginBottom: 12,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            lineHeight: 1.5,
          }}>
            {project.description}
          </div>
        )}
        {!renaming && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
              <ImageIcon size={11} />
              <strong style={{ color: hovered ? "#94A3B8" : "#475569", fontWeight: 700 }}>{project.asset_count ?? 0}</strong>
              &nbsp;output{(project.asset_count ?? 0) !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} />
              {timeAgo(project.updated_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ borderRadius: 14, overflow: "hidden", background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ height: 210, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ height: 14, borderRadius: 6, background: "rgba(255,255,255,0.06)", width: "65%", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 11, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: "85%", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 11, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: "40%", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]       = useState<DashboardStats>({ total_projects: 0, total_outputs: 0, total_favorites: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [sortKey, setSortKey]   = useState<SortKey>("updated");

  const getToken = useCallback(async () => {
    const { data: { session: live } } = await supabase.auth.getSession();
    return live?.access_token ?? session?.access_token ?? null;
  }, [session]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      if (!token) { setError("Not authenticated"); setLoading(false); return; }
      const res = await fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load projects");
      const json = await res.json() as { success: boolean; data: { projects: Project[]; stats: DashboardStats } };
      setProjects(json.data.projects ?? []);
      setStats(json.data.stats ?? { total_projects: 0, total_outputs: 0, total_favorites: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  // Client-side sort only
  const sortedProjects = useMemo(() => {
    const copy = [...projects];
    if (sortKey === "name")    return copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === "outputs") return copy.sort((a, b) => (b.asset_count ?? 0) - (a.asset_count ?? 0));
    return copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [projects, sortKey]);

  const handleCreated = (p: Project) => {
    setProjects(prev => [p, ...prev]);
    setStats(prev => ({ ...prev, total_projects: prev.total_projects + 1 }));
    setShowCreate(false);
    toast.success(`Project "${p.name}" created`);
    router.push(`/dashboard/project/${p.id}`);
  };

  const handleDeleted = (id: string) => {
    const name = projects.find(p => p.id === id)?.name ?? "Project";
    setProjects(prev => prev.filter(p => p.id !== id));
    setStats(prev => ({ ...prev, total_projects: Math.max(0, prev.total_projects - 1) }));
    setDeleteTarget(null);
    toast.success(`"${name}" deleted`);
  };

  const handleRename = async (id: string, name: string) => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      toast.success("Project renamed");
    } else {
      toast.error("Rename failed — please try again");
    }
  };

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>

      {/* ── Premium Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          {/* Chip row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Layers size={14} style={{ color: "#2563EB" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Creative Projects
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--page-text)", margin: 0, fontFamily: "var(--font-display, 'Syne', sans-serif)", lineHeight: 1.1 }}>
            Projects
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 6, lineHeight: 1.6, maxWidth: 480 }}>
            Organise your creative campaigns and AI-generated work into structured project workspaces.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0, marginTop: 4 }}>
          <button
            onClick={() => router.push("/studio/image?mode=creative-director")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <Wand2 size={13} /> Creative Director
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #2563EB, #1d4ed8)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && !error && <StatsBar stats={stats} />}

      {/* ── Loading ── */}
      {loading && <SkeletonGrid />}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{ padding: "20px 24px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => void load()} style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && projects.length === 0 && (
        <EmptyProjects
          onNew={() => setShowCreate(true)}
          onCD={() => router.push("/studio/image?mode=creative-director")}
        />
      )}

      {/* ── Projects grid ── */}
      {!loading && !error && projects.length > 0 && (
        <>
          {/* Sort bar */}
          <SortBar sortKey={sortKey} onChange={setSortKey} count={projects.length} />

          {/* Grid — responsive auto-fill */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {sortedProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => router.push(`/dashboard/project/${p.id}`)}
                onRename={name => void handleRename(p.id, name)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>

          {/* Footer CTA */}
          <div style={{
            marginTop: 36, padding: "18px 24px", borderRadius: 14,
            background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.14)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)" }}>Ready to create something new?</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>Open the Creative Director to start a new campaign.</div>
            </div>
            <button
              onClick={() => router.push("/studio/image?mode=creative-director")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: "rgba(37,99,235,0.14)", border: "1px solid rgba(37,99,235,0.28)", color: "#60A5FA", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Open CD <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={handleCreated} getToken={getToken} />
      )}
      {deleteTarget && (
        <DeleteModal project={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} getToken={getToken} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
