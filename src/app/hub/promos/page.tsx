"use client";

import { useState } from "react";
import { Plus, Tag } from "lucide-react";

export default function HubPromosPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Promo Codes</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Create and manage discount and credit codes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> Create Code
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={16} style={{ color: "#60A5FA" }} /> New Promo Code
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {["Code (e.g. WELCOME50)", "Credit Amount", "Max Uses"].map(label => (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{label}</label>
                <input placeholder={label} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save Code</button>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748B", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "64px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🏷️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>No Promo Codes Yet</div>
        <div style={{ fontSize: 14, color: "#475569", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>Create your first promo code using the button above. Codes can grant credits or unlock early access.</div>
      </div>
    </div>
  );
}
