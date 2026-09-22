import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import Order from "@/models/Order";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // "pending" orders are created the moment checkout starts (see
    // /api/payment/create-order) so a total can be locked in before payment —
    // if the customer abandons the Razorpay modal, that row never becomes a
    // real order. Exclude it here so abandoned checkouts don't show up as
    // phantom orders; "failed" orders (payment captured but stock ran out)
    // ARE shown since the customer was actually charged for those.
    const orders = await Order.find({
      user: (session.user as any).id,
      paymentStatus: { $ne: "pending" },
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
