"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  User, Mail, Phone, Calendar, Camera,
  Save, CheckCircle, Loader2, Lock, Shield,
  ShieldCheck, ShieldOff, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE — Edit personal info, persists to Supabase
// avatar_color is kept as a DB fallback for the initials avatar background,
// but the color picker is no longer exposed to users in this UI.
// ─────────────────────────────────────────────────────────────────────────────

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name,           setName]         = useState(user?.name ?? "");
  const [saveState,      setSaveState]    = useState<SaveState>("idle");
  const [errorMsg,       setErrorMsg]     = useState("");
  const [avatarUrl,      setAvatarUrl]    = useState<string | null>(user?.avatar ?? null);
  const [uploadingAvatar, setUploading]   = useState(false);
  const [avatarError,    setAvatarError]  = useState("");
  const [security,       setSecurity]     = useState<SecurityStatus>(null);
  const [secLoading,     setSecLoading]   = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader = useCallback((): Record<string, string> => {
    if (!user?.accessToken) return {};
    return { Authorization: `Bearer ${user.accessToken}` };
  }, [user?.accessToken]);

  // Load TOTP status for the read-only security panel
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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarError("");
    // Show immediate local preview
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

      // Persist to profile — check the response
      const res  = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      const json = await res.json() as { success: boolean; error?: string };

      if (!json.success) {
        // Revert preview; surface the error
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

  const initials  = name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const joinDate  = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const gradIndex = user.avatarColor ?? 0;
  // hasChanges: only name can be changed on this form now (color picker removed)
  const hasChanges = name !== (user.name ?? "");

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

  // ── Shared styles ────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)",
    borderRadius: 16,
    padding: 28,
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "var(--page-text)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748B",
    display: "block",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "var(--font-familjen-grotesk, inherit)",
  };

  const metaRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "13px 16px",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.05)",
  };

  return (
    <div style={{ padding: 40, maxWidth: 680 }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--page-text)", margin: 0, fontFamily: "var(--font-syne, inherit)", letterSpacing: "-0.02em" }}>
          Profile
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 6, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
          Manage your personal information
        </p>
      </div>

      {/* ── Avatar card ─────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: 20, fontFamily: "var(--font-syne, inherit)" }}>
          Profile Photo
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Avatar circle — click to upload */}
          <div
            style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
            onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
            title="Click to upload a photo"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile photo"
                style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: AVATAR_COLORS[gradIndex],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 800, color: "#fff",
                fontFamily: "var(--font-syne, inherit)",
              }}>
                {initials}
              </div>
            )}
            {/* Camera badge */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: "50%",
              backgroundColor: "#2563EB", border: "2px solid var(--page-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {uploadingAvatar
                ? <Loader2 size={11} style={{ color: "#fff", animation: "spin 0.8s linear infinite" }} />
                : <Camera size={11} style={{ color: "#fff" }} />
              }
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarUpload}
          />
          {/* Upload guidance */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", marginBottom: 4, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              {uploadingAvatar ? "Uploading…" : "Click photo to upload"}
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              JPG, PNG or WebP. Max 5 MB.
            </div>
            {/* Error surfaced visibly */}
            {avatarError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                ⚠ {avatarError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Personal information form ──────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: 20, fontFamily: "var(--font-syne, inherit)" }}>
          Personal Information
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Full name */}
          <div>
            <label style={labelStyle}>Full Name</label>
            <div style={{ position: "relative" }}>
              <User size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36 }}
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
                <span style={{ marginLeft: 6, color: "#F59E0B", fontSize: 10 }}>
                  <Lock size={10} style={{ display: "inline", verticalAlign: "middle" }} /> Locked
                </span>
              )}
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                type="email"
                value={user.email}
                readOnly
                style={{ ...inputStyle, paddingLeft: 36, opacity: 0.5, cursor: "not-allowed" }}
              />
            </div>
            {user.emailLocked && (
              <p style={{ fontSize: 11, color: "#F59E0B", marginTop: 4, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                Email is locked after subscription purchase.
              </p>
            )}
            {!user.emailVerified && user.email && (
              <p style={{ fontSize: 11, color: "#f87171", marginTop: 4, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                ⚠ Email not verified
              </p>
            )}
          </div>

          {/* Phone — read-only */}
          <div>
            <label style={labelStyle}>Phone Number</label>
            <div style={{ position: "relative" }}>
              <Phone size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                type="tel"
                value={user.phone ?? ""}
                readOnly
                placeholder={user.needsPhone ? "Not added" : ""}
                style={{ ...inputStyle, paddingLeft: 36, opacity: 0.5, cursor: "not-allowed" }}
              />
            </div>
            {user.needsPhone && (
              <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 4, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                <a href="/dashboard/settings#security" style={{ color: "#60a5fa" }}>Go to Security settings</a> to add a recovery phone number.
              </p>
            )}
            {user.phoneVerified && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>✓ Verified</p>
            )}
          </div>

          {errorMsg && (
            <p style={{ margin: 0, fontSize: 13, color: "#f87171", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={!hasChanges || saveState === "saving"}
            style={{
              alignSelf: "flex-start",
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: saveState === "saved"
                ? "rgba(16,185,129,0.15)"
                : !hasChanges
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg,#2563EB,#0EA5A0)",
              color: saveState === "saved" ? "#10B981" : !hasChanges ? "#475569" : "#fff",
              fontSize: 13, fontWeight: 700,
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

      {/* ── Account meta row ───────────────────────────────────────────────── */}
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: 4, fontFamily: "var(--font-syne, inherit)" }}>
          Account Details
        </div>

        {/* Member since */}
        <div style={metaRow}>
          <Calendar size={14} style={{ color: "#475569", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
            Member since <strong style={{ color: "#94A3B8" }}>{joinDate}</strong>
          </span>
        </div>

        {/* Plan */}
        <div style={metaRow}>
          <span style={{ fontSize: 13, color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>Current plan</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#2563EB",
            backgroundColor: "rgba(37,99,235,0.12)",
            padding: "2px 10px", borderRadius: 10,
            border: "1px solid rgba(37,99,235,0.3)",
            textTransform: "capitalize",
            fontFamily: "var(--font-familjen-grotesk, inherit)",
          }}>
            {user.plan}
          </span>
          <a href="/dashboard/subscription" style={{ fontSize: 12, color: "#60a5fa", marginLeft: "auto", textDecoration: "none", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
            Manage →
          </a>
        </div>
      </div>

      {/* ── Security status (read-only, links to settings) ─────────────────── */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--page-text)", marginBottom: 16, fontFamily: "var(--font-syne, inherit)" }}>
          Security Status
        </div>

        {secLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontFamily: "var(--font-familjen-grotesk, inherit)" }}>Loading…</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 2FA status */}
            <div style={{ ...metaRow, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {security?.totpEnabled
                  ? <ShieldCheck size={15} color="#10B981" />
                  : <ShieldOff size={15} color="#64748B" />
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    Two-Factor Authentication
                  </div>
                  <div style={{ fontSize: 11, color: security?.totpEnabled ? "#10B981" : "#64748B", marginTop: 2, fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                    {security?.totpEnabled ? "Enabled" : "Not enabled"}
                  </div>
                </div>
              </div>
              <a
                href="/dashboard/settings#security"
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#60a5fa", textDecoration: "none", fontFamily: "var(--font-familjen-grotesk, inherit)", flexShrink: 0 }}
              >
                {security?.totpEnabled ? "Manage" : "Enable"} <ExternalLink size={11} />
              </a>
            </div>

            {/* Email verification status */}
            <div style={metaRow}>
              <Shield size={14} style={{ color: user.emailVerified ? "#10B981" : "#F59E0B", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#64748B", fontFamily: "var(--font-familjen-grotesk, inherit)" }}>
                Email{" "}
                <strong style={{ color: user.emailVerified ? "#10B981" : "#F59E0B" }}>
                  {user.emailVerified ? "verified" : "not verified"}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
