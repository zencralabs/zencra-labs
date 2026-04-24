"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, ImageIcon, Clock, ArrowRight, Layers } from "lucide-react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyProjects({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
      }}>
        <FolderOpen size={28} style={{ color: "#2563EB" }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--page-text)", margin: 0 }}>
        No projects yet
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", marginTop: 8, maxWidth: 320, lineHeight: 1.6 }}>
        Projects are created automatically when you generate concepts in the Creative Director.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button
          onClick={onNew}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10,
            background: "linear-gradient(135deg, #2563EB, #1d4ed8)",
            border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={15} />
          Open Creative Director
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--page-bg-2)",
        border: `1px solid ${hovered ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {/* Cover / placeholder */}
      <div style={{
        height: 120,
        background: project.cover_url
          ? `url(${project.cover_url}) center/cover no-repeat`
          : "linear-gradient(135deg, #0d1533 0%, #0B1022 100%)",
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!project.cover_url && (
          <FolderOpen size={28} style={{ color: "rgba(37,99,235,0.4)" }} />
        )}
        {/* Visibility badge */}
        {project.visibility === "public" && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            fontSize: 10, fontWeight: 700, color: "#10B981",
            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 6, padding: "2px 8px",
          }}>PUBLIC</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </div>
        {project.description && (
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.description}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
              <ImageIcon size={11} />
              {project.asset_count ?? 0} output{(project.asset_count ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={10} />
            {timeAgo(project.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: "Projects",  value: stats.total_projects,  color: "#2563EB" },
    { label: "Outputs",   value: stats.total_outputs,   color: "#0EA5A0" },
    { label: "Favorites", value: stats.total_favorites, color: "#F59E0B" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          flex: 1, background: "var(--page-bg-2)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total_projects: 0, total_outputs: 0, total_favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token ?? session?.access_token;
      if (!token) { setError("Not authenticated"); setLoading(false); return; }

      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load projects");
      const json = (await res.json()) as {
        success: boolean;
        data: {
          projects: Project[];
          stats: DashboardStats;
        };
      };
      setProjects(json.data.projects ?? []);
      setStats(json.data.stats ?? { total_projects: 0, total_outputs: 0, total_favorites: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Layers size={16} style={{ color: "#2563EB" }} />
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Creative Projects
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            All your Creative Director projects and their outputs.
          </p>
        </div>
        <button
          onClick={() => router.push("/tools/creative-director")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(135deg, #2563EB, #1d4ed8)",
            border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && <StatsBar stats={stats} />}

      {/* Content */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              height: 200, borderRadius: 14, background: "var(--page-bg-2)",
              border: "1px solid rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: "20px 24px", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#FCA5A5", fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{error}</span>
          <button onClick={() => void load()} style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <EmptyProjects onNew={() => router.push("/tools/creative-director")} />
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => router.push(`/dashboard/project/${p.id}`)}
              />
            ))}
          </div>

          {/* Footer CTA */}
          <div style={{
            marginTop: 32, padding: "16px 20px", borderRadius: 12,
            background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>Ready to create something new?</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Open the Creative Director to start a new project.</div>
            </div>
            <button
              onClick={() => router.push("/tools/creative-director")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 9,
                background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)",
                color: "#60A5FA", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Open CD <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
