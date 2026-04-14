"use client";

function ComingSoon({ icon, section, description }: { icon: string; section: string; description: string }) {
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Subscriptions</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Manage user subscription plans and billing</p>
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "64px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>{section}</div>
        <div style={{ fontSize: 14, color: "#475569", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>{description}</div>
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
          {["Free", "Starter", "Pro", "Creator"].map((plan, i) => {
            const colors = ["#64748B", "#2563EB", "#0EA5A0", "#A855F7"];
            return (
              <div key={plan} style={{ padding: "8px 20px", borderRadius: 20, border: `1px solid ${colors[i]}40`, color: colors[i], background: `${colors[i]}12`, fontSize: 13, fontWeight: 600 }}>{plan}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HubSubscriptionsPage() {
  return <ComingSoon icon="💳" section="Subscription Management" description="Stripe integration will power this page. Once connected, you'll be able to view active subscriptions, manage billing, and handle plan changes here." />;
}
