"use client";

import { useRouter } from "next/navigation";

/**
 * HeroCTAs — Homepage hero call-to-action buttons.
 *
 * Theme (Zencra yellow-first):
 *   Primary  → solid #FFD731 (yellow), black text, hover #E5C12C
 *   Secondary → glass dark, white text — unchanged
 *
 * Yellow is the Zencra primary CTA color going forward.
 * The blue-purple gradient is reserved for decorative/accent use only.
 */
export function HeroCTAs() {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        flexWrap: "wrap" as const,
        justifyContent: "center",
      }}
    >
      {/* ── Primary — yellow #FFD731 ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => router.push("/studio/video")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          height: "52px",
          padding: "0 32px",
          background: "#FFD731",
          border: "none",
          color: "#000000",
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          cursor: "pointer",
          boxShadow: "0 0 36px rgba(255,215,49,0.28), 0 2px 8px rgba(0,0,0,0.30)",
          transition: "background 0.15s ease, transform 0.10s ease, box-shadow 0.15s ease",
          whiteSpace: "nowrap" as const,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#E5C12C";
          el.style.boxShadow = "0 0 44px rgba(255,215,49,0.36), 0 2px 12px rgba(0,0,0,0.30)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#FFD731";
          el.style.boxShadow = "0 0 36px rgba(255,215,49,0.28), 0 2px 8px rgba(0,0,0,0.30)";
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        Start Creating Free
        {/* Arrow icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8h10M9 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Secondary — glass dark ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => router.push("/studio/video")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          height: "52px",
          padding: "0 28px",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.16)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "rgba(255,255,255,0.84)",
          fontSize: "15px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          cursor: "pointer",
          transition: "background 0.15s ease, border-color 0.15s ease",
          whiteSpace: "nowrap" as const,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "rgba(255,255,255,0.12)";
          el.style.borderColor = "rgba(255,255,255,0.28)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "rgba(255,255,255,0.07)";
          el.style.borderColor = "rgba(255,255,255,0.16)";
        }}
      >
        Explore Studio
        {/* Play icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
