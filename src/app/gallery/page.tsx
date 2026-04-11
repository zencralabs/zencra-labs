"use client";

/**
 * Gallery Page — /gallery
 *
 * Shows all public generations from the DB.
 * Filters: All / Video / Image / Audio
 * Sort:    Latest / Trending
 * Layout:  CSS columns masonry (3-col desktop, 2-col tablet, 1-col mobile)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, ImageIcon, Music, TrendingUp, Clock, SlidersHorizontal } from "lucide-react";
import MediaCard from "@/components/media/MediaCard";
import type { PublicAsset } from "@/lib/types/generation";

// ── Types ──────────────────────────────────────────────────────────────────────

type CategoryFilter = "all" | "image" | "video" | "audio";
type SortMode       = "latest" | "trending";

const CATEGORY_TABS: { label: string; value: CategoryFilter; icon: React.ReactNode }[] = [
  { label: "All",   value: "all",   icon: <SlidersHorizontal size={13} /> },
  { label: "Video", value: "video", icon: <Play size={13} />              },
  { label: "Image", value: "image", icon: <ImageIcon size={13} />         },
  { label: "Audio", value: "audio", icon: <Music size={13} />             },
];

const PAGE_SIZE = 24;

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <div
      style={{
        borderRadius:    14,
        background:      "rgba(255,255,255,0.03)",
        border:          "1px solid rgba(255,255,255,0.06)",
        overflow:        "hidden",
        marginBottom:    16,
        animation:       "pulse 1.5s ease-in-out infinite",
        breakInside:     "avoid",
      }}
    >
      <div
        style={{
          height:     tall ? 280 : 200,
          background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
          backgroundSize: "200% 100%",
          animation:  "shimmer 1.5s infinite",
        }}
      />
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
        <div style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.04)", width: "60%" }} />
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyGallery({ category }: { category: CategoryFilter }) {
  const label = category === "all" ? "public creations" : category + " content";
  return (
    <div
      style={{
        gridColumn:     "1 / -1",
        textAlign:      "center",
        padding:        "80px 24px",
        color:          "rgba(255,255,255,0.4)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🌐</div>
      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.6)" }}>
        No {label} yet
      </p>
      <p style={{ fontSize: 14 }}>
        Be the first to publish your AI creation to the gallery.
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort,     setSort]     = useState<SortMode>("latest");
  const [assets,   setAssets]   = useState<PublicAsset[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [total,    setTotal]    = useState(0);

  const loaderRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async (
    cat: CategoryFilter,
    sortMode: SortMode,
    pageNum: number,
    append: boolean
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:     String(pageNum),
        pageSize: String(PAGE_SIZE),
        sort:     sortMode,
      });
      if (cat !== "all") params.set("category", cat);

      const res  = await fetch(`/api/generations/public?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setAssets(prev => append ? [...prev, ...json.data] : json.data);
        setHasMore(json.hasMore);
        setTotal(json.total);
      }
    } catch (err) {
      console.error("[Gallery] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset + reload on filter/sort change
  useEffect(() => {
    setPage(1);
    fetchAssets(category, sort, 1, false);
  }, [category, sort, fetchAssets]);

  // Infinite scroll — load next page when loader div enters viewport
  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchAssets(category, sort, nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, category, sort, fetchAssets]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  function handleVisibilityChange(id: string) {
    // Remove from gallery if visibility changed away from public
    setAssets(prev => prev.filter(a => a.id !== id));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: "#080E1C", color: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── Shimmer keyframes ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          position:       "relative",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          overflow:       "hidden",
          paddingTop:     128,
          paddingBottom:  48,
          textAlign:      "center",
        }}
      >
        {/* Glow */}
        <div
          aria-hidden
          style={{
            position:   "absolute",
            inset:      0,
            background: "radial-gradient(ellipse at 50% 0%, rgba(14,165,160,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 640, padding: "0 24px" }}>
          {/* Badge */}
          <div
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           8,
              borderRadius:  999,
              padding:       "6px 16px",
              marginBottom:  16,
              background:    "rgba(14,165,160,0.12)",
              border:        "1px solid rgba(14,165,160,0.3)",
              color:         "#2DD4BF",
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#0EA5A0", boxShadow: "0 0 6px #0EA5A0"
            }} />
            Made with Zencra
          </div>

          <h1
            style={{
              fontWeight:  800,
              fontSize:    "clamp(2.5rem, 6vw, 4rem)",
              lineHeight:  1.1,
              marginBottom: 16,
              color:       "#fff",
            }}
          >
            Creative{" "}
            <span
              style={{
                background:           "linear-gradient(135deg, #0EA5A0, #A855F7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
              }}
            >
              Gallery
            </span>
          </h1>

          <p style={{ fontSize: 17, color: "#94A3B8", lineHeight: 1.6 }}>
            AI‑generated videos, images and audio crafted using the world&apos;s
            most powerful creative tools.
          </p>

          {total > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              {total.toLocaleString()} public creations
            </p>
          )}
        </div>
      </section>

      {/* ── FILTER + SORT BAR ───────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexWrap:       "wrap",
          gap:            12,
          paddingBottom:  36,
          paddingLeft:    24,
          paddingRight:   24,
        }}
      >
        {/* Category tabs */}
        <div
          style={{
            display:      "flex",
            gap:          4,
            background:   "rgba(255,255,255,0.04)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding:      4,
          }}
        >
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setCategory(tab.value)}
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          6,
                padding:      "7px 16px",
                borderRadius: 9,
                border:       "none",
                background:   category === tab.value
                  ? "rgba(255,255,255,0.10)"
                  : "transparent",
                color:        category === tab.value
                  ? "#fff"
                  : "rgba(255,255,255,0.45)",
                fontSize:     13,
                fontWeight:   600,
                cursor:       "pointer",
                transition:   "all 0.15s",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <div
          style={{
            display:      "flex",
            gap:          4,
            background:   "rgba(255,255,255,0.04)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding:      4,
          }}
        >
          {([
            { value: "latest",   label: "Latest",   icon: <Clock size={12} /> },
            { value: "trending", label: "Trending", icon: <TrendingUp size={12} /> },
          ] as { value: SortMode; label: string; icon: React.ReactNode }[]).map(s => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          6,
                padding:      "7px 14px",
                borderRadius: 9,
                border:       "none",
                background:   sort === s.value
                  ? "rgba(14,165,160,0.15)"
                  : "transparent",
                color:        sort === s.value
                  ? "#2DD4BF"
                  : "rgba(255,255,255,0.45)",
                fontSize:     12,
                fontWeight:   600,
                cursor:       "pointer",
                transition:   "all 0.15s",
              }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MASONRY GRID ────────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth:       1400,
          margin:         "0 auto",
          padding:        "0 clamp(16px, 4vw, 60px) 80px",
        }}
      >
        {loading && assets.length === 0 ? (
          /* Skeleton loading state */
          <div
            style={{
              columns:     "3 300px",
              columnGap:   16,
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} tall={i % 3 === 1} />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyGallery category={category} />
        ) : (
          <div
            style={{
              columns:   "3 300px",
              columnGap: 16,
            }}
          >
            {assets.map(asset => (
              <div
                key={asset.id}
                style={{
                  breakInside: "avoid",
                  marginBottom: 16,
                }}
              >
                <MediaCard
                  asset={asset}
                  isOwner={false}
                  compact={false}
                  onVisibilityChange={id => handleVisibilityChange(id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll loader */}
        {hasMore && (
          <div
            ref={loaderRef}
            style={{
              display:        "flex",
              justifyContent: "center",
              padding:        "32px 0",
            }}
          >
            {loading ? (
              <div
                style={{
                  width:        32,
                  height:       32,
                  borderRadius: "50%",
                  border:       "2px solid rgba(255,255,255,0.1)",
                  borderTopColor: "#0EA5A0",
                  animation:    "spin 0.7s linear infinite",
                }}
              />
            ) : null}
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* End of results */}
        {!hasMore && assets.length > 0 && (
          <p
            style={{
              textAlign:   "center",
              fontSize:    13,
              color:       "rgba(255,255,255,0.2)",
              paddingTop:  32,
            }}
          >
            You&apos;ve seen it all — {total.toLocaleString()} creations
          </p>
        )}
      </div>
    </div>
  );
}
