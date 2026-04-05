"use client";

import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, Wrench, BarChart3, Settings, Bell,
  LogOut, Search, ChevronDown, TrendingUp, TrendingDown, ArrowRight,
  Eye, Edit3, Trash2, Plus, Filter, Download, CheckCircle, XCircle,
  Clock, Zap, Star, Building2, ImageIcon, Video, Music, Globe,
  Shield, CreditCard, Mail, Activity, RefreshCw, MoreVertical,
  ChevronLeft, ChevronRight, AlertCircle, UserCheck, UserX,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS — ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock data ────────────────────────────────────────────────────────────────
const stats = [
  { label: "Total Users",     value: "2,847",  change: "+12.4%", up: true,  icon: Users,      color: "#2563EB" },
  { label: "Active Today",    value: "418",    change: "+8.1%",  up: true,  icon: Activity,   color: "#0EA5A0" },
  { label: "MRR",             value: "$9,240", change: "+21.3%", up: true,  icon: CreditCard, color: "#A855F7" },
  { label: "Generations",     value: "84,302", change: "+34.7%", up: true,  icon: Zap,        color: "#F59E0B" },
  { label: "Churn Rate",      value: "2.1%",   change: "-0.4%",  up: false, icon: TrendingDown, color: "#EF4444" },
  { label: "Support Tickets", value: "17",     change: "-5",     up: false, icon: Mail,       color: "#F97316" },
];

const recentUsers = [
  { id: 1, name: "Sarah Chen",    email: "sarah@designco.io",  plan: "Studio",  joined: "2 min ago",   status: "active",   avatar: "#2563EB", gens: 342 },
  { id: 2, name: "Marcus Webb",   email: "marcus@webb.dev",    plan: "Creator", joined: "14 min ago",  status: "active",   avatar: "#0EA5A0", gens: 89  },
  { id: 3, name: "Priya Nair",    email: "priya@nair.studio",  plan: "Free",    joined: "1 hr ago",    status: "active",   avatar: "#A855F7", gens: 5   },
  { id: 4, name: "James Ortega",  email: "james@ortega.co",    plan: "Creator", joined: "3 hrs ago",   status: "suspended",avatar: "#EF4444", gens: 210 },
  { id: 5, name: "Aiko Tanaka",   email: "aiko@tanaka.media",  plan: "Studio",  joined: "5 hrs ago",   status: "active",   avatar: "#F59E0B", gens: 891 },
  { id: 6, name: "Dev Patel",     email: "dev@aiworks.io",     plan: "Agency",  joined: "1 day ago",   status: "pending",  avatar: "#10B981", gens: 0   },
  { id: 7, name: "Chloe Martin",  email: "chloe@visuals.fr",   plan: "Free",    joined: "1 day ago",   status: "active",   avatar: "#F97316", gens: 3   },
  { id: 8, name: "Leon Fischer",  email: "leon@studio-3d.de",  plan: "Creator", joined: "2 days ago",  status: "active",   avatar: "#C084FC", gens: 67  },
];

const allUsers = [
  ...recentUsers,
  { id: 9,  name: "Nina Rossi",    email: "nina@rossi.it",      plan: "Studio",  joined: "3 days ago",  status: "active",   avatar: "#60A5FA", gens: 1204 },
  { id: 10, name: "Omar Khalid",   email: "omar@khalid.ae",     plan: "Creator", joined: "4 days ago",  status: "active",   avatar: "#34D399", gens: 156  },
  { id: 11, name: "Yuki Sato",     email: "yuki@sato.jp",       plan: "Free",    joined: "5 days ago",  status: "inactive", avatar: "#FB7185", gens: 0    },
  { id: 12, name: "Tom Bradley",   email: "tom@bradley.uk",     plan: "Studio",  joined: "6 days ago",  status: "active",   avatar: "#818CF8", gens: 444  },
];

const blogPosts = [
  { id: 1, title: "AI Video Generation Guide 2025",         status: "published", views: 3204, date: "Mar 28, 2025", category: "Tutorial"  },
  { id: 2, title: "The Future of AI Creative Platforms",    status: "published", views: 1879, date: "Apr 01, 2025", category: "Insights"  },
  { id: 3, title: "How to Create Stunning AI Portraits",    status: "draft",     views: 0,    date: "Apr 04, 2025", category: "Tutorial"  },
  { id: 4, title: "Zencra Labs Product Roadmap 2025",       status: "scheduled", views: 0,    date: "Apr 10, 2025", category: "News"      },
];

