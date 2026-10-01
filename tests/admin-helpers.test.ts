import { describe, it, expect } from "vitest";
import { calcOrderTotal, calcOrderSubtotal } from "@/lib/order-math";
import { csvCell, toCsv } from "@/lib/csv";
import { istDayKey, istDayStart } from "@/lib/dates";
import {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS,
  allowedNext,
  canTransition,
} from "@/lib/order-status";
import { parseBanner } from "@/lib/banner-input";

describe("order math", () => {
  it("derives totals from line items, shipping and discount", () => {
    const order = {
      items: [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ],
      shipping: 40,
      discount: 10,
    };
    expect(calcOrderSubtotal(order)).toBe(250);
    expect(calcOrderTotal(order)).toBe(280);
    expect(calcOrderTotal({})).toBe(0);
  });
});

describe("csv", () => {
  it("quotes cells containing commas, quotes and newlines", () => {
    expect(csvCell('Doe, "Jo"')).toBe('"Doe, ""Jo"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("@cmd")).toBe("'@cmd");
    // real negative numbers are untouched
    expect(csvCell(-5)).toBe("-5");
  });

  it("builds a table", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"');
  });
});

describe("IST day helpers", () => {
  it("buckets by the IST calendar day, not UTC", () => {
    // 20:00 UTC on Jan 1 is 01:30 IST on Jan 2
    expect(istDayKey(new Date("2025-01-01T20:00:00Z"))).toBe("2025-01-02");
    // 18:29 UTC is still 23:59 IST on Jan 1
    expect(istDayKey(new Date("2025-01-01T18:29:00Z"))).toBe("2025-01-01");
  });

  it("finds the start of the IST day in UTC", () => {
    expect(istDayStart(new Date("2025-01-01T20:00:00Z")).toISOString()).toBe(
      "2025-01-01T18:30:00.000Z"
    );
  });
});

describe("order status transitions", () => {
  it("never allows a manual move into paid", () => {
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "pending", "paid")).toBe(false);
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "failed", "paid")).toBe(false);
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "paid", "paid")).toBe(true);
  });

  it("only refunds paid orders and treats refunded as final", () => {
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "paid", "refunded")).toBe(true);
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "pending", "refunded")).toBe(false);
    expect(canTransition(PAYMENT_STATUS_TRANSITIONS, "refunded", "paid")).toBe(false);
  });

  it("blocks re-opening delivered or cancelled orders", () => {
    expect(canTransition(ORDER_STATUS_TRANSITIONS, "delivered", "processing")).toBe(false);
    expect(canTransition(ORDER_STATUS_TRANSITIONS, "cancelled", "shipped")).toBe(false);
    expect(canTransition(ORDER_STATUS_TRANSITIONS, "processing", "shipped")).toBe(true);
  });

  it("lists selectable statuses including the current one", () => {
    expect(allowedNext(ORDER_STATUS_TRANSITIONS, "shipped", ORDER_STATUSES)).toEqual([
      "shipped",
      "delivered",
      "cancelled",
    ]);
  });
});

describe("parseBanner", () => {
  it("requires title and image on create", () => {
    expect("error" in parseBanner({ title: "x" }, true)).toBe(true);
    expect("error" in parseBanner({ imageUrl: "https://a.b/c.png" }, true)).toBe(true);
  });

  it("rejects javascript: links and protocol-relative URLs", () => {
    const base = { title: "t", imageUrl: "https://a.b/c.png" };
    expect("error" in parseBanner({ ...base, linkUrl: "javascript:alert(1)" }, true)).toBe(true);
    expect("error" in parseBanner({ ...base, linkUrl: "//evil.example" }, true)).toBe(true);
    expect("error" in parseBanner({ ...base, linkUrl: "/shop" }, true)).toBe(false);
  });

  it("ignores unknown fields and lets an update clear dates", () => {
    const r = parseBanner({ isActive: false, startDate: "", _id: "x", $set: {} }, false);
    expect(r).toEqual({ data: { isActive: false, startDate: null } });
  });

  it("rejects an end date before the start date", () => {
    const r = parseBanner({ startDate: "2025-02-02", endDate: "2025-01-01" }, false);
    expect("error" in r).toBe(true);
  });
});
