import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection middleware.
 *
 * /admin/*    → redirect to /hub (old alias)
 * /hub/*      → auth + role=admin check happens in layout.tsx
 * /studio/*   → must be authenticated; unauthenticated → login modal
 * /dashboard/*→ must be authenticated; unauthenticated → login modal
 *
 * Note: full JWT/role checks are done in layout.tsx because Edge middleware
 * can't easily decode Supabase JWTs without supabase-ssr. Middleware handles
 * redirects for clearly public vs protected routes only.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect old /admin path to /hub
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.replace(/^\/admin/, "");
    return NextResponse.redirect(new URL(`/hub${rest}`, req.url));
  }

  // Protected routes — check for Supabase session cookie
  const isProtected =
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/dashboard";

  if (isProtected) {
    // Supabase stores session in sb-<project>-auth-token cookie
    // We check for any sb-*-auth-token cookie as a quick gate
    const hasCookie = [...req.cookies.getAll()].some(
      c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
    );

    if (!hasCookie) {
      const loginUrl = new URL("/", req.url);
      loginUrl.searchParams.set("auth", "login");
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/hub/:path*",
    "/studio/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
