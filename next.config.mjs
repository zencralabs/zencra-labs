import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SECURITY POLICY
// ─────────────────────────────────────────────────────────────────────────────
//
// Strategy: Report-Only mode first.
//   • Content-Security-Policy-Report-Only: logs violations, never blocks.
//   • Switch to Content-Security-Policy when no violations seen in production.
//
// To enforce: rename the header key below.
//
// Provider allowlist rationale:
//   *.supabase.co        — Supabase DB, Auth, Storage, Realtime websocket
//   api.openai.com       — OpenAI image generation (GPT Image 1/2)
//   api.elevenlabs.io    — ElevenLabs TTS + audio generation
//   *.klingai.com        — Kling video generation API
//   *.byteplus.com       — BytePlus (Kling parent company) CDN/API
//   api.razorpay.com     — Razorpay payment API calls
//   checkout.razorpay.com — Razorpay checkout iframe + scripts
//   challenges.cloudflare.com — Cloudflare Turnstile CAPTCHA
//   va.vercel-scripts.com — Vercel Speed Insights script
//   vitals.vercel-insights.com — Vercel Speed Insights reporting
//   *.fal.run, *.fal.ai  — Fal.ai LTX/FCS generation
//   blob:, data:         — video/image blob URLs generated client-side
//   wss:                 — Supabase Realtime websocket subscription
//
// NOTE on 'unsafe-inline' in script-src:
//   Next.js App Router injects inline hydration scripts. Without a per-request
//   nonce (requires middleware + streaming changes), 'unsafe-inline' is needed.
//   TODO: Upgrade to nonce-based CSP before Series A (Phase 4 hardening).
//
// NOTE on 'unsafe-eval':
//   Required by Next.js dev server only. In production, Next.js does NOT use
//   eval. We include it here in report-only to verify it never fires in prod.
//   Remove from enforcing policy once confirmed.

const buildCSP = () => {
  const directives = [
    // Fallback for anything not explicitly listed
    `default-src 'self'`,

    // Scripts: self + Next.js inline hydration + third-party checkout/analytics
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    + ` https://challenges.cloudflare.com`
    + ` https://checkout.razorpay.com`
    + ` https://va.vercel-scripts.com`,

    // Styles: self + inline (Tailwind CSS-in-JS / styled components)
    `style-src 'self' 'unsafe-inline'`,

    // Fonts: self only (using local fonts — Syne/Familjen Grotesk via Next.js font)
    `font-src 'self' data:`,

    // Images: self + Supabase CDN + data URIs + blob (canvas exports)
    `img-src 'self' data: blob:`
    + ` https://*.supabase.co`
    + ` https://*.supabase.in`,

    // Media: self + blob/data (video preview) + Supabase storage
    `media-src 'self' blob: data:`
    + ` https://*.supabase.co`
    + ` https://*.supabase.in`,

    // Fetch/XHR/WebSocket: all first-party API calls + third-party providers
    `connect-src 'self'`
    + ` https://*.supabase.co`
    + ` https://*.supabase.in`
    + ` wss://*.supabase.co`      // Supabase Realtime
    + ` https://api.openai.com`
    + ` https://api.elevenlabs.io`
    + ` https://*.klingai.com`
    + ` https://*.byteplus.com`
    + ` https://*.fal.run`
    + ` https://*.fal.ai`
    + ` https://api.razorpay.com`
    + ` https://va.vercel-scripts.com`
    + ` https://vitals.vercel-insights.com`,

    // Frames: Turnstile CAPTCHA + Razorpay checkout modal
    `frame-src 'self'`
    + ` https://challenges.cloudflare.com`
    + ` https://checkout.razorpay.com`,

    // No Flash, Java applets, or embedded objects
    `object-src 'none'`,

    // Prevent base tag injection attacks
    `base-uri 'self'`,

    // Form submissions only to same origin
    `form-action 'self'`,

    // Duplicates X-Frame-Options but covers more embedding vectors
    `frame-ancestors 'none'`,

    // Force HTTPS for all embedded resources (belt + suspenders with HSTS)
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
};

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────────────────────────────────────

const SECURITY_HEADERS = [
  // ── Transport Security ──────────────────────────────────────────────────────
  // 2 years, all subdomains, HSTS preload eligible.
  // Vercel is HTTPS-only so this is safe to enforce immediately.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // ── Clickjacking Protection ─────────────────────────────────────────────────
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // ── MIME Type Sniffing ──────────────────────────────────────────────────────
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // ── Referrer Policy ────────────────────────────────────────────────────────
  // Send origin only on cross-origin requests (no path leak)
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // ── Feature / Permissions Policy ───────────────────────────────────────────
  // Explicitly lock down browser features not used by the platform.
  // interest-cohort=() opts out of FLoC/Topics API tracking.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=(self)",        // allow payment on same origin (Razorpay modal)
      "usb=()",
      "bluetooth=()",
      "display-capture=()",
      "fullscreen=(self)",     // allow video fullscreen
    ].join(", "),
  },

  // ── DNS Prefetch Control ────────────────────────────────────────────────────
  // Prevents browser from prefetching DNS for links, reducing info leakage.
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },

  // ── Cross-Origin Policies ───────────────────────────────────────────────────
  // Isolates browsing context to prevent Spectre-class side-channel attacks.
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",  // allow-popups needed for Razorpay
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },

  // ── Content Security Policy (REPORT-ONLY) ──────────────────────────────────
  // ZERO blocking impact. Violations appear in Vercel logs as console errors.
  // Monitor for 1-2 weeks then switch key to "Content-Security-Policy".
  // TODO: Switch to enforcing mode before public launch.
  {
    key: "Content-Security-Policy-Report-Only",
    value: buildCSP(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CORS — locked to production origin
// Applied only to API routes, not pages/assets
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTION_ORIGIN = "https://zencralabs.com";

const CORS_HEADERS = [
  {
    key: "Access-Control-Allow-Origin",
    value: process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : "*",
  },
  {
    key: "Access-Control-Allow-Methods",
    value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization, X-Request-ID",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NEXT.JS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  trailingSlash: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: __dirname,
  },

  // Never expose source maps in production — prevents business logic reverse-engineering
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      // ── Security headers on all routes ──────────────────────────────────────
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // ── CORS on API routes only ─────────────────────────────────────────────
      {
        source: "/api/(.*)",
        headers: CORS_HEADERS,
      },
    ];
  },
};

export default nextConfig;
