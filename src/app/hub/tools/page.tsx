"use client";

const TOOLS = [
  { name: "GPT Image 1.5",    type: "Image",  status: "active",     provider: "OpenAI",     credits: 2 },
  { name: "DALL·E 3",         type: "Image",  status: "active",     provider: "OpenAI",     credits: 2 },
  { name: "Nano Banana Pro",  type: "Image",  status: "soon",       provider: "Nano",       credits: 3 },
  { name: "Kling 2.6",        type: "Video",  status: "active",     provider: "Kling",      credits: 8 },
  { name: "Kling 3.0",        type: "Video",  status: "active",     provider: "Kling",      credits: 10 },
  { name: "Runway ML",        type: "Video",  status: "active",     provider: "Runway",     credits: 8 },
  { name: "Seedance 2.0",     type: "Video",  status: "active",     provider: "Seedance",   credits: 6 },
  { name: "Veo",              type: "Video",  status: "soon",       provider: "Google",     credits: 10 },
  { name: "HeyGen",           type: "Video",  status: "active",     provider: "HeyGen",     credits: 6 },
  { name: "ElevenLabs TTS",   type: "Audio",  status: "active",     provider: "ElevenLabs", credits: 2 },
  { name: "Kits AI",          type: "Audio",  status: "soon",       provider: "Kits",       credits: 3 },
];

const TYPE_COLOR: Record<string, string> = { Image: "#8B5CF6", Video: "#0EA5A0", Audio: "#F59E0B" };

export default function HubToolsPage() {
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", margin: 0 }}>Tools</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>AI tools catalogue — {TOOLS.filter(t => t.status === "active").length} active, {TOOLS.filter(t => t.status === "soon").length} coming soon</p>
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Tool", "Type", "Provider", "Credits/Use", "Status"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t, i) => (
              <tr key={t.name} style={{ borderBottom: i < TOOLS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>{t.name}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[t.type], backgroundColor: `${TYPE_COLOR[t.type]}18`, padding: "2px 8px", borderRadius: 10 }}>{t.type}</span>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: "#94A3B8" }}>{t.provider}</td>
                <td style={{ padding: "13px 16px", fontSize: 13, color: "#60A5FA", fontWeight: 600 }}>{t.credits}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.status === "active" ? "#10B981" : "#F59E0B", backgroundColor: t.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 10, textTransform: "capitalize" }}>
                    {t.status === "soon" ? "Coming Soon" : "Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
