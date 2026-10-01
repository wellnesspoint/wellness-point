import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import razorpay from "@/lib/razorpay";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import ShippingSettings from "@/models/ShippingSettings";
import { rateLimit } from "@/lib/rate-limit";
import { computeShipping } from "@/lib/shipping";
import { validateShippingAddress } from "@/lib/utils";
import { priceCart } from "@/lib/cart-pricing";
import { validateCoupon } from "@/lib/coupons";

/**
 * POST /api/payment/create-order
 *
 * Accepts cart items from the client, looks up real prices & stock from DB,
 * calculates totals server-side, and creates a Razorpay order.
 * This prevents price manipulation — the client never controls the amount.
 *
 * A matching "pending" Order is also created here, storing the server-computed
 * items/total keyed by the Razorpay order id. /api/payment/verify later trusts
 * ONLY this stored total (cross-checked against what Razorpay actually captured)
 * instead of re-trusting whatever items the client sends back at verify time —
 * closing the gap where a client could pay for a cheap order but "verify" an
 * expensive one using the same signature.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Rate limit: 10 order creation attempts per 15 minutes per user
    const userId = (session.user as any).id as string;
    const { success: withinLimit } = await rateLimit(`create-order:${userId}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many order attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { items, shippingAddress, couponCode } = await req.json();

    // Validate the address now (not only at verify time) so it is stored on the
    // pending order — that lets the Razorpay webhook finalize the order even if
    // the customer never returns to the site after paying.
    const validatedAddress = validateShippingAddress(shippingAddress || {});
    if (!validatedAddress.valid) {
      return NextResponse.json({ error: validatedAddress.error }, { status: 400 });
    }

    // Real prices/stock from the database; the client never controls an amount.
    const priced = await priceCart(items);
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }
    const validatedItems = priced.items;
    const subtotal = priced.subtotal;

    // Optional coupon — re-validated here, so the client can't invent a discount.
    let discount = 0;
    let appliedCode: string | undefined;
    if (couponCode) {
      const check = await validateCoupon(couponCode, subtotal, userId);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      discount = check.discount;
      appliedCode = check.coupon.code;
    }

    // Shipping — admin settings, with one shared fallback (see lib/shipping.ts)
    let shippingConfig = null;
    try {
      shippingConfig = await ShippingSettings.findOne().lean();
    } catch {
      // fall through to defaults
    }
    // Free-shipping threshold applies to what the customer actually pays for items.
    const shipping = computeShipping(subtotal - discount, shippingConfig as any);
    const total = Math.round((subtotal - discount + shipping) * 100) / 100;

    if (total < 1) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
    }

    // Create Razorpay order with the server-calculated amount
    const options = {
      amount: Math.round(total * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        itemCount: validatedItems.length.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Lock in the server-computed items/total against this Razorpay order id.
    // /api/payment/verify will only ever trust THIS record — never client-resent
    // cart data — when finalizing the order after payment.
    await Order.create({
      user: userId,
      items: validatedItems,
      shippingAddress: validatedAddress.address,
      subtotal,
      shipping,
      discount,
      couponCode: appliedCode,
      total,
      paymentStatus: "pending",
      orderStatus: "processing",
      razorpayOrderId: order.id,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      // Return server-validated data so client can display correct totals
      serverCart: {
        items: validatedItems,
        subtotal,
        shipping,
        discount,
        couponCode: appliedCode,
        total,
      },
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
