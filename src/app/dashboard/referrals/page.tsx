"use client";

import { useState } from "react";
import { Users, Copy, CheckCircle, Zap, TrendingUp, Share2, Twitter, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// REFERRALS PAGE — Earn credits by inviting friends
// ─────────────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: "1", title: "Share your link",     desc: "Copy and share your unique referral link with friends", icon: Share2, color: "#2563EB" },
  { step: "2", title: "Friend signs up",     desc: "They create a free account using your referral link",   icon: Users,  color: "#A855F7" },
  { step: "3", title: "Both earn credits",   desc: "You get 20 credits, they get 10 bonus welcome credits", icon: Zap,    color: "#10B981" },
];

const MOCK_REFERRALS: { name: string; date: string; status: "completed" | "pending"; credits: number }[] = [];

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const referralCode = `ZENCRA-${user.id.slice(4, 10).toUpperCase()}`;
  const referralLink = `https://zencralabs.com/?ref=${referralCode}`;
  const totalEarned  = MOCK_REFERRALS.filter(r => r.status === "completed").reduce((s, r) => s + r.credits, 0);

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ padding: "40px", maxWidth: "820px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Referrals</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Invite friends and earn free credits</p>
      </div>

      {/* Hero stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "28px" }}>
        {[
          { label: "Total Referrals", value: MOCK_REFERRALS.length,  icon: Users,       color: "#2563EB" },
          { label: "Credits Earned",  value: totalEarned,             icon: Zap,         color: "#A855F7" },
          { label: "Pending",         value: MOCK_REFERRALS.filter(r => r.status === "pending").length, icon: TrendingUp, color: "#F59E0B" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "14px", padding: "18px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</span>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: `${stat.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} style={{ color: stat.color }} />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--page-text)" }}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Referral link card */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(37,99,235,0.2)", marginBottom: "24px", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "6px" }}>Your Referral Link</div>
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "16px" }}>
          Share this link — you earn <strong style={{ color: "#60A5FA" }}>20 credits</strong> for each friend who signs up.
        </p>

        {/* Code display */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px" }}>
          <span style={{ flex: 1, fontSize: "12px", color: "#94A3B8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referralLink}</span>
          <button onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", background: copied ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#2563EB,#0EA5A0)", color: copied ? "#10B981" : "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", flexShrink: 0 }}>
            {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Promo code */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "11px", color: "#475569" }}>Or share code:</div>
          <div style={{ backgroundColor: "rgba(37,99,235,0.15)", borderRadius: "8px", padding: "5px 12px", border: "1px solid rgba(37,99,235,0.3)", fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#60A5FA", letterSpacing: "0.1em" }}>
            {referralCode}
          </div>
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)", color: "#94A3B8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            <Twitter size={13} /> Share on Twitter
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)", color: "#94A3B8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            <Mail size={13} /> Send via Email
          </button>
        </div>
      </div>

      {/* How it works */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "18px" }}>How it works</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {HOW_IT_WORKS.map(step => {
            const Icon = step.icon;
            return (
              <div key={step.step} style={{ textAlign: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Icon size={20} style={{ color: step.color }} />
                </div>
                <div style={{ fontSize: "11px", fontWeight: 800, color: step.color, marginBottom: "5px" }}>Step {step.step}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--page-text)", marginBottom: "5px" }}>{step.title}</div>
                <div style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.5 }}>{step.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral history */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "16px" }}>Referral History</div>
        {MOCK_REFERRALS.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "#334155" }}>
            <Users size={32} style={{ marginBottom: "12px", opacity: 0.4 }} />
            <p style={{ fontSize: "13px", margin: 0 }}>No referrals yet. Share your link to start earning!</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
