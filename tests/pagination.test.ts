import { describe, it, expect } from "vitest";
import { escapeRegex, istDateRange, pageMeta, parsePagination } from "@/lib/pagination";

const qs = (s: string) => new URLSearchParams(s);

describe("parsePagination", () => {
  it("defaults and clamps", () => {
    expect(parsePagination(qs(""))).toEqual({ page: 1, limit: 25, skip: 0 });
    expect(parsePagination(qs("page=3&limit=10"))).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(parsePagination(qs("page=-4&limit=9999"))).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePagination(qs("page=abc&limit=0"))).toEqual({ page: 1, limit: 25, skip: 0 });
  });
});

describe("escapeRegex", () => {
  it("neutralises regex metacharacters from user search text", () => {
    const rx = new RegExp(escapeRegex("a.b(c)+[d]*"), "i");
    expect(rx.test("A.B(C)+[D]*")).toBe(true);
    expect(rx.test("axb(c)+[d]*")).toBe(false);
  });
});

describe("istDateRange", () => {
  it("covers whole IST days, inclusive of the end day", () => {
    const r = istDateRange("2025-01-01", "2025-01-02")!;
    expect(r.$gte!.toISOString()).toBe("2024-12-31T18:30:00.000Z");
    expect(r.$lt!.toISOString()).toBe("2025-01-02T18:30:00.000Z");
  });

  it("supports open-ended ranges and ignores bad input", () => {
    expect(istDateRange("2025-01-01", null)!.$lt).toBeUndefined();
    expect(istDateRange(null, "2025-01-01")!.$gte).toBeUndefined();
    expect(istDateRange("nope", "")).toBeNull();
  });
});

describe("pageMeta", () => {
  it("computes at least one page", () => {
    expect(pageMeta(0, { page: 1, limit: 25, skip: 0 }).pages).toBe(1);
    expect(pageMeta(51, { page: 1, limit: 25, skip: 0 }).pages).toBe(3);
  });
});
