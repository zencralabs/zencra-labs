"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth() as { user: { role?: string } | null; loading: boolean };
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/?auth=login&next=/hub");
      return;
    }
    if ((user as { role?: string }).role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user || (user as { role?: string }).role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#060D1F" }}>
        <div className="flex flex-col items-center gap-4">
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #2563EB", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#475569", fontSize: 14 }}>Verifying access…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
