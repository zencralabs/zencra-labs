"use client";

import { useState } from "react";
import { Tag, CheckCircle, XCircle, Zap, Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CODE PAGE — Redeem promo codes for credits or plan discounts
// ─────────────────────────────────────────────────────────────────────────────

const REDEEMED_CODES: { code: string; reward: string; date: string; type: "credits" | "discount" }[] = [];

// Demo codes that can be "redeemed" in Phase 1
const VALID_CODES: Record<string, { reward: string; credits: number; type: "credits" | "discount" }> = {
  "ZENCRA2024":  { reward: "+50 credits",     credits: 50,  type: "credits"  },
  "WELCOME25":   { reward: "+25 credits",     credits: 25,  type: "credits"  },
  "CREATOR50":   { reward: "+50 credits",     credits: 50,  type: "credits"  },
  "LAUNCHDAY":   { reward: "+100 credits",    credits: 100, type: "credits"  },
};

export default function PromoPage() {
  const { user }           = useAuth();
  const [code, setCode]     = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error" | "used">("idle");
  const [reward, setReward] = useState("");
  const [redeemed, setRedeemed] = useState<typeof REDEEMED_CODES>([]);

  if (!user) return null;

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const upper = code.trim().toUpperCase();
    const alreadyUsed = redeemed.some(r => r.code === upper);
    if (alreadyUsed) { setStatus("used"); return; }

    const match = VALID_CODES[upper];
    if (match) {
      setStatus("success");
      setReward(match.reward);
      setRedeemed(prev => [...prev, { code: upper, reward: match.reward, date: "Just now", type: match.type }]);
    } else {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 4000);
    setCode("");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", padding: "11px 14px", color: "var(--page-text)", fontSize: "14px",
    outline: "none", boxSizing: "border-box", letterSpacing: "0.08em", textTransform: "uppercase" as const,
    fontFamily: "monospace",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "700px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Promo Codes</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Redeem promo codes for bonus credits or plan discounts</p>
      </div>

      {/* Main redemption card */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "36px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px", textAlign: "center" }}>
        <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "linear-gradient(135deg,#2563EB,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Tag size={26} style={{ color: "#fff" }} />
        </div>
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--page-text)", margin: "0 0 8px" }}>Enter Promo Code</h2>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px" }}>
          Got a promo code? Enter it below to claim your reward instantly.
        </p>

        <form onSubmit={handleRedeem} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", margin: "0 auto" }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="ENTER-CODE-HERE"
            required
            style={{
              ...inputStyle,
              borderColor: status === "success" ? "rgba(16,185,129,0.5)" : status === "error" || status === "used" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)",
              textAlign: "center",
            }}
            onFocus={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
            onBlur={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          />

          {/* Status messages */}
          {status === "success" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10B981", fontSize: "13px", fontWeight: 600, justifyContent: "center" }}>
              <CheckCircle size={15} /> Code applied! {reward} added to your account.
            </div>
          )}
          {status === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#EF4444", fontSize: "13px", fontWeight: 600, justifyContent: "center" }}>
              <XCircle size={15} /> Invalid or expired promo code.
            </div>
          )}
          {status === "used" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#F59E0B", fontSize: "13px", fontWeight: 600, justifyContent: "center" }}>
              <Clock size={15} /> You've already redeemed this code.
            </div>
          )}

          <button type="submit"
            style={{ padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#2563EB,#A855F7)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
            Redeem Code
          </button>
        </form>
      </div>

      {/* Available perks */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={15} style={{ color: "#A855F7" }} /> What can you get?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {[
            { icon: Zap, color: "#2563EB", text: "Bonus credits to generate images & videos" },
            { icon: Tag, color: "#A855F7", text: "Discounts on Creator, Studio & Agency plans" },
            { icon: Sparkles, color: "#0EA5A0", text: "Early access to new AI tools and features" },
            { icon: Zap, color: "#F59E0B", text: "Double credits on your next top-up purchase" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={13} style={{ color: item.color }} />
                </div>
                <span style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Redeemed history */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "16px" }}>Redeemed Codes</div>
        {redeemed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#334155" }}>
            <Tag size={28} style={{ marginBottom: "10px", opacity: 0.3 }} />
            <p style={{ fontSize: "12px", margin: 0 }}>No codes redeemed yet.</p>
          </div>
        ) : (
          redeemed.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: i < redeemed.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={14} style={{ color: "#10B981" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--page-text)", fontFamily: "monospace" }}>{r.code}</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>{r.date}</div>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#10B981" }}>{r.reward}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
