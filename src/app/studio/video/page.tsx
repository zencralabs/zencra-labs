// ─────────────────────────────────────────────────────────────────────────────
// /studio/video — Zencra Video Studio page
// Thin Suspense wrapper → VideoStudioShell (all state lives in Shell)
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";
import VideoStudioShell from "@/components/studio/video/VideoStudioShell";

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 64px)",
        marginTop: 64,
        background: "#060B14",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Animated ring */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid rgba(14,165,160,0.15)",
          borderTopColor: "#0EA5A0",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: 14, color: "#475569" }}>Loading studio…</span>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function VideoStudioPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <VideoStudioShell />
    </Suspense>
  );
}
