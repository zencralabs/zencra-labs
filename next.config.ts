import type { NextConfig } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Allowed origins
//
// Production:  https://www.zencralabs.com
// Development: localhost variants (Next.js dev server)
//
// Webhooks (/api/webhooks/*) are intentionally excluded — they receive
// callbacks from provider servers (Kling, Fal, etc.) and must accept any origin.
// Those routes authenticate via a provider-specific HMAC/token instead.
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTION_ORIGIN = "https://www.zencralabs.com";
const DEV_ORIGINS       = ["http://localhost:3000", "http://127.0.0.1:3000"];

function getAllowedOrigin(): string {
  // In development, allow localhost. In production, lock to canonical domain.
  if (process.env.NODE_ENV === "development") {
    return DEV_ORIGINS[0];
  }
  return PRODUCTION_ORIGIN;
}

const CORS_HEADERS = [
  {
    key:   "Access-Control-Allow-Origin",
    value: getAllowedOrigin(),
  },
  {
    key:   "Access-Control-Allow-Methods",
    value: "GET, POST, PUT, DELETE, OPTIONS",
  },
  {
    key:   "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization, X-Requested-With",
  },
  {
    key:   "Access-Control-Max-Age",
    value: "86400",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS
// Applied to all routes globally.
// ─────────────────────────────────────────────────────────────────────────────

const SECURITY_HEADERS = [
  {
    key:   "Strict-Transport-Security",
    value: "max-age=63072000",
  },
  {
    key:   "X-Frame-Options",
    value: "DENY",
  },
  {
    key:   "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key:   "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key:   "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  trailingSlash:     false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: __dirname,
  },

  async headers() {
    return [
      // ── Security headers: apply to every route ──────────────────────────────
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },

      // ── CORS: apply only to /api/* routes ───────────────────────────────────
      // Webhooks (/api/webhooks/*) are excluded — they accept any origin.
      {
        source: "/api/((?!webhooks).*)",
        headers: CORS_HEADERS,
      },
    ];
  },
};

export default nextConfig;
