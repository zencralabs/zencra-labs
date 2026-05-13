"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import type { CreditPack } from "@/lib/billing/types";

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS PAGE — Balance, usage history, top-up options
// Packs and history loaded from live API. Top-up initiates billing flow.
// ─────────────────────────────────────────────────────────────────────────────

// Cost guide: /api/credits/model-costs returns { baseCosts, qualityMultipliers, addonCosts }
// keyed by internal model keys (e.g. "nano-banana-pro") — not suitable for direct display.
// Static note shown instead. Estimates are surfaced per-generation in each studio.
// No COST_GUIDE constant needed — see Cost Guide section below.

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

export default function CreditsPage() {
  const { user, refreshUser } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [packs, setPacks]               = useState<CreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);

  const [history, setHistory] = useState<{
    id: string; type: string; amount: number; balance_after: number;
    description: string; created_at: string;
  }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [purchasing, setPurchasing]         = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ credits: number } | null>(null);
  const [purchaseError, setPurchaseError]   = useState<string | null>(null);

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
    fetch("/api/credits/history?limit=20")
      .then((r) => r.json())
      .then((d) => { if (d.success) setHistory(d.data); })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (!user) return null;

  const credPct = Math.min((user.credits / 100) * 100, 100);

  // Plan gate: booster packs require an active primary plan
  const hasActivePlan = !!user.plan && user.plan !== "free";

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

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "var(--page-bg-2)", borderRadius: "16px",
    padding: "24px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "20px",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: "15px", fontWeight: 700, color: "var(--page-text)", margin: "0 0 16px 0",
  };
  const label: React.CSSProperties = {
    fontSize: "11px", fontWeight: 700, color: "#475569",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "900px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Credits</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Your balance, top-ups, and usage history</p>
      </div>

      {/* ── Feedback banners ─────────────────────────────────────────────── */}
      {purchaseSuccess && (
        <div style={{ ...card, background: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ fontSize: 14, color: "#10a37f", fontWeight: 600 }}>{purchaseSuccess.credits} credits added to your account!</span>
          <button onClick={() => setPurchaseSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#10a37f", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}
      {purchaseError && (
        <div style={{ ...card, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 14, color: "#ef4444", fontWeight: 500 }}>{purchaseError}</span>
          <button onClick={() => setPurchaseError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}

      {/* ── Balance card ──────────────────────────────────────────────────── */}
      <div style={{ ...card, background: "linear-gradient(135deg, #0A1122 0%, #130d22 100%)", border: "1px solid rgba(168,85,247,0.2)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={label}>Current Balance</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "52px", fontWeight: 700, color: "#DBEAFE", lineHeight: 1, letterSpacing: "-0.01em" }}>{user.credits.toLocaleString()}</span>
          <span style={{ fontSize: "18px", color: "#A855F7", fontWeight: 700 }}>credits</span>
        </div>
        <div style={{ marginTop: "20px", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg, #A855F7, #2563EB)", borderRadius: "3px", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* ── Top-up packs ──────────────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={sectionTitle}>Buy Credits</h2>

        {/* Eligibility note */}
        <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <span style={{ fontSize: "15px", flexShrink: 0, marginTop: "1px" }}>ℹ️</span>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#94A3B8", fontWeight: 600 }}>Booster Packs require an active primary plan.</strong>{" "}
            Booster credits expire 90 days from purchase, whether used or not.
            {!hasActivePlan && (
              <>{" "}<a href="/dashboard/subscription" style={{ color: "#60A5FA", fontWeight: 600, textDecoration: "none" }}>Choose a plan →</a></>
            )}
          </p>
        </div>

        {packsLoading ? (
          <div style={{ display: "flex", gap: 12 }}>
            {[1,2,3,4].map((i) => <div key={i} style={{ flex: 1, height: 120, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease infinite" }} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {packs.map((pack) => {
              const meta    = pack.metadata;
              const color   = (meta?.color as string) ?? "#2563EB";
              const popular = Boolean(meta?.popular);
              const isBuying = purchasing === pack.id;
              const price   = `$${(pack.price_cents / 100).toFixed(2)}`;
              const locked  = !hasActivePlan;

              return (
                <div
                  key={pack.id}
                  style={{
                    position: "relative", borderRadius: "14px",
                    border: `1px solid ${popular && !locked ? color : "rgba(255,255,255,0.08)"}`,
                    padding: "20px 16px",
                    background: locked ? "rgba(255,255,255,0.01)" : popular ? `${color}15` : "rgba(255,255,255,0.03)",
                    display: "flex", flexDirection: "column", gap: "8px", transition: "border-color 0.15s, transform 0.15s",
                    opacity: locked ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={(e) => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = popular ? color : "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; } }}
                >
                  {popular && !locked && (
                    <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                      MOST POPULAR
                    </div>
                  )}
                  {locked && (
                    <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#334155", color: "#94A3B8", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                      🔒 PLAN REQUIRED
                    </div>
                  )}
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.01em" }}>{pack.credits.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>credits</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: locked ? "#475569" : color, marginTop: 4, letterSpacing: "-0.01em" }}>{price}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>${((pack.price_cents / pack.credits) / 100).toFixed(3)} / credit</div>
                  {locked ? (
                    <a
                      href="/dashboard/subscription"
                      style={{
                        marginTop: "12px", padding: "9px 0", borderRadius: "10px", fontSize: 12, fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                        color: "#60A5FA", cursor: "pointer", transition: "all 0.15s",
                        textAlign: "center", textDecoration: "none", display: "block",
                      }}
                    >
                      Choose a primary plan first
                    </a>
                  ) : (
                    <button
                      onClick={() => handleBuy(pack)}
                      disabled={!!purchasing}
                      style={{
                        marginTop: "12px", padding: "9px 0", borderRadius: "10px", fontSize: 13, fontWeight: 700, border: "none",
                        background: isBuying ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${color}, ${color}cc)`,
                        color: isBuying ? "rgba(255,255,255,0.4)" : "#fff",
                        cursor: purchasing ? "not-allowed" : "pointer", transition: "all 0.15s",
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

      {/* ── Cost guide ────────────────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={sectionTitle}>Credit Cost Guide</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
          Credit costs vary by studio and model. Estimates are shown before each generation.
        </p>
      </div>

      {/* ── Transaction history ───────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={sectionTitle}>Transaction History</h2>
        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map((i) => <div key={i} style={{ height: 44, borderRadius: 8, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease infinite" }} />)}
          </div>
        ) : history.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "20px 0" }}>
            No transactions yet. Generate something or buy credits to get started.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {history.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: tx.type === "purchase" ? "rgba(16,163,127,0.15)" : "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                      {tx.type === "purchase" ? "💳" : tx.type === "refund" ? "↩" : "⚡"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--page-text)" }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{new Date(tx.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: isPositive ? "#10a37f" : "#DBEAFE", letterSpacing: "-0.01em" }}>
                      {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>bal: <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.01em", color: "#DBEAFE" }}>{tx.balance_after?.toLocaleString() ?? "—"}</span></div>
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
