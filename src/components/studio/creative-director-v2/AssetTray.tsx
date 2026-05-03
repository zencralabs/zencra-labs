"use client";

/**
 * AssetTray — reference image upload strip for Creative Director v2.
 *
 * Lives in the PromptDock top row between the model pills and quality toggle.
 * Shows a "+ Refs" upload button and 36×36px thumbnails for each uploaded asset.
 *
 * Thumbnails:
 *   - Draggable → sets `application/cd-asset` dataTransfer payload
 *   - Remove button on hover (top-right ×)
 *   - Role color badge bottom-right if assignedRole is set
 *   - Glow effect while being dragged
 *
 * Memory: blob: URLs are revoked via store.removeUploadedAsset.
 */

import { useRef, useState }           from "react";
import { useDirectionStore }          from "@/lib/creative-director/store";
import type { UploadedAsset }         from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  subject:    "rgba(59,130,246,1)",
  world:      "rgba(34,197,94,1)",
  atmosphere: "rgba(139,92,246,1)",
  object:     "rgba(249,115,22,1)",
};

// ─────────────────────────────────────────────────────────────────────────────

export function AssetTray() {
  const { uploadedAssets, addUploadedAsset, removeUploadedAsset } = useDirectionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hovUpload, setHovUpload] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      addUploadedAsset({
        id:           `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        name:         file.name.replace(/\.[^.]+$/, ""), // strip extension for label
        assignedRole: null,
      });
    });
    // Reset input so the same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            5,
        flexShrink:     0,
        height:         "100%",
        overflowX:      "auto",
        scrollbarWidth: "none",
        maxWidth:       260,
      }}
    >
      {/* Vertical separator */}
      <div style={{
        width:      1,
        height:     26,
        background: "rgba(255,255,255,0.08)",
        flexShrink: 0,
        marginRight: 2,
      }} />

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setHovUpload(true)}
        onMouseLeave={() => setHovUpload(false)}
        title="Upload reference images"
        style={{
          background:    hovUpload ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
          border:        `1px solid ${hovUpload ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.1)"}`,
          borderRadius:  8,
          color:         hovUpload ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.4)",
          fontSize:      9,
          fontFamily:    "var(--font-sans)",
          fontWeight:    600,
          cursor:        "pointer",
          padding:       "0 10px",
          height:        28,
          whiteSpace:    "nowrap",
          display:       "flex",
          alignItems:    "center",
          gap:           5,
          letterSpacing: "0.04em",
          transition:    "all 0.15s ease",
          flexShrink:    0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Images
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Thumbnails */}
      {uploadedAssets.map((asset) => (
        <AssetThumb
          key={asset.id}
          asset={asset}
          onRemove={removeUploadedAsset}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single thumbnail card
// ─────────────────────────────────────────────────────────────────────────────

function AssetThumb({
  asset,
  onRemove,
}: {
  asset:    UploadedAsset;
  onRemove: (id: string) => void;
}) {
  const [hov,      setHov]      = useState(false);
  const [dragging, setDragging] = useState(false);

  const roleColor = asset.assignedRole ? ROLE_COLORS[asset.assignedRole] : null;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Custom payload for CD canvas drop handler
    e.dataTransfer.setData(
      "application/cd-asset",
      JSON.stringify({ id: asset.id, url: asset.url, name: asset.name })
    );
    e.dataTransfer.effectAllowed = "copy";
    setDragging(true);
  };

  const handleDragEnd = () => setDragging(false);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={asset.name}
      style={{
        position:     "relative",
        width:        36,
        height:       36,
        borderRadius: 7,
        overflow:     "hidden",
        flexShrink:   0,
        cursor:       "grab",
        border:       `1px solid ${
          dragging ? "rgba(139,92,246,0.7)" :
          hov      ? "rgba(255,255,255,0.25)" :
          roleColor ? roleColor.replace("1)", "0.5)") :
          "rgba(255,255,255,0.1)"
        }`,
        boxShadow: dragging
          ? "0 0 14px rgba(139,92,246,0.5)"
          : hov
            ? "0 4px 12px rgba(0,0,0,0.5)"
            : "none",
        opacity:    dragging ? 0.55 : 1,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.1s ease",
        // Glow pulse while dragging
        animation:  dragging ? "cd-generate-pulse 1.2s ease-in-out infinite" : "none",
      }}
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.name}
        style={{
          width:     "100%",
          height:    "100%",
          objectFit: "cover",
          display:   "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
        draggable={false}
      />

      {/* Remove button — top-right on hover */}
      {hov && !dragging && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
          style={{
            position:       "absolute",
            top:            2,
            right:          2,
            width:          14,
            height:         14,
            borderRadius:   "50%",
            background:     "rgba(15,10,20,0.92)",
            border:         "1px solid rgba(239,68,68,0.5)",
            color:          "rgba(239,68,68,0.9)",
            fontSize:       8,
            fontFamily:     "var(--font-sans)",
            lineHeight:     1,
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        0,
            zIndex:         5,
            transition:     "background 0.1s, border-color 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background    = "rgba(239,68,68,0.25)";
            e.currentTarget.style.borderColor   = "rgba(239,68,68,0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background    = "rgba(15,10,20,0.92)";
            e.currentTarget.style.borderColor   = "rgba(239,68,68,0.5)";
          }}
        >
          ✕
        </button>
      )}

      {/* Role badge — bottom-right corner if assigned */}
      {roleColor && (
        <div
          title={asset.assignedRole ?? ""}
          style={{
            position:     "absolute",
            bottom:       2,
            right:        2,
            width:        7,
            height:       7,
            borderRadius: "50%",
            background:   roleColor,
            boxShadow:    `0 0 5px ${roleColor.replace("1)", "0.7)")}`,
            border:       "1px solid rgba(0,0,0,0.4)",
            zIndex:       4,
          }}
        />
      )}
    </div>
  );
}
