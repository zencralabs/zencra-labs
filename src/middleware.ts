import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection middleware.
 *
 * /hub  — Admin control hub.  Requires a valid session with role='admin'.
 *         Unauthenticated → redirect to /?auth=login
 *         Authenticated but not admin → redirect to /dashboard
 *
 * /admin → Permanently redirect to /hub (old route alias)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect old /admin path to /hub
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.replace(/^\/admin/, "");
    return NextResponse.redirect(new URL(`/hub${rest}`, req.url));
  }

  // /hub is protected — but we do role-check inside the layout
  // (JWT decode is not available in Edge middleware without supabase-ssr;
  // the layout component does the real auth guard using the AuthContext)
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/hub/:path*"],
};
