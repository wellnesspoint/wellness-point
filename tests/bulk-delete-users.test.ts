import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ME = "64b000000000000000000001";
const A = "64b0000000000000000000a1"; // regular customer
const B = "64b0000000000000000000b2"; // regular customer
const ADMIN2 = "64b0000000000000000000c3"; // another admin

const checkAdmin = vi.fn();
const userFind = vi.fn();
const userDeleteMany = vi.fn();
const wishlistDeleteMany = vi.fn();
const reviewDeleteMany = vi.fn();
const orderDistinct = vi.fn();
const userBulkWrite = vi.fn();

vi.mock("@/lib/admin", () => ({
  checkAdmin: () => checkAdmin(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/models/User", () => ({
  default: {
    find: (q: any) => ({ select: () => ({ lean: async () => userFind(q) }) }),
    deleteMany: (q: any) => userDeleteMany(q),
    bulkWrite: (ops: any) => userBulkWrite(ops),
  },
}));
vi.mock("@/models/Order", () => ({ default: { distinct: (...a: any[]) => orderDistinct(...a) } }));
vi.mock("@/models/Wishlist", () => ({ default: { deleteMany: (q: any) => wishlistDeleteMany(q) } }));
vi.mock("@/models/Review", () => ({ default: { deleteMany: (q: any) => reviewDeleteMany(q) } }));

import { DELETE } from "@/app/api/admin/users/route";

const call = (body: unknown) =>
  DELETE(
    new NextRequest("http://x.test/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  checkAdmin.mockResolvedValue({ user: { id: ME } });
  orderDistinct.mockResolvedValue([]);
  // The DB lookup only returns non-admin users that were asked for.
  userFind.mockImplementation((q: any) =>
    [A, B].filter((id) => q._id.$in.includes(id)).map((id) => ({ _id: { toString: () => id } }))
  );
});

describe("DELETE /api/admin/users (bulk)", () => {
  it("rejects unauthenticated callers", async () => {
    checkAdmin.mockResolvedValue(null);
    expect((await call({ ids: [A] })).status).toBe(403);
    expect(userDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects empty, malformed and oversized id lists", async () => {
    expect((await call({ ids: [] })).status).toBe(400);
    expect((await call({ ids: ["nope"] })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call({ ids: Array.from({ length: 101 }, () => A) })).status).toBe(400);
    expect(userDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the selected customers and their wishlists/reviews", async () => {
    const res = await call({ ids: [A, B] });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.deleted.sort()).toEqual([A, B].sort());
    expect(json.skipped).toEqual([]);
    expect(userDeleteMany).toHaveBeenCalledTimes(1);
    expect(wishlistDeleteMany).toHaveBeenCalledTimes(1);
    expect(reviewDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("never deletes the caller or admin accounts, and reports them as skipped", async () => {
    const res = await call({ ids: [A, ME, ADMIN2] });
    const json = await res.json();
    expect(json.deleted).toEqual([A]);
    expect(json.skipped.sort()).toEqual([ME, ADMIN2].sort());
    // the caller's own id is never even queried
    expect(userFind.mock.calls[0][0]._id.$in).not.toContain(ME);
    // deletion is additionally guarded by role in the delete query itself
    expect(userDeleteMany.mock.calls[0][0].role).toEqual({ $ne: "admin" });
  });

  it("anonymises (instead of deleting) customers who have orders", async () => {
    orderDistinct.mockResolvedValue([{ toString: () => A }]);
    const res = await call({ ids: [A, B] });
    const json = await res.json();
    expect(json.anonymized).toEqual([A]);
    expect(json.removed).toEqual([B]);
    expect(userDeleteMany.mock.calls[0][0]._id.$in).toEqual([B]);
    expect(userBulkWrite).toHaveBeenCalledTimes(1);
    expect(userBulkWrite.mock.calls[0][0][0].updateOne.filter._id).toBe(A);
  });

  it("does nothing when every id is skipped", async () => {
    const res = await call({ ids: [ME] });
    expect((await res.json()).deleted).toEqual([]);
    expect(userDeleteMany).not.toHaveBeenCalled();
  });
});
