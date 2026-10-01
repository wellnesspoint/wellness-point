/**
 * Single source of truth for order money maths. Stats, reports, the customer
 * detail view, the orders/payments pages and invoices all used to recompute
 * this on their own (one of them from the stored `total`), so figures could
 * disagree. Totals are always derived from the line items.
 */
interface PricedItem {
  price?: number;
  quantity?: number;
}

interface OrderLike {
  items?: PricedItem[];
  shipping?: number;
  discount?: number;
}

export function calcOrderSubtotal(order: Pick<OrderLike, "items">): number {
  return (order.items || []).reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );
}

export function calcOrderTotal(order: OrderLike): number {
  return calcOrderSubtotal(order) + (order.shipping || 0) - (order.discount || 0);
}
