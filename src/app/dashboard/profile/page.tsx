"use client";

import { useState } from "react";
import { User, Mail, Calendar, Camera, Save, CheckCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE — Edit personal info
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg,#2563EB,#0EA5A0)",
  "linear-gradient(135deg,#7c3aed,#2563EB)",
  "linear-gradient(135deg,#c2410c,#A855F7)",
  "linear-gradient(135deg,#0d6b67,#2563EB)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [saved, setSaved]           = useState(false);
  const [name, setName]             = useState(user?.name ?? "");
  const [bio, setBio]               = useState("");
  const [website, setWebsite]       = useState("");
  const [selectedGrad, setSelGrad]  = useState(0);

  if (!user) return null;

  const initials  = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const joinDate  = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", padding: "10px 14px", color: "var(--page-text)", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "700px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Profile</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Manage your personal information</p>
      </div>

      {/* Avatar section */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", margin: "0 0 20px" }}>Avatar</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Current avatar */}
          <div style={{ position: "relative" }}>
            <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: AVATAR_COLORS[selectedGrad], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 800, color: "#fff" }}>
              {initials}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "var(--page-bg-2)", border: "2px solid #080E1C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={10} style={{ color: "#64748B" }} />
            </div>
          </div>
          {/* Color options */}
          <div>
            <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose Color</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {AVATAR_COLORS.map((g, i) => (
                <button key={i} onClick={() => setSelGrad(i)}
                  style={{ width: "28px", height: "28px", borderRadius: "50%", background: g, border: selectedGrad === i ? "2px solid #60A5FA" : "2px solid transparent", cursor: "pointer", transition: "border 0.15s" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info form */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", margin: "0 0 20px" }}>Personal Information</h2>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Name</label>
              <div style={{ position: "relative" }}>
                <User size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, paddingLeft: "34px" }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input type="email" value={user.email} readOnly style={{ ...inputStyle, paddingLeft: "34px", opacity: 0.5, cursor: "not-allowed" }} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              placeholder="Tell the community a bit about yourself…"
              style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Website / Portfolio</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourwebsite.com"
              style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
          </div>

          {/* Member since */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Calendar size={13} style={{ color: "#475569" }} />
            <span style={{ fontSize: "12px", color: "#64748B" }}>Member since <strong style={{ color: "#94A3B8" }}>{joinDate}</strong></span>
          </div>

          <button type="submit"
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "10px", border: "none", background: saved ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#2563EB,#0EA5A0)", color: saved ? "#10B981" : "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
