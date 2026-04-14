"use client";

export default function HubReferralsPage() {
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Referrals</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Track referral links and reward payouts</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[{ label: "Total Referrals", value: "0", icon: "🔗" }, { label: "Successful", value: "0", icon: "✅" }, { label: "Credits Paid Out", value: "0", icon: "⚡" }].map(c => (
          <div key={c.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 28 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#F8FAFC", marginTop: 4 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "56px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>👥</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>Referral Tracking</div>
        <div style={{ fontSize: 14, color: "#475569", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>Referral links and reward tracking will appear here once the referral system is activated in your database.</div>
      </div>
    </div>
  );
}
