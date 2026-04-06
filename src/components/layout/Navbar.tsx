"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown, ImageIcon, Video, Music, Wand2, Sparkles, Mic, Zap, Film, Layers, LayoutDashboard, User, CreditCard, LogOut, ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthContext";

// ── Theme Toggle Button ────────────────────────────────────────────────────
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: "36px", height: "36px" }} />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: "36px", height: "36px", borderRadius: "10px", border: "1px solid var(--border-subtle)",
        background: "var(--page-bg-2)", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--page-text-2)", transition: "all 0.2s", flexShrink: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--page-text)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-medium)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--page-text-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVBAR – Cinematic dark nav | Try Free → opens auth modal
// Once logged in: shows Credits pill + Dashboard + Avatar dropdown
// ─────────────────────────────────────────────────────────────────────────────

const navDropdowns = {
  Image: {
    color: "#2563EB",
    features: [
      { icon: ImageIcon, label: "Create Image",       desc: "Generate AI images",       badge: null,  href: "/studio?mode=image" },
      { icon: Sparkles,  label: "Enhance & Upscale",  desc: "4K resolution boost",      badge: null,  href: "#" },
      { icon: Layers,    label: "Face Swap",           desc: "Realistic face swaps",     badge: "NEW", href: "#" },
    ],
    models: [
      { label: "Nano Banana Pro", desc: "Best 4K image model"              },
      { label: "Flux",            desc: "Speed-optimised detail"           },
      { label: "Seedream",        desc: "Intelligent visual reasoning"     },
    ],
  },
  Video: {
    color: "#0EA5A0",
    features: [
      { icon: Film,  label: "Create Video", desc: "Generate AI videos",      badge: "HOT", href: "/studio?mode=video" },
      { icon: Wand2, label: "Edit Video",   desc: "Edit scenes & elements",  badge: null,  href: "#" },
      { icon: Mic,   label: "Lip Sync",     desc: "Sync voice to video",     badge: null,  href: "#" },
    ],
    models: [
      { label: "Kling 3.0",   desc: "Cinematic videos with audio"  },
      { label: "Runway ML",   desc: "Gen-3 Alpha Turbo"            },
      { label: "Google Veo",  desc: "Advanced AI video with sound" },
    ],
  },
  Audio: {
    color: "#A855F7",
    features: [
      { icon: Mic,   label: "AI Voiceover", desc: "Generate speech from text", badge: "NEW", href: "/studio?mode=audio" },
      { icon: Music, label: "AI Music",     desc: "Create full tracks",        badge: null,  href: "#" },
      { icon: Zap,   label: "Voice Clone",  desc: "Clone any voice",           badge: null,  href: "#" },
    ],
    models: [
      { label: "ElevenLabs", desc: "Expressive AI voice"    },
      { label: "Suno AI",    desc: "Full music generation"  },
      { label: "Kits AI",    desc: "Voice transformation"   },
    ],
  },
} as const;

type DropdownKey = keyof typeof navDropdowns;

const navLinks = [
  { label: "Explore",  href: "/",              hasDropdown: false },
  { label: "Image",    href: "/tools/image",   hasDropdown: true  },
  { label: "Video",    href: "/video",         hasDropdown: true  },
  { label: "Audio",    href: "/audio",         hasDropdown: true  },
  { label: "Gallery",  href: "/gallery",       hasDropdown: false },
  { label: "Pricing",  href: "/pricing",       hasDropdown: false },
];

