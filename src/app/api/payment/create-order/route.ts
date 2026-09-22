import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import razorpay from "@/lib/razorpay";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import ShippingSettings from "@/models/ShippingSettings";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
    const ip = getClientIp(req);
    const { success: withinLimit } = rateLimit(`create-order:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many order attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart items are required" },
        { status: 400 }
      );
    }

    // Merge duplicate product ids (a direct API call could send the same
    // product twice — the cart UI itself always merges these already).
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const id = String(item._id);
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      qtyByProduct.set(id, (qtyByProduct.get(id) || 0) + qty);
    }
    const productIds = Array.from(qtyByProduct.keys());

    // Look up all products from DB to get real prices and stock
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    }).lean();

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products are no longer available" },
        { status: 400 }
      );
    }

    // Build a map for easy lookup
    const productMap = new Map(
      products.map((p: any) => [p._id.toString(), p])
    );

    // Validate stock and calculate server-side totals
    const validatedItems = [];
    let subtotal = 0;

    for (const id of productIds) {
      const product = productMap.get(id);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${id}` },
          { status: 400 }
        );
      }

      const requestedQty = qtyByProduct.get(id)!;

      if (product.stock < requestedQty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          },
          { status: 400 }
        );
      }

      const unitPrice = product.discountPrice ?? product.price;
      subtotal += unitPrice * requestedQty;

      validatedItems.push({
        product: product._id.toString(),
        name: product.name,
        image: product.images?.[0] || "",
        price: unitPrice,
        quantity: requestedQty,
      });
    }

    // Shipping — use admin settings
    let shipping = 50; // fallback
    try {
      const shippingConfig = await ShippingSettings.findOne().lean() as { enableFreeShipping?: boolean; freeShippingThreshold?: number; flatRate?: number } | null;
      if (shippingConfig) {
        if (shippingConfig.enableFreeShipping && subtotal >= (shippingConfig.freeShippingThreshold ?? 999)) {
          shipping = 0;
        } else {
          shipping = shippingConfig.flatRate ?? 50;
        }
      } else {
        shipping = subtotal >= 999 ? 0 : 99;
      }
    } catch {
      shipping = subtotal >= 999 ? 0 : 99;
    }
    const total = Math.round((subtotal + shipping) * 100) / 100;

    if (total < 1) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
    }

    // Create Razorpay order with the server-calculated amount
    const options = {
      amount: Math.round(total * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: (session.user as any).id,
        itemCount: validatedItems.length.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Lock in the server-computed items/total against this Razorpay order id.
    // /api/payment/verify will only ever trust THIS record — never client-resent
    // cart data — when finalizing the order after payment.
    await Order.create({
      user: (session.user as any).id,
      items: validatedItems,
      subtotal,
      shipping,
      discount: 0,
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
