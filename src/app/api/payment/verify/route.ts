import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import razorpay, { verifyRazorpaySignature } from "@/lib/razorpay";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { validateShippingAddress } from "@/lib/utils";
import { finalizeOrder } from "@/lib/order-finalize";

/**
 * POST /api/payment/verify
 *
 * Browser callback after the Razorpay widget succeeds. Verifies the payment
 * and finalizes the matching "pending" Order created by /create-order.
 *
 * Security model:
 * 1. The HMAC signature proves Razorpay issued this payment_id for this order_id.
 * 2. We fetch the payment from Razorpay and confirm it was captured for the
 *    SAME amount as the total locked in at create-order — client data is never
 *    trusted for pricing.
 * 3. finalizeOrder() takes an atomic claim on the order, so concurrent calls
 *    (double-click, retry, or the webhook racing us) can't double-decrement
 *    stock or send duplicate emails.
 *
 * /api/payment/webhook performs the same finalization server-to-server, so an
 * order is completed even if the customer closes the tab right after paying.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } =
      await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      user: (session.user as any).id,
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found. Please start checkout again." },
        { status: 400 }
      );
    }

    // Idempotent replay (or the webhook already finished it).
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ success: true, order: { _id: order._id } });
    }

    if (order.paymentStatus !== "pending") {
      return NextResponse.json(
        {
          error:
            "This order could not be completed automatically. Our team has been notified — please contact support with your payment ID.",
        },
        { status: 409 }
      );
    }

    // Cross-check what Razorpay actually captured against our locked-in total.
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (err) {
      console.error("Failed to fetch Razorpay payment:", err);
      return NextResponse.json(
        { error: "Could not confirm payment with Razorpay. Please try again." },
        { status: 502 }
      );
    }

    const expectedAmountPaise = Math.round(order.total * 100);
    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      Number(payment.amount) !== expectedAmountPaise
    ) {
      console.error("Payment amount/status mismatch", {
        orderId: order._id.toString(),
        expectedAmountPaise,
        payment,
      });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });
    }

    // Prefer the address the client resends (it may have been corrected); fall
    // back to the one validated and stored at create-order time.
    let address: Record<string, string> | undefined;
    if (orderData?.shippingAddress) {
      const validated = validateShippingAddress(orderData.shippingAddress);
      if (!validated.valid) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      address = validated.address;
    }

    const result = await finalizeOrder({
      orderId: order._id.toString(),
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      address,
      customerFallbackName: session.user?.name || undefined,
      customerFallbackEmail: session.user?.email || undefined,
    });

    switch (result.status) {
      case "paid":
      case "already_paid":
        return NextResponse.json({ success: true, order: { _id: order._id } });
      case "busy":
        // The webhook (or a parallel request) is finishing this order right now.
        return NextResponse.json(
          { error: "Your payment is being processed. Please check your orders in a moment." },
          { status: 409 }
        );
      case "refunded":
      case "failed":
        return NextResponse.json({ error: result.message }, { status: 409 });
      default:
        return NextResponse.json({ error: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
