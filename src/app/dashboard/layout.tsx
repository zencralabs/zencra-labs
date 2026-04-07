"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, User, CreditCard, Gift, Users, Tag,
  Zap, LogOut, ChevronRight, Settings
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD LAYOUT — User account area with sidebar nav
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/dashboard",              icon: LayoutDashboard, label: "Overview"     },
  { href: "/dashboard/profile",      icon: User,            label: "Profile"      },
  { href: "/dashboard/subscription", icon: CreditCard,      label: "Subscription" },
  { href: "/dashboard/credits",      icon: Zap,             label: "Credits"      },
  { href: "/dashboard/gifts",        icon: Gift,            label: "Gifts"        },
  { href: "/dashboard/referrals",    icon: Users,           label: "Referrals"    },
  { href: "/dashboard/promo",        icon: Tag,             label: "Promo Code"   },
];

const PLAN_COLORS: Record<string, string> = {
  Free:    "#64748B",
  Creator: "#2563EB",
  Studio:  "#A855F7",
  Agency:  "#F59E0B",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  // Redirect to home if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--page-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(37,99,235,0.3)", borderTopColor: "#2563EB", animation: "spin 0.8s linear infinite"  /* defined in globals.css */ }} />
          <p style={{ color: "#475569", fontSize: "13px" }}>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const planColor = PLAN_COLORS[user.plan] ?? "#64748B";
  const creditsPercent = Math.min((user.credits / 100) * 100, 100);
  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", marginTop: "64px", backgroundColor: "var(--page-bg)", color: "var(--page-text)", display: "flex" }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: "260px", flexShrink: 0, backgroundColor: "var(--page-bg-2)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: "64px", height: "calc(100vh - 64px)", overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px", color: "#fff", flexShrink: 0 }}>Z</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#F8FAFC", lineHeight: 1 }}>Zencra Labs</div>
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>Creator Platform</div>
            </div>
          </Link>
        </div>

        {/* User card */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", color: "#fff", flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: planColor, backgroundColor: `${planColor}20`, padding: "1px 7px", borderRadius: "10px", border: `1px solid ${planColor}40` }}>{user.plan}</span>
              </div>
            </div>
          </div>

          {/* Credits mini-bar */}
          <div style={{ marginTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Credits</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#60A5FA" }}>{user.credits}</span>
            </div>
            <div style={{ height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${creditsPercent}%`, borderRadius: "2px", background: "linear-gradient(90deg,#2563EB,#0EA5A0)", transition: "width 0.5s ease" }} />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 12px" }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
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
                  <span style={{ fontSize: "13px" }}>{label}</span>
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
            onClick={logout}
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
      <main style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
