"use client";

import { useAuth } from "@/components/auth/AuthContext";

/**
 * Studio layout — Phase A: public preview access.
 * Guests (signed-out users) may open studio pages to browse the UI.
 * Generation, upload, and dispatch remain server-hardened via API routes.
 *
 * Auth protection for generation actions is handled at the Generate button
 * level (Phase B). Middleware does not guard /studio/* routes — auth is
 * localStorage-backed via the Supabase browser client.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  // Show spinner only while auth state resolves (brief flash on first load).
  // Once resolved, render children regardless of whether user is signed in.
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#060C1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "3px solid rgba(37,99,235,0.3)",
          borderTopColor: "#2563EB",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "#475569", fontSize: "13px" }}>Loading studio…</p>
      </div>
    );
  }

  return <>{children}</>;
}
