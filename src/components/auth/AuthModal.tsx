"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  X, Mail, Eye, EyeOff, Zap, Phone, Fingerprint,
  ArrowRight, ChevronLeft, ChevronRight, Key,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { TurnstileWidget } from "./TurnstileWidget";
import { AUTH_SLIDES } from "@/config/auth-modal-slides";

// Turnstile site key — set in Vercel env and local .env as NEXT_PUBLIC_TURNSTILE_SITE_KEY.
// When undefined (key not yet configured) the CAPTCHA block is skipped entirely,
// so dev environments without Cloudflare keys continue to work.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MODAL — Login / Sign Up — Full auth system
// Visual language: matches new /login page design (Cinematic Final v2).
// Behavior: modal overlay — studio state preserved underneath.
// Width: 1100px max (left 450px fixed / right flex:1)
// ─────────────────────────────────────────────────────────────────────────────

// ── Video model strip shown in right panel bottom ─────────────────────────────
const VIDEO_STRIP = [
  { name: "Kling 3.0",      color: "#818CF8" },
  { name: "Runway Gen 4",   color: "#A78BFA" },
  { name: "Seedance 2",     color: "#60A5FA" },
  { name: "Veo 3",          color: "#34D399" },
  { name: "LTX-2",          color: "#38BDF8" },
] as const;

// ── CSS Keyframes + class definitions ────────────────────────────────────────
const MODAL_KEYFRAMES = `
@keyframes amLeft  { from{opacity:0;transform:translateX(-18px)} to{opacity:1;transform:translateX(0)} }
@keyframes amUp    { from{opacity:0;transform:translateY(12px)}  to{opacity:1;transform:translateY(0)} }
@keyframes amFade  { from{opacity:0}                              to{opacity:1} }
@keyframes amPing  { 0%{transform:scale(1);opacity:.65} 100%{transform:scale(2.4);opacity:0} }
@keyframes amPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes amBeam  { 0%,100%{opacity:.06} 50%{opacity:.16} }
@keyframes amOrb   { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:.92;transform:scale(1.06)} }

.am-up   { animation:amUp   0.4s cubic-bezier(.22,.68,0,1.2) both }
.am-fade { animation:amFade 0.4s ease both }

/* Social auth button — matches .zl-btn */
.am-btn {
  display:flex; align-items:center; gap:10px;
  width:100%; padding:12px 16px; border-radius:13px;
  font-size:13.5px; font-weight:600; color:#D1D5DB;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  cursor:pointer; letter-spacing:-.01em;
  transition:background .18s,border-color .18s,box-shadow .18s,transform .14s,color .14s;
}
.am-btn:hover {
  background:rgba(37,99,235,0.1);
  border-color:rgba(59,130,246,0.32);
  box-shadow:0 0 20px rgba(37,99,235,0.14),inset 0 1px 0 rgba(255,255,255,0.06);
  transform:translateY(-1px); color:#fff;
}
.am-btn:active { transform:translateY(0); }

/* Primary CTA — matches .zl-cta */
.am-cta {
  display:flex; align-items:center; gap:10px;
  width:100%; padding:14px 18px; border-radius:13px;
  font-size:14px; font-weight:700; color:#ffffff; letter-spacing:-.015em;
  background:linear-gradient(135deg,#1E3A8A 0%,#2563EB 45%,#0369A1 100%);
  border:1px solid rgba(59,130,246,0.5);
  box-shadow:0 0 32px rgba(37,99,235,0.32),inset 0 1px 0 rgba(255,255,255,0.12);
  cursor:pointer;
  transition:box-shadow .22s,transform .18s,filter .18s,opacity .18s;
}
.am-cta:hover {
  box-shadow:0 0 60px rgba(37,99,235,0.55),0 0 110px rgba(14,165,160,0.14),inset 0 1px 0 rgba(255,255,255,0.15);
  transform:translateY(-1px); filter:brightness(1.08);
}
.am-cta:active { transform:translateY(0); }
.am-cta:disabled { opacity:0.65; transform:none; filter:none; cursor:not-allowed; }

/* Form input — matches .zl-input */
.am-input {
  width:100%; padding:12px 15px; border-radius:11px;
  font-size:14px; color:#F1F5F9; letter-spacing:-.01em;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.09);
  outline:none;
  transition:border-color .15s,box-shadow .15s,background .15s;
  box-sizing:border-box;
}
.am-input::placeholder { color:rgba(203,213,225,0.50); }
.am-input:focus {
  border-color:rgba(37,99,235,0.55);
  box-shadow:0 0 0 3px rgba(37,99,235,0.12),0 0 24px rgba(37,99,235,0.08);
  background:rgba(37,99,235,0.045);
}
.am-input:focus::placeholder { color:rgba(226,232,240,0.72); }

/* Gradient separator */
.am-sep { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent); }

/* Slide arrow button — matches .zl-arrow */
.am-arrow {
  display:flex; align-items:center; justify-content:center;
  width:30px; height:30px; border-radius:50%;
  background:rgba(255,255,255,0.09);
  border:1px solid rgba(255,255,255,0.13);
  cursor:pointer; color:#CBD5E1;
  transition:background .18s,border-color .18s,box-shadow .18s,color .18s,transform .14s;
  flex-shrink:0;
}
.am-arrow:hover {
  background:rgba(37,99,235,0.2);
  border-color:rgba(59,130,246,0.42);
  box-shadow:0 0 20px rgba(37,99,235,0.32);
  color:#fff; transform:scale(1.09);
}
.am-arrow:active { transform:scale(1); }

/* Video model chip */
.am-model-chip {
  display:flex; align-items:center; gap:7px;
  padding:6px 9px; border-radius:8px; cursor:default;
  transition:background .18s; flex:1; justify-content:center;
}
.am-model-chip:hover { background:rgba(255,255,255,0.05); }
`;

