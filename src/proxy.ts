import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ── In-memory rate limiter for login attempts ──
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return true;
  }

  entry.count++;
  return entry.count <= 10; // 10 attempts per 15 minutes
}

// Cleanup stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts.entries()) {
      if (now > entry.resetTime) loginAttempts.delete(key);
    }
  }, 5 * 60 * 1000);
}

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
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!checkLoginRateLimit(ip)) {
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
