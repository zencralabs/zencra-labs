"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

/**
 * Studio layout — client-side auth guard.
 * Uses AuthContext (localStorage-backed) so it works with the Supabase
 * browser client. Middleware cannot do this because the browser client
 * stores sessions in localStorage, not cookies.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to home and open the login modal
      const current = window.location.pathname + window.location.search;
      router.push(`/?auth=login&next=${encodeURIComponent(current)}`);
    }
  }, [user, loading, router]);

  // Show spinner while auth state resolves
  if (loading || !user) {
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
