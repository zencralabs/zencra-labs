"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, Lock, Shield, CheckCircle,
  Fingerprint, Loader2, AlertTriangle, Copy, Eye, EyeOff,
  Smartphone, ShieldCheck, ShieldOff, Mail, Clock,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE — v2-M Premium Polish
//
// Layout: 2-column responsive grid
//   Left col:  Notifications (top) | Privacy (bottom)
//   Right col: Security (top)      | Account Closure (bottom)
//
// Real: TOTP 2FA enroll/verify/disable (all handlers preserved exactly)
// Real: Passkey flag (backend boolean only — full WebAuthn deferred)
// Visual-only (clearly labelled): Notifications, Privacy
// Safe: Account Closure — contact support only, no destructive action
// ─────────────────────────────────────────────────────────────────────────────

type TOTPStep = "idle" | "enrolling" | "verifying" | "success" | "error";
type SecurityData = { totpEnabled: boolean; totpFactorId: string | null; passkeyRegistered: boolean };

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      aria-pressed={value}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: value ? "#2563EB" : "rgba(255,255,255,0.1)",
        opacity: disabled ? 0.5 : 1,
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

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, bg, title, titleColor }: {
  icon: React.ReactNode;
  bg: React.CSSProperties;
  title: string;
  titleColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={bg}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: titleColor ?? "var(--page-text)", fontFamily: "var(--font-syne, inherit)" }}>
        {title}
      </div>
    </div>
  );
}

