"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ImageIcon, Film, Music } from "lucide-react";

interface Generation {
  id: string;
  user_id: string;
  type: string;
  status: string;
  credits_used: number;
  created_at: string;
  prompt?: string;
  profiles?: { full_name: string; email: string };
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={14} />,
  video: <Film size={14} />,
  audio: <Music size={14} />,
};
const STATUS_COLOR: Record<string, string> = {
  completed: "#10B981", pending: "#F59E0B", failed: "#EF4444", processing: "#2563EB",
};

export default function HubGenerationsPage() {
  const [rows, setRows]       = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setType] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const params = typeFilter !== "all" ? `?type=${typeFilter}` : "";
      const res  = await fetch(`/api/admin/generations${params}`);
      const json = await res.json();
      setRows(json.generations ?? []);
    } catch { setRows([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Generations</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>All AI generation activity across the platform</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={typeFilter} onChange={e => setType(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0F1A2E", color: "#94A3B8", fontSize: 13, cursor: "pointer", outline: "none" }}>
            <option value="all">All Types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94A3B8", cursor: "pointer", fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Type", "User", "Prompt", "Status", "Credits", "Date"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#475569" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#475569" }}>No generations yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94A3B8", fontSize: 12 }}>
                    {TYPE_ICON[r.type] ?? <ImageIcon size={14} />}
                    <span style={{ textTransform: "capitalize" }}>{r.type}</span>
                  </div>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: "#94A3B8" }}>
                  {r.profiles?.full_name || r.profiles?.email || r.user_id?.slice(0, 8) + "…"}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748B", maxWidth: 280 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.prompt || "—"}
                  </span>
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[r.status] ?? "#64748B", backgroundColor: `${STATUS_COLOR[r.status] ?? "#64748B"}18`, padding: "2px 8px", borderRadius: 10, textTransform: "capitalize" }}>{r.status}</span>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: "#60A5FA", fontWeight: 600 }}>
                  {r.credits_used ?? 0}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: "#475569" }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
