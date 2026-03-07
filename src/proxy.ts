import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Centralized middleware for route protection.
 *
 * - /dashboard/* → requires authenticated user session (NextAuth JWT)
 * - /admin/* → requires admin-token cookie (except /admin/login)
 * - /api/admin/* → requires admin-token cookie (except /api/admin/auth/*)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Dashboard routes: require user authentication ───────────────
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ─── Admin pages: require admin-token cookie ─────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminToken = req.cookies.get("admin-token")?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // ─── Admin API routes: require admin-token cookie ────────────────
  // (except auth routes which handle their own login/logout/session)
  if (
    pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/admin/auth")
  ) {
    const adminToken = req.cookies.get("admin-token")?.value;
    if (!adminToken) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }
  }

  // ─── User API routes: require user authentication ────────────────
  if (
    pathname.startsWith("/api/orders") ||
    pathname.startsWith("/api/wishlist") ||
    pathname.startsWith("/api/user")
  ) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/orders/:path*",
    "/api/wishlist/:path*",
    "/api/user/:path*",
  ],
};
