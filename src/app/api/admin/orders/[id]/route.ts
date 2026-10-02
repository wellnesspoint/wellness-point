import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import razorpay from "@/lib/razorpay";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { incrementStock } from "@/lib/stock-ops";
import { trackingUrlFor } from "@/lib/couriers";
import { calcOrderTotal } from "@/lib/order-math";
import { sendOrderStatusEmail, type OrderStatusEmailType } from "@/lib/email";
import { checkLowStock, logStockMovements } from "@/lib/stock";
import {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_TRANSITIONS,
  canTransition,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

interface Tracking {
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/** Validate the tracking block; returns the cleaned object or an error message. */
function parseTracking(input: any): { tracking: Tracking } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid tracking details" };
  const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const tracking: Tracking = {
    courier: clean(input.courier, 80),
    trackingNumber: clean(input.trackingNumber, 80),
    trackingUrl: clean(input.trackingUrl, 500),
  };
  if (tracking.trackingUrl && !/^https:\/\//i.test(tracking.trackingUrl)) {
    return { error: "Tracking URL must start with https://" };
  }
  // Known courier + number but no link given: build the courier's public tracking link.
  if (!tracking.trackingUrl) {
    const built = trackingUrlFor(tracking.courier, tracking.trackingNumber);
    if (built) tracking.trackingUrl = built;
  }
  return { tracking };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin("orders", "manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const body = await request.json();
    const updateFields: any = {};
    const actorName = session.user.name || session.user.email;

    if (body.orderStatus) {
      if (!ORDER_STATUSES.includes(body.orderStatus)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      updateFields.orderStatus = body.orderStatus;
    }

    if (body.paymentStatus) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
      }
      updateFields.paymentStatus = body.paymentStatus;
    }

    if (body.notes !== undefined) {
      updateFields.notes = String(body.notes).slice(0, 2000);
    }

    let trackingChanged = false;
    if (body.tracking !== undefined) {
      const parsed = parseTracking(body.tracking);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      updateFields.tracking = parsed.tracking;
    }

    const existing = await Order.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (updateFields.tracking) {
      const before = existing.tracking || {};
      trackingChanged =
        (before.courier || "") !== updateFields.tracking.courier ||
        (before.trackingNumber || "") !== updateFields.tracking.trackingNumber ||
        (before.trackingUrl || "") !== updateFields.tracking.trackingUrl;
    }

    // "paid" can only be reached through a verified Razorpay payment (verify
    // endpoint / webhook) — the transition map has no edge into it.
    if (
      updateFields.orderStatus &&
      !canTransition<OrderStatus>(
        ORDER_STATUS_TRANSITIONS,
        existing.orderStatus,
        updateFields.orderStatus
      )
    ) {
      return NextResponse.json(
        { error: `Cannot change order status from ${existing.orderStatus} to ${updateFields.orderStatus}` },
        { status: 400 }
      );
    }
    if (
      updateFields.paymentStatus &&
      !canTransition<PaymentStatus>(
        PAYMENT_STATUS_TRANSITIONS,
        existing.paymentStatus,
        updateFields.paymentStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            updateFields.paymentStatus === "paid"
              ? "Orders can only become paid through a verified payment"
              : `Cannot change payment status from ${existing.paymentStatus} to ${updateFields.paymentStatus}`,
        },
        { status: 400 }
      );
    }

    const enteringCancelled =
      updateFields.orderStatus === "cancelled" && existing.orderStatus !== "cancelled";
    const enteringRefunded =
      updateFields.paymentStatus === "refunded" && existing.paymentStatus !== "refunded";
    // Marking refunded sends real money back via Razorpay, so it needs the refunds permission.
    if (enteringRefunded && !can(session.user.adminRole, "refunds", "manage")) {
      return NextResponse.json(
        { error: "Your role is not allowed to issue refunds" },
        { status: 403 }
      );
    }
    const orderStatusChanged =
      !!updateFields.orderStatus && updateFields.orderStatus !== existing.orderStatus;
    const paymentStatusChanged =
      !!updateFields.paymentStatus && updateFields.paymentStatus !== existing.paymentStatus;

    let remainingToRefund = calcOrderTotal(existing);

    // Marking an order refunded must actually return the money — previously
    // this only flipped a flag, so the customer was never paid back. The
    // gateway call happens first: if it fails, nothing is changed.
    if (enteringRefunded) {
      if (!existing.razorpayPaymentId) {
        return NextResponse.json(
          { error: "This order has no Razorpay payment to refund" },
          { status: 400 }
        );
      }
      // After a partial refund only the remainder is refundable.
      const refundedSoFar = existing.refundedAmount || 0;
      remainingToRefund = Math.round((calcOrderTotal(existing) - refundedSoFar) * 100) / 100;
      try {
        await razorpay.payments.refund(existing.razorpayPaymentId, {
          ...(refundedSoFar > 0 && { amount: Math.round(remainingToRefund * 100) }),
          speed: "normal",
          notes: { reason: "Refunded by admin", orderId: id },
        });
      } catch (refundErr: any) {
        const description: string = refundErr?.error?.description || "";
        // A double-click / retry after a successful refund is not a failure.
        if (!/fully refunded|already.*refund/i.test(description)) {
          console.error("Admin refund failed:", refundErr);
          return NextResponse.json(
            { error: `Razorpay refund failed${description ? `: ${description}` : ""}` },
            { status: 502 }
          );
        }
      }
    }

    // Stock was only ever taken for PAID orders — pending/failed orders never
    // decremented it (or already rolled it back), so "restoring" it there would
    // inflate inventory. The restore is claimed atomically (stockRestored flips
    // false -> true exactly once) so a double-click can't credit it twice.
    if ((enteringCancelled || enteringRefunded) && existing.paymentStatus === "paid") {
      const claimed = await Order.findOneAndUpdate(
        { _id: id, stockRestored: { $ne: true } },
        { $set: { stockRestored: true } }
      );
      if (claimed) {
        for (const item of existing.items) {
          await incrementStock({
            product: item.product,
            variantId: item.variantId,
            quantity: item.quantity,
          });
        }
        await logStockMovements(
          existing.items.map((item) => ({
            product: item.product,
            variantId: item.variantId,
            variantName: item.variantName,
            delta: item.quantity,
            reason: enteringRefunded ? ("refund" as const) : ("cancel" as const),
            order: existing._id,
            actorName,
          }))
        );
        await checkLowStock(); // re-arms alerts for restocked products
      }
    }

    // Append who/when to the order's status trail.
    const history: { field: string; from: string; to: string; by?: string; at: Date }[] = [];
    if (orderStatusChanged) {
      history.push({ field: "orderStatus", from: existing.orderStatus, to: updateFields.orderStatus, by: actorName, at: new Date() });
    }
    if (paymentStatusChanged) {
      history.push({ field: "paymentStatus", from: existing.paymentStatus, to: updateFields.paymentStatus, by: actorName, at: new Date() });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      {
        $set: updateFields,
        ...(history.length > 0 && { $push: { statusHistory: { $each: history } } }),
      },
      { new: true }
    ).populate("user", "name email");

    // ── Audit trail ──
    const ref = `#${id.slice(-8).toUpperCase()}`;
    const changes: string[] = history.map((h) => `${h.field} ${h.from} → ${h.to}`);
    if (trackingChanged) changes.push("tracking updated");
    if (updateFields.notes !== undefined && updateFields.notes !== (existing.notes || "")) changes.push("notes edited");
    if (changes.length > 0) {
      await logAudit(session, {
        action: enteringRefunded ? "order.refund" : "order.update",
        entity: "order",
        entityId: id,
        summary: `Order ${ref}: ${changes.join(", ")}`,
        meta: { amount: enteringRefunded ? remainingToRefund : undefined, tracking: trackingChanged ? updateFields.tracking : undefined },
      });
    }

    // ── Customer emails (best-effort; awaited because serverless freezes after the response) ──
    const customer = order?.user as { name?: string; email?: string } | undefined;
    const customerEmail = existing.shippingAddress?.email || customer?.email || "";
    const customerName = existing.shippingAddress?.fullName || customer?.name || "Customer";
    // Failed/never-paid orders were already communicated at checkout.
    const wasPaid =
      existing.paymentStatus === "paid" ||
      existing.paymentStatus === "refunded" ||
      (existing.paymentStatus === "failed" && enteringRefunded); // retried failed auto-refund
    const emailTypes: OrderStatusEmailType[] = [];
    if (wasPaid) {
      if (orderStatusChanged && ["shipped", "delivered", "cancelled"].includes(updateFields.orderStatus)) {
        emailTypes.push(updateFields.orderStatus);
      }
      if (enteringRefunded) emailTypes.push("refunded");
      // Tracking added/changed on an already-shipped order: re-send only when the admin asks.
      if (
        emailTypes.length === 0 &&
        trackingChanged &&
        body.notify === true &&
        (order?.orderStatus === "shipped")
      ) {
        emailTypes.push("shipped");
      }
    }
    let emailed = false;
    for (const type of emailTypes) {
      try {
        await sendOrderStatusEmail({
          type,
          customerName,
          customerEmail,
          orderId: id,
          total: type === "refunded" ? remainingToRefund : calcOrderTotal(existing),
          tracking: order?.tracking as Tracking | undefined,
        });
        emailed = true;
      } catch (emailErr) {
        console.error(`Order ${type} email failed:`, emailErr);
      }
    }

    return NextResponse.json({ order, emailed });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin("orders", "view");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const order = await Order.findById(id).populate("user", "name email");
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
