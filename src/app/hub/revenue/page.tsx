"use client";

export default function HubRevenuePage() {
  const cards = [
    { label: "MRR", value: "$0", sub: "Monthly recurring revenue" },
    { label: "ARR", value: "$0", sub: "Annual recurring revenue" },
    { label: "Total Revenue", value: "$0", sub: "All time" },
    { label: "Paid Users", value: "0", sub: "Active subscribers" },
  ];
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Revenue</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Subscription revenue and financial overview</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{c.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <ComingSoon section="Revenue Charts" description="Stripe integration and revenue analytics will appear here once payment processing is configured." />
    </div>
  );
}

function ComingSoon({ section, description }: { section: string; description: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "64px 48px", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>{section}</div>
      <div style={{ fontSize: 14, color: "#475569", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>{description}</div>
    </div>
  );
}
