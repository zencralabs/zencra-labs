"use client";

/**
 * AccountCompletionBanner
 *
 * Sticky top banner shown when the user's account is missing required info:
 *   1. Email not verified  → prompt to check inbox / resend
 *   2. Phone-only user     → must add email (required for account recovery)
 *   3. Email-only user     → nudge to add phone (optional but encouraged)
 *
 * Place this inside every authenticated layout (e.g. dashboard layout).
 */

import { useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { X, Mail, Phone, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type BannerState = "idle" | "sending" | "sent" | "error";

export default function AccountCompletionBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed]   = useState(false);
  const [state, setState]           = useState<BannerState>("idle");
  const [errorMsg, setErrorMsg]     = useState("");
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const handleResendVerification = useCallback(async () => {
    if (state === "sending") return;
    setState("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
        },
      });
      const json = await res.json() as { success: boolean; alreadyVerified?: boolean; error?: string };
      if (json.success) setState("sent");
      else {
        setErrorMsg(json.error ?? "Failed to send email");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error — please try again");
      setState("error");
    }
  }, [state, user?.accessToken]);

  if (!user || dismissed) return null;

  // ── Priority 1: Email not verified ──────────────────────────────────────
  if (user.needsEmailVerification) {
    return (
      <Banner
        icon={<Mail size={16} />}
        color="amber"
        onDismiss={() => setDismissed(true)}
      >
        <span>
          <strong>Verify your email</strong> — check your inbox for a verification link.
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {state === "sent" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#4ade80", fontSize: 13 }}>
              <CheckCircle2 size={14} /> Sent! Check your inbox.
            </span>
          ) : state === "error" ? (
            <span style={{ color: "#f87171", fontSize: 13 }}>{errorMsg}</span>
          ) : null}
          <button
            onClick={handleResendVerification}
            disabled={state === "sending" || state === "sent"}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.4)",
              background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontSize: 13,
              fontWeight: 600, cursor: state === "sending" || state === "sent" ? "not-allowed" : "pointer",
              opacity: state === "sent" ? 0.5 : 1,
            }}
          >
            {state === "sending" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
            {state === "sending" ? "Sending…" : "Resend email"}
          </button>
        </div>
      </Banner>
    );
  }

  // ── Priority 2: Phone-only — must add email ──────────────────────────────
  if (user.needsEmail) {
    return (
      <>
        <Banner
          icon={<AlertTriangle size={16} />}
          color="red"
          onDismiss={undefined}  // not dismissible — email required
        >
          <span>
            <strong>Add an email address</strong> to secure your account and enable account recovery.
          </span>
          <button
            onClick={() => setShowAddEmail(true)}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 13,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Add email
          </button>
        </Banner>

        {showAddEmail && (
          <AddEmailModal email={emailInput} setEmail={setEmailInput} onClose={() => setShowAddEmail(false)} />
        )}
      </>
    );
  }

  // ── Priority 3: Email-only — nudge to add phone ──────────────────────────
  if (user.needsPhone) {
    return (
      <Banner
        icon={<Phone size={16} />}
        color="blue"
        onDismiss={() => setDismissed(true)}
      >
        <span>
          Add a phone number for extra account security and SMS recovery.
        </span>
        <a
          href="/dashboard/settings#security"
          style={{
            padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(37,99,235,0.4)",
            background: "rgba(37,99,235,0.1)", color: "#60a5fa", fontSize: 13,
            fontWeight: 600, textDecoration: "none",
          }}
        >
          Add phone
        </a>
      </Banner>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const BANNER_COLORS = {
  amber: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", icon: "#fbbf24" },
  red:   { bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: "#f87171" },
  blue:  { bg: "rgba(37,99,235,0.08)",   border: "rgba(37,99,235,0.2)",   icon: "#60a5fa" },
};

function Banner({
  icon, color, children, onDismiss,
}: {
  icon: React.ReactNode;
  color: keyof typeof BANNER_COLORS;
  children: React.ReactNode;
  onDismiss?: (() => void) | undefined;
}) {
  const c = BANNER_COLORS[color];
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 12, padding: "10px 16px",
      background: c.bg, borderBottom: `1px solid ${c.border}`,
      flexWrap: "wrap",
    }}>
      <span style={{ color: c.icon, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", padding: 4, flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AddEmailModal({
  email, setEmail, onClose,
}: {
  email: string;
  setEmail: (v: string) => void;
  onClose: () => void;
}) {
  const [state, setState]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError]   = useState("");
  const { user }            = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/account/add-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) setState("success");
      else { setError(json.error ?? "Failed"); setState("error"); }
    } catch {
      setError("Network error");
      setState("error");
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0D1829", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)",
        padding: 32, width: "100%", maxWidth: 420,
      }}>
        {state === "success" ? (
          <>
            <CheckCircle2 size={40} color="#4ade80" style={{ marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 18 }}>Check your inbox</h3>
            <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              We sent a verification link to <strong style={{ color: "#fff" }}>{email}</strong>.
              Click the link to confirm your email.
            </p>
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, border: "none",
                background: "#2563EB", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 style={{ margin: "0 0 6px", color: "#fff", fontSize: 18 }}>Add email address</h3>
            <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              Required for account recovery.
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "12px 14px", borderRadius: 8, fontSize: 15,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", outline: "none", marginBottom: 12,
              }}
            />
            {state === "error" && (
              <p style={{ margin: "0 0 12px", color: "#f87171", fontSize: 13 }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)", background: "none",
                  color: "rgba(255,255,255,0.6)", fontSize: 15, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state === "loading"}
                style={{
                  flex: 2, padding: "12px", borderRadius: 8, border: "none",
                  background: "#2563EB", color: "#fff", fontSize: 15, fontWeight: 600,
                  cursor: state === "loading" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {state === "loading"
                  ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Sending…</>
                  : "Send verification"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
