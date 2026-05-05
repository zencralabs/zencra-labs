"use client";

import { useState } from "react";
import { CheckCircle, Zap, Crown, Building2, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PAGE — Current plan + upgrade options
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "Free",
    label: "Free",
    price: "$0",
    period: "forever",
    icon: Sparkles,
    color: "#64748B",
    glow: "rgba(100,116,139,0.2)",
    outputSummary: "25 images + 4 videos",
    outputNote: "to start exploring",
    features: [
      "25 standard images or 4 videos to explore",
      "Basic image generation",
      "720p video output",
      "Watermarked exports",
      "Community support",
    ],
    cta: "Current Plan",
    popular: false,
  },
  {
    id: "Creator",
    label: "Creator",
    price: "$19",
    period: "/ month",
    icon: Zap,
    color: "#2563EB",
    glow: "rgba(37,99,235,0.2)",
    outputSummary: "250+ images or 45+ videos",
    outputNote: "per month",
    features: [
      "250+ images or 45+ videos every month",
      "HD image generation",
      "1080p video output",
      "No watermarks",
      "Priority queue",
      "Email support",
    ],
    cta: "Upgrade to Creator",
    popular: true,
  },
  {
    id: "Studio",
    label: "Studio",
    price: "$59",
    period: "/ month",
    icon: Crown,
    color: "#A855F7",
    glow: "rgba(168,85,247,0.2)",
    outputSummary: "1,000+ images or 180+ videos",
    outputNote: "per month",
    features: [
      "1,000+ images or 180+ videos every month",
      "4K image generation",
      "4K video output",
      "No watermarks",
      "Priority queue",
      "API access",
      "Priority support",
    ],
    cta: "Upgrade to Studio",
    popular: false,
  },
  {
    id: "Agency",
    label: "Agency",
    price: "$199",
    period: "/ month",
    icon: Building2,
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    outputSummary: "Unlimited generations",
    outputNote: "no cap, ever",
    features: [
      "Unlimited generations — no cap, ever",
      "All generation tools",
      "White-label exports",
      "Custom watermarks",
      "Full API access",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Upgrade to Agency",
    popular: false,
  },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  if (!user) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1000px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Subscription</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Manage your plan and billing</p>
      </div>

      {/* Current plan banner */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "20px 24px", border: "1px solid rgba(37,99,235,0.25)", marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #0A1122 0%, #0d1533 100%)" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Current Plan</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "#60A5FA" }}>{user.plan} Plan</div>
          <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
            ~{Math.floor(user.credits / 2)} images or ~{Math.floor(user.credits / 11)} videos remaining
            <span style={{ color: "#475569", marginLeft: 6 }}>({user.credits} cr)</span>
          </div>
        </div>
        {user.plan !== "creator" && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "8px" }}>Upgrade for more power</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#60A5FA", fontWeight: 600 }}>
              <ArrowRight size={13} /> Scroll down to upgrade
            </div>
          </div>
        )}
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "28px" }}>
        <button onClick={() => setBilling("monthly")}
          style={{ padding: "7px 18px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", backgroundColor: billing === "monthly" ? "#2563EB" : "rgba(255,255,255,0.05)", color: billing === "monthly" ? "#fff" : "#64748B", transition: "all 0.15s" }}>
          Monthly
        </button>
        <button onClick={() => setBilling("annual")}
          style={{ padding: "7px 18px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", backgroundColor: billing === "annual" ? "#2563EB" : "rgba(255,255,255,0.05)", color: billing === "annual" ? "#fff" : "#64748B", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px" }}>
          Annual
          <span style={{ fontSize: "10px", backgroundColor: "#10B981", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>-20%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        {PLANS.map(plan => {
          const Icon     = plan.icon;
          const isCurrent = user.plan === plan.id;
          const price    = billing === "annual" && plan.id !== "Free"
            ? `$${Math.round(parseInt(plan.price.slice(1)) * 0.8)}`
            : plan.price;

          return (
            <div key={plan.id} style={{
              backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "22px",
              border: isCurrent ? `1px solid ${plan.color}60` : plan.popular ? `1px solid rgba(37,99,235,0.3)` : "1px solid rgba(255,255,255,0.06)",
              position: "relative", transition: "transform 0.15s",
              boxShadow: isCurrent ? `0 0 30px ${plan.glow}` : "none",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {plan.popular && !isCurrent && (
                <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563EB", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", backgroundColor: plan.color, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                  ✓ Active
                </div>
              )}

              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${plan.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <Icon size={16} style={{ color: plan.color }} />
              </div>

              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "4px" }}>{plan.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "10px" }}>
                <span style={{ fontSize: "26px", fontWeight: 800, color: plan.color }}>{price}</span>
                <span style={{ fontSize: "11px", color: "#475569" }}>{plan.period}</span>
              </div>

              {/* Output summary — abundance first */}
              <div style={{ marginBottom: "16px", padding: "8px 10px", borderRadius: "8px", background: `${plan.color}0f`, border: `1px solid ${plan.color}22` }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: plan.color, lineHeight: 1.3 }}>{plan.outputSummary}</div>
                <div style={{ fontSize: "10px", color: "#64748B", marginTop: "1px" }}>{plan.outputNote}</div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginBottom: "7px" }}>
                    <CheckCircle size={12} style={{ color: plan.color, flexShrink: 0, marginTop: "1px" }} />
                    <span style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={isCurrent}
                style={{ width: "100%", padding: "9px", borderRadius: "10px", border: "none", fontSize: "12px", fontWeight: 700, cursor: isCurrent ? "not-allowed" : "pointer", background: isCurrent ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`, color: isCurrent ? "#64748B" : "#fff", transition: "opacity 0.15s" }}
                onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                {isCurrent ? "Current Plan" : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "11px", color: "#334155", textAlign: "center", marginTop: "20px" }}>
        All plans include secure payments. Cancel anytime. No questions asked.
      </p>
    </div>
  );
}