// ── Coming soon badge ─────────────────────────────────────────────────────────
function ComingSoon() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      color: "#64748B", backgroundColor: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      padding: "2px 8px", borderRadius: 6,
      textTransform: "uppercase",
      fontFamily: "var(--font-familjen-grotesk, inherit)",
    }}>
      <Clock size={9} /> Coming soon
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();

  // ── Notification preview state (NOT persisted — coming soon) ──────────────
  const [emailNotifs,     setEmailNotifs]     = useState(true);
  const [marketingNotifs, setMarketingNotifs] = useState(false);
  const [creditAlerts,    setCreditAlerts]    = useState(true);

  // ── Security / 2FA state ─────────────────────────────────────────────────
  const [secData,        setSecData]        = useState<SecurityData | null>(null);
  const [secLoading,     setSecLoading]     = useState(true);
  const [totpStep,       setTotpStep]       = useState<TOTPStep>("idle");
  const [totpBusy,       setTotpBusy]       = useState(false);
  const [totpEnroll,     setTotpEnroll]     = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [totpCode,       setTotpCode]       = useState("");
  const [totpErr,        setTotpErr]        = useState("");
  const [showSecret,     setShowSecret]     = useState(false);
  const [passkeyMsg,     setPasskeyMsg]     = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

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

  // ── TOTP enrollment ───────────────────────────────────────────────────────
  // Preserved exactly — real working TOTP flow. Do not modify.
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

  // ── Passkey ───────────────────────────────────────────────────────────────
  // Preserved exactly — flag-based, real removal, deferred WebAuthn.
  async function handlePasskey() {
    if (!user) return;
    setPasskeyLoading(true);
    setPasskeyMsg("");

    if (secData?.passkeyRegistered) {
      try {
        const res  = await fetch("/api/account/security", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ action: "remove-passkey" }),
        });
        const json = await res.json() as { success: boolean };
        if (json.success) {
          setSecData(prev => prev ? { ...prev, passkeyRegistered: false } : prev);
          setPasskeyMsg("Passkey preference cleared.");
        }
      } catch { setPasskeyMsg("Error removing passkey preference."); }
      finally { setPasskeyLoading(false); }
      return;
    }

    try {
      const supabaseModule = await import("@/lib/supabase");
      const supabaseClient = supabaseModule.supabase;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseClient.auth as any).signInWithPasskey({ createUser: false });
      if (error) { setPasskeyMsg(error.message); return; }

      await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "register-passkey" }),
      });
      setSecData(prev => prev ? { ...prev, passkeyRegistered: true } : prev);
      setPasskeyMsg("Passkey preference saved.");
    } catch (e) {
      setPasskeyMsg(`Error: ${String(e)}`);
    } finally {
      setPasskeyLoading(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const section: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)",
    borderRadius: 16,
    padding: 24,
    border: "1px solid rgba(255,255,255,0.06)",
  };

  const iconBox = (color: string): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    backgroundColor: `${color}20`,
    flexShrink: 0,
  });

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 14, marginBottom: 14,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  const bodyText: React.CSSProperties = {
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", margin: "0 0 10px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
          YOUR ACCOUNT
        </p>
        <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 32, fontWeight: 800, color: "var(--page-text)", margin: 0, lineHeight: 1.1 }}>
          Settings
        </h1>
        <p style={{ fontSize: "15px", color: "#64748B", margin: "0 0 18px", ...bodyText }}>
          Manage your account preferences and security
        </p>

        {/* ── Security status accent — uses already-loaded secData, no new fetch ── */}
        {!secLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 14px", borderRadius: 20,
              backgroundColor: secData?.totpEnabled
                ? "rgba(16,185,129,0.08)"
                : "rgba(245,158,11,0.08)",
              border: `1px solid ${secData?.totpEnabled
                ? "rgba(16,185,129,0.2)"
                : "rgba(245,158,11,0.2)"}`,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                backgroundColor: secData?.totpEnabled ? "#10B981" : "#F59E0B",
                boxShadow: secData?.totpEnabled
                  ? "0 0 6px rgba(16,185,129,0.5)"
                  : "0 0 6px rgba(245,158,11,0.5)",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                color: secData?.totpEnabled ? "#34D399" : "#FBB93D",
                ...bodyText,
              }}>
                {secData?.totpEnabled ? "2FA Enabled" : "2FA Not enabled"}
              </span>
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 14px", borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <Lock size={11} color="#475569" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.04em", ...bodyText }}>
                Security Settings
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 2-COLUMN SETTINGS GRID ─────────────────────────────────────────── */}
      {/*
        Grid order:
          [1] Notifications  [2] Security
          [3] Privacy        [4] Account Closure
      */}
      <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

        {/* ── [1] NOTIFICATIONS — left top ──────────────────────────────── */}
        <div style={section}>
          <SectionHeader
            icon={<Bell size={15} color="#2563EB" />}
            bg={iconBox("#2563EB")}
            title="Notifications"
          />

          {/* Coming soon notice */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 16,
          }}>
            <Mail size={14} color="#64748B" />
            <span style={{ fontSize: 12, color: "#64748B", ...bodyText }}>
              Notification preferences are coming soon. These settings are a preview only and are not yet saved.
            </span>
            <span style={{ marginLeft: "auto", flexShrink: 0 }}><ComingSoon /></span>
          </div>

          {/* Preview toggles — disabled, visual only, full-opacity labels */}
          {[
            { label: "Email notifications",  sub: "Receive email updates about your generations", val: emailNotifs,     set: setEmailNotifs    },
            { label: "Marketing emails",     sub: "Tips, feature announcements, and offers",      val: marketingNotifs, set: setMarketingNotifs },
            { label: "Low credit alerts",    sub: "Get notified when credits fall below 10",      val: creditAlerts,    set: setCreditAlerts   },
          ].map(item => (
            <div key={item.label} style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", ...bodyText }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2, ...bodyText }}>
                  {item.sub}
                </div>
              </div>
              <Toggle value={item.val} onChange={item.set} disabled />
            </div>
          ))}
        </div>

        {/* ── [2] SECURITY — right top ───────────────────────────────────── */}
        <div id="security" style={section}>
          <SectionHeader
            icon={<Lock size={15} color="#A855F7" />}
            bg={iconBox("#A855F7")}
            title="Security"
          />

          {secLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              <span style={bodyText}>Loading security status…</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* ── Two-Factor Authentication — REAL, preserved exactly ── */}
              <div style={{ padding: "16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: totpStep === "verifying" ? 16 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Smartphone size={16} color={secData?.totpEnabled ? "#10B981" : "#64748B"} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", ...bodyText }}>
                        Two-Factor Authentication
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, ...bodyText }}>
                        {secData?.totpEnabled
                          ? "✓ Enabled — authenticator app required at sign-in"
                          : "Adds extra security via an authenticator app"
                        }
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {secData?.totpEnabled ? (
                      <button onClick={disableTOTP} disabled={totpBusy}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", ...bodyText }}>
                        {totpBusy ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShieldOff size={13} />}
                        Disable
                      </button>
                    ) : totpStep === "idle" || totpStep === "error" ? (
                      <button onClick={startTOTPEnroll} disabled={totpBusy}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.08)", color: "#c084fc", fontSize: 12, fontWeight: 600, cursor: "pointer", ...bodyText }}>
                        {totpBusy ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShieldCheck size={13} />}
                        Enable 2FA
                      </button>
                    ) : totpStep === "success" ? (
                      <span style={{ fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 4, ...bodyText }}>
                        <CheckCircle size={14} /> Enabled!
                      </span>
                    ) : null}
                  </div>
                </div>

                {totpErr && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171", ...bodyText }}>{totpErr}</p>}

                {/* QR Code enrollment step — preserved exactly */}
                {totpStep === "verifying" && totpEnroll && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, ...bodyText }}>
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code.
                    </p>
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ background: "#fff", padding: 12, borderRadius: 10, flexShrink: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={totpEnroll.qrCode} alt="2FA QR code" width={140} height={140} />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", ...bodyText }}>Manual entry key</div>
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
                        <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", ...bodyText }}>Enter 6-digit code</div>
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
                            style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: totpCode.length === 6 ? "#2563EB" : "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: totpCode.length === 6 ? "pointer" : "not-allowed", ...bodyText }}>
                            Verify
                          </button>
                        </div>
                        {totpErr && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171", ...bodyText }}>{totpErr}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Passkey — preserved exactly, labelled as being prepared ── */}
              <div style={{ padding: "16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Fingerprint size={16} color="#64748B" style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", ...bodyText }}>Passkey</span>
                        <ComingSoon />
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", ...bodyText }}>
                        Passkey support is being prepared. Full biometric sign-in will be available in a future update.
                      </div>
                      {secData?.passkeyRegistered && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, ...bodyText }}>
                          A passkey preference is registered on this account.
                        </div>
                      )}
                      {passkeyMsg && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, ...bodyText }}>{passkeyMsg}</div>
                      )}
                    </div>
                  </div>
                  {/* Only allow removal of existing flag */}
                  {secData?.passkeyRegistered && (
                    <button onClick={handlePasskey} disabled={passkeyLoading}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, ...bodyText }}>
                      {passkeyLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Fingerprint size={13} />}
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Change password — link only, no Zencra route involved */}
              <a href="/auth/forgot-password"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)", textDecoration: "none", color: "var(--page-text)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, ...bodyText }}>Change Password</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, ...bodyText }}>Send a password reset email to your inbox</div>
                </div>
                <span style={{ fontSize: 12, color: "#60A5FA", fontWeight: 600, ...bodyText }}>Reset →</span>
              </a>
            </div>
          )}
        </div>

        {/* ── [3] PRIVACY — left bottom ─────────────────────────────────── */}
        <div style={section}>
          <SectionHeader
            icon={<Shield size={15} color="#0EA5A0" />}
            bg={iconBox("#0EA5A0")}
            title="Privacy"
          />

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "13px 16px", borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <Shield size={14} color="#64748B" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#64748B", flex: 1, ...bodyText }}>
              Privacy controls are coming soon. Profile visibility and data preferences will be configurable here.
            </span>
            <ComingSoon />
          </div>
        </div>

        {/* ── [4] ACCOUNT CLOSURE — right bottom ────────────────────────── */}
        <div style={section}>
          <SectionHeader
            icon={<AlertTriangle size={15} color="#64748B" />}
            bg={iconBox("#64748B")}
            title="Account Closure"
          />
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16, lineHeight: 1.6, ...bodyText }}>
            Account closure is not yet automated. To permanently close your Zencra account and request data deletion, please contact support.
          </p>
          <a
            href="mailto:support@zencralabs.com"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "9px 18px", borderRadius: 9,
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.06)",
              color: "#FBBF24", fontSize: 12, fontWeight: 600,
              textDecoration: "none",
              ...bodyText,
            }}
          >
            Contact Support
          </a>
        </div>

      </div>{/* end .settings-grid */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
