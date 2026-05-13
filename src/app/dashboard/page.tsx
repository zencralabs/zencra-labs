"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, ImageIcon, Video, TrendingUp, ArrowRight, Clock,
  Star, FolderOpen, Layers, Music, RefreshCw, User2,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import Shimmer from "@/components/dashboard/Shimmer";

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
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Matches the same lookup in layout.tsx sidebar. Pending billing consolidation (#1307). */
const PLAN_CREDIT_LIMIT: Record<string, number> = {
  free: 100, starter: 600, creator: 1600, pro: 3500, business: 8000,
};

/** Locked Dashboard v2 plan badge colors */
const PLAN_BADGE_COLORS: Record<string, string> = {
  free:     "#64748B",
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

const QUICK_ACTIONS = [
  { label: "Image Studio",      icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.12)",  href: "/studio/image",                          desc: "Generate images" },
  { label: "Video Studio",      icon: Video,     color: "#7C3AED", bg: "rgba(124,58,237,0.12)", href: "/studio/video",                          desc: "Create videos"   },
  { label: "Creative Director", icon: Layers,    color: "#0EA5A0", bg: "rgba(14,165,160,0.12)", href: "/studio/image?mode=creative-director",   desc: "Direct concepts" },
  { label: "Audio Studio",      icon: Music,     color: "#D97706", bg: "rgba(217,119,6,0.12)",  href: "/studio/audio",                          desc: "Generate audio"  },
  { label: "My Projects",       icon: FolderOpen,color: "#10B981", bg: "rgba(16,185,129,0.12)", href: "/dashboard/projects",                   desc: "View projects"   },
  { label: "Library",           icon: Star,      color: "#F59E0B", bg: "rgba(245,158,11,0.12)", href: "/dashboard/library",                    desc: "Your assets"     },
  { label: "Buy Credits",       icon: Zap,       color: "#A855F7", bg: "rgba(168,85,247,0.12)", href: "/dashboard/credits",                    desc: "Top up credits"  },
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
  const meta   = tx.metadata;
  const studio = typeof meta?.studio   === "string" ? meta.studio   : null;
  const model  = typeof meta?.modelKey === "string" ? meta.modelKey : null;
  const desc   = tx.description ?? "";
  if (tx.type === "generation" || tx.type === "deduct" || tx.type === "consume") {
    const studioLabel = studio
      ? studio.charAt(0).toUpperCase() + studio.slice(1) + " Generated"
      : "Output Generated";
    return { action: studioLabel, tool: model ?? desc };
  }
  if (tx.type === "topup" || tx.type === "purchase") return { action: "Credits Purchased", tool: desc || "Top-up" };
  if (tx.type === "grant" || tx.type === "bonus")   return { action: "Credits Added",    tool: desc || "Bonus"  };
  if (tx.type === "trial")                          return { action: "Trial Credits",    tool: desc || "Welcome bonus" };
  if (tx.type === "refund")                         return { action: "Credits Refunded", tool: desc || "Refund" };
  return { action: desc || "Transaction", tool: tx.type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, session } = useAuth();
  const router            = useRouter();

  const [activity,        setActivity]        = useState<CreditTransaction[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError,   setActivityError]   = useState(false);

  // ── Load recent credit transactions ─────────────────────────────────────────
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

  const joinDate  = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const planKey   = (user.plan ?? "free").toLowerCase();
  const credLimit = PLAN_CREDIT_LIMIT[planKey] ?? 600;
  const credPct   = Math.min((user.credits / credLimit) * 100, 100);
  const planColor = PLAN_BADGE_COLORS[planKey] ?? "#64748B";
  const firstName = user.name?.split(" ")[0] ?? "Creator";

  // ── Shared card style ────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div
      className="dashboard-content"
      style={{ maxWidth: "none", minHeight: "calc(100vh - 64px)", paddingBottom: 56 }}
    >

      {/* ── 1. Welcome Command Strip ────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.07) 0%, rgba(14,165,160,0.05) 100%)",
          border: "1px solid rgba(37,99,235,0.14)",
          borderRadius: 18,
          padding: "24px 28px",
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        {/* Left: greeting */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #0EA5A0)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>
              Member since {joinDate}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--page-text)", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 6, fontFamily: "var(--font-sans)" }}>
            Your Zencra creator workspace
          </p>
        </div>

        {/* Right: credits + plan badge + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {/* Credits count */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {user.credits.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 500, marginTop: 3, fontFamily: "var(--font-sans)" }}>credits remaining</div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* Plan badge */}
          <div style={{
            background: `${planColor}1A`,
            border: `1px solid ${planColor}44`,
            borderRadius: 10,
            padding: "8px 14px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: "var(--font-sans)" }}>Plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", color: planColor, fontFamily: "var(--font-display)", letterSpacing: "-0.01em", marginTop: 2 }}>
              {user.plan}
            </div>
          </div>

          {/* Buy Credits CTA */}
          <button
            onClick={() => router.push("/dashboard/credits")}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
              border: "none",
              borderRadius: 11,
              padding: "12px 20px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            Buy Credits
          </button>
        </div>
      </div>

      {/* ── 2. Stat Cards — 4 columns ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>

        {/* Credits */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Credits</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(168,85,247,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={15} style={{ color: "#A855F7" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {user.credits.toLocaleString()}
          </div>
          <div style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 12 }}>
            <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #2563EB, #A855F7)", borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-sans)" }}>{Math.round(credPct)}% of {credLimit.toLocaleString()} limit</span>
            <button
              onClick={() => router.push("/dashboard/credits")}
              style={{ fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, padding: 0 }}
            >
              Top up <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Plan */}
        <div style={{ borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(37,99,235,0.18)", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Plan</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={15} style={{ color: "#2563EB" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#60A5FA", lineHeight: 1, textTransform: "capitalize", letterSpacing: "-0.02em" }}>
            {user.plan}
          </div>
          <button
            onClick={() => router.push("/dashboard/subscription")}
            style={{ marginTop: 12, fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-sans)" }}
          >
            Manage plan <ArrowRight size={10} />
          </button>
        </div>

        {/* Recent Activity */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Activity</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(16,185,129,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={15} style={{ color: "#10B981" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {activityLoading ? "—" : activity.length}
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 12, fontFamily: "var(--font-sans)" }}>
            recent transactions
          </div>
        </div>

        {/* Projects — deferred */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-sans)" }}>Projects</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(14,165,160,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderOpen size={15} style={{ color: "#0EA5A0" }} />
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.02em" }}>
            —
          </div>
          <button
            onClick={() => router.push("/dashboard/projects")}
            style={{ marginTop: 12, fontSize: 11, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-sans)" }}
          >
            View projects <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {/* ── 3. Quick Create ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--page-text)", margin: 0, letterSpacing: "-0.01em" }}>
              Quick Create
            </h2>
            <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0", fontFamily: "var(--font-sans)" }}>Jump into any studio</p>
          </div>
        </div>
        {/* 7-column grid — all actions fit without wrapping */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
          {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg, href, desc }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              style={{
                backgroundColor: "var(--page-bg-2)",
                borderRadius: 13,
                padding: "16px 12px",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${color}55`;
                el.style.boxShadow   = `0 0 18px ${color}18`;
                el.style.transform   = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.06)";
                el.style.boxShadow   = "none";
                el.style.transform   = "translateY(0)";
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--page-text)", lineHeight: 1.3, fontFamily: "var(--font-sans)" }}>{label}</div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 3, fontFamily: "var(--font-sans)" }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Main 2-column — Recent Activity + Plan Panel ──────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* Recent Activity */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--page-text)", margin: 0, letterSpacing: "-0.01em" }}>
                Recent Activity
              </h2>
              <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0", fontFamily: "var(--font-sans)" }}>Your latest credit transactions</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {activityError && (
                <button
                  onClick={() => void loadActivity()}
                  style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
                >
                  <RefreshCw size={11} /> Retry
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard/credits")}
                style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div style={{ ...card, overflow: "hidden" }}>

            {/* Loading skeleton */}
            {activityLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <Shimmer className="w-9 h-9 flex-shrink-0" rounded="rounded-[10px]" />
                <div style={{ flex: 1 }}>
                  <Shimmer className="h-3 w-2/5 mb-2" />
                  <Shimmer className="h-2.5 w-1/4" />
                </div>
                <Shimmer className="h-3 w-10" />
              </div>
            ))}

            {/* Error */}
            {!activityLoading && activityError && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#475569", fontFamily: "var(--font-sans)" }}>Couldn&apos;t load recent activity.</div>
                <button
                  onClick={() => void loadActivity()}
                  style={{ marginTop: 10, fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)" }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty */}
            {!activityLoading && !activityError && activity.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <ImageIcon size={20} style={{ color: "#2563EB" }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--page-text)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>No activity yet</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 14, fontFamily: "var(--font-sans)" }}>Generate your first output to see activity here.</div>
                <button
                  onClick={() => router.push("/studio/image")}
                  style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Open Image Studio <ChevronRight size={12} />
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
                    padding: "15px 20px",
                    borderBottom: i < activity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>{action}</div>
                    {tool && <div style={{ fontSize: 11, color: "#475569", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>{tool}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: positive ? "#10B981" : "#DBEAFE", letterSpacing: "-0.01em" }}>
                      {positive ? "+" : ""}{tx.amount.toLocaleString()} cr
                    </div>
                    <div style={{ fontSize: 11, color: "#334155", display: "flex", alignItems: "center", gap: 3, marginTop: 2, justifyContent: "flex-end", fontFamily: "var(--font-sans)" }}>
                      <Clock size={10} /> {timeAgo(tx.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan & Credits Side Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Plan + Credits card */}
          <div style={{ ...card, padding: "22px 22px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--page-text)", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
              Plan &amp; Credits
            </h3>

            {/* Plan name */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#475569", fontFamily: "var(--font-sans)" }}>Current plan</span>
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: "capitalize",
                color: planColor, fontFamily: "var(--font-display)",
                background: `${planColor}18`,
                border: `1px solid ${planColor}33`,
                borderRadius: 6, padding: "3px 9px",
              }}>
                {user.plan}
              </span>
            </div>

            {/* Credits bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-sans)" }}>Credits</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.01em" }}>
                  {user.credits.toLocaleString()} / {credLimit.toLocaleString()}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #2563EB, #A855F7)", borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 5, fontFamily: "var(--font-sans)" }}>
                {Math.round(100 - credPct)}% available
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => router.push("/dashboard/credits")}
                style={{
                  width: "100%", background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
                  border: "none", borderRadius: 10, padding: "11px 16px",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "var(--font-display)", letterSpacing: "-0.01em", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                Buy Credits
              </button>
              {planKey !== "business" && (
                <button
                  onClick={() => router.push("/dashboard/subscription")}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px",
                    color: "#94A3B8", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-sans)", transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.15)"; el.style.color = "#E2E8F0"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "#94A3B8"; }}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>

          {/* Support card */}
          <div style={{ ...card, padding: "18px 20px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--page-text)", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
              Need help?
            </h3>
            <p style={{ fontSize: 11, color: "#475569", margin: "0 0 14px", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
              Questions about your plan or credits? Our team is here.
            </p>
            <a
              href="mailto:support@zencralabs.com"
              style={{ fontSize: 12, color: "#60A5FA", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-sans)" }}
            >
              Contact support <ChevronRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
