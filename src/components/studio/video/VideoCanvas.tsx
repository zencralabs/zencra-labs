"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoCanvas — Premium 16:9 central canvas for Zencra Video Studio
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";
import VideoEmptyStateMascot from "./VideoEmptyStateMascot";
import type { FrameMode, ImageSlot } from "./types";
import type { VideoModel } from "@/lib/ai/video-model-registry";

interface Props {
  model: VideoModel | null;
  frameMode: FrameMode;
  startSlot: ImageSlot;
  endSlot: ImageSlot;
  generating: boolean;
  onStartUpload: (file: File) => void;
  onEndUpload: (file: File) => void;
  onSamplePrompt: () => void;
  onOpenUpload: () => void;
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  label: string;
  slot: ImageSlot;
  onFile: (file: File) => void;
  accent?: "teal" | "blue";
  small?: boolean;
}

function UploadZone({ label, slot, onFile, accent = "teal", small }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const color = accent === "teal" ? "#0EA5A0" : "#2563EB";
  const bg = accent === "teal" ? "rgba(14,165,160,0.06)" : "rgba(37,99,235,0.06)";
  const border = accent === "teal" ? "rgba(14,165,160,0.3)" : "rgba(37,99,235,0.3)";
  const hoverBg = accent === "teal" ? "rgba(14,165,160,0.12)" : "rgba(37,99,235,0.12)";

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: small ? 8 : 14,
        background: slot.preview ? "transparent" : bg,
        border: `1.5px dashed ${border}`,
        borderRadius: 14,
        cursor: "pointer",
        transition: "all 0.2s",
        overflow: "hidden",
        position: "relative",
        minHeight: small ? 100 : 160,
      }}
      onMouseEnter={e => {
        if (!slot.preview) (e.currentTarget as HTMLElement).style.background = hoverBg;
      }}
      onMouseLeave={e => {
        if (!slot.preview) (e.currentTarget as HTMLElement).style.background = bg;
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      {slot.preview ? (
        <>
          {/* Preview image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.preview}
            alt={label}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Overlay replace hint */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: 0,
              transition: "opacity 0.2s",
            }}
            className="zone-overlay"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{ fontSize: 12, color: "#E2E8F0", fontWeight: 600 }}>Replace</span>
          </div>

          {/* Label badge */}
          <div
            style={{
              position: "absolute", top: 10, left: 10,
              background: "rgba(0,0,0,0.7)",
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "3px 8px",
              fontSize: 11,
              color,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {label}
          </div>
        </>
      ) : (
        <>
          {/* Upload icon */}
          <div
            style={{
              width: small ? 36 : 48,
              height: small ? 36 : 48,
              borderRadius: "50%",
              background: bg,
              border: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={small ? 18 : 22} height={small ? 18 : 22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: small ? 12 : 13, fontWeight: 700, color, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: small ? 11 : 12, color: "#475569" }}>Drop image or click to browse</div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Generating overlay ────────────────────────────────────────────────────────

function GeneratingOverlay({ modelName }: { modelName: string }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: "rgba(2,6,14,0.82)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        zIndex: 10,
        borderRadius: 16,
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Pulsing clapperboard */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,160,0.2) 0%, transparent 70%)",
          border: "1px solid rgba(14,165,160,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "pulse-ring 2s ease-in-out infinite",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 96 96" fill="none">
          <rect x="16" y="34" width="64" height="46" rx="8" fill="rgba(14,165,160,0.15)" stroke="#0EA5A0" strokeWidth="1.5" />
          <rect x="16" y="20" width="64" height="18" rx="6" fill="rgba(14,165,160,0.25)" stroke="#0EA5A0" strokeWidth="1.5" />
          <path d="M40 46 L40 68 L62 57 Z" fill="#0EA5A0" opacity="0.9" />
        </svg>
      </div>

      {/* Model name + status */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#E2E8F0",
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          Generating with {modelName}…
        </div>
        <div style={{ fontSize: 13, color: "#64748B" }}>
          This usually takes 30–90 seconds
        </div>
      </div>

      {/* Shimmer progress bar */}
      <div
        style={{
          width: 220,
          height: 3,
          borderRadius: 99,
          background: "rgba(14,165,160,0.15)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            width: "40%",
            borderRadius: 99,
            background: "linear-gradient(90deg, transparent, #0EA5A0, transparent)",
            animation: "shimmer-slide 1.8s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes shimmer-slide {
          0% { left: -40%; }
          100% { left: 140%; }
        }
      `}</style>
    </div>
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────

export default function VideoCanvas({
  model,
  frameMode,
  startSlot,
  endSlot,
  generating,
  onStartUpload,
  onEndUpload,
  onSamplePrompt,
  onOpenUpload,
}: Props) {

  const isTextMode = frameMode === "text_to_video";
  const isStartMode = frameMode === "start_frame";
  const isStartEnd = frameMode === "start_end";
  const isExtend = frameMode === "extend";
  const isLipSync = frameMode === "lip_sync";

  const hasStartImage = !!startSlot.preview;
  const hasEndImage = !!endSlot.preview;

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.018)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 0 0 1px rgba(14,165,160,0.04), inset 0 1px 0 rgba(255,255,255,0.04)",
        // 16:9 aspect ratio
        aspectRatio: "16 / 9",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Ambient glow corners ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", top: 0, left: 0,
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(14,165,160,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 16,
        }}
      >
        {/* TEXT TO VIDEO — show mascot empty state */}
        {isTextMode && (
          <VideoEmptyStateMascot
            onUpload={onOpenUpload}
            onSamplePrompt={onSamplePrompt}
          />
        )}

        {/* START FRAME — single upload zone */}
        {isStartMode && (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#475569",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Start Frame — Image to Video
            </div>
            <UploadZone
              label="Start Frame"
              slot={startSlot}
              onFile={onStartUpload}
              accent="teal"
            />
            {!hasStartImage && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#334155" }}>
                Upload an image to use as the first frame of your video
              </div>
            )}
          </div>
        )}

        {/* START + END FRAME — two side-by-side upload zones */}
        {isStartEnd && (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#475569",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Start &amp; End Frames — Bookend Animation
            </div>
            <div style={{ display: "flex", gap: 12, flex: 1 }}>
              <UploadZone label="Start Frame" slot={startSlot} onFile={onStartUpload} accent="teal" />
              <UploadZone label="End Frame" slot={endSlot} onFile={onEndUpload} accent="blue" />
            </div>
            {(!hasStartImage || !hasEndImage) && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#334155" }}>
                Set both frames — the model will animate the transition between them
              </div>
            )}
          </div>
        )}

        {/* EXTEND VIDEO */}
        {isExtend && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "32px 24px",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(14,165,160,0.08)",
                border: "1px solid rgba(14,165,160,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
                <line x1="19" y1="12" x2="23" y2="12" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>
                Extend a Generated Video
              </div>
              <div style={{ fontSize: 13, color: "#64748B", maxWidth: 300, lineHeight: 1.6 }}>
                Select a video from your library below to extend its length using {model?.displayName ?? "the selected model"}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "8px 14px",
                background: "rgba(14,165,160,0.06)",
                border: "1px solid rgba(14,165,160,0.2)",
                borderRadius: 8,
                fontSize: 12,
                color: "#0EA5A0",
                alignItems: "center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Pick a video from the library below, then click Extend
            </div>
          </div>
        )}

        {/* LIP SYNC */}
        {isLipSync && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "32px 24px",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>
                Lip Sync
              </div>
              <div style={{ fontSize: 13, color: "#64748B", maxWidth: 300, lineHeight: 1.6 }}>
                Select a video from your library and provide audio to sync the character's lip movement
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
              <UploadZone label="Face / Character Image" slot={startSlot} onFile={onStartUpload} accent="blue" small />
            </div>
          </div>
        )}
      </div>

      {/* ── Generating overlay (shown on top of everything) ──────────────── */}
      {generating && (
        <GeneratingOverlay modelName={model?.displayName ?? "AI"} />
      )}

      {/* ── Corner accent lines ──────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 32, height: 32, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: 16, height: 1.5, background: "rgba(14,165,160,0.25)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1.5, height: 16, background: "rgba(14,165,160,0.25)" }} />
      </div>
      <div style={{ position: "absolute", top: 0, right: 0, width: 32, height: 32, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 1.5, background: "rgba(14,165,160,0.25)" }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 1.5, height: 16, background: "rgba(14,165,160,0.25)" }} />
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 32, height: 32, pointerEvents: "none" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 16, height: 1.5, background: "rgba(37,99,235,0.2)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 1.5, height: 16, background: "rgba(37,99,235,0.2)" }} />
      </div>
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, pointerEvents: "none" }}>
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 1.5, background: "rgba(37,99,235,0.2)" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 1.5, height: 16, background: "rgba(37,99,235,0.2)" }} />
      </div>
    </div>
  );
}
