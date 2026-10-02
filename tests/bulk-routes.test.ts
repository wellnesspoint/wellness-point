import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ID1 = "64b000000000000000000001";
const ID2 = "64b000000000000000000002";

const checkAdmin = vi.fn();
const productFind = vi.fn();
const productUpdateMany = vi.fn(async (..._a: unknown[]) => ({ modifiedCount: 2 }));
const couponUpdateMany = vi.fn(async (..._a: unknown[]) => ({ modifiedCount: 1 }));
const couponDeleteMany = vi.fn(async (..._a: unknown[]) => ({ deletedCount: 1 }));
const contactUpdateMany = vi.fn(async (..._a: unknown[]) => ({ modifiedCount: 2 }));
const reviewDistinct = vi.fn(async (..._a: unknown[]) => []);
const reviewDeleteMany = vi.fn(async (..._a: unknown[]) => ({ deletedCount: 2 }));

vi.mock("@/lib/admin", () => ({
  checkAdmin: (...a: unknown[]) => checkAdmin(...a),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/review-rating", () => ({ recalculateProductRating: async () => {} }));
vi.mock("@/models/Product", () => ({
  default: {
    updateMany: (...a: unknown[]) => productUpdateMany(...a),
    find: () => ({ select: async () => productFind() }),
  },
}));
vi.mock("@/models/Coupon", () => ({
  default: {
    find: () => ({ select: () => ({ lean: async () => [{ code: "A" }] }) }),
    updateMany: (...a: unknown[]) => couponUpdateMany(...a),
    deleteMany: (...a: unknown[]) => couponDeleteMany(...a),
  },
}));
vi.mock("@/models/Contact", () => ({
  default: { updateMany: (...a: unknown[]) => contactUpdateMany(...a), deleteMany: vi.fn() },
}));
vi.mock("@/models/Review", () => ({
  default: {
    distinct: (...a: unknown[]) => reviewDistinct(...a),
    deleteMany: (...a: unknown[]) => reviewDeleteMany(...a),
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
  },
}));

import { POST as productsBulk } from "@/app/api/admin/products/bulk/route";
import { POST as couponsBulk } from "@/app/api/admin/coupons/bulk/route";
import { POST as contactsBulk } from "@/app/api/admin/contacts/bulk/route";
import { POST as reviewsBulk } from "@/app/api/admin/reviews/bulk/route";

const req = (path: string, body: unknown) =>
  new NextRequest(`http://x.test${path}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  checkAdmin.mockReset();
  checkAdmin.mockResolvedValue({ user: { id: "a1", email: "a@x.test", name: "A", adminRole: "owner" } });
  productFind.mockReset();
  productUpdateMany.mockClear();
});

describe("bulk routes: access and validation", () => {
  it("require the right area at manage level, and refuse when the role is not allowed", async () => {
    checkAdmin.mockResolvedValue(null);
    expect((await productsBulk(req("/p", { ids: [ID1], action: "activate" }))).status).toBe(403);
    expect(checkAdmin).toHaveBeenCalledWith("products", "manage");
    await couponsBulk(req("/c", { ids: [ID1], action: "enable" }));
    expect(checkAdmin).toHaveBeenCalledWith("coupons", "manage");
    await contactsBulk(req("/ct", { ids: [ID1], action: "read" }));
    expect(checkAdmin).toHaveBeenCalledWith("contacts", "manage");
    await reviewsBulk(req("/r", { ids: [ID1], action: "approve" }));
    expect(checkAdmin).toHaveBeenCalledWith("reviews", "manage");
  });

  it("reject unknown actions, empty/oversized/invalid id lists", async () => {
    for (const route of [productsBulk, couponsBulk, contactsBulk, reviewsBulk]) {
      expect((await route(req("/x", { ids: [ID1], action: "explode" }))).status).toBe(400);
      expect((await route(req("/x", { ids: [], action: "delete" }))).status).toBe(400);
      expect((await route(req("/x", { ids: ["not-an-id"], action: "delete" }))).status).toBe(400);
    }
    const tooMany = Array.from({ length: 201 }, () => ID1);
    expect((await productsBulk(req("/p", { ids: tooMany, action: "activate" }))).status).toBe(400);
  });

  it("contacts cannot be bulk-marked 'replied' (only a real reply does that)", async () => {
    expect((await contactsBulk(req("/ct", { ids: [ID1], action: "replied" }))).status).toBe(400);
  });
});

describe("products bulk: archive and price change", () => {
  it("archive is a soft delete (sets archivedAt, deactivates), never a hard delete", async () => {
    const res = await productsBulk(req("/p", { ids: [ID1, ID2], action: "archive" }));
    expect(res.status).toBe(200);
    const [filter, update] = productUpdateMany.mock.calls[0] as [any, any];
    expect(filter).toEqual({ _id: { $in: [ID1, ID2] } });
    expect(update.$set.isActive).toBe(false);
    expect(update.$set.archivedAt).toBeInstanceOf(Date);
  });

  it("rejects out-of-range or zero price changes", async () => {
    for (const percent of [0, -95, 600, "abc"]) {
      expect((await productsBulk(req("/p", { ids: [ID1], action: "adjust_price", percent }))).status).toBe(400);
    }
  });

  it("scales price and discount, dropping a discount that would no longer be lower", async () => {
    const mk = (price: number, discountPrice?: number) => {
      const doc: any = { price, discountPrice, variants: undefined, save: vi.fn(async () => {}) };
      return doc;
    };
    const a = mk(1000, 800);
    productFind.mockReturnValue([a]);
    const res = await productsBulk(req("/p", { ids: [ID1], action: "adjust_price", percent: 10 }));
    expect(await res.json()).toEqual({ affected: 1 });
    expect(a.price).toBe(1100);
    expect(a.discountPrice).toBe(880);
    expect(a.save).toHaveBeenCalled();
  });

  it("scales every variant and re-derives the product's from-price", async () => {
    const doc: any = {
      price: 1000,
      discountPrice: undefined,
      variants: [
        { price: 1000, discountPrice: undefined, stock: 2, isActive: true },
        { price: 2000, discountPrice: 1500, stock: 3, isActive: true },
      ],
      save: vi.fn(async () => {}),
    };
    productFind.mockReturnValue([doc]);
    await productsBulk(req("/p", { ids: [ID1], action: "adjust_price", percent: -10 }));
    expect(doc.variants[0].price).toBe(900);
    expect(doc.variants[1].price).toBe(1800);
    expect(doc.variants[1].discountPrice).toBe(1350);
    expect(doc.price).toBe(900); // cheapest active variant
  });
});

describe("coupons bulk", () => {
  it("disables, enables and deletes by id", async () => {
    await couponsBulk(req("/c", { ids: [ID1], action: "disable" }));
    expect(couponUpdateMany).toHaveBeenCalledWith({ _id: { $in: [ID1] } }, { $set: { isActive: false } });
    await couponsBulk(req("/c", { ids: [ID1], action: "delete" }));
    expect(couponDeleteMany).toHaveBeenCalledWith({ _id: { $in: [ID1] } });
  });
});
