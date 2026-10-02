import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const order = {
  _id: "64b0000000000000000000ab",
  createdAt: "2026-10-02T06:30:00.000Z",
  items: [
    { name: "Whey – 1kg", quantity: 2, price: 900 },
    { name: "Omega-3", quantity: 1, price: 400 },
  ],
  shippingAddress: {
    fullName: "Asha Rao Kumar",
    email: "asha@x.test",
    phone: "+91 98765-43210",
    street: "12 MG Road",
    addressLine2: "Near park",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  },
  subtotal: 2200,
  discount: 100,
  shipping: 50,
};

function mockFetch(handler: (url: string, init: RequestInit) => unknown) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const r = handler(url, init) as { status?: number; json: unknown };
      return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
    })
  );
  return calls;
}

describe("shiprocket client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SHIPROCKET_EMAIL", "api@x.test");
    vi.stubEnv("SHIPROCKET_PASSWORD", "pw");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is only configured when both credentials are set", async () => {
    const { isShiprocketConfigured } = await import("@/lib/shiprocket");
    expect(isShiprocketConfigured()).toBe(true);
    vi.stubEnv("SHIPROCKET_PASSWORD", "");
    expect(isShiprocketConfigured()).toBe(false);
  });

  it("builds the order body: prepaid, 10-digit phone, split name, totals and item lines", async () => {
    const { buildShiprocketOrder } = await import("@/lib/shiprocket");
    const b = buildShiprocketOrder(order, 1.25);
    expect(b).toMatchObject({
      order_id: expect.stringMatching(/^WP-[0-9A-F]{8}$/),
      payment_method: "Prepaid",
      billing_customer_name: "Asha",
      billing_last_name: "Rao Kumar",
      billing_phone: "9876543210",
      billing_pincode: "560001",
      shipping_charges: 50,
      total_discount: 100,
      sub_total: 2200,
      weight: 1.25,
      pickup_location: "Primary",
    });
    expect(b.order_items).toHaveLength(2);
    expect(b.order_items[0]).toMatchObject({ name: "Whey – 1kg", units: 2, selling_price: 900 });
  });

  it("uses the default weight when none is given and honours env overrides", async () => {
    vi.stubEnv("SHIPROCKET_WEIGHT_KG", "0.8");
    vi.stubEnv("SHIPROCKET_PICKUP_LOCATION", "Warehouse");
    const { buildShiprocketOrder } = await import("@/lib/shiprocket");
    const b = buildShiprocketOrder(order);
    expect(b.weight).toBe(0.8);
    expect(b.pickup_location).toBe("Warehouse");
  });

  it("logs in, creates the order, assigns an AWB and returns the tracking link", async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith("/auth/login")) return { json: { token: "TKN" } };
      if (url.endsWith("/orders/create/adhoc")) return { json: { order_id: 11, shipment_id: 22 } };
      if (url.endsWith("/courier/assign/awb"))
        return { json: { response: { data: { awb_code: "AWB123", courier_name: "Delhivery" } } } };
      return { status: 404, json: {} };
    });
    const { createShipment } = await import("@/lib/shiprocket");
    const r = await createShipment(order, 1);
    expect(r).toEqual({
      shiprocketOrderId: 11,
      shipmentId: 22,
      awb: "AWB123",
      courier: "Delhivery",
      trackingUrl: "https://shiprocket.co/tracking/AWB123",
    });
    expect(calls[0].body).toEqual({ email: "api@x.test", password: "pw" });
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer TKN");
    expect(calls[2].body).toEqual({ shipment_id: 22 });
  });

  it("still returns the shipment (without an AWB) when courier assignment fails", async () => {
    mockFetch((url) => {
      if (url.endsWith("/auth/login")) return { json: { token: "T" } };
      if (url.endsWith("/orders/create/adhoc")) return { json: { order_id: 1, shipment_id: 2 } };
      return { status: 422, json: { message: "No courier serviceable" } };
    });
    const { createShipment } = await import("@/lib/shiprocket");
    const r = await createShipment(order);
    expect(r).toMatchObject({ shiprocketOrderId: 1, shipmentId: 2 });
    expect(r.awb).toBeUndefined();
  });

  it("re-authenticates once when Shiprocket answers 401 (expired token)", async () => {
    let logins = 0;
    let created = 0;
    mockFetch((url) => {
      if (url.endsWith("/auth/login")) {
        logins++;
        return { json: { token: `T${logins}` } };
      }
      if (url.endsWith("/orders/create/adhoc")) {
        created++;
        return created === 1 ? { status: 401, json: { message: "Unauthenticated" } } : { json: { order_id: 5, shipment_id: 6 } };
      }
      return { json: { response: { data: {} } } };
    });
    const { createShipment } = await import("@/lib/shiprocket");
    const r = await createShipment(order);
    expect(r.shipmentId).toBe(6);
    expect(logins).toBe(2);
  });

  it("surfaces Shiprocket's error message", async () => {
    mockFetch((url) =>
      url.endsWith("/auth/login") ? { json: { token: "T" } } : { status: 422, json: { message: "Pickup location not found" } }
    );
    const { createShipment, ShiprocketError } = await import("@/lib/shiprocket");
    await expect(createShipment(order)).rejects.toThrow("Pickup location not found");
    await expect(createShipment(order)).rejects.toBeInstanceOf(ShiprocketError);
  });
});

