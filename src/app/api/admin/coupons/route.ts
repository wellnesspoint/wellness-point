import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Coupon from "@/models/Coupon";
import Order from "@/models/Order";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseCoupon } from "@/lib/coupon-input";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/coupons — all coupons with how often each has been used (paid, not cancelled). */
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const [coupons, usage] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }).limit(500).lean(),
      Order.aggregate([
        {
          $match: {
            couponCode: { $exists: true, $ne: null },
            paymentStatus: "paid",
            orderStatus: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: "$couponCode",
            uses: { $sum: 1 },
            discountGiven: { $sum: { $ifNull: ["$discount", 0] } },
          },
        },
      ]),
    ]);
    const usageByCode = new Map(usage.map((u) => [u._id as string, u]));

    return NextResponse.json({
      coupons: coupons.map((c) => ({
        ...c,
        uses: usageByCode.get(c.code)?.uses ?? 0,
        discountGiven: usageByCode.get(c.code)?.discountGiven ?? 0,
      })),
    });
  } catch (error) {
    console.error("Admin coupons list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const parsed = parseCoupon(await req.json().catch(() => null), true);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    try {
      const coupon = await Coupon.create(parsed.data);
      await logAudit(session, {
        action: "coupon.create",
        entity: "coupon",
        entityId: coupon._id.toString(),
        summary: `Created coupon ${coupon.code} (${coupon.type === "percent" ? `${coupon.value}%` : `₹${coupon.value}`} off)`,
      });
      return NextResponse.json({ coupon }, { status: 201 });
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
      }
      throw err;
    }
  } catch (error: any) {
    console.error("Admin coupon create error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
