import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware — handles two concerns:
 *
 * 1. /admin → /hub alias redirect (legacy)
 *
 * 2. /showcase/*.mp4 → 410 Gone
 *    Showcase videos have been moved to Supabase Storage CDN.
 *    Any direct request to old Vercel-served paths is killed here
 *    to prevent bandwidth abuse via cached/shared old URLs.
 *    New URLs: https://qlhfmhawhdpagkxaldae.supabase.co/storage/v1/object/public/showcase/
 *
 * Auth protection for /studio/* and /dashboard/* is handled at the
 * layout/page level via AuthContext (useAuth). The Supabase browser client
 * stores sessions in localStorage, not cookies, so cookie-based middleware
 * guards do not work and block every visitor including logged-in users.
 *
 * /hub/* admin checks are also done in hub/layout.tsx via AuthContext.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Block old showcase static paths (videos moved to Supabase CDN) ─────────
  if (pathname.startsWith("/showcase/") && pathname.endsWith(".mp4")) {
    return new NextResponse(
      JSON.stringify({ error: "Gone. Showcase videos have moved to CDN." }),
      {
        status: 410,
        headers: {
          "Content-Type":  "application/json",
          "Cache-Control": "public, max-age=86400",   // CDNs cache the 410 for 24h
        },
      }
    );
  }

  // ── Redirect legacy /admin path to /hub ────────────────────────────────────
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.replace(/^\/admin/, "");
    return NextResponse.redirect(new URL(`/hub${rest}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/showcase/:path*"],
};
