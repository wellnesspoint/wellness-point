import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { priceCart } from "@/lib/cart-pricing";
import { validateCoupon } from "@/lib/coupons";

/**
 * POST /api/coupons/validate  { code, items: [{ _id, quantity }] }
 *
 * Lets the checkout page preview a coupon. The cart is priced from the
 * database (never from client-sent prices) and the same rules run again in
 * /api/payment/create-order, so this is only a preview.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to use a coupon" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    // Stops code-guessing.
    const { success } = await rateLimit(`coupon-validate:${userId}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const { code, items } = await req.json().catch(() => ({}));
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Enter a coupon code" }, { status: 400 });
    }

    await connectDB();

    const priced = await priceCart(items);
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: 400 });
    }

    const check = await validateCoupon(code, priced.subtotal, userId);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    return NextResponse.json({
      code: check.coupon.code,
      description: check.coupon.description || "",
      discount: check.discount,
    });
  } catch (error) {
    console.error("Coupon validate error:", error);
    return NextResponse.json({ error: "Could not check coupon" }, { status: 500 });
  }
}
