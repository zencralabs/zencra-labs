"use client";

import { useState } from "react";
import { Users, Copy, CheckCircle, Zap, TrendingUp, Share2, Clock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// REFERRALS PAGE — Coming soon preview surface
// Backend referral tracking is deferred. No credits are currently granted.
// ─────────────────────────────────────────────────────────────────────────────

const HOW_IT_WILL_WORK = [
  {
    step: "1", title: "Share your link",
    desc: "Copy and share your unique referral link with friends, followers, or your audience.",
    icon: Share2, color: "#2563EB",
  },
  {
    step: "2", title: "Friend signs up",
    desc: "They create an account and subscribe to any paid Zencra plan using your referral link.",
    icon: Users, color: "#6366F1",
  },
  {
    step: "3", title: "Both earn credits",
    desc: "Once live, you'll receive bonus credits for every successful referral. Your friend gets a welcome bonus too.",
    icon: Zap, color: "#14B8A6",
  },
];

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  // Deterministic display code — not tracked in DB until referral backend is live.
  const displayCode = `ZENCRA-${user.id.slice(4, 10).toUpperCase()}`;
  const displayLink = `https://zencralabs.com/?ref=${displayCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(displayLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, color: "var(--page-text)", margin: 0, letterSpacing: "-0.02em" }}>
            Refer &amp; Earn
          </h1>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#14B8A6", backgroundColor: "rgba(20,184,166,0.12)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(20,184,166,0.25)", letterSpacing: "0.08em" }}>
            COMING SOON
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          The referral program is being built. Your link is ready — referral rewards will appear here once the program goes live.
        </p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Total Referrals", value: "—", icon: Users,       color: "#2563EB", note: "Tracked when program launches" },
          { label: "Credits Earned",  value: "—", icon: Zap,         color: "#6366F1", note: "Granted when program launches" },
          { label: "Pending",         value: "—", icon: TrendingUp,  color: "#D4AF37", note: "Tracked when program launches" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "22px 24px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</span>
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: `${stat.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} style={{ color: stat.color }} />
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800, color: "#334155", marginBottom: "6px" }}>{stat.value}</div>
              <div style={{ fontSize: "10px", color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
                <Clock size={9} />{stat.note}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Referral link card ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "36px 40px", border: "1px solid rgba(37,99,235,0.2)", marginBottom: "28px", background: "linear-gradient(135deg, #080f20 0%, #0c1530 100%)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--page-text)", marginBottom: "8px" }}>
              Your Referral Link
            </div>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px", lineHeight: 1.6 }}>
              This link is unique to your account. Referral credit rewards will appear here once the program is live — sharing it now means you&apos;ll be tracked from launch day.
            </p>

            {/* Link display */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "13px 16px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px" }}>
              <span style={{ flex: 1, fontSize: "12px", color: "#94A3B8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayLink}</span>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "9px", border: "none", background: copied ? "rgba(20,184,166,0.15)" : "linear-gradient(135deg,#2563EB,#0EA5A0)", color: copied ? "#14B8A6" : "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", flexShrink: 0, whiteSpace: "nowrap" }}>
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            {/* Code display */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", color: "#475569" }}>Or share code:</span>
              <div style={{ backgroundColor: "rgba(37,99,235,0.15)", borderRadius: "8px", padding: "5px 12px", border: "1px solid rgba(37,99,235,0.3)", fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#60A5FA", letterSpacing: "0.1em" }}>
                {displayCode}
              </div>
              <span style={{ fontSize: "10px", color: "#334155" }}>— preview only, not yet active</span>
            </div>
          </div>

          {/* Upcoming reward preview */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "14px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)", minWidth: "200px", textAlign: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Planned Reward</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "36px", fontWeight: 800, color: "#60A5FA", marginBottom: "4px" }}>20</div>
            <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "14px" }}>credits per referral</div>
            <div style={{ width: "100%", height: "1px", backgroundColor: "rgba(255,255,255,0.06)", marginBottom: "14px" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color: "#14B8A6", marginBottom: "4px" }}>10</div>
            <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>welcome credits for your friend</div>
            <div style={{ fontSize: "10px", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              <Clock size={9} /> Not yet active
            </div>
          </div>
        </div>
      </div>

      {/* ── How it will work ───────────────────────────────────────────── */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "32px 40px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--page-text)" }}>How it will work</div>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", backgroundColor: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.07)" }}>UPCOMING</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
          {HOW_IT_WILL_WORK.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.step} style={{ position: "relative" }}>
                {i < HOW_IT_WILL_WORK.length - 1 && (
                  <div style={{ position: "absolute", top: "24px", right: "-12px", width: "24px", height: "1px", backgroundColor: "rgba(255,255,255,0.08)", zIndex: 0 }} />
                )}
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: `${step.color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px", border: `1px solid ${step.color}25` }}>
                  <Icon size={20} style={{ color: step.color }} />
                </div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: step.color, marginBottom: "6px", letterSpacing: "0.06em" }}>STEP {step.step}</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "6px" }}>{step.title}</div>
                <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Referral history ───────────────────────────────────────────── */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "32px 40px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "var(--page-text)", marginBottom: "24px" }}>Referral History</div>
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", backgroundColor: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Users size={24} style={{ color: "#334155" }} />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>No referrals tracked yet</div>
          <div style={{ fontSize: "12px", color: "#334155", lineHeight: 1.6, maxWidth: "340px", margin: "0 auto" }}>
            Referral tracking launches with the rewards program. Share your link now and your referrals will be credited automatically once it goes live.
          </div>
        </div>
      </div>

    </div>
  );
}
