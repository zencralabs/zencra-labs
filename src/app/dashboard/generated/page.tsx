"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ImageIcon, Star, Clock, Film, Music, User2, Wand2,
  Download, Trash2, EyeOff, Eye, FolderOpen,
  X, Check, RefreshCw, ChevronDown, Layers,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast, ToastStack } from "@/components/ui/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  project_id: string | null;
  session_id: string | null;
  concept_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

type StudioFilter    = "all" | "image" | "video" | "audio" | "character";
type VisFilter       = "all" | "private" | "public" | "project";

interface Filters {
  studio:     StudioFilter;
  project_id: string; // "" = all, "none" = unlinked
  visibility: VisFilter;
  is_favorite: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function studioIcon(studio: string, size = 14) {
  switch (studio) {
    case "image":     return <ImageIcon size={size} />;
    case "video":     return <Film      size={size} />;
    case "audio":     return <Music     size={size} />;
    case "character": return <User2     size={size} />;
    default:          return <Wand2     size={size} />;
  }
}

function studioColor(studio: string): string {
  switch (studio) {
    case "image":     return "#2563EB";
    case "video":     return "#7C3AED";
    case "audio":     return "#0EA5A0";
    case "character": return "#D97706";
    default:          return "#64748B";
  }
}

function downloadAsset(url: string, prompt: string | null) {
  const a = document.createElement("a");
  a.href = url;
  a.download = prompt
    ? prompt.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-") + ".png"
    : "zencra-output.png";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_OPTIONS: { value: StudioFilter; label: string }[] = [
  { value: "all",       label: "All Studios" },
  { value: "image",     label: "Image" },
  { value: "video",     label: "Video" },
  { value: "audio",     label: "Audio" },
  { value: "character", label: "Character" },
];

const VIS_OPTIONS: { value: VisFilter; label: string }[] = [
  { value: "all",     label: "All" },
  { value: "private", label: "Private" },
  { value: "public",  label: "Public" },
  { value: "project", label: "In Project" },
];

function FilterSelect<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          appearance: "none",
          padding: "6px 28px 6px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: value === "all" ? "#94A3B8" : "var(--page-text)",
          fontSize: 13,
          fontWeight: value === "all" ? 400 : 600,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#0F172A" }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748B" }}
      />
    </div>
  );
}

function FilterBar({
  filters, projects, total,
  onChange, onReset,
}: {
  filters: Filters;
  projects: Project[];
  total: number;
  onChange: (f: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const hasActive =
    filters.studio !== "all" ||
    filters.project_id !== "" ||
    filters.visibility !== "all" ||
    filters.is_favorite;

  const projectOptions: { value: string; label: string }[] = [
    { value: "",     label: "All Projects" },
    { value: "none", label: "Unlinked" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "12px 16px",
      background: "rgba(255,255,255,0.025)",
      borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 20,
    }}>
      {/* Studio */}
      <FilterSelect value={filters.studio} options={STUDIO_OPTIONS} onChange={(v) => onChange({ studio: v })} />

      {/* Project */}
      <div style={{ position: "relative", display: "inline-flex" }}>
        <select
          value={filters.project_id}
          onChange={(e) => onChange({ project_id: e.target.value })}
          style={{
            appearance: "none",
            padding: "6px 28px 6px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: filters.project_id === "" ? "#94A3B8" : "var(--page-text)",
            fontSize: 13,
            fontWeight: filters.project_id === "" ? 400 : 600,
            cursor: "pointer",
            outline: "none",
            maxWidth: 180,
          }}
        >
          {projectOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: "#0F172A" }}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748B" }} />
      </div>

      {/* Visibility */}
      <FilterSelect value={filters.visibility} options={VIS_OPTIONS} onChange={(v) => onChange({ visibility: v })} />

      {/* Favorites toggle */}
      <button
        onClick={() => onChange({ is_favorite: !filters.is_favorite })}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: filters.is_favorite ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${filters.is_favorite ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.1)"}`,
          color: filters.is_favorite ? "#F59E0B" : "#64748B",
          fontSize: 13, fontWeight: filters.is_favorite ? 600 : 400,
          cursor: "pointer",
        }}
      >
        <Star size={13} fill={filters.is_favorite ? "#F59E0B" : "none"} />
        Favorites
      </button>

      {/* Spacer + result count + reset */}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: "#475569" }}>{total} outputs</span>
      {hasActive && (
        <button
          onClick={onReset}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 8,
            background: "none", border: "1px solid rgba(255,255,255,0.08)",
            color: "#64748B", fontSize: 12, cursor: "pointer",
          }}
        >
          <X size={11} /> Clear filters
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-select action bar
// ─────────────────────────────────────────────────────────────────────────────

