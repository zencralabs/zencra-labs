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
  Clapperboard,
  Globe,
  Lock,
  FolderOpen,
  ExternalLink,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { MediaCardAsset, AssetVisibility } from "@/lib/types/generation";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MediaCardProps {
  asset: MediaCardAsset;
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
  onRegenerate?: (asset: MediaCardAsset) => void;
  /** Called when the user clicks Reuse Prompt */
  onReusePrompt?: (prompt: string) => void;
  /** Called when the user clicks Enhance */
  onEnhance?: (asset: MediaCardAsset) => void;
  /** Called when the user selects Start Frame or End Frame in the Animate submenu (images only) */
  onAnimate?: (asset: MediaCardAsset, frame: "start" | "end") => void;
  /** Called after visibility is changed successfully */
  onVisibilityChange?: (id: string, visibility: AssetVisibility) => void;
  /** Called after delete */
  onDelete?: (id: string) => void;
  /**
   * Gallery wall mode — fills the parent justified-row cell edge-to-edge.
   * Card chrome (border, background, box-shadow, border-radius) is removed.
   * The outer wrapper sets explicit pixel width + height; the card and its
   * <img> fill that frame with objectFit: cover. No height: auto anywhere.
   * Hover overlays still render; overflow is clipped to the cell.
   */
  galleryMode?: boolean;
  /**
   * Called when the underlying <img> fires its native onLoad event.
   * Receives the SyntheticEvent so the caller can read
   * e.currentTarget.naturalWidth / naturalHeight for justified layout.
   * Only fires for image assets (not video).
   */
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /**
   * Sequence number displayed below the right action strip on hover.
   * Passed in from the gallery; rendered inside the card so it scales
   * correctly at any zoom level, anchored to the icon stack, not viewport.
   */
  seqNumber?: number;
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
  asset: MediaCardAsset;
  isOwner: boolean;
  onClose: () => void;
  onVisibilityChange?: (id: string, v: AssetVisibility) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: (asset: MediaCardAsset) => void;
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`/api/assets/${asset.id}`, {
        method:  "PATCH",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ visibility: v }),
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
    const url = asset.url ?? asset.result_url ?? asset.result_urls?.[0];
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
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token ?? "";
                    await fetch(`/api/assets/${asset.id}`, {
                      method:  "DELETE",
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
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
  galleryMode = false,
  onImageLoad,
  seqNumber,
}: MediaCardProps) {
  const [hovered,   setHovered]   = useState(false);
  const [liked,     setLiked]     = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [moreOpen,  setMoreOpen]  = useState(false);
  // Tracks whether the underlying <img> has fired its native load event.
  // In galleryMode the image starts at opacity 0 and fades in once loaded
  // so the gallery never flashes a half-decoded image at full opacity.
  const [imgLoaded, setImgLoaded] = useState(false);
  const [menuPos,  setMenuPos]  = useState<{ top: number; left: number } | null>(null);

  const cardRef        = useRef<HTMLDivElement>(null);
  const moreButtonRef  = useRef<HTMLDivElement>(null);    // wraps the ⋮ trigger
  const portalMenuRef  = useRef<HTMLDivElement>(null);    // wraps the portal dropdown

  const mediaUrl  = asset.url ?? asset.result_url ?? asset.result_urls?.[0] ?? null;
  const isVideo   = mediaUrl ? isVideoUrl(mediaUrl) : false;
  const isImage   = !isVideo;
  const category  = asset.tool_category ?? asset.studio;

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
    if (!asset.prompt) return;
    try {
      await navigator.clipboard.writeText(asset.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [asset.prompt]);

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
      onMouseLeave={() => setHovered(false)}
      style={galleryMode ? {
        // Gallery justified-row mode: fills the explicit width+height of the
        // parent wrapper. height: 100% propagates the wrapper's pixel height
        // down through the component tree so the <img> can use objectFit:cover.
        position:   "relative",
        width:      "100%",
        height:     "100%",
        overflow:   "hidden",
        cursor:     "pointer",
        userSelect: "none",
        borderRadius: 0,
        background:   "transparent",
        border:       "none",
        boxShadow:    "none",
        transform:    "none",
        transition:   "none",
      } : {
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
        style={galleryMode ? {
          // Gallery justified row: height 100% — fills the wrapper's explicit
          // pixel height set by the justified layout engine. objectFit cover
          // on the <img> below clips any fractional pixel overshoot.
          position:   "relative",
          width:      "100%",
          height:     "100%",
          background: "transparent",
          overflow:   "hidden",
          borderRadius: 0,
        } : {
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
          borderRadius: 0,   // sharp media corners — card border-radius stays on the card container
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
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                // 1. Trigger fade-in (galleryMode perceived-performance polish).
                setImgLoaded(true);
                // 2. Forward to caller so imageRatios can capture naturalWidth/Height.
                onImageLoad?.(e);
              }}
              style={galleryMode ? {
                // Gallery justified row: fill the wrapper's pixel-height box.
                // objectFit cover preserves aspect ratio and clips fractional px.
                // Starts at opacity 0; fades to 1 when the image fires onLoad so
                // the gallery never flashes a half-decoded frame at full opacity.
                width:      "100%",
                height:     "100%",
                objectFit:  "cover",
                display:    "block",
                opacity:    imgLoaded ? 1 : 0,
                transition: "opacity 300ms ease, transform 0.35s",
                transform:  hovered ? "scale(1.04)" : "scale(1)",
              } : {
                // Standard mode: natural masonry — image renders at true height.
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


        {/* ── Bottom-right action chips — icon-only, anchored bottom-right ──────
             Positioned as a compact horizontal cluster at bottom:18 right:18.
             No full-width gradient — each chip has its own glass backdrop.
             Size scales with --gallery-zoom CSS variable from gallery wrapper.  ── */}
        {!hideHoverActions && !compact && isOwner && (
          <div
            style={{
              position:      "absolute",
              bottom:        18,
              right:         18,
              display:       "flex",
              alignItems:    "center",
              gap:           5,
              opacity:       hovered ? 1 : 0,
              transform:     hovered ? "translateY(0)" : "translateY(4px)",
              transition:    "opacity 0.2s, transform 0.2s",
              pointerEvents: hovered ? "auto" : "none",
            }}
          >
            {/* 1 — Regenerate */}
            <ActionChip
              icon={<RefreshCw style={{ width: CHIP_ICON, height: CHIP_ICON }} />}
              label="Regenerate"
              onClick={e => { e.stopPropagation(); onRegenerate?.(asset); }}
            />
            {/* 2 — Reuse prompt */}
            <ActionChip
              icon={<Repeat2 style={{ width: CHIP_ICON, height: CHIP_ICON }} />}
              label="Reuse prompt"
              onClick={e => { e.stopPropagation(); onReusePrompt?.(asset.prompt); }}
            />
            {/* 3 — Upscale (coming soon — disabled) */}
            <ActionChip
              icon={<Sparkles style={{ width: CHIP_ICON, height: CHIP_ICON }} />}
              label="Upscale coming soon"
              onClick={e => e.stopPropagation()}
              color="#a78bfa"
              disabled
            />
            {/* 4 — Animate (images only) — shows Start/End Frame submenu */}
            {isImage && (
              <AnimateChip
                onAnimate={(frame) => { onAnimate?.(asset, frame); }}
              />
            )}
          </div>
        )}

        {/* ── RIGHT hover action strip — inside the media div so it is anchored
             to the exact image tile bounds at every zoom level and aspect ratio.
             The MoreMenu dropdown MUST always render via portal (document.body) —
             never inline — so it is never clipped by this container's overflow:hidden.
             top/right anchoring and pointerEvents are explicit to prevent drift.  ── */}
        {!hideHoverActions && (
          <div
            style={{
              position:      "absolute",
              top:           8,
              right:         8,
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              gap:           6,
              opacity:       hovered ? 1 : 0,
              transform:     hovered ? "translateX(0)" : "translateX(8px)",
              transition:    "opacity 0.2s, transform 0.2s",
              pointerEvents: hovered ? "auto" : "none",
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
                <Heart style={{ width: CHIP_ICON, height: CHIP_ICON }} fill={liked ? "#f43f5e" : "none"} color={liked ? "#f43f5e" : "currentColor"} />
              </IconBtn>
            )}

            {/* Download */}
            <IconBtn onClick={e => { e.stopPropagation(); handleDownload(); }} title="Download">
              <Download style={{ width: CHIP_ICON, height: CHIP_ICON }} />
            </IconBtn>

            {/* Copy prompt */}
            <IconBtn onClick={e => { e.stopPropagation(); handleCopy(); }} title="Copy prompt" active={copied} activeColor="#60a5fa">
              {copied ? <Check style={{ width: CHIP_ICON, height: CHIP_ICON }} /> : <Copy style={{ width: CHIP_ICON, height: CHIP_ICON }} />}
            </IconBtn>

            {/* More menu trigger — ref captures position for portal placement.
                 The dropdown MUST always render via portal (document.body) — never inline. */}
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
                  <MoreVertical style={{ width: CHIP_ICON, height: CHIP_ICON }} />
                </IconBtn>
              </div>
            )}

            {/* Sequence number — centered below the action stack.
                 Lives in the same flex column so it tracks the buttons at every zoom.
                 No hardcoded top value. */}
            {seqNumber != null && (
              <span
                style={{
                  marginTop:     12,
                  fontSize:      15,
                  fontWeight:    600,
                  color:         "rgba(255,255,255,0.4)",
                  lineHeight:    1,
                  textAlign:     "center",
                  letterSpacing: "0.02em",
                  pointerEvents: "none",
                  userSelect:    "none",
                }}
              >
                {String(seqNumber).padStart(2, "0")}
              </span>
            )}
          </div>
        )}
      </div>
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

/** Right-strip icon button — same glass/border/hover design as ActionChip,
 *  same CHIP_BTN/CHIP_ICON sizing so both strips scale together with zoom. */
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
        ...chipBase,
        border:     active
          ? `1px solid ${activeColor ?? "rgba(255,255,255,0.3)"}`
          : "1px solid rgba(255,255,255,0.12)",
        background: active
          ? `${activeColor ?? "rgba(255,255,255,0.15)"}22`
          : "rgba(12,12,18,0.82)",
        color:      active ? (activeColor ?? "#fff") : "rgba(255,255,255,0.7)",
        cursor:     "pointer",
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background  = "rgba(255,255,255,0.09)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background  = "rgba(12,12,18,0.82)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
        }
      }}
    >
      {children}
    </button>
  );
}

