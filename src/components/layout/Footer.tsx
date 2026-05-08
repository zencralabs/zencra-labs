"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ImageIcon, Video, Music, Sparkles, Instagram, Youtube } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Footer – Cinematic premium redesign
// Namespace: .ftr-*
// ─────────────────────────────────────────────────────────────────────────────

// ── Inline SVGs for platforms not in Lucide ──────────────────────────────────
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

function DiscordIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.012.043.027.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const zencraTools = [
  { label: "Future Cinema Studio", href: "#", badge: null },
  { label: "Creative Director",    href: "#", badge: null },
  { label: "Motion Control",       href: "#", badge: null },
  { label: "LipSyncZ",             href: "#", badge: null },
  { label: "AI Influencer",        href: "#", badge: null },
  { label: "AvatarZ",              href: "#", badge: null },
  { label: "MirrorZ",              href: "#", badge: null },
];

const imageTools = [
  { label: "GPT Image 2",    href: "#", badge: null   },
  { label: "Nano Banana 2",  href: "#", badge: null   },
  { label: "Nano Banana Pro",href: "#", badge: null   },
  { label: "Seedream v5",    href: "#", badge: null   },
  { label: "FLUX.2",         href: "#", badge: null   },
  { label: "Grok Imagine",   href: "#", badge: "SOON" },
  { label: "Edit Image",     href: "#", badge: "SOON" },
];

const videoTools = [
  { label: "Kling 3.0",          href: "#", badge: null   },
  { label: "Seedance 2.0",       href: "#", badge: null   },
  { label: "Minimax Hailuo 2.3", href: "#", badge: null   },
  { label: "Veo 3.2",            href: "#", badge: "SOON" },
  { label: "Sora 2",             href: "#", badge: "SOON" },
  { label: "Wan 2.7",            href: "#", badge: "SOON" },
  { label: "Ray Flash 2",        href: "#", badge: "SOON" },
  { label: "Grok Video",         href: "#", badge: "SOON" },
  { label: "UGC Ads",            href: "#", badge: "SOON" },
  { label: "Edit Video",         href: "#", badge: "SOON" },
];

const audioTools = [
  { label: "ElevenLabs v3", href: "#", badge: null   },
  { label: "StudioZ",       href: "#", badge: "SOON" },
];

const companyLinks = [
  { label: "About",    href: "#" },
  { label: "Blog",     href: "#" },
  { label: "Contact",  href: "#" },
  { label: "Pricing",  href: "/waitlist" },
  { label: "Waitlist", href: "/waitlist" },
];

const legalLinks = [
  { label: "Privacy Policy",   href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy",    href: "#" },
];

// ── Social icons config ───────────────────────────────────────────────────────
const socialLinks = [
  {
    label: "Instagram",
    href: "#",
    hoverColor: "#E1306C",
    hoverGlow: "rgba(225,48,108,0.22)",
    icon: (s: number) => <Instagram size={s} />,
  },
  {
    label: "YouTube",
    href: "#",
    hoverColor: "#FF0000",
    hoverGlow: "rgba(255,0,0,0.18)",
    icon: (s: number) => <Youtube size={s} />,
  },
  {
    label: "TikTok",
    href: "#",
    hoverColor: "#E0F7FA",
    hoverGlow: "rgba(224,247,250,0.16)",
    icon: (s: number) => <TikTokIcon size={s} />,
  },
  {
    label: "Discord",
    href: "#",
    hoverColor: "#7289DA",
    hoverGlow: "rgba(114,137,218,0.22)",
    icon: (s: number) => <DiscordIcon size={s} />,
  },
];

// ── Badge pill ────────────────────────────────────────────────────────────────
function ToolBadge({ badge }: { badge: string | null }) {
  if (!badge) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    HOT:  { bg: "rgba(239,68,68,0.14)",   text: "#F87171" },
    NEW:  { bg: "rgba(14,165,160,0.14)",  text: "#2DD4C0" },
    SOON: { bg: "rgba(100,116,139,0.12)", text: "#7B8FA0" },
  };
  const c = colors[badge] ?? colors.SOON;
  return (
    <span className="ftr-badge" style={{ background: c.bg, color: c.text }}>
      {badge}
    </span>
  );
}

// ── Column heading ────────────────────────────────────────────────────────────
function ColHeading({
  icon,
  label,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div className="ftr-col-heading">
      {icon && (
        <span className="ftr-col-heading-icon" style={{ color }}>
          {icon}
        </span>
      )}
      <h3 className="ftr-col-heading-text" style={{ color }}>
        {label}
      </h3>
    </div>
  );
}

