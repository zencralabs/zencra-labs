"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Users, BarChart2, FileText, Settings, LogOut,
  ExternalLink, Search, UserPlus, Wand2, Film, CreditCard,
  TrendingUp, RefreshCw, ChevronLeft, ChevronRight, X, Check,
  Shield, Globe, Zap, Database, Mail, MessageSquare, AlertTriangle,
} from "lucide-react";
// Custom SVG chart components — zero external deps
import { useAuth } from "@/components/auth/AuthContext";

interface StatsData {
  users: { total: number; today: number; thisWeek: number; paid: number };
  generations: { total: number; today: number; successRate: number };
  revenue: { mrr: number; arr: number };
  credits: { total: number };
  planBreakdown: Record<string, number>;
}

interface AdminUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar_url?: string;
  avatar_color?: number;
  plan: string;
  role: string;
  credits: number;
  created_at: string;
}

interface AnalyticsData {
  dailySignups: { date: string; count: number }[];
  dailyGenerations: { date: string; count: number }[];
  categoryPie: { name: string; value: number }[];
  topTools: { name: string; value: number }[];
}

type ContentData = Record<string, string>;

const GRADIENT_COLORS = ["#2563EB", "#0EA5A0", "#A855F7", "#F59E0B", "#10B981", "#EF4444", "#4F46E5", "#EC4899"];
const PLAN_COLORS: Record<string, string> = {
  Free: "#64748B",
  Starter: "#2563EB",
  Pro: "#0EA5A0",
  Creator: "#A855F7",
  Studio: "#F59E0B",
  Agency: "#EF4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  image: "#2563EB",
  video: "#0EA5A0",
  audio: "#A855F7",
  text: "#F59E0B",
};

/* ─── Custom SVG Charts ────────────────────────────────────────────── */

function SvgLineChart({ data, color = "#2563EB" }: { data: { date: string; count: number }[]; color?: string }) {
  const W = 520, H = 200, PAD = { top: 16, right: 12, bottom: 32, left: 36 };
  if (!data || data.length === 0) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12 }}>No data yet</div>;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xStep = innerW / Math.max(data.length - 1, 1);
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
  const polyline = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(" ");
  const area = `M${PAD.left},${PAD.top + innerH} ` + data.map((d, i) => `L${toX(i)},${toY(d.count)}`).join(" ") + ` L${toX(data.length - 1)},${PAD.top + innerH} Z`;
  const ticks = [0, Math.round(maxVal / 2), maxVal];
  const labelEvery = Math.ceil(data.length / 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={toY(t)} y2={toY(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <text x={PAD.left - 4} y={toY(t) + 4} fill="#475569" fontSize={10} textAnchor="end">{t}</text>
        </g>
      ))}
      {/* area fill */}
      <path d={area} fill="url(#lc-area)" />
      {/* line */}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* dots */}
      {data.map((d, i) => <circle key={i} cx={toX(i)} cy={toY(d.count)} r={d.count > 0 ? 3 : 0} fill={color} />)}
      {/* x labels */}
      {data.map((d, i) => i % labelEvery === 0 && (
        <text key={i} x={toX(i)} y={H - 4} fill="#475569" fontSize={9} textAnchor="middle">{d.date.slice(5)}</text>
      ))}
    </svg>
  );
}

