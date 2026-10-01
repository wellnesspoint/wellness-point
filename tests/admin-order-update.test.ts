import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const checkAdmin = vi.fn();
const findById = vi.fn();
const findOneAndUpdate = vi.fn();
const findByIdAndUpdate = vi.fn();
const productUpdate = vi.fn();
const refund = vi.fn();
const logAudit = vi.fn();
const sendStatusEmail = vi.fn();
const logStockMovements = vi.fn();
const checkLowStock = vi.fn();

vi.mock("@/lib/admin", () => ({
  checkAdmin: () => checkAdmin(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/email", () => ({ sendOrderStatusEmail: (...a: unknown[]) => sendStatusEmail(...a) }));
vi.mock("@/lib/stock", () => ({
  logStockMovements: (...a: unknown[]) => logStockMovements(...a),
  checkLowStock: () => checkLowStock(),
}));
vi.mock("@/lib/razorpay", () => ({
  default: { payments: { refund: (...a: unknown[]) => refund(...a) } },
}));
vi.mock("@/models/Product", () => ({
  default: { findByIdAndUpdate: (...a: unknown[]) => productUpdate(...a) },
}));
vi.mock("@/models/Order", () => ({
  default: {
    findById: (...a: unknown[]) => findById(...a),
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
    findByIdAndUpdate: (...a: unknown[]) => ({
      populate: async () => findByIdAndUpdate(...a),
    }),
  },
}));

import { PUT } from "@/app/api/admin/orders/[id]/route";

const call = (body: unknown) =>
  PUT(
    new NextRequest("http://x.test/api/admin/orders/o1", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "o1" }) }
  );

const order = (over: Record<string, unknown> = {}) => ({
  _id: "o1",
  shippingAddress: { email: "c@example.com", fullName: "Cust" },
  paymentStatus: "paid",
  orderStatus: "processing",
  razorpayPaymentId: "pay_1",
  items: [{ product: "p1", quantity: 2 }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  checkAdmin.mockResolvedValue({ user: { id: "a1", name: "Admin", email: "a@x.com" } });
  sendStatusEmail.mockResolvedValue(undefined);
  findOneAndUpdate.mockResolvedValue({}); // stock restore claim succeeds
  findByIdAndUpdate.mockResolvedValue({ _id: "o1" });
  refund.mockResolvedValue({});
});

describe("PUT /api/admin/orders/[id]", () => {
  it("rejects hand-marking an order paid", async () => {
    findById.mockResolvedValue(order({ paymentStatus: "pending" }));
    const res = await call({ paymentStatus: "paid" });
    expect(res.status).toBe(400);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("blocks re-opening a cancelled or delivered order", async () => {
    findById.mockResolvedValue(order({ orderStatus: "cancelled" }));
    expect((await call({ orderStatus: "shipped" })).status).toBe(400);
    findById.mockResolvedValue(order({ orderStatus: "delivered" }));
    expect((await call({ orderStatus: "processing" })).status).toBe(400);
  });

  it("refunds through Razorpay, then restores stock once", async () => {
    findById.mockResolvedValue(order());
    const res = await call({ paymentStatus: "refunded" });
    expect(res.status).toBe(200);
    expect(refund).toHaveBeenCalledWith("pay_1", expect.objectContaining({ speed: "normal" }));
    expect(productUpdate).toHaveBeenCalledWith("p1", { $inc: { stock: 2 } });
    expect(logStockMovements.mock.calls[0][0][0]).toMatchObject({ delta: 2, reason: "refund", actorName: "Admin" });
    expect(sendStatusEmail).toHaveBeenCalledWith(expect.objectContaining({ type: "refunded", customerEmail: "c@example.com" }));
    expect(logAudit.mock.calls[0][1]).toMatchObject({ action: "order.refund", entity: "order" });
  });

  it("changes nothing when the Razorpay refund fails", async () => {
    findById.mockResolvedValue(order());
    refund.mockRejectedValue({ error: { description: "Insufficient balance" } });
    const res = await call({ paymentStatus: "refunded" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Insufficient balance");
    expect(productUpdate).not.toHaveBeenCalled();
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("treats an already-fully-refunded payment as success", async () => {
    findById.mockResolvedValue(order());
    refund.mockRejectedValue({ error: { description: "The payment has been fully refunded already" } });
    expect((await call({ paymentStatus: "refunded" })).status).toBe(200);
  });

  it("allows a normal forward status change without touching Razorpay", async () => {
    findById.mockResolvedValue(order());
    const res = await call({ orderStatus: "shipped" });
    expect(res.status).toBe(200);
    expect(refund).not.toHaveBeenCalled();
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("records who changed the status and emails the customer when shipped", async () => {
    findById.mockResolvedValue(order());
    findByIdAndUpdate.mockResolvedValue({
      _id: "o1",
      orderStatus: "shipped",
      tracking: { courier: "DTDC", trackingNumber: "T123", trackingUrl: "https://t.example/T123" },
      user: { name: "U", email: "u@x.com" },
    });
    const res = await call({
      orderStatus: "shipped",
      tracking: { courier: "DTDC", trackingNumber: "T123", trackingUrl: "https://t.example/T123" },
    });
    expect(res.status).toBe(200);
    const update = findByIdAndUpdate.mock.calls[0][1];
    expect(update.$push.statusHistory.$each[0]).toMatchObject({
      field: "orderStatus", from: "processing", to: "shipped", by: "Admin",
    });
    expect(sendStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ type: "shipped", tracking: expect.objectContaining({ trackingNumber: "T123" }) })
    );
    expect(logAudit.mock.calls[0][1].summary).toContain("orderStatus processing → shipped");
  });

  it("rejects a non-https tracking URL", async () => {
    findById.mockResolvedValue(order());
    const res = await call({ tracking: { trackingUrl: "javascript:alert(1)" } });
    expect(res.status).toBe(400);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("does not email for orders that were never paid", async () => {
    findById.mockResolvedValue(order({ paymentStatus: "failed" }));
    await call({ orderStatus: "cancelled" });
    expect(sendStatusEmail).not.toHaveBeenCalled();
  });

  it("only re-sends the shipped email for a tracking change when asked to notify", async () => {
    findById.mockResolvedValue(order({ orderStatus: "shipped", tracking: { trackingNumber: "OLD" } }));
    findByIdAndUpdate.mockResolvedValue({ _id: "o1", orderStatus: "shipped", tracking: { trackingNumber: "NEW" } });
    await call({ tracking: { trackingNumber: "NEW" } });
    expect(sendStatusEmail).not.toHaveBeenCalled();
    await call({ tracking: { trackingNumber: "NEW" }, notify: true });
    expect(sendStatusEmail).toHaveBeenCalledTimes(1);
  });
});
