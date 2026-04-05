import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Logo Component – Easy Swap System
//
// HOW TO UPDATE LOGOS (when going live):
// 1. Drop your new logo files into /public/logo/
// 2. Light mode logo → logo-light.svg (dark icon for light backgrounds)
// 3. Dark mode logo  → logo-dark.svg  (light/colored icon for dark backgrounds)
// 4. Favicon        → /public/favicon.ico
//
// The Logo component automatically serves the correct file per theme.
// If you only have one logo, set both paths to the same file.
// ─────────────────────────────────────────────────────────────────────────────

interface LogoProps {
  /** Controls the size variant */
  size?: "sm" | "md" | "lg";
  /** Show just the icon (Z symbol) without the wordmark */
  iconOnly?: boolean;
  /** Additional classes */
  className?: string;
  /** Whether to wrap in a link to home */
  asLink?: boolean;
}

const sizes = {
  sm: { width: 100, height: 28 },
  md: { width: 130, height: 36 },
  lg: { width: 180, height: 50 },
};

const iconSizes = {
  sm: { width: 28, height: 28 },
  md: { width: 36, height: 36 },
  lg: { width: 50, height: 50 },
};

function LogoImage({ size = "md", iconOnly = false, className }: Omit<LogoProps, "asLink">) {
  const dims = iconOnly ? iconSizes[size] : sizes[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/*
        LOGO SWAP SYSTEM:
        - dark:hidden    → hidden in dark mode  → shows in light mode
        - hidden dark:block → hidden in light → shows in dark mode

        Replace the src paths with your actual logo files when ready.
        Current fallback: renders the inline SVG Z-icon + text wordmark
      */}

      {/* ── Inline SVG Fallback (used until real logo files are added) ── */}
      <div className="flex items-center gap-2">
        {/* Z Icon */}
        <svg
          width={dims.width && iconOnly ? dims.width : 36}
          height={dims.height && iconOnly ? dims.height : 36}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="zGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#0EA5A0" />
            </linearGradient>
          </defs>
          {/* Outer rounded square background */}
          <rect width="36" height="36" rx="8" fill="url(#zGradient)" opacity="0.15" />
          {/* Z letterform */}
          <path
            d="M9 10h18l-14 16h14"
            stroke="url(#zGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Wordmark – hidden when iconOnly */}
        {!iconOnly && (
          <div className="flex flex-col leading-none">
            <span
              className="font-bold tracking-tight"
              style={{
                fontSize: size === "lg" ? "1.25rem" : size === "sm" ? "0.9rem" : "1.05rem",
                background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Zencra
            </span>
            <span
              className="font-medium tracking-[0.2em] uppercase"
              style={{
                fontSize: size === "lg" ? "0.55rem" : "0.48rem",
                color: "var(--muted-foreground)",
                letterSpacing: "0.25em",
              }}
            >
              Labs
            </span>
          </div>
        )}
      </div>

      {/*
        ── Image-based Logo (uncomment when logo files are ready) ──────────

        <Image
          src="/logo/logo-dark.svg"
          alt="Zencra Labs"
          width={dims.width}
          height={dims.height}
          priority
          className="hidden dark:block"
        />
        <Image
          src="/logo/logo-light.svg"
          alt="Zencra Labs"
          width={dims.width}
          height={dims.height}
          priority
          className="dark:hidden"
        />
      */}
    </div>
  );
}

export function Logo({ asLink = true, ...props }: LogoProps) {
  if (asLink) {
    return (
      <Link href="/" aria-label="Zencra Labs – Home">
        <LogoImage {...props} />
      </Link>
    );
  }
  return <LogoImage {...props} />;
}