function SvgBarChart({ data, color = "#0EA5A0" }: { data: { date: string; count: number }[]; color?: string }) {
  const W = 520, H = 200, PAD = { top: 16, right: 12, bottom: 32, left: 36 };
  if (!data || data.length === 0) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12 }}>No data yet</div>;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const barW = Math.max(2, innerW / data.length - 2);
  const ticks = [0, Math.round(maxVal / 2), maxVal];
  const labelEvery = Math.ceil(data.length / 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {ticks.map(t => {
        const y = PAD.top + innerH - (t / maxVal) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} fill="#475569" fontSize={10} textAnchor="end">{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bh = (d.count / maxVal) * innerH;
        const x = PAD.left + (i / data.length) * innerW + (innerW / data.length - barW) / 2;
        const y = PAD.top + innerH - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={2} fill={color} opacity={0.85} />
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 4} fill="#475569" fontSize={9} textAnchor="middle">{d.date.slice(5)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SvgDonutChart({ data, colors }: { data: { name: string; value: number }[]; colors: Record<string, string> }) {
  const W = 260, H = 220, cx = 110, cy = 105, R = 75, r = 45;
  if (!data || data.length === 0) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12 }}>No data yet</div>;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let startAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const s = { ...d, startAngle, endAngle: startAngle + angle, color: colors[d.name] || "#94A3B8" };
    startAngle += angle;
    return s;
  });
  function arc(s: number, e: number, outer: number, inner: number) {
    const x1 = cx + outer * Math.cos(s), y1 = cy + outer * Math.sin(s);
    const x2 = cx + outer * Math.cos(e), y2 = cy + outer * Math.sin(e);
    const x3 = cx + inner * Math.cos(e), y3 = cy + inner * Math.sin(e);
    const x4 = cx + inner * Math.cos(s), y4 = cy + inner * Math.sin(s);
    const large = e - s > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${outer},${outer} 0 ${large},1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large},0 ${x4},${y4} Z`;
  }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {slices.map((s, i) => <path key={i} d={arc(s.startAngle, s.endAngle, R, r)} fill={s.color} opacity={0.9} />)}
      {/* legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(${cx + R + 18}, ${30 + i * 22})`}>
          <rect width={10} height={10} rx={2} fill={s.color} />
          <text x={14} y={9} fill="#94A3B8" fontSize={11}>{s.name} ({s.value})</text>
        </g>
      ))}
    </svg>
  );
}

