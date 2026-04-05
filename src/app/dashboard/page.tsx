"use client";

import { useRouter } from "next/navigation";
import { Zap, ImageIcon, Video, TrendingUp, Gift, Users, ArrowRight, Clock, Star } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD OVERVIEW — Welcome page after login
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Generate Image",    icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.12)",  href: "/tools/image" },
  { label: "Generate Video",    icon: Video,     color: "#0EA5A0", bg: "rgba(14,165,160,0.12)", href: "/tools/video" },
  { label: "Buy Credits",       icon: Zap,       color: "#A855F7", bg: "rgba(168,85,247,0.12)", href: "/dashboard/credits" },
  { label: "Refer & Earn",      icon: Users,     color: "#F59E0B", bg: "rgba(245,158,11,0.12)", href: "/dashboard/referrals" },
];

const RECENT_ACTIVITY = [
  { action: "Image Generated",  tool: "Nano Banana Pro", time: "2 min ago",   credits: -2,  icon: ImageIcon, color: "#2563EB" },
  { action: "Video Created",    tool: "Kling 3.0",       time: "1 hour ago",  credits: -5,  icon: Video,     color: "#0EA5A0" },
  { action: "Credits Added",    tool: "Top-up",          time: "2 days ago",  credits: +50, icon: Zap,       color: "#A855F7" },
  { action: "Image Generated",  tool: "Flux",            time: "3 days ago",  credits: -2,  icon: ImageIcon, color: "#60A5FA" },
];

const PLAN_FEATURES: Record<string, string[]> = {
  Free:    ["50 welcome credits", "Basic image generation", "720p video output"],
  Creator: ["500 credits/month", "HD image generation", "1080p video output", "Priority queue"],
  Studio:  ["2000 credits/month", "4K image generation", "4K video output", "Priority queue", "API access"],
  Agency:  ["Unlimited credits", "All tools", "White-label exports", "Dedicated support", "API access"],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router   = useRouter();

  if (!user) return null;

  const joinDate    = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const features    = PLAN_FEATURES[user.plan] ?? PLAN_FEATURES.Free;
  const credPct     = Math.min((user.credits / 100) * 100, 100);

  return (
    <div style={{ padding: "40px", maxWidth: "1100px" }}>

      {/* ── WELCOME HEADER ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Star size={16} style={{ color: "#F59E0B" }} />
          <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Member since {joinDate}
          </span>
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>
          Welcome back, {user.name.split(" ")[0]} 👋
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B", marginTop: "6px" }}>
          Here's what's happening with your Zencra account.
        </p>
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {/* Credits card */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Credits</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={14} style={{ color: "#A855F7" }} />
            </div>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>{user.credits}</div>
          <div style={{ height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: "12px" }}>
            <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg,#2563EB,#A855F7)", borderRadius: "2px" }} />
          </div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>credits remaining</div>
        </div>

        {/* Plan card */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(37,99,235,0.2)", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plan</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={14} style={{ color: "#2563EB" }} />
            </div>
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#60A5FA", lineHeight: 1 }}>{user.plan}</div>
          <div style={{ marginTop: "12px" }}>
            {features.slice(0, 2).map(f => (
              <div key={f} style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                <div style={{ width: "3px", height: "3px", borderRadius: "50%", backgroundColor: "#2563EB" }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Referrals */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Referrals</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={14} style={{ color: "#F59E0B" }} />
            </div>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--page-text)", lineHeight: 1 }}>0</div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "8px" }}>
            Earn <span style={{ color: "#F59E0B", fontWeight: 700 }}>20 credits</span> per referral
          </div>
          <button onClick={() => router.push("/dashboard/referrals")}
            style={{ marginTop: "12px", fontSize: "11px", color: "#60A5FA", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            Invite friends <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* ── QUICK ACTIONS ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--page-text)", marginBottom: "14px" }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg, href }) => (
            <button key={label} onClick={() => router.push(href)}
              style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--page-text)" }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RECENT ACTIVITY ────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--page-text)", margin: 0 }}>Recent Activity</h2>
          <button onClick={() => router.push("/dashboard/credits")}
            style={{ fontSize: "12px", color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          {RECENT_ACTIVITY.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderBottom: i < RECENT_ACTIVITY.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} style={{ color: item.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)" }}>{item.action}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{item.tool}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: item.credits > 0 ? "#10B981" : "#F8FAFC" }}>
                    {item.credits > 0 ? `+${item.credits}` : item.credits} cr
                  </div>
                  <div style={{ fontSize: "10px", color: "#334155", display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                    <Clock size={9} /> {item.time}
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