// ── Dropdown ─────────────────────────────────────────────────────────────────
function DropdownMenu({ category, onClose }: { category: DropdownKey; onClose: () => void }) {
  const data = navDropdowns[category];
  return (
    <div className="absolute top-full left-0 z-50 mt-2 overflow-hidden rounded-2xl"
      style={{ width: "540px", background: "rgba(8,14,28,0.97)", border: `1px solid ${data.color}25`, backdropFilter: "blur(20px)", boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${data.color}15` }}>
      <div className="grid grid-cols-2 gap-0">
        <div className="border-r p-4" style={{ borderColor: `${data.color}15` }}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${data.color}80` }}>Features</p>
          <div className="flex flex-col gap-1">
            {data.features.map((feat) => {
              const Icon = feat.icon;
              return (
                <Link key={feat.label} href={feat.href} onClick={onClose}
                  className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                  style={{ color: "#F8FAFC" }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${data.color}10`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${data.color}15`, border: `1px solid ${data.color}25` }}>
                    <Icon size={14} style={{ color: data.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{feat.label}</span>
                      {feat.badge && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${data.color}20`, color: data.color }}>{feat.badge}</span>}
                    </div>
                    <span className="text-xs" style={{ color: "#64748B" }}>{feat.desc}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${data.color}80` }}>AI Models</p>
          <div className="flex flex-col gap-1">
            {data.models.map((model) => (
              <Link key={model.label} href="#" onClick={onClose}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                onMouseEnter={e => (e.currentTarget.style.background = `${data.color}10`)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: data.color, boxShadow: `0 0 6px ${data.color}` }} />
                <div>
                  <p className="text-sm font-medium text-white">{model.label}</p>
                  <p className="text-xs" style={{ color: "#64748B" }}>{model.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Avatar Dropdown ──────────────────────────────────────────────────────
function UserDropdown({ user, onLogout }: { user: { name: string; email: string; credits: number; plan: string }; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pct = Math.round((user.credits / 100) * 100);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "6px 10px 6px 6px", cursor: "pointer" }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px", color: "#fff", flexShrink: 0 }}>
          {user.name[0].toUpperCase()}
        </div>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#F8FAFC" }}>{user.name.split(" ")[0]}</span>
        <ChevronDown size={12} style={{ color: "#64748B", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "220px", background: "rgba(8,14,28,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "8px", zIndex: 100, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", backdropFilter: "blur(20px)" }}>
          {/* User info */}
          <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "6px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 2px", color: "#F8FAFC" }}>{user.name}</p>
            <p style={{ fontSize: "11px", color: "#64748B", margin: "0 0 10px" }}>{user.email}</p>
            {/* Credits bar */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "10px", color: "#64748B" }}>Credits</span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: pct > 20 ? "#60A5FA" : "#FCA5A5" }}>{user.credits} / 100</span>
            </div>
            <div style={{ height: "4px", borderRadius: "10px", background: "rgba(255,255,255,0.08)" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: "10px", background: pct > 20 ? "linear-gradient(90deg,#2563EB,#0EA5A0)" : "#EF4444", transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: "10px", color: "#64748B", marginTop: "4px" }}>{user.plan} plan</p>
          </div>

          {/* Menu items */}
          {[
            { icon: LayoutDashboard, label: "Dashboard",    href: "/dashboard"              },
            { icon: User,            label: "Profile",      href: "/dashboard/profile"      },
            { icon: CreditCard,      label: "Subscription", href: "/dashboard/subscription" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", color: "#94A3B8", fontSize: "13px", textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}>
                <Icon size={14} />
                {item.label}
                <ChevronRight size={12} style={{ marginLeft: "auto" }} />
              </Link>
            );
          })}

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
          <button onClick={() => { onLogout(); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", color: "#94A3B8", fontSize: "13px", width: "100%", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar() {
  const [scrolled, setScrolled]         = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [authModal, setAuthModal]       = useState<"login" | "signup" | null>(null);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function openDropdown(key: DropdownKey) {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setActiveDropdown(key);
  }
  function closeDropdownDelayed() {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 150);
  }

  return (
    <>
      <header className="fixed top-0 z-50 w-full transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "var(--page-bg)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border-subtle)" : "none",
          boxShadow: scrolled ? "0 4px 40px rgba(0,0,0,0.25)" : "none",
        }}>
        <div className="container-site">
          <nav className="flex h-16 items-center justify-between">

            {/* Logo */}
            <Logo size="md" />

            {/* Desktop nav */}
            <ul className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const isDropdown = link.hasDropdown;
                const dropKey = link.label as DropdownKey;
                const dropData = isDropdown ? navDropdowns[dropKey] : null;
                const isActive = activeDropdown === dropKey;
                return (
                  <li key={link.href} className="relative"
                    onMouseEnter={() => isDropdown && openDropdown(dropKey)}
                    onMouseLeave={() => isDropdown && closeDropdownDelayed()}>
                    <Link href={link.href}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                      style={{ color: isActive && dropData ? dropData.color : "#94A3B8", textShadow: isActive && dropData ? `0 0 16px ${dropData.color}90` : "none" }}>
                      {link.label}
                      {isDropdown && <ChevronDown size={13} className="transition-transform duration-200" style={{ transform: isActive ? "rotate(180deg)" : "none" }} />}
                    </Link>
                    {isDropdown && isActive && dropData && (
                      <div onMouseEnter={() => openDropdown(dropKey)} onMouseLeave={() => closeDropdownDelayed()}>
                        <DropdownMenu category={dropKey} onClose={() => setActiveDropdown(null)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Desktop actions */}
            <div className="hidden items-center gap-3 md:flex">
              <ThemeToggle />
              {user ? (
                <>
                  {/* Credits pill */}
                  <Link href="/dashboard/credits"
                    style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "20px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, color: "#60A5FA", textDecoration: "none" }}>
                    <Zap size={12} />
                    {user.credits} credits
                  </Link>
                  {/* Dashboard link */}
                  <Link href="/dashboard"
                    className="text-sm font-medium transition-all duration-200"
                    style={{ color: "#94A3B8" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
                    Dashboard
                  </Link>
                  {/* User avatar dropdown */}
                  <UserDropdown user={user} onLogout={logout} />
                </>
              ) : (
                <>
                  <button onClick={() => setAuthModal("login")}
                    className="text-sm font-medium transition-all duration-200"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
                    Login
                  </button>
                  <Link href="/studio"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all duration-300"
                    style={{ background: "linear-gradient(135deg,#2563EB 0%,#0EA5A0 100%)", boxShadow: "0 0 20px rgba(37,99,235,0.3)", border: "none", cursor: "pointer", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(37,99,235,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(37,99,235,0.3)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                    <Zap size={14} />
                    Start Creating
                  </Link>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F8FAFC" }}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </nav>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="border-t py-4 md:hidden" style={{ borderColor: "var(--border-subtle)", background: "var(--page-bg)" }}>
              <ul className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium"
                      style={{ color: "#94A3B8" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 px-3 flex flex-col gap-2">
                <button onClick={() => { setMobileOpen(false); setAuthModal("login"); }}
                  className="block text-center py-2.5 rounded-xl text-sm font-medium"
                  style={{ color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)", background: "none", cursor: "pointer", width: "100%" }}>
                  Login
                </button>
                <Link href="/studio" onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#2563EB 0%,#0EA5A0 100%)", border: "none", cursor: "pointer", width: "100%", textDecoration: "none" }}>
                  <Zap size={14} />
                  Start Creating
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Auth modal */}
      {authModal && (
        <AuthModal
          defaultTab={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}
    </>
  );
}
