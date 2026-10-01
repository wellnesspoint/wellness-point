import Order from "@/models/Order";
import { sendAbandonedCartEmail } from "./email";

/** A checkout younger than this may still be in progress. */
export const MIN_AGE_MS = 60 * 60 * 1000;
/** Pending orders are purged by a TTL index after 7 days (see models/Order). */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Pending checkouts old enough to count as abandoned and still recoverable. */
export function abandonedFilter(now = new Date()) {
  return {
    paymentStatus: "pending",
    finalizing: { $ne: true },
    createdAt: {
      $lt: new Date(now.getTime() - MIN_AGE_MS),
      $gt: new Date(now.getTime() - MAX_AGE_MS),
    },
    "shippingAddress.email": { $exists: true, $ne: "" },
  };
}

export interface ReminderResult {
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Email a "complete your order" reminder. One email per customer (their most
 * recent abandoned checkout); the customer's other pending rows are marked as
 * handled, and nobody is emailed who has since paid for another order or was
 * already reminded. Pass `ids` to limit to specific orders (admin "Send").
 */
export async function sendAbandonedReminders(opts: {
  ids?: string[];
  couponCode?: string;
  limit?: number;
}): Promise<ReminderResult> {
  const filter: Record<string, unknown> = {
    ...abandonedFilter(),
    reminderSentAt: { $exists: false },
  };
  if (opts.ids) filter._id = { $in: opts.ids };

  const orders = await Order.find(filter)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 200);

  const result: ReminderResult = { sent: 0, skipped: 0, failed: 0 };
  const handledUsers = new Set<string>();

  for (const order of orders) {
    const userId = String((order.user as any)?._id ?? order.user);
    const markDone = () =>
      Order.updateOne({ _id: order._id }, { $set: { reminderSentAt: new Date() } });

    // Newest-first, so the first row for a user is the one we email.
    if (handledUsers.has(userId)) {
      await markDone();
      result.skipped++;
      continue;
    }
    handledUsers.add(userId);

    // They came back and paid for something since — nothing to recover.
    const paidSince = await Order.exists({
      user: (order.user as any)?._id ?? order.user,
      paymentStatus: "paid",
      createdAt: { $gt: order.createdAt },
    });
    if (paidSince) {
      await markDone();
      result.skipped++;
      continue;
    }

    try {
      await sendAbandonedCartEmail({
        customerName: order.shippingAddress?.fullName || (order.user as any)?.name || "there",
        customerEmail: order.shippingAddress!.email!,
        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        total: order.total,
        couponCode: opts.couponCode,
      });
      await markDone();
      result.sent++;
    } catch (err) {
      console.error("Abandoned-cart email failed:", err);
      result.failed++;
    }
  }
  return result;
}
