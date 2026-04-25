"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /studio/character — Character Studio page
// Feature-flagged: shows coming-soon if characterStudioEnabled = false
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import CharacterStudioShell from "@/components/studio/character/CharacterStudioShell";

// ── Coming Soon screen ────────────────────────────────────────────────────────

function ComingSoon() {
  return (
    <div style={{
      minHeight: "100vh",
      background: [
        "radial-gradient(circle at 30% 40%, rgba(245,158,11,0.10), transparent 40%)",
        "radial-gradient(circle at 70% 60%, rgba(180,83,9,0.06), transparent 40%)",
        "#090c13",
      ].join(", "),
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, textAlign: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#e8eaf0",
      padding: "0 20px",
    }}>
      {/* Amber glow icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        border: "1px solid rgba(245,158,11,0.3)",
        background: "rgba(245,158,11,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 40px rgba(245,158,11,0.2)",
        animation: "csPulse 3s ease-in-out infinite",
      }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
          stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
        <style>{`
          @keyframes csPulse { 0%,100%{box-shadow:0 0 40px rgba(245,158,11,0.2)} 50%{box-shadow:0 0 60px rgba(245,158,11,0.35)} }
        `}</style>
      </div>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Character Studio
        </h1>
        <p style={{ fontSize: 15, color: "#8b92a8", maxWidth: 420, lineHeight: 1.7, margin: "0 auto 16px" }}>
          Character Studio is coming soon — the Soul ID identity system is ready and
          waiting to power your AI characters.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 18px", borderRadius: 20,
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#f59e0b", boxShadow: "0 0 8px #f59e0b",
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.04em" }}>
            Soul ID system ready
          </span>
        </div>
      </div>

      <a href="/studio/image"
        style={{
          padding: "10px 20px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)", border: "1px solid #1a2035",
          color: "#8b92a8", fontSize: 13, fontWeight: 500, textDecoration: "none",
          transition: "all 0.15s",
        }}
      >
        ← Back to Image Studio
      </a>
    </div>
  );
}

// ── Flag loader ───────────────────────────────────────────────────────────────

// We check the flag client-side via a lightweight API hit to avoid importing
// server-only feature-flag code into the client bundle.
async function checkCharacterStudioFlag(): Promise<boolean> {
  try {
    const res = await fetch("/api/studio/character/generate", { method: "OPTIONS" });
    // 200 or 405 = route exists = flag likely on; 404 = not found
    return res.status !== 404;
  } catch {
    return false;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CharacterStudioPage() {
  const [flagChecked, setFlagChecked] = useState(false);
  const [enabled,     setEnabled]     = useState(false);

  useEffect(() => {
    // Check ZENCRA_FLAG_CHARACTER_STUDIO via env (client-safe pattern)
    const envEnabled =
      process.env.NEXT_PUBLIC_CHARACTER_STUDIO_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_CHARACTER_STUDIO_ENABLED === "1";

    if (envEnabled) {
      setEnabled(true);
      setFlagChecked(true);
      return;
    }

    // Fallback: probe generate route
    checkCharacterStudioFlag().then(v => {
      setEnabled(v);
      setFlagChecked(true);
    });
  }, []);

  if (!flagChecked) {
    // Loading state — minimal, not jarring
    return (
      <div style={{
        minHeight: "100vh", background: "#090c13",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 32, height: 32, opacity: 0.3, animation: "spin 1s linear infinite" }}>
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2" strokeDasharray="50 14" />
          </svg>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return enabled ? <CharacterStudioShell /> : <ComingSoon />;
}
