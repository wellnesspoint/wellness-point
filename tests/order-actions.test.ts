import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ID1 = "64b000000000000000000001";
const ID2 = "64b000000000000000000002";
const ID3 = "64b000000000000000000003";

const checkAdmin = vi.fn();
const orderFind = vi.fn();
const orderFindById = vi.fn();
const orderUpdateOne = vi.fn();
const orderFindOneAndUpdate = vi.fn();
const orderFindByIdAndUpdate = vi.fn();
const refund = vi.fn();
const sendStatusEmail = vi.fn();
const logAudit = vi.fn();

vi.mock("@/lib/admin", () => ({
  checkAdmin: () => checkAdmin(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/email", () => ({ sendOrderStatusEmail: (...a: unknown[]) => sendStatusEmail(...a) }));
vi.mock("@/lib/razorpay", () => ({ default: { payments: { refund: (...a: unknown[]) => refund(...a) } } }));
vi.mock("@/models/Order", () => ({
  default: {
    find: (...a: unknown[]) => ({ populate: async () => orderFind(...a) }),
    findById: (...a: unknown[]) => {
      const result = orderFindById(...a);
      // supports both `await Order.findById(id).populate(...)` and `.select(...)`
      return { populate: async () => result, select: async () => result };
    },
    updateOne: (...a: unknown[]) => orderUpdateOne(...a),
    findOneAndUpdate: (...a: unknown[]) => orderFindOneAndUpdate(...a),
    findByIdAndUpdate: (...a: unknown[]) => ({ select: async () => orderFindByIdAndUpdate(...a) }),
  },
}));

import { PATCH } from "@/app/api/admin/orders/bulk/route";
import { POST as REFUND } from "@/app/api/admin/orders/[id]/refund/route";
import { POST as ADD_NOTE } from "@/app/api/admin/orders/[id]/notes/route";
import { fillReply } from "@/lib/canned-replies";

const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://x.test${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const order = (id: string, over: Record<string, unknown> = {}) => ({
  _id: { toString: () => id },
  paymentStatus: "paid",
  orderStatus: "processing",
  shippingAddress: { email: `${id}@x.com`, fullName: "Cust" },
  items: [{ price: 100, quantity: 2 }],
  shipping: 50,
  discount: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  checkAdmin.mockResolvedValue({ user: { id: "a1", name: "Admin", email: "a@x.com" } });
  orderUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  sendStatusEmail.mockResolvedValue(undefined);
});

describe("PATCH /api/admin/orders/bulk", () => {
  it("only accepts forward statuses and a sane selection", async () => {
    expect((await PATCH(req("/b", "PATCH", { ids: [ID1], orderStatus: "cancelled" }))).status).toBe(400);
    expect((await PATCH(req("/b", "PATCH", { ids: [], orderStatus: "shipped" }))).status).toBe(400);
    expect((await PATCH(req("/b", "PATCH", { ids: ["nope"], orderStatus: "shipped" }))).status).toBe(400);
    expect(orderFind).not.toHaveBeenCalled();
  });

  it("moves valid paid orders, skips the rest, and emails customers when shipped", async () => {
    orderFind.mockResolvedValue([
      order(ID1), // ok
      order(ID2, { paymentStatus: "failed" }), // not paid
      order(ID3, { orderStatus: "delivered" }), // can't go back to shipped
    ]);
    const res = await PATCH(req("/b", "PATCH", { ids: [ID1, ID2, ID3], orderStatus: "shipped" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.updated).toEqual([ID1]);
    expect(json.skipped.map((s: { id: string }) => s.id).sort()).toEqual([ID2, ID3].sort());
    expect(json.emailed).toBe(1);
    // update is conditional on the status that was checked, and records who did it
    const [filter, update] = orderUpdateOne.mock.calls[0];
    expect(filter.orderStatus).toBe("processing");
    expect(update.$push.statusHistory).toMatchObject({ to: "shipped", by: "Admin" });
    expect(sendStatusEmail).toHaveBeenCalledWith(expect.objectContaining({ type: "shipped", total: 250 }));
    expect(logAudit.mock.calls[0][1].action).toBe("order.bulk_update");
  });

  it("skips an order changed by someone else in the meantime", async () => {
    orderFind.mockResolvedValue([order(ID1)]);
    orderUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    const json = await (await PATCH(req("/b", "PATCH", { ids: [ID1], orderStatus: "shipped" }))).json();
    expect(json.updated).toEqual([]);
    expect(json.skipped[0].reason).toMatch(/someone else/);
    expect(sendStatusEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/orders/[id]/refund (partial)", () => {
  const call = (body: unknown) => REFUND(req("/r", "POST", body), { params: Promise.resolve({ id: ID1 }) });

  it("refuses amounts that are the full remaining value (use the status flow instead)", async () => {
    orderFindById.mockReturnValue(order(ID1, { razorpayPaymentId: "pay_1", refundedAmount: 0 }));
    const res = await call({ amount: 250 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/full remaining/);
    expect(refund).not.toHaveBeenCalled();
  });

  it("refunds a partial amount in paise and records it", async () => {
    orderFindById.mockReturnValue(order(ID1, { razorpayPaymentId: "pay_1", refundedAmount: 0 }));
    orderFindOneAndUpdate.mockResolvedValue({});
    refund.mockResolvedValue({ id: "rfnd_1" });
    const res = await call({ amount: 100, reason: "damaged" });
    expect(res.status).toBe(200);
    expect(refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 10000 }));
    expect(orderFindOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { refundedAmount: 100 } });
    const push = orderUpdateOne.mock.calls.find((c) => c[1].$push)?.[1].$push.refunds;
    expect(push).toMatchObject({ amount: 100, razorpayRefundId: "rfnd_1", reason: "damaged", by: "Admin" });
    expect(sendStatusEmail).toHaveBeenCalledWith(expect.objectContaining({ type: "refunded", total: 100 }));
  });

  it("rolls the reserved amount back when Razorpay fails", async () => {
    orderFindById.mockReturnValue(order(ID1, { razorpayPaymentId: "pay_1", refundedAmount: 0 }));
    orderFindOneAndUpdate.mockResolvedValue({});
    refund.mockRejectedValue({ error: { description: "Insufficient balance" } });
    const res = await call({ amount: 100 });
    expect(res.status).toBe(502);
    expect(orderUpdateOne).toHaveBeenCalledWith({ _id: ID1 }, { $inc: { refundedAmount: -100 } });
  });

  it("refuses unpaid orders and tiny amounts", async () => {
    orderFindById.mockReturnValue(order(ID1, { paymentStatus: "failed", razorpayPaymentId: "pay_1" }));
    expect((await call({ amount: 100 })).status).toBe(400);
    expect((await call({ amount: 0.5 })).status).toBe(400);
  });
});

describe("POST /api/admin/orders/[id]/notes", () => {
  const call = (body: unknown) => ADD_NOTE(req("/n", "POST", body), { params: Promise.resolve({ id: ID1 }) });

  it("rejects empty and oversized notes", async () => {
    expect((await call({ text: "   " })).status).toBe(400);
    expect((await call({ text: "x".repeat(1001) })).status).toBe(400);
  });

  it("appends a note stamped with the admin's name", async () => {
    orderFindByIdAndUpdate.mockResolvedValue({ internalNotes: [{ text: "called customer" }] });
    const res = await call({ text: " called customer " });
    expect(res.status).toBe(200);
    expect(orderFindByIdAndUpdate.mock.calls[0][1].$push.internalNotes).toMatchObject({
      text: "called customer",
      by: "Admin",
    });
  });
});

describe("fillReply", () => {
  it("personalises with the first name", () => {
    expect(fillReply("Hi {name}!", "Rishabh Jain")).toBe("Hi Rishabh!");
    expect(fillReply("Hi {name}!", "")).toBe("Hi there!");
  });
});
