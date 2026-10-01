/**
 * Rate limiter for API routes.
 *
 * State lives in MongoDB (atomic `$inc` on one document per key), so limits
 * hold across serverless instances — the old in-memory Map reset per instance
 * and was effectively useless on Vercel. If the database is unreachable we
 * fall back to a per-process in-memory window rather than failing the request.
 */
import connectDB from "./db";
import RateLimit from "@/models/RateLimit";

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

// ── In-memory fallback ────────────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryLimit(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  // opportunistic cleanup so the map can't grow unbounded
  if (memoryStore.size > 5000) {
    for (const [k, v] of memoryStore) if (now > v.resetTime) memoryStore.delete(k);
  }
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, limit, remaining: limit - 1, resetTime: now + windowMs };
  }
  entry.count++;
  return {
    success: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Check (and consume) one request against `key`.
 *
 * @example
 * const { success } = await rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowMs } = options;
  try {
    await connectDB();

    // Each step is a single atomic operation, so concurrent requests can never
    // both "start" a window or both reset a counter:
    //   1. bump the counter of an ACTIVE window;
    //   2. else take over an EXPIRED window (only one caller can match it,
    //      because the winner moves resetAt into the future);
    //   3. else insert a brand-new window (the unique _id makes a racing
    //      duplicate fail, and the loser loops back to step 1).
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = new Date();
      const resetAt = new Date(now.getTime() + windowMs);

      const active = await RateLimit.findOneAndUpdate(
        { _id: key, resetAt: { $gt: now } },
        { $inc: { count: 1 } },
        { new: true }
      ).lean();
      if (active) {
        return {
          success: active.count <= limit,
          limit,
          remaining: Math.max(0, limit - active.count),
          resetTime: active.resetAt.getTime(),
        };
      }

      const reclaimed = await RateLimit.findOneAndUpdate(
        { _id: key, resetAt: { $lte: now } },
        { $set: { count: 1, resetAt } }
      ).lean();
      if (reclaimed) {
        return { success: true, limit, remaining: limit - 1, resetTime: resetAt.getTime() };
      }

      try {
        await RateLimit.create({ _id: key, count: 1, resetAt });
        return { success: true, limit, remaining: limit - 1, resetTime: resetAt.getTime() };
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        // lost the creation race — retry and count against the winner's window
      }
    }
    throw new Error("rate limiter could not settle on a window");
  } catch (err) {
    console.error("Rate limiter DB error, using in-memory fallback:", err);
    return memoryLimit(key, options);
  }
}

/** Synchronous in-memory limiter, exported for tests. */
export const __memoryLimit = memoryLimit;

/**
 * Helper to extract client IP from request.
 *
 * Never trust the FIRST entry of X-Forwarded-For — a client can send its own
 * header, and a different fake value per request defeats any IP-keyed limit.
 * `x-vercel-forwarded-for` is set by Vercel's edge and can't be spoofed; as a
 * fallback we take the LAST XFF entry (appended by the closest proxy).
 */
export function getClientIp(req: Request): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return req.headers.get("x-real-ip") || "unknown";
}
