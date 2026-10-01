import { describe, it, expect } from "vitest";
import { __memoryLimit, getClientIp } from "@/lib/rate-limit";

describe("in-memory fallback limiter", () => {
  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const key = "t:" + Math.random();
    expect(__memoryLimit(key, opts).success).toBe(true);
    expect(__memoryLimit(key, opts).success).toBe(true);
    expect(__memoryLimit(key, opts).success).toBe(true);
    expect(__memoryLimit(key, opts).success).toBe(false);
  });
});

describe("getClientIp", () => {
  const req = (h: Record<string, string>) => new Request("http://x.test", { headers: h });
  it("prefers the unspoofable Vercel header", () => {
    expect(getClientIp(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
  });
  it("ignores the client-controlled first X-Forwarded-For entry", () => {
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
  });
});
