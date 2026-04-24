"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, ImageIcon, Video, TrendingUp, Users, ArrowRight, Clock,
  Star, FolderOpen, Layers, Music, RefreshCw, User2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Actions
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Image Studio",       icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.12)",  href: "/studio/image" },
  { label: "Video Studio",       icon: Video,     color: "#7C3AED", bg: "rgba(124,58,237,0.12)", href: "/studio/video" },
  { label: "Creative Director",  icon: Layers,    color: "#0EA5A0", bg: "rgba(14,165,160,0.12)", href: "/tools/creative-director" },
  { label: "Audio Studio",       icon: Music,     color: "#D97706", bg: "rgba(217,119,6,0.12)",  href: "/studio/audio" },
  { label: "My Projects",        icon: FolderOpen,color: "#10B981", bg: "rgba(16,185,129,0.12)", href: "/dashboard/projects" },
  { label: "Generated Library",  icon: Star,      color: "#F59E0B", bg: "rgba(245,158,11,0.12)", href: "/dashboard/generated" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function txIcon(type: string, metadata: Record<string, unknown> | null): { Icon: React.ElementType; color: string; bg: string } {
  const studio = typeof metadata?.studio === "string" ? metadata.studio : null;

  if (type === "generation" || type === "deduct" || type === "consume") {
    switch (studio) {
      case "image":     return { Icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.14)" };
      case "video":     return { Icon: Video,     color: "#7C3AED", bg: "rgba(124,58,237,0.14)" };
      case "audio":     return { Icon: Music,     color: "#D97706", bg: "rgba(217,119,6,0.14)" };
      case "character": return { Icon: User2,     color: "#F59E0B", bg: "rgba(245,158,11,0.14)" };
      default:          return { Icon: Zap,       color: "#A855F7", bg: "rgba(168,85,247,0.14)" };
    }
  }
  if (type === "topup" || type === "purchase" || type === "grant" || type === "bonus" || type === "refund") {
    return { Icon: Zap, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "trial") {
    return { Icon: Star, color: "#F59E0B", bg: "rgba(245,158,11,0.14)" };
  }
  return { Icon: Zap, color: "#64748B", bg: "rgba(255,255,255,0.06)" };
}

function txLabel(tx: CreditTransaction): { action: string; tool: string } {
  const meta = tx.metadata;
  const studio  = typeof meta?.studio   === "string" ? meta.studio   : null;
  const model   = typeof meta?.modelKey === "string" ? meta.modelKey : null;
  const desc    = tx.description ?? "";

  if (tx.type === "generation" || tx.type === "deduct" || tx.type === "consume") {
    const studioLabel = studio
      ? studio.charAt(0).toUpperCase() + studio.slice(1) + " Generated"
      : "Output Generated";
    return { action: studioLabel, tool: model ?? desc };
  }
  if (tx.type === "topup" || tx.type === "purchase") {
    return { action: "Credits Purchased", tool: desc || "Top-up" };
  }
  if (tx.type === "grant" || tx.type === "bonus") {
    return { action: "Credits Added", tool: desc || "Bonus" };
  }
  if (tx.type === "trial") {
    return { action: "Trial Credits", tool: desc || "Welcome bonus" };
  }
  if (tx.type === "refund") {
    return { action: "Credits Refunded", tool: desc || "Refund" };
  }
  return { action: desc || "Transaction", tool: tx.type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan features config
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  free:     ["Trial credits", "Basic image generation", "720p video output"],
  starter:  ["250 credits/month", "HD image generation", "1080p video output"],
  creator:  ["500 credits/month", "HD image generation", "Priority queue"],
  pro:      ["2 000 credits/month", "4K image generation", "4K video output", "API access"],
  business: ["High-volume credits", "All tools", "White-label exports", "API access"],
  Free:     ["Trial credits", "Basic image generation", "720p video output"],
  Creator:  ["500 credits/month", "HD image generation", "Priority queue"],
  Studio:   ["2 000 credits/month", "4K image generation", "4K video output", "API access"],
  Agency:   ["High-volume credits", "All tools", "White-label exports", "API access"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, session } = useAuth();
  const router            = useRouter();

  const [activity,        setActivity]        = useState<CreditTransaction[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError,   setActivityError]   = useState(false);

  // ── Load recent credit transactions ───────────────────────────────────────
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(false);
    try {
      const { data: { session: live } } = await supabase.auth.getSession();
      const token = live?.access_token ?? session?.access_token;
      if (!token) { setActivityLoading(false); return; }

      const res  = await fetch("/api/credits/history?limit=6", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json() as { success: boolean; data: CreditTransaction[] };
      if (json.success) setActivity(json.data ?? []);
      else setActivityError(true);
    } catch {
      setActivityError(true);
    } finally {
      setActivityLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  if (!user) return null;

  const joinDate = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const planKey  = user.plan ?? "free";
  const features = PLAN_FEATURES[planKey] ?? PLAN_FEATURES.free;
  const credPct  = Math.min((user.credits / Math.max(user.credits, 100)) * 100, 100);

  return (
    <div className="dashboard-content" style={{ maxWidth: "none" }}>

      {/* ── Welcome header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Star size={16} style={{ color: "#F59E0B" }} />
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Member since {joinDate}
          </span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>
          Welcome back, {user.name.split(" ")[0]} 👋
        </h1>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 6 }}>
          Here&apos;s what&apos;s happening with your Zencra account.
        </p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>

        {/* Credits */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Credits</span>
            <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={16} style={{ color: "#A855F7" }} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>{user.credits}</div>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 12 }}>
            <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #2563EB, #A855F7)", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#475569" }}>credits remaining</span>
            <button
              onClick={() => router.push("/dashboard/credits")}
              style={{ fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}
            >
              Buy more <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Plan */}
        <div style={{ borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(37,99,235,0.2)", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plan</span>
            <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={16} style={{ color: "#2563EB" }} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#60A5FA", lineHeight: 1, textTransform: "capitalize" }}>{user.plan}</div>
          <div style={{ marginTop: 12 }}>
            {features.slice(0, 2).map((f) => (
              <div key={f} style={{ fontSize: 11, color: "#64748B", display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#2563EB", flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Referrals */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Referrals</span>
            <div style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} style={{ color: "#F59E0B" }} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>0</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
            Earn <span style={{ color: "#F59E0B", fontWeight: 700 }}>20 credits</span> per referral
          </div>
          <button
            onClick={() => router.push("/dashboard/referrals")}
            style={{ marginTop: 12, fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
          >
            Invite friends <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--page-text)", marginBottom: 14 }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg, href }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              style={{
                backgroundColor: "var(--page-bg-2)", borderRadius: 12, padding: "16px 12px",
                border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${color}40`;
                (e.currentTarget as HTMLElement).style.transform   = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.transform   = "translateY(0)";
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--page-text)", lineHeight: 1.35 }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--page-text)", margin: 0 }}>Recent Activity</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {activityError && (
              <button
                onClick={() => void loadActivity()}
                style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <RefreshCw size={11} /> Retry
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard/credits")}
              style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>

          {/* Loading skeleton */}
          {activityLoading && (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: "40%", borderRadius: 6, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite", marginBottom: 6 }} />
                  <div style={{ height: 11, width: "25%", borderRadius: 5, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
                <div style={{ width: 40, height: 13, borderRadius: 6, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
              </div>
            ))
          )}

          {/* Error */}
          {!activityLoading && activityError && (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              Couldn&apos;t load recent activity.
            </div>
          )}

          {/* Empty */}
          {!activityLoading && !activityError && activity.length === 0 && (
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#475569" }}>No activity yet.</div>
              <button
                onClick={() => router.push("/studio/image")}
                style={{ marginTop: 12, fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Generate your first image →
              </button>
            </div>
          )}

          {/* Transactions */}
          {!activityLoading && !activityError && activity.map((tx, i) => {
            const { Icon, color, bg } = txIcon(tx.type, tx.metadata);
            const { action, tool }    = txLabel(tx);
            const positive            = tx.amount > 0;

            return (
              <div
                key={tx.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 20px",
                  borderBottom: i < activity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action}</div>
                  {tool && <div style={{ fontSize: 12, color: "#475569", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tool}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: positive ? "#10B981" : "#F8FAFC" }}>
                    {positive ? "+" : ""}{tx.amount} cr
                  </div>
                  <div style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3, marginTop: 2, justifyContent: "flex-end" }}>
                    <Clock size={10} /> {timeAgo(tx.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
