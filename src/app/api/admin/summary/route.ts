import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Contact from "@/models/Contact";
import Review from "@/models/Review";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { abandonedFilter } from "@/lib/abandoned";
import { calcOrderTotal } from "@/lib/order-math";

const UNSHIPPED_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * GET /api/admin/summary — cheap counts for the sidebar badges and the
 * dashboard's "Action needed" panel. The layout polls this every minute.
 */
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const awaitingShipment = {
      paymentStatus: "paid",
      orderStatus: { $in: ["processing", "confirmed"] },
    };
    const staleBefore = new Date(Date.now() - UNSHIPPED_AFTER_MS);
    const failedRefund = { paymentStatus: "failed", notes: /AUTO-REFUND FAILED/ };

    const [
      newOrders,
      unshippedCount,
      unshippedOrders,
      failedRefundCount,
      failedRefundOrders,
      newContacts,
      pendingReviews,
      abandonedNotReminded,
    ] = await Promise.all([
      Order.countDocuments({ paymentStatus: "paid", orderStatus: "processing" }),
      Order.countDocuments({ ...awaitingShipment, createdAt: { $lt: staleBefore } }),
      Order.find({ ...awaitingShipment, createdAt: { $lt: staleBefore } })
        .select("shippingAddress items shipping discount createdAt")
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      Order.countDocuments(failedRefund),
      Order.find(failedRefund)
        .select("shippingAddress items shipping discount createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Contact.countDocuments({ status: "new" }),
      Review.countDocuments({ isApproved: false }),
      Order.countDocuments({ ...abandonedFilter(), reminderSentAt: { $exists: false } }),
    ]);

    const brief = (o: any) => ({
      _id: o._id,
      name: o.shippingAddress?.fullName || "Customer",
      total: calcOrderTotal(o),
      createdAt: o.createdAt,
    });

    return NextResponse.json({
      badges: {
        orders: newOrders,
        contacts: newContacts,
        reviews: pendingReviews,
        abandoned: abandonedNotReminded,
      },
      actions: {
        unshipped: { count: unshippedCount, orders: unshippedOrders.map(brief) },
        failedRefunds: { count: failedRefundCount, orders: failedRefundOrders.map(brief) },
        newContacts,
        pendingReviews,
      },
    });
  } catch (error) {
    console.error("Admin summary error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
