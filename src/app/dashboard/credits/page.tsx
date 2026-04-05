"use client";

import { useState } from "react";
import { Zap, ImageIcon, Video, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS PAGE — Balance, usage history, top-up options
// ─────────────────────────────────────────────────────────────────────────────

const TOPUP_PACKS = [
  { credits: 100,   price: "$4.99",  label: "Starter",  color: "#2563EB", popular: false },
  { credits: 300,   price: "$12.99", label: "Creator",  color: "#A855F7", popular: true  },
  { credits: 750,   price: "$24.99", label: "Studio",   color: "#0EA5A0", popular: false },
  { credits: 2000,  price: "$59.99", label: "Pro",      color: "#F59E0B", popular: false },
];

const COST_GUIDE = [
  { action: "Generate Image (SD)",    cost: 1,   icon: ImageIcon, color: "#2563EB" },
  { action: "Generate Image (HD)",    cost: 2,   icon: ImageIcon, color: "#2563EB" },
  { action: "Generate Image (4K)",    cost: 4,   icon: ImageIcon, color: "#2563EB" },
  { action: "Generate Video (15s)",   cost: 5,   icon: Video,     color: "#0EA5A0" },
  { action: "Generate Video (30s)",   cost: 10,  icon: Video,     color: "#0EA5A0" },
  { action: "Generate Video (60s)",   cost: 20,  icon: Video,     color: "#0EA5A0" },
];

const HISTORY = [
  { type: "used",  action: "Image Generated",   tool: "Nano Banana Pro", time: "Today, 10:23 AM",     amount: -2  },
  { type: "used",  action: "Video Created",      tool: "Kling 3.0",       time: "Today, 09:05 AM",     amount: -5  },
  { type: "added", action: "Welcome Bonus",      tool: "Zencra Labs",     time: "Account creation",    amount: +50 },
  { type: "used",  action: "Image Generated",    tool: "Flux",            time: "Yesterday, 3:44 PM",  amount: -2  },
  { type: "used",  action: "Video Created",      tool: "Runway ML",       time: "Yesterday, 11:12 AM", amount: -10 },
];

export default function CreditsPage() {
  const { user }    = useAuth();
  const [bought, setBought] = useState<number | null>(null);

  if (!user) return null;

  const credPct = Math.min((user.credits / 100) * 100, 100);
  const totalUsed = HISTORY.filter(h => h.type === "used").reduce((s, h) => s + Math.abs(h.amount), 0);

  return (
    <div style={{ padding: "40px", maxWidth: "900px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Credits</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Your balance, top-ups, and usage history</p>
      </div>

      {/* Balance card */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "28px", border: "1px solid rgba(168,85,247,0.2)", marginBottom: "28px", background: "linear-gradient(135deg, #0A1122 0%, #130d22 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Current Balance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "52px", fontWeight: 900, color: "var(--page-text)", lineHeight: 1 }}>{user.credits}</span>
              <span style={{ fontSize: "18px", color: "#A855F7", fontWeight: 700 }}>credits</span>
            </div>
            {/* Credit bar */}
            <div style={{ width: "300px", height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: "16px" }}>
              <div style={{ height: "100%", width: `${credPct}%`, background: "linear-gradient(90deg,#2563EB,#A855F7)", borderRadius: "3px", transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>{user.credits} of 100 credits (Free plan cap)</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: "20px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Used This Month</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#EF4444", display: "flex", alignItems: "center", gap: "6px" }}>
                  <TrendingDown size={16} /> {totalUsed}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Earned</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: "6px" }}>
                  <TrendingUp size={16} /> 50
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Top-up section */}
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--page-text)", marginBottom: "14px" }}>Top Up Credits</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {TOPUP_PACKS.map(pack => (
              <div key={pack.credits}
                style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "12px", padding: "14px 16px", border: bought === pack.credits ? `1px solid ${pack.color}60` : pack.popular ? "1px solid rgba(37,99,235,0.3)" : "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                {pack.popular && (
                  <div style={{ position: "absolute", top: "-8px", right: "12px", backgroundColor: "#2563EB", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "8px", textTransform: "uppercase" }}>
                    Best Value
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: `${pack.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Zap size={15} style={{ color: pack.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--page-text)" }}>{pack.credits} Credits</div>
                    <div style={{ fontSize: "10px", color: "#64748B" }}>{pack.label} Pack</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: pack.color }}>{pack.price}</span>
                  <button onClick={() => setBought(pack.credits)}
                    style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: bought === pack.credits ? "rgba(16,185,129,0.15)" : `linear-gradient(135deg,${pack.color},${pack.color}bb)`, color: bought === pack.credits ? "#10B981" : "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "5px" }}>
                    {bought === pack.credits ? <><CheckCircle size={11} /> Bought</> : "Buy Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost guide + History */}
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--page-text)", marginBottom: "14px" }}>Credit Cost Guide</h2>
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: "24px" }}>
            {COST_GUIDE.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", borderBottom: i < COST_GUIDE.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <Icon size={13} style={{ color: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "12px", color: "#94A3B8" }}>{item.action}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--page-text)" }}>{item.cost} cr</span>
                </div>
              );
            })}
          </div>

          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--page-text)", marginBottom: "14px" }}>Usage History</h2>
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            {HISTORY.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 16px", borderBottom: i < HISTORY.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.action}</div>
                  <div style={{ fontSize: "10px", color: "#475569", display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                    <Clock size={9} /> {item.time}
                  </div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: item.amount > 0 ? "#10B981" : "#F8FAFC", flexShrink: 0 }}>
                  {item.amount > 0 ? `+${item.amount}` : item.amount} cr
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
