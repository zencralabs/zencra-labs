"use client";

/**
 * MediaCard — Reusable AI asset display card used across:
 *   - Studio image/video page (owner view)
 *   - Gallery page (public view)
 *   - Homepage carousel (public, read-only)
 *
 * Hover behaviour:
 *   RIGHT SIDE  (vertical icon strip):  ❤ Like  ⬇ Download  📋 Copy  ⋯ More
 *   BOTTOM BAR  (quick actions):        🔁 Regenerate  ♻ Reuse  ✨ Enhance  🎬 Animate
 *   ⋯ MORE MENU (absolute, click):      Open / Regenerate / Make Public-Private / Move / Download / Delete
 *
 * Owner-only actions (like, more-menu, bottom bar) are hidden when `isOwner` is false.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Heart,
  Download,
  Copy,
  MoreVertical,
  RefreshCw,
  Repeat2,
  Sparkles,
  Play,
  Globe,
  Lock,
  FolderOpen,
  ExternalLink,
  Trash2,
  Check,
  X,
} from "lucide-react";
import type { PublicAsset, AssetVisibility } from "@/lib/types/generation";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MediaCardProps {
  asset: PublicAsset;
  /** Whether the current viewer is the owner — shows edit/delete actions */
  isOwner?: boolean;
  /** Compact mode: no bottom bar, smaller icons (used in homepage carousel) */
  compact?: boolean;
  /**
   * Zoom simplification — when true (zoom level < 60% in gallery) all hover
   * overlays and action buttons are hidden. Image click remains fully active.
   */
  hideHoverActions?: boolean;
  /**
   * When true, suppresses the top-left VisibilityBadge so the parent can render
   * its own project/visibility overlay in the correct stacking position.
   */
  hideVisibilityBadge?: boolean;
  /**
   * Aspect ratio of the generated image (e.g. "16:9", "9:16", "1:1").
   * When provided the media container adopts this ratio so the card shape
   * matches the actual output — critical for NB2 non-square generations.
   * Leave undefined to fall back to natural image height (width: 100%, height: auto).
   */
  aspectRatio?: string;
  /** Called when the user clicks Regenerate */
  onRegenerate?: (asset: PublicAsset) => void;
  /** Called when the user clicks Reuse Prompt */
  onReusePrompt?: (prompt: string) => void;
  /** Called when the user clicks Enhance */
  onEnhance?: (asset: PublicAsset) => void;
  /** Called when the user clicks Animate (images only) */
  onAnimate?: (asset: PublicAsset) => void;
  /** Called after visibility is changed successfully */
  onVisibilityChange?: (id: string, visibility: AssetVisibility) => void;
  /** Called after delete */
  onDelete?: (id: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const VISIBILITY_ICONS: Record<AssetVisibility, React.ReactNode> = {
  public:  <Globe  size={11} />,
  private: <Lock   size={11} />,
  project: <FolderOpen size={11} />,
};

const VISIBILITY_LABELS: Record<AssetVisibility, string> = {
  public:  "Public",
  private: "Private",
  project: "In Project",
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: AssetVisibility }) {
  const colours: Record<AssetVisibility, string> = {
    public:  "rgba(34,197,94,0.15)",
    private: "rgba(100,116,139,0.2)",
    project: "rgba(59,130,246,0.15)",
  };
  const textColours: Record<AssetVisibility, string> = {
    public:  "#4ade80",
    private: "#94a3b8",
    project: "#60a5fa",
  };

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            4,
        padding:        "2px 7px",
        borderRadius:   20,
        background:     colours[visibility],
        color:          textColours[visibility],
        fontSize:       10,
        fontWeight:     600,
        letterSpacing:  "0.03em",
        backdropFilter: "blur(4px)",
      }}
    >
      {VISIBILITY_ICONS[visibility]}
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}

// ── More menu ──────────────────────────────────────────────────────────────────

