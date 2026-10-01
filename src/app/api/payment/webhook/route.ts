import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { finalizeOrder } from "@/lib/order-finalize";

/**
 * POST /api/payment/webhook
 *
 * Razorpay server-to-server notification. This is what completes an order if
 * the customer pays and then closes the tab / loses connection before the
 * browser calls /api/payment/verify.
 *
 * Setup (Razorpay Dashboard → Settings → Webhooks):
 *   URL:    https://<your-domain>/api/payment/webhook
 *   Secret: any strong string — set the same value as RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, order.paid
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // The signature is computed over the RAW body — read text, not JSON.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    // Acknowledge everything else so Razorpay doesn't keep retrying.
    return NextResponse.json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id || payment.status !== "captured") {
    return NextResponse.json({ received: true });
  }

  try {
    await connectDB();
    const order = await Order.findOne({ razorpayOrderId: payment.order_id });
    if (!order) {
      // Unknown order (e.g. a purged abandoned checkout) — 200 so it isn't retried forever.
      console.error("Webhook: no order for", payment.order_id);
      return NextResponse.json({ received: true });
    }

    if (order.paymentStatus !== "pending") {
      return NextResponse.json({ received: true });
    }

    if (Number(payment.amount) !== Math.round(order.total * 100)) {
      console.error("Webhook: amount mismatch", {
        orderId: order._id.toString(),
        expected: Math.round(order.total * 100),
        got: payment.amount,
      });
      return NextResponse.json({ received: true });
    }

    const result = await finalizeOrder({
      orderId: order._id.toString(),
      razorpayPaymentId: payment.id,
      customerFallbackEmail: payment.email,
    });

    // "busy" means verify is mid-flight — just acknowledge. "invalid" returns
    // 5xx so Razorpay retries later.
    if (result.status === "invalid") {
      console.error("Webhook: could not finalize", result.message);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
