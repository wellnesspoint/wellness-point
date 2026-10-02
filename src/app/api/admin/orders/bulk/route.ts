import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { calcOrderTotal } from "@/lib/order-math";
import { sendOrderStatusEmail } from "@/lib/email";
import { ORDER_STATUS_TRANSITIONS, canTransition, type OrderStatus } from "@/lib/order-status";

const MAX_BULK = 100;
// Cancelling and refunding move money and stock, so they stay one-at-a-time.
const BULK_TARGETS: OrderStatus[] = ["confirmed", "shipped", "delivered"];

/**
 * PATCH /api/admin/orders/bulk  { ids: string[], orderStatus: "confirmed"|"shipped"|"delivered" }
 *
 * Moves many orders forward at once. Each order is checked individually against
 * the normal transition rules and only PAID orders move; anything else is
 * reported back as skipped. Shipped/delivered customers are emailed.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await checkAdmin("orders", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;
    const target = body?.orderStatus as OrderStatus;

    if (!BULK_TARGETS.includes(target)) {
      return NextResponse.json(
        { error: "Bulk actions support: confirmed, shipped, delivered" },
        { status: 400 }
      );
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK ||
      !ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))
    ) {
      return NextResponse.json(
        { error: `Select between 1 and ${MAX_BULK} orders` },
        { status: 400 }
      );
    }

    await connectDB();
    const actorName = session.user.name || session.user.email;
    const orders = await Order.find({ _id: { $in: ids } }).populate("user", "name email");

    const updated: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    let emailed = 0;

    for (const order of orders) {
      const id = order._id.toString();
      if (order.paymentStatus !== "paid") {
        skipped.push({ id, reason: "not a paid order" });
        continue;
      }
      if (order.orderStatus === target) {
        skipped.push({ id, reason: `already ${target}` });
        continue;
      }
      if (!canTransition<OrderStatus>(ORDER_STATUS_TRANSITIONS, order.orderStatus, target)) {
        skipped.push({ id, reason: `can't go from ${order.orderStatus} to ${target}` });
        continue;
      }

      // Conditional on the status we just checked, so a concurrent change isn't overwritten.
      const result = await Order.updateOne(
        { _id: order._id, orderStatus: order.orderStatus },
        {
          $set: { orderStatus: target },
          $push: {
            statusHistory: {
              field: "orderStatus",
              from: order.orderStatus,
              to: target,
              by: actorName,
              at: new Date(),
            },
          },
        }
      );
      if (result.modifiedCount !== 1) {
        skipped.push({ id, reason: "changed by someone else" });
        continue;
      }
      updated.push(id);

      if (target === "shipped" || target === "delivered") {
        const customer = order.user as unknown as { name?: string; email?: string } | undefined;
        const email = order.shippingAddress?.email || customer?.email;
        if (email) {
          try {
            await sendOrderStatusEmail({
              type: target,
              customerName: order.shippingAddress?.fullName || customer?.name || "Customer",
              customerEmail: email,
              orderId: id,
              total: calcOrderTotal(order),
              tracking: order.tracking,
            });
            emailed++;
          } catch (err) {
            console.error("Bulk status email failed:", err);
          }
        }
      }
    }

    if (updated.length > 0) {
      await logAudit(session, {
        action: "order.bulk_update",
        entity: "order",
        summary: `Bulk-marked ${updated.length} order(s) ${target}${skipped.length ? ` (${skipped.length} skipped)` : ""}`,
        meta: { ids: updated, target },
      });
    }

    return NextResponse.json({ updated, skipped, emailed });
  } catch (error) {
    console.error("Bulk order update error:", error);
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 });
  }
}
