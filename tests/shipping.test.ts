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

describe("computeShipping zones", () => {
  const cfg = {
    flatRate: 50,
    freeShippingThreshold: 1000,
    enableFreeShipping: true,
    zones: [
      { name: "North East", states: ["Assam", "Meghalaya"], rate: 120 },
      { name: "Local", states: ["Delhi"], rate: 0 },
    ],
  };

  it("uses the zone rate when the state matches (case/space-insensitive)", () => {
    expect(computeShipping(200, cfg, "  assam ")).toBe(120);
    expect(computeShipping(200, cfg, "DELHI")).toBe(0);
  });

  it("falls back to the flat rate for unmatched or missing states", () => {
    expect(computeShipping(200, cfg, "Kerala")).toBe(50);
    expect(computeShipping(200, cfg)).toBe(50);
  });

  it("still gives free shipping above the threshold in any zone", () => {
    expect(computeShipping(1000, cfg, "Assam")).toBe(0);
  });
});
