/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding window approach. Each unique key (usually IP address)
 * is allowed `limit` requests per `windowMs` milliseconds.
 *
 * Note: This is per-process. In a multi-instance deployment (e.g. serverless),
 * consider using Redis-based rate limiting instead.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

interface RateLimitOptions {
  /** Maximum number of requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit for a given key.
 *
 * @example
 * ```ts
 * const ip = req.headers.get("x-forwarded-for") || "unknown";
 * const { success, remaining } = rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
 * if (!success) {
 *   return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 * }
 * ```
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetTime: now + options.windowMs,
    };
  }

  entry.count++;

  if (entry.count > options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/** Helper to extract client IP from request */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