// ── Link list ─────────────────────────────────────────────────────────────────
function LinkList({
  items,
  showBadge = false,
}: {
  items: { label: string; href: string; badge?: string | null }[];
  showBadge?: boolean;
}) {
  return (
    <ul className="ftr-link-list">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="ftr-link"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.42)";
            }}
          >
            {item.label}
            {showBadge && <ToolBadge badge={item.badge ?? null} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="ftr-root">
      <style>{`
        /* ── Root ─────────────────────────────────────── */
        .ftr-root {
          position: relative;
          overflow: hidden;
          background: #05080F;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        /* Atmospheric background glow */
        .ftr-atmosphere {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 55% 50% at 8% 55%, rgba(37,99,235,0.055) 0%, transparent 65%),
            radial-gradient(ellipse 40% 35% at 92% 40%, rgba(99,102,241,0.045) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }

        /* Top accent line */
        .ftr-top-line {
          height: 1px;
          width: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(37,99,235,0.45) 25%,
            rgba(99,102,241,0.45) 50%,
            rgba(14,165,160,0.40) 75%,
            transparent 100%
          );
        }

        /* Inner wrapper */
        .ftr-inner {
          position: relative;
          z-index: 1;
        }

        /* ── Grid ─────────────────────────────────────── */
        .ftr-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
        }
        @media (min-width: 640px) {
          .ftr-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem 2.5rem;
          }
        }
        @media (min-width: 900px) {
          .ftr-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem 2.5rem;
          }
        }
        @media (min-width: 1280px) {
          .ftr-grid {
            grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr;
            gap: 1.5rem 2.5rem;
            align-items: start;
          }
        }

        /* ── Brand block ──────────────────────────────── */
        .ftr-brand-desc {
          margin-top: 1.1rem;
          max-width: 300px;
          font-size: 15.5px;
          line-height: 1.80;
          color: rgba(255,255,255,0.52);
          font-family: var(--font-body, 'Familjen Grotesk', sans-serif);
        }

        /* ── Social icons ─────────────────────────────── */
        .ftr-social-row {
          display: flex;
          gap: 10px;
          margin-top: 1.75rem;
        }
        .ftr-social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.36);
          transition: color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          flex-shrink: 0;
          cursor: pointer;
          text-decoration: none;
        }
        .ftr-social-btn:hover {
          background: rgba(255,255,255,0.06);
        }

        /* ── Column headings ──────────────────────────── */
        .ftr-col-heading {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 1.25rem;
        }
        .ftr-col-heading-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .ftr-col-heading-text {
          font-family: var(--font-display, 'Syne', sans-serif);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin: 0;
          line-height: 1;
        }

        /* ── Link list ────────────────────────────────── */
        .ftr-link-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ftr-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-body, 'Familjen Grotesk', sans-serif);
          font-size: 15px;
          line-height: 1;
          color: rgba(255,255,255,0.42);
          text-decoration: none;
          transition: color 0.16s ease;
        }

        /* ── Badge ────────────────────────────────────── */
        .ftr-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          line-height: 1.6;
          flex-shrink: 0;
        }

        /* ── Bottom bar ───────────────────────────────── */
        .ftr-bottom-bar {
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .ftr-bottom-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 1.5rem 0;
        }
        @media (min-width: 640px) {
          .ftr-bottom-inner {
            flex-direction: row;
          }
        }
        .ftr-copy {
          font-family: var(--font-body, 'Familjen Grotesk', sans-serif);
          font-size: 13.5px;
          color: rgba(255,255,255,0.28);
          margin: 0;
        }
        .ftr-tagline {
          font-family: var(--font-display, 'Syne', sans-serif);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #2563EB, #6366F1, #0EA5A0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .ftr-social-btn,
          .ftr-link { transition: none; }
        }
      `}</style>

      {/* Atmospheric glow layer */}
      <div className="ftr-atmosphere" aria-hidden="true" />

      {/* Top accent line */}
      <div className="ftr-top-line" aria-hidden="true" />

      <div className="ftr-inner">
        <div className="container-site py-20">
          <div className="ftr-grid">

            {/* ── Brand block ───────────────────────────────────────────────── */}
            <div>
              <Logo size="md" />
              <p className="ftr-brand-desc">
                Zencra is a futuristic cinematic AI platform for filmmakers, creators,
                artists, and digital storytellers. Generate AI images, cinematic videos,
                voice, lip sync, and professional audio in a few seconds from one
                powerful creative workspace.
              </p>

              {/* Social icons */}
              <div className="ftr-social-row">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="ftr-social-btn"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = s.hoverColor;
                      el.style.borderColor = s.hoverColor + "55";
                      el.style.boxShadow = `0 0 14px ${s.hoverGlow}`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.color = "rgba(255,255,255,0.36)";
                      el.style.borderColor = "rgba(255,255,255,0.09)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    {s.icon(16)}
                  </a>
                ))}
              </div>
            </div>

            {/* ── ZENCRA ────────────────────────────────────────────────────── */}
            <div>
              <ColHeading
                icon={<Sparkles size={12} />}
                label="Zencra"
                color="#818CF8"
              />
              <LinkList items={zencraTools} />
            </div>

            {/* ── Image Studio ──────────────────────────────────────────────── */}
            <div>
              <ColHeading
                icon={<ImageIcon size={12} />}
                label="Image"
                color="#2563EB"
              />
              <LinkList items={imageTools} showBadge />
            </div>

            {/* ── Video Studio ──────────────────────────────────────────────── */}
            <div>
              <ColHeading
                icon={<Video size={12} />}
                label="Video"
                color="#0EA5A0"
              />
              <LinkList items={videoTools} showBadge />
            </div>

            {/* ── Audio Studio ──────────────────────────────────────────────── */}
            <div>
              <ColHeading
                icon={<Music size={12} />}
                label="Audio"
                color="#84CC16"
              />
              <LinkList items={audioTools} showBadge />
            </div>

            {/* ── Company ───────────────────────────────────────────────────── */}
            <div>
              <ColHeading
                label="Company"
                color="rgba(255,255,255,0.42)"
              />
              <LinkList items={companyLinks} />
            </div>

            {/* ── Legal ─────────────────────────────────────────────────────── */}
            <div>
              <ColHeading
                label="Legal"
                color="rgba(255,255,255,0.32)"
              />
              <LinkList items={legalLinks} />
            </div>

          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────────── */}
        <div className="ftr-bottom-bar">
          <div className="container-site ftr-bottom-inner">
            <p className="ftr-copy">
              © {year} Zencra Labs Private Limited. All rights reserved.
            </p>
            <p className="ftr-tagline">Intelligence by Design</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
