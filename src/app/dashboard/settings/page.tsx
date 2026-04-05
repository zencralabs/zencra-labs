"use client";

import { useState } from "react";
import { Bell, Lock, Shield, Trash2, Moon, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE — Notifications, security, account preferences
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const [emailNotifs, setEmailNotifs]         = useState(true);
  const [marketingNotifs, setMarketingNotifs] = useState(false);
  const [creditAlerts, setCreditAlerts]       = useState(true);
  const [saved, setSaved]                     = useState(false);
  const [deleteConfirm, setDeleteConfirm]     = useState(false);

  if (!user) return null;

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!value)}
        style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", backgroundColor: value ? "#2563EB" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
      </button>
    );
  }

  const sectionStyle: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px",
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "680px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Manage your account preferences</p>
      </div>

      {/* Notifications */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={15} style={{ color: "#2563EB" }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Notifications</div>
        </div>
        {[
          { label: "Email notifications",          sub: "Receive email updates about your generations",    val: emailNotifs,      set: setEmailNotifs      },
          { label: "Marketing emails",             sub: "Receive tips, feature announcements, and offers", val: marketingNotifs,  set: setMarketingNotifs  },
          { label: "Low credit alerts",            sub: "Get notified when your credits fall below 10",    val: creditAlerts,     set: setCreditAlerts     },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", marginBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)" }}>{item.label}</div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{item.sub}</div>
            </div>
            <Toggle value={item.val} onChange={item.set} />
          </div>
        ))}
        <button onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", borderRadius: "9px", border: "none", background: saved ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#2563EB,#0EA5A0)", color: saved ? "#10B981" : "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
          {saved ? <><CheckCircle size={13} /> Saved!</> : "Save Preferences"}
        </button>
      </div>

      {/* Security */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={15} style={{ color: "#A855F7" }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Security</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)", cursor: "pointer", color: "var(--page-text)" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Change Password</div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Update your account password</div>
            </div>
            <span style={{ fontSize: "11px", color: "#60A5FA", fontWeight: 600 }}>Update →</span>
          </button>
          <button style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)", cursor: "pointer", color: "var(--page-text)" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Two-Factor Authentication</div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Add an extra layer of security</div>
            </div>
            <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 600 }}>Enable →</span>
          </button>
        </div>
      </div>

      {/* Privacy */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "rgba(14,165,160,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={15} style={{ color: "#0EA5A0" }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Privacy</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)" }}>Profile Visibility</div>
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Control who can see your profile</div>
          </div>
          <select style={{ backgroundColor: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#94A3B8", fontSize: "11px", padding: "5px 10px", cursor: "pointer", outline: "none" }}>
            <option>Private</option>
            <option>Public</option>
            <option>Friends only</option>
          </select>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...sectionStyle, border: "1px solid rgba(239,68,68,0.2)", marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={15} style={{ color: "#EF4444" }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#EF4444" }}>Danger Zone</div>
        </div>
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "16px" }}>
          Deleting your account is permanent. All your credits, generations, and data will be removed.
        </p>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "9px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <Trash2 size={13} /> Delete My Account
          </button>
        ) : (
          <div style={{ padding: "14px", backgroundColor: "rgba(239,68,68,0.08)", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p style={{ fontSize: "12px", color: "#FCA5A5", marginBottom: "12px", fontWeight: 600 }}>
              Are you absolutely sure? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { logout(); }} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#EF4444", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                Yes, Delete Account
              </button>
              <button onClick={() => setDeleteConfirm(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "#94A3B8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