const tools = [
  { id: 1, name: "Nano Banana Pro", category: "Image", status: "live",    users: 1204, badge: "HOT",  color: "#2563EB" },
  { id: 2, name: "Kling 3.0",       category: "Video", status: "live",    users: 987,  badge: "HOT",  color: "#0EA5A0" },
  { id: 3, name: "Google Veo",      category: "Video", status: "live",    users: 742,  badge: "NEW",  color: "#60A5FA" },
  { id: 4, name: "ChatGPT Image",   category: "Image", status: "live",    users: 634,  badge: "NEW",  color: "#10B981" },
  { id: 5, name: "ElevenLabs",      category: "Audio", status: "live",    users: 521,  badge: null,   color: "#A855F7" },
  { id: 6, name: "Runway ML",       category: "Video", status: "live",    users: 489,  badge: null,   color: "#A855F7" },
  { id: 7, name: "Flux",            category: "Image", status: "live",    users: 401,  badge: null,   color: "#EF4444" },
  { id: 8, name: "Midjourney",      category: "Image", status: "soon",    users: 0,    badge: "SOON", color: "#64748B" },
  { id: 9, name: "Luma AI",         category: "Video", status: "soon",    users: 0,    badge: "SOON", color: "#64748B" },
];

const activityFeed = [
  { icon: UserCheck, color: "#10B981", text: "Sarah Chen upgraded to Studio plan",  time: "2m ago"  },
  { icon: Zap,       color: "#F59E0B", text: "84,302nd generation milestone hit",   time: "12m ago" },
  { icon: UserX,     color: "#EF4444", text: "James Ortega account suspended",      time: "1h ago"  },
  { icon: Star,      color: "#2563EB", text: "Dev Patel joined Agency waitlist",    time: "1d ago"  },
  { icon: Globe,     color: "#0EA5A0", text: "Blog post published — Video Guide",   time: "1d ago"  },
  { icon: AlertCircle, color: "#F97316", text: "17 open support tickets",           time: "now"     },
];

const planColors: Record<string, string> = {
  Free: "#64748B", Creator: "#2563EB", Studio: "#0EA5A0", Agency: "#A855F7",
};

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Active"    },
  suspended: { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  label: "Suspended" },
  pending:   { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Pending"   },
  inactive:  { color: "#64748B", bg: "rgba(100,116,139,0.12)",label: "Inactive"  },
};

