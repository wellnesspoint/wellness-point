import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import ShippingSettings from "@/models/ShippingSettings";
import { sendOrderConfirmation } from "@/lib/email";

/**
 * POST /api/payment/verify
 *
 * Verifies Razorpay payment signature, re-validates prices/stock from DB,
 * decrements stock atomically, and creates the order.
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

    // 2. Re-validate items from DB (never trust client data for totals)
    if (!orderData?.items?.length) {
      return NextResponse.json(
        { error: "Order items are required" },
        { status: 400 }
      );
    }

    const productIds = orderData.items.map((item: any) => item.product);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    });

    if (products.length !== orderData.items.length) {
      return NextResponse.json(
        { error: "Some products are no longer available" },
        { status: 400 }
      );
    }

    const productMap = new Map(
      products.map((p) => [p._id.toString(), p])
    );

    // 3. Build verified items, check stock, and calculate totals server-side
    const verifiedItems = [];
    let subtotal = 0;

    for (const item of orderData.items) {
      const product = productMap.get(item.product);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.product}` },
          { status: 400 }
        );
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));

      if (product.stock < qty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          },
          { status: 400 }
        );
      }

      const unitPrice = product.discountPrice ?? product.price;
      subtotal += unitPrice * qty;

      verifiedItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0] || "",
        price: unitPrice,
        quantity: qty,
      });
    }

    // Use admin shipping settings instead of hardcoded values
    let shippingCost = 50; // fallback
    try {
      const shippingConfig = await ShippingSettings.findOne().lean() as { enableFreeShipping?: boolean; freeShippingThreshold?: number; flatRate?: number } | null;
      if (shippingConfig) {
        if (shippingConfig.enableFreeShipping && subtotal >= (shippingConfig.freeShippingThreshold ?? 999)) {
          shippingCost = 0;
        } else {
          shippingCost = shippingConfig.flatRate ?? 50;
        }
      } else {
        // No settings configured — use legacy logic
        shippingCost = subtotal >= 999 ? 0 : 99;
      }
    } catch {
      shippingCost = subtotal >= 999 ? 0 : 99;
    }
    const total = Math.round((subtotal + shippingCost) * 100) / 100;

    // 4. Decrement stock atomically for each product
    for (const item of verifiedItems) {
      const result = await Product.findOneAndUpdate(
        {
          _id: item.product,
          stock: { $gte: item.quantity }, // Only decrement if enough stock
        },
        {
          $inc: { stock: -item.quantity },
        },
        { new: true }
      );

      if (!result) {
        // Stock was taken by another order between check and decrement.
        // Rollback any already-decremented products.
        const currentIndex = verifiedItems.indexOf(item);
        for (let i = 0; i < currentIndex; i++) {
          await Product.findByIdAndUpdate(verifiedItems[i].product, {
            $inc: { stock: verifiedItems[i].quantity },
          });
        }
        return NextResponse.json(
          {
            error: `"${item.name}" is no longer available in the requested quantity. Please try again.`,
          },
          { status: 409 }
        );
      }
    }

    // 5. Create order in DB with server-calculated totals
    const order = await Order.create({
      user: (session.user as any).id,
      items: verifiedItems,
      shippingAddress: orderData.shippingAddress,
      subtotal,
      shipping: shippingCost,
      discount: 0,
      total,
      paymentStatus: "paid",
      orderStatus: "processing",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    // 6. Send order confirmation email (non-blocking)
    // Use the email from the checkout form (shippingAddress.email), not the account email
    const recipientEmail = orderData.shippingAddress?.email || session.user?.email || "";
    sendOrderConfirmation({
      customerName: orderData.shippingAddress?.fullName || session.user?.name || "Customer",
      customerEmail: recipientEmail,
      orderId: order._id.toString(),
      items: verifiedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal,
      shipping: shippingCost,
      total,
      shippingAddress: orderData.shippingAddress,
      discount: 0,
      createdAt: order.createdAt,
    }).catch(() => {}); // Don't fail the order if email fails

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
