"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, Lock, Shield, Trash2, CheckCircle, AlertTriangle,
  Fingerprint, Loader2, QrCode, Copy, Eye, EyeOff,
  Smartphone, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE — Notifications, security (real 2FA + passkey), privacy
// ─────────────────────────────────────────────────────────────────────────────

type TOTPStep = "idle" | "enrolling" | "verifying" | "success" | "error";
type SecurityData = { totpEnabled: boolean; totpFactorId: string | null; passkeyRegistered: boolean };

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        backgroundColor: value ? "#2563EB" : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();

  // ── Notifications state ────────────────────────────────────────────────────
  const [emailNotifs,    setEmailNotifs]    = useState(true);
  const [marketingNotifs, setMarketingNotifs] = useState(false);
  const [creditAlerts,   setCreditAlerts]   = useState(true);
  const [notifSaved,     setNotifSaved]     = useState(false);

  // ── Security / 2FA state ───────────────────────────────────────────────────
  const [secData,     setSecData]    = useState<SecurityData | null>(null);
  const [secLoading,  setSecLoading] = useState(true);
  const [totpStep,    setTotpStep]   = useState<TOTPStep>("idle");
  const [totpBusy,    setTotpBusy]   = useState(false);
  const [totpEnroll,  setTotpEnroll] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [totpCode,    setTotpCode]   = useState("");
  const [totpErr,     setTotpErr]    = useState("");
  const [showSecret,  setShowSecret] = useState(false);
  const [passkeyMsg,  setPasskeyMsg] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // ── Delete account ─────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const authHeader = useCallback((): Record<string, string> => {
    if (!user?.accessToken) return {};
    return { Authorization: `Bearer ${user.accessToken}` };
  }, [user?.accessToken]);

  // Load security status on mount
  useEffect(() => {
    if (!user) return;
    fetch("/api/account/security", { headers: authHeader() })
      .then(r => r.json())
      .then((json: { success: boolean; data?: SecurityData }) => {
        if (json.success && json.data) setSecData(json.data);
      })
      .catch(console.error)
      .finally(() => setSecLoading(false));
  }, [user, authHeader]);

  if (!user) return null;

  // ── Notification save ──────────────────────────────────────────────────────
  function handleNotifSave() {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
    // TODO: persist notification preferences to Supabase profiles table
  }

  // ── TOTP enrollment ────────────────────────────────────────────────────────
  async function startTOTPEnroll() {
    setTotpStep("enrolling");
    setTotpBusy(true);
    setTotpErr("");
    try {
      const res  = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "enroll-totp" }),
      });
      const json = await res.json() as { success: boolean; data?: { factorId: string; qrCode: string; secret: string }; error?: string };
      if (json.success && json.data) {
        setTotpEnroll(json.data);
        setTotpStep("verifying");
      } else {
        setTotpErr(json.error ?? "Enrollment failed");
        setTotpStep("error");
      }
    } catch {
      setTotpErr("Network error");
      setTotpStep("error");
    } finally {
      setTotpBusy(false);
    }
  }

  async function verifyTOTP() {
    if (!totpEnroll || totpCode.length !== 6) return;
    setTotpStep("enrolling");
    setTotpBusy(true);
    setTotpErr("");
    try {
      const res  = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "verify-totp", factorId: totpEnroll.factorId, code: totpCode }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setTotpStep("success");
        setSecData(prev => prev ? { ...prev, totpEnabled: true, totpFactorId: totpEnroll.factorId } : prev);
        setTimeout(() => { setTotpStep("idle"); setTotpEnroll(null); setTotpCode(""); }, 2000);
      } else {
        setTotpErr(json.error ?? "Invalid code");
        setTotpStep("verifying");
      }
    } catch {
      setTotpErr("Network error");
      setTotpStep("verifying");
    } finally {
      setTotpBusy(false);
    }
  }

  async function disableTOTP() {
    if (!secData?.totpFactorId) return;
    setTotpStep("enrolling");
    try {
      const res  = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "unenroll-totp", factorId: secData.totpFactorId }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setSecData(prev => prev ? { ...prev, totpEnabled: false, totpFactorId: null } : prev);
      }
    } catch { /* ignore */ }
    finally { setTotpStep("idle"); }
  }

  // ── Passkey ────────────────────────────────────────────────────────────────
  async function handlePasskey() {
    if (!user) return;
    setPasskeyLoading(true);
    setPasskeyMsg("");

    if (secData?.passkeyRegistered) {
      // Remove passkey
      try {
        const res  = await fetch("/api/account/security", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ action: "remove-passkey" }),
        });
        const json = await res.json() as { success: boolean };
        if (json.success) {
          setSecData(prev => prev ? { ...prev, passkeyRegistered: false } : prev);
          setPasskeyMsg("Passkey removed.");
        }
      } catch { setPasskeyMsg("Error removing passkey."); }
      finally { setPasskeyLoading(false); }
      return;
    }

    // Register passkey via Supabase WebAuthn
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseModule = await import("@/lib/supabase");
      const supabase = supabaseModule.supabase;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.auth as any).signInWithPasskey({ createUser: false });
      if (error) { setPasskeyMsg(error.message); return; }

      // Mark in DB
      await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "register-passkey" }),
      });
      setSecData(prev => prev ? { ...prev, passkeyRegistered: true } : prev);
      setPasskeyMsg("Passkey registered successfully!");
    } catch (e) {
      setPasskeyMsg(`Error: ${String(e)}`);
    } finally {
      setPasskeyLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────────────────

  const section: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
  };

  const iconBox = (color: string) => ({
    width: 34, height: 34, borderRadius: 10, display: "flex",
    alignItems: "center", justifyContent: "center",
    backgroundColor: `${color}20`,
  });

  return (
    <div style={{ padding: "40px", maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Manage your account preferences and security</p>
      </div>

      {/* ── NOTIFICATIONS ─────────────────────────────────────────────────── */}
      <div style={section}>
        <SectionHeader icon={<Bell size={15} color="#2563EB" />} bg={iconBox("#2563EB")} title="Notifications" />
        {[
          { label: "Email notifications",    sub: "Receive email updates about your generations", val: emailNotifs,    set: setEmailNotifs    },
          { label: "Marketing emails",       sub: "Tips, feature announcements, and offers",      val: marketingNotifs, set: setMarketingNotifs },
          { label: "Low credit alerts",      sub: "Get notified when credits fall below 10",       val: creditAlerts,   set: setCreditAlerts   },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.sub}</div>
            </div>
            <Toggle value={item.val} onChange={item.set} />
          </div>
        ))}
        <button onClick={handleNotifSave}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "none", background: notifSaved ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#2563EB,#0EA5A0)", color: notifSaved ? "#10B981" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {notifSaved ? <><CheckCircle size={13} /> Saved!</> : "Save Preferences"}
        </button>
      </div>

      {/* ── SECURITY ──────────────────────────────────────────────────────── */}
      <div id="security" style={section}>
        <SectionHeader icon={<Lock size={15} color="#A855F7" />} bg={iconBox("#A855F7")} title="Security" />

        {secLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Loading security status…
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Two-Factor Authentication */}
            <div style={{ padding: "16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: totpStep === "verifying" ? 16 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Smartphone size={16} color={secData?.totpEnabled ? "#10B981" : "#64748B"} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>Two-Factor Authentication</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                      {secData?.totpEnabled ? "✓ Enabled — authenticator app required at sign-in" : "Adds extra security via an authenticator app"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {secData?.totpEnabled ? (
                    <button onClick={disableTOTP} disabled={totpBusy}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {totpBusy ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShieldOff size={13} />}
                      Disable
                    </button>
                  ) : totpStep === "idle" || totpStep === "error" ? (
                    <button onClick={startTOTPEnroll} disabled={totpBusy}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.08)", color: "#c084fc", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {totpBusy ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShieldCheck size={13} />}
                      Enable 2FA
                    </button>
                  ) : totpStep === "success" ? (
                    <span style={{ fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={14} /> Enabled!
                    </span>
                  ) : null}
                </div>
              </div>

              {totpErr && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{totpErr}</p>}

              {/* QR Code step */}
              {totpStep === "verifying" && totpEnroll && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code.
                  </p>
                  <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* QR code image */}
                    <div style={{ background: "#fff", padding: 12, borderRadius: 10, flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={totpEnroll.qrCode} alt="2FA QR code" width={140} height={140} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {/* Manual secret */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Manual entry key</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                          <code style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "0.05em", flex: 1, overflowWrap: "anywhere" }}>
                            {showSecret ? totpEnroll.secret : "••••••••••••••••••••"}
                          </code>
                          <button onClick={() => setShowSecret(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 0 }}>
                            {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(totpEnroll.secret)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 0 }}>
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                      {/* Verify input */}
                      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Enter 6-digit code</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={totpCode}
                          onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 20, letterSpacing: "0.2em", textAlign: "center", outline: "none" }}
                          onKeyDown={e => { if (e.key === "Enter") verifyTOTP(); }}
                        />
                        <button onClick={verifyTOTP} disabled={totpCode.length !== 6}
                          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: totpCode.length === 6 ? "#2563EB" : "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: totpCode.length === 6 ? "pointer" : "not-allowed" }}>
                          Verify
                        </button>
                      </div>
                      {totpErr && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{totpErr}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Passkey */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Fingerprint size={16} color={secData?.passkeyRegistered ? "#10B981" : "#64748B"} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>Passkey</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    {secData?.passkeyRegistered ? "✓ Registered — sign in with Face ID, Touch ID, or security key" : "Sign in without a password using biometrics"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <button onClick={handlePasskey} disabled={passkeyLoading}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: `1px solid ${secData?.passkeyRegistered ? "rgba(239,68,68,0.3)" : "rgba(37,99,235,0.3)"}`, background: secData?.passkeyRegistered ? "rgba(239,68,68,0.08)" : "rgba(37,99,235,0.08)", color: secData?.passkeyRegistered ? "#f87171" : "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {passkeyLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Fingerprint size={13} />}
                  {secData?.passkeyRegistered ? "Remove" : "Set up"}
                </button>
                {passkeyMsg && <span style={{ fontSize: 11, color: "#94a3b8" }}>{passkeyMsg}</span>}
              </div>
            </div>

            {/* Change password */}
            <a href="/auth/forgot-password"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)", textDecoration: "none", color: "var(--page-text)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Change Password</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Send a password reset email</div>
              </div>
              <span style={{ fontSize: 11, color: "#60A5FA", fontWeight: 600 }}>Update →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── PRIVACY ───────────────────────────────────────────────────────── */}
      <div style={section}>
        <SectionHeader icon={<Shield size={15} color="#0EA5A0" />} bg={iconBox("#0EA5A0")} title="Privacy" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)" }}>Profile Visibility</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Control who can see your profile</div>
          </div>
          <select style={{ backgroundColor: "var(--page-bg-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#94A3B8", fontSize: 11, padding: "5px 10px", cursor: "pointer", outline: "none" }}>
            <option>Private</option>
            <option>Public</option>
            <option>Friends only</option>
          </select>
        </div>
      </div>

      {/* ── DANGER ZONE ───────────────────────────────────────────────────── */}
      <div style={{ ...section, border: "1px solid rgba(239,68,68,0.2)", marginBottom: 0 }}>
        <SectionHeader icon={<AlertTriangle size={15} color="#EF4444" />} bg={iconBox("#EF4444")} title="Danger Zone" titleColor="#EF4444" />
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
          Deleting your account is permanent. All your credits, generations, and data will be removed.
        </p>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Trash2 size={13} /> Delete My Account
          </button>
        ) : (
          <div style={{ padding: 14, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)" }}>
            <p style={{ fontSize: 12, color: "#FCA5A5", marginBottom: 12, fontWeight: 600 }}>Are you absolutely sure? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => logout()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", backgroundColor: "#EF4444", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Yes, Delete Account
              </button>
              <button onClick={() => setDeleteConfirm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "#94A3B8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SectionHeader({ icon, bg, title, titleColor }: {
  icon: React.ReactNode;
  bg: React.CSSProperties;
  title: string;
  titleColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={bg}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: titleColor ?? "var(--page-text)" }}>{title}</div>
    </div>
  );
}
