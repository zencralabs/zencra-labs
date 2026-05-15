"use client";

/**
 * Zencra Labs — Login Page (Cinematic Final v2)
 *
 * Layout  : Fullscreen 2-column. Left 42% auth panel / Right 58% cinematic slider.
 *           Navbar and Footer suppressed via NAVBAR_HIDDEN_ROUTES + WORKSPACE_PREFIXES.
 *
 * Auth    : All buttons are UI-only stubs (onSubmit preventDefault).
 *           No Supabase calls — auth integration in a future pass.
 *
 * Motion  : Pure CSS keyframes + useEffect for auto-slide. No framer-motion.
 *
 * DO NOT add auth logic here without coordinating with the AuthContext layer.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye, EyeOff, ArrowRight, X, ChevronLeft,
  Mail, Key, Fingerprint, ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/components/auth/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AuthView = "default" | "email" | "otp" | "passkey";

// ─────────────────────────────────────────────────────────────────────────────
// Right-panel cinematic image slides
// ─────────────────────────────────────────────────────────────────────────────

interface Slide {
  id:      string;
  name:    string;
  desc:    string;
  /**
   * Absolute public path served from /public.
   * Use /showcase/login/<file>.webp — NEVER /public/... or ./...
   * Leave undefined if the file doesn't exist yet (gradient bg used as fallback).
   */
  img?:    string;
  bg:      string;
  /**
   * Per-slide darkening overlay. Drives bottom readability + mood tone.
   * Format: linear-gradient top-to-bottom so bottom = dark.
   */
  overlay: string;
  accent:  string;
}

