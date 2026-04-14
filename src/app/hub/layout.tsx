"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Hub Layout — Premium sidebar navigation
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview",      label: "Overview",       icon: GridIcon,         href: "/hub" },
  { id: "users",         label: "Users",          icon: UsersIcon,        href: "/hub/users" },
  { id: "generations",   label: "Generations",    icon: SparklesIcon,     href: "/hub/generations" },
  { id: "tools",         label: "Tools",          icon: WrenchIcon,       href: "/hub/tools" },
  { id: "revenue",       label: "Revenue",        icon: DollarIcon,       href: "/hub/revenue" },
  { id: "credits",       label: "Credits",        icon: CoinIcon,         href: "/hub/credits" },
  { id: "subscriptions", label: "Subscriptions",  icon: CardIcon,         href: "/hub/subscriptions" },
  { id: "referrals",     label: "Referrals",      icon: ShareIcon,        href: "/hub/referrals" },
  { id: "gallery",       label: "Gallery",        icon: ImageIcon,        href: "/hub/gallery" },
  { id: "promos",        label: "Promo Codes",    icon: TagIcon,          href: "/hub/promos" },
  { id: "reports",       label: "Reports",        icon: ChartIcon,        href: "/hub/reports" },
  { id: "settings",      label: "Settings",       icon: GearIcon,         href: "/hub/settings" },
];

// ── SVG icons ─────────────────────────────────────────────────────────────────
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function SparklesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
}
function WrenchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}
function DollarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function CoinIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 9H9"/></svg>;
}
function CardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}
function ShareIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
function ImageIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function TagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function GearIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function LogOutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function ChevronIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function MenuIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}

// ── Avatar / initials ──────────────────────────────────────────────────────────
function AdminAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2"];
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const color = COLORS[name.charCodeAt(0) % COLORS.length];
  if (avatar) {
    return <img src={avatar} alt={name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

const SIDEBAR_W = 240;
const TOPBAR_H  = 56;

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/?auth=login&next=/hub"); return; }
    if (user.role !== "admin") { router.replace("/dashboard"); }
  }, [user, loading, router]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading || !user || user.role !== "admin") {
    return (
      // Fixed overlay — covers the public navbar/footer from root layout
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "#060D1F" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.08)", borderTopColor: "#2563EB", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>Verifying admin access…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sidebarWidth = collapsed ? 64 : SIDEBAR_W;

  function isActive(href: string) {
    if (href === "/hub") return pathname === "/hub";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    // Fixed full-screen overlay — completely replaces root layout's navbar/footer for admin
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", background: "#060D1F", color: "#F8FAFC", overflow: "hidden" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarWidth, height: "100%",
        background: "#0A1628",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        flexShrink: 0,
        zIndex: 50,
        transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
      }}>
        {/* Logo area */}
        <div style={{ height: TOPBAR_H, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" stroke="white" strokeWidth="1.5" fill="none"/>
              <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" stroke="white" strokeWidth="1" fill="rgba(255,255,255,0.15)"/>
            </svg>
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", letterSpacing: "-0.01em" }}>Zencra</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "10px 0" : "9px 14px", margin: "1px 8px", borderRadius: 8, textDecoration: "none", color: active ? "#F8FAFC" : "rgba(255,255,255,0.5)", background: active ? "rgba(37,99,235,0.15)" : "transparent", borderLeft: active ? "2px solid #2563EB" : "2px solid transparent", transition: "all 0.15s ease", justifyContent: collapsed ? "center" : "flex-start", position: "relative", cursor: "pointer" }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; } }}
              >
                <span style={{ flexShrink: 0, color: active ? "#2563EB" : "inherit" }}><Icon /></span>
                {!collapsed && <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden" }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", flexShrink: 0 }}>
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button onClick={() => setUserMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: collapsed ? "8px 0" : "8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "#F8FAFC", justifyContent: collapsed ? "center" : "flex-start" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)") }
              onMouseLeave={e => (e.currentTarget.style.background = "transparent") }
            >
              <AdminAvatar name={user.name} avatar={user.avatar} />
              {!collapsed && (
                <div style={{ flex: 1, overflow: "hidden", textAlign: "left" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#F8FAFC", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                </div>
              )}
              {!collapsed && <span style={{ opacity: 0.4, flexShrink: 0 }}><ChevronIcon /></span>}
            </button>

            {/* User dropdown */}
            {userMenuOpen && (
              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, background: "#0F1D35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100 }}>
                <Link href="/hub/settings" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <GearIcon /> Settings
                </Link>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", width: "100%", background: "transparent", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 13, textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOutIcon /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", transition: "all 0.22s cubic-bezier(.4,0,.2,1)" }}>
        {/* Top bar */}
        <header style={{ height: TOPBAR_H, background: "#0A1628", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 40, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setCollapsed(c => !c)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            >
              <MenuIcon />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              {/* Breadcrumb */}
              {NAV_ITEMS.find(n => isActive(n.href)) && (
                <>
                  <span>Admin</span>
                  <span>/</span>
                  <span style={{ color: "#F8FAFC", fontWeight: 500 }}>{NAV_ITEMS.find(n => isActive(n.href))?.label}</span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
              <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600, letterSpacing: "0.05em" }}>LIVE</span>
            </div>
            <Link href="/" target="_blank" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.09)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View Site
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px" }}>
          {children}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
