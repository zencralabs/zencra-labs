"use client";

import { useState } from "react";
import { Tag, Zap, Clock, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CODE PAGE — Secure redemption coming soon
//
// IMPORTANT: No promo code validation occurs client-side.
// All code validation must happen server-side before any credits are granted.
// The VALID_CODES client-side dict has been intentionally removed.
// ─────────────────────────────────────────────────────────────────────────────

export default function PromoPage() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Server-side validation is not yet wired.
    // Show honest state — do not simulate credit grant.
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setCode(""); }, 5000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "var(--page-text)",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    fontFamily: "monospace",
    textAlign: "center" as const,
  };

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, color: "var(--page-text)", margin: 0, letterSpacing: "-0.02em" }}>
            Promo Codes
          </h1>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#6366F1", backgroundColor: "rgba(99,102,241,0.12)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(99,102,241,0.25)", letterSpacing: "0.08em" }}>
            SECURE VALIDATION COMING SOON
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Promo code redemption is being connected securely. Codes will be validated server-side before any credits are granted.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }}>

        {/* ── Left: Redemption card ──────────────────────────────────────── */}
        <div>
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "40px 36px", border: "1px solid rgba(99,102,241,0.2)", textAlign: "center", marginBottom: "20px", background: "linear-gradient(135deg, #080e1f 0%, #0d1132 100%)" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg,#2563EB,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Tag size={28} style={{ color: "#fff" }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--page-text)", margin: "0 0 10px" }}>Enter Promo Code</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "28px", lineHeight: 1.6 }}>
              Have a promo code? Enter it below. Codes will be validated securely on our servers before any reward is applied to your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER-CODE-HERE"
                required
                style={{
                  ...inputStyle,
                  borderColor: submitted ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
                }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.5)"; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              />

              {submitted ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", backgroundColor: "rgba(99,102,241,0.08)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(99,102,241,0.2)", textAlign: "left" }}>
                  <ShieldCheck size={16} style={{ color: "#6366F1", flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#818CF8", marginBottom: "3px" }}>Code received</div>
                    <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.5 }}>
                      Server-side validation is not yet connected. Your code has not been applied. Credits will be granted automatically once secure redemption is live.
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!code.trim()}
                style={{ padding: "13px", borderRadius: "10px", border: "none", background: !code.trim() ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#2563EB,#6366F1)", color: !code.trim() ? "#334155" : "#fff", fontSize: "14px", fontWeight: 700, cursor: !code.trim() ? "not-allowed" : "pointer", transition: "opacity 0.15s" }}>
                Submit Code
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "11px", color: "#334155" }}>
                <ShieldCheck size={11} />
                Validation happens server-side — no client shortcuts
              </div>
            </form>
          </div>

          {/* Redeemed history — honest empty state */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px 28px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, color: "var(--page-text)", marginBottom: "16px" }}>Redeemed Codes</div>
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Tag size={24} style={{ color: "#334155", marginBottom: "10px" }} />
              <div style={{ fontSize: "12px", color: "#334155" }}>No codes redeemed yet.</div>
              <div style={{ fontSize: "11px", color: "#1e293b", marginTop: "4px" }}>History will appear here once server-side redemption is live.</div>
            </div>
          </div>
        </div>

        {/* ── Right: What you'll be able to get ─────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* What's coming */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "32px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <Sparkles size={16} style={{ color: "#6366F1" }} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--page-text)" }}>What promo codes will unlock</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { icon: Zap,      color: "#2563EB", text: "Bonus credits added directly to your balance" },
                { icon: Tag,      color: "#6366F1", text: "Discounts on Creator, Pro and Business plans" },
                { icon: Sparkles, color: "#14B8A6", text: "Early access to new AI tools and studio features" },
                { icon: Zap,      color: "#D4AF37", text: "Double credits on your next top-up purchase" },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "9px", backgroundColor: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${item.color}20` }}>
                      <Icon size={14} style={{ color: item.color }} />
                    </div>
                    <span style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security note */}
          <div style={{ backgroundColor: "rgba(99,102,241,0.06)", borderRadius: "16px", padding: "24px 28px", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <ShieldCheck size={16} style={{ color: "#6366F1" }} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#818CF8" }}>Secure by design</div>
            </div>
            <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.7 }}>
              All promo codes are validated server-side. No code is accepted, applied, or rewarded without a secure server verification step. This prevents any client-side bypass and ensures your credit balance is always accurate.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "11px", color: "#334155" }}>
              <Clock size={10} />
              Secure redemption launching soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
