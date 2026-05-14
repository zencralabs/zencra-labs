"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  User, Mail, Phone, Calendar, Camera,
  Save, CheckCircle, Loader2, Lock, Shield,
  ShieldCheck, ShieldOff, ExternalLink,
  AtSign, FileText, Globe, Instagram, Twitter, Youtube, Music2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE — Premium two-column layout
//
// LEFT COLUMN  (~340px) : Avatar upload + Creator Identity (all Coming Soon)
// RIGHT COLUMN (flex:1) : Private account form + account details + security
//
// avatar upload, full_name save, security fetch — all preserved exactly.
// username/bio/website exist in DB but are not wired yet (future phase).
// social links (instagram, x, tiktok, youtube) do not exist in DB yet.
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan badge colors — mirrors layout.tsx sidebar PLAN_COLORS ───────────────
const PLAN_COLORS: Record<string, string> = {
  free:     "#64748B",
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

// Fallback gradient palette — used for initials avatar only, not user-selectable
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
type SecurityStatus = { totpEnabled: boolean } | null;

// ── Coming Soon chip ──────────────────────────────────────────────────────────
function ComingSoonChip() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em",
      textTransform: "uppercase", color: "#475569",
      backgroundColor: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "2px 7px", borderRadius: "6px",
      fontFamily: "var(--font-familjen-grotesk, inherit)",
    }}>
      Soon
    </span>
  );
}

