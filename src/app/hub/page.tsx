"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; today: number; thisWeek: number; paid: number };
  generations: { total: number; today: number; successRate: number };
  revenue: { mrr: number; arr: number };
  credits: { total: number };
  planBreakdown: Record<string, number>;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  plan: string;
  role: string;
  credits: number;
  created_at: string;
  avatar_url?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Charts
// ─────────────────────────────────────────────────────────────────────────────

function SvgDonutChart({ data, colors, total, label }: {
  data: number[]; colors: string[]; total: number; label: string;
}) {
  const size = 160;
  const r    = 62;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((v, i) => {
    const pct  = total > 0 ? v / total : 0;
    const dash = pct * circ;
    const gap  = circ - dash;
    const seg  = { offset, dash, gap, color: colors[i] };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="18"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC" }}>{total.toLocaleString()}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
    </div>
  );
}

function SvgMiniLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120; const h = 40;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const filled = `0,${h} ${pts} ${w},${h}`;
  const gId = `g_${color.replace("#", "")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={filled} fill={`url(#${gId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SvgBarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const h = 160;
  const max = Math.max(...values, 1);
  const n = values.length;
  const barW = 100 / (n * 2 - 1);

  return (
    <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none">
      {values.map((v, i) => {
        const barH = (v / max) * (h - 20);
        const x = i * barW * 2;
        const y = h - barH - 20;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="1" fill={color} opacity={0.7} />
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="3.5">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan config
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  free:    { label: "Free",    color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
  starter: { label: "Starter", color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  pro:     { label: "Pro",     color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"  },
  creator: { label: "Creator", color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
};
const PLAN_KEYS   = ["free", "starter", "pro", "creator"];
const PLAN_COLORS = ["#94A3B8", "#3B82F6", "#8B5CF6", "#10B981"];

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid rgba(255,255,255,0.08)`, borderTopColor: "#2563EB", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan?.toLowerCase()] ?? PLAN_CONFIG.free;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }}>{cfg.label}</span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, background: isAdmin ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)", color: isAdmin ? "#EF4444" : "#94A3B8", fontSize: 11, fontWeight: 600 }}>
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}

function UserAvatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const BG = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2"];
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const color = BG[(name || "?").charCodeAt(0) % BG.length];
  if (avatar) return <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.375, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>;
}

function StatCard({ title, value, sub, color, sparkline }: {
  title: string; value: string; sub?: string; color: string; sparkline?: number[];
}) {
  return (
    <div style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 4, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.02em" }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {sub && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</span>}
        {sparkline && <SvgMiniLine values={sparkline} color={color} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function HubPage() {
  const { user } = useAuth();

  const [stats, setStats]             = useState<Stats | null>(null);
  const [users, setUsers]             = useState<UserRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch("/api/admin/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (e) { console.error("[hub] stats", e); }
    finally { setStatsLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res  = await fetch("/api/admin/users?page=1&limit=8");
      const json = await res.json();
      if (json.success) setUsers(json.data ?? []);
    } catch (e) { console.error("[hub] users", e); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchUsers(); }, [fetchStats, fetchUsers]);

  async function handleCreditAdj(userId: string, delta: number) {
    setActionLoading(true);
    setActionTarget(userId);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, creditDelta: delta }),
      });
      await fetchUsers();
    } finally { setActionLoading(false); setActionTarget(null); }
  }

  async function handleRoleToggle(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Change this user's role to "${newRole}"?`)) return;
    setActionLoading(true);
    setActionTarget(userId);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      await fetchUsers();
    } finally { setActionLoading(false); setActionTarget(null); }
  }

  function ramp(end: number) {
    return Array.from({ length: 7 }, (_, i) => Math.round((end / 7) * (i + 1)));
  }

  const planVals  = PLAN_KEYS.map(k => stats?.planBreakdown?.[k] ?? 0);
  const planTotal = planVals.reduce((a, b) => a + b, 0);
  const genSpark  = ramp(stats?.generations?.total ?? 0);
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("en", { weekday: "short" });
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC", margin: 0, letterSpacing: "-0.02em" }}>
          Good {greeting}, {user?.name?.split(" ")[0] ?? "Admin"} 👋
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
          {new Date().toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Zencra Labs Command Center
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {statsLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 22, display: "flex", alignItems: "center", justifyContent: "center", height: 112 }}>
              <Spinner />
            </div>
          ))
        ) : (
          <>
            <StatCard title="Total Users"     value={(stats?.users.total ?? 0).toLocaleString()}         sub={`+${stats?.users.today ?? 0} today`}                    color="#2563EB" sparkline={ramp(stats?.users.total ?? 0)} />
            <StatCard title="Generations"     value={(stats?.generations.total ?? 0).toLocaleString()}   sub={`${stats?.generations.successRate ?? 100}% success`}     color="#8B5CF6" sparkline={genSpark} />
            <StatCard title="MRR"             value={`$${(stats?.revenue.mrr ?? 0).toFixed(0)}`}         sub="This month"                                              color="#10B981" sparkline={ramp(stats?.revenue.mrr ?? 0)} />
            <StatCard title="Credits in Use"  value={(stats?.credits.total ?? 0).toLocaleString()}       sub={`${stats?.users.paid ?? 0} paid users`}                 color="#F59E0B" sparkline={ramp(stats?.credits.total ?? 0)} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {/* Bar chart */}
        <div style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>Generation Activity</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Last 7 days (estimated from total)</p>
            </div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(139,92,246,0.12)", color: "#8B5CF6", fontWeight: 600 }}>
              +{stats?.generations.today ?? 0} today
            </span>
          </div>
          {statsLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}><Spinner /></div>
          ) : (
            <SvgBarChart values={genSpark} labels={dayLabels} color="#8B5CF6" />
          )}
        </div>

        {/* Donut chart */}
        <div style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>Plan Distribution</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>All users by subscription plan</p>
          </div>
          {statsLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}><Spinner /></div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <SvgDonutChart data={planVals} colors={PLAN_COLORS} total={planTotal} label="users" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {PLAN_KEYS.map((k, i) => {
                  const pct = planTotal > 0 ? Math.round((planVals[i] / planTotal) * 100) : 0;
                  const cfg = PLAN_CONFIG[k];
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1 }}>{cfg.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#F8FAFC" }}>{planVals[i]}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", width: 32, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { icon: "👥", label: "New This Week",    value: stats?.users.thisWeek, color: "#2563EB" },
          { icon: "💵", label: "ARR",               value: `$${(stats?.revenue.arr ?? 0).toFixed(0)}`, color: "#10B981" },
          { icon: "⚡", label: "Generated Today",  value: stats?.generations.today, color: "#8B5CF6" },
        ].map((item) => (
          <div key={item.label} style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
              <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 800, color: "#F8FAFC" }}>{statsLoading ? "—" : (item.value ?? "—")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent users table */}
      <div style={{ background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, marginBottom: 28, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>Recent Users</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Latest sign-ups</p>
          </div>
          <Link href="/hub/users" style={{ fontSize: 12, color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
        </div>

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 90px 80px 110px 80px", gap: 12, padding: "10px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {["User", "Email", "Plan", "Role", "Credits", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {usersLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}><Spinner /></div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No users found</div>
        ) : (
          users.map((u, idx) => (
            <div key={u.id}
              style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 90px 80px 110px 80px", gap: 12, padding: "12px 22px", alignItems: "center", borderBottom: idx < users.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                <UserAvatar name={u.full_name || u.email || "?"} avatar={u.avatar_url} size={32} />
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#F8FAFC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.full_name || "—"}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {new Date(u.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email || "—"}</span>
              <div><PlanBadge plan={u.plan} /></div>
              <div><RoleBadge role={u.role} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>{u.credits.toLocaleString()}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {[50, -50].map(delta => (
                    <button key={delta}
                      disabled={actionLoading && actionTarget === u.id}
                      onClick={() => handleCreditAdj(u.id, delta)}
                      style={{ width: 18, height: 18, borderRadius: 4, background: delta > 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", border: "none", cursor: "pointer", color: delta > 0 ? "#10B981" : "#EF4444", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      {delta > 0 ? "+" : "−"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button
                  disabled={actionLoading && actionTarget === u.id}
                  onClick={() => handleRoleToggle(u.id, u.role)}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                  {actionLoading && actionTarget === u.id ? "…" : "Role"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick navigation */}
      <div>
        <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>Quick Navigation</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Manage Users",    sub: "View & edit accounts",  href: "/hub/users",         icon: "👥", color: "#2563EB" },
            { label: "Generations",     sub: "All AI jobs log",       href: "/hub/generations",   icon: "⚡", color: "#8B5CF6" },
            { label: "Revenue",         sub: "Payments & MRR",        href: "/hub/revenue",       icon: "💵", color: "#10B981" },
            { label: "Credit Controls", sub: "Adjust balances",       href: "/hub/credits",       icon: "🪙", color: "#F59E0B" },
            { label: "Subscriptions",   sub: "Plans & renewals",      href: "/hub/subscriptions", icon: "💳", color: "#3B82F6" },
            { label: "Promo Codes",     sub: "Manage discounts",      href: "/hub/promos",        icon: "🏷️", color: "#EC4899" },
            { label: "Gallery",         sub: "Moderate content",      href: "/hub/gallery",       icon: "🖼️", color: "#06B6D4" },
            { label: "Settings",        sub: "Site configuration",    href: "/hub/settings",      icon: "⚙️", color: "#94A3B8" },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#0A1628", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, textDecoration: "none", transition: "all 0.15s ease" }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${item.color}50`;
                el.style.background = `${item.color}08`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.background = "#0A1628";
              }}
            >
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>{item.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
