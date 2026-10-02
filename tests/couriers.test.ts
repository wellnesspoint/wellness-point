import { describe, it, expect } from "vitest";
import { trackingUrlFor, findCourier, COURIERS } from "@/lib/couriers";

describe("couriers", () => {
  it("builds the public tracking link for a known courier (case/space-insensitive)", () => {
    expect(trackingUrlFor(" delhivery ", "ABC123")).toBe("https://www.delhivery.com/track/package/ABC123");
    expect(findCourier("DTDC")?.name).toBe("DTDC");
  });

  it("url-encodes the tracking number so it cannot break out of the link", () => {
    const url = trackingUrlFor("Delhivery", "a b/c?d=1&e");
    expect(url).toBe("https://www.delhivery.com/track/package/a%20b%2Fc%3Fd%3D1%26e");
  });

  it("returns undefined for unknown couriers or a missing number", () => {
    expect(trackingUrlFor("Pigeon Post", "123")).toBeUndefined();
    expect(trackingUrlFor("Delhivery", "")).toBeUndefined();
    expect(trackingUrlFor(undefined, "123")).toBeUndefined();
  });

  it("every preset is an https template containing the {n} placeholder", () => {
    for (const c of COURIERS) {
      expect(c.urlTemplate.startsWith("https://")).toBe(true);
      expect(c.urlTemplate).toContain("{n}");
    }
  });
});
