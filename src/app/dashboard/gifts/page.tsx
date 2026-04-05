"use client";

import { useState } from "react";
import { Gift, Send, Zap, CheckCircle, Clock, Tag } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS PAGE — Send & receive credit gifts / gift cards
// ─────────────────────────────────────────────────────────────────────────────

const GIFT_PACKS = [
  { credits: 50,  price: "$2.49",  label: "Mini Gift",   color: "#2563EB" },
  { credits: 100, price: "$4.99",  label: "Gift Pack",   color: "#A855F7" },
  { credits: 300, price: "$12.99", label: "Big Gift",    color: "#0EA5A0" },
  { credits: 500, price: "$19.99", label: "Pro Gift",    color: "#F59E0B" },
];

const RECEIVED_GIFTS = [
  { from: "Zencra Labs", credits: 50, message: "Welcome bonus 🎉", date: "At signup", redeemed: true },
];

export default function GiftsPage() {
  const { user }        = useAuth();
  const [email, setEmail]       = useState("");
  const [message, setMessage]   = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [sent, setSent]         = useState(false);

  if (!user) return null;

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !email) return;
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setEmail(""); setMessage(""); setSelected(null);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", padding: "10px 14px", color: "var(--page-text)", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "820px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--page-text)", margin: 0 }}>Gifts</h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "6px" }}>Send credits to friends or redeem gift cards</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

        {/* ── SEND A GIFT ──────────────────────────────────────────────── */}
        <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Gift size={16} style={{ color: "#A855F7" }} />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Send a Gift</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Give credits to a friend</div>
            </div>
          </div>

          {/* Pack selection */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Pack</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {GIFT_PACKS.map(pack => (
                <button key={pack.credits} onClick={() => setSelected(pack.credits)}
                  style={{ padding: "10px", borderRadius: "10px", border: selected === pack.credits ? `1px solid ${pack.color}80` : "1px solid rgba(255,255,255,0.06)", background: selected === pack.credits ? `${pack.color}15` : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <Zap size={12} style={{ color: pack.color }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: selected === pack.credits ? pack.color : "#F8FAFC" }}>{pack.credits} cr</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#475569" }}>{pack.label} · {pack.price}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recipient Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@example.com" required
                style={inputStyle}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.5)"; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Personal Message (optional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Happy creating! 🎨"
                style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.5)"; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
            </div>
            <button type="submit"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px", borderRadius: "10px", border: "none", background: sent ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg,#A855F7,#2563EB)", color: sent ? "#10B981" : "#fff", fontSize: "13px", fontWeight: 700, cursor: !selected || !email ? "not-allowed" : "pointer", opacity: !selected || !email ? 0.6 : 1, transition: "all 0.2s" }}>
              {sent ? <><CheckCircle size={14} /> Gift Sent!</> : <><Send size={14} /> Send Gift</>}
            </button>
          </form>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Redeem gift card */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Tag size={16} style={{ color: "#F59E0B" }} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)" }}>Redeem Gift Card</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Enter your gift card code</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input placeholder="GIFT-XXXX-XXXX-XXXX" style={{ ...inputStyle, flex: 1, letterSpacing: "0.05em" }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.5)"; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
              <button style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#F59E0B,#EF4444)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Redeem
              </button>
            </div>
          </div>

          {/* Received gifts */}
          <div style={{ backgroundColor: "var(--page-bg-2)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.06)", flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--page-text)", marginBottom: "16px" }}>Received Gifts</div>
            {RECEIVED_GIFTS.map((gift, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#2563EB,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gift size={15} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--page-text)" }}>+{gift.credits} credits from {gift.from}</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>{gift.message}</div>
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                    <Clock size={9} /> {gift.date}
                  </div>
                </div>
                {gift.redeemed && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#10B981", fontWeight: 700 }}>
                    <CheckCircle size={11} /> Redeemed
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