// ── SVG Brand Icons ───────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#F25022" d="M0 0h11.4v11.4H0z"/>
      <path fill="#7FBA00" d="M12.6 0H24v11.4H12.6z"/>
      <path fill="#00A4EF" d="M0 12.6h11.4V24H0z"/>
      <path fill="#FFB900" d="M12.6 12.6H24V24H12.6z"/>
    </svg>
  );
}

// ── OTP input — 6 digit boxes ─────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !refs.current[i]?.value && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = value.split("").concat(Array(6).fill("")).slice(0, 6);
    arr[i] = digit;
    const next = arr.join("");
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }} onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onFocus={e => {
            e.currentTarget.style.borderColor = "rgba(37,99,235,0.6)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
          style={{
            width: "46px", height: "54px", borderRadius: "10px", textAlign: "center",
            fontSize: "20px", fontWeight: 700, color: "#F1F5F9",
            background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
            outline: "none", caretColor: "transparent",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — memoized, full cinematic visual richness matching /login page
// ─────────────────────────────────────────────────────────────────────────────
const RightPanel = memo(function RightPanel({
  slideIdx, setSlideIdx, onClose,
}: {
  slideIdx: number;
  setSlideIdx: (i: number) => void;
  onClose: () => void;
}) {
  const slide = AUTH_SLIDES[slideIdx];

  return (
    <div style={{
      flex: 1,
      minWidth: "460px",
      position: "relative",
      overflow: "hidden",
      background: slide.gradient,
      transition: "background 0.9s ease",
    }}>

      {/* ── Slide image / video ── */}
      {slide.imageSrc && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${slide.imageSrc})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.75,
        }} />
      )}
      {slide.videoSrc && (
        <video
          key={slide.videoSrc}
          autoPlay muted loop playsInline preload="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
        >
          <source src={slide.videoSrc} type="video/mp4" />
        </video>
      )}

      {/* ── 4-directional cinematic vignettes ── */}
      {/* Bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "65%",
        background: "linear-gradient(to top, rgba(4,12,24,1.0) 0%, rgba(4,12,24,0.92) 14%, rgba(4,12,24,0.72) 32%, rgba(4,12,24,0.35) 54%, rgba(4,12,24,0.10) 75%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />
      {/* Left */}
      <div style={{
        position: "absolute", inset: 0, width: "25%",
        background: "linear-gradient(to right, rgba(4,12,24,0.65) 0%, rgba(4,12,24,0.22) 60%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />
      {/* Right */}
      <div style={{
        position: "absolute", inset: 0, left: "auto", width: "25%",
        background: "linear-gradient(to left, rgba(4,12,24,0.65) 0%, rgba(4,12,24,0.22) 60%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />
      {/* Top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "30%",
        background: "linear-gradient(to bottom, rgba(4,12,24,0.75) 0%, rgba(4,12,24,0.28) 50%, transparent 100%)",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* ── Accent orb ── */}
      <div style={{
        position: "absolute", bottom: "32%", left: "50%", transform: "translateX(-50%)",
        width: "220px", height: "220px", borderRadius: "50%",
        background: `radial-gradient(circle, ${slide.accent}38 0%, transparent 70%)`,
        filter: "blur(44px)",
        animation: "amPulse 4s ease-in-out infinite",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* ── Atmospheric light beam ── */}
      <div style={{
        position: "absolute",
        top: "-15%", left: "46%",
        width: "1.5px", height: "145%",
        background: "linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.16) 30%, rgba(37,99,235,0.12) 60%, transparent 100%)",
        transform: "rotate(-14deg)",
        animation: "amBeam 5s ease-in-out infinite",
        filter: "blur(8px)",
        pointerEvents: "none", zIndex: 3,
      }} />

      {/* ── Noise grain ── */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.032,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        pointerEvents: "none", zIndex: 3,
      }} />

      {/* ── Close button — top-right, 46px glass circle ── */}
      <button
        onClick={onClose}
        className="am-fade"
        style={{
          position: "absolute", top: "20px", right: "22px", zIndex: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "46px", height: "46px", borderRadius: "50%",
          background: "rgba(4,12,24,0.55)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.45)",
          cursor: "pointer",
          transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.18s",
          animationDelay: "0.3s",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "rgba(37,99,235,0.22)";
          el.style.borderColor = "rgba(96,165,250,0.35)";
          el.style.boxShadow = "0 0 0 1px rgba(96,165,250,0.12), 0 0 28px rgba(37,99,235,0.35), 0 4px 24px rgba(0,0,0,0.45)";
          el.style.transform = "scale(1.06)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "rgba(4,12,24,0.55)";
          el.style.borderColor = "rgba(255,255,255,0.12)";
          el.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.45)";
          el.style.transform = "scale(1)";
        }}
        aria-label="Close"
      >
        <X size={16} style={{ color: "#E2E8F0", strokeWidth: 2.5 }} />
      </button>

      {/* ── TOP CONTENT — slide tool eyebrow + title + description ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        zIndex: 10, padding: "38px 44px 0",
      }}>
        {/* Eyebrow */}
        <div
          className="am-up"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14, animationDelay: "0.2s" }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#60A5FA", boxShadow: "0 0 8px #60A5FA",
            display: "inline-block", flexShrink: 0,
            animation: "amOrb 3s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#60A5FA" }}>
            {slide.tool}
          </span>
        </div>

        {/* Slide title + description — re-keyed on change for entrance animation */}
        <div key={`slide-${slideIdx}`} className="am-up" style={{ animationDelay: "0.05s" }}>
          <h3 style={{
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
            fontWeight: 800, lineHeight: 1.05,
            letterSpacing: "-0.05em",
            marginBottom: "0.65rem", margin: "0 0 10px",
            textShadow: "0 2px 28px rgba(0,0,0,0.55)",
          }}>
            <span style={{ color: "#fff" }}>
              {slide.title.split(" ").slice(0, -1).join(" ")}{slide.title.split(" ").length > 1 ? " " : ""}
            </span>
            <span style={{
              background: `linear-gradient(90deg, ${slide.accent}, #60A5FA)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              {slide.title.split(" ").at(-1)}
            </span>
          </h3>
          <p style={{
            fontSize: 14.5, color: "rgba(226,232,240,0.88)",
            letterSpacing: "-0.01em", lineHeight: 1.55,
            maxWidth: 340,
            textShadow: "0 1px 10px rgba(0,0,0,0.45)",
            margin: 0,
          }}>
            {slide.desc}
          </p>
        </div>
      </div>

      {/* ── BOTTOM CONTENT — controls + video strip + metrics ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 10, padding: "0 44px 30px",
      }}>

        {/* Slide controls — [←]  pill dots  [→] */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <button
            className="am-arrow"
            onClick={() => setSlideIdx((slideIdx - 1 + AUTH_SLIDES.length) % AUTH_SLIDES.length)}
            aria-label="Previous slide"
          >
            <ChevronLeft size={14} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {AUTH_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIdx(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: i === slideIdx ? 22 : 6, height: 6,
                  borderRadius: 3, border: "none", cursor: "pointer", padding: 0,
                  background: i === slideIdx ? "rgba(96,165,250,0.95)" : "rgba(255,255,255,0.22)",
                  boxShadow: i === slideIdx ? "0 0 12px rgba(96,165,250,0.75)" : "none",
                  transition: "all 0.35s cubic-bezier(.22,.68,0,1.2)",
                }}
              />
            ))}
          </div>
          <button
            className="am-arrow"
            onClick={() => setSlideIdx((slideIdx + 1) % AUTH_SLIDES.length)}
            aria-label="Next slide"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Video model strip label */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#60A5FA", boxShadow: "0 0 6px #60A5FA",
            display: "inline-block", flexShrink: 0,
            animation: "amPulse 3s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#64748B" }}>
            Video Models in Zencra
          </span>
        </div>

        {/* Video model chips */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(4,12,24,0.58)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 11,
          backdropFilter: "blur(14px)",
          padding: "2px 4px",
          marginBottom: 18,
        }}>
          {VIDEO_STRIP.map((m, i) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div className="am-model-chip">
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: m.color, boxShadow: `0 0 6px ${m.color}80`,
                  display: "inline-block", flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#CBD5E1", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                  {m.name}
                </span>
              </div>
              {i < VIDEO_STRIP.length - 1 && (
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div style={{
          display: "flex", gap: 28,
          paddingTop: 13,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          alignItems: "center",
        }}>
          <div>
            <p style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1,
              textShadow: "0 0 22px rgba(96,165,250,0.45)", margin: 0,
            }}>10+</p>
            <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
              AI Models
            </p>
          </div>
          <div>
            <p style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1,
              textShadow: "0 0 22px rgba(96,165,250,0.45)", margin: 0,
            }}>4K</p>
            <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
              Max Quality
            </p>
          </div>
          <div>
            <span style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "1.9rem", fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 1,
              background: "linear-gradient(135deg, #60A5FA 0%, #34D399 45%, #22D3EE 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              filter: "drop-shadow(0 0 14px rgba(96,165,250,0.55))",
              display: "inline-block",
              animation: "amPulse 3.5s ease-in-out infinite",
            }}>∞</span>
            <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
              Creativity
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthModalProps {
  defaultTab: "login" | "signup";
  onClose: () => void;
}

type AuthView   = "default" | "email" | "phone" | "passkey";
type PhoneStep  = "phone" | "otp";

export function AuthModal({ defaultTab, onClose }: AuthModalProps) {
  const [authMode, setAuthMode]     = useState<"login" | "signup">(defaultTab);
  const [view, setView]             = useState<AuthView>("default");
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>("phone");

  // Email form
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Phone form
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState("");
  const [otpSent, setOtpSent]   = useState(false);
  const [countdown, setCountdown] = useState(0);

  // CAPTCHA
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaResetKey = `${authMode}-${view}`;

  const showCaptcha = Boolean(TURNSTILE_SITE_KEY) && (
    view === "email"
      ? (authMode === "signup" || failedAttempts >= 3)
      : view === "phone"
        ? failedAttempts >= 3
        : false
  );

  // State
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const handleSlideIdx = useCallback((i: number) => setSlideIdx(i), []);
  const [isMobile, setIsMobile] = useState(false);

  const { user, login, signup, loginWithOAuth, sendPhoneOtp, verifyPhoneOtp, loginWithPasskey } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Event-driven post-login redirect ──────────────────────────────────────
  const [pendingRedirect, setPendingRedirect] = useState(false);
  useEffect(() => {
    if (!pendingRedirect || !user) return;
    setPendingRedirect(false);
    const next = searchParams.get("next");
    const dest = next || (user.role === "admin" ? "/hub" : "/dashboard");
    onClose();
    router.push(dest);
  }, [user, pendingRedirect, onClose, router, searchParams]);

  // Slideshow
  useEffect(() => {
    const t = setInterval(() => setSlideIdx(i => (i + 1) % AUTH_SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  // OTP countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Escape key
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  function resetErrors() { setError(""); setSuccess(""); }
  function resetCaptcha() { setCaptchaToken(null); }
  function resetFailedAttempts() { setFailedAttempts(0); }

  function switchMode(mode: "login" | "signup") {
    setAuthMode(mode);
    setView("default");
    resetErrors();
    resetCaptcha();
    resetFailedAttempts();
  }

  function goBack() {
    setView("default");
    setPhoneStep("phone");
    resetErrors();
    resetCaptcha();
  }

  // ── Email/Password submit ──────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetErrors();
    if (authMode === "signup") {
      if (!name.trim()) { setError("Please enter your full name."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter."); return; }
      if (!/[0-9]/.test(password)) { setError("Password must contain at least one number."); return; }
      if (!/[^A-Za-z0-9]/.test(password)) { setError("Password must contain at least one special character (e.g. !@#$%)."); return; }
    }
    if (showCaptcha && !captchaToken) {
      setError("Please complete the verification before continuing.");
      return;
    }
    setLoading(true);
    let ok = false;
    try {
      if (authMode === "login") {
        ok = await login(email, password, captchaToken ?? undefined);
        if (!ok) {
          setFailedAttempts(n => n + 1);
          setError("Invalid email or password.");
        } else {
          setFailedAttempts(0);
        }
      } else {
        ok = await signup(name, email, password, captchaToken ?? undefined);
        if (!ok) setError("Couldn't create account. This email may already be registered.");
        else {
          setSuccess("Account created! Please check your email to verify your account.");
          return;
        }
      }
      if (ok) setPendingRedirect(true);
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  }

  // ── Send Phone OTP ─────────────────────────────────────────────────────────
  async function handleSendOtp() {
    resetErrors();
    const cleaned = phone.trim();
    if (!cleaned.startsWith("+") || cleaned.length < 8) {
      setError("Enter a valid phone number with country code, e.g. +91 98765 43210");
      return;
    }
    if (showCaptcha && !captchaToken) {
      setError("Please complete the verification before continuing.");
      return;
    }
    setLoading(true);
    const result = await sendPhoneOtp(cleaned, captchaToken ?? undefined);
    setLoading(false);
    if (result.success) {
      setPhoneStep("otp");
      setCountdown(60);
      setOtpSent(true);
      setFailedAttempts(0);
      resetCaptcha();
    } else {
      setFailedAttempts(n => n + 1);
      setError(result.error ?? "Failed to send OTP. Please try again.");
      resetCaptcha();
    }
  }

  // ── Verify Phone OTP ───────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    resetErrors();
    if (otp.replace(/\D/g, "").length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    const ok = await verifyPhoneOtp(phone.trim(), otp.replace(/\D/g, ""));
    setLoading(false);
    if (ok) { onClose(); router.push("/dashboard"); }
    else    setError("Invalid or expired code. Please try again.");
  }

  // ── Passkey login ──────────────────────────────────────────────────────────
  async function handlePasskey() {
    resetErrors();
    setLoading(true);
    const ok = await loginWithPasskey();
    setLoading(false);
    if (ok) { onClose(); router.push("/dashboard"); }
    else    setError("Passkey authentication failed or not set up.");
  }

  // ── Shared label style ────────────────────────────────────────────────────
  const lblStyle: React.CSSProperties = {
    display: "block", marginBottom: 6,
    fontSize: 10.5, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: "rgba(191,219,254,0.92)",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MODAL_KEYFRAMES }} />

      {/* Outer overlay */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1300,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: isMobile ? "0" : "20px",
          backgroundColor: "rgba(2,6,16,0.82)", backdropFilter: "blur(6px)",
          willChange: "transform",
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Inner card */}
        <div style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : "1100px",
          height: isMobile ? "100%" : "auto",
          display: "flex",
          borderRadius: isMobile ? "0" : "20px",
          overflow: "hidden",
          boxShadow: "0 40px 120px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.06)",
          position: "relative",
          willChange: "transform",
        }}>

          {/* ── LEFT PANEL: Form ──────────────────────────────────────────── */}
          <div style={{
            width: isMobile ? "100%" : "450px",
            flexShrink: 0,
            backgroundColor: "#040C18",
            padding: isMobile ? "32px 24px 40px" : "0",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            position: "relative",
          }}>

            {/* Subtle ambient glow */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 80% 60% at 20% 55%, rgba(29,78,216,0.07) 0%, transparent 60%)",
            }} />

            {/* Mobile-only close button */}
            {isMobile && (
              <button
                onClick={onClose}
                style={{
                  position: "absolute", top: "16px", right: "16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "rgba(8,15,28,0.72)", border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(18px)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)",
                  cursor: "pointer", zIndex: 10,
                  transition: "background 0.2s, border-color 0.2s",
                }}
              >
                <X size={15} style={{ color: "#E2E8F0", strokeWidth: 2.5 }} />
              </button>
            )}

            {/* Auth content — vertically centered on desktop */}
            <div style={{
              display: "flex", flex: 1, alignItems: "center", justifyContent: "center",
              padding: isMobile ? "0" : "40px 48px",
            }}>
              <div style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}>

                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "22px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "linear-gradient(135deg,#2563EB,#0EA5A0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display, 'Syne', sans-serif)",
                    fontWeight: 800, fontSize: "15px", color: "#fff",
                    boxShadow: "0 0 18px rgba(37,99,235,0.35)",
                  }}>Z</div>
                  <span style={{
                    fontFamily: "var(--font-display, 'Syne', sans-serif)",
                    fontWeight: 700, fontSize: "14px", color: "#F8FAFC",
                    letterSpacing: "-0.02em",
                  }}>
                    Zencra Labs
                  </span>
                </div>

                {/* ── DEFAULT VIEW ─────────────────────────────────────────── */}
                {view === "default" && (
                  <div className="am-up">
                    {/* Login/Signup pill toggle */}
                    <div style={{
                      display: "inline-flex", gap: "2px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "12px", padding: "3px",
                      border: "1px solid rgba(255,255,255,0.07)",
                      marginBottom: "18px",
                    }}>
                      {(["login", "signup"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => switchMode(mode)}
                          style={{
                            padding: "7px 20px", borderRadius: "9px",
                            border: authMode === mode ? "1px solid rgba(59,130,246,0.28)" : "1px solid transparent",
                            background: authMode === mode ? "rgba(37,99,235,0.2)" : "transparent",
                            color: authMode === mode ? "#93C5FD" : "rgba(255,255,255,0.38)",
                            fontSize: "13px", fontWeight: authMode === mode ? 700 : 500,
                            cursor: "pointer", transition: "all 0.15s",
                            fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {mode === "login" ? "Log In" : "Sign Up"}
                        </button>
                      ))}
                    </div>

                    {/* Eyebrow pill */}
                    <div
                      className="am-fade"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        marginBottom: 14, padding: "4px 12px", borderRadius: 999,
                        background: "rgba(37,99,235,0.09)",
                        border: "1px solid rgba(37,99,235,0.2)",
                        fontSize: 10.5, fontWeight: 700,
                        letterSpacing: "0.07em", textTransform: "uppercase",
                        color: "#93C5FD", animationDelay: "0.04s",
                      }}
                    >
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: "#60A5FA", boxShadow: "0 0 7px #60A5FA",
                        display: "inline-block", flexShrink: 0,
                      }} />
                      {authMode === "login" ? "Welcome back to Zencra" : "Join Zencra"}
                    </div>

                    {/* Heading */}
                    <h2 style={{
                      fontFamily: "var(--font-display, 'Syne', sans-serif)",
                      fontSize: "clamp(1.65rem, 2.4vw, 2rem)",
                      fontWeight: 800, color: "#fff",
                      margin: "0 0 6px", lineHeight: 1.1, letterSpacing: "-0.045em",
                      textShadow: "0 2px 18px rgba(15,23,42,0.45)",
                    }}>
                      {authMode === "login" ? (
                        <>
                          <span>Sign in to your </span>
                          <span style={{
                            background: "linear-gradient(90deg, #60A5FA 0%, #34D399 50%, #22D3EE 100%)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                          }}>Zencra</span>
                          <span> account</span>
                        </>
                      ) : (
                        "Create your account"
                      )}
                    </h2>
                    <p style={{
                      fontSize: "13.5px", color: "rgba(226,232,240,0.82)",
                      margin: "0 0 22px", letterSpacing: "-0.01em",
                      fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                    }}>
                      {authMode === "login"
                        ? "Access the future of AI content creation."
                        : "Start generating for free — no card needed"}
                    </p>

                    {/* Email CTA — primary */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <button
                        className="am-cta"
                        onClick={() => { setView("email"); resetErrors(); }}
                      >
                        <Mail size={15} style={{ color: "#93C5FD", flexShrink: 0 }} />
                        {authMode === "login" ? "Continue with Email" : "Sign up with Email"}
                        <ArrowRight size={14} style={{ marginLeft: "auto", color: "#93C5FD", opacity: 0.65 }} />
                      </button>

                      {/* Social 2×2 grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <button className="am-btn" onClick={() => loginWithOAuth("google")}>
                          <GoogleIcon /><span>Google</span>
                        </button>
                        <button className="am-btn" onClick={() => loginWithOAuth("apple")}>
                          <AppleIcon /><span>Apple</span>
                        </button>
                        <button className="am-btn" onClick={() => loginWithOAuth("facebook")}>
                          <FacebookIcon /><span>Facebook</span>
                        </button>
                        <button className="am-btn">
                          <MicrosoftIcon /><span>Microsoft</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "2px 0" }}>
                        <div className="am-sep" />
                        <span style={{
                          fontSize: 10.5, color: "rgba(100,116,139,0.82)", fontWeight: 600,
                          letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                          fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                        }}>
                          or continue with
                        </span>
                        <div className="am-sep" />
                      </div>

                      {/* OTP + Passkey row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <button
                          className="am-btn"
                          style={{ justifyContent: "center" }}
                          onClick={() => { setView("phone"); resetErrors(); }}
                        >
                          <Key size={13} style={{ color: "#475569" }} />
                          <span style={{ fontSize: 13 }}>Phone OTP</span>
                        </button>
                        <button
                          className="am-btn"
                          style={{ justifyContent: "center" }}
                          onClick={() => { setView("passkey"); resetErrors(); }}
                        >
                          <Fingerprint size={13} style={{ color: "#475569" }} />
                          <span style={{ fontSize: 13 }}>Passkey</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── EMAIL VIEW ───────────────────────────────────────────── */}
                {view === "email" && (
                  <div className="am-up" style={{ animationDelay: "0.04s" }}>
                    {/* Back + heading */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
                      <button
                        onClick={goBack}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                          cursor: "pointer",
                        }}
                        aria-label="Back"
                      >
                        <ChevronLeft size={14} style={{ color: "#94A3B8" }} />
                      </button>
                      <div>
                        <h2 style={{
                          fontFamily: "var(--font-display, 'Syne', sans-serif)",
                          fontSize: "1.55rem", fontWeight: 800,
                          letterSpacing: "-0.04em", color: "#fff", lineHeight: 1.15, margin: 0,
                        }}>
                          {authMode === "login" ? "Sign in with email" : "Create your account"}
                        </h2>
                        <p style={{
                          marginTop: 3, fontSize: 13,
                          color: "rgba(226,232,240,0.78)",
                          fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                        }}>
                          {authMode === "login" ? "Enter your credentials below" : "Fill in your details to get started"}
                        </p>
                      </div>
                    </div>

                    {/* Email/Password form */}
                    <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                      {authMode === "signup" && (
                        <div>
                          <label style={lblStyle}>Full Name</label>
                          <div style={{ position: "relative" }}>
                            <svg
                              width="14" height="14" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2"
                              style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}
                            >
                              <circle cx="12" cy="8" r="4"/>
                              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                            </svg>
                            <input
                              className="am-input"
                              type="text"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              placeholder="Jai Kumar Nair"
                              style={{ paddingLeft: "36px" }}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label style={lblStyle}>Email Address</label>
                        <div style={{ position: "relative" }}>
                          <Mail size={14} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
                          <input
                            className="am-input"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            style={{ paddingLeft: "36px" }}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <label style={{ ...lblStyle, marginBottom: 0 }}>Password</label>
                          {authMode === "login" && (
                            <button
                              type="button"
                              onClick={() => { onClose(); router.push("/auth/reset-password"); }}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "#3B82F6", fontSize: "12px", fontWeight: 600,
                                fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                                transition: "color 0.14s",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#93C5FD"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3B82F6"; }}
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div style={{ position: "relative" }}>
                          <input
                            className="am-input"
                            type={showPass ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{ paddingRight: "42px" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(s => !s)}
                            style={{
                              position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                              background: "none", border: "none", cursor: "pointer",
                              color: "#334155", transition: "color 0.14s",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
                          >
                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {authMode === "signup" && password.length > 0 && (
                          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {[
                              { ok: password.length >= 8,          label: "Min 8 characters" },
                              { ok: /[A-Z]/.test(password),        label: "One uppercase letter" },
                              { ok: /[0-9]/.test(password),        label: "One number" },
                              { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
                            ].map(r => (
                              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "11px", color: r.ok ? "#4ade80" : "#475569" }}>{r.ok ? "✓" : "○"}</span>
                                <span style={{
                                  fontSize: "11.5px",
                                  color: r.ok ? "#4ade80" : "rgba(148,163,184,0.65)",
                                  fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                                }}>{r.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {error && (
                        <p style={{ fontSize: "13px", color: "#F87171", margin: 0, letterSpacing: "-0.01em" }}>
                          {error}
                        </p>
                      )}
                      {success && (
                        <p style={{ fontSize: "13px", color: "#6EE7B7", margin: 0, letterSpacing: "-0.01em" }}>
                          {success}
                        </p>
                      )}

                      {showCaptcha && (
                        <TurnstileWidget
                          siteKey={TURNSTILE_SITE_KEY}
                          resetKey={captchaResetKey}
                          onSuccess={token => setCaptchaToken(token)}
                          onExpire={() => setCaptchaToken(null)}
                        />
                      )}

                      <button
                        type="submit"
                        className="am-cta"
                        disabled={loading || pendingRedirect}
                        style={{ marginTop: "2px" }}
                      >
                        <Zap size={15} style={{ color: "#93C5FD", flexShrink: 0 }} />
                        {(loading || pendingRedirect) ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Free Account"}
                        {!(loading || pendingRedirect) && <ArrowRight size={14} style={{ marginLeft: "auto", color: "#93C5FD", opacity: 0.7 }} />}
                      </button>
                    </form>

                    {/* Switch mode link */}
                    <p style={{
                      fontSize: "13px", color: "rgba(203,213,225,0.82)", marginTop: "18px", textAlign: "center",
                      fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                    }}>
                      {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
                      <button
                        onClick={() => switchMode(authMode === "login" ? "signup" : "login")}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#3B82F6", fontWeight: 600, fontSize: "13px",
                          fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                          transition: "color 0.14s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#93C5FD"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3B82F6"; }}
                      >
                        {authMode === "login" ? "Sign up free →" : "Sign in →"}
                      </button>
                    </p>
                  </div>
                )}

                {/* ── PHONE VIEW ───────────────────────────────────────────── */}
                {view === "phone" && (
                  <div className="am-up" style={{ animationDelay: "0.04s" }}>
                    {/* Back + heading */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
                      <button
                        onClick={goBack}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                          cursor: "pointer",
                        }}
                        aria-label="Back"
                      >
                        <ChevronLeft size={14} style={{ color: "#94A3B8" }} />
                      </button>
                      <div>
                        <h2 style={{
                          fontFamily: "var(--font-display, 'Syne', sans-serif)",
                          fontSize: "1.55rem", fontWeight: 800,
                          letterSpacing: "-0.04em", color: "#fff", lineHeight: 1.15, margin: 0,
                        }}>
                          {phoneStep === "phone" ? "Mobile OTP sign-in" : "Check your phone"}
                        </h2>
                        <p style={{
                          marginTop: 3, fontSize: 13,
                          color: "rgba(226,232,240,0.78)",
                          fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                        }}>
                          {phoneStep === "phone"
                            ? "We'll send a one-time code to your phone"
                            : `Code sent to ${phone}`}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {phoneStep === "phone" && (
                        <>
                          <div>
                            <label style={lblStyle}>Mobile Number</label>
                            <div style={{ marginTop: "6px", position: "relative" }}>
                              <Phone size={14} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
                              <input
                                className="am-input"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+1 555 000 0000"
                                style={{ paddingLeft: "36px" }}
                              />
                            </div>
                            <p style={{ fontSize: "11.5px", color: "rgba(100,116,139,0.82)", marginTop: "7px", fontFamily: "var(--font-body, var(--font-sans, sans-serif))" }}>
                              Include country code — e.g. +1 for US, +44 for UK, +91 for India
                            </p>
                          </div>
                          {error && <p style={{ fontSize: "13px", color: "#F87171", margin: 0 }}>{error}</p>}
                          {showCaptcha && (
                            <TurnstileWidget
                              siteKey={TURNSTILE_SITE_KEY}
                              resetKey={captchaResetKey}
                              onSuccess={token => setCaptchaToken(token)}
                              onExpire={() => setCaptchaToken(null)}
                            />
                          )}
                          <button className="am-cta" onClick={handleSendOtp} disabled={loading}>
                            <Zap size={15} style={{ color: "#93C5FD", flexShrink: 0 }} />
                            {loading ? "Sending…" : "Send OTP"}
                            {!loading && <ArrowRight size={14} style={{ marginLeft: "auto", color: "#93C5FD", opacity: 0.7 }} />}
                          </button>
                        </>
                      )}

                      {phoneStep === "otp" && (
                        <>
                          <OtpInput value={otp} onChange={setOtp} />
                          {error && (
                            <p style={{ fontSize: "13px", color: "#F87171", textAlign: "center", margin: 0 }}>{error}</p>
                          )}
                          <button
                            className="am-cta"
                            onClick={handleVerifyOtp}
                            disabled={loading || otp.replace(/\D/g, "").length < 6}
                          >
                            <Zap size={15} style={{ color: "#93C5FD", flexShrink: 0 }} />
                            {loading ? "Verifying…" : "Verify & Sign In"}
                            {!loading && otp.replace(/\D/g, "").length === 6 && (
                              <ArrowRight size={14} style={{ marginLeft: "auto", color: "#93C5FD", opacity: 0.7 }} />
                            )}
                          </button>
                          <div style={{ textAlign: "center" }}>
                            {countdown > 0 ? (
                              <p style={{ fontSize: "12.5px", color: "rgba(100,116,139,0.82)" }}>
                                Resend code in <strong style={{ color: "#94A3B8" }}>{countdown}s</strong>
                              </p>
                            ) : (
                              <button
                                onClick={handleSendOtp}
                                disabled={loading}
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "#3B82F6", fontSize: "12.5px", fontWeight: 600,
                                  fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                                  transition: "color 0.14s",
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#93C5FD"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3B82F6"; }}
                              >
                                Resend OTP
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── PASSKEY VIEW ─────────────────────────────────────────── */}
                {view === "passkey" && (
                  <div className="am-up" style={{ animationDelay: "0.04s" }}>
                    {/* Back + heading */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
                      <button
                        onClick={goBack}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                          cursor: "pointer",
                        }}
                        aria-label="Back"
                      >
                        <ChevronLeft size={14} style={{ color: "#94A3B8" }} />
                      </button>
                      <div>
                        <h2 style={{
                          fontFamily: "var(--font-display, 'Syne', sans-serif)",
                          fontSize: "1.55rem", fontWeight: 800,
                          letterSpacing: "-0.04em", color: "#fff", lineHeight: 1.15, margin: 0,
                        }}>
                          Passkey sign-in
                        </h2>
                        <p style={{ marginTop: 3, fontSize: 13, color: "rgba(226,232,240,0.78)" }}>
                          Use your device authenticator
                        </p>
                      </div>
                    </div>

                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "28px 0",
                      textAlign: "center",
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.018)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      gap: 18,
                    }}>
                      <div style={{ position: "relative", width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          background: "radial-gradient(circle,rgba(37,99,235,0.4),transparent)",
                          animation: "amPing 2.3s cubic-bezier(0,0,0.2,1) infinite",
                        }} />
                        <div style={{
                          width: 52, height: 52, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(37,99,235,0.12)",
                          border: "1px solid rgba(37,99,235,0.28)",
                          boxShadow: "0 0 28px rgba(37,99,235,0.18)",
                        }}>
                          <Fingerprint size={24} style={{ color: "#93C5FD" }} />
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 14.5, fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.02em" }}>Ready to authenticate</p>
                        <p style={{ marginTop: 3, fontSize: 12.5, color: "rgba(203,213,225,0.85)" }}>Use your device biometrics or security key</p>
                      </div>
                      {error && <p style={{ fontSize: "13px", color: "#F87171", textAlign: "center" }}>{error}</p>}
                      <button
                        className="am-cta"
                        style={{ width: "auto", padding: "11px 26px", opacity: loading ? 0.7 : 1 }}
                        disabled={loading}
                        onClick={handlePasskey}
                      >
                        {loading ? "Authenticating…" : "Authenticate"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── FOOTER (all views) ───────────────────────────────────── */}
                <p style={{
                  fontSize: "11px", color: "rgba(100,116,139,0.72)",
                  marginTop: "18px", textAlign: "center", lineHeight: 1.5,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                  fontFamily: "var(--font-body, var(--font-sans, sans-serif))",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(100,116,139,0.72)", flexShrink: 0 }} aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  By continuing you agree to our{" "}
                  <a href="/privacy" target="_blank" style={{ color: "#475569", transition: "color 0.14s" }}>Privacy Policy</a>
                  {" "}and{" "}
                  <a href="/terms" target="_blank" style={{ color: "#475569", transition: "color 0.14s" }}>Terms of Use</a>.
                </p>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: memoized cinematic showcase ── */}
          {!isMobile && (
            <RightPanel slideIdx={slideIdx} setSlideIdx={handleSlideIdx} onClose={onClose} />
          )}
        </div>
      </div>
    </>
  );
}
