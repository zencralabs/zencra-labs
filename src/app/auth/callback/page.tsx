"use client";

/**
 * /auth/callback — OAuth redirect landing page
 *
 * After Google / Apple / Facebook sign-in, Supabase redirects the browser here
 * with either a code (PKCE) or an access_token in the URL hash.
 * The existing onAuthStateChange listener in AuthContext picks it up
 * automatically and sets the user session.
 *
 * This page simply waits for auth state, then sends the user to the dashboard.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

export default function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Supabase has finished auth resolution
    router.replace(user ? "/dashboard" : "/");
  }, [user, loading, router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#060D1F", color: "#fff", gap: "16px",
    }}>
      {/* Animated spinner */}
      <div style={{
        width: "40px", height: "40px", borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.1)",
        borderTopColor: "#2563EB",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
        Completing sign in…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
