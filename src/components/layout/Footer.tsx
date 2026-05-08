"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ImageIcon, Video, Music } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Footer – Full tools grid + company links
// ─────────────────────────────────────────────────────────────────────────────

const imageTools = [
  { label: "ChatGPT Image Gen", href: "/image/chatgpt", badge: "NEW" },
  { label: "Nano Banana Pro", href: "/image/nano-banana-pro", badge: "HOT" },
  { label: "Nano Banana 2", href: "/image/nano-banana-2", badge: null },
  { label: "Flux", href: "/image/flux", badge: null },
  { label: "Seedream", href: "/image/seedream", badge: null },
];

const videoTools = [
  { label: "Kling 3.0",  href: "/studio/video?tool=kling-30",      badge: "HOT"  },
  { label: "Google Veo", href: "/studio/video?tool=veo-32",         badge: "NEW"  },
  { label: "Runway ML",  href: "/studio/video?tool=runway-gen45",   badge: null   },
  { label: "Seedance",   href: "/studio/video?tool=seedance-20",    badge: null   },
  { label: "LTX-2",      href: "/studio/video?tool=ltx-2",          badge: null   },
  { label: "HeyGen",     href: "/studio/video?tool=heygen",         badge: null   },
  { label: "Luma AI",    href: "/studio/video?tool=luma",           badge: "SOON" },
];

const audioTools = [
  { label: "ElevenLabs", href: "/audio/elevenlabs", badge: null },
  { label: "Kits AI", href: "/audio/kits", badge: null },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Pricing", href: "/waitlist" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", short: "IG" },
  { label: "YouTube", href: "https://youtube.com", short: "YT" },
  { label: "TikTok", href: "https://tiktok.com", short: "TK" },
];

function ToolBadge({ badge }: { badge: string | null }) {
  if (!badge) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    HOT: { bg: "rgba(239,68,68,0.15)", text: "#F87171" },
    NEW: { bg: "rgba(14,165,160,0.15)", text: "#0EA5A0" },
    SOON: { bg: "rgba(100,116,139,0.15)", text: "#94A3B8" },
  };
  const c = colors[badge] ?? colors.SOON;
  return (
    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
      style={{ background: c.bg, color: c.text }}>
      {badge}
    </span>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#060C1A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

      {/* Top glow line */}
      <div className="h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.5) 30%, rgba(14,165,160,0.5) 70%, transparent 100%)" }} />

      <div className="container-site py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-6">

          {/* ── Brand Column ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Logo size="md" className="mb-4" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={{ color: "#475569" }}>
              Zencra Labs is an AI-powered creative platform. Generate cinematic videos,
              stunning images, and professional audio — all in one workspace.
            </p>

            <div className="mt-6 flex gap-2">
              {socialLinks.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.4)";
                    (e.currentTarget as HTMLElement).style.color = "#2563EB";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(37,99,235,0.2)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.color = "#475569";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}>
                  {s.short}
                </a>
              ))}
            </div>
          </div>

          {/* ── Image Tools ──────────────────────────────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <ImageIcon size={12} style={{ color: "#2563EB" }} />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#2563EB" }}>
                Image
              </h3>
            </div>
            <ul className="space-y-2.5">
              {imageTools.map(tool => (
                <li key={tool.href}>
                  <Link href={tool.href}
                    className="inline-flex items-center text-sm transition-colors duration-200"
                    style={{ color: "#475569" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                    {tool.label}
                    <ToolBadge badge={tool.badge} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Video Tools ──────────────────────────────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Video size={12} style={{ color: "#0EA5A0" }} />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#0EA5A0" }}>
                Video
              </h3>
            </div>
            <ul className="space-y-2.5">
              {videoTools.map(tool => (
                <li key={tool.href}>
                  <Link href={tool.href}
                    className="inline-flex items-center text-sm transition-colors duration-200"
                    style={{ color: "#475569" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                    {tool.label}
                    <ToolBadge badge={tool.badge} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Audio Tools ──────────────────────────────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Music size={12} style={{ color: "#A855F7" }} />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#A855F7" }}>
                Audio
              </h3>
            </div>
            <ul className="space-y-2.5">
              {audioTools.map(tool => (
                <li key={tool.href}>
                  <Link href={tool.href}
                    className="inline-flex items-center text-sm transition-colors duration-200"
                    style={{ color: "#475569" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                    {tool.label}
                    <ToolBadge badge={tool.badge} />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Company links below audio column */}
            <div className="mt-8">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#64748B" }}>
                Company
              </h3>
              <ul className="space-y-2.5">
                {companyLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-sm transition-colors duration-200"
                      style={{ color: "#475569" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Legal Column ─────────────────────────────────────────────────── */}
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#334155" }}>
              Legal
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: "#334155" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#64748B")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#334155")}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="container-site flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs" style={{ color: "#334155" }}>
            © {year} Zencra Labs. All rights reserved.
          </p>
          <p className="text-xs font-medium"
            style={{ background: "linear-gradient(90deg, #2563EB, #0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Intelligence by Design
          </p>
        </div>
      </div>
    </footer>
  );
}