// --- route ---------------------------------------------------------------------
describe("POST /api/admin/orders/[id]/shipment", () => {
  const ID = "64b0000000000000000000ab";
  const checkAdmin = vi.fn();
  const orderFindById = vi.fn();
  const orderClaim = vi.fn();
  const orderUpdateOne = vi.fn(async (..._a: unknown[]) => ({}));
  const createShipment = vi.fn();

  async function load() {
    vi.resetModules();
    vi.doMock("@/lib/admin", () => ({
      checkAdmin: (...a: unknown[]) => checkAdmin(...a),
      unauthorizedResponse: () => new Response("{}", { status: 403 }),
    }));
    vi.doMock("@/lib/db", () => ({ default: async () => {} }));
    vi.doMock("@/lib/audit", () => ({ logAudit: async () => {} }));
    vi.doMock("@/models/Product", () => ({
      default: { find: () => ({ select: () => ({ lean: async () => [{ _id: "p1", weight: 500 }] }) }) },
    }));
    vi.doMock("@/models/Order", () => ({
      default: {
        findById: () => ({ select: () => ({ lean: async () => orderFindById() }) }),
        findOneAndUpdate: (...a: unknown[]) => orderClaim(...a),
        updateOne: (...a: unknown[]) => orderUpdateOne(...a),
      },
    }));
    vi.doMock("@/lib/shiprocket", () => ({
      isShiprocketConfigured: () => true,
      ShiprocketError: class extends Error {},
      createShipment: (...a: unknown[]) => createShipment(...a),
    }));
    return (await import("@/app/api/admin/orders/[id]/shipment/route")).POST;
  }
  const call = (POST: Awaited<ReturnType<typeof load>>) =>
    POST(new NextRequest("http://x.test/s", { method: "POST" }), { params: Promise.resolve({ id: ID }) });

  beforeEach(() => {
    checkAdmin.mockReset().mockResolvedValue({ user: { id: "a", email: "a@x", name: "A", adminRole: "manager" } });
    orderFindById.mockReset().mockReturnValue({ paymentStatus: "paid", orderStatus: "processing" });
    orderClaim.mockReset().mockResolvedValue({
      _id: ID,
      createdAt: new Date(),
      items: [{ product: "p1", name: "N", quantity: 2, price: 100 }],
      shippingAddress: {},
      subtotal: 200,
    });
    orderUpdateOne.mockClear();
    createShipment.mockReset();
  });

  it("requires manage access on orders", async () => {
    checkAdmin.mockResolvedValue(null);
    expect((await call(await load())).status).toBe(403);
    expect(checkAdmin).toHaveBeenCalledWith("orders", "manage");
  });

  it("refuses unpaid and cancelled orders", async () => {
    orderFindById.mockReturnValue({ paymentStatus: "pending", orderStatus: "processing" });
    expect((await call(await load())).status).toBe(400);
    orderFindById.mockReturnValue({ paymentStatus: "paid", orderStatus: "cancelled" });
    expect((await call(await load())).status).toBe(400);
  });

  it("returns 409 when the order was already claimed (double click)", async () => {
    orderClaim.mockResolvedValue(null);
    expect((await call(await load())).status).toBe(409);
    expect(createShipment).not.toHaveBeenCalled();
  });

  it("saves the AWB and tracking, using product weights in kg", async () => {
    createShipment.mockResolvedValue({
      shiprocketOrderId: 1, shipmentId: 2, awb: "A1", courier: "DTDC", trackingUrl: "https://shiprocket.co/tracking/A1",
    });
    const res = await call(await load());
    expect(res.status).toBe(200);
    expect(createShipment.mock.calls[0][1]).toBe(1); // 2 x 500 g = 1 kg
    const [, update] = orderUpdateOne.mock.calls[0] as [unknown, { $set: any }];
    expect(update.$set.tracking).toEqual({ courier: "DTDC", trackingNumber: "A1", trackingUrl: "https://shiprocket.co/tracking/A1" });
    expect(update.$set.shipment).toMatchObject({ provider: "shiprocket", shipmentId: 2, awb: "A1" });
  });

  it("releases the claim when Shiprocket fails so the admin can retry", async () => {
    createShipment.mockRejectedValue(new Error("boom"));
    const res = await call(await load());
    expect(res.status).toBe(500);
    expect(orderUpdateOne).toHaveBeenCalledWith(
      { _id: ID, "shipment.creating": true },
      { $unset: { shipment: "" } }
    );
  });
});
