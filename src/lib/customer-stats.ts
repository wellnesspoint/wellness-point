import Order from "@/models/Order";
import { ORDER_NET_EXPR } from "./order-pipeline";

export interface CustomerStats {
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: Date;
}

/**
 * Lifetime stats for a set of customers in ONE aggregation (no per-customer
 * queries). Abandoned checkouts don't count as orders; spend is paid orders
 * net of partial refunds.
 */
export async function getCustomerStats(userIds: unknown[]): Promise<Map<string, CustomerStats>> {
  const stats = new Map<string, CustomerStats>();
  if (userIds.length === 0) return stats;

  const rows = await Order.aggregate([
    { $match: { user: { $in: userIds }, paymentStatus: { $ne: "pending" } } },
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        totalSpent: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, ORDER_NET_EXPR, 0] },
        },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);

  for (const r of rows) {
    stats.set(String(r._id), {
      orderCount: r.orderCount,
      totalSpent: Math.round(r.totalSpent * 100) / 100,
      lastOrderAt: r.lastOrderAt,
    });
  }
  return stats;
}
