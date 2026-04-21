"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Mail, Eye, EyeOff, Zap, Phone, Fingerprint, ArrowLeft } from "lucide-react";
import { useAuth } from "./AuthContext";
import { TurnstileWidget } from "./TurnstileWidget";
import { AUTH_SLIDES } from "@/config/auth-modal-slides";

// Turnstile site key — set in Vercel env and local .env as NEXT_PUBLIC_TURNSTILE_SITE_KEY.
// When undefined (key not yet configured) the CAPTCHA block is skipped entirely,
// so dev environments without Cloudflare keys continue to work.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MODAL — Login / Sign Up — Full auth system
// Width: ~1020px (20% wider than original 860px)
// Supports: Email/Password, Phone OTP, Google, Apple, Facebook, Passkey
// ─────────────────────────────────────────────────────────────────────────────

// ── SVG Brand Icons ───────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
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
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.7)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
          style={{
            width: "44px", height: "52px", borderRadius: "10px", textAlign: "center",
            fontSize: "20px", fontWeight: 700, color: "#F8FAFC",
            background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.12)",
            outline: "none", caretColor: "transparent", transition: "border-color 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ── Social button ─────────────────────────────────────────────────────────────
function SocialBtn({
  icon, label, onClick, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        padding: "11px 16px", borderRadius: "10px", width: "100%",
        border: "1px solid rgba(255,255,255,0.09)",
        background: hover ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
        color: "#F8FAFC", fontSize: "13px", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s", opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function InputField({
  label, type = "text", value, onChange, placeholder, icon, rightEl, readOnly,
}: {
  label: string; type?: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode; rightEl?: React.ReactNode; readOnly?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "5px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {icon && (
          <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}>
            {icon}
          </div>
        )}
        <input
          type={type} value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: `1px solid ${focus ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "10px", padding: `10px ${rightEl ? "40px" : "14px"} 10px ${icon ? "36px" : "14px"}`,
            color: "#F8FAFC", fontSize: "13px", outline: "none", boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
        />
        {rightEl && (
          <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
            {rightEl}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — memoized so form keystrokes don't re-render it
// ─────────────────────────────────────────────────────────────────────────────
const RightPanel = memo(function RightPanel({
  slideIdx, setSlideIdx,
}: { slideIdx: number; setSlideIdx: (i: number) => void }) {
  const slide = AUTH_SLIDES[slideIdx];
  return (
    <div style={{
      width: "420px", flexShrink: 0, position: "relative",
      overflow: "hidden", background: slide.gradient, transition: "background 0.9s ease",
    }}>
      {slide.imageSrc && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${slide.imageSrc})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.7,
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
      {/* Bottom gradient for text readability — no dark overlay on the video */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "65%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }} />
      {/* Accent glow */}
      <div style={{
        position: "absolute", bottom: "32%", left: "50%", transform: "translateX(-50%)",
        width: "220px", height: "220px", borderRadius: "50%",
        background: `radial-gradient(circle, ${slide.accent}44 0%, transparent 70%)`,
        filter: "blur(35px)",
      }} />
      {/* Bottom content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: slide.accent, boxShadow: `0 0 10px ${slide.accent}` }} />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>{slide.tool}</span>
        </div>
        <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: "0 0 8px", lineHeight: 1.15, textShadow: "0 2px 16px rgba(0,0,0,0.95)" }}>{slide.title}</h3>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", margin: "0 0 20px", lineHeight: 1.6, textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>{slide.desc}</p>
        <div style={{ display: "flex", gap: "6px" }}>
          {AUTH_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)} style={{
              width: i === slideIdx ? "22px" : "6px", height: "6px",
              borderRadius: "10px",
              background: i === slideIdx ? slide.accent : "rgba(255,255,255,0.2)",
              border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0,
            }} />
          ))}
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

type AuthMethod = "email" | "phone";
type PhoneStep  = "phone" | "otp";

export function AuthModal({ defaultTab, onClose }: AuthModalProps) {
  const [authMode, setAuthMode]     = useState<"login" | "signup">(defaultTab);
  const [method, setMethod]         = useState<AuthMethod>("email");
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>("phone");

  // Email form
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Phone form
  const [phone, setPhone]   = useState("");
  const [otp, setOtp]       = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // CAPTCHA — adaptive, risk-based
  // failedAttempts: counts consecutive login / phone-OTP-send failures.
  // Resets to 0 when authMode or method changes.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // resetKey forces TurnstileWidget to tear down and re-render the iframe.
  const captchaResetKey = `${authMode}-${method}`;

  // When to show (and enforce) CAPTCHA:
  //   Signup           → always
  //   Email login      → after 3 consecutive failures (4th attempt onward)
  //   Phone OTP send   → after 3 consecutive failures (4th attempt onward)
  //   OAuth            → never (not in this modal)
  const showCaptcha = Boolean(TURNSTILE_SITE_KEY) && (
    method === "email"
      ? (authMode === "signup" || failedAttempts >= 3)
      : failedAttempts >= 3
  );

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const handleSlideIdx = useCallback((i: number) => setSlideIdx(i), []);
  const [isMobile, setIsMobile] = useState(false);

  const { user, login, signup, loginWithOAuth, sendPhoneOtp, verifyPhoneOtp, loginWithPasskey } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Event-driven post-login redirect ──────────────────────────────────────
  // After login succeeds, wait for AuthContext to populate user with role,
  // then redirect: ?next param takes priority, else role-based (admin→/hub).
  const [pendingRedirect, setPendingRedirect] = useState(false);

  useEffect(() => {
    if (!pendingRedirect || !user) return;
    setPendingRedirect(false);
    // ?next param (set by middleware when unauthenticated user hits protected route)
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
    // Enforce CAPTCHA only when this flow requires it
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
      if (ok) {
        // Signal the useEffect above to redirect once AuthContext has user+role
        setPendingRedirect(true);
      }
    } finally {
      setLoading(false);
      // Always reset the token after a submit attempt so a fresh challenge is
      // required if the user corrects an error and tries again.
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
    // Enforce CAPTCHA only when this flow requires it (after 3 failures)
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
      resetCaptcha(); // fresh challenge required if user tries to resend
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

  // ── Styles ─────────────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: "12px", fontWeight: 700, color: "#64748B",
    letterSpacing: "0.06em", textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: "6px",
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: "8px", border: "none",
    background: active ? "rgba(37,99,235,0.2)" : "transparent",
    color: active ? "#60A5FA" : "rgba(255,255,255,0.35)",
    fontSize: "13px", fontWeight: active ? 700 : 500, cursor: "pointer",
    transition: "all 0.15s",
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? "0" : "20px",
        backgroundColor: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)",
        willChange: "transform", // promote to own compositor layer — prevents bg video paint from lagging this
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%",
        maxWidth: isMobile ? "100%" : "1020px",
        height: isMobile ? "100%" : "auto",
        display: "flex",
        borderRadius: isMobile ? "0" : "20px",
        overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.75)",
        position: "relative",
        willChange: "transform",
      }}>

        {/* ── LEFT PANEL: Form ────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          backgroundColor: "#080E1C",
          padding: isMobile ? "32px 24px 40px" : "44px 48px",
          display: "flex",
          flexDirection: "column",
          minWidth: isMobile ? "100%" : "420px",
          overflowY: "auto",
        }}>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "16px", right: "16px",
              background: "rgba(255,255,255,0.06)", border: "none",
              borderRadius: "8px", padding: "6px", cursor: "pointer",
              color: "#64748B", display: "flex", zIndex: 10,
            }}
          >
            <X size={16} />
          </button>

          {/* Logo + headline */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "linear-gradient(135deg,#2563EB,#0EA5A0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "14px", color: "#fff",
              }}>Z</div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#F8FAFC" }}>Zencra Labs</span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#F8FAFC", margin: "0 0 5px" }}>
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              {authMode === "login" ? "Sign in to your account" : "Start generating for free — no card needed"}
            </p>
          </div>

          {/* Method tabs: Email / Phone */}
          <div style={{
            display: "flex", gap: "4px", background: "rgba(255,255,255,0.04)",
            borderRadius: "10px", padding: "3px", marginBottom: "20px",
          }}>
            <button style={tabBtn(method === "email")} onClick={() => { setMethod("email"); resetErrors(); resetCaptcha(); resetFailedAttempts(); }}>
              <Mail size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
              Email
            </button>
            <button style={tabBtn(method === "phone")} onClick={() => { setMethod("phone"); setPhoneStep("phone"); resetErrors(); resetCaptcha(); resetFailedAttempts(); }}>
              <Phone size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
              Phone
            </button>
          </div>

          {/* ── SOCIAL BUTTONS (shown on email tab only) ── */}
          {method === "email" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "18px" }}>
                <SocialBtn icon={<GoogleIcon />} label="Continue with Google"
                  onClick={() => loginWithOAuth("google")} disabled={loading} />
                <SocialBtn icon={<AppleIcon />} label="Continue with Apple"
                  onClick={() => loginWithOAuth("apple")} disabled={loading} />
                <SocialBtn icon={<FacebookIcon />} label="Continue with Facebook"
                  onClick={() => loginWithOAuth("facebook")} disabled={loading} />
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                <span style={{ fontSize: "11px", color: "#475569" }}>OR CONTINUE WITH EMAIL</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
              </div>

              {/* Email/Password form */}
              <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {authMode === "signup" && (
                  <InputField label="Full Name" value={name} onChange={setName}
                    placeholder="Jai Kumar Nair"
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                  />
                )}
                <InputField label="Email" type="email" value={email} onChange={setEmail}
                  placeholder="you@example.com"
                  icon={<Mail size={14} />}
                />
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <span style={labelStyle}>Password</span>
                    {authMode === "login" && (
                      <button type="button"
                        onClick={() => { onClose(); router.push("/auth/reset-password"); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontSize: "11px", fontWeight: 600 }}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <InputField label="" type={showPass ? "text" : "password"} value={password} onChange={setPassword}
                    placeholder="••••••••"
                    rightEl={
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                  {authMode === "signup" && password.length > 0 && (
                    <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      {[
                        { ok: password.length >= 8,          label: "Min 8 characters" },
                        { ok: /[A-Z]/.test(password),        label: "One uppercase letter" },
                        { ok: /[0-9]/.test(password),        label: "One number" },
                        { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "11px", color: r.ok ? "#4ade80" : "#475569" }}>{r.ok ? "✓" : "○"}</span>
                          <span style={{ fontSize: "11px", color: r.ok ? "#4ade80" : "#475569" }}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error   && <p style={{ fontSize: "12px", color: "#FCA5A5", margin: 0 }}>{error}</p>}
                {success && <p style={{ fontSize: "12px", color: "#6EE7B7", margin: 0 }}>{success}</p>}

                {/* ── Turnstile CAPTCHA — signup: always; login: after 3 failed attempts ── */}
                {showCaptcha && (
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    resetKey={captchaResetKey}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                  />
                )}

                <button type="submit" disabled={loading || pendingRedirect} style={{
                  marginTop: "4px", padding: "12px", borderRadius: "10px", border: "none",
                  background: "linear-gradient(135deg,#2563EB,#0EA5A0)",
                  color: "#fff", fontSize: "14px", fontWeight: 700,
                  cursor: (loading || pendingRedirect) ? "not-allowed" : "pointer",
                  opacity: (loading || pendingRedirect) ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "opacity 0.2s",
                }}>
                  <Zap size={15} />
                  {(loading || pendingRedirect) ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Free Account"}
                </button>
              </form>
            </>
          )}

          {/* ── PHONE OTP FLOW ── */}
          {method === "phone" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {phoneStep === "phone" && (
                <>
                  <div>
                    <label style={labelStyle}>Mobile Number</label>
                    <div style={{ marginTop: "5px", position: "relative" }}>
                      <Phone size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+1 555 000 0000"
                        onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.5)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                        style={{
                          width: "100%", background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px",
                          padding: "10px 14px 10px 36px", color: "#F8FAFC", fontSize: "13px",
                          outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>
                      Include country code — e.g. +1 for US, +44 for UK, +91 for India
                    </p>
                  </div>

                  {error && <p style={{ fontSize: "12px", color: "#FCA5A5", margin: 0 }}>{error}</p>}

                  {/* ── Turnstile CAPTCHA for phone OTP — after 3 failed send attempts ── */}
                  {showCaptcha && (
                    <TurnstileWidget
                      siteKey={TURNSTILE_SITE_KEY}
                      resetKey={captchaResetKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                    />
                  )}

                  <button onClick={handleSendOtp} disabled={loading} style={{
                    padding: "12px", borderRadius: "10px", border: "none",
                    background: "linear-gradient(135deg,#2563EB,#0EA5A0)",
                    color: "#fff", fontSize: "14px", fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}>
                    <Zap size={15} />
                    {loading ? "Sending…" : "Send OTP"}
                  </button>
                </>
              )}

              {phoneStep === "otp" && (
                <>
                  <button
                    onClick={() => { setPhoneStep("phone"); setOtp(""); resetErrors(); }}
                    style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "12px", cursor: "pointer", padding: 0 }}
                  >
                    <ArrowLeft size={13} /> Back
                  </button>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>📱</div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#F8FAFC", margin: "0 0 4px" }}>Check your phone</p>
                    <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                      We sent a 6-digit code to <strong style={{ color: "#94A3B8" }}>{phone}</strong>
                    </p>
                  </div>

                  <OtpInput value={otp} onChange={setOtp} />

                  {error && <p style={{ fontSize: "12px", color: "#FCA5A5", textAlign: "center", margin: 0 }}>{error}</p>}

                  <button onClick={handleVerifyOtp} disabled={loading || otp.replace(/\D/g, "").length < 6}
                    style={{
                      padding: "12px", borderRadius: "10px", border: "none",
                      background: "linear-gradient(135deg,#2563EB,#0EA5A0)",
                      color: "#fff", fontSize: "14px", fontWeight: 700,
                      cursor: (loading || otp.replace(/\D/g, "").length < 6) ? "not-allowed" : "pointer",
                      opacity: (loading || otp.replace(/\D/g, "").length < 6) ? 0.6 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}>
                    <Zap size={15} />
                    {loading ? "Verifying…" : "Verify & Sign In"}
                  </button>

                  <div style={{ textAlign: "center" }}>
                    {countdown > 0 ? (
                      <p style={{ fontSize: "12px", color: "#475569" }}>
                        Resend code in <strong style={{ color: "#94A3B8" }}>{countdown}s</strong>
                      </p>
                    ) : (
                      <button onClick={handleSendOtp} disabled={loading}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontSize: "12px", fontWeight: 600 }}>
                        Resend OTP
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PASSKEY option ── */}
          <div style={{ marginTop: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
              <span style={{ fontSize: "10px", color: "#334155", letterSpacing: "0.08em" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            </div>
            <button
              onClick={handlePasskey}
              disabled={loading}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: "9px", padding: "10px 16px", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s",
              }}
            >
              <Fingerprint size={16} style={{ color: "#60A5FA" }} />
              Sign in with Passkey
            </button>
          </div>

          {/* Switch login/signup */}
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "18px", textAlign: "center" }}>
            {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); resetErrors(); resetCaptcha(); resetFailedAttempts(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontWeight: 700, fontSize: "12px" }}
            >
              {authMode === "login" ? "Sign up free →" : "Sign in"}
            </button>
          </p>

          <p style={{ fontSize: "10px", color: "#334155", marginTop: "10px", textAlign: "center", lineHeight: 1.5 }}>
            By continuing, you agree to our{" "}
            <a href="/privacy" target="_blank" style={{ color: "#475569" }}>Privacy Policy</a>
            {" "}and{" "}
            <a href="/terms" target="_blank" style={{ color: "#475569" }}>Terms of Use</a>.
          </p>
        </div>

        {/* ── RIGHT PANEL: memoized slide showcase — doesn't re-render on keystrokes */}
        {!isMobile && (
          <RightPanel slideIdx={slideIdx} setSlideIdx={handleSlideIdx} />
        )}
      </div>
    </div>
  );
}