const SLIDES: Slide[] = [
  {
    id:      "gpt-image-2",
    name:    "GPT Image 2",
    desc:    "State-of-the-art image generation with unmatched realism and detail.",
    img:     "/showcase/login/gpt-image-2.webp",
    bg: [
      "radial-gradient(ellipse 95% 80% at 72% 38%, rgba(14,165,224,0.72) 0%, transparent 52%)",
      "radial-gradient(ellipse 70% 90% at 88% 12%, rgba(29,78,216,0.65) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 120% at 50% 50%, #010918 28%, #000710 100%)",
    ].join(", "),
    overlay: "linear-gradient(180deg, rgba(1,9,24,0.22) 0%, rgba(1,9,24,0.08) 35%, rgba(1,9,24,0.55) 60%, rgba(1,9,24,0.96) 100%)",
    accent:  "linear-gradient(90deg, #60A5FA, #38BDF8)",
  },
  {
    id:      "nano-banana-2",
    name:    "Nano Banana 2",
    desc:    "Ultra-fast multi-reference image generation at cinematic quality.",
    img:     "/showcase/login/nano-banana-2.webp",
    bg: [
      "radial-gradient(ellipse 90% 75% at 42% 48%, rgba(13,148,136,0.75) 0%, transparent 52%)",
      "radial-gradient(ellipse 65% 85% at 78% 18%, rgba(6,95,70,0.62) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 120% at 50% 50%, #011210 28%, #000D0C 100%)",
    ].join(", "),
    overlay: "linear-gradient(180deg, rgba(1,18,16,0.22) 0%, rgba(1,18,16,0.08) 35%, rgba(1,18,16,0.55) 60%, rgba(1,18,16,0.96) 100%)",
    accent:  "linear-gradient(90deg, #34D399, #2DD4BF)",
  },
  {
    id:      "seedream-v5",
    name:    "Seedream v5",
    desc:    "ByteDance's premium photorealistic text-to-image model.",
    img:     "/showcase/login/seedream-v5.webp",
    bg: [
      "radial-gradient(ellipse 90% 70% at 55% 40%, rgba(124,58,237,0.72) 0%, transparent 52%)",
      "radial-gradient(ellipse 60% 80% at 22% 68%, rgba(76,29,149,0.62) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 120% at 50% 50%, #0B0320 28%, #060115 100%)",
    ].join(", "),
    overlay: "linear-gradient(180deg, rgba(11,3,32,0.22) 0%, rgba(11,3,32,0.08) 35%, rgba(11,3,32,0.55) 60%, rgba(11,3,32,0.96) 100%)",
    accent:  "linear-gradient(90deg, #A78BFA, #C084FC)",
  },
  {
    id:      "flux-2",
    name:    "FLUX.2",
    desc:    "Black Forest Labs' flagship creative generation model.",
    img:     "/showcase/login/flux-2.webp",
    bg: [
      "radial-gradient(ellipse 85% 75% at 63% 40%, rgba(217,119,6,0.68) 0%, transparent 52%)",
      "radial-gradient(ellipse 62% 82% at 28% 62%, rgba(180,83,9,0.58) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 120% at 50% 50%, #160A00 28%, #0C0500 100%)",
    ].join(", "),
    overlay: "linear-gradient(180deg, rgba(22,10,0,0.22) 0%, rgba(22,10,0,0.08) 35%, rgba(22,10,0,0.55) 60%, rgba(22,10,0,0.96) 100%)",
    accent:  "linear-gradient(90deg, #FCD34D, #F97316)",
  },
  {
    id:      "grok-imagine",
    name:    "Grok Imagine",
    desc:    "xAI's breakthrough image synthesis engine for the imagination.",
    img:     "/showcase/login/grok-imagine.webp",
    bg: [
      "radial-gradient(ellipse 90% 75% at 52% 46%, rgba(8,145,178,0.72) 0%, transparent 52%)",
      "radial-gradient(ellipse 62% 80% at 84% 26%, rgba(3,105,161,0.62) 0%, transparent 48%)",
      "radial-gradient(ellipse 120% 120% at 50% 50%, #010D1A 28%, #000810 100%)",
    ].join(", "),
    overlay: "linear-gradient(180deg, rgba(1,13,26,0.22) 0%, rgba(1,13,26,0.08) 35%, rgba(1,13,26,0.55) 60%, rgba(1,13,26,0.96) 100%)",
    accent:  "linear-gradient(90deg, #22D3EE, #67E8F9)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Video model strip data
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_MODELS = [
  { name: "Kling 3.0",          color: "#818CF8" },
  { name: "Seedance 2",         color: "#60A5FA" },
  { name: "Runway Gen 4.5",     color: "#A78BFA" },
  { name: "Minimax Hailuo 2.3", color: "#34D399" },
  { name: "Sora 2",             color: "#38BDF8" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Social auth provider icons
// ─────────────────────────────────────────────────────────────────────────────

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
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
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

// ─────────────────────────────────────────────────────────────────────────────
// Video model logo file map
// Files live at /public/brand/logos/providers/
// See /public/brand/logos/README.md for replacement instructions.
// Current files are neutral placeholder SVGs — replace with official assets before launch.
//
// TODO: replace placeholder SVGs with official brand logos from each provider.
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_MODEL_LOGO_FILES: Record<string, string> = {
  "Kling 3.0":          "/brand/logos/providers/kling.svg",
  "Seedance 2":         "/brand/logos/providers/seedance.svg",
  "Runway Gen 4.5":     "/brand/logos/providers/runway.svg",
  "Minimax Hailuo 2.3": "/brand/logos/providers/minimax-hailuo.svg",
  "Sora 2":             "/brand/logos/providers/sora.svg",
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS keyframes + component-scoped global classes
// ─────────────────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes zlLeft  { from{opacity:0;transform:translateX(-22px)} to{opacity:1;transform:translateX(0)} }
@keyframes zlUp    { from{opacity:0;transform:translateY(14px)}  to{opacity:1;transform:translateY(0)} }
@keyframes zlFade  { from{opacity:0}                              to{opacity:1} }
@keyframes zlOrb   { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:.92;transform:scale(1.06)} }
@keyframes zlBeam  { 0%,100%{opacity:.06} 50%{opacity:.16} }
@keyframes zlPing  { 0%{transform:scale(1);opacity:.65} 100%{transform:scale(2.4);opacity:0} }
@keyframes zlPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

.zl-left { animation:zlLeft 0.5s cubic-bezier(.22,.68,0,1.2) both }
.zl-up   { animation:zlUp   0.4s cubic-bezier(.22,.68,0,1.2) both }
.zl-fade { animation:zlFade 0.4s ease both }

/* Social auth button */
.zl-btn {
  display:flex; align-items:center; gap:10px;
  width:100%; padding:12px 16px; border-radius:13px;
  font-size:13.5px; font-weight:600; color:#D1D5DB;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  cursor:pointer; letter-spacing:-.01em;
  transition:background .18s,border-color .18s,box-shadow .18s,transform .14s,color .14s;
}
.zl-btn:hover {
  background:rgba(37,99,235,0.1);
  border-color:rgba(59,130,246,0.32);
  box-shadow:0 0 20px rgba(37,99,235,0.14),inset 0 1px 0 rgba(255,255,255,0.06);
  transform:translateY(-1px); color:#fff;
}
.zl-btn:active { transform:translateY(0) }

/* Email primary CTA */
.zl-cta {
  display:flex; align-items:center; gap:10px;
  width:100%; padding:14px 18px; border-radius:13px;
  font-size:14px; font-weight:700; color:#ffffff; letter-spacing:-.015em;
  background:linear-gradient(135deg,#1E3A8A 0%,#2563EB 45%,#0369A1 100%);
  border:1px solid rgba(59,130,246,0.5);
  box-shadow:0 0 32px rgba(37,99,235,0.32),inset 0 1px 0 rgba(255,255,255,0.12);
  cursor:pointer;
  transition:box-shadow .22s,transform .18s,filter .18s;
}
.zl-cta:hover {
  box-shadow:0 0 60px rgba(37,99,235,0.55),0 0 110px rgba(14,165,160,0.14),inset 0 1px 0 rgba(255,255,255,0.15);
  transform:translateY(-1px); filter:brightness(1.08);
}
.zl-cta:active { transform:translateY(0) }

/* Form input */
.zl-input {
  width:100%; padding:12px 15px; border-radius:11px;
  font-size:14px; color:#F1F5F9; letter-spacing:-.01em;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.09);
  outline:none;
  transition:border-color .15s,box-shadow .15s,background .15s;
}
.zl-input::placeholder { color:rgba(203,213,225,0.50) }
.zl-input:focus {
  border-color:rgba(37,99,235,0.55);
  box-shadow:0 0 0 3px rgba(37,99,235,0.12),0 0 24px rgba(37,99,235,0.08);
  background:rgba(37,99,235,0.045);
}
.zl-input:focus::placeholder { color:rgba(226,232,240,0.72) }

/* Slide arrow button */
.zl-arrow {
  display:flex; align-items:center; justify-content:center;
  width:34px; height:34px; border-radius:50%;
  background:rgba(255,255,255,0.09);
  border:1px solid rgba(255,255,255,0.13);
  cursor:pointer; color:#CBD5E1;
  transition:background .18s,border-color .18s,box-shadow .18s,color .18s,transform .14s;
  flex-shrink:0;
}
.zl-arrow:hover {
  background:rgba(37,99,235,0.2);
  border-color:rgba(59,130,246,0.42);
  box-shadow:0 0 20px rgba(37,99,235,0.32);
  color:#fff; transform:scale(1.09);
}
.zl-arrow:active { transform:scale(1) }

/* Gradient separator */
.zl-sep { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent) }

/* Video model chip hover */
.zl-model-chip {
  display:flex; align-items:center; gap:8px;
  padding:7px 12px; border-radius:8px; cursor:default;
  transition:background .18s;
}
.zl-model-chip:hover { background:rgba(255,255,255,0.05) }

/* ─── RESPONSIVE LAYOUT ──────────────────────────────────────────── */
/* Desktop base (class-driven so media queries can override) */
.zl-wrap       { height:100vh; overflow:hidden; }
.zl-auth-panel {
  width:42%; height:100%; flex-shrink:0;
  border-right:1px solid rgba(255,255,255,0.045);
  overflow-y:auto;
}
.zl-cinema         { display:block; height:100%; }
.zl-desktop-close  { display:flex; }
.zl-mobile-close   { display:none !important; }
.zl-hero-title     { font-size:clamp(1.75rem,2.6vw,2.25rem); }

/* Mobile / tablet — below 1024px (Tailwind lg breakpoint) */
@media (max-width:1023px) {

  /* Outer wrapper: stack vertically, scrollable */
  .zl-wrap {
    flex-direction:column;
    height:auto;
    min-height:100dvh;
    overflow-x:hidden;
    overflow-y:auto;
    position:relative;
  }

  /* Right panel: lift out of flow → full-viewport cinematic background */
  .zl-cinema {
    position:absolute;
    inset:0;
    z-index:0;
    width:100%;
    flex:none;
  }

  /* Left auth panel: lighter glass so cinematic images breathe through */
  /* Refinement 3: opacity 0.82→0.70, blur 28→16px for image visibility */
  .zl-auth-panel {
    position:relative;
    z-index:2;
    width:100%;
    min-height:100dvh;
    height:auto;
    border-right:none;
    background:rgba(4,12,24,0.70);
    -webkit-backdrop-filter:blur(16px);
    backdrop-filter:blur(16px);
    padding-bottom:env(safe-area-inset-bottom,0px);
  }

  /* Refinement 1: push auth content up — top-align instead of dead-center */
  .zl-auth-content {
    align-items:flex-start !important;
    padding-top:28px !important;
    padding-bottom:44px !important;
  }

  /* Refinement 2: title line-height slightly more open on mobile */
  .zl-hero-title {
    line-height:1.06 !important;
  }

  /* Tap targets: minimum 48px per mobile guidelines */
  .zl-btn { min-height:48px; }
  .zl-cta {
    min-height:48px;
    /* Refinement 4: cinematic CTA glow on mobile */
    box-shadow:0 0 32px rgba(37,99,235,0.32),0 10px 40px rgba(59,130,246,0.35),inset 0 1px 0 rgba(255,255,255,0.12);
  }

  /* No hover-lift movement on touch screens */
  .zl-btn:hover  { transform:none; }
  .zl-cta:hover  { transform:none; }
  .zl-arrow:hover { transform:none; }

  /* Close buttons: show mobile, hide desktop */
  .zl-desktop-close { display:none !important; }
  .zl-mobile-close  { display:flex !important; }

  /* Refinement 5: footer text readable on mobile cinematic bg */
  .zl-footer-hint { color:rgba(148,163,184,0.72) !important; }
}

/* Very small screens (< 360px) — relax nowrap to prevent edge overflow */
@media (max-width:360px) {
  .zl-hero-title { font-size:1.5rem !important; }
  .zl-hero-nowrap { white-space:normal !important; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, loginWithPasskey, loginWithOAuth, user, profileReady } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Auth view state
  const [view,            setView]            = useState<AuthView>("default");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [otpCode,         setOtpCode]         = useState("");
  const [otpSent,         setOtpSent]         = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [authError,       setAuthError]       = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState(false);

  // Slider state
  const [slide,         setSlide]         = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const go = useCallback((dir: 1 | -1) => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setSlide(s => (s + dir + SLIDES.length) % SLIDES.length);
      setTransitioning(false);
    }, 420);
  }, [transitioning]);

  useEffect(() => {
    const t = setInterval(() => go(1), 6500);
    return () => clearInterval(t);
  }, [go]);

  const resetToDefault = () => { setView("default"); setOtpSent(false); setOtpCode(""); setAuthError(null); };

  // Role-aware redirect — waits for profileReady before routing.
  // login() resolves before loadProfile() completes, so user.role is still
  // provisional at the moment the success handler fires. We set pendingRedirect=true
  // there and let this effect do the actual navigation once the real role is known.
  useEffect(() => {
    if (!pendingRedirect || !profileReady || !user) return;
    const next = searchParams?.get("next");
    if (next && next.startsWith("/")) {
      router.push(next);
    } else if (user.role === "admin") {
      router.push("/hub");
    } else {
      router.push("/dashboard");
    }
    setPendingRedirect(false);
  }, [pendingRedirect, profileReady, user, searchParams, router]);

  // ── Email / Password submit ─────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);
    try {
      const ok = await login(email, password);
      if (ok) {
        setPendingRedirect(true);
      } else {
        setAuthError("Invalid email or password. Please try again.");
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Passkey sign-in ─────────────────────────────────────────────────────────
  async function handlePasskeySignIn() {
    setAuthError(null);
    setIsLoading(true);
    try {
      const ok = await loginWithPasskey();
      if (ok) {
        setPendingRedirect(true);
      } else {
        setAuthError("Passkey authentication failed. Try a different method.");
      }
    } catch {
      setAuthError("Passkey not available on this device.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setAuthError(null);
    await loginWithOAuth("google");
    // Browser redirects — no further action
  }

  const lbl = (_?: string): React.CSSProperties => ({
    display: "block", marginBottom: 6,
    fontSize: 10.5, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: "rgba(191,219,254,0.92)",
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div
        className="zl-wrap flex"
        style={{ backgroundColor: "#040C18", color: "#F8FAFC" }}
      >

        {/* ══════════════════════════════════════════════════════════════════
            LEFT PANEL  42%
           ══════════════════════════════════════════════════════════════════ */}
        <div
          className="zl-left zl-auth-panel relative z-10 flex flex-col"
        >
          {/* Subtle left ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{ background: "radial-gradient(ellipse 80% 60% at 20% 55%, rgba(29,78,216,0.07) 0%, transparent 60%)" }}
          />

          {/* Top bar */}
          <div className="relative flex items-center justify-between px-8 pt-7">
            <Logo size="sm" asLink={false} />

            {/* Mobile-only close button — mirrors the desktop close button in the right panel */}
            <Link
              href="/"
              aria-label="Return to home"
              className="zl-mobile-close zl-fade"
              style={{
                alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(8,15,28,0.72)",
                backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)",
                transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                animationDelay: "0.3s",
                flexShrink: 0,
              }}
            >
              <X size={15} style={{ color: "#E2E8F0", strokeWidth: 2.5 }} />
            </Link>
          </div>

          {/* Auth block — vertically centered on desktop, top-aligned on mobile */}
          <div className="zl-auth-content relative flex flex-1 items-center justify-center px-8 pb-4 pt-2">
            <div style={{ width: "100%", maxWidth: 400 }}>

              {/* ── HEADING ── */}
              <div className="zl-up" style={{ marginBottom: 28, animationDelay: "0.07s" }}>
                {view === "default" ? (
                  <>
                    {/* Eyebrow pill */}
                    <div
                      className="zl-fade"
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
                      Welcome back to Zencra
                    </div>

                    {/*
                      Hero heading — exactly 2 lines:
                        Line 1: "Sign in to your"    (nowrap — never wraps to 2)
                        Line 2: "Zencra account"     (nowrap — always stays together)
                    */}
                    <h1
                      className="zl-hero-title"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800, lineHeight: 1.1,
                        letterSpacing: "-0.045em",
                        color: "#fff", marginBottom: "0.5rem",
                        textShadow: "0 2px 18px rgba(15,23,42,0.45)",
                      }}
                    >
                      <span className="zl-hero-nowrap" style={{ display: "block", whiteSpace: "nowrap" }}>
                        Sign in to your
                      </span>
                      <span className="zl-hero-nowrap" style={{ display: "block", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            background: "linear-gradient(90deg, #60A5FA 0%, #34D399 50%, #22D3EE 100%)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                          }}
                        >
                          Zencra
                        </span>
                        {" "}
                        <span style={{ color: "#fff" }}>account</span>
                      </span>
                    </h1>

                    <p style={{ fontSize: 14, color: "rgba(226,232,240,0.92)", letterSpacing: "-0.01em", textShadow: "0 1px 10px rgba(15,23,42,0.45)" }}>
                      Access the future of AI content creation.
                    </p>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <button
                      onClick={resetToDefault}
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
                      <h1
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.65rem", fontWeight: 800,
                          letterSpacing: "-0.04em", color: "#fff", lineHeight: 1.15,
                        }}
                      >
                        {view === "email"   && "Sign in with email"}
                        {view === "otp"     && "Mobile OTP sign-in"}
                        {view === "passkey" && "Passkey sign-in"}
                      </h1>
                      <p style={{ marginTop: 4, fontSize: 13, color: "rgba(226,232,240,0.92)", textShadow: "0 1px 10px rgba(15,23,42,0.45)" }}>
                        {view === "email"           && "Enter your credentials below"}
                        {view === "otp" && !otpSent && "We'll send a one-time code to your phone"}
                        {view === "otp" && otpSent  && `Code sent to ${email || "your number"}`}
                        {view === "passkey"         && "Use your device authenticator"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── DEFAULT AUTH BUTTONS ── */}
              {view === "default" && (
                <div className="flex flex-col" style={{ gap: 7 }}>

                  {/* Email — primary CTA */}
                  <button
                    className="zl-cta zl-up"
                    style={{ animationDelay: "0.12s" }}
                    onClick={() => setView("email")}
                  >
                    <Mail size={15} style={{ color: "#93C5FD", flexShrink: 0 }} />
                    Continue with Email
                    <ArrowRight size={14} style={{ marginLeft: "auto", color: "#93C5FD", opacity: 0.65 }} />
                  </button>

                  {/* Social — 2×2 grid */}
                  <div
                    className="zl-up"
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, animationDelay: "0.18s" }}
                  >
                    <button className="zl-btn" onClick={handleGoogleSignIn}><GoogleIcon    /><span>Google</span></button>
                    <button className="zl-btn"><AppleIcon     /><span>Apple</span></button>
                    <button className="zl-btn"><FacebookIcon  /><span>Facebook</span></button>
                    <button className="zl-btn"><MicrosoftIcon /><span>Microsoft</span></button>
                  </div>

                  {/* Divider */}
                  <div
                    className="zl-fade"
                    style={{ display: "flex", alignItems: "center", gap: 9, margin: "3px 0", animationDelay: "0.28s" }}
                  >
                    <div className="zl-sep" />
                    <span style={{ fontSize: 10.5, color: "rgba(100,116,139,0.82)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      or continue with
                    </span>
                    <div className="zl-sep" />
                  </div>

                  {/* OTP + Passkey row */}
                  <div
                    className="zl-up"
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, animationDelay: "0.32s" }}
                  >
                    <button
                      className="zl-btn"
                      style={{ justifyContent: "center" }}
                      onClick={() => setView("otp")}
                    >
                      <Key size={13} style={{ color: "#475569" }} />
                      <span style={{ fontSize: 13 }}>Mobile OTP</span>
                    </button>
                    <button
                      className="zl-btn"
                      style={{ justifyContent: "center" }}
                      onClick={() => setView("passkey")}
                    >
                      <Fingerprint size={13} style={{ color: "#475569" }} />
                      <span style={{ fontSize: 13 }}>Passkey</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── EMAIL FORM ── */}
              {view === "email" && (
                <form
                  className="zl-up flex flex-col"
                  style={{ gap: 13, animationDelay: "0.04s" }}
                  onSubmit={handleEmailSubmit}
                >
                  <div>
                    <label style={lbl("email")}>Email address</label>
                    <input
                      type="email" placeholder="you@example.com" required autoFocus
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="zl-input"
                    />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ ...lbl("pw"), marginBottom: 0 }}>Password</label>
                      <a
                        href="#"
                        style={{ fontSize: 12, color: "#3B82F6", transition: "color .14s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#93C5FD"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#3B82F6"; }}
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"} placeholder="••••••••" required
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="zl-input" style={{ paddingRight: 42 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#334155", background: "none", border: "none", cursor: "pointer", transition: "color .14s" }}
                        aria-label={showPassword ? "Hide" : "Show"}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  {authError && (
                    <p style={{ fontSize: 13, color: "#F87171", textAlign: "center", letterSpacing: "-0.01em" }}>
                      {authError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="zl-cta"
                    style={{ marginTop: 2, opacity: isLoading ? 0.7 : 1 }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in…" : "Sign In"}
                    {!isLoading && <ArrowRight size={14} style={{ marginLeft: "auto" }} />}
                  </button>
                </form>
              )}

              {/* ── OTP FORM ── */}
              {view === "otp" && (
                <form
                  className="zl-up flex flex-col"
                  style={{ gap: 13, animationDelay: "0.04s" }}
                  onSubmit={e => { e.preventDefault(); if (!otpSent) setOtpSent(true); }}
                >
                  {!otpSent ? (
                    <>
                      <div>
                        <label style={lbl("otp-phone")}>Mobile number</label>
                        <input
                          type="tel" placeholder="+91 98765 43210" required autoFocus
                          value={email} onChange={e => setEmail(e.target.value)}
                          className="zl-input"
                        />
                      </div>
                      <button type="submit" className="zl-cta">
                        Send OTP <ArrowRight size={14} style={{ marginLeft: "auto" }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={lbl("code")}>OTP code</label>
                        <input
                          type="text" inputMode="numeric" placeholder="000000" maxLength={6} autoFocus
                          value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="zl-input"
                          style={{ textAlign: "center", fontSize: "1.35rem", fontFamily: "monospace", letterSpacing: "0.55em", paddingRight: 0 }}
                        />
                        <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "rgba(148,163,184,0.82)" }}>
                          Didn&apos;t receive it?{" "}
                          <button
                            type="button"
                            style={{ color: "#3B82F6", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}
                            onClick={() => setOtpSent(false)}
                          >
                            Resend
                          </button>
                        </p>
                      </div>
                      <button type="submit" className="zl-cta">
                        Verify OTP <ArrowRight size={14} style={{ marginLeft: "auto" }} />
                      </button>
                    </>
                  )}
                </form>
              )}

              {/* ── PASSKEY ── */}
              {view === "passkey" && (
                <div
                  className="zl-up flex flex-col items-center py-7"
                  style={{ gap: 18, textAlign: "center", borderRadius: 18, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.06)", animationDelay: "0.04s" }}
                >
                  <div style={{ position: "relative", width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,0.4),transparent)", animation: "zlPing 2.3s cubic-bezier(0,0,0.2,1) infinite" }} />
                    <div style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.28)", boxShadow: "0 0 28px rgba(37,99,235,0.18)" }}>
                      <Fingerprint size={24} style={{ color: "#93C5FD" }} />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 14.5, fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.02em" }}>Ready to authenticate</p>
                    <p style={{ marginTop: 3, fontSize: 12.5, color: "rgba(203,213,225,0.85)" }}>Use your device biometrics or security key</p>
                  </div>
                  <button
                    className="zl-cta"
                    style={{ width: "auto", padding: "11px 26px", opacity: isLoading ? 0.7 : 1 }}
                    disabled={isLoading}
                    onClick={handlePasskeySignIn}
                  >
                    {isLoading ? "Authenticating…" : "Authenticate"}
                  </button>
                  {authError && (
                    <p style={{ fontSize: 13, color: "#F87171", textAlign: "center" }}>{authError}</p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div
                className="zl-fade"
                style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 7, animationDelay: "0.6s" }}
              >
                <p style={{ textAlign: "center", fontSize: 13, color: "rgba(203,213,225,0.82)" }}>
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    style={{ color: "#3B82F6", fontWeight: 600, transition: "color .15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#93C5FD"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#3B82F6"; }}
                  >
                    Create one →
                  </Link>
                </p>
                <p className="zl-footer-hint" style={{ textAlign: "center", fontSize: 11, color: "rgba(148,163,184,0.72)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(148,163,184,0.72)" }} aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Your data is protected with enterprise-grade security.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT PANEL  58% — Cinematic fullscreen auto-sliding showcase
            All content is absolutely positioned over the fullscreen bg layers.
           ══════════════════════════════════════════════════════════════════ */}
        <div
          className="zl-cinema relative overflow-hidden"
          style={{ flex: 1 }}
        >

          {/* ── Cinematic close button — top-right corner of right panel (desktop only) ── */}
          <Link
            href="/"
            aria-label="Return to home"
            className="zl-fade zl-desktop-close"
            style={{
              position: "absolute", top: 22, right: 24, zIndex: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 46, height: 46, borderRadius: "50%",
              background: "rgba(4,12,24,0.55)",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.45)",
              transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.18s",
              animationDelay: "0.3s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = "rgba(37,99,235,0.22)";
              el.style.borderColor = "rgba(96,165,250,0.35)";
              el.style.boxShadow = "0 0 0 1px rgba(96,165,250,0.12), 0 0 28px rgba(37,99,235,0.35), 0 4px 24px rgba(0,0,0,0.45)";
              el.style.transform = "scale(1.06)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = "rgba(4,12,24,0.55)";
              el.style.borderColor = "rgba(255,255,255,0.12)";
              el.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.45)";
              el.style.transform = "scale(1)";
            }}
          >
            <X size={16} style={{ color: "#E2E8F0", strokeWidth: 2.5 }} />
          </Link>

          {/* ── Slide backgrounds — absolute inset-0, all rendered, only active visible ── */}
          {/* If slide.img exists the <img> is the primary visual; bg gradient is the fallback. */}
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background: s.bg,
                opacity: i === slide ? 1 : 0,
                transition: "opacity 0.65s ease",
              }}
            >
              {s.img && (
                <img
                  src={s.img}
                  alt=""
                  aria-hidden="true"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
            </div>
          ))}

          {/* ── Per-slide directional overlay for bottom readability + mood ── */}
          {SLIDES.map((s, i) => (
            <div
              key={`ov-${s.id}`}
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background: s.overlay,
                opacity: i === slide ? 1 : 0,
                transition: "opacity 0.65s ease",
              }}
            />
          ))}

          {/* ── Cinematic bottom vignette — main readability layer ── */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0"
            aria-hidden="true"
            style={{
              height: "65%",
              background: "linear-gradient(to top, rgba(4,12,24,1.0) 0%, rgba(4,12,24,0.94) 14%, rgba(4,12,24,0.75) 32%, rgba(4,12,24,0.38) 54%, rgba(4,12,24,0.10) 75%, transparent 100%)",
              zIndex: 5,
            }}
          />

          {/* ── Left vignette ── */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0"
            aria-hidden="true"
            style={{ width: "22%", background: "linear-gradient(to right, rgba(4,12,24,0.62) 0%, rgba(4,12,24,0.22) 60%, transparent 100%)", zIndex: 5 }}
          />

          {/* ── Right vignette ── */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0"
            aria-hidden="true"
            style={{ width: "22%", background: "linear-gradient(to left, rgba(4,12,24,0.62) 0%, rgba(4,12,24,0.22) 60%, transparent 100%)", zIndex: 5 }}
          />

          {/* ── Top vignette — cinematic header fade ── */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0"
            aria-hidden="true"
            style={{ height: "28%", background: "linear-gradient(to bottom, rgba(4,12,24,0.70) 0%, rgba(4,12,24,0.25) 50%, transparent 100%)", zIndex: 5 }}
          />

          {/* ── Atmospheric light beam ── */}
          <div
            className="pointer-events-none absolute"
            aria-hidden="true"
            style={{
              top: "-15%", left: "48%",
              width: 1.5, height: "145%",
              background: "linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.18) 30%, rgba(37,99,235,0.14) 60%, transparent 100%)",
              transform: "rotate(-14deg)",
              animation: "zlBeam 5s ease-in-out infinite",
              filter: "blur(8px)",
              zIndex: 6,
            }}
          />

          {/* ── Noise grain ── */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.032]"
            aria-hidden="true"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              zIndex: 6,
            }}
          />

          {/* ══ TOP CONTENT OVERLAY — eyebrow + model name + description ══ */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{ zIndex: 10, padding: "42px 50px 0" }}
          >
            {/* Eyebrow */}
            <div
              className="zl-up"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 16, animationDelay: "0.2s" }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#60A5FA", boxShadow: "0 0 8px #60A5FA",
                display: "inline-block", flexShrink: 0,
                animation: "zlOrb 3s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#60A5FA" }}>
                AI Creation Platform
              </span>
            </div>

            {/* Model name + description — re-keyed on slide change for re-entrance animation */}
            <div key={`slide-${slide}`} className="zl-up" style={{ animationDelay: "0.05s" }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.3rem, 4vw, 3.4rem)",
                  fontWeight: 800, lineHeight: 1.05,
                  letterSpacing: "-0.05em",
                  marginBottom: "0.7rem",
                  textShadow: "0 2px 28px rgba(0,0,0,0.55)",
                }}
              >
                <span style={{ color: "#fff" }}>
                  {SLIDES[slide].name.split(" ").slice(0, -1).join(" ")}{" "}
                </span>
                <span
                  style={{
                    background: SLIDES[slide].accent,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}
                >
                  {SLIDES[slide].name.split(" ").at(-1)}
                </span>
              </h2>
              <p
                style={{
                  fontSize: 15.5, color: "rgba(226,232,240,0.90)",
                  letterSpacing: "-0.01em", lineHeight: 1.56,
                  maxWidth: 370,
                  textShadow: "0 1px 10px rgba(0,0,0,0.45)",
                }}
              >
                {SLIDES[slide].desc}
              </p>
            </div>
          </div>

          {/* ══ BOTTOM CONTENT OVERLAY — controls + video strip + metrics ══ */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{ zIndex: 10, padding: "0 50px 34px" }}
          >

            {/* ── Slider controls — bottom center: [←]  ● ● ● ● ●  [→] ── */}
            <div
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 26 }}
            >
              <button className="zl-arrow" onClick={() => go(-1)} aria-label="Previous slide">
                <ChevronLeft size={15} />
              </button>

              {/* Pill dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (!transitioning) {
                        setTransitioning(true);
                        setTimeout(() => { setSlide(i); setTransitioning(false); }, 420);
                      }
                    }}
                    aria-label={`Slide ${i + 1}`}
                    style={{
                      width: i === slide ? 22 : 6, height: 6,
                      borderRadius: 3, border: "none", cursor: "pointer",
                      background: i === slide ? "rgba(96,165,250,0.95)" : "rgba(255,255,255,0.25)",
                      boxShadow: i === slide ? "0 0 12px rgba(96,165,250,0.8)" : "none",
                      transition: "all 0.35s cubic-bezier(.22,.68,0,1.2)",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              <button className="zl-arrow" onClick={() => go(1)} aria-label="Next slide">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* ── Video model strip label ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#60A5FA", boxShadow: "0 0 6px #60A5FA",
                display: "inline-block", flexShrink: 0,
                animation: "zlPulse 3s ease-in-out infinite",
              }} />
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#64748B" }}>
                Video Models Available in Zencra
              </p>
            </div>

            {/* ── Video model chips — glass pill container ── */}
            <div
              style={{
                display: "flex", alignItems: "center",
                background: "rgba(4,12,24,0.58)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                backdropFilter: "blur(14px)",
                padding: "2px 4px",
                marginBottom: 20,
              }}
            >
              {VIDEO_MODELS.map((m, i) => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div
                    className="zl-model-chip"
                    style={{
                      flex: 1,
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 10px", borderRadius: 9,
                      justifyContent: "center",
                    }}
                  >
                    {/* TODO: Replace placeholder SVG with official logo — see /public/brand/logos/README.md */}
                    <img
                      src={VIDEO_MODEL_LOGO_FILES[m.name]}
                      alt=""
                      aria-hidden="true"
                      width={22}
                      height={22}
                      style={{ objectFit: "contain", flexShrink: 0, maxHeight: 22, maxWidth: 22 }}
                    />
                    <span style={{
                      fontSize: 11.5, fontWeight: 600,
                      color: "#CBD5E1",
                      whiteSpace: "nowrap", letterSpacing: "-0.01em",
                    }}>
                      {m.name}
                    </span>
                  </div>
                  {i < VIDEO_MODELS.length - 1 && (
                    <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>

            {/* ── Bottom metrics ── */}
            <div
              style={{
                display: "flex", gap: 32,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                alignItems: "center",
              }}
            >
              {/* 10+ AI Models */}
              <div>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.35rem", fontWeight: 800,
                  letterSpacing: "-0.04em", color: "#fff", lineHeight: 1,
                  textShadow: "0 0 22px rgba(96,165,250,0.45)",
                }}>
                  10+
                </p>
                <p style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                  AI Models
                </p>
              </div>

              {/* 4K Max Quality */}
              <div>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.35rem", fontWeight: 800,
                  letterSpacing: "-0.04em", color: "#fff", lineHeight: 1,
                  textShadow: "0 0 22px rgba(96,165,250,0.45)",
                }}>
                  4K
                </p>
                <p style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                  Max Quality
                </p>
              </div>

              {/* ∞ Creativity — cinematic centerpiece */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ lineHeight: 1, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "2rem", fontWeight: 900,
                    letterSpacing: "-0.06em", lineHeight: 1,
                    background: "linear-gradient(135deg, #60A5FA 0%, #34D399 45%, #22D3EE 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                    filter: "drop-shadow(0 0 14px rgba(96,165,250,0.55))",
                    display: "inline-block",
                    animation: "zlPulse 3.5s ease-in-out infinite",
                  }}>
                    ∞
                  </span>
                </div>
                <p style={{ fontSize: 10.5, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                  Creativity
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
