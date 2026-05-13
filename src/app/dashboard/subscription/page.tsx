"use client";

import { useState } from "react";
import {
  CheckCircle, Zap, Crown, Building2, Sparkles, ArrowRight,
  Star, Clock, Users, ChevronRight, Package, Layers,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import PricingOverlay from "@/components/pricing/PricingOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PAGE — Premium My Plan / Billing Command Center
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<string, number> = {
  starter:  1,
  creator:  2,
  pro:      3,
  business: 4,
};

function getPlanActionLabel(currentPlan: string, targetPlanId: string, targetPlanName: string): string {
  const current = PLAN_RANK[currentPlan?.toLowerCase() ?? ""] ?? 0;
  const target  = PLAN_RANK[targetPlanId] ?? 0;
  if (current === target) return "Current Plan";
  if (target > current)  return `Upgrade to ${targetPlanName}`;
  return `Downgrade to ${targetPlanName}`;
}

// Locked plan colors — single source of truth (matches layout.tsx)
const PLAN_COLORS: Record<string, string> = {
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

// Credit allowances per plan — mirrors public pricing page
const PLAN_CREDIT_LIMIT: Record<string, number> = {
  starter:  600,
  creator:  1600,
  pro:      3500,
  business: 8000,
};

// ── Locked plan data — Starter $12 / Creator $29 / Pro $49 / Business $89
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 12,
    yearlyPrice: 120,
    description: "Explore Zencra's creative tools",
    icon: Sparkles,
    credits: 600,
    features: [
      "Image & Video Studio access",
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
    description: "For serious creative work",
    icon: Zap,
    credits: 1600,
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
    credits: 3500,
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
    credits: 8000,
    features: [
      "Everything in Pro",
      "Team workspace & seats",
      "FCS add-on eligible",
      "Priority support",
    ],
    badge: "Team",
  },
];

// Booster pack display data — purchase happens on /dashboard/credits
const BOOSTERS = [
  { name: "Light Boost",   credits: 500,  price: 15 },
  { name: "Creator Boost", credits: 1000, price: 25 },
  { name: "Pro Boost",     credits: 2500, price: 59 },
  { name: "Studio Boost",  credits: 5000, price: 99 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [showPricing, setShowPricing] = useState(false);

  if (!user) return null;

  const planKey    = user.plan?.toLowerCase() ?? "starter";
  const planColor  = PLAN_COLORS[planKey] ?? "#64748B";
  const planLimit  = PLAN_CREDIT_LIMIT[planKey] ?? 600;
  const credPct    = Math.min((user.credits / planLimit) * 100, 100);
  const planRank   = PLAN_RANK[planKey] ?? 0;

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── PAGE HEADER ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800,
          color: "var(--page-text)", margin: 0, letterSpacing: "-0.02em",
        }}>
          My Plan
        </h1>
        <p style={{ fontSize: "14px", color: "#475569", marginTop: "6px" }}>
          Manage your subscription, credits, and add-ons
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — CURRENT PLAN SUMMARY
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        borderRadius: "20px",
        background: "linear-gradient(135deg, #070E1E 0%, #0A1530 55%, #0C1A3A 100%)",
        border: `1px solid ${planColor}30`,
        boxShadow: `0 0 60px ${planColor}10`,
        padding: "32px 36px",
        marginBottom: "32px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "40px",
        alignItems: "start",
      }}>

        {/* Left — plan identity + credit bar */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: planColor,
              backgroundColor: `${planColor}18`, padding: "4px 12px",
              borderRadius: "20px", border: `1px solid ${planColor}40`,
            }}>
              {user.plan} Plan
            </span>
            <span style={{
              fontSize: "10px", fontWeight: 700, color: "#10B981",
              backgroundColor: "rgba(16,185,129,0.12)", padding: "3px 9px",
              borderRadius: "10px", border: "1px solid rgba(16,185,129,0.25)",
            }}>
              Active
            </span>
          </div>

          {/* Credits bar */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
              <span style={{
                fontSize: "12px", fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>
                Credits this month
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800,
                  color: "#F8FAFC", letterSpacing: "-0.03em",
                }}>
                  {user.credits.toLocaleString()}
                </span>
                <span style={{ fontSize: "14px", color: "#334155" }}>
                  / {planLimit.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{
              height: "6px", borderRadius: "3px",
              backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${credPct}%`, borderRadius: "3px",
                background: `linear-gradient(90deg, ${planColor}80, ${planColor})`,
                transition: "width 0.6s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: "#1E293B" }}>
                {Math.round(credPct)}% used
              </span>
              <span style={{ fontSize: "11px", color: "#1E293B" }}>
                {Math.max(0, planLimit - user.credits).toLocaleString()} remaining
              </span>
            </div>
          </div>

          {/* Info note */}
          <div style={{
            fontSize: "12px", color: "#334155", lineHeight: 1.6,
            padding: "10px 14px", borderRadius: "10px",
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            display: "inline-block",
          }}>
            Credits reset monthly at your billing date · Unused credits do not carry forward
          </div>
        </div>

        {/* Right — billing + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "240px" }}>
          <div style={{
            padding: "18px 20px", borderRadius: "14px",
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, color: "#334155",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px",
            }}>
              Billing
            </div>
            <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
              Renewal details will appear after billing is connected.
            </div>
          </div>

          <button
            onClick={() => setShowPricing(true)}
            style={{
              width: "100%", padding: "13px 20px", borderRadius: "12px", border: "none",
              background: `linear-gradient(135deg, ${planColor}, ${planColor}bb)`,
              color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              letterSpacing: "0.01em",
            }}
          >
            <ArrowRight size={14} /> Change Plan
          </button>

          <a
            href="/dashboard/credits"
            style={{
              width: "100%", padding: "11px 20px", borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(255,255,255,0.04)",
              color: "#64748B", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
              textDecoration: "none", boxSizing: "border-box",
            }}
          >
            <Zap size={13} /> Buy Credits
          </a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — PRIMARY PLANS
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: "28px" }}>

        {/* Section header + billing toggle */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "22px",
        }}>
          <div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: 800,
              color: "var(--page-text)", margin: 0, letterSpacing: "-0.01em",
            }}>
              Plans
            </h2>
            <p style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
              Switch plans anytime. Changes take effect immediately.
            </p>
          </div>

          {/* Billing toggle */}
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px",
            padding: "4px", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <button
              onClick={() => setBilling("monthly")}
              style={{
                padding: "7px 18px", borderRadius: "9px", border: "none",
                fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                backgroundColor: billing === "monthly" ? "#2563EB" : "transparent",
                color: billing === "monthly" ? "#fff" : "#64748B",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              style={{
                padding: "7px 18px", borderRadius: "9px", border: "none",
                fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "7px",
                backgroundColor: billing === "annual" ? "#2563EB" : "transparent",
                color: billing === "annual" ? "#fff" : "#64748B",
              }}
            >
              Annual
              <span style={{
                fontSize: "9px", fontWeight: 800,
                backgroundColor: "#10B981", color: "#fff",
                padding: "2px 6px", borderRadius: "8px", letterSpacing: "0.03em",
              }}>
                2 months free
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards — 4 column full-width grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isCurrent = planKey === plan.id;
            const color = PLAN_COLORS[plan.id];
            const displayPrice = billing === "annual"
              ? `$${plan.yearlyPrice}/yr`
              : `$${plan.monthlyPrice}/mo`;
            const actionLabel = getPlanActionLabel(user.plan ?? "", plan.id, plan.name);

            return (
              <div
                key={plan.id}
                style={{
                  borderRadius: "18px",
                  backgroundColor: "var(--page-bg-2)",
                  border: isCurrent ? `1.5px solid ${color}55` : "1px solid rgba(255,255,255,0.06)",
                  padding: "28px 22px",
                  position: "relative",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  boxShadow: isCurrent ? `0 0 48px ${color}15` : "none",
                  display: "flex", flexDirection: "column",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = isCurrent
                    ? `0 12px 48px ${color}22` : "0 8px 28px rgba(0,0,0,0.35)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = isCurrent
                    ? `0 0 48px ${color}15` : "none";
                }}
              >
                {/* Current plan badge */}
                {isCurrent && (
                  <div style={{
                    position: "absolute", top: "-11px", left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: color, color: "#fff",
                    fontSize: "9px", fontWeight: 800, padding: "3px 11px",
                    borderRadius: "10px", whiteSpace: "nowrap",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    ✓ Current Plan
                  </div>
                )}
                {/* Plan badge */}
                {!isCurrent && plan.badge && (
                  <div style={{
                    position: "absolute", top: "-11px", left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: plan.badge === "Most Popular" ? "#2563EB" : "#D4AF37",
                    color: "#fff", fontSize: "9px", fontWeight: 800,
                    padding: "3px 11px", borderRadius: "10px",
                    whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    {plan.badge}
                  </div>
                )}

                {/* Icon */}
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  backgroundColor: `${color}18`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  marginBottom: "18px", border: `1px solid ${color}30`, flexShrink: 0,
                }}>
                  <Icon size={18} style={{ color }} />
                </div>

                {/* Name + description */}
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 800,
                  color: "var(--page-text)", letterSpacing: "-0.01em",
                }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px", marginBottom: "18px" }}>
                  {plan.description}
                </div>

                {/* Price */}
                <div style={{ marginBottom: "4px" }}>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800,
                    color, letterSpacing: "-0.02em",
                  }}>
                    {displayPrice}
                  </span>
                </div>

                {/* Credits/month */}
                <div style={{
                  display: "flex", alignItems: "baseline", gap: "5px",
                  marginBottom: "20px", paddingBottom: "18px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: "19px", fontWeight: 700,
                    color: "#DBEAFE", letterSpacing: "-0.01em",
                  }}>
                    {plan.credits.toLocaleString()}
                  </span>
                  <span style={{ fontSize: "12px", color: "#475569" }}>credits / month</span>
                </div>

                {/* Features */}
                <div style={{ flex: 1, marginBottom: "22px" }}>
                  {plan.features.map(f => (
                    <div key={f} style={{
                      display: "flex", alignItems: "flex-start",
                      gap: "8px", marginBottom: "9px",
                    }}>
                      <CheckCircle size={13} style={{ color, flexShrink: 0, marginTop: "2px" }} />
                      <span style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  disabled={isCurrent}
                  onClick={() => { if (!isCurrent) setShowPricing(true); }}
                  style={{
                    width: "100%", padding: "12px", borderRadius: "12px", border: "none",
                    fontSize: "12px", fontWeight: 700, letterSpacing: "0.01em",
                    cursor: isCurrent ? "not-allowed" : "pointer",
                    background: isCurrent
                      ? "rgba(255,255,255,0.05)"
                      : `linear-gradient(135deg, ${color}, ${color}bb)`,
                    color: isCurrent ? "#334155" : "#fff",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  {actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — YEARLY BILLING EXPLANATION
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        borderRadius: "16px",
        backgroundColor: "rgba(16,185,129,0.05)",
        border: "1px solid rgba(16,185,129,0.14)",
        padding: "22px 28px",
        marginBottom: "24px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "28px",
      }}>
        {[
          {
            icon: Star,
            title: "2 Months Free",
            body: "Pay for 10 months, get 12 months of access. Yearly prices are fixed — not computed from monthly.",
          },
          {
            icon: Clock,
            title: "Monthly Credit Grants",
            body: "Credits are granted each month at your billing date — not all upfront, even on annual plans.",
          },
          {
            icon: Layers,
            title: "No Rollover",
            body: "Monthly credits reset each cycle. Unused credits do not carry forward to the next month.",
          },
        ].map(item => (
          <div key={item.title} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
              backgroundColor: "rgba(16,185,129,0.13)",
              border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <item.icon size={15} style={{ color: "#10B981" }} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#F8FAFC", marginBottom: "4px" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
                {item.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTIONS 4 + 5 + 6 — BOTTOM ROW
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>

        {/* SECTION 4 — FCS Add-On (display only) */}
        <div style={{
          borderRadius: "18px",
          background: "linear-gradient(160deg, #080C16 0%, #101828 100%)",
          border: "1px solid rgba(212,175,55,0.18)",
          padding: "26px 24px",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
              backgroundColor: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Crown size={17} style={{ color: "#D4AF37" }} />
            </div>
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 800,
                color: "#F8FAFC", letterSpacing: "-0.01em",
              }}>
                Future Cinema Studio
              </div>
              <div style={{
                fontSize: "10px", fontWeight: 700, color: "#D4AF37",
                textTransform: "uppercase", letterSpacing: "0.09em", marginTop: "1px",
              }}>
                Optional Add-On
              </div>
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.7, marginBottom: "20px" }}>
            Professional cinematic rendering pipeline for Pro and Business creators.
            No yearly FCS plan — monthly only.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", flex: 1 }}>
            {/* Pro + FCS */}
            <div style={{
              padding: "13px 16px", borderRadius: "12px",
              backgroundColor: "rgba(20,184,166,0.07)",
              border: "1px solid rgba(20,184,166,0.18)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "3px",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#14B8A6" }}>Pro + FCS</span>
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: "14px",
                  fontWeight: 800, color: "#F8FAFC",
                }}>
                  +$29<span style={{ fontSize: "11px", color: "#475569" }}>/mo</span>
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#334155" }}>+800 credits / month</div>
            </div>

            {/* Business + FCS */}
            <div style={{
              padding: "13px 16px", borderRadius: "12px",
              backgroundColor: "rgba(212,175,55,0.07)",
              border: "1px solid rgba(212,175,55,0.18)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "3px",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#D4AF37" }}>Business + FCS</span>
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: "14px",
                  fontWeight: 800, color: "#F8FAFC",
                }}>
                  +$49<span style={{ fontSize: "11px", color: "#475569" }}>/mo</span>
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#334155" }}>+1,800 credits / month</div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#1E293B", lineHeight: 1.6 }}>
            Available for Pro and Business only. Activate through your plan upgrade.
          </div>
        </div>

        {/* SECTION 5 — Booster Packs (display + link) */}
        <div style={{
          borderRadius: "18px",
          background: "linear-gradient(160deg, #080C16 0%, #101828 100%)",
          border: "1px solid rgba(99,102,241,0.16)",
          padding: "26px 24px",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
              backgroundColor: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Package size={17} style={{ color: "#6366F1" }} />
            </div>
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 800,
                color: "#F8FAFC", letterSpacing: "-0.01em",
              }}>
                Booster Packs
              </div>
              <div style={{
                fontSize: "10px", fontWeight: 700, color: "#6366F1",
                textTransform: "uppercase", letterSpacing: "0.09em", marginTop: "1px",
              }}>
                One-Time Credits
              </div>
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.7, marginBottom: "18px" }}>
            Top up credits anytime. Booster credits expire after 90 days.
            Active plan required to purchase.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", flex: 1 }}>
            {BOOSTERS.map(b => (
              <div key={b.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 13px", borderRadius: "11px",
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#CBD5E1" }}>{b.name}</div>
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "1px" }}>
                    {b.credits.toLocaleString()} credits · 90 days
                  </div>
                </div>
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: "14px",
                  fontWeight: 700, color: "#818CF8",
                }}>
                  ${b.price}
                </span>
              </div>
            ))}
          </div>

          <a
            href="/dashboard/credits"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "12px", borderRadius: "12px",
              backgroundColor: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.24)",
              color: "#818CF8", fontSize: "12px", fontWeight: 700,
              textDecoration: "none", transition: "background-color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(99,102,241,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(99,102,241,0.10)"; }}
          >
            <Zap size={13} /> Go to Credits Page <ChevronRight size={13} />
          </a>
        </div>

        {/* SECTION 6 — Business Seats (display only) */}
        <div style={{
          borderRadius: "18px",
          background: "linear-gradient(160deg, #080C16 0%, #101828 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "26px 24px",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0,
              backgroundColor: "rgba(212,175,55,0.10)",
              border: "1px solid rgba(212,175,55,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={17} style={{ color: "#D4AF37" }} />
            </div>
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 800,
                color: "#F8FAFC", letterSpacing: "-0.01em",
              }}>
                Business Seats
              </div>
              <div style={{
                fontSize: "10px", fontWeight: 700, color: "#D4AF37",
                textTransform: "uppercase", letterSpacing: "0.09em", marginTop: "1px",
              }}>
                Team Workspace
              </div>
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.7, marginBottom: "20px" }}>
            Business plan includes a shared team workspace for collaborative studio production.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", flex: 1 }}>
            {[
              {
                icon: CheckCircle,
                iconColor: "#10B981",
                bg: "rgba(16,185,129,0.06)",
                border: "rgba(16,185,129,0.14)",
                title: "2 seats included",
                sub: "Included with every Business plan",
              },
              {
                icon: Clock,
                iconColor: "#6366F1",
                bg: "rgba(99,102,241,0.06)",
                border: "rgba(99,102,241,0.14)",
                title: "3rd seat — coming soon",
                sub: "+$29/month · +4,000 credits/month · self-serve",
              },
              {
                icon: Users,
                iconColor: "#D4AF37",
                bg: "rgba(212,175,55,0.06)",
                border: "rgba(212,175,55,0.14)",
                title: "4+ seats",
                sub: "Contact support for team pricing",
              },
            ].map(row => (
              <div key={row.title} style={{
                display: "flex", alignItems: "flex-start", gap: "11px",
                padding: "13px 14px", borderRadius: "12px",
                backgroundColor: row.bg, border: `1px solid ${row.border}`,
              }}>
                <row.icon size={14} style={{ color: row.iconColor, flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#CBD5E1", marginBottom: "2px" }}>
                    {row.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#334155" }}>{row.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {planRank < PLAN_RANK["business"] ? (
            <button
              onClick={() => setShowPricing(true)}
              style={{
                width: "100%", padding: "12px", borderRadius: "12px",
                backgroundColor: "rgba(212,175,55,0.09)",
                border: "1px solid rgba(212,175,55,0.24)",
                color: "#D4AF37", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(212,175,55,0.16)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(212,175,55,0.09)"; }}
            >
              <Building2 size={13} /> Upgrade to Business
            </button>
          ) : (
            <div style={{
              padding: "12px", borderRadius: "12px", textAlign: "center",
              border: "1px solid rgba(212,175,55,0.22)",
              backgroundColor: "rgba(212,175,55,0.07)",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#D4AF37" }}>
                ✓ Business workspace active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p style={{
        fontSize: "11px", color: "#1E293B", textAlign: "center", marginTop: "32px",
      }}>
        All plans include secure payments · Cancel anytime · No questions asked
      </p>

      {showPricing && <PricingOverlay onClose={() => setShowPricing(false)} />}
    </div>
  );
}
