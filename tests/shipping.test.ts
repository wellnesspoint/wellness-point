import { describe, it, expect } from "vitest";
import { computeShipping, DEFAULT_SHIPPING } from "@/lib/shipping";

describe("computeShipping", () => {
  it("uses the shared defaults when no settings exist", () => {
    expect(computeShipping(100, null)).toBe(DEFAULT_SHIPPING.flatRate);
    expect(computeShipping(DEFAULT_SHIPPING.freeShippingThreshold, null)).toBe(0);
  });

  it("is free at exactly the threshold and charged just below it", () => {
    const cfg = { flatRate: 80, freeShippingThreshold: 1000, enableFreeShipping: true };
    expect(computeShipping(999, cfg)).toBe(80);
    expect(computeShipping(1000, cfg)).toBe(0);
  });

  it("always charges the flat rate when free shipping is disabled", () => {
    const cfg = { flatRate: 60, freeShippingThreshold: 100, enableFreeShipping: false };
    expect(computeShipping(5000, cfg)).toBe(60);
  });

  it("falls back per-field for partial settings", () => {
    expect(computeShipping(10, { flatRate: 0 })).toBe(0);
  });
});