// ── Social link row (Coming Soon placeholder) ─────────────────────────────────
function SocialRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 12px", borderRadius: "10px",
      backgroundColor: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ color: "#334155", flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: "13px", color: "#334155", flex: 1, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
        {label}
      </span>
      <ComingSoonChip />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name,             setName]         = useState(user?.name ?? "");
  const [saveState,        setSaveState]    = useState<SaveState>("idle");
  const [errorMsg,         setErrorMsg]     = useState("");
  const [avatarUrl,        setAvatarUrl]    = useState<string | null>(user?.avatar ?? null);
  const [uploadingAvatar,  setUploading]    = useState(false);
  const [avatarError,      setAvatarError]  = useState("");
  const [security,         setSecurity]     = useState<SecurityStatus>(null);
  const [secLoading,       setSecLoading]   = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader = useCallback((): Record<string, string> => {
    if (!user?.accessToken) return {};
    return { Authorization: `Bearer ${user.accessToken}` };
  }, [user?.accessToken]);

  // Load TOTP status for the read-only security panel — preserved exactly
  useEffect(() => {
    if (!user) { setSecLoading(false); return; }
    fetch("/api/account/security", { headers: authHeader() })
      .then(r => r.json())
      .then((json: { success: boolean; data?: { totpEnabled: boolean } }) => {
        if (json.success && json.data) {
          setSecurity({ totpEnabled: json.data.totpEnabled });
        }
      })
      .catch(() => { /* non-fatal — security panel stays hidden */ })
      .finally(() => setSecLoading(false));
  }, [user, authHeader]);

  // Avatar upload — preserved exactly, only repositioned in JSX
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarError("");
    const localUrl = URL.createObjectURL(file);
    setAvatarUrl(localUrl);
    setUploading(true);

    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const res  = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      const json = await res.json() as { success: boolean; error?: string };

      if (!json.success) {
        setAvatarUrl(user.avatar ?? null);
        setAvatarError(json.error ?? "Photo could not be saved. Please try again.");
        return;
      }

      setAvatarUrl(publicUrl);
      await refreshUser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setAvatarUrl(user.avatar ?? null);
      setAvatarError(msg);
    } finally {
      setUploading(false);
    }
  }

  if (!user) return null;

  const initials      = name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const joinDate      = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const gradIndex     = user.avatarColor ?? 0;
  const hasChanges    = name !== (user.name ?? "");
  const planColor     = PLAN_COLORS[user.plan?.toLowerCase() ?? ""] ?? "#64748B";

  // Full name save — preserved exactly
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges || saveState === "saving") return;

    setSaveState("saving");
    setErrorMsg("");

    try {
      const res  = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ full_name: name }),
      });
      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        setSaveState("saved");
        await refreshUser();
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

  // ── Shared card style ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: "16px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "var(--page-text)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "#64748B",
    display: "block",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  const metaRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.05)",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: "14px",
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  const cardTitle: React.CSSProperties = {
    fontSize: "15px",
    fontWeight: 700,
    color: "#F8FAFC",
    marginBottom: "18px",
    fontFamily: "var(--font-display)",
    letterSpacing: "-0.01em",
  };

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", margin: "0 0 10px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
          YOUR ACCOUNT
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "36px", fontWeight: 700, color: "#F8FAFC", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Profile
        </h1>
        <p style={{ fontFamily: "var(--font-familjen-grotesk, inherit)", fontSize: "15px", color: "#64748B", margin: 0 }}>
          Manage your personal information and creator identity
        </p>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "28px", alignItems: "flex-start" }}>

        {/* ════════════════════════════════════════════════════════════════════
            LEFT COLUMN — Creator Identity
            ════════════════════════════════════════════════════════════════════ */}
        <div style={{ width: "320px", flexShrink: 0 }}>

          {/* ── Avatar card ───────────────────────────────────────────────── */}
          <div style={{ ...card, textAlign: "center" }}>
            <p style={sectionLabel}>Profile Photo</p>

            {/* Avatar circle — click to upload */}
            <div
              style={{ position: "relative", cursor: "pointer", display: "inline-block", marginBottom: "16px" }}
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              title="Click to upload a photo"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)", display: "block" }}
                />
              ) : (
                <div style={{
                  width: "120px", height: "120px", borderRadius: "50%",
                  background: AVATAR_COLORS[gradIndex],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "38px", fontWeight: 800, color: "#fff",
                  fontFamily: "var(--font-display)",
                }}>
                  {initials}
                </div>
              )}
              {/* Camera badge */}
              <div style={{
                position: "absolute", bottom: "4px", right: "4px",
                width: "32px", height: "32px", borderRadius: "50%",
                backgroundColor: "#2563EB", border: "2px solid var(--page-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {uploadingAvatar
                  ? <Loader2 size={13} style={{ color: "#fff", animation: "spin 0.8s linear infinite" }} />
                  : <Camera size={13} style={{ color: "#fff" }} />
                }
              </div>
            </div>

            {/* Hidden file input — must remain rendered */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarUpload}
            />

            {/* Upload guidance */}
            <p style={{ fontSize: "12px", color: uploadingAvatar ? "#60A5FA" : "#64748B", margin: "0 0 4px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              {uploadingAvatar ? "Uploading…" : "Click photo to upload"}
            </p>
            <p style={{ fontSize: "11px", color: "#475569", margin: 0, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              JPG, PNG or WebP · Max 5 MB
            </p>
            {avatarError && (
              <p style={{ marginTop: "10px", fontSize: "12px", color: "#f87171", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                ⚠ {avatarError}
              </p>
            )}
          </div>

          {/* ── Creator Identity card ─────────────────────────────────────── */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <p style={{ ...sectionLabel, margin: 0 }}>Creator Identity</p>
              <ComingSoonChip />
            </div>

            {/* Notice */}
            <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.6, margin: "0 0 18px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              Your public creator profile fields will be available in a future update.
            </p>

            {/* @username placeholder */}
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Username</label>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                cursor: "not-allowed",
              }}>
                <AtSign size={13} style={{ color: "#334155", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#334155", flex: 1, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  @yourhandle
                </span>
                <ComingSoonChip />
              </div>
            </div>

            {/* Bio placeholder */}
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Bio</label>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 14px", borderRadius: "10px", minHeight: "64px",
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                cursor: "not-allowed",
              }}>
                <FileText size={13} style={{ color: "#334155", flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "13px", color: "#334155", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  Tell the world about your work…
                </span>
              </div>
            </div>

            {/* Website placeholder */}
            <div style={{ marginBottom: "18px" }}>
              <label style={labelStyle}>Website</label>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                cursor: "not-allowed",
              }}>
                <Globe size={13} style={{ color: "#334155", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#334155", flex: 1, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  yoursite.com
                </span>
              </div>
            </div>

            {/* Social links */}
            <label style={{ ...labelStyle, marginBottom: "10px" }}>Social Links</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <SocialRow icon={<Instagram size={14} />}  label="Instagram" />
              <SocialRow icon={<Twitter   size={14} />}  label="X.com"     />
              <SocialRow icon={<Music2    size={14} />}  label="TikTok"    />
              <SocialRow icon={<Youtube   size={14} />}  label="YouTube"   />
            </div>
          </div>

        </div>{/* end LEFT */}

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Private Account Details
            ════════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── Personal Information form ──────────────────────────────────── */}
          <div style={card}>
            <p style={cardTitle}>Personal Information</p>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Full name */}
              <div>
                <label style={labelStyle}>Full Name</label>
                <div style={{ position: "relative" }}>
                  <User size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: "36px" }}
                    placeholder="Your full name"
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                    onBlur={e =>  { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                  />
                </div>
              </div>

              {/* Email — read-only */}
              <div>
                <label style={labelStyle}>
                  Email
                  {user.emailLocked && (
                    <span style={{ marginLeft: "6px", color: "#F59E0B", fontSize: "10px" }}>
                      <Lock size={10} style={{ display: "inline", verticalAlign: "middle" }} /> Locked
                    </span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    style={{ ...inputStyle, paddingLeft: "36px", opacity: 0.5, cursor: "not-allowed" }}
                  />
                </div>
                {user.emailLocked && (
                  <p style={{ fontSize: "11px", color: "#F59E0B", marginTop: "4px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    Email is locked after subscription purchase.
                  </p>
                )}
                {!user.emailVerified && user.email && (
                  <p style={{ fontSize: "11px", color: "#f87171", marginTop: "4px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    ⚠ Email not verified
                  </p>
                )}
              </div>

              {/* Phone — read-only */}
              <div>
                <label style={labelStyle}>Phone Number</label>
                <div style={{ position: "relative" }}>
                  <Phone size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                  <input
                    type="tel"
                    value={user.phone ?? ""}
                    readOnly
                    placeholder={user.needsPhone ? "Not added" : ""}
                    style={{ ...inputStyle, paddingLeft: "36px", opacity: 0.5, cursor: "not-allowed" }}
                  />
                </div>
                {user.needsPhone && (
                  <p style={{ fontSize: "11px", color: "#60a5fa", marginTop: "4px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    <a href="/dashboard/settings#security" style={{ color: "#60a5fa" }}>Go to Security settings</a> to add a recovery phone number.
                  </p>
                )}
                {user.phoneVerified && (
                  <p style={{ fontSize: "11px", color: "#4ade80", marginTop: "4px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>✓ Verified</p>
                )}
              </div>

              {errorMsg && (
                <p style={{ margin: 0, fontSize: "13px", color: "#f87171", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={!hasChanges || saveState === "saving"}
                style={{
                  alignSelf: "flex-start",
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 22px", borderRadius: "10px", border: "none",
                  background: saveState === "saved"
                    ? "rgba(16,185,129,0.15)"
                    : !hasChanges
                    ? "rgba(255,255,255,0.05)"
                    : "linear-gradient(135deg,#2563EB,#0EA5A0)",
                  color: saveState === "saved" ? "#10B981" : !hasChanges ? "#475569" : "#fff",
                  fontSize: "13px", fontWeight: 700,
                  cursor: !hasChanges || saveState === "saving" ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  fontFamily: "var(--font-familjen-grotesk, inherit)",
                }}
              >
                {saveState === "saving"
                  ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</>
                  : saveState === "saved"
                  ? <><CheckCircle size={14} /> Saved</>
                  : <><Save size={14} /> Save Changes</>
                }
              </button>
            </form>
          </div>

          {/* ── Account Details ────────────────────────────────────────────── */}
          <div style={card}>
            <p style={cardTitle}>Account Details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

              {/* Member since */}
              <div style={metaRow}>
                <Calendar size={14} style={{ color: "#475569", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  Member since <strong style={{ color: "#94A3B8" }}>{joinDate}</strong>
                </span>
              </div>

              {/* Plan badge */}
              <div style={metaRow}>
                <span style={{ fontSize: "13px", color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>Current plan</span>
                <span style={{
                  fontSize: "11px", fontWeight: 700, color: planColor,
                  backgroundColor: `${planColor}20`,
                  padding: "2px 10px", borderRadius: "10px",
                  border: `1px solid ${planColor}40`,
                  textTransform: "capitalize",
                  fontFamily: "var(--font-familjen-grotesk, inherit)",
                }}>
                  {user.plan}
                </span>
                <a href="/dashboard/subscription" style={{ fontSize: "12px", color: "#60a5fa", marginLeft: "auto", textDecoration: "none", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  Manage →
                </a>
              </div>
            </div>
          </div>

          {/* ── Security Status (read-only, links to settings) ─────────────── */}
          <div style={card}>
            <p style={cardTitle}>Security Status</p>

            {secLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748B", fontSize: "13px" }}>
                <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontFamily: "var(--font-familjen-grotesk, inherit)" }}>Loading…</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                {/* 2FA status */}
                <div style={{ ...metaRow, justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {security?.totpEnabled
                      ? <ShieldCheck size={15} color="#10B981" />
                      : <ShieldOff   size={15} color="#64748B" />
                    }
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                        Two-Factor Authentication
                      </div>
                      <div style={{ fontSize: "11px", color: security?.totpEnabled ? "#10B981" : "#64748B", marginTop: "2px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                        {security?.totpEnabled ? "Enabled" : "Not enabled"}
                      </div>
                    </div>
                  </div>
                  <a
                    href="/dashboard/settings#security"
                    style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#60a5fa", textDecoration: "none", fontFamily: "var(--font-familjen-grotesk, inherit)", flexShrink: 0 }}
                  >
                    {security?.totpEnabled ? "Manage" : "Enable"} <ExternalLink size={11} />
                  </a>
                </div>

                {/* Email verification */}
                <div style={metaRow}>
                  <Shield size={14} style={{ color: user.emailVerified ? "#10B981" : "#F59E0B", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    Email{" "}
                    <strong style={{ color: user.emailVerified ? "#10B981" : "#F59E0B" }}>
                      {user.emailVerified ? "verified" : "not verified"}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Privacy Notice ─────────────────────────────────────────────── */}
          <div style={{
            ...card, marginBottom: 0,
            background: "rgba(255,255,255,0.01)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                backgroundColor: "rgba(14,165,160,0.1)", border: "1px solid rgba(14,165,160,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={16} style={{ color: "#0EA5A0" }} />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#94A3B8", margin: "0 0 6px", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  Your data is private by default
                </p>
                <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.7, margin: 0, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                  Your email, phone number, billing details, and account security information are private and are never shown publicly.
                  Public profile controls are coming soon.
                </p>
              </div>
            </div>
          </div>

        </div>{/* end RIGHT */}
      </div>{/* end two-column */}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
