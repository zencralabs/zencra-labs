"use client";

import { Gift, Zap, Clock, Package, Heart } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS PAGE — Coming soon preview surface
// Gift sending, gift card redemption, and checkout are not yet live.
// No credits are sent, received, or granted from this page.
// ─────────────────────────────────────────────────────────────────────────────

const GIFT_PREVIEW = [
  { credits: 500,  label: "Light Gift",   color: "#2563EB", note: "Quick creativity boost" },
  { credits: 1000, label: "Creator Gift", color: "#6366F1", note: "For the serious creator"  },
  { credits: 2500, label: "Pro Gift",     color: "#14B8A6", note: "Power-user level" },
  { credits: 5000, label: "Studio Gift",  color: "#D4AF37", note: "The ultimate creative gift" },
];

const WHAT_GIFTS_WILL_DO = [
  { icon: Zap,     color: "#2563EB", title: "Send credits directly",   desc: "Transfer a credit pack to any Zencra user by email. Credits arrive in their account instantly." },
  { icon: Gift,    color: "#6366F1", title: "Gift card codes",         desc: "Purchase a gift card and share the code. Recipients redeem it anytime from this page." },
  { icon: Heart,   color: "#14B8A6", title: "Give a plan upgrade",     desc: "Sponsor a month of Creator or Pro for someone whose work you want to support." },
  { icon: Package, color: "#D4AF37", title: "Receive & track gifts",   desc: "All gifts received — credits, codes, plan upgrades — appear here for full visibility." },
];

export default function GiftsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ padding: "40px 48px", width: "100%" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, color: "var(--page-text)", margin: 0, letterSpacing: "-0.02em" }}>
            Gifts
          </h1>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#D4AF37", backgroundColor: "rgba(212,175,55,0.12)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(212,175,55,0.25)", letterSpacing: "0.08em" }}>
            COMING SOON
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Send credits to friends or gift a plan upgrade. Gift cards and credit transfers are being built — nothing is purchasable yet.
        </p>
      </div>

      {/* ── What gifts will do ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "36px 40px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--page-text)" }}>What you&apos;ll be able to do</div>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", backgroundColor: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.07)" }}>UPCOMING</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {WHAT_GIFTS_WILL_DO.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{ display: "flex", gap: "16px", padding: "20px 22px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${item.color}20` }}>
                  <Icon size={18} style={{ color: item.color }} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "5px" }}>{item.title}</div>
                  <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }}>

        {/* ── Gift pack preview ──────────────────────────────────────────── */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "20px", padding: "32px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(212,175,55,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Gift size={16} style={{ color: "#D4AF37" }} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, color: "var(--page-text)" }}>Gift Packs</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Coming soon — preview only</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            {GIFT_PREVIEW.map(pack => (
              <div key={pack.credits} style={{ padding: "16px", borderRadius: "12px", border: `1px solid ${pack.color}20`, background: `${pack.color}08`, cursor: "not-allowed", opacity: 0.7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                  <Zap size={13} style={{ color: pack.color }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: pack.color }}>{pack.credits.toLocaleString()}</span>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>cr</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8", marginBottom: "2px" }}>{pack.label}</div>
                <div style={{ fontSize: "10px", color: "#475569" }}>{pack.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Clock size={13} style={{ color: "#475569", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#475569" }}>Gift purchasing and delivery is not yet available. Prices and credit amounts may change before launch.</span>
          </div>
        </div>

        {/* ── Right column ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Redeem gift card — coming soon */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={16} style={{ color: "#6366F1" }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Redeem Gift Card</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Secure redemption coming soon</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                disabled
                placeholder="GIFT-XXXX-XXXX-XXXX"
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "10px 14px", color: "#334155", fontSize: "13px", outline: "none", boxSizing: "border-box", letterSpacing: "0.05em", cursor: "not-allowed" }}
              />
              <button
                disabled
                style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", color: "#334155", fontSize: "12px", fontWeight: 700, cursor: "not-allowed", whiteSpace: "nowrap" }}>
                Coming Soon
              </button>
            </div>
            <div style={{ fontSize: "11px", color: "#334155", marginTop: "10px" }}>
              Gift card redemption will be validated server-side before credits are applied.
            </div>
          </div>

          {/* Received gifts — honest empty state */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)", flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "18px" }}>Received Gifts</div>
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <Gift size={20} style={{ color: "#334155" }} />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>No gifts received yet</div>
              <div style={{ fontSize: "11px", color: "#334155", lineHeight: 1.6, maxWidth: "280px", margin: "0 auto" }}>
                Gifts sent to your account will appear here once the gifting system is live.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
