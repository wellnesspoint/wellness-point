import razorpay from "@/lib/razorpay";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { sendOrderConfirmation } from "@/lib/email";

export type FinalizeResult =
  | { status: "paid" }
  | { status: "already_paid" }
  | { status: "busy" }
  | { status: "refunded"; message: string }
  | { status: "failed"; message: string }
  | { status: "invalid"; message: string };

// A claim older than this is considered abandoned (the function that took it
// crashed or timed out) and may be taken over.
const CLAIM_TTL_MS = 2 * 60 * 1000;

interface FinalizeInput {
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  /** Validated shipping address. Falls back to the one stored at create-order. */
  address?: Record<string, string>;
  customerFallbackName?: string;
  customerFallbackEmail?: string;
}

/**
 * Turns a "pending" order into a "paid" one: claims the order atomically,
 * decrements stock (rolling back on failure), auto-refunds if stock ran out,
 * and sends the confirmation email.
 *
 * Shared by /api/payment/verify (browser callback) and /api/payment/webhook
 * (Razorpay server-to-server) so a payment is finalized exactly once no matter
 * which arrives first — or if both arrive at the same time.
 *
 * Callers must have ALREADY confirmed the payment is genuine and captured for
 * the order's total.
 */
export async function finalizeOrder(input: FinalizeInput): Promise<FinalizeResult> {
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS);

  // Atomic claim — only one caller can flip a pending order into "finalizing".
  const order = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      paymentStatus: "pending",
      $or: [
        { finalizing: { $ne: true } },
        { finalizingAt: { $lt: staleBefore } },
      ],
    },
    { $set: { finalizing: true, finalizingAt: new Date() } },
    { new: true }
  );

  if (!order) {
    const current = await Order.findById(input.orderId).select("paymentStatus").lean();
    if (!current) return { status: "invalid", message: "Order not found" };
    if (current.paymentStatus === "paid") return { status: "already_paid" };
    if (current.paymentStatus === "pending") return { status: "busy" };
    return {
      status: "failed",
      message:
        "This order could not be completed automatically. Our team has been notified — please contact support with your payment ID.",
    };
  }

  const release = async () => {
    await Order.updateOne(
      { _id: order._id },
      { $set: { finalizing: false }, $unset: { finalizingAt: "" } }
    );
  };

  try {
    const address = input.address ?? (order.shippingAddress as any)?.toObject?.() ?? order.shippingAddress;
    if (!address || !address.fullName || !address.street) {
      await release();
      return { status: "invalid", message: "Shipping address is missing" };
    }

    // Decrement stock atomically per item, rolling back on any shortfall.
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
      for (const d of decremented) {
        await Product.findByIdAndUpdate(d.product, { $inc: { stock: d.quantity } });
      }

      order.razorpayPaymentId = input.razorpayPaymentId;
      if (input.razorpaySignature) order.razorpaySignature = input.razorpaySignature;
      order.shippingAddress = address;
      order.finalizing = false;
      order.finalizingAt = undefined;
      // Stock was rolled back above, so it must never be "restored" again.
      order.stockRestored = true;

      // The payment WAS captured — try to refund it automatically.
      try {
        await razorpay.payments.refund(input.razorpayPaymentId, {
          speed: "normal",
          notes: { reason: "Item out of stock", orderId: order._id.toString() },
        });
        order.paymentStatus = "refunded";
        order.orderStatus = "cancelled";
        order.notes = `Payment ${input.razorpayPaymentId} captured but stock became unavailable: ${stockError} Automatically refunded.`;
        await order.save();
        return {
          status: "refunded",
          message: `${stockError} Your payment has been refunded automatically (it can take 5–7 days to reach your account).`,
        };
      } catch (refundErr) {
        console.error("Auto-refund failed:", refundErr);
        order.paymentStatus = "failed";
        order.notes = `Payment captured (${input.razorpayPaymentId}) but stock became unavailable: ${stockError} AUTO-REFUND FAILED — requires manual refund.`;
        await order.save();
        return {
          status: "failed",
          message: `${stockError} Your payment was received — our team will contact you to refund it.`,
        };
      }
    }

    order.shippingAddress = address;
    order.paymentStatus = "paid";
    order.orderStatus = "processing";
    order.razorpayPaymentId = input.razorpayPaymentId;
    if (input.razorpaySignature) order.razorpaySignature = input.razorpaySignature;
    order.finalizing = false;
    order.finalizingAt = undefined;
    await order.save();

    // MUST be awaited — serverless functions are frozen after the response.
    try {
      await sendOrderConfirmation({
        customerName: address.fullName || input.customerFallbackName || "Customer",
        customerEmail: address.email || input.customerFallbackEmail || "",
        orderId: order._id.toString(),
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        shippingAddress: address,
        discount: order.discount,
        createdAt: order.createdAt,
      });
    } catch (emailErr) {
      console.error("Order confirmation email failed:", emailErr);
      // best-effort — never fail a paid order over email
    }

    return { status: "paid" };
  } catch (err) {
    // Unexpected error mid-way: free the claim so verify/webhook can retry.
    await release().catch(() => {});
    throw err;
  }
}
