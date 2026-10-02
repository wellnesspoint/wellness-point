import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { matchRedirect, isProtectedPath, type RedirectRule } from "@/lib/redirects";

// ─── Storefront status (maintenance mode + redirects) ───────────────
// Read from /api/site-status and cached in memory for 30 s per instance, so pages
// stay statically cached and the proxy adds at most one small request per 30 s.
// Fails OPEN: if the status cannot be read, the site behaves normally.
interface StoreStatus {
  maintenance: { on: boolean };
  redirects: RedirectRule[];
}
const STATUS_TTL_MS = 30_000;
const EMPTY_STATUS: StoreStatus = { maintenance: { on: false }, redirects: [] };
let statusCache: { value: StoreStatus; at: number } | null = null;

async function loadStoreStatus(origin: string): Promise<StoreStatus> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) return statusCache.value;
  try {
    const res = await fetch(`${origin}/api/site-status`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const value = (await res.json()) as StoreStatus;
      statusCache = { value, at: Date.now() };
      return value;
    }
  } catch {
    // fall through to the stale/empty value
  }
  // Keep the last known value and retry in ~5 s.
  statusCache = { value: statusCache?.value ?? EMPTY_STATUS, at: Date.now() - STATUS_TTL_MS + 5_000 };
  return statusCache.value;
}

/** Only real page loads are redirected/blocked: never APIs (payment webhooks!), admin or assets. */
function isStorefrontPage(req: NextRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  return !isProtectedPath(req.nextUrl.pathname);
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

  // ─── Storefront: redirects, then maintenance mode ─────────────────
  if (pathname === "/api/site-status") return NextResponse.next();
  if (isStorefrontPage(req)) {
    const status = await loadStoreStatus(req.nextUrl.origin);

    const rule = matchRedirect(pathname, status.redirects);
    if (rule) {
      const target = /^https:\/\//i.test(rule.to) ? new URL(rule.to) : new URL(rule.to, req.url);
      return NextResponse.redirect(target, rule.permanent ? 301 : 302);
    }

    // A signed-in admin (cookie present; the admin pages verify it properly) can still
    // browse the live storefront while it is in maintenance.
    if (status.maintenance.on && !req.cookies.get("admin-token")?.value) {
      return NextResponse.rewrite(new URL("/maintenance", req.url), {
        status: 503,
        headers: { "Retry-After": "3600", "Cache-Control": "no-store" },
      });
    }
    return NextResponse.next();
  }

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
  // Everything except Next internals and files with an extension (images, fonts, robots.txt...).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