type NavItem = "dashboard" | "users" | "blog" | "tools" | "analytics" | "settings";

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState<NavItem>("dashboard");
  const [userSearch, setUserSearch]     = useState("");
  const [userFilter, setUserFilter]     = useState("all");
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [notifOpen, setNotifOpen]       = useState(false);

  const navItems: { id: NavItem; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
    { id: "users",      label: "Users",      icon: Users,      badge: "2,847" },
    { id: "blog",       label: "Blog",       icon: FileText,   badge: "4"     },
    { id: "tools",      label: "Tools",      icon: Wrench,     badge: "9"     },
    { id: "analytics",  label: "Analytics",  icon: BarChart3              },
    { id: "settings",   label: "Settings",   icon: Settings               },
  ];

  const filteredUsers = allUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchFilter = userFilter === "all" || u.plan.toLowerCase() === userFilter || u.status === userFilter;
    return matchSearch && matchFilter;
  });

  // ── shared colours ───────────────────────────────────────────────────────
  const C = {
    bg:       "#080E1C",
    sidebar:  "#0A1020",
    card:     "#0D1526",
    border:   "rgba(255,255,255,0.06)",
    text:     "#F8FAFC",
    muted:    "#64748B",
    accent:   "#2563EB",
  };

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 64px)", marginTop: "64px", backgroundColor: "var(--page-bg)", color: "var(--page-text)", fontFamily: "inherit" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarOpen ? "240px" : "72px",
          height: "calc(100vh - 64px)",
          position: "sticky",
          top: "64px",
          backgroundColor: "var(--page-bg-2)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          flexShrink: 0,
          zIndex: 40,
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
            background: "linear-gradient(135deg, #2563EB, #0EA5A0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "15px", color: "#fff",
          }}>Z</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.02em" }}>Zencra Labs</div>
              <div style={{ fontSize: "10px", color: C.muted, letterSpacing: "0.1em" }}>ADMIN</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, padding: "4px", borderRadius: "6px" }}
          >
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: sidebarOpen ? "10px 12px" : "10px",
                  borderRadius: "10px", border: "none", cursor: "pointer",
                  background: active ? "rgba(37,99,235,0.15)" : "transparent",
                  color: active ? "#60A5FA" : C.muted,
                  fontWeight: active ? 600 : 400,
                  fontSize: "13.5px",
                  transition: "all 0.15s",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  position: "relative",
                  outline: "none",
                  width: "100%",
                  boxShadow: active ? "inset 0 0 0 1px rgba(37,99,235,0.3)" : "none",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
                {sidebarOpen && item.badge && (
                  <span style={{
                    background: active ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)",
                    color: active ? "#93C5FD" : C.muted,
                    borderRadius: "20px", padding: "1px 7px", fontSize: "10px", fontWeight: 600,
                  }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}` }}>
          <button style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: sidebarOpen ? "10px 12px" : "10px",
            borderRadius: "10px", border: "none", cursor: "pointer",
            background: "transparent", color: C.muted, fontSize: "13px",
            width: "100%", justifyContent: sidebarOpen ? "flex-start" : "center",
            transition: "all 0.15s", outline: "none",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = C.muted; }}
          >
            <LogOut size={16} />
            {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <header style={{
          height: "64px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", padding: "0 28px", gap: "16px",
          backgroundColor: "var(--page-bg-2)", flexShrink: 0,
          position: "sticky", top: 0, zIndex: 30,
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              {navItems.find(n => n.id === activeNav)?.label}
            </h1>
            <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>
              {activeNav === "dashboard" && "Welcome back, Jai — here's what's happening today."}
              {activeNav === "users"     && `${allUsers.length} total users registered`}
              {activeNav === "blog"      && "Manage your blog posts and content"}
              {activeNav === "tools"     && "Manage platform tool integrations"}
              {activeNav === "analytics" && "Platform performance overview"}
              {activeNav === "settings"  && "Platform configuration & preferences"}
            </p>
          </div>

          {/* Global search */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "8px 14px", width: "220px",
          }}>
            <Search size={14} style={{ color: C.muted, flexShrink: 0 }} />
            <input
              placeholder="Search…"
              style={{ background: "none", border: "none", outline: "none", color: "var(--page-text)", fontSize: "13px", width: "100%" }}
            />
          </div>

          {/* Notifications */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                borderRadius: "10px", padding: "8px", cursor: "pointer", color: C.muted,
                display: "flex", position: "relative",
              }}
            >
              <Bell size={16} />
              <span style={{
                position: "absolute", top: "6px", right: "6px",
                width: "7px", height: "7px", borderRadius: "50%",
                background: "#EF4444", border: `1.5px solid ${C.sidebar}`,
              }} />
            </button>
            {notifOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: "300px", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "14px", padding: "16px", zIndex: 100,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "12px", color: C.muted, letterSpacing: "0.08em" }}>NOTIFICATIONS</p>
                {activityFeed.slice(0, 4).map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={13} style={{ color: item.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "12px", margin: 0, color: "var(--page-text)", lineHeight: 1.4 }}>{item.text}</p>
                        <p style={{ fontSize: "10px", color: C.muted, margin: "2px 0 0" }}>{item.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #A855F7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "13px", color: "#fff",
            }}>J</div>
            <div style={{ lineHeight: 1.3 }}>
              <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>Jai</p>
              <p style={{ fontSize: "10px", color: C.muted, margin: 0 }}>Super Admin</p>
            </div>
            <ChevronDown size={13} style={{ color: C.muted }} />
          </div>
        </header>

        {/* ── PAGE CONTENT ────────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: "28px", overflowY: "auto" }}>

          {/* ════════════════════════════════════════════════════════════════
               DASHBOARD
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div>
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                {stats.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: "14px", padding: "20px 22px",
                      display: "flex", flexDirection: "column", gap: "12px",
                      transition: "border-color 0.2s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${s.color}40`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} style={{ color: s.color }} />
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px",
                          background: s.up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                          color: s.up ? "#34D399" : "#FCA5A5",
                          display: "flex", alignItems: "center", gap: "3px",
                        }}>
                          {s.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {s.change}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 2px", color: "var(--page-text)" }}>{s.value}</p>
                        <p style={{ fontSize: "12px", color: C.muted, margin: 0 }}>{s.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Two-column: recent users + activity */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>

                {/* Recent signups */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "22px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Recent Signups</p>
                    <button
                      onClick={() => setActiveNav("users")}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      View all <ArrowRight size={12} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {recentUsers.slice(0, 6).map(user => (
                      <div key={user.id} style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "10px", borderRadius: "10px", transition: "background 0.15s",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div style={{
                          width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                          background: `linear-gradient(135deg, ${user.avatar}, ${user.avatar}88)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "12px", color: "#fff",
                        }}>{user.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
                          <p style={{ fontSize: "11px", color: C.muted, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", background: `${planColors[user.plan]}18`, color: planColors[user.plan], flexShrink: 0 }}>{user.plan}</span>
                        <span style={{ fontSize: "11px", color: C.muted, flexShrink: 0, minWidth: "55px", textAlign: "right" }}>{user.joined}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity feed */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "22px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "18px" }}>Live Activity</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {activityFeed.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={14} style={{ color: item.color }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: "12.5px", margin: "0 0 2px", color: "var(--page-text)", lineHeight: 1.4 }}>{item.text}</p>
                            <p style={{ fontSize: "10px", color: C.muted, margin: 0 }}>{item.time}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick actions row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "20px" }}>
                {[
                  { label: "Add Blog Post",    icon: Plus,       color: "#2563EB", action: () => setActiveNav("blog")      },
                  { label: "Manage Tools",     icon: Wrench,     color: "#0EA5A0", action: () => setActiveNav("tools")     },
                  { label: "View Users",       icon: Users,      color: "#A855F7", action: () => setActiveNav("users")     },
                  { label: "Platform Settings",icon: Settings,   color: "#F59E0B", action: () => setActiveNav("settings")  },
                ].map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button key={i} onClick={a.action} style={{
                      background: `${a.color}10`, border: `1px solid ${a.color}25`,
                      borderRadius: "12px", padding: "16px", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px",
                      transition: "all 0.15s", outline: "none",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}18`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}50`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}10`; (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`; }}
                    >
                      <Icon size={18} style={{ color: a.color }} />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)" }}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
               USERS
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "users" && (
            <div>
              {/* Filters + actions */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "9px 14px" }}>
                  <Search size={14} style={{ color: C.muted }} />
                  <input
                    placeholder="Search users by name or email…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ background: "none", border: "none", outline: "none", color: "var(--page-text)", fontSize: "13px", width: "100%" }}
                  />
                </div>
                {/* Plan filter */}
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "9px 14px", color: "var(--page-text)", fontSize: "13px", cursor: "pointer", outline: "none" }}
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="creator">Creator</option>
                  <option value="studio">Studio</option>
                  <option value="agency">Agency</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
                <button style={{ display: "flex", alignItems: "center", gap: "6px", background: C.accent, border: "none", borderRadius: "10px", padding: "9px 16px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Invite User
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: "6px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "9px 14px", color: C.muted, fontSize: "13px", cursor: "pointer" }}>
                  <Download size={14} /> Export
                </button>
              </div>

              {/* Users table */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", overflow: "hidden" }}>
                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 1.4fr 100px 80px 90px 90px",
                  padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
                  fontSize: "11px", fontWeight: 700, color: C.muted, letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  <span>User</span><span>Email</span><span>Plan</span><span>Status</span><span>Generations</span><span>Actions</span>
                </div>

                {filteredUsers.map((user, i) => {
                  const sc = statusConfig[user.status];
                  return (
                    <div key={user.id} style={{
                      display: "grid", gridTemplateColumns: "2fr 1.4fr 100px 80px 90px 90px",
                      padding: "14px 20px", borderBottom: i < filteredUsers.length - 1 ? `1px solid ${C.border}` : "none",
                      alignItems: "center", transition: "background 0.15s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Name + avatar */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                          background: `linear-gradient(135deg, ${user.avatar}, ${user.avatar}66)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "11px", color: "#fff",
                        }}>{user.name[0]}</div>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>{user.name}</p>
                          <p style={{ fontSize: "10px", color: C.muted, margin: 0 }}>Joined {user.joined}</p>
                        </div>
                      </div>
                      {/* Email */}
                      <span style={{ fontSize: "12px", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                      {/* Plan */}
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "20px", background: `${planColors[user.plan]}18`, color: planColors[user.plan], display: "inline-block" }}>{user.plan}</span>
                      {/* Status */}
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "20px", background: sc.bg, color: sc.color, display: "inline-block" }}>{sc.label}</span>
                      {/* Generations */}
                      <span style={{ fontSize: "13px", fontWeight: 600, color: user.gens > 100 ? "#60A5FA" : C.text }}>{user.gens.toLocaleString()}</span>
                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", color: C.muted, display: "flex" }}
                          title="View profile"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#60A5FA"; (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        ><Eye size={13} /></button>
                        <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", color: C.muted, display: "flex" }}
                          title="Edit user"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#34D399"; (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.12)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        ><Edit3 size={13} /></button>
                        <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", color: C.muted, display: "flex" }}
                          title="More options"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        ><MoreVertical size={13} /></button>
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                    <Users size={32} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                    <p>No users match your search.</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                <p style={{ fontSize: "12px", color: C.muted }}>Showing {filteredUsers.length} of {allUsers.length} users</p>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3, "…", 12].map((p, i) => (
                    <button key={i} style={{
                      background: p === 1 ? C.accent : C.card, border: `1px solid ${p === 1 ? C.accent : C.border}`,
                      borderRadius: "8px", padding: "6px 11px", fontSize: "12px", cursor: "pointer",
                      color: p === 1 ? "#fff" : C.muted,
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
               BLOG
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "blog" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px", gap: "10px" }}>
                <button style={{ display: "flex", alignItems: "center", gap: "6px", background: C.accent, border: "none", borderRadius: "10px", padding: "10px 18px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> New Post
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {blogPosts.map(post => {
                  const statusMap: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
                    published: { color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle  },
                    draft:     { color: "#64748B", bg: "rgba(100,116,139,0.12)", icon: Edit3       },
                    scheduled: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: Clock        },
                  };
                  const s = statusMap[post.status];
                  const SIcon = s.icon;
                  return (
                    <div key={post.id} style={{
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px",
                      padding: "20px 22px", display: "flex", alignItems: "center", gap: "18px",
                      transition: "border-color 0.2s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#60A5FA", background: "rgba(37,99,235,0.12)", padding: "2px 8px", borderRadius: "20px" }}>{post.category}</span>
                          <span style={{ fontSize: "11px", color: C.muted }}>{post.date}</span>
                        </div>
                        <p style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>{post.title}</p>
                        {post.views > 0 && <p style={{ fontSize: "12px", color: C.muted, margin: 0 }}>{post.views.toLocaleString()} views</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderRadius: "20px", background: s.bg }}>
                        <SIcon size={12} style={{ color: s.color }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: s.color, textTransform: "capitalize" }}>{post.status}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: C.muted, fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; (e.currentTarget as HTMLElement).style.color = "#60A5FA"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = C.muted; }}
                        ><Edit3 size={12} /> Edit</button>
                        <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", color: C.muted, display: "flex" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"; (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = C.muted; }}
                        ><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
               TOOLS
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "tools" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
                <button style={{ display: "flex", alignItems: "center", gap: "6px", background: C.accent, border: "none", borderRadius: "10px", padding: "10px 18px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Add Tool
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                {tools.map(tool => {
                  const CatIcon = tool.category === "Image" ? ImageIcon : tool.category === "Video" ? Video : Music;
                  const isLive = tool.status === "live";
                  return (
                    <div key={tool.id} style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: "14px", padding: "20px",
                      transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${tool.color}40`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${tool.color}15`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${tool.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CatIcon size={17} style={{ color: tool.color }} />
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 2px" }}>{tool.name}</p>
                            <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>{tool.category}</p>
                          </div>
                        </div>
                        {tool.badge && (
                          <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "20px", letterSpacing: "0.08em", background: `${tool.color}20`, color: tool.color, border: `1px solid ${tool.color}35` }}>{tool.badge}</span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 2px" }}>{isLive ? tool.users.toLocaleString() : "—"}</p>
                          <p style={{ fontSize: "11px", color: C.muted, margin: 0 }}>active users</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "20px",
                            background: isLive ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
                            color: isLive ? "#34D399" : C.muted,
                            display: "flex", alignItems: "center", gap: "4px",
                          }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isLive ? "#34D399" : C.muted, display: "inline-block" }} />
                            {isLive ? "Live" : "Coming Soon"}
                          </span>
                          <button style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", color: C.muted, display: "flex" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#60A5FA"; (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                          ><Edit3 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
               ANALYTICS
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "analytics" && (
            <div>
              {/* Top metric cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
                {[
                  { label: "Page Views (30d)",    value: "124,890", color: "#2563EB", icon: Eye },
                  { label: "New Signups (30d)",   value: "834",     color: "#0EA5A0", icon: UserCheck },
                  { label: "Avg Session (min)",   value: "12.4",    color: "#A855F7", icon: Clock },
                  { label: "Conversion Rate",     value: "8.3%",    color: "#F59E0B", icon: TrendingUp },
                ].map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={15} style={{ color: m.color }} />
                        </div>
                        <span style={{ fontSize: "12px", color: C.muted }}>{m.label}</span>
                      </div>
                      <p style={{ fontSize: "28px", fontWeight: 800, margin: 0 }}>{m.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Plan distribution */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "22px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "20px" }}>Plan Distribution</p>
                  {[
                    { label: "Free",    count: 1840, pct: 65, color: "#64748B" },
                    { label: "Creator", count: 712,  pct: 25, color: "#2563EB" },
                    { label: "Studio",  count: 267,  pct: 9,  color: "#0EA5A0" },
                    { label: "Agency",  count: 28,   pct: 1,  color: "#A855F7" },
                  ].map((p, i) => (
                    <div key={i} style={{ marginBottom: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{p.label}</span>
                        <span style={{ fontSize: "12px", color: C.muted }}>{p.count.toLocaleString()} ({p.pct}%)</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "10px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", width: `${p.pct}%`, borderRadius: "10px", background: p.color, boxShadow: `0 0 8px ${p.color}60`, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "22px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "20px" }}>Tool Usage (30d)</p>
                  {[
                    { name: "Kling 3.0",      gens: 24820, color: "#0EA5A0" },
                    { name: "Nano Banana Pro", gens: 18340, color: "#2563EB" },
                    { name: "Runway ML",       gens: 12100, color: "#A855F7" },
                    { name: "Google Veo",      gens: 9870,  color: "#60A5FA" },
                    { name: "ElevenLabs",      gens: 7650,  color: "#A855F7" },
                    { name: "Flux",            gens: 5210,  color: "#EF4444" },
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "12px", color: C.muted, width: "110px", flexShrink: 0 }}>{t.name}</span>
                      <div style={{ flex: 1, height: "6px", borderRadius: "10px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", width: `${Math.round((t.gens / 24820) * 100)}%`, borderRadius: "10px", background: t.color, boxShadow: `0 0 6px ${t.color}50` }} />
                      </div>
                      <span style={{ fontSize: "11px", color: C.muted, width: "44px", textAlign: "right", flexShrink: 0 }}>{(t.gens / 1000).toFixed(1)}k</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
               SETTINGS
          ═══════════════════════════════════════════════════════════════════ */}
          {activeNav === "settings" && (
            <div style={{ maxWidth: "760px" }}>
              {/* Section helper */}
              {([
                {
                  title: "Platform Identity",
                  icon: Globe,
                  fields: [
                    { label: "Platform Name",    value: "Zencra Labs",              type: "text"  },
                    { label: "Tagline",          value: "Create Without Limits",     type: "text"  },
                    { label: "Support Email",    value: "support@zencralabs.com",   type: "email" },
                    { label: "Primary Domain",   value: "zencralabs.com",           type: "text"  },
                  ],
                },
                {
                  title: "Pricing & Plans",
                  icon: CreditCard,
                  fields: [
                    { label: "Creator Plan Price ($/mo)", value: "29", type: "number" },
                    { label: "Studio Plan Price ($/mo)",  value: "99", type: "number" },
                    { label: "Free Tier Image Limit",     value: "5",  type: "number" },
                    { label: "Free Tier Video Limit",     value: "3",  type: "number" },
                  ],
                },
                {
                  title: "Security & Access",
                  icon: Shield,
                  fields: [
                    { label: "Admin Email",              value: "jkn.devcraft@gmail.com", type: "email" },
                    { label: "2FA Enforcement",          value: "Enabled",               type: "text"  },
                    { label: "Session Timeout (min)",    value: "60",                    type: "number"},
                  ],
                },
              ] as { title: string; icon: React.ElementType; fields: { label: string; value: string; type: string }[] }[]).map((section, si) => {
                const SectionIcon = section.icon;
                return (
                  <div key={si} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <SectionIcon size={15} style={{ color: "#60A5FA" }} />
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>{section.title}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      {section.fields.map((f, fi) => (
                        <div key={fi}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: C.muted, display: "block", marginBottom: "6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{f.label}</label>
                          <input
                            type={f.type}
                            defaultValue={f.value}
                            style={{
                              width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                              borderRadius: "9px", padding: "9px 12px", color: "var(--page-text)", fontSize: "13px",
                              outline: "none", boxSizing: "border-box",
                              transition: "border-color 0.15s",
                            }}
                            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
                      <button style={{ background: C.accent, border: "none", borderRadius: "9px", padding: "9px 20px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <RefreshCw size={13} /> Save Changes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
