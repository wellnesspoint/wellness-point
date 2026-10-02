/**
 * Shiprocket integration (https://apiv2.shiprocket.in): creates the shipment for a paid
 * order, assigns a courier/AWB, and returns the tracking details the admin panel stores.
 *
 * Opt-in: inactive until SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD (an API user created
 * in Shiprocket -> Settings -> API) are set. Optional:
 *   SHIPROCKET_PICKUP_LOCATION   nickname of the pickup address in Shiprocket (default "Primary")
 *   SHIPROCKET_WEIGHT_KG         parcel weight when products have no weight (default 0.5)
 *   SHIPROCKET_LENGTH_CM / _BREADTH_CM / _HEIGHT_CM   parcel size (default 10 x 10 x 10)
 */
const BASE = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_TTL_MS = 8 * 24 * 60 * 60 * 1000; // Shiprocket tokens last 10 days

let tokenCache: { token: string; at: number } | null = null;

export function isShiprocketConfigured(): boolean {
  return !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

export class ShiprocketError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ShiprocketError";
  }
}

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers || {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ShiprocketError("Could not reach Shiprocket. Try again in a moment.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    let message = `Shiprocket returned ${res.status}`;
    if (typeof data.message === "string" && data.message) message = data.message;
    else if (data.errors) message = JSON.stringify(data.errors);
    throw new ShiprocketError(message.slice(0, 300), res.status);
  }
  return data as T;
}

async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;
  if (!isShiprocketConfigured()) throw new ShiprocketError("Shiprocket is not configured");
  const data = await api<{ token?: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
  });
  if (!data.token) throw new ShiprocketError("Shiprocket login failed: check the API user's email and password");
  tokenCache = { token: data.token, at: Date.now() };
  return data.token;
}

/** Call with the cached token; if Shiprocket says the token is invalid, log in again once. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await api<T>(path, { ...init, token: await getToken() });
  } catch (err) {
    if (err instanceof ShiprocketError && err.status === 401) {
      return api<T>(path, { ...init, token: await getToken(true) });
    }
    throw err;
  }
}

export interface ShipmentOrder {
  _id: string;
  createdAt: string | Date;
  items: { name: string; quantity: number; price: number; sku?: string }[];
  shippingAddress?: {
    fullName?: string;
    email?: string;
    phone?: string;
    street?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  subtotal: number;
  discount?: number;
  shipping?: number;
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** The body for Shiprocket's "create custom order" call. Pure, so it can be unit-tested. */
export function buildShiprocketOrder(order: ShipmentOrder, totalWeightKg?: number) {
  const a = order.shippingAddress || {};
  const orderId = `WP-${order._id.slice(-8).toUpperCase()}`;
  const [firstName, ...rest] = String(a.fullName || "Customer").trim().split(/\s+/);
  const itemsTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    order_id: orderId,
    order_date: new Date(order.createdAt).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    billing_customer_name: firstName,
    billing_last_name: rest.join(" "),
    billing_address: String(a.street || "").slice(0, 190),
    billing_address_2: String(a.addressLine2 || "").slice(0, 190),
    billing_city: a.city || "",
    billing_pincode: a.pincode || "",
    billing_state: a.state || "",
    billing_country: "India",
    billing_email: a.email || "",
    billing_phone: String(a.phone || "").replace(/\D/g, "").slice(-10),
    shipping_is_billing: true,
    order_items: order.items.map((i, idx) => ({
      name: i.name,
      sku: i.sku || `${orderId}-${idx + 1}`,
      units: i.quantity,
      selling_price: i.price,
    })),
    // Orders are prepaid (Razorpay); shipping and discount are carried in the totals.
    payment_method: "Prepaid",
    shipping_charges: order.shipping || 0,
    total_discount: order.discount || 0,
    sub_total: Math.round(itemsTotal * 100) / 100,
    length: num(process.env.SHIPROCKET_LENGTH_CM, 10),
    breadth: num(process.env.SHIPROCKET_BREADTH_CM, 10),
    height: num(process.env.SHIPROCKET_HEIGHT_CM, 10),
    weight: totalWeightKg && totalWeightKg > 0 ? totalWeightKg : num(process.env.SHIPROCKET_WEIGHT_KG, 0.5),
  };
}

export interface CreatedShipment {
  shiprocketOrderId: number;
  shipmentId: number;
  awb?: string;
  courier?: string;
  trackingUrl?: string;
}

/**
 * Creates the order in Shiprocket and asks it to assign the best courier + AWB.
 * If the courier step fails (for example no serviceable courier for that pincode) the
 * order still exists in Shiprocket, and the result has no `awb`: the admin finishes it there.
 */
export async function createShipment(order: ShipmentOrder, totalWeightKg?: number): Promise<CreatedShipment> {
  const payload = buildShiprocketOrder(order, totalWeightKg);
  const created = await authed<{ order_id?: number; shipment_id?: number }>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!created.order_id || !created.shipment_id) {
    throw new ShiprocketError("Shiprocket did not return a shipment id");
  }
  const result: CreatedShipment = { shiprocketOrderId: created.order_id, shipmentId: created.shipment_id };

  try {
    const awb = await authed<{
      response?: { data?: { awb_code?: string; courier_name?: string } };
      awb_assign_status?: number;
    }>("/courier/assign/awb", { method: "POST", body: JSON.stringify({ shipment_id: created.shipment_id }) });
    const d = awb.response?.data;
    if (d?.awb_code) {
      result.awb = d.awb_code;
      result.courier = d.courier_name;
      result.trackingUrl = `https://shiprocket.co/tracking/${encodeURIComponent(d.awb_code)}`;
    }
  } catch (err) {
    console.error("Shiprocket AWB assignment failed:", err);
  }
  return result;
}