function SvgHorizBarChart({ data }: { data: { name: string; value: number }[] }) {
  const items = data.slice(0, 8);
  const maxVal = Math.max(...items.map(d => d.value), 1);
  const ROW_H = 28, PAD_LEFT = 88, W = 480, BAR_AREA = W - PAD_LEFT - 16;
  const H = items.length * ROW_H + 8;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {items.map((d, i) => {
        const bw = (d.value / maxVal) * BAR_AREA;
        const y = i * ROW_H;
        const col = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
        return (
          <g key={i}>
            <text x={PAD_LEFT - 6} y={y + 18} fill="#94A3B8" fontSize={11} textAnchor="end">{d.name.length > 10 ? d.name.slice(0, 10) + "…" : d.name}</text>
            <rect x={PAD_LEFT} y={y + 6} width={bw} height={16} rx={4} fill={col} opacity={0.85} />
            <text x={PAD_LEFT + bw + 5} y={y + 18} fill="#64748B" fontSize={10}>{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function HubPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"overview" | "users" | "analytics" | "content" | "settings">("overview");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [content, setContent] = useState<ContentData>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchStats = useCallback(async () => {
    if (!user?.accessToken) return;
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.accessToken]);

  const fetchUsers = useCallback(async (page: number = 1) => {
    if (!user?.accessToken) return;
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (searchQuery) params.append("search", searchQuery);
      if (planFilter) params.append("plan", planFilter);
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserTotal(data.total || 0);
        setUserPage(page);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [user?.accessToken, searchQuery, planFilter]);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.accessToken) return;
    try {
      const res = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (res.ok) setAnalytics(await res.json());
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  }, [user?.accessToken]);

  const fetchContent = useCallback(async () => {
    if (!user?.accessToken) return;
    try {
      const res = await fetch("/api/admin/content", {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (res.ok) setContent(await res.json());
    } catch (err) {
      console.error("Error fetching content:", err);
    }
  }, [user?.accessToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (tab === "users") fetchUsers(1);
  }, [tab, fetchUsers]);

  useEffect(() => {
    if (tab === "analytics") fetchAnalytics();
  }, [tab, fetchAnalytics]);

  useEffect(() => {
    if (tab === "content") fetchContent();
  }, [tab, fetchContent]);

  const saveUser = async () => {
    if (!editingUser || !user?.accessToken) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          plan: editingUser.plan,
          credits: editingUser.credits,
          role: editingUser.role,
        }),
      });
      if (res.ok) {
        setEditingUser(null);
        setSuccessMsg("User updated successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchUsers(userPage);
      }
    } catch (err) {
      console.error("Error saving user:", err);
    }
  };

  const saveContent = async () => {
    if (!user?.accessToken) return;
    setContentSaving(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify(content),
      });
      if (res.ok) {
        setSuccessMsg("Content saved successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Error saving content:", err);
    } finally {
      setContentSaving(false);
    }
  };

  const avatarGradient = (color: number) => {
    const colors = ["#2563EB", "#0EA5A0", "#A855F7", "#F59E0B", "#10B981", "#EF4444", "#4F46E5", "#EC4899"];
    return colors[color % colors.length];
  };

  const statCards = [
    { label: "Total Users", value: stats?.users.total ?? 0, icon: LayoutDashboard, color: "#2563EB" },
    { label: "New Today", value: stats?.users.today ?? 0, icon: UserPlus, color: "#0EA5A0" },
    { label: "Total Generations", value: stats?.generations.total ?? 0, icon: Wand2, color: "#A855F7" },
    { label: "Today's Generations", value: stats?.generations.today ?? 0, icon: Film, color: "#F59E0B" },
    { label: "Paid Users", value: stats?.users.paid ?? 0, icon: CreditCard, color: "#10B981" },
    { label: "Success Rate", value: `${stats?.generations.successRate ?? 0}%`, icon: TrendingUp, color: "#0EA5A0" },
  ];

  return (
    <div style={{ backgroundColor: "#060D1F", minHeight: "100vh" }} className="flex">
      {/* ─ SIDEBAR ─ */}
      <div style={{ backgroundColor: "#080E1F", borderRight: "1px solid rgba(255,255,255,0.07)" }} className="w-60 flex flex-col fixed h-screen">
        <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
              }}
              className="w-10 h-10 rounded font-bold text-white flex items-center justify-center"
            >
              Z
            </div>
            <span style={{ color: "#F8FAFC" }} className="text-lg font-bold">
              Zencra
            </span>
          </div>
          <p style={{ color: "#64748B", fontSize: "11px" }} className="font-medium tracking-wide">
            CONTROL HUB
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "users", label: "Users", icon: Users },
            { id: "analytics", label: "Analytics", icon: BarChart2 },
            { id: "content", label: "Content", icon: FileText },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              style={{
                backgroundColor: tab === item.id ? "rgba(37,99,235,0.15)" : "transparent",
                borderLeft: tab === item.id ? "3px solid #2563EB" : "3px solid transparent",
                color: tab === item.id ? "#2563EB" : "#94A3B8",
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition"
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} className="p-4 space-y-3">
          <Link
            href="/"
            style={{ color: "#2563EB" }}
            className="flex items-center justify-between text-sm font-medium hover:opacity-80 transition"
          >
            Visit Site
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={() => logout()}
            style={{ color: "#EF4444" }}
            className="w-full flex items-center justify-between text-sm font-medium hover:opacity-80 transition"
          >
            Sign Out
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* ─ MAIN CONTENT ─ */}
      <div className="ml-60 w-[calc(100%-240px)] flex flex-col">
        {/* ─ HEADER ─ */}
        <div
          style={{
            backgroundColor: "#060D1F",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            height: "56px",
          }}
          className="flex items-center justify-between px-8"
        >
          <div style={{ color: "#94A3B8" }} className="text-sm font-medium">
            {tab === "overview" && "Overview"}
            {tab === "users" && "All Users"}
            {tab === "analytics" && "Analytics"}
            {tab === "content" && "Site Content"}
            {tab === "settings" && "Settings"}
          </div>
          <div className="flex items-center gap-4">
            <div
              style={{
                backgroundColor: GRADIENT_COLORS[user?.avatarColor ?? 0],
                color: "white",
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <p style={{ color: "#F8FAFC" }} className="text-sm font-medium">
                {user?.name}
              </p>
              <p style={{ color: "#64748B" }} className="text-xs">
                Admin
              </p>
            </div>
          </div>
        </div>

        {/* ─ SCROLLABLE CONTENT ─ */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {/* ─ OVERVIEW TAB ─ */}
            {tab === "overview" && (
              <div className="space-y-8">
                {statsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div
                      style={{ borderColor: "rgba(37,99,235,0.3)", borderTopColor: "#2563EB" }}
                      className="w-8 h-8 border-4 rounded-full animate-spin"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {statCards.map((card, i) => (
                        <div
                          key={i}
                          style={{
                            background: "rgba(13,24,41,0.7)",
                            borderRadius: 16,
                            padding: 20,
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p style={{ color: "#64748B" }} className="text-xs font-medium mb-3 uppercase tracking-wide">
                                {card.label}
                              </p>
                              <p style={{ color: "#F8FAFC", fontSize: "28px" }} className="font-bold">
                                {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                              </p>
                            </div>
                            <div
                              style={{ backgroundColor: `${card.color}20`, borderRadius: 10 }}
                              className="w-10 h-10 flex items-center justify-center"
                            >
                              <card.icon size={20} style={{ color: card.color }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Plan Distribution */}
                    <div
                      style={{
                        background: "rgba(13,24,41,0.7)",
                        borderRadius: 16,
                        padding: 20,
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                        Plan Distribution
                      </p>
                      <div className="flex h-8 rounded overflow-hidden gap-1">
                        {Object.entries(stats?.planBreakdown || {}).map(([plan, count]) => (
                          <div
                            key={plan}
                            style={{
                              backgroundColor: PLAN_COLORS[plan] || "#94A3B8",
                              flex: (count as number) || 1,
                            }}
                            className="group relative"
                            title={`${plan}: ${count}`}
                          >
                            <div
                              style={{
                                backgroundColor: "#060D1F",
                                color: "#F8FAFC",
                              }}
                              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition whitespace-nowrap"
                            >
                              {plan}: {count}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div
                      style={{
                        background: "rgba(13,24,41,0.7)",
                        borderRadius: 16,
                        padding: 20,
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                        Platform Activity
                      </p>
                      <div className="space-y-4">
                        {[
                          "Database connected — Supabase PostgreSQL operational",
                          "Email service configured — Resend ready",
                          "SMS provider active — Twilio connected",
                          "Analytics pipeline running",
                          "User auth system operational",
                        ].map((activity, i) => (
                          <div
                            key={i}
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              borderRadius: 10,
                              padding: 12,
                              border: "1px solid rgba(255,255,255,0.05)",
                            }}
                            className="flex items-center gap-3"
                          >
                            <div
                              style={{ backgroundColor: "#10B981" }}
                              className="w-2 h-2 rounded-full flex-shrink-0"
                            />
                            <p style={{ color: "#94A3B8" }} className="text-sm">
                              {activity}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ USERS TAB ─ */}
            {tab === "users" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 style={{ color: "#F8FAFC" }} className="text-xl font-bold">
                      All Users
                    </h2>
                    <p style={{ color: "#64748B" }} className="text-sm">
                      {userTotal} total users
                    </p>
                  </div>
                  <div className="flex gap-3 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search
                        size={16}
                        style={{ color: "#64748B" }}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2"
                      />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setUserPage(1);
                        }}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                        }}
                        className="w-full pl-9 pr-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={planFilter}
                      onChange={(e) => {
                        setPlanFilter(e.target.value);
                        setUserPage(1);
                      }}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "#F8FAFC",
                      }}
                      className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Plans</option>
                      <option value="Free">Free</option>
                      <option value="Starter">Starter</option>
                      <option value="Pro">Pro</option>
                      <option value="Creator">Creator</option>
                      <option value="Studio">Studio</option>
                      <option value="Agency">Agency</option>
                    </select>
                    <button
                      onClick={() => fetchUsers(userPage)}
                      style={{ backgroundColor: "#2563EB", color: "white" }}
                      className="px-4 py-2 rounded text-sm font-medium hover:opacity-80 transition flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Refresh
                    </button>
                  </div>
                </div>

                {usersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "rgba(100,116,139,0.2)",
                          borderRadius: 8,
                          height: 60,
                        }}
                        className="animate-pulse"
                      />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: "rgba(13,24,41,0.7)",
                      borderRadius: 16,
                      padding: 40,
                      border: "1px solid rgba(255,255,255,0.07)",
                      textAlign: "center",
                    }}
                  >
                    <Users size={32} style={{ color: "#64748B", margin: "0 auto 12px" }} />
                    <p style={{ color: "#94A3B8" }} className="text-sm">
                      No users found
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        background: "rgba(13,24,41,0.7)",
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.07)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "rgba(255,255,255,0.02)",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}
                        className="grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wide"
                      >
                        <div style={{ color: "#64748B" }} className="col-span-1">
                          Avatar
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-3">
                          Name & Email
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-1">
                          Plan
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-1">
                          Credits
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-1">
                          Role
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-2">
                          Joined
                        </div>
                        <div style={{ color: "#64748B" }} className="col-span-3">
                          Actions
                        </div>
                      </div>
                      {users.map((u) => (
                        <div
                          key={u.id}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                          className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-opacity-50"
                        >
                          <div className="col-span-1">
                            <div
                              style={{
                                backgroundColor: avatarGradient(u.avatar_color ?? 0),
                                color: "white",
                              }}
                              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
                            >
                              {u.full_name?.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="col-span-3">
                            <p style={{ color: "#F8FAFC" }} className="text-sm font-medium truncate">
                              {u.full_name}
                            </p>
                            <p style={{ color: "#64748B" }} className="text-xs truncate">
                              {u.email}
                            </p>
                          </div>
                          <div className="col-span-1">
                            <span
                              style={{
                                backgroundColor: `${PLAN_COLORS[u.plan] || "#94A3B8"}20`,
                                color: PLAN_COLORS[u.plan] || "#94A3B8",
                                borderRadius: 20,
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: "600",
                              }}
                            >
                              {u.plan}
                            </span>
                          </div>
                          <div style={{ color: "#F8FAFC" }} className="col-span-1 text-sm font-medium">
                            {u.credits}
                          </div>
                          <div style={{ color: "#94A3B8" }} className="col-span-1 text-xs">
                            {u.role}
                          </div>
                          <div style={{ color: "#94A3B8" }} className="col-span-2 text-xs">
                            {new Date(u.created_at).toLocaleDateString()}
                          </div>
                          <div className="col-span-3">
                            <button
                              onClick={() => setEditingUser(u)}
                              style={{ backgroundColor: "#2563EB", color: "white" }}
                              className="px-3 py-1 rounded text-xs font-medium hover:opacity-80 transition"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                      <p style={{ color: "#64748B" }} className="text-sm">
                        Page {userPage} of {Math.ceil(userTotal / 20)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchUsers(Math.max(1, userPage - 1))}
                          disabled={userPage === 1}
                          style={{
                            backgroundColor: userPage === 1 ? "rgba(255,255,255,0.05)" : "#2563EB",
                            color: userPage === 1 ? "#64748B" : "white",
                          }}
                          className="px-3 py-1 rounded text-sm font-medium transition disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => fetchUsers(userPage + 1)}
                          disabled={userPage >= Math.ceil(userTotal / 20)}
                          style={{
                            backgroundColor: userPage >= Math.ceil(userTotal / 20) ? "rgba(255,255,255,0.05)" : "#2563EB",
                            color: userPage >= Math.ceil(userTotal / 20) ? "#64748B" : "white",
                          }}
                          className="px-3 py-1 rounded text-sm font-medium transition disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ EDIT USER PANEL ─ */}
            {editingUser && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
                <div
                  style={{
                    backgroundColor: "#080E1F",
                    borderLeft: "1px solid rgba(255,255,255,0.07)",
                    width: 400,
                    maxHeight: "100vh",
                  }}
                  className="overflow-auto"
                >
                  <div
                    style={{
                      backgroundColor: "#060D1F",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                    }}
                    className="flex items-center justify-between p-6 sticky top-0"
                  >
                    <h3 style={{ color: "#F8FAFC" }} className="text-lg font-bold">
                      Edit User
                    </h3>
                    <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-2">
                        {editingUser.full_name}
                      </p>
                      <p style={{ color: "#64748B" }} className="text-xs">
                        {editingUser.email}
                      </p>
                    </div>

                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-sm font-medium mb-2">
                        Plan
                      </label>
                      <select
                        value={editingUser.plan}
                        onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Free">Free</option>
                        <option value="Starter">Starter</option>
                        <option value="Pro">Pro</option>
                        <option value="Creator">Creator</option>
                        <option value="Studio">Studio</option>
                        <option value="Agency">Agency</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-sm font-medium mb-2">
                        Credits
                      </label>
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setEditingUser({ ...editingUser, credits: Math.max(0, editingUser.credits - 50) })}
                          style={{ backgroundColor: "#EF4444", color: "white" }}
                          className="flex-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition"
                        >
                          -50
                        </button>
                        <button
                          onClick={() => setEditingUser({ ...editingUser, credits: Math.max(0, editingUser.credits - 50) })}
                          style={{ backgroundColor: "#EF4444", color: "white" }}
                          className="flex-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition"
                        >
                          -50
                        </button>
                        <button
                          onClick={() => setEditingUser({ ...editingUser, credits: editingUser.credits + 50 })}
                          style={{ backgroundColor: "#10B981", color: "white" }}
                          className="flex-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition"
                        >
                          +50
                        </button>
                        <button
                          onClick={() => setEditingUser({ ...editingUser, credits: editingUser.credits + 100 })}
                          style={{ backgroundColor: "#10B981", color: "white" }}
                          className="flex-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition"
                        >
                          +100
                        </button>
                      </div>
                      <input
                        type="number"
                        value={editingUser.credits}
                        onChange={(e) => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) || 0 })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-sm font-medium mb-3">
                        Role
                      </label>
                      <div className="flex gap-3">
                        {["user", "admin"].map((role) => (
                          <button
                            key={role}
                            onClick={() => setEditingUser({ ...editingUser, role })}
                            style={{
                              backgroundColor: editingUser.role === role ? "#2563EB" : "rgba(255,255,255,0.04)",
                              color: editingUser.role === role ? "white" : "#F8FAFC",
                              borderColor: "rgba(255,255,255,0.1)",
                            }}
                            className="flex-1 px-3 py-2 border rounded text-sm font-medium transition"
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={saveUser}
                        style={{ backgroundColor: "#2563EB", color: "white" }}
                        className="flex-1 px-4 py-2 rounded font-medium hover:opacity-80 transition flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#94A3B8" }}
                        className="flex-1 px-4 py-2 rounded font-medium hover:opacity-80 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─ ANALYTICS TAB ─ */}
            {tab === "analytics" && (
              <div className="space-y-8">
                {!analytics ? (
                  <div className="flex items-center justify-center h-40">
                    <div
                      style={{ borderColor: "rgba(37,99,235,0.3)", borderTopColor: "#2563EB" }}
                      className="w-8 h-8 border-4 rounded-full animate-spin"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div
                        style={{
                          background: "rgba(13,24,41,0.7)",
                          borderRadius: 16,
                          padding: 20,
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                          User Signups (30 days)
                        </p>
                        <SvgLineChart data={analytics.dailySignups} color="#2563EB" />
                      </div>

                      <div
                        style={{
                          background: "rgba(13,24,41,0.7)",
                          borderRadius: 16,
                          padding: 20,
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                          Daily Generations (30 days)
                        </p>
                        <SvgBarChart data={analytics.dailyGenerations} color="#0EA5A0" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div
                        style={{
                          background: "rgba(13,24,41,0.7)",
                          borderRadius: 16,
                          padding: 20,
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                          Generations by Category
                        </p>
                        <SvgDonutChart data={analytics.categoryPie} colors={CATEGORY_COLORS} />
                      </div>

                      <div
                        style={{
                          background: "rgba(13,24,41,0.7)",
                          borderRadius: 16,
                          padding: 20,
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-6">
                          Top Tools Used
                        </p>
                        <SvgHorizBarChart data={analytics.topTools} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ CONTENT TAB ─ */}
            {tab === "content" && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h3 style={{ color: "#F8FAFC" }} className="text-lg font-bold mb-6">
                    Site Content Editor
                  </h3>
                </div>

                {/* Hero Section */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h4 style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-4">
                    Hero Section
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-xs font-medium mb-2 uppercase tracking-wide">
                        Hero Headline
                      </label>
                      <input
                        type="text"
                        value={content.hero_headline || ""}
                        onChange={(e) => setContent({ ...content, hero_headline: e.target.value })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-xs font-medium mb-2 uppercase tracking-wide">
                        Hero Sub-headline
                      </label>
                      <input
                        type="text"
                        value={content.hero_subheadline || ""}
                        onChange={(e) => setContent({ ...content, hero_subheadline: e.target.value })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-xs font-medium mb-2 uppercase tracking-wide">
                        Hero Description
                      </label>
                      <textarea
                        value={content.hero_description || ""}
                        onChange={(e) => setContent({ ...content, hero_description: e.target.value })}
                        rows={4}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                          resize: "none",
                        }}
                        className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Announcement Banner */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h4 style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-4">
                    Announcement Banner
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-xs font-medium mb-2 uppercase tracking-wide">
                        Banner Text
                      </label>
                      <input
                        type="text"
                        value={content.announcement_text || ""}
                        onChange={(e) => setContent({ ...content, announcement_text: e.target.value })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label style={{ color: "#F8FAFC" }} className="block text-xs font-medium mb-2 uppercase tracking-wide">
                        Banner Link
                      </label>
                      <input
                        type="text"
                        value={content.announcement_link || ""}
                        onChange={(e) => setContent({ ...content, announcement_link: e.target.value })}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#F8FAFC",
                          width: "100%",
                        }}
                        className="px-4 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={(content.announcement_active === "true")}
                        onChange={(e) => setContent({ ...content, announcement_active: e.target.checked ? "true" : "false" })}
                        className="w-4 h-4 rounded"
                      />
                      <span style={{ color: "#F8FAFC" }} className="text-sm font-medium">
                        Banner is active
                      </span>
                    </label>
                  </div>
                </div>

                {/* Platform Status */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h4 style={{ color: "#F8FAFC" }} className="text-sm font-semibold mb-4">
                    Platform Status
                  </h4>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={(content.maintenance_mode === "true")}
                      onChange={(e) => setContent({ ...content, maintenance_mode: e.target.checked ? "true" : "false" })}
                      className="w-4 h-4 rounded"
                    />
                    <span style={{ color: "#F8FAFC" }} className="text-sm font-medium">
                      Maintenance Mode
                    </span>
                  </label>
                  {content.maintenance_mode === "true" && (
                    <div
                      style={{
                        backgroundColor: "#F59E0B20",
                        borderColor: "#F59E0B",
                        color: "#F59E0B",
                        marginTop: 12,
                        borderRadius: 8,
                        padding: 12,
                        borderLeft: "4px solid #F59E0B",
                      }}
                      className="flex gap-3 text-sm"
                    >
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>Platform is in maintenance mode. Users will see a maintenance page.</span>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={saveContent}
                  disabled={contentSaving}
                  style={{ backgroundColor: "#2563EB", color: "white" }}
                  className="px-6 py-2 rounded font-medium hover:opacity-80 transition disabled:opacity-50"
                >
                  {contentSaving ? "Saving..." : "Save Changes"}
                </button>

                {successMsg && (
                  <div
                    style={{
                      backgroundColor: "#10B98120",
                      borderColor: "#10B981",
                      color: "#10B981",
                      borderRadius: 8,
                      padding: 12,
                      borderLeft: "4px solid #10B981",
                    }}
                    className="text-sm flex gap-2"
                  >
                    <Check size={16} />
                    {successMsg}
                  </div>
                )}
              </div>
            )}

            {/* ─ SETTINGS TAB ─ */}
            {tab === "settings" && (
              <div className="max-w-3xl space-y-8">
                {/* Admin Access */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h3 style={{ color: "#F8FAFC" }} className="text-base font-bold mb-2">
                    Admin Access
                  </h3>
                  <p style={{ color: "#64748B" }} className="text-sm mb-6">
                    Users with admin privileges to control the platform
                  </p>
                  <div className="space-y-3">
                    {users.filter((u) => u.role === "admin").length === 0 ? (
                      <p style={{ color: "#64748B" }} className="text-sm">
                        No admin users
                      </p>
                    ) : (
                      users
                        .filter((u) => u.role === "admin")
                        .map((u) => (
                          <div
                            key={u.id}
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              borderRadius: 10,
                              padding: 12,
                              border: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <p style={{ color: "#F8FAFC" }} className="text-sm font-medium">
                              {u.full_name}
                            </p>
                            <p style={{ color: "#64748B" }} className="text-xs">
                              {u.email}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Security */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h3 style={{ color: "#F8FAFC" }} className="text-base font-bold mb-2 flex items-center gap-2">
                    <Shield size={18} />
                    Security
                  </h3>
                  <p style={{ color: "#64748B" }} className="text-sm mb-6">
                    Manage user security and password resets through Supabase Dashboard
                  </p>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563EB" }}
                    className="text-sm font-medium hover:opacity-80 transition flex items-center gap-2"
                  >
                    Open Supabase Dashboard
                    <ExternalLink size={14} />
                  </a>
                </div>

                {/* Platform Info */}
                <div
                  style={{
                    background: "rgba(13,24,41,0.7)",
                    borderRadius: 16,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <h3 style={{ color: "#F8FAFC" }} className="text-base font-bold mb-6 flex items-center gap-2">
                    <Globe size={18} />
                    Platform Info
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: "Version", value: "1.0.0" },
                      { label: "Environment", value: "Production" },
                      { label: "Database", value: "Supabase PostgreSQL", icon: Database },
                      { label: "Email Provider", value: "Resend", icon: Mail },
                      { label: "SMS Provider", value: "Twilio", icon: MessageSquare },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.03)",
                          borderRadius: 10,
                          padding: 12,
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {item.icon && <item.icon size={16} style={{ color: "#64748B" }} />}
                          <p style={{ color: "#64748B" }} className="text-sm">
                            {item.label}
                          </p>
                        </div>
                        <p style={{ color: "#F8FAFC" }} className="text-sm font-medium">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
