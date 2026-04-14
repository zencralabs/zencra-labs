"use client";

export default function HubGalleryPage() {
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Gallery</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Manage public showcase and member-submitted content</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[{ label: "Total Items", value: "0", color: "#2563EB" }, { label: "Published", value: "0", color: "#10B981" }, { label: "Pending Review", value: "0", color: "#F59E0B" }].map(c => (
          <div key={c.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "64px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🖼️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC", marginBottom: 8 }}>Gallery Management</div>
        <div style={{ fontSize: 14, color: "#475569", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>Generated images and videos from members will appear here. You can approve, feature, or remove content from the public showcase.</div>
      </div>
    </div>
  );
}
