// ─────────────────────────────────────────────────────────────────────────────
// /studio/lipsync — Studio Lip Sync shell (placeholder)
// Backend is live; UI will be built in the next phase.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";

function LoadingScreen() {
  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        height:         "calc(100vh - 64px)",
        marginTop:      64,
        background:     "#060B14",
        flexDirection:  "column",
        gap:            16,
      }}
    >
      <div
        style={{
          width:          48,
          height:         48,
          borderRadius:   "50%",
          border:         "2px solid rgba(198,255,0,0.12)",
          borderTopColor: "#C6FF00",
          animation:      "spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: 14, color: "#475569" }}>Loading studio…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LipSyncShell() {
  return (
    <div
      style={{
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        height:          "calc(100vh - 64px)",
        marginTop:       64,
        background:      "#060B14",
        gap:             12,
      }}
    >
      {/* Badge */}
      <div
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          6,
          padding:      "4px 10px",
          borderRadius: 999,
          background:   "rgba(198,255,0,0.10)",
          border:       "1px solid rgba(198,255,0,0.22)",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize:    10,
            fontWeight:  700,
            letterSpacing: "0.08em",
            color:       "#C6FF00",
            textTransform: "uppercase",
          }}
        >
          SYNC
        </span>
      </div>

      <h1
        style={{
          fontSize:   28,
          fontWeight: 600,
          color:      "#F1F5F9",
          margin:     0,
          fontFamily: "var(--font-syne, sans-serif)",
        }}
      >
        LipSyncZ
      </h1>

      <p
        style={{
          fontSize:  14,
          color:     "#64748B",
          margin:    0,
          textAlign: "center",
          maxWidth:  340,
          lineHeight: 1.6,
        }}
      >
        LipSyncZ studio coming next.
        <br />
        Backend is live and ready.
      </p>

      {/* Status dots */}
      <div
        style={{
          display:    "flex",
          gap:        24,
          marginTop:  24,
          padding:    "12px 20px",
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
        }}
      >
        {[
          { label: "Provider",  ok: true  },
          { label: "API Routes", ok: true },
          { label: "Billing",   ok: true  },
          { label: "Storage",   ok: true  },
          { label: "UI",        ok: false },
        ].map(({ label, ok }) => (
          <div
            key={label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width:        8,
                height:       8,
                borderRadius: "50%",
                background:   ok ? "#22C55E" : "#374151",
                boxShadow:    ok ? "0 0 6px rgba(34,197,94,0.5)" : "none",
              }}
            />
            <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LipSyncStudioPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LipSyncShell />
    </Suspense>
  );
}
