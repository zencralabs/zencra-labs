"use client";

import { useEffect, useState } from "react";
import { Zap, RefreshCw, Plus } from "lucide-react";

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
}

const TYPE_COLOR: Record<string, string> = {
  grant: "#10B981", deduct: "#EF4444", purchase: "#2563EB", refund: "#F59E0B",
};

export default function HubCreditsPage() {
  const [txns, setTxns]       = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantUser, setGrantUser] = useState("");
  const [grantAmt, setGrantAmt]   = useState("100");
  const [granting, setGranting]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/transactions?limit=50");
      const json = await res.json();
      setTxns(json.transactions ?? []);
    } catch { setTxns([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function grantCredits() {
    if (!grantUser || !grantAmt) return;
    setGranting(true);
    try {
      await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: grantUser, amount: Number(grantAmt), description: "Admin grant" }),
      });
      setGrantUser(""); setGrantAmt("100");
      load();
    } catch { /* */ }
    setGranting(false);
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Credits</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Transaction history and manual credit grants</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94A3B8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Grant panel */}
      <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 12, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>User ID or Email</label>
          <input value={grantUser} onChange={e => setGrantUser(e.target.value)} placeholder="user-uuid or email"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Amount</label>
          <input type="number" value={grantAmt} onChange={e => setGrantAmt(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={grantCredits} disabled={granting}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: granting ? 0.6 : 1 }}>
          <Plus size={14} /> Grant Credits
        </button>
      </div>

      {/* Transactions table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["User", "Type", "Amount", "Description", "Date"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: "center", color: "#475569" }}>Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: "center", color: "#475569" }}>No transactions yet</td></tr>
            ) : txns.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < txns.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "13px 16px", fontSize: 13, color: "#94A3B8" }}>
                  {t.profiles?.full_name || t.profiles?.email || t.user_id?.slice(0, 8) + "…"}
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[t.type] ?? "#64748B", backgroundColor: `${TYPE_COLOR[t.type] ?? "#64748B"}18`, padding: "2px 8px", borderRadius: 10, textTransform: "capitalize" }}>{t.type}</span>
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.amount > 0 ? "#10B981" : "#EF4444" }}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </span>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748B" }}>{t.description || "—"}</td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: "#475569" }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
