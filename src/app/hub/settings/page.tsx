"use client";

import { useState } from "react";
import { Save } from "lucide-react";

export default function HubSettingsPage() {
  const [siteName, setSiteName] = useState("Zencra Labs");
  const [tagline, setTagline]   = useState("Intelligence by Design");
  const [saved, setSaved]       = useState(false);

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const sections = [
    {
      title: "Site Settings",
      fields: [
        { label: "Site Name",    value: siteName, onChange: setSiteName },
        { label: "Tagline",      value: tagline,  onChange: setTagline  },
      ],
    },
  ];

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>Platform configuration and admin preferences</p>
      </div>

      <div style={{ maxWidth: 640 }}>
        {sections.map(s => (
          <div key={s.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", marginBottom: 20 }}>{s.title}</div>
            {s.fields.map(f => (
              <div key={f.label} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 6 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.onChange(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
        ))}

        {/* Feature flags */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", marginBottom: 20 }}>Feature Flags</div>
          {[
            { label: "Public Gallery",       desc: "Show member content in public gallery" },
            { label: "Referral System",      desc: "Enable referral links and rewards" },
            { label: "Promo Codes",          desc: "Allow users to redeem promo codes" },
            { label: "Studio — Image Gen",   desc: "Image generation tools in studio" },
            { label: "Studio — Video Gen",   desc: "Video generation tools in studio" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{f.desc}</div>
              </div>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: "rgba(37,99,235,0.3)", border: "1px solid rgba(37,99,235,0.4)", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#2563EB", position: "absolute", top: 2, left: 18, transition: "left 0.2s" }} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={saveSettings}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 8, border: "none", background: saved ? "#10B981" : "#2563EB", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "background 0.2s" }}>
          <Save size={15} /> {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
