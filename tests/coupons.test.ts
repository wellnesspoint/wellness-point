import { describe, it, expect, vi } from "vitest";

// coupons.ts imports Mongoose models; only the pure helpers are exercised here.
vi.mock("@/models/Coupon", () => ({ default: {} }));
vi.mock("@/models/Order", () => ({ default: {} }));

import { checkCouponRules, computeDiscount } from "@/lib/coupons";
import { parseCoupon } from "@/lib/coupon-input";
import { diffFields } from "@/lib/audit";
import { abandonedFilter, MAX_AGE_MS, MIN_AGE_MS } from "@/lib/abandoned";

vi.mock("@/lib/email", () => ({ sendAbandonedCartEmail: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: async () => {} }));

describe("computeDiscount", () => {
  it("percent coupons round to paise and respect the cap", () => {
    expect(computeDiscount({ type: "percent", value: 10, maxDiscount: 0 }, 499)).toBe(49.9);
    expect(computeDiscount({ type: "percent", value: 50, maxDiscount: 100 }, 1000)).toBe(100);
  });

  it("fixed coupons never exceed the subtotal", () => {
    expect(computeDiscount({ type: "fixed", value: 200, maxDiscount: 0 }, 150)).toBe(150);
    expect(computeDiscount({ type: "fixed", value: 75, maxDiscount: 0 }, 500)).toBe(75);
  });

  it("never goes negative", () => {
    expect(computeDiscount({ type: "fixed", value: 50, maxDiscount: 0 }, 0)).toBe(0);
  });
});

describe("checkCouponRules", () => {
  const base = { type: "percent" as const, value: 10, minOrder: 0, maxDiscount: 0, isActive: true };
  const now = new Date("2025-06-15T12:00:00Z");

  it("accepts a plain active coupon", () => {
    expect(checkCouponRules(base, 100, now)).toBeNull();
  });

  it("rejects disabled, not-yet-started and expired coupons", () => {
    expect(checkCouponRules({ ...base, isActive: false }, 100, now)).toMatch(/not active/);
    expect(checkCouponRules({ ...base, startsAt: new Date("2025-07-01") }, 100, now)).toMatch(/not valid yet/);
    expect(checkCouponRules({ ...base, expiresAt: new Date("2025-06-01") }, 100, now)).toMatch(/expired/);
  });

  it("enforces the minimum order and says how much more is needed", () => {
    const msg = checkCouponRules({ ...base, minOrder: 500 }, 320, now);
    expect(msg).toMatch(/₹180 more/);
    expect(checkCouponRules({ ...base, minOrder: 500 }, 500, now)).toBeNull();
  });
});

describe("parseCoupon", () => {
  it("normalises the code and requires type and value on create", () => {
    const ok = parseCoupon({ code: " save10 ", type: "percent", value: "10" }, true);
    expect(ok).toEqual({ data: { code: "SAVE10", type: "percent", value: 10 } });
    expect("error" in parseCoupon({ code: "x", type: "percent", value: 10 }, true)).toBe(true);
    expect("error" in parseCoupon({ code: "SAVE10", type: "bogus", value: 10 }, true)).toBe(true);
    expect("error" in parseCoupon({ code: "SAVE10", type: "fixed", value: 0 }, true)).toBe(true);
  });

  it("caps percentages at 100", () => {
    expect("error" in parseCoupon({ code: "BIG", type: "percent", value: 150 }, true)).toBe(true);
    expect("error" in parseCoupon({ code: "BIG", type: "fixed", value: 150 }, true)).toBe(false);
  });

  it("never lets an update change the code and ignores unknown fields", () => {
    const r = parseCoupon({ code: "NEW", usageLimit: "5", isActive: false, _id: "x", $where: "1" }, false);
    expect(r).toEqual({ data: { usageLimit: 5, isActive: false } });
  });

  it("validates dates and empties clear them", () => {
    expect(parseCoupon({ startsAt: "", expiresAt: null }, false)).toEqual({ data: { startsAt: null, expiresAt: null } });
    expect("error" in parseCoupon({ startsAt: "2025-02-02", expiresAt: "2025-01-01" }, false)).toBe(true);
  });
});

describe("diffFields", () => {
  it("reports only fields that changed, with before/after", () => {
    const changes = diffFields(
      { price: 100, stock: 5, name: "A" },
      { price: 120, stock: 5, name: "A" },
      ["price", "stock", "name"]
    );
    expect(changes).toEqual({ price: [100, 120] });
  });

  it("ignores fields absent from the new value", () => {
    expect(diffFields({ a: 1 }, {}, ["a"])).toEqual({});
  });
});

describe("abandonedFilter", () => {
  it("targets pending checkouts between 1 hour and 7 days old", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const f = abandonedFilter(now);
    expect(f.paymentStatus).toBe("pending");
    expect(f.createdAt.$lt.getTime()).toBe(now.getTime() - MIN_AGE_MS);
    expect(f.createdAt.$gt.getTime()).toBe(now.getTime() - MAX_AGE_MS);
  });
});
