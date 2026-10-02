import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-status";
import { escapeRegex, istDateRange, pageMeta, parsePagination } from "@/lib/pagination";

const EXPORT_LIMIT = 5000;

// Order total from line items: same rule as lib/order-math, as an aggregation expression.
const SUBTOTAL_EXPR = {
  $sum: {
    $map: {
      input: { $ifNull: ["$items", []] },
      as: "i",
      in: { $multiply: [{ $ifNull: ["$$i.price", 0] }, { $ifNull: ["$$i.quantity", 1] }] },
    },
  },
};

/**
 * GET /api/admin/orders
 *   ?page=&limit=            pagination (limit ≤ 100)
 *   &status=<orderStatus>    &payment=<paymentStatus>
 *   &q=<text>                order id / customer name+email / razorpay ids
 *   &from=YYYY-MM-DD&to=...  inclusive IST calendar days
 *   &all=1                   export mode: up to 5000 rows, no paging
 *
 * Returns the page of orders, the total, per-status counts for the *other*
 * filters (for the status tabs) and a payment summary over the whole filtered
 * set — so pages no longer need to download every order to compute them.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("orders", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const sp = new URL(req.url).searchParams;
    const exportAll = sp.get("all") === "1";
    const paging = parsePagination(sp);

    const status = sp.get("status") || "all";
    const payment = sp.get("payment") || "all";
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const range = istDateRange(sp.get("from"), sp.get("to"));

    // Abandoned checkouts ("pending", never paid) are not real orders.
    const and: Record<string, unknown>[] = [{ paymentStatus: { $ne: "pending" } }];
    if (payment !== "all") {
      if (!(PAYMENT_STATUSES as string[]).includes(payment)) {
        return NextResponse.json({ error: "Invalid payment filter" }, { status: 400 });
      }
      and.push({ paymentStatus: payment });
    }
    if (range) and.push({ createdAt: range });

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const matchingUsers = await User.find({ $or: [{ name: rx }, { email: rx }] })
        .select("_id")
        .limit(500)
        .lean();
      and.push({
        $or: [
          { user: { $in: matchingUsers.map((u) => u._id) } },
          { "shippingAddress.fullName": rx },
          { "shippingAddress.email": rx },
          { razorpayOrderId: rx },
          { razorpayPaymentId: rx },
          { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(q), options: "i" } } },
        ],
      });
    }

    // Status tabs show counts for everything except the status filter itself.
    const withoutStatus = { $and: and };
    const filter: Record<string, unknown> = { $and: [...and] };
    if (status !== "all") {
      if (!(ORDER_STATUSES as string[]).includes(status)) {
        return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
      }
      (filter.$and as unknown[]).push({ orderStatus: status });
    }

    const query = Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    if (exportAll) query.limit(EXPORT_LIMIT);
    else query.skip(paging.skip).limit(paging.limit);

    const [orders, total, statusAgg, summaryAgg] = await Promise.all([
      query.lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: withoutStatus },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: filter },
        {
          $project: {
            paymentStatus: 1,
            subtotal: SUBTOTAL_EXPR,
            shipping: { $ifNull: ["$shipping", 0] },
            discount: { $ifNull: ["$discount", 0] },
            partial: { $ifNull: ["$refundedAmount", 0] },
          },
        },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            // net of partial refunds for paid orders; a fully refunded order's full value is "refunded"
            amount: {
              $sum: {
                $subtract: [
                  { $subtract: [{ $add: ["$subtotal", "$shipping"] }, "$discount"] },
                  { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$partial", 0] },
                ],
              },
            },
            partialRefunded: { $sum: "$partial" },
            subtotal: { $sum: "$subtotal" },
          },
        },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    let allStatusTotal = 0;
    for (const row of statusAgg) {
      statusCounts[row._id] = row.count;
      allStatusTotal += row.count;
    }

    const by = (s: string) => summaryAgg.find((r) => r._id === s);
    const paid = by("paid");
    const summary = {
      paidRevenue: paid?.amount ?? 0,
      paidCount: paid?.count ?? 0,
      // GST is 18% included in the item subtotal (same estimate the page always used).
      gstCollected: ((paid?.subtotal ?? 0) * 0.18) / 1.18,
      failedCount: by("failed")?.count ?? 0,
      refundedAmount: by("refunded")?.amount ?? 0,
      // partial refunds on orders that are still "paid"
      partialRefunded: paid?.partialRefunded ?? 0,
      refundedCount: by("refunded")?.count ?? 0,
    };

    return NextResponse.json({
      orders,
      ...pageMeta(total, paging),
      statusCounts: { all: allStatusTotal, ...statusCounts },
      summary,
    });
  } catch (error) {
    console.error("Admin orders list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
