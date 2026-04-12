"use client";

import { useState, useCallback } from "react";
import { User, Mail, Phone, Calendar, Camera, Save, CheckCircle, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE — Edit personal info, persists to Supabase
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "linear-gradient(135deg,#2563EB,#0EA5A0)",
  "linear-gradient(135deg,#7c3aed,#2563EB)",
  "linear-gradient(135deg,#c2410c,#A855F7)",
  "linear-gradient(135deg,#0d6b67,#2563EB)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#EC4899,#8B5CF6)",
  "linear-gradient(135deg,#0EA5A0,#22C55E)",
  "linear-gradient(135deg,#F97316,#EAB308)",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [name,        setName]       = useState(user?.name ?? "");
  const [selectedGrad, setSelGrad]  = useState(user?.avatarColor ?? 0);
  const [saveState,   setSaveState]  = useState<SaveState>("idle");
  const [errorMsg,    setErrorMsg]   = useState("");

  const authHeader = useCallback((): Record<string, string> => {
    if (!user?.accessToken) return {};
    return { Authorization: `Bearer ${user.accessToken}` };
  }, [user?.accessToken]);

  if (!user) return null;

  const initials  = name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const joinDate  = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const hasChanges = name !== (user.name ?? "") || selectedGrad !== (user.avatarColor ?? 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges || saveState === "saving") return;

    setSaveState("saving");
    setErrorMsg("");

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ full_name: name, avatar_color: selectedGrad }),
      });
      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        setSaveState("saved");
        await refreshUser();          // re-sync AuthContext with DB
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setErrorMsg(json.error ?? "Save failed");
        setSaveState("error");
      }
    } catch {
      setErrorMsg("Network error — please try again");
      setSaveState("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "10px 14px", color: "var(--page-text)", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Profile</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Manage your personal information</p>
      </div>

      {/* Avatar section */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", margin: "0 0 20px" }}>Avatar</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Current avatar */}
          <div style={{ position: "relative" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: AVATAR_COLORS[selectedGrad], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {initials}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: "50%", backgroundColor: "var(--page-bg-2)", border: "2px solid #080E1C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={10} style={{ color: "#64748B" }} />
            </div>
          </div>
          {/* Color options */}
          <div>
            <p style={{ fontSize: 11, color: "#64748B", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose Color</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AVATAR_COLORS.map((g, i) => (
                <button key={i} onClick={() => setSelGrad(i)}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: g, border: selectedGrad === i ? "2px solid #60A5FA" : "2px solid transparent", cursor: "pointer", transition: "border 0.15s" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info form */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", margin: "0 0 20px" }}>Personal Information</h2>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Full name */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Name</label>
              <div style={{ position: "relative" }}>
                <User size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
            </div>
            {/* Email — read-only, show lock if locked */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email
                {user.emailLocked && (
                  <span style={{ marginLeft: 6, color: "#F59E0B", fontSize: 10 }}><Lock size={10} style={{ display: "inline", verticalAlign: "middle" }} /> Locked</span>
                )}
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  style={{ ...inputStyle, paddingLeft: 34, opacity: 0.5, cursor: "not-allowed" }}
                />
              </div>
              {user.emailLocked && (
                <p style={{ fontSize: 11, color: "#F59E0B", marginTop: 4 }}>Email is locked after subscription purchase.</p>
              )}
              {!user.emailVerified && user.email && (
                <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ Email not verified</p>
              )}
            </div>
          </div>

          {/* Phone number */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone Number</label>
            <div style={{ position: "relative" }}>
              <Phone size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                type="tel"
                value={user.phone ?? ""}
                readOnly
                placeholder={user.needsPhone ? "Not added — go to Settings to add" : ""}
                style={{ ...inputStyle, paddingLeft: 34, opacity: 0.5, cursor: "not-allowed" }}
              />
            </div>
            {user.needsPhone && (
              <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 4 }}>
                <a href="/dashboard/settings#security" style={{ color: "#60a5fa" }}>Add a phone number</a> to improve account security.
              </p>
            )}
            {user.phoneVerified && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>✓ Verified</p>
            )}
          </div>

          {/* Member since */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <Calendar size={13} style={{ color: "#475569" }} />
            <span style={{ fontSize: 12, color: "#64748B" }}>Member since <strong style={{ color: "#94A3B8" }}>{joinDate}</strong></span>
          </div>

          {/* Plan badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Current plan:</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", backgroundColor: "rgba(37,99,235,0.12)", padding: "2px 10px", borderRadius: 10, border: "1px solid rgba(37,99,235,0.3)" }}>{user.plan}</span>
            <a href="/dashboard/subscription" style={{ fontSize: 11, color: "#60a5fa", marginLeft: "auto", textDecoration: "none" }}>Upgrade →</a>
          </div>

          {errorMsg && (
            <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={!hasChanges || saveState === "saving"}
            style={{
              alignSelf: "flex-start",
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: saveState === "saved"
                ? "rgba(16,185,129,0.15)"
                : !hasChanges
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg,#2563EB,#0EA5A0)",
              color: saveState === "saved" ? "#10B981" : !hasChanges ? "#475569" : "#fff",
              fontSize: 13, fontWeight: 700,
              cursor: !hasChanges || saveState === "saving" ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {saveState === "saving"
              ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</>
              : saveState === "saved"
              ? <><CheckCircle size={14} /> Saved!</>
              : <><Save size={14} /> Save Changes</>
            }
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
