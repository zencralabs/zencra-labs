"use client";

import { useState } from "react";
import { CheckCircle, Zap, Crown, Building2, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PAGE — Current plan + upgrade options
// ─────────────────────────────────────────────────────────────────────────────

// ── Locked plan data — Starter $12 / Creator $29 / Pro $49 / Business $89
// Yearly prices are definitive (not computed from monthly × 12).
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 12,
    yearlyPrice: 120,
    description: "Perfect for exploring Zencra",
    icon: Sparkles,
    color: "#64748B",
    glow: "rgba(100,116,139,0.2)",
    features: [
      "Access to Image & Video Studio",
      "Basic generation capabilities",
      "Community support",
    ],
    badge: null,
  },
  {
    id: "creator",
    name: "Creator",
    monthlyPrice: 29,
    yearlyPrice: 290,
    description: "For serious creators",
    icon: Zap,
    color: "#2563EB",
    glow: "rgba(37,99,235,0.2)",
    features: [
      "All studios unlocked",
      "Priority generation queue",
      "Commercial license",
    ],
    badge: null,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    yearlyPrice: 490,
    description: "For professional creators",
    icon: Crown,
    color: "#A855F7",
    glow: "rgba(168,85,247,0.2)",
    features: [
      "All studios unlocked",
      "FCS add-on eligible",
      "Priority generations",
      "Commercial license",
    ],
    badge: "Most Popular",
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 89,
    yearlyPrice: 890,
    description: "Team workspace for studios & agencies",
    icon: Building2,
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    features: [
      "Everything in Pro",
      "Team workspace & seats",
      "FCS add-on eligible",
      "Priority support",
    ],
    badge: "Team",
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
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.01em", color: "#DBEAFE" }}>{user.credits.toLocaleString()}</span> credits remaining</div>
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
          const Icon = plan.icon;
          // Normalize both sides to lowercase for case-insensitive comparison
          const isCurrent = user.plan?.toLowerCase() === plan.id;
          // Monthly price or yearly price (definitive value, not computed)
          const displayPrice = billing === "annual"
            ? `$${plan.yearlyPrice}/yr`
            : `$${plan.monthlyPrice}/mo`;

          return (
            <div key={plan.id} style={{
              backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "22px",
              border: isCurrent ? `1px solid ${plan.color}60` : plan.badge === "Most Popular" ? `1px solid rgba(37,99,235,0.3)` : "1px solid rgba(255,255,255,0.06)",
              position: "relative", transition: "transform 0.15s",
              boxShadow: isCurrent ? `0 0 30px ${plan.glow}` : "none",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              {plan.badge && !isCurrent && (
                <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", backgroundColor: plan.badge === "Most Popular" ? "#2563EB" : "#F59E0B", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {plan.badge}
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

              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "2px" }}>{plan.name}</div>
              <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "12px" }}>{plan.description}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "16px" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, color: plan.color, letterSpacing: "-0.01em" }}>{displayPrice}</span>
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
                {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
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
