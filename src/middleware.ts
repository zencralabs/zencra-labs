import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware — only handles the /admin → /hub alias redirect.
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

  // Redirect legacy /admin path to /hub
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.replace(/^\/admin/, "");
    return NextResponse.redirect(new URL(`/hub${rest}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
