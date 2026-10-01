/**
 * Legal admin transitions. Without these, a delivered order could be pushed
 * back to "processing", or a cancelled one re-opened (after its stock had
 * already been returned to inventory, so it would ship un-reserved).
 *
 * "paid" is deliberately absent as a target: it is only reachable through a
 * verified Razorpay payment (verify endpoint / webhook).
 */
export type OrderStatus = "processing" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export const ORDER_STATUSES: OrderStatus[] = [
  "processing",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];
export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  processing: ["confirmed", "shipped", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["failed"],
  // A "failed" order is one whose payment was captured but the automatic refund
  // failed: marking it refunded retries the Razorpay refund (already-refunded counts as success).
  failed: ["refunded"],
  paid: ["refunded"],
  refunded: [],
};

/** Statuses selectable from `current` (always includes `current` itself). */
export function allowedNext<T extends string>(
  map: Record<T, T[]>,
  current: T,
  all: T[]
): T[] {
  const next = map[current] || [];
  return all.filter((s) => s === current || next.includes(s));
}

export function canTransition<T extends string>(
  map: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  return from === to || (map[from] || []).includes(to);
}