function MultiSelectBar({
  count, assets, selected,
  onClear, onDelete, onMakePublic, onMakePrivate, onMoveToProject,
}: {
  count: number;
  assets: Asset[];
  selected: Set<string>;
  onClear: () => void;
  onDelete: () => void;
  onMakePublic: () => void;
  onMakePrivate: () => void;
  onMoveToProject: () => void;
}) {
  const selectedAssets = assets.filter((a) => selected.has(a.id));
  const downloadAll = () => {
    selectedAssets.forEach((a) => { if (a.url) downloadAsset(a.url, a.prompt); });
  };

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 40,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "10px 16px",
      background: "rgba(37,99,235,0.12)",
      border: "1px solid rgba(37,99,235,0.3)",
      borderRadius: 12, marginBottom: 16,
      backdropFilter: "blur(12px)",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>
        {count} selected
      </span>
      <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />

      {/* Download */}
      <ActionBtn icon={<Download size={13} />} label="Download" onClick={downloadAll} />

      {/* Move to project */}
      <ActionBtn icon={<FolderOpen size={13} />} label="Move to project" onClick={onMoveToProject} />

      {/* Make public */}
      <ActionBtn icon={<Eye size={13} />} label="Make public" onClick={onMakePublic} />

      {/* Make private */}
      <ActionBtn icon={<EyeOff size={13} />} label="Make private" onClick={onMakePrivate} />

      {/* Delete */}
      <ActionBtn icon={<Trash2 size={13} />} label="Delete" onClick={onDelete} danger />

      <div style={{ flex: 1 }} />
      <button
        onClick={onClear}
        style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
      >
        <X size={12} /> Clear
      </button>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 7,
        background: danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)"}`,
        color: danger ? "#FCA5A5" : "var(--page-text)",
        fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}
    >
      {icon} {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset card
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({
  asset, selected, multiSelectMode,
  onSelect, onOpen, onFavorite, onDelete, onDownload,
}: {
  asset: Asset;
  selected: boolean;
  multiSelectMode: boolean;
  onSelect: (id: string) => void;
  onOpen: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showCheck = multiSelectMode || hovered || selected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "rgba(37,99,235,0.7)" : hovered ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.07)"}`,
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hovered && !multiSelectMode ? "scale(1.015)" : "scale(1)",
        boxShadow: selected ? "0 0 0 2px rgba(37,99,235,0.3)" : hovered ? "0 4px 24px rgba(0,0,0,0.3)" : "none",
      }}
    >
      {/* Image */}
      <div onClick={multiSelectMode ? () => onSelect(asset.id) : onOpen} style={{ width: "100%", height: "100%" }}>
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
            {studioIcon(asset.studio, 24)}
          </div>
        )}
      </div>

      {/* Studio dot */}
      <div style={{
        position: "absolute", top: 8, left: 8,
        width: 8, height: 8, borderRadius: "50%",
        background: studioColor(asset.studio),
        opacity: showCheck ? 0 : 0.85,
        transition: "opacity 0.15s",
        boxShadow: `0 0 6px ${studioColor(asset.studio)}`,
      }} />

      {/* Checkbox */}
      {showCheck && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(asset.id); }}
          style={{
            position: "absolute", top: 7, left: 7,
            width: 22, height: 22, borderRadius: 6,
            background: selected ? "#2563EB" : "rgba(0,0,0,0.6)",
            border: selected ? "2px solid #2563EB" : "2px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {selected && <Check size={12} color="#fff" strokeWidth={3} />}
        </button>
      )}

      {/* Top-right: favorite + download */}
      {hovered && !multiSelectMode && (
        <div style={{
          position: "absolute", top: 7, right: 7,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <HoverIconBtn
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            title="Download"
          >
            <Download size={12} />
          </HoverIconBtn>
          <HoverIconBtn
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            title={asset.is_favorite ? "Unfavorite" : "Favorite"}
            active={asset.is_favorite}
            activeColor="#F59E0B"
          >
            <Star size={12} fill={asset.is_favorite ? "#F59E0B" : "none"} />
          </HoverIconBtn>
        </div>
      )}

      {/* Bottom hover overlay */}
      {hovered && !multiSelectMode && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            {asset.prompt && (
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.85)", lineHeight: 1.4,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {asset.prompt}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#64748B", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={9} />
                {timeAgo(asset.created_at)}
              </span>
              {asset.visibility !== "private" && (
                <span style={{
                  fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: asset.visibility === "public" ? "#34D399" : "#60A5FA",
                }}>
                  {asset.visibility}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete on hover (bottom-right) */}
      {hovered && !multiSelectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          style={{
            position: "absolute", bottom: 7, right: 7,
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", pointerEvents: "auto",
          }}
        >
          <Trash2 size={12} color="#FCA5A5" />
        </button>
      )}

      {/* Favorite badge (non-hover) */}
      {asset.is_favorite && !hovered && (
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <Star size={12} fill="#F59E0B" style={{ color: "#F59E0B" }} />
        </div>
      )}
    </div>
  );
}

function HoverIconBtn({
  onClick, children, title, active = false, activeColor = "#2563EB",
}: {
  onClick: React.MouseEventHandler;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 7,
        background: active ? `${activeColor}22` : "rgba(0,0,0,0.55)",
        border: `1px solid ${active ? activeColor + "55" : "rgba(255,255,255,0.15)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: active ? activeColor : "rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Move-to-project modal
// ─────────────────────────────────────────────────────────────────────────────

function MoveToProjectModal({
  projects, currentProjectId, assetCount,
  onMove, onClose,
}: {
  projects: Project[];
  currentProjectId: string | null;
  assetCount: number;
  onMove: (projectId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400, maxHeight: "70vh",
          background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--page-text)" }}>Move to Project</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
              {assetCount} asset{assetCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {/* Remove from project option */}
          <button
            onClick={() => onMove(null)}
            style={{
              width: "100%", padding: "10px 12px",
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#94A3B8", fontSize: 13, cursor: "pointer",
              marginBottom: 8, textAlign: "left",
            }}
          >
            <X size={14} style={{ flexShrink: 0 }} />
            Remove from project
          </button>

          {projects.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              No projects yet. Create one in the Projects page.
            </div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onMove(p.id)}
                style={{
                  width: "100%", padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  background: currentProjectId === p.id ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  border: `1px solid ${currentProjectId === p.id ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: currentProjectId === p.id ? "#60A5FA" : "var(--page-text)",
                  fontSize: 13, cursor: "pointer",
                  marginBottom: 6, textAlign: "left",
                }}
              >
                <FolderOpen size={14} style={{ flexShrink: 0, color: "#2563EB" }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                {currentProjectId === p.id && <Check size={13} style={{ flexShrink: 0 }} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────

function LightboxModal({
  asset, projects,
  onClose, onFavorite, onDelete, onVisibility, onMoveToProject,
}: {
  asset: Asset;
  projects: Project[];
  onClose: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onVisibility: (v: "private" | "public") => void;
  onMoveToProject: () => void;
}) {
  const projectName = projects.find((p) => p.id === asset.project_id)?.name;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: "90vw" }}>

        {/* Image */}
        {asset.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.prompt ?? "Generated output"}
            style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: 14, objectFit: "contain", display: "block" }}
          />
        )}

        {/* Action bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 14,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          flexWrap: "wrap", justifyContent: "center",
        }}>
          {/* Download */}
          <LightboxActionBtn
            icon={<Download size={15} />}
            label="Download"
            onClick={() => asset.url && downloadAsset(asset.url, asset.prompt)}
          />

          {/* Favorite */}
          <LightboxActionBtn
            icon={<Star size={15} fill={asset.is_favorite ? "#F59E0B" : "none"} />}
            label={asset.is_favorite ? "Unfavorite" : "Favorite"}
            onClick={onFavorite}
            active={asset.is_favorite}
            activeColor="#F59E0B"
          />

          {/* Visibility toggle */}
          {asset.visibility === "public" ? (
            <LightboxActionBtn
              icon={<EyeOff size={15} />}
              label="Make Private"
              onClick={() => onVisibility("private")}
            />
          ) : (
            <LightboxActionBtn
              icon={<Eye size={15} />}
              label="Make Public"
              onClick={() => onVisibility("public")}
            />
          )}

          {/* Move to project */}
          <LightboxActionBtn
            icon={<FolderOpen size={15} />}
            label={projectName ? `In: ${projectName.slice(0, 16)}` : "Add to Project"}
            onClick={onMoveToProject}
          />

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />

          {/* Delete */}
          <LightboxActionBtn
            icon={<Trash2 size={15} />}
            label="Delete"
            onClick={onDelete}
            danger
          />
        </div>

        {/* Prompt + meta */}
        {asset.prompt && (
          <div style={{
            maxWidth: 560, textAlign: "center",
            fontSize: 12, color: "#64748B", lineHeight: 1.6,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          }}>
            {asset.prompt}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 20,
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#94A3B8",
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

function LightboxActionBtn({
  icon, label, onClick, active = false, activeColor = "#2563EB", danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 9,
        background: danger ? "rgba(239,68,68,0.1)" : active ? `${activeColor}22` : "rgba(255,255,255,0.05)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : active ? activeColor + "55" : "rgba(255,255,255,0.1)"}`,
        color: danger ? "#FCA5A5" : active ? activeColor : "var(--page-text)",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {icon} {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation modal
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({
  count, onConfirm, onClose,
}: {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 360, padding: 24, background: "#0F172A", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--page-text)" }}>
          Delete {count === 1 ? "this output" : `${count} outputs`}?
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
          This permanently removes the selected asset{count !== 1 ? "s" : ""} from your library. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyGenerated({ hasFilters, onGenerate, onReset }: { hasFilters: boolean; onGenerate: () => void; onReset: () => void; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
      }}>
        <ImageIcon size={28} style={{ color: "#2563EB" }} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--page-text)", margin: 0 }}>
        {hasFilters ? "No matching outputs" : "Nothing generated yet"}
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 8, maxWidth: 340, lineHeight: 1.6 }}>
        {hasFilters
          ? "Try clearing a filter or two — your outputs might be hiding behind the wrong criteria."
          : "Every image, video, and audio output you create across all studios lands here — organised, searchable, and ready to share."
        }
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {hasFilters && (
          <button onClick={onReset} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--page-text)", fontSize: 13, cursor: "pointer" }}>
            <RefreshCw size={13} /> Clear filters
          </button>
        )}
        <button onClick={onGenerate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, background: "linear-gradient(135deg, #1d4ed8, #2563EB)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Layers size={13} /> Create in Studio
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  studio:      "all",
  project_id:  "",
  visibility:  "all",
  is_favorite: false,
};

export default function GeneratedPage() {
  const { session } = useAuth();
  const router     = useRouter();
  const { toasts, toast, dismiss } = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [assets,     setAssets]     = useState<Asset[]>([]);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total,      setTotal]      = useState(0);
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS);

  // Selection
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  // Modals
  const [lightboxAsset,   setLightboxAsset]   = useState<Asset | null>(null);
  const [showDelete,      setShowDelete]      = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<Set<string>>(new Set());  // ids to delete
  const [showMoveModal,   setShowMoveModal]   = useState(false);
  const [moveTarget,      setMoveTarget]      = useState<Set<string>>(new Set());  // ids to move
  // Public confirmation step: assetId → pending visibility=public action
  const [pendingPublic,   setPendingPublic]   = useState<string | null>(null);

  // ── Auth token ────────────────────────────────────────────────────────────
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session: live } } = await supabase.auth.getSession();
    return live?.access_token ?? session?.access_token ?? null;
  }, [session]);

  // ── Load projects (for filter + move modal) ───────────────────────────────
  const loadProjects = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res  = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json() as { success: boolean; data: Project[] };
      if (json.success) setProjects(json.data ?? []);
    } catch { /* silently skip — filter still works without projects list */ }
  }, [getToken]);

  // ── Load assets ───────────────────────────────────────────────────────────
  const buildUrl = useCallback((f: Filters, cursor?: string) => {
    const q = new URLSearchParams();
    if (f.studio      !== "all") q.set("studio",      f.studio);
    if (f.project_id  !== "")    q.set("project_id",  f.project_id);
    if (f.visibility  !== "all") q.set("visibility",  f.visibility);
    if (f.is_favorite)           q.set("is_favorite", "true");
    q.set("limit", "40");
    if (cursor) q.set("cursor", cursor);
    return `/api/assets?${q.toString()}`;
  }, []);

  const loadAssets = useCallback(async (f: Filters, replace = true) => {
    replace ? setLoading(true) : setLoadingMore(true);
    setError(null);

    const token = await getToken();
    if (!token) { setError("Not authenticated"); setLoading(false); return; }

    try {
      const res  = await fetch(buildUrl(f), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load outputs");
      const json = await res.json() as {
        success: boolean;
        data: Asset[];
        nextCursor: string | null;
        total: number;
      };
      if (replace) {
        setAssets(json.data ?? []);
        setSelected(new Set());
      } else {
        setAssets((prev) => [...prev, ...(json.data ?? [])]);
      }
      setNextCursor(json.nextCursor);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      replace ? setLoading(false) : setLoadingMore(false);
    }
  }, [getToken, buildUrl]);

  // Cursor-based load more
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const token = await getToken();
    if (!token) return;
    setLoadingMore(true);
    try {
      const res  = await fetch(buildUrl(filters, nextCursor), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json() as { success: boolean; data: Asset[]; nextCursor: string | null; total: number };
      setAssets((prev) => [...prev, ...(json.data ?? [])]);
      setNextCursor(json.nextCursor);
    } catch { /* ignore — user can retry */ } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, getToken, buildUrl, filters]);

  // Initial load
  useEffect(() => { void loadProjects(); }, [loadProjects]);
  useEffect(() => { void loadAssets(filters, true); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter helpers ────────────────────────────────────────────────────────
  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilters =
    filters.studio !== "all" ||
    filters.project_id !== "" ||
    filters.visibility !== "all" ||
    filters.is_favorite;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const multiSelectMode = selected.size > 0;

  // ── PATCH helper ──────────────────────────────────────────────────────────
  const patchAsset = useCallback(async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }, [getToken]);

  // ── DELETE helper ─────────────────────────────────────────────────────────
  const deleteAssets = useCallback(async (ids: Set<string>) => {
    const token = await getToken();
    if (!token) return;
    await Promise.all(
      Array.from(ids).map((id) =>
        fetch(`/api/assets/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      )
    );
    setAssets((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
    setTotal((prev) => Math.max(0, prev - ids.size));
  }, [getToken]);

  // ── Action handlers ───────────────────────────────────────────────────────

  // Favorite toggle (single)
  const handleFavorite = useCallback(async (asset: Asset) => {
    const newVal = !asset.is_favorite;
    const ok = await patchAsset(asset.id, { is_favorite: newVal });
    if (ok) {
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, is_favorite: newVal } : a));
      if (lightboxAsset?.id === asset.id) setLightboxAsset((prev) => prev ? { ...prev, is_favorite: newVal } : null);
      toast.success(newVal ? "Added to favorites" : "Removed from favorites");
    } else {
      toast.error("Couldn't update favorite — please try again");
    }
  }, [patchAsset, lightboxAsset, toast]);

  // Delete (single or bulk)
  const promptDelete = (ids: Set<string>) => {
    setDeleteTarget(ids);
    setShowDelete(true);
  };
  const confirmDelete = async () => {
    const count = deleteTarget.size;
    setShowDelete(false);
    if (lightboxAsset && deleteTarget.has(lightboxAsset.id)) setLightboxAsset(null);
    try {
      await deleteAssets(deleteTarget);
      toast.success(count === 1 ? "Output deleted" : `${count} outputs deleted`);
    } catch {
      toast.error("Delete failed — please try again");
    }
    setDeleteTarget(new Set());
  };

  // Visibility (single) — with public confirmation via pendingPublic
  const handleVisibility = useCallback(async (asset: Asset, vis: "private" | "public") => {
    if (vis === "public" && asset.visibility !== "public") {
      // Show inline confirmation before making public
      setPendingPublic(asset.id);
      return;
    }
    const ok = await patchAsset(asset.id, { visibility: vis });
    if (ok) {
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, visibility: vis } : a));
      if (lightboxAsset?.id === asset.id) setLightboxAsset((prev) => prev ? { ...prev, visibility: vis } : null);
      toast.success(vis === "public" ? "Asset is now public" : "Asset set to private");
    } else {
      toast.error("Visibility update failed");
    }
  }, [patchAsset, lightboxAsset, toast]);

  // Confirm making public (after pendingPublic prompt)
  const confirmMakePublic = useCallback(async () => {
    if (!pendingPublic) return;
    const asset = assets.find((a) => a.id === pendingPublic);
    setPendingPublic(null);
    if (!asset) return;
    const ok = await patchAsset(asset.id, { visibility: "public" });
    if (ok) {
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, visibility: "public" } : a));
      if (lightboxAsset?.id === asset.id) setLightboxAsset((prev) => prev ? { ...prev, visibility: "public" } : null);
      toast.success("Asset is now public");
    } else {
      toast.error("Visibility update failed");
    }
  }, [pendingPublic, assets, patchAsset, lightboxAsset, toast]);

  // Bulk visibility
  const handleBulkVisibility = useCallback(async (vis: "private" | "public") => {
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => patchAsset(id, { visibility: vis })));
    setAssets((prev) => prev.map((a) => selected.has(a.id) ? { ...a, visibility: vis } : a));
    toast.success(vis === "public" ? `${ids.length} outputs made public` : `${ids.length} outputs set to private`);
    clearSelection();
  }, [selected, patchAsset, toast]);

  // Move to project
  const promptMove = (ids: Set<string>) => {
    setMoveTarget(ids);
    setShowMoveModal(true);
  };
  const handleMove = useCallback(async (projectId: string | null) => {
    setShowMoveModal(false);
    const body = projectId
      ? { visibility: "project", project_id: projectId }
      : { visibility: "private", project_id: null };
    const ids = Array.from(moveTarget);
    await Promise.all(ids.map((id) => patchAsset(id, body)));
    setAssets((prev) => prev.map((a) =>
      moveTarget.has(a.id)
        ? { ...a, visibility: body.visibility as string, project_id: body.project_id ?? null }
        : a
    ));
    if (lightboxAsset && moveTarget.has(lightboxAsset.id)) {
      setLightboxAsset((prev) => prev ? { ...prev, visibility: body.visibility as string, project_id: body.project_id ?? null } : null);
    }
    const projectName = projectId ? projects.find((p) => p.id === projectId)?.name : null;
    toast.success(projectName ? `Moved to "${projectName}"` : "Removed from project");
    clearSelection();
    setMoveTarget(new Set());
  }, [moveTarget, patchAsset, lightboxAsset, projects, toast]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
            <ImageIcon size={16} style={{ color: "#2563EB", marginTop: 2 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Your Library
              </span>
              <span style={{ fontSize: 11, color: "#475569", letterSpacing: "0.01em", lineHeight: 1.3, marginTop: 4 }}>
                Saved assets across your projects
              </span>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Generated</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            All your generated images and videos across every project.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => void loadAssets(filters, true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#64748B", fontSize: 13, cursor: "pointer",
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => router.push("/studio/image")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: "linear-gradient(135deg, #1d4ed8, #2563EB)",
              border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Layers size={13} /> Create More
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        filters={filters}
        projects={projects}
        total={total}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {/* ── Multi-select action bar ── */}
      {multiSelectMode && (
        <MultiSelectBar
          count={selected.size}
          assets={assets}
          selected={selected}
          onClear={clearSelection}
          onDelete={() => promptDelete(new Set(selected))}
          onMakePublic={() => void handleBulkVisibility("public")}
          onMakePrivate={() => void handleBulkVisibility("private")}
          onMoveToProject={() => promptMove(new Set(selected))}
        />
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: "1", borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{
          padding: "20px 24px", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#FCA5A5", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{error}</span>
          <button onClick={() => void loadAssets(filters, true)} style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && assets.length === 0 && (
        <EmptyGenerated
          hasFilters={hasActiveFilters}
          onGenerate={() => router.push("/studio/image")}
          onReset={resetFilters}
        />
      )}

      {/* ── Grid ── */}
      {!loading && !error && assets.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selected.has(asset.id)}
                multiSelectMode={multiSelectMode}
                onSelect={toggleSelect}
                onOpen={() => setLightboxAsset(asset)}
                onFavorite={() => void handleFavorite(asset)}
                onDelete={() => promptDelete(new Set([asset.id]))}
                onDownload={() => asset.url && downloadAsset(asset.url, asset.prompt)}
              />
            ))}
          </div>

          {/* Load more */}
          {nextCursor && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                style={{
                  padding: "10px 28px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--page-text)", fontSize: 13, fontWeight: 600,
                  cursor: loadingMore ? "wait" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading…" : `Load more`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}

      {lightboxAsset && (
        <LightboxModal
          asset={lightboxAsset}
          projects={projects}
          onClose={() => setLightboxAsset(null)}
          onFavorite={() => void handleFavorite(lightboxAsset)}
          onDelete={() => { promptDelete(new Set([lightboxAsset.id])); setLightboxAsset(null); }}
          onVisibility={(v) => void handleVisibility(lightboxAsset, v)}
          onMoveToProject={() => { promptMove(new Set([lightboxAsset.id])); }}
        />
      )}

      {showDelete && (
        <DeleteModal
          count={deleteTarget.size}
          onConfirm={() => void confirmDelete()}
          onClose={() => { setShowDelete(false); setDeleteTarget(new Set()); }}
        />
      )}

      {showMoveModal && (
        <MoveToProjectModal
          projects={projects}
          currentProjectId={
            moveTarget.size === 1
              ? (assets.find((a) => moveTarget.has(a.id))?.project_id ?? null)
              : null
          }
          assetCount={moveTarget.size}
          onMove={(pid) => void handleMove(pid)}
          onClose={() => { setShowMoveModal(false); setMoveTarget(new Set()); }}
        />
      )}

      {/* ── Public confirmation prompt ── */}
      {pendingPublic && (
        <div onClick={() => setPendingPublic(null)} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 360, padding: 24, background: "#0F172A", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--page-text)" }}>Make this asset public?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
              Public assets are visible to anyone with the link. You can make it private again at any time.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setPendingPublic(null)} style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => void confirmMakePublic()} style={{ padding: "8px 16px", borderRadius: 9, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Make Public
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