// ── Clamp sizing constants — scale with --gallery-zoom CSS variable (0–1) ──────
// Parent wraps the gallery with  style={{ "--gallery-zoom": zoomLevel/5 }}
// so these expressions react to the gallery zoom slider automatically.
// clamp(min, preferred, max) — preferred is 0.8 default if var() is unset.
const CHIP_BTN  = "clamp(22px, calc(40px * var(--gallery-zoom, 0.8)), 44px)";
const CHIP_ICON = "clamp(12px, calc(21px * var(--gallery-zoom, 0.8)), 24px)";

const chipBase: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  width:          CHIP_BTN,
  height:         CHIP_BTN,
  borderRadius:   8,
  border:         "1px solid rgba(255,255,255,0.12)",
  background:     "rgba(12,12,18,0.82)",
  backdropFilter: "blur(8px)",
  transition:     "background 0.15s, border-color 0.15s",
  flexShrink:     0,
  cursor:         "pointer",
};

function ActionChip({
  icon,
  label,
  onClick,
  color,
  disabled,
}: {
  icon: React.ReactNode;
  /** Visible only as native tooltip — no text rendered inside the button */
  label: string;
  onClick: (e: React.MouseEvent) => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      style={{
        ...chipBase,
        color:   disabled ? "rgba(255,255,255,0.28)" : (color ?? "rgba(255,255,255,0.75)"),
        cursor:  disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background    = "rgba(255,255,255,0.09)";
          (e.currentTarget as HTMLElement).style.borderColor   = "rgba(255,255,255,0.22)";
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background    = "rgba(12,12,18,0.82)";
        (e.currentTarget as HTMLElement).style.borderColor   = "rgba(255,255,255,0.12)";
      }}
    >
      {icon}
    </button>
  );
}

