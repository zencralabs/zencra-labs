"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, AlertTriangle, X, Info, Zap, ImageIcon, Video,
  Music, User2, Layers, RotateCcw, Star, TrendingUp, Gift,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { getDisplayModelName } from "@/lib/studio/model-display-names";
import type { CreditPack } from "@/lib/billing/types";

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS PAGE — Balance, usage history, top-up options
// Packs and history loaded from live API. Top-up initiates billing flow.
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan credit limits — paid plans only; free users are governed by free_usage counters.
const PLAN_CREDIT_LIMIT: Record<string, number> = {
  starter:  600,
  creator:  1600,
  pro:      3500,
  business: 8000,
};

/** Locked Dashboard v2 plan badge colors */
const PLAN_COLORS: Record<string, string> = {
  free:     "#64748B",
  starter:  "#64748B",
  creator:  "#6366F1",
  pro:      "#14B8A6",
  business: "#D4AF37",
};

// ── Razorpay checkout ─────────────────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction display helpers — ported from dashboard/page.tsx (v2-K)
// ─────────────────────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Parses "[studio/model-key]" bracket pattern from description strings.
 *  Used as fallback when metadata is null (spend-type rows from spend_credits RPC). */
function parseBracket(desc: string | null): { studio: string | null; modelKey: string | null } {
  if (!desc) return { studio: null, modelKey: null };
  const m = desc.match(/\[(\w[\w-]*)\/([^\]]+)\]/);
  if (!m) return { studio: null, modelKey: null };
  return { studio: m[1], modelKey: m[2] };
}

const STUDIO_ICON_MAP: Record<string, { color: string; bg: string; Icon: React.ElementType }> = {
  image:     { Icon: ImageIcon, color: "#2563EB", bg: "rgba(37,99,235,0.14)" },
  video:     { Icon: Video,     color: "#7C3AED", bg: "rgba(124,58,237,0.14)" },
  audio:     { Icon: Music,     color: "#D97706", bg: "rgba(217,119,6,0.14)"  },
  character: { Icon: User2,     color: "#F59E0B", bg: "rgba(245,158,11,0.14)" },
  cd:        { Icon: Layers,    color: "#0EA5A0", bg: "rgba(14,165,160,0.14)" },
  lipsync:   { Icon: Video,     color: "#EC4899", bg: "rgba(236,72,153,0.14)" },
};

const STUDIO_ACTION_LABEL: Record<string, string> = {
  image:     "Image Generated",
  video:     "Video Generated",
  audio:     "Audio Generated",
  character: "Character Generated",
  cd:        "Concept Generated",
  lipsync:   "Lipsync Generated",
};