interface MoreMenuProps {
  asset: PublicAsset;
  isOwner: boolean;
  onClose: () => void;
  onVisibilityChange?: (id: string, v: AssetVisibility) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: (asset: PublicAsset) => void;
  onReusePrompt?: (prompt: string) => void;
}

function MoreMenu({
  asset,
  isOwner,
  onClose,
  onVisibilityChange,
  onDelete,
  onRegenerate,
  onReusePrompt,
}: MoreMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function patchVisibility(v: AssetVisibility) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/generations/${asset.id}/visibility`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ visibility: v }),
      });
      if (res.ok) {
        onVisibilityChange?.(asset.id, v);
        onClose();
      }
    } finally {
      setUpdating(false);
    }
  }

  function handleOpen() {
    const url = asset.result_url ?? asset.result_urls?.[0];
    if (url) window.open(url, "_blank", "noopener");
    onClose();
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        // No position — the portal wrapper (in MediaCard) handles placement via position:fixed
        background:     "rgba(12,12,18,0.97)",
        border:         "1px solid rgba(255,255,255,0.10)",
        borderRadius:   12,
        padding:        "6px 0",
        boxShadow:      "0 8px 40px rgba(0,0,0,0.7)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Open full */}
      <MenuItem icon={<ExternalLink size={13} />} label="Open full size" onClick={handleOpen} />

      {isOwner && (
        <>
          <MenuItem
            icon={<RefreshCw size={13} />}
            label="Regenerate"
            onClick={() => { onRegenerate?.(asset); onClose(); }}
          />
          <MenuItem
            icon={<Repeat2 size={13} />}
            label="Reuse prompt"
            onClick={() => { onReusePrompt?.(asset.prompt); onClose(); }}
          />

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

          {/* Visibility actions — only show options different from current */}
          {asset.visibility !== "public" && (
            <MenuItem
              icon={<Globe size={13} />}
              label="Make public"
              color="#4ade80"
              disabled={updating}
              onClick={() => patchVisibility("public")}
            />
          )}
          {asset.visibility !== "private" && (
            <MenuItem
              icon={<Lock size={13} />}
              label="Make private"
              color="#94a3b8"
              disabled={updating}
              onClick={() => patchVisibility("private")}
            />
          )}
          {asset.visibility !== "project" && (
            <MenuItem
              icon={<FolderOpen size={13} />}
              label="Move to project"
              color="#60a5fa"
              disabled={updating}
              onClick={() => patchVisibility("project")}
            />
          )}

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

          {/* Delete with confirmation */}
          {!confirmDelete ? (
            <MenuItem
              icon={<Trash2 size={13} />}
              label="Delete"
              color="#f87171"
              onClick={() => setConfirmDelete(true)}
            />
          ) : (
            <div style={{ padding: "6px 14px" }}>
              <p style={{ fontSize: 11, color: "#f87171", marginBottom: 6 }}>
                Delete this asset?
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    await fetch(`/api/generations/${asset.id}`, { method: "DELETE" });
                    onDelete?.(asset.id);
                    onClose();
                  }}
                  style={confirmBtnStyle("#f87171")}
                >
                  <Trash2 size={11} /> Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={confirmBtnStyle("rgba(255,255,255,0.15)")}
                >
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, color, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            8,
        width:          "100%",
        padding:        "7px 14px",
        background:     "transparent",
        border:         "none",
        color:          color ?? "rgba(255,255,255,0.8)",
        fontSize:       12,
        fontWeight:     500,
        cursor:         disabled ? "not-allowed" : "pointer",
        opacity:        disabled ? 0.5 : 1,
        transition:     "background 0.15s",
        textAlign:      "left",
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function confirmBtnStyle(bg: string): React.CSSProperties {
  return {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          4,
    padding:      "4px 10px",
    borderRadius: 6,
    border:       "none",
    background:   bg,
    color:        "#fff",
    fontSize:     11,
    fontWeight:   600,
    cursor:       "pointer",
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MediaCard({
  asset,
  isOwner = false,
  compact = false,
  hideHoverActions = false,
  hideVisibilityBadge = false,
  aspectRatio: aspectRatioProp,
  onRegenerate,
  onReusePrompt,
  onEnhance,
  onAnimate,
  onVisibilityChange,
  onDelete,
}: MediaCardProps) {
  const [hovered,  setHovered]  = useState(false);
  const [liked,    setLiked]    = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos,  setMenuPos]  = useState<{ top: number; left: number } | null>(null);

  const cardRef        = useRef<HTMLDivElement>(null);
  const moreButtonRef  = useRef<HTMLDivElement>(null);    // wraps the ⋮ trigger
  const portalMenuRef  = useRef<HTMLDivElement>(null);    // wraps the portal dropdown

  const mediaUrl  = asset.result_url ?? asset.result_urls?.[0] ?? null;
  const isVideo   = mediaUrl ? isVideoUrl(mediaUrl) : false;
  const isImage   = !isVideo;
  const category  = asset.tool_category;

  // ── Close portal menu on scroll / resize (capture phase catches nested scrollers) ──
  useEffect(() => {
    if (!moreOpen) return;
    const close = () => { setMoreOpen(false); setMenuPos(null); };
    window.addEventListener("scroll",  close, true);
    window.addEventListener("resize",  close);
    return () => {
      window.removeEventListener("scroll",  close, true);
      window.removeEventListener("resize",  close);
    };
  }, [moreOpen]);

  // ── Close portal menu on outside mousedown ────────────────────────────────
  useEffect(() => {
    if (!moreOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        portalMenuRef.current?.contains(e.target as Node) ||
        moreButtonRef.current?.contains(e.target as Node)
      ) return;
      setMoreOpen(false);
      setMenuPos(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [moreOpen]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!mediaUrl) return;
    try {
      await navigator.clipboard.writeText(mediaUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [mediaUrl]);

  const handleDownload = useCallback(async () => {
    if (!mediaUrl) return;
    try {
      // Fetch as blob so the browser saves it to disk rather than opening a tab.
      // Works for Supabase CDN URLs which set Access-Control-Allow-Origin: *.
      const res = await fetch(mediaUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `zencra-${asset.id.slice(0, 8)}.${isVideo ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(mediaUrl, "_blank", "noopener");
    }
  }, [mediaUrl, asset.id, isVideo]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMoreOpen(false); setMenuPos(null); }}
      style={{
        position:     "relative",
        borderRadius: 14,
        // overflow is intentionally omitted here so the MoreMenu dropdown can
        // extend beyond the card boundary. The media div below handles its own
        // overflow:hidden for image/video clipping.
        background:   "rgba(255,255,255,0.03)",
        border:       hovered
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(255,255,255,0.06)",
        transition:   "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        transform:    hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow:    hovered
          ? "0 12px 40px rgba(0,0,0,0.5)"
          : "0 2px 12px rgba(0,0,0,0.2)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* ── Media ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position:     "relative",
          // Videos: always lock 16/9.
          // Images with a real URL: NO forced ratio — let the browser render
          //   the image at its true dimensions so masonry reflects actual output.
          // Images without a URL (placeholder): use supplied AR or square fallback
          //   so the card has a defined shape before the image loads.
          aspectRatio:  isVideo
            ? "16 / 9"
            : (isImage && mediaUrl)
              ? undefined
              : aspectRatioProp
                ? aspectRatioProp.replace(":", " / ")
                : "1 / 1",
          background:   "rgba(0,0,0,0.3)",
          overflow:     "hidden",
          borderRadius: "inherit",   // clips image within card's border-radius
        }}
      >
        {mediaUrl ? (
          isVideo ? (
            <video
              src={mediaUrl}
              muted
              loop
              playsInline
              autoPlay={hovered}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt={asset.prompt.slice(0, 80)}
              style={{
                // True masonry: image renders at its natural aspect ratio.
                // width: 100% fills the column; height: auto follows the image's
                // real dimensions — no crop, no forced shape, no distortion.
                width:      "100%",
                height:     "auto",
                display:    "block",
                transition: "transform 0.35s",
                transform:  hovered ? "scale(1.04)" : "scale(1)",
              }}
            />
          )
        ) : (
          // Placeholder — shape held by container aspectRatio above
          <div
            style={{
              width:          "100%",
              height:         "100%",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(139,92,246,0.12))",
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.3 }}>
              {category === "video" ? "🎬" : category === "audio" ? "🎵" : "🖼"}
            </div>
          </div>
        )}

        {/* Video play badge */}
        {isVideo && !hovered && (
          <div
            style={{
              position:       "absolute",
              inset:          0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "rgba(0,0,0,0.25)",
              transition:     "opacity 0.2s",
            }}
          >
            <div
              style={{
                width:          42,
                height:         42,
                borderRadius:   "50%",
                background:     "rgba(0,0,0,0.55)",
                border:         "1.5px solid rgba(255,255,255,0.3)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}
            >
              <Play size={16} fill="white" color="white" style={{ marginLeft: 2 }} />
            </div>
          </div>
        )}

        {/* Visibility badge — top left (hidden at low zoom or when parent provides its own) */}
        {!hideHoverActions && !hideVisibilityBadge && (
          <div
            style={{
              position:   "absolute",
              top:        8,
              left:       8,
              transition: "opacity 0.2s",
              opacity:    hovered ? 1 : 0.7,
            }}
          >
            <VisibilityBadge visibility={asset.visibility} />
          </div>
        )}

        {/* ── Prompt overlay — hover only, sits above the action bar ──── */}
        {!hideHoverActions && asset.prompt && (
          <div
            style={{
              position:      "absolute",
              bottom:        !compact && isOwner ? 46 : 0,
              left:          0,
              right:         0,
              padding:       "20px 10px 8px",
              background:    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)",
              opacity:       hovered ? 1 : 0,
              transition:    "opacity 0.2s",
              pointerEvents: "none",
            }}
          >
            <p
              style={{
                fontSize:        11,
                fontWeight:      500,
                color:           "rgba(255,255,255,0.88)",
                margin:          0,
                overflow:        "hidden",
                display:         "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight:      1.45,
              }}
            >
              {asset.prompt}
            </p>
            <span style={{
              fontSize:   9,
              color:      "rgba(255,255,255,0.45)",
              fontWeight: 500,
              display:    "block",
              marginTop:  3,
            }}>
              {asset.tool}
            </span>
          </div>
        )}

        {/* ── Bottom hover bar (quick actions) — hidden in compact mode or low zoom ──── */}
        {!hideHoverActions && !compact && isOwner && (
          <div
            style={{
              position:      "absolute",
              bottom:        0,
              left:          0,
              right:         0,
              display:       "flex",
              alignItems:    "center",
              gap:           6,
              padding:       "10px 12px",
              background:    "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)",
              opacity:       hovered ? 1 : 0,
              transform:     hovered ? "translateY(0)" : "translateY(6px)",
              transition:    "opacity 0.2s, transform 0.2s",
              pointerEvents: hovered ? "all" : "none",
            }}
          >
            <ActionChip
              icon={<RefreshCw size={11} />}
              label="Regenerate"
              onClick={e => { e.stopPropagation(); onRegenerate?.(asset); }}
            />
            <ActionChip
              icon={<Repeat2 size={11} />}
              label="Reuse"
              onClick={e => { e.stopPropagation(); onReusePrompt?.(asset.prompt); }}
            />
            <ActionChip
              icon={<Sparkles size={11} />}
              label="Enhance"
              onClick={e => { e.stopPropagation(); onEnhance?.(asset); }}
              color="#a78bfa"
            />
            {/* Animate only for images */}
            {isImage && (
              <ActionChip
                icon={<Play size={11} />}
                label="Animate"
                onClick={e => { e.stopPropagation(); onAnimate?.(asset); }}
                color="#fb923c"
              />
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT hover action strip — lives OUTSIDE the media div so the
           MoreMenu dropdown is never clipped by overflow:hidden ────────────── */}
      {!hideHoverActions && <div
        style={{
          position:      "absolute",
          top:           8,
          right:         8,
          display:       "flex",
          flexDirection: "column",
          gap:           6,
          opacity:       hovered ? 1 : 0,
          transform:     hovered ? "translateX(0)" : "translateX(8px)",
          transition:    "opacity 0.2s, transform 0.2s",
          pointerEvents: hovered ? "all" : "none",
          zIndex:        20,
        }}
      >
        {/* Like (owner only) */}
        {isOwner && (
          <IconBtn
            onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
            title="Like"
            active={liked}
            activeColor="#f43f5e"
          >
            <Heart size={13} fill={liked ? "#f43f5e" : "none"} color={liked ? "#f43f5e" : "currentColor"} />
          </IconBtn>
        )}

        {/* Download */}
        <IconBtn onClick={e => { e.stopPropagation(); handleDownload(); }} title="Download">
          <Download size={13} />
        </IconBtn>

        {/* Copy URL */}
        <IconBtn onClick={e => { e.stopPropagation(); handleCopy(); }} title="Copy URL" active={copied} activeColor="#60a5fa">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </IconBtn>

        {/* More menu trigger — ref captures position for portal placement */}
        {isOwner && (
          <div ref={moreButtonRef}>
            <IconBtn
              onClick={e => {
                e.stopPropagation();
                if (moreOpen) {
                  setMoreOpen(false);
                  setMenuPos(null);
                } else {
                  const rect = moreButtonRef.current?.getBoundingClientRect();
                  if (rect) {
                    setMenuPos({
                      top:  rect.bottom + 8,
                      left: rect.right - 220,   // right-align: right edge of menu = right edge of button
                    });
                  }
                  setMoreOpen(true);
                }
              }}
              title="More options"
              active={moreOpen}
            >
              <MoreVertical size={13} />
            </IconBtn>
          </div>
        )}
      </div>}
    </div>

    {/* ── Portal: renders dropdown at document.body so it is never clipped
         by any overflow:hidden or stacking context in the card grid ──────── */}
    {moreOpen && menuPos && typeof document !== "undefined" && createPortal(
      <div
        ref={portalMenuRef}
        style={{
          position: "fixed",
          top:      menuPos.top,
          left:     menuPos.left,
          width:    220,
          zIndex:   9999,
        }}
      >
        <MoreMenu
          asset={asset}
          isOwner={isOwner}
          onClose={() => { setMoreOpen(false); setMenuPos(null); }}
          onVisibilityChange={onVisibilityChange}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onReusePrompt={onReusePrompt}
        />
      </div>,
      document.body
    )}
    </>
  );
}

// ── Reusable mini-components ───────────────────────────────────────────────────

function IconBtn({
  children,
  onClick,
  title,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width:          30,
        height:         30,
        borderRadius:   8,
        border:         active
          ? `1px solid ${activeColor ?? "rgba(255,255,255,0.3)"}`
          : "1px solid rgba(255,255,255,0.12)",
        background:     active
          ? `${activeColor ?? "rgba(255,255,255,0.15)"}22`
          : "rgba(12,12,18,0.85)",
        color:          active ? (activeColor ?? "#fff") : "rgba(255,255,255,0.7)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        cursor:         "pointer",
        backdropFilter: "blur(8px)",
        transition:     "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function ActionChip({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            4,
        padding:        "4px 9px",
        borderRadius:   20,
        border:         "1px solid rgba(255,255,255,0.12)",
        background:     "rgba(12,12,18,0.8)",
        color:          color ?? "rgba(255,255,255,0.75)",
        fontSize:       10,
        fontWeight:     600,
        cursor:         "pointer",
        backdropFilter: "blur(8px)",
        transition:     "background 0.15s, border-color 0.15s",
        whiteSpace:     "nowrap",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(12,12,18,0.8)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
      }}
    >
      {icon}
      {label}
    </button>
  );
}