/** Animate chip — icon only, opens Start / End Frame submenu on click */
function AnimateChip({ onAnimate }: { onAnimate: (frame: "start" | "end") => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        title="Animate"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          ...chipBase,
          color: open ? "#fb923c" : "rgba(255,255,255,0.75)",
          borderColor: open ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.12)",
          background:  open ? "rgba(251,146,60,0.12)" : "rgba(12,12,18,0.82)",
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background  = "rgba(255,255,255,0.09)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background  = "rgba(12,12,18,0.82)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
          }
        }}
      >
        <Clapperboard style={{ width: CHIP_ICON, height: CHIP_ICON }} />
      </button>

      {open && (
        <>
          {/* Invisible backdrop — closes on outside click */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9200 }}
            onClick={e => { e.stopPropagation(); setOpen(false); }}
          />
          {/* Submenu — appears above the chip, right-aligned so it stays inside card */}
          <div
            style={{
              position:       "absolute",
              bottom:         "calc(100% + 10px)",
              right:          0,
              minWidth:       158,
              background:     "rgba(10,10,20,0.97)",
              border:         "1px solid rgba(255,255,255,0.10)",
              borderRadius:   10,
              overflow:       "hidden",
              zIndex:         9201,
              boxShadow:      "0 8px 32px rgba(0,0,0,0.72)",
              backdropFilter: "blur(16px)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {([
              { label: "Use as Start Frame", frame: "start" as const },
              { label: "Use as End Frame",   frame: "end"   as const },
            ]).map(({ label, frame }, idx) => (
              <button
                key={frame}
                onClick={e => {
                  e.stopPropagation();
                  setOpen(false);
                  onAnimate(frame);
                }}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  padding:      "9px 13px",
                  border:       "none",
                  borderBottom: idx === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  background:   "transparent",
                  color:        "rgba(255,255,255,0.85)",
                  fontSize:     11,
                  fontWeight:   600,
                  cursor:       "pointer",
                  textAlign:    "left",
                  whiteSpace:   "nowrap",
                  transition:   "background 0.12s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.10)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
