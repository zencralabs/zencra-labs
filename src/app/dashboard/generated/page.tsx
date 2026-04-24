"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Star, Clock, Layers, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";

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

type TabKey = "all" | "favorites";

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
// Asset card
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${hovered ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.07)"}`,
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
        transform: hovered ? "scale(1.015)" : "scale(1)",
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
          <ImageIcon size={24} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      )}

      {/* Favorite star */}
      {asset.is_favorite && (
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <Star size={14} fill="#F59E0B" style={{ color: "#F59E0B" }} />
        </div>
      )}

      {/* Hover info */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: "10px 10px",
        }}>
          {asset.prompt && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4 }}>
              {asset.prompt}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{asset.provider}</span>
            <span style={{ fontSize: 10, color: "#334155", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />
              {timeAgo(asset.created_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyGenerated({ tab, onGenerate }: { tab: TabKey; onGenerate: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: tab === "favorites" ? "rgba(245,158,11,0.12)" : "rgba(14,165,160,0.12)",
        border: `1px solid ${tab === "favorites" ? "rgba(245,158,11,0.25)" : "rgba(14,165,160,0.25)"}`,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
      }}>
        {tab === "favorites"
          ? <Star size={28} style={{ color: "#F59E0B" }} />
          : <ImageIcon size={28} style={{ color: "#0EA5A0" }} />
        }
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--page-text)", margin: 0 }}>
        {tab === "favorites" ? "No favorites yet" : "No outputs yet"}
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 8, maxWidth: 320, lineHeight: 1.6 }}>
        {tab === "favorites"
          ? "Star outputs you love inside the Creative Director to save them here."
          : "Your generated images and videos will appear here once created."
        }
      </p>
      {tab === "all" && (
        <button
          onClick={onGenerate}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10, marginTop: 20,
            background: "linear-gradient(135deg, #0EA5A0, #0d9488)",
            border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Layers size={15} />
          Open Creative Director
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function GeneratedPage() {
  const { session } = useAuth();
  const router = useRouter();

  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [favorites, setFavorites] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
      if (!res.ok) throw new Error("Failed to load generated outputs");
      const json = (await res.json()) as {
        success: boolean;
        data: {
          recent_generations: Asset[];
          favorites: Asset[];
          stats: { total_outputs: number; total_favorites: number };
        };
      };
      setAllAssets(json.data.recent_generations ?? []);
      setFavorites(json.data.favorites ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const displayAssets = tab === "favorites" ? favorites : allAssets;

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <ImageIcon size={16} style={{ color: "#0EA5A0" }} />
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Output Library
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Generated</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            All your generated images and videos across every project.
          </p>
        </div>
        <button
          onClick={() => router.push("/tools/creative-director")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(135deg, #0EA5A0, #0d9488)",
            border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Layers size={14} />
          Create More
        </button>
      </div>

      {/* ── Stats row ── */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Outputs", value: allAssets.length, color: "#0EA5A0", max: 20, note: allAssets.length === 20 ? "showing latest 20" : null },
            { label: "Favorites",     value: favorites.length,  color: "#F59E0B", max: null, note: null },
          ].map(({ label, value, color, note }) => (
            <div key={label} style={{
              padding: "14px 20px", borderRadius: 12,
              background: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.06)",
              minWidth: 140,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              {note && <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {([
          { key: "all"       as const, label: "All",       icon: ImageIcon },
          { key: "favorites" as const, label: "Favorites", icon: Star      },
        ]).map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 8,
                background: active ? "var(--page-bg-2)" : "transparent",
                border: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                color: active ? "var(--page-text)" : "#64748B",
                fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: "1", borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: "20px 24px", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#FCA5A5", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{error}</span>
          <button onClick={() => void load()} style={{ background: "none", border: "none", color: "#60A5FA", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && displayAssets.length === 0 && (
        <EmptyGenerated tab={tab} onGenerate={() => router.push("/tools/creative-director")} />
      )}

      {!loading && !error && displayAssets.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {displayAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={() => asset.url && setLightboxUrl(asset.url)}
              />
            ))}
          </div>

          {/* Footer note */}
          {tab === "all" && allAssets.length === 20 && (
            <div style={{
              marginTop: 24, padding: "14px 20px", borderRadius: 12,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Showing your 20 most recent outputs. Older outputs are stored in each project.</span>
              <button
                onClick={() => router.push("/dashboard/projects")}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#60A5FA", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
              >
                View by project <ArrowRight size={12} />
              </button>
            </div>
          )}
        </>
      )}

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
