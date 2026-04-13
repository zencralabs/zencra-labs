"use client";

/**
 * /auth/callback
 *
 * Handles two cases:
 *  1. Email verification  — Supabase sends ?token_hash=xxx&type=email
 *     → exchange token → load profile → redirect based on role
 *  2. OAuth redirect      — access_token in URL hash or ?code=xxx
 *     → onAuthStateChange picks it up automatically
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthContext";

export default function AuthCallbackPage() {
  const { user, loading, refreshUser } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type      = searchParams.get("type") as "email" | "recovery" | "invite" | null;
    const code      = searchParams.get("code");

    async function exchange() {
      // ── Case 1: email verification link ───────────────────────────────────
      if (tokenHash && type) {
        setMessage("Verifying your email…");
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setStatus("error");
          setMessage("This verification link has expired or already been used. Please request a new one.");
          setTimeout(() => router.replace("/"), 4000);
          return;
        }
        setStatus("success");
        setMessage("Email verified! Redirecting to your dashboard…");
        await refreshUser();
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { router.replace("/"); return; }
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          router.replace(profile?.role === "admin" ? "/hub" : "/dashboard");
        }, 1500);
        return;
      }

      // ── Case 2: OAuth PKCE code exchange ─────────────────────────────────
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("error");
          setMessage("Sign in failed. Please try again.");
          setTimeout(() => router.replace("/"), 3000);
        }
        return;
      }
      // Case 3: Hash-based OAuth — SDK handles automatically via onAuthStateChange
    }

    exchange();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After OAuth (no token_hash / no code), wait for user then redirect with role check
  useEffect(() => {
    if (loading) return;
    const tokenHash = searchParams.get("token_hash");
    const code      = searchParams.get("code");
    if (!tokenHash && !code && user) {
      const dest = (user as { role?: string }).role === "admin" ? "/hub" : "/dashboard";
      router.replace(dest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const iconColor = status === "success" ? "#10B981" : status === "error" ? "#EF4444" : "#2563EB";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#060D1F", color: "#fff", gap: "20px",
    }}>
      {status === "processing" && (
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.08)",
          borderTopColor: iconColor,
          animation: "spin 0.8s linear infinite",
        }} />
      )}
      {status === "success" && (
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", color: "#10B981",
        }}>✓</div>
      )}
      {status === "error" && (
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", color: "#EF4444",
        }}>✕</div>
      )}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "#F8FAFC", marginBottom: 6 }}>
          {status === "success" ? "You're verified!" : status === "error" ? "Something went wrong" : "One moment…"}
        </p>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", maxWidth: "300px", lineHeight: 1.6 }}>
          {message}
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
