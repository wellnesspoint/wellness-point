import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import razorpay from "@/lib/razorpay";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { calcOrderTotal } from "@/lib/order-math";
import { sendOrderStatusEmail } from "@/lib/email";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * POST /api/admin/orders/[id]/refund { amount, reason? }
 *
 * Partial refund through Razorpay (e.g. a damaged item, a goodwill gesture).
 * Stock is NOT restored — the goods may not come back. To refund whatever is
 * left (and restore stock), set the order's payment status to Refunded instead.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = round2(Number(body.amount));
    const reason = String(body.reason ?? "").trim().slice(0, 200);
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: "Enter an amount of at least ₹1" }, { status: 400 });
    }

    await connectDB();
    const order = await Order.findById(id).populate("user", "name email");
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Only paid orders can be partially refunded" }, { status: 400 });
    }
    if (!order.razorpayPaymentId) {
      return NextResponse.json({ error: "This order has no Razorpay payment to refund" }, { status: 400 });
    }

    const total = calcOrderTotal(order);
    const remaining = round2(total - (order.refundedAmount || 0));
    if (amount >= remaining) {
      return NextResponse.json(
        {
          error: `That is the full remaining amount (₹${remaining}). Use Payment status → Refunded instead; it also restores stock.`,
        },
        { status: 400 }
      );
    }

    // Take the amount against the order first (conditional on the refunded total we
    // just read), so a double-click can't refund more than the order is worth.
    const reserved = await Order.findOneAndUpdate(
      { _id: id, paymentStatus: "paid", refundedAmount: order.refundedAmount || 0 },
      { $inc: { refundedAmount: amount } },
      { new: true }
    );
    if (!reserved) {
      return NextResponse.json(
        { error: "The order changed while refunding. Reload and try again." },
        { status: 409 }
      );
    }

    let refund;
    try {
      refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: Math.round(amount * 100),
        speed: "normal",
        notes: { reason: reason || "Partial refund by admin", orderId: id },
      });
    } catch (err: any) {
      // Roll the reservation back; nothing was refunded.
      await Order.updateOne({ _id: id }, { $inc: { refundedAmount: -amount } });
      const description: string = err?.error?.description || "";
      console.error("Partial refund failed:", err);
      return NextResponse.json(
        { error: `Razorpay refund failed${description ? `: ${description}` : ""}` },
        { status: 502 }
      );
    }

    const actorName = session.user.name || session.user.email;
    await Order.updateOne(
      { _id: id },
      {
        $push: {
          refunds: {
            amount,
            razorpayRefundId: (refund as any)?.id,
            reason,
            by: actorName,
            at: new Date(),
          },
        },
      }
    );

    await logAudit(session, {
      action: "order.partial_refund",
      entity: "order",
      entityId: id,
      summary: `Order #${id.slice(-8).toUpperCase()}: partially refunded ₹${amount}${reason ? ` (${reason})` : ""}`,
      meta: { amount, reason },
    });

    const customer = order.user as unknown as { name?: string; email?: string } | undefined;
    const email = order.shippingAddress?.email || customer?.email;
    let emailed = false;
    if (email) {
      try {
        await sendOrderStatusEmail({
          type: "refunded",
          customerName: order.shippingAddress?.fullName || customer?.name || "Customer",
          customerEmail: email,
          orderId: id,
          total: amount,
        });
        emailed = true;
      } catch (err) {
        console.error("Partial refund email failed:", err);
      }
    }

    const fresh = await Order.findById(id).select("refunds refundedAmount");
    return NextResponse.json({
      refunds: fresh?.refunds ?? [],
      refundedAmount: fresh?.refundedAmount ?? amount,
      emailed,
    });
  } catch (error) {
    console.error("Partial refund error:", error);
    return NextResponse.json({ error: "Failed to refund" }, { status: 500 });
  }
}
