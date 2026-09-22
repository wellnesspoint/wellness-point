import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import razorpay, { verifyRazorpaySignature } from "@/lib/razorpay";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { sendOrderConfirmation } from "@/lib/email";
import { validateShippingAddress } from "@/lib/utils";

/**
 * POST /api/payment/verify
 *
 * Verifies a Razorpay payment and finalizes the matching "pending" Order that
 * was created (with a server-computed total) by /api/payment/create-order.
 *
 * Security model:
 * 1. The HMAC signature proves Razorpay issued this payment_id for this order_id.
 * 2. We then fetch the actual payment from Razorpay's API and confirm it was
 *    captured for the SAME amount as the total we locked in at create-order —
 *    the client's `orderData` is never trusted for pricing, only for the
 *    shipping address. This is what stops a user from paying for a cheap
 *    order and then "verifying" an expensive one with that signature.
 * 3. The pending Order is looked up by its unique razorpayOrderId, so this
 *    endpoint can't be replayed to mint multiple paid orders (or decrement
 *    stock more than once) from a single payment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 }
      );
    }

    // 1. Verify Razorpay signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // 2. Find the pending order created at /api/payment/create-order time.
    // Its items/subtotal/shipping/total are the ONLY source of truth from here on.
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

    // Idempotent replay: already finalized — return success without redoing
    // stock decrement / email side effects.
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

    // 3. Cross-check the amount Razorpay actually captured against our
    // server-computed total — this is what makes tampering impossible.
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
      return NextResponse.json(
        { error: "Payment could not be verified" },
        { status: 400 }
      );
    }

    // 4. Validate & sanitize the shipping address server-side — the client
    // regex on the checkout form is UX only, not a security boundary.
    const validated = validateShippingAddress(orderData?.shippingAddress || {});
    if (!validated.valid) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // 5. Re-check stock (it may have moved since create-order) and decrement
    // atomically, rolling back any already-decremented items on failure.
    const decremented: { product: any; quantity: number }[] = [];
    let stockError: string | null = null;

    for (const item of order.items) {
      const result = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!result) {
        stockError = `"${item.name}" is no longer available in the requested quantity.`;
        break;
      }
      decremented.push({ product: item.product, quantity: item.quantity });
    }

    if (stockError) {
      // Roll back whatever we did manage to decrement.
      for (const d of decremented) {
        await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.quantity } });
      }

      // The payment WAS captured by Razorpay — don't lose track of it.
      // Mark the order failed (visible to admins for manual refund) instead
      // of silently discarding a paid-for order.
      order.paymentStatus = "failed";
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.notes = `Payment captured (${razorpay_payment_id}) but stock became unavailable: ${stockError} Requires manual refund.`;
      await order.save();

      return NextResponse.json(
        {
          error: `${stockError} Your payment was received — our team will contact you to refund it.`,
        },
        { status: 409 }
      );
    }

    // 6. Finalize the order with the server-validated shipping address.
    order.shippingAddress = validated.address;
    order.paymentStatus = "paid";
    order.orderStatus = "processing";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    // 7. Send order confirmation email (MUST await — Vercel kills the function after response)
    try {
      await sendOrderConfirmation({
        customerName: validated.address.fullName || session.user?.name || "Customer",
        customerEmail: validated.address.email || session.user?.email || "",
        orderId: order._id.toString(),
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        shippingAddress: validated.address,
        discount: order.discount,
        createdAt: order.createdAt,
      });
      console.log("Order confirmation email sent to:", validated.address.email);
    } catch (emailErr) {
      console.error("Order confirmation email failed:", emailErr);
      // Don't fail the order — email is best-effort
    }

    return NextResponse.json({
      success: true,
      order: { _id: order._id },
    });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
