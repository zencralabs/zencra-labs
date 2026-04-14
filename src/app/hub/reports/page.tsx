"use client";

export default function HubReportsPage() {
  const reports = [
    { name: "User Growth Report", desc: "New signups over time, plan conversion rates", icon: "👥", status: "soon" },
    { name: "Revenue Report",     desc: "MRR trends, churn rate, ARPU analysis",        icon: "💰", status: "soon" },
    { name: "Generation Report",  desc: "AI usage by type, tool, and time period",       icon: "⚡", status: "soon" },
    { name: "Credit Report",      desc: "Credit consumption trends and top users",        icon: "🔋", status: "soon" },
  ];
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Reports</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Analytics and exportable platform reports</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {reports.map(r => (
          <div key={r.name} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 16, opacity: 0.7 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginBottom: 12 }}>{r.desc}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 10 }}>Coming Soon</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
