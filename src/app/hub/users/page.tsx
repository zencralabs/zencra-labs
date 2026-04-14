"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, RefreshCw, ChevronDown } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  plan: string;
  role: string;
  credits: number;
  created_at: string;
}

const PLAN_COLOR: Record<string, string> = {
  free: "#64748B", starter: "#2563EB", pro: "#0EA5A0", creator: "#A855F7",
};

export default function HubUsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [planFilter, setPlan]   = useState("all");
  const [roleFilter, setRole]   = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users?limit=100");
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch { setUsers([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateCredits(id: string, delta: number) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, creditDelta: delta }),
    });
    load();
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: newRole }),
    });
    load();
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "all" || u.plan === planFilter;
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchPlan && matchRole;
  });

  return (
    <div style={{ padding: "32px 36px", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Users</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
            {users.length} total member{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94A3B8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <UserPlus size={14} /> Invite User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select value={planFilter} onChange={e => setPlan(e.target.value)}
          style={{ padding: "9px 32px 9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0F1A2E", color: "#94A3B8", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="creator">Creator</option>
        </select>
        <select value={roleFilter} onChange={e => setRole(e.target.value)}
          style={{ padding: "9px 32px 9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0F1A2E", color: "#94A3B8", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["User", "Plan", "Role", "Credits", "Joined", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#475569", fontSize: 14 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#475569", fontSize: 14 }}>No users found</td></tr>
            ) : filtered.map((u, i) => {
              const initials = (u.full_name || u.email || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
              const planColor = PLAN_COLOR[u.plan] ?? "#64748B";
              return (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"}>
                  {/* User */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>{u.full_name || "—"}</div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Plan */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: planColor, backgroundColor: `${planColor}20`, padding: "2px 8px", borderRadius: 10, border: `1px solid ${planColor}40`, textTransform: "capitalize" }}>{u.plan}</span>
                  </td>
                  {/* Role */}
                  <td style={{ padding: "14px 16px" }}>
                    <button onClick={() => toggleRole(u.id, u.role)}
                      style={{ fontSize: 11, fontWeight: 600, color: u.role === "admin" ? "#F59E0B" : "#64748B", backgroundColor: u.role === "admin" ? "rgba(245,158,11,0.1)" : "rgba(100,116,139,0.1)", padding: "2px 8px", borderRadius: 10, border: `1px solid ${u.role === "admin" ? "rgba(245,158,11,0.3)" : "rgba(100,116,139,0.2)"}`, cursor: "pointer", textTransform: "capitalize" }}>
                      {u.role}
                    </button>
                  </td>
                  {/* Credits */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => updateCredits(u.id, -50)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#60A5FA", minWidth: 36, textAlign: "center" }}>{u.credits?.toLocaleString() ?? 0}</span>
                      <button onClick={() => updateCredits(u.id, 50)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.08)", color: "#60A5FA", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  </td>
                  {/* Joined */}
                  <td style={{ padding: "14px 16px", fontSize: 12, color: "#475569" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  {/* Actions */}
                  <td style={{ padding: "14px 16px" }}>
                    <button style={{ fontSize: 12, color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