function txIcon(
  type: string,
  metadata: Record<string, unknown> | null,
  description: string | null,
): { Icon: React.ElementType; color: string; bg: string } {
  const studioMeta = typeof metadata?.studio === "string" ? metadata.studio : null;
  const studio = studioMeta ?? parseBracket(description).studio;

  if (type === "spend" || type === "finalize") {
    return STUDIO_ICON_MAP[studio ?? ""] ?? { Icon: Zap, color: "#A855F7", bg: "rgba(168,85,247,0.14)" };
  }
  if (type === "refund" || type === "rollback") {
    return { Icon: RotateCcw, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "topup" || type === "purchase") {
    return { Icon: TrendingUp, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "grant" || type === "bonus") {
    return { Icon: Gift, color: "#10B981", bg: "rgba(16,185,129,0.14)" };
  }
  if (type === "trial") {
    return { Icon: Star, color: "#F59E0B", bg: "rgba(245,158,11,0.14)" };
  }
  return { Icon: Zap, color: "#64748B", bg: "rgba(255,255,255,0.06)" };
}

function txLabel(tx: CreditTransaction): { action: string; tool: string } {
  const meta         = tx.metadata;
  const studioMeta   = typeof meta?.studio    === "string" ? meta.studio    : null;
  const modelKeyMeta = typeof meta?.model_key === "string" ? meta.model_key : null;
  const parsed       = parseBracket(tx.description);
  const studio       = studioMeta   ?? parsed.studio;
  const modelKey     = modelKeyMeta ?? parsed.modelKey;
  const modelName    = getDisplayModelName(modelKey);

  if (tx.type === "spend") {
    const action = STUDIO_ACTION_LABEL[studio ?? ""] ?? "Output Generated";
    return { action, tool: modelName };
  }
  if (tx.type === "refund")   return { action: "Credits Refunded",  tool: modelName || tx.description || "Refund"        };
  if (tx.type === "rollback") return { action: "Job Rolled Back",   tool: modelName || ""                                };
  if (tx.type === "topup"  || tx.type === "purchase") return { action: "Credits Purchased", tool: tx.description || "Top-up" };
  if (tx.type === "grant"  || tx.type === "bonus")    return { action: "Credits Added",     tool: tx.description || "Bonus"  };
  if (tx.type === "trial")                            return { action: "Trial Credits",     tool: tx.description || "Welcome bonus" };
  return { action: tx.description || "Transaction",  tool: tx.type };
}

function txTimeShort(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const { user, refreshUser } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [packs, setPacks]               = useState<CreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);

  const [history,        setHistory]        = useState<CreditTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [purchasing, setPurchasing]           = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ credits: number } | null>(null);
  const [purchaseError, setPurchaseError]     = useState<string | null>(null);

  // ── Load packs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/billing/packs")
      .then((r) => r.json())
      .then((d) => { if (d.success) setPacks(d.data); })
      .catch(console.error)
      .finally(() => setPacksLoading(false));
  }, []);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    fetch("/api/credits/history?limit=25")
      .then((r) => r.json())
      .then((d) => { if (d.success) setHistory(d.data ?? []); })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (!user) return null;

  const planKey    = (user.plan ?? "free").toLowerCase();
  const planColor  = PLAN_COLORS[planKey] ?? "#64748B";
  const planLabel  = `${planKey.charAt(0).toUpperCase()}${planKey.slice(1)} Plan`;
  const planLimit  = PLAN_CREDIT_LIMIT[planKey] ?? 600;
  const credPct    = Math.min((user.credits / planLimit) * 100, 100);
  const credPctStr = `${Math.round(credPct)}%`;

  // Plan gate: booster packs require an active primary plan
  const hasActivePlan = !!user.plan && user.plan !== "free";

  // Hide zero-amount audit rows (reserve / finalize bookkeeping)
  const visibleHistory = history.filter((tx) => tx.amount !== 0);

  // ── Buy flow ───────────────────────────────────────────────────────────────
  // In demo mode (isDemo:true in order response): skips the Razorpay modal
  // entirely and auto-calls /api/billing/demo/webhook — same fulfillment path
  // as a real webhook, credits update identically.
  // In production: opens Razorpay Checkout as normal.
  async function handleBuy(pack: CreditPack) {
    if (purchasing || !user) return;
    setPurchasing(pack.id);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const idempotencyKey = `${user.id}-${pack.id}-${Date.now()}`;

      const orderRes = await fetch("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id, provider: "razorpay", idempotencyKey }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) throw new Error(orderData.error ?? "Failed to create order");

      const { orderId, isDemo } = orderData.data;

      // ── Demo path: auto-fulfill without opening any UI ───────────────────
      if (isDemo) {
        console.log("[credits] DEMO MODE — auto-calling demo webhook, no modal shown");
        const demoRes = await fetch("/api/billing/demo/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, provider: "razorpay" }),
        });
        const demoData = await demoRes.json();
        if (!demoRes.ok || !demoData.success) throw new Error(demoData.error ?? "Demo fulfillment failed");

        await refreshUser();
        await loadHistory();
        setPurchaseSuccess({ credits: pack.credits });
        return;
      }

      // ── Production path: open Razorpay Checkout ──────────────────────────
      const { razorpayOrderId, amount, currency } = orderData.data;
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) throw new Error("Razorpay is not configured. Please contact support.");

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load Razorpay checkout. Please try again.");

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         keyId,
          order_id:    razorpayOrderId,
          amount,
          currency,
          name:        "Zencra Labs",
          description: `${pack.credits} Credits — ${pack.name} Pack`,
          prefill:     { name: user.name ?? "", email: user.email ?? "" },
          theme:       { color: "#2563EB" },

          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id:   string;
            razorpay_signature:  string;
          }) => {
            try {
              const verifyRes = await fetch("/api/billing/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId:   response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) throw new Error(verifyData.error ?? "Verification failed");

              await refreshUser();
              await loadHistory();
              setPurchaseSuccess({ credits: pack.credits });
              resolve();
            } catch (err) { reject(err); }
          },

          modal: { ondismiss: () => resolve() },
        });
        rzp.open();
      });

    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)", borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px",
  };

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", margin: "0 0 10px", fontFamily: "var(--font-familjen-grotesk)" }}>
          YOUR CREDITS
        </p>
        <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 32, fontWeight: 800, color: "var(--page-text)", margin: "0 0 6px", lineHeight: 1.1 }}>Credits</h1>
        <p style={{ fontFamily: "var(--font-familjen-grotesk)", fontSize: "15px", color: "#64748B", margin: 0 }}>Your balance, top-ups, and usage history</p>
      </div>

      {/* ── Feedback banners ─────────────────────────────────────────────────── */}
      {purchaseSuccess && (
        <div style={{ ...card, padding: "16px 20px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", gap: 12 }}>
          <CheckCircle size={18} style={{ color: "#10B981", flexShrink: 0 }} />
          <span style={{ fontSize: "14px", color: "#10B981", fontWeight: 600, fontFamily: "var(--font-familjen-grotesk)" }}>{purchaseSuccess.credits.toLocaleString()} credits added to your account!</span>
          <button onClick={() => setPurchaseSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#10B981", cursor: "pointer", padding: 0, display: "flex" }}><X size={16} /></button>
        </div>
      )}
      {purchaseError && (
        <div style={{ ...card, padding: "16px 20px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 12 }}>
          <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
          <span style={{ fontSize: "14px", color: "#EF4444", fontWeight: 500, fontFamily: "var(--font-familjen-grotesk)" }}>{purchaseError}</span>
          <button onClick={() => setPurchaseError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 0, display: "flex" }}><X size={16} /></button>
        </div>
      )}

      {/* ── Balance card ──────────────────────────────────────────────────────── */}
      <div style={{
        ...card,
        padding: "28px 32px",
        background: "linear-gradient(135deg, #0A1122 0%, #130d22 100%)",
        border: "1px solid rgba(168,85,247,0.2)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", left: "30%", width: "140px", height: "140px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Plan chip */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <div style={{
            padding: "4px 12px", borderRadius: 20,
            background: `${planColor}22`, border: `1px solid ${planColor}55`,
            fontSize: 11, fontWeight: 700, color: planColor,
            fontFamily: "var(--font-familjen-grotesk)", letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {planLabel}
          </div>
        </div>

        {/* Balance number */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: "60px", fontWeight: 800, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.02em" }}>{user.credits.toLocaleString()}</span>
          <span style={{ fontSize: "20px", color: "#A855F7", fontWeight: 700, fontFamily: "var(--font-display, 'Syne', sans-serif)" }}>cr</span>
        </div>

        {/* Allocation / usage info — free users see trial copy, paid users see credit bar */}
        {planKey === "free" ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8, fontFamily: "var(--font-familjen-grotesk)" }}>Free Trial</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.8, fontFamily: "var(--font-familjen-grotesk)" }}>
              <span style={{ color: "#94A3B8", fontWeight: 600 }}>10</span> image generations with Nano Banana models<br />
              <span style={{ color: "#94A3B8", fontWeight: 600 }}>3</span> video generations with Kling 3.0, 2.6, or 2.5 Turbo<br />
              <span style={{ color: "#94A3B8", fontWeight: 600 }}>50</span> bonus credits
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#475569", fontFamily: "var(--font-familjen-grotesk)", lineHeight: 1.5 }}>
              Usage is tracked automatically during generation.
            </div>
          </div>
        ) : (
          <>
            {/* X of Y label */}
            <div style={{ fontSize: "13px", color: "#64748B", marginBottom: 14, fontFamily: "var(--font-familjen-grotesk)" }}>
              <span style={{ color: "#94A3B8", fontWeight: 600 }}>{user.credits.toLocaleString()}</span>
              {" of "}
              <span style={{ color: "#94A3B8", fontWeight: 600 }}>{planLimit.toLocaleString()} cr</span>
              {" · "}
              <span style={{ color: "#A855F7", fontWeight: 600 }}>{credPctStr} remaining</span>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${credPct}%`,
                  background: credPct > 85
                    ? "linear-gradient(90deg, #EF4444, #F97316)"
                    : "linear-gradient(90deg, #A855F7, #2563EB)",
                  borderRadius: "4px", transition: "width 0.5s ease",
                }} />
              </div>
            </div>

            {/* Bar end labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-familjen-grotesk)" }}>0</span>
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "var(--font-familjen-grotesk)" }}>{planLimit.toLocaleString()} cr monthly</span>
            </div>

            {/* Reset note */}
            <div style={{ fontSize: "12px", color: "#475569", fontFamily: "var(--font-familjen-grotesk)", lineHeight: 1.6 }}>
              Monthly plan credits reset each billing cycle.{" "}
              <span style={{ color: "#64748B" }}>Booster credits expire 90 days from purchase.</span>
            </div>
          </>
        )}
      </div>

      {/* ── Booster packs ─────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: "28px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 20, fontWeight: 800, color: "var(--page-text)", margin: "0 0 4px", lineHeight: 1.2 }}>
            Buy Credits
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontFamily: "var(--font-familjen-grotesk)" }}>
            Add extra credits to your account any time.
          </p>
        </div>

        {/* Eligibility note */}
        <div style={{ marginBottom: "20px", padding: "12px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <Info size={15} style={{ color: "#64748B", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, lineHeight: 1.6, fontFamily: "var(--font-familjen-grotesk)" }}>
            <strong style={{ color: "#94A3B8", fontWeight: 600 }}>Booster Packs require an active primary plan.</strong>{" "}
            Booster credits expire 90 days from purchase, whether used or not.
            {!hasActivePlan && (
              <>{" "}<a href="/dashboard/subscription" style={{ color: "#60A5FA", fontWeight: 600, textDecoration: "none" }}>Choose a plan →</a></>
            )}
          </p>
        </div>

        {packsLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 180, borderRadius: 14, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease infinite" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {packs.map((pack) => {
              const meta     = pack.metadata;
              const color    = (meta?.color as string) ?? "#2563EB";
              const popular  = Boolean(meta?.popular);
              const isBuying = purchasing === pack.id;
              const price    = `$${(pack.price_cents / 100).toFixed(2)}`;
              const locked   = !hasActivePlan;
              const perCrStr = `$${((pack.price_cents / pack.credits) / 100).toFixed(3)}/cr`;

              return (
                <div
                  key={pack.id}
                  style={{
                    position: "relative", borderRadius: "16px",
                    border: `1px solid ${popular && !locked ? color + "55" : "rgba(255,255,255,0.08)"}`,
                    padding: "20px",
                    background: locked
                      ? "rgba(255,255,255,0.01)"
                      : popular
                        ? `linear-gradient(145deg, ${color}18 0%, rgba(255,255,255,0.02) 100%)`
                        : "rgba(255,255,255,0.03)",
                    display: "flex", flexDirection: "column", gap: "0",
                    transition: "border-color 0.15s, transform 0.15s",
                    opacity: locked ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!locked) {
                      (e.currentTarget as HTMLElement).style.borderColor = color + "88";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!locked) {
                      (e.currentTarget as HTMLElement).style.borderColor = popular ? color + "55" : "rgba(255,255,255,0.08)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    }
                  }}
                >
                  {/* Badge row */}
                  {(popular && !locked) && (
                    <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap", fontFamily: "var(--font-familjen-grotesk)" }}>
                      MOST POPULAR
                    </div>
                  )}
                  {locked && (
                    <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#334155", color: "#94A3B8", fontSize: 10, fontWeight: 700, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap", fontFamily: "var(--font-familjen-grotesk)" }}>
                      PLAN REQUIRED
                    </div>
                  )}

                  {/* Pack name */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: locked ? "#475569" : color, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-familjen-grotesk)", marginBottom: 8 }}>
                    {pack.name}
                  </div>

                  {/* Credit count */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 28, fontWeight: 800, color: "#DBEAFE", letterSpacing: "-0.02em", lineHeight: 1 }}>{pack.credits.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>cr</span>
                  </div>

                  {/* Price row */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 22, fontWeight: 700, color: locked ? "#475569" : color, letterSpacing: "-0.01em" }}>{price}</span>
                  </div>

                  {/* Per-credit rate */}
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, fontFamily: "var(--font-familjen-grotesk)" }}>
                    {perCrStr}
                  </div>

                  {/* Expiry chip */}
                  <div style={{ marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", width: "fit-content" }}>
                    <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600, fontFamily: "var(--font-familjen-grotesk)" }}>Expires 90 days</span>
                  </div>

                  {/* CTA */}
                  {locked ? (
                    <a
                      href="/dashboard/subscription"
                      style={{
                        marginTop: "auto", padding: "10px 0", borderRadius: "10px", fontSize: 12, fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                        color: "#60A5FA", cursor: "pointer", transition: "all 0.15s",
                        textAlign: "center", textDecoration: "none", display: "block",
                        fontFamily: "var(--font-familjen-grotesk)",
                      }}
                    >
                      Choose a plan first
                    </a>
                  ) : (
                    <button
                      onClick={() => handleBuy(pack)}
                      disabled={!!purchasing}
                      style={{
                        marginTop: "auto", padding: "10px 0", borderRadius: "10px", fontSize: 13, fontWeight: 700, border: "none",
                        background: isBuying ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${color}, ${color}bb)`,
                        color: isBuying ? "rgba(255,255,255,0.4)" : "#fff",
                        cursor: purchasing ? "not-allowed" : "pointer", transition: "all 0.15s",
                        width: "100%", fontFamily: "var(--font-familjen-grotesk)",
                      }}
                    >
                      {isBuying ? "Opening…" : `Buy ${pack.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Credit Cost Guide ─────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: "28px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 20, fontWeight: 800, color: "var(--page-text)", margin: "0 0 4px", lineHeight: 1.2 }}>
            Credit Cost Guide
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.6, fontFamily: "var(--font-familjen-grotesk)" }}>
            Exact costs are shown before each generation. Ranges below are typical estimates.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
          {[
            { studio: "Image Studio",      range: "4–20 cr",    color: "#2563EB", Icon: ImageIcon },
            { studio: "Video Studio",      range: "20–120 cr",  color: "#7C3AED", Icon: Video     },
            { studio: "Audio Studio",      range: "2–12 cr",    color: "#D97706", Icon: Music     },
            { studio: "Character Studio",  range: "8–40 cr",    color: "#F59E0B", Icon: User2     },
            { studio: "Creative Director", range: "4–80 cr",    color: "#0EA5A0", Icon: Layers    },
            { studio: "Lipsync Studio",    range: "10–60 cr",   color: "#EC4899", Icon: Video     },
          ].map(({ studio, range, color, Icon }) => (
            <div
              key={studio}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: `1px solid ${color}22`,
                background: `${color}08`,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-familjen-grotesk)", lineHeight: 1.3 }}>
                  {studio}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: "22px", fontWeight: 800, color, letterSpacing: "-0.01em", lineHeight: 1 }}>
                {range}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transaction History ───────────────────────────────────────────────── */}
      <div style={{ ...card, padding: "28px 28px" }}>
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 20, fontWeight: 800, color: "var(--page-text)", margin: "0 0 4px", lineHeight: 1.2 }}>
              Transaction History
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontFamily: "var(--font-familjen-grotesk)" }}>
              {historyLoading ? "Loading…" : `${visibleHistory.length} transaction${visibleHistory.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 62, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease infinite" }} />
            ))}
          </div>
        ) : visibleHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(168,85,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Zap size={18} style={{ color: "#A855F7" }} />
            </div>
            <p style={{ fontSize: 14, color: "#94A3B8", margin: "0 0 4px", fontFamily: "var(--font-familjen-grotesk)", fontWeight: 600 }}>
              No transactions yet
            </p>
            <p style={{ fontSize: 13, color: "#475569", margin: 0, fontFamily: "var(--font-familjen-grotesk)" }}>
              Generate something or buy credits to see your history here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleHistory.map((tx, i) => {
              const isPositive              = tx.amount > 0;
              const { Icon, color, bg }     = txIcon(tx.type, tx.metadata, tx.description);
              const { action, tool }        = txLabel(tx);

              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    borderBottom: i < visibleHistory.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    margin: "0 -14px",
                  }}
                >
                  {/* Icon box */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: bg, border: `1px solid ${color}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={16} style={{ color }} />
                  </div>

                  {/* Labels */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--page-text)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-familjen-grotesk)" }}>
                      {action}
                    </div>
                    {tool && (
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontFamily: "var(--font-familjen-grotesk)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tool}
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: "#475569", flexShrink: 0, fontFamily: "var(--font-familjen-grotesk)" }}>
                    {txTimeShort(tx.created_at)}
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-display, 'Syne', sans-serif)",
                      fontSize: 14, fontWeight: 700,
                      color: isPositive ? "#10B981" : "#94A3B8",
                      letterSpacing: "-0.01em",
                    }}>
                      {isPositive ? "+" : "−"}{Math.abs(tx.amount).toLocaleString()}
                      <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 3, color: isPositive ? "#10B981" : "#64748B" }}>cr</span>
                    </div>
                    {tx.balance_after != null && (
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 1, fontFamily: "var(--font-familjen-grotesk)" }}>
                        bal{" "}
                        <span style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 700, color: "#64748B", letterSpacing: "-0.01em" }}>
                          {tx.balance_after.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
