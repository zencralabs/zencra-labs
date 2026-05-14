"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, User, CreditCard, Gift, Users, Tag,
  Zap, LogOut, ChevronRight, Settings, FolderOpen, Library,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import AccountCompletionBanner from "@/components/auth/AccountCompletionBanner";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD LAYOUT — User account area with sidebar nav
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/dashboard",              icon: LayoutDashboard, label: "Overview"     },
  { href: "/dashboard/projects",     icon: FolderOpen,      label: "Projects"     },
  { href: "/dashboard/library",       icon: Library,         label: "Library"      },
  { href: "/dashboard/profile",      icon: User,            label: "Profile"      },
  { href: "/dashboard/subscription", icon: CreditCard,      label: "Subscription" },
  { href: "/dashboard/credits",      icon: Zap,             label: "Credits"      },
  { href: "/dashboard/gifts",        icon: Gift,            label: "Gifts"        },
  { href: "/dashboard/referrals",    icon: Users,           label: "Referrals"    },
  { href: "/dashboard/promo",        icon: Tag,             label: "Promo Code"   },
];

const PLAN_COLORS: Record<string, string> = {
  free:     "#64748B",
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  // Redirect to sign-in if session is gone
  useEffect(() => {
    if (!loading && !user) {
      // Brief delay so the "session expired" message is visible
      const t = setTimeout(() => router.push("/login"), 1800);
      return () => clearTimeout(t);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--page-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(37,99,235,0.3)", borderTopColor: "#2563EB", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#475569", fontSize: "13px" }}>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--page-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: 14, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={22} style={{ color: "#2563EB" }} />
          </div>
          <div>
            <p style={{ color: "#F8FAFC", fontSize: "15px", fontWeight: 700, margin: "0 0 6px" }}>Session expired</p>
            <p style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>Signing you back in…</p>
          </div>
        </div>
      </div>
    );
  }

  const planColor = PLAN_COLORS[user.plan] ?? "#64748B";
  const isFree    = (user.plan ?? "free").toLowerCase() === "free";

  // Free users are governed by free_usage counters (images_max=10, videos_max=3), not credits.
  // NOTE: public.plans.credits_per_cycle in the DB currently holds stale values
  // (200/800/1700/4000) — a DB correction migration is pending (billing consolidation).
  // TODO: replace with an API-backed fetch once a /api/plan-limits route exists.
  const PLAN_CREDIT_LIMIT: Record<string, number> = {
    starter:  600,
    creator:  1600,
    pro:      3500,
    business: 8000,
  };
  const creditLimit    = isFree ? 0 : (PLAN_CREDIT_LIMIT[user.plan?.toLowerCase() ?? ""] ?? 600);
  const creditsPercent = isFree ? 0 : Math.min((user.credits / creditLimit) * 100, 100);

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", marginTop: "64px", backgroundColor: "var(--page-bg)", color: "var(--page-text)", display: "flex" }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: "260px", flexShrink: 0, backgroundColor: "var(--page-bg-2)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: "64px", height: "calc(100vh - 64px)", overflowY: "auto",
      }}>
        {/* User card */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ marginBottom: "2px" }}>
            <div style={{ fontWeight: 500, fontSize: "12px", color: "#475569", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@handle</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", color: planColor, backgroundColor: `${planColor}14`, padding: "3px 10px", borderRadius: "20px", border: `1px solid ${planColor}35` }}>
                {`${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} Plan`}
              </span>
            </div>
          </div>

          {/* Credits mini-bar / Free Trial */}
          {isFree ? (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "10px", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Free Trial</div>
              <div style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>10 Nano Banana images</div>
              <div style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>3 Kling video generations</div>
              <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px" }}>50 bonus credits</div>
            </div>
          ) : (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Credits</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.01em" }}>{user.credits.toLocaleString()}</span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${creditsPercent}%`, borderRadius: "2px", background: "linear-gradient(90deg,#2563EB,#0EA5A0)", transition: "width 0.5s ease" }} />
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 12px" }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            // Projects detail pages (/dashboard/project/[id]) highlight the Projects nav item
          const active = pathname === href ||
            (href === "/dashboard/projects" && pathname.startsWith("/dashboard/project/")) ||
            (href === "/dashboard/library" && pathname === "/dashboard/generated");
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 12px", borderRadius: "10px", marginBottom: "2px",
                  backgroundColor: active ? "rgba(37,99,235,0.15)" : "transparent",
                  color: active ? "#60A5FA" : "#64748B",
                  transition: "all 0.15s", cursor: "pointer",
                  border: active ? "1px solid rgba(37,99,235,0.2)" : "1px solid transparent",
                  fontWeight: active ? 600 : 400,
                }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#64748B"; } }}
                >
                  <Icon size={16} />
                  <span style={{ fontSize: "14px" }}>{label}</span>
                  {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#64748B", cursor: "pointer", marginBottom: "2px" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
            >
              <Settings size={16} />
              <span style={{ fontSize: "13px" }}>Settings</span>
            </div>
          </Link>
          <div
            onClick={() => { void logout(); }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#EF4444", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <LogOut size={16} />
            <span style={{ fontSize: "13px", fontWeight: 500 }}>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <AccountCompletionBanner />
        {children}
      </main>
    </div>
  );
}
