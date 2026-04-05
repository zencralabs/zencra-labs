"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Mail, Eye, EyeOff, Zap } from "lucide-react";
import { useAuth } from "./AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MODAL — Login / Sign Up popup with cinematic image slideshow
// Inspired by Higgsfield.ai — left: form, right: rotating AI showcase
// ─────────────────────────────────────────────────────────────────────────────

const slides = [
  {
    gradient: "linear-gradient(160deg, #060d1f 0%, #0f2255 40%, #1d4ed8 100%)",
    accent: "#2563EB",
    tool: "Kling 3.0",
    title: "Cinematic AI Video",
    desc: "Best price on market for generations on the best video model",
  },
  {
    gradient: "linear-gradient(160deg, #0d0618 0%, #2a0e52 40%, #7c3aed 100%)",
    accent: "#A855F7",
    tool: "Nano Banana Pro",
    title: "AI Image Generation",
    desc: "Write a prompt and create stunning 4K images instantly",
  },
  {
    gradient: "linear-gradient(160deg, #060d18 0%, #0a2828 40%, #0d6b67 100%)",
    accent: "#0EA5A0",
    tool: "Google Veo",
    title: "AI Video with Sound",
    desc: "Advanced AI video generation with realistic audio",
  },
  {
    gradient: "linear-gradient(160deg, #180a06 0%, #3d1408 40%, #c2410c 100%)",
    accent: "#F97316",
    tool: "Runway ML",
    title: "Gen-3 Alpha Turbo",
    desc: "Edit scenes and elements with professional precision",
  },
];

interface AuthModalProps {
  defaultTab: "login" | "signup";
  onClose: () => void;
}

export function AuthModal({ defaultTab, onClose }: AuthModalProps) {
  const [tab, setTab]               = useState<"login" | "signup">(defaultTab);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [slideIdx, setSlideIdx]     = useState(0);
  const { login, signup }           = useAuth();
  const router                       = useRouter();

  // Auto-advance slideshow every 4s
  useEffect(() => {
    const t = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    let ok = false;
    if (tab === "login") {
      ok = await login(email, password);
      if (!ok) setError("Invalid email or password. Please check your credentials.");
    } else {
      if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
      ok = await signup(name, email, password);
      if (!ok) setError("Couldn't create account. This email may already be registered.");
    }
    setLoading(false);
    if (ok) {
      onClose();
      router.push("/dashboard");
    }
  }

  const slide = slides[slideIdx];

  return (
    // Backdrop
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: "860px", display: "flex", borderRadius: "20px", overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.7)", position: "relative" }}>

        {/* ── LEFT: Form ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, backgroundColor: "#080E1C", padding: "48px 44px", display: "flex", flexDirection: "column", minWidth: "340px" }}>
          {/* Close */}
          <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#64748B", display: "flex" }}>
            <X size={16} />
          </button>

          {/* Logo + headline */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px", color: "#fff" }}>Z</div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#F8FAFC" }}>Zencra Labs</span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#F8FAFC", margin: "0 0 6px" }}>
              {tab === "login" ? "Welcome back" : "Welcome to Zencra Labs"}
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              {tab === "login" ? "Sign in to your account" : "Sign up and generate for free"}
            </p>
          </div>

          {/* Social buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {[
              { label: "Continue with Google",    icon: "G", bg: "#fff",      color: "#1a1a1a" },
              { label: "Continue with Apple",     icon: "🍎", bg: "#fff",     color: "#1a1a1a" },
              { label: "Continue with Microsoft", icon: "⊞", bg: "#2F2F2F",  color: "#fff"    },
            ].map(s => (
              <button key={s.label}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "11px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#F8FAFC", fontSize: "13px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}>
                <span style={{ fontSize: "14px" }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "11px", color: "#475569" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {tab === "signup" && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "5px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jai Kumar Nair" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 14px", color: "#F8FAFC", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "5px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 14px 10px 36px", color: "#F8FAFC", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "5px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 40px 10px 14px", color: "#F8FAFC", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)"; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <p style={{ fontSize: "12px", color: "#FCA5A5", margin: "0" }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ marginTop: "4px", padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "opacity 0.2s" }}>
              <Zap size={15} />
              {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Free Account"}
            </button>
          </form>

          {/* Switch tab */}
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "20px", textAlign: "center" }}>
            {tab === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontWeight: 600, fontSize: "12px" }}>
              {tab === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>
          <p style={{ fontSize: "10px", color: "#334155", marginTop: "12px", textAlign: "center", lineHeight: 1.5 }}>
            By continuing, I acknowledge the Privacy Policy and Terms of Use.
          </p>
        </div>

        {/* ── RIGHT: Slideshow ─────────────────────────────────────────── */}
        <div style={{ width: "380px", flexShrink: 0, position: "relative", overflow: "hidden", background: slide.gradient, transition: "background 0.8s ease" }}>
          {/* Shimmer overlay */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.07) 0%, transparent 60%)" }} />
          {/* Dark bottom gradient for text */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }} />

          {/* Accent glow */}
          <div style={{ position: "absolute", bottom: "30%", left: "50%", transform: "translateX(-50%)", width: "200px", height: "200px", borderRadius: "50%", background: `radial-gradient(circle, ${slide.accent}40 0%, transparent 70%)`, filter: "blur(30px)" }} />

          {/* Content */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px" }}>
            {/* Tool indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: slide.accent, boxShadow: `0 0 12px ${slide.accent}` }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{slide.tool}</span>
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>{slide.title}</h3>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: "0 0 20px", lineHeight: 1.5 }}>{slide.desc}</p>

            {/* Slide dots */}
            <div style={{ display: "flex", gap: "6px" }}>
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlideIdx(i)}
                  style={{ width: i === slideIdx ? "24px" : "6px", height: "6px", borderRadius: "10px", background: i === slideIdx ? slide.accent : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
