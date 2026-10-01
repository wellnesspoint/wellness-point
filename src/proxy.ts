import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Centralized proxy for route protection + login rate limiting.
 *
 * - /api/auth/callback/credentials → rate limit login attempts
 * - /dashboard/* → requires authenticated user session (NextAuth JWT)
 * - /admin/* → requires admin-token cookie (except /admin/login)
 * - /api/admin/* → requires admin-token cookie (except /api/admin/auth/*)
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Rate limit login attempts ────────────────────────────────────
  if (pathname === "/api/auth/callback/credentials") {
    // Shared DB-backed limiter + spoof-resistant IP (the first X-Forwarded-For
    // entry is client-controlled, so it must not key the limit).
    const ip = getClientIp(req);
    const { success: allowed } = await rateLimit(`login:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }
  }

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
    "/api/auth/callback/credentials",
  ],
};
