import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { DAY_MS, istDayKey, istDayStart } from "@/lib/dates";
import { istDateRange } from "@/lib/pagination";

const MAX_PERIOD_DAYS = 366;

// Order total from line items (same rule as lib/order-math), as a pipeline stage.
const TOTAL_STAGE = {
  $addFields: {
    amount: {
      $subtract: [
        {
          $add: [
            {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "i",
                  in: { $multiply: [{ $ifNull: ["$$i.price", 0] }, { $ifNull: ["$$i.quantity", 1] }] },
                },
              },
            },
            { $ifNull: ["$shipping", 0] },
          ],
        },
        // discount + partial refunds both reduce what was actually collected
        { $add: [{ $ifNull: ["$discount", 0] }, { $ifNull: ["$refundedAmount", 0] }] },
      ],
    },
  },
};

// IST calendar day, same buckets as lib/dates istDayKey.
const IST_DAY = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } };

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("reports", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const { searchParams } = new URL(req.url);
    const now = new Date();

    // Either a custom IST date range (?from=YYYY-MM-DD&to=YYYY-MM-DD) or the last N days.
    let startDate: Date;
    let endDate: Date; // exclusive
    let period: number;
    const custom = istDateRange(searchParams.get("from"), searchParams.get("to"));
    if (custom?.$gte && custom?.$lt) {
      startDate = custom.$gte;
      endDate = custom.$lt;
      period = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
      if (period < 1) {
        return NextResponse.json({ error: "The end date can't be before the start date" }, { status: 400 });
      }
      if (period > MAX_PERIOD_DAYS) {
        return NextResponse.json({ error: "Choose a range of at most 1 year" }, { status: 400 });
      }
    } else {
      const parsed = parseInt(searchParams.get("period") || "30", 10);
      period = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_PERIOD_DAYS) : 30;
      // Whole IST calendar days: today plus the previous (period - 1) days.
      startDate = new Date(istDayStart(now).getTime() - (period - 1) * DAY_MS);
      endDate = new Date(istDayStart(now).getTime() + DAY_MS);
    }
    const prevStart = new Date(startDate.getTime() - period * DAY_MS);

    const notPending = { paymentStatus: { $ne: "pending" } };

    const [
      dailyAgg,
      prevAgg,
      paidAgg,
      topProductAgg,
      userDayAgg,
      totalOrders,
      totalCustomers,
      totalProducts,
      processing,
      confirmed,
      shipped,
      delivered,
      cancelled,
      pendingPayments,
      failedPayments,
      refundedPayments,
      gstAgg,
      stateAgg,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate }, paymentStatus: "paid" } },
        TOTAL_STAGE,
        { $group: { _id: IST_DAY, revenue: { $sum: "$amount" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: prevStart, $lt: startDate }, paymentStatus: "paid" } },
        TOTAL_STAGE,
        { $group: { _id: null, revenue: { $sum: "$amount" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        TOTAL_STAGE,
        { $group: { _id: null, revenue: { $sum: "$amount" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.product", "unknown"] },
            name: { $last: { $ifNull: ["$items.name", "Unknown"] } },
            qty: { $sum: { $ifNull: ["$items.quantity", 1] } },
            revenue: {
              $sum: { $multiply: [{ $ifNull: ["$items.price", 0] }, { $ifNull: ["$items.quantity", 1] }] },
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate }, anonymizedAt: { $exists: false } } },
        { $group: { _id: IST_DAY, count: { $sum: 1 } } },
      ]),
      Order.countDocuments(notPending),
      User.countDocuments({ role: "user", anonymizedAt: { $exists: false } }),
      Product.countDocuments(),
      // Status counts exclude abandoned ("pending" payment) checkouts so they
      // line up with "Total Orders".
      Order.countDocuments({ ...notPending, orderStatus: "processing" }),
      Order.countDocuments({ ...notPending, orderStatus: "confirmed" }),
      Order.countDocuments({ ...notPending, orderStatus: "shipped" }),
      Order.countDocuments({ ...notPending, orderStatus: "delivered" }),
      Order.countDocuments({ ...notPending, orderStatus: "cancelled" }),
      Order.countDocuments({ paymentStatus: "pending" }),
      Order.countDocuments({ paymentStatus: "failed" }),
      Order.countDocuments({ paymentStatus: "refunded" }),
      // GST estimate per month: item value is GST-inclusive, so gst = value * rate / (100 + rate),
      // using each product's own rate (default 18). Excludes shipping and discounts.
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate }, paymentStatus: "paid" } },
        { $unwind: "$items" },
        { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "p" } },
        {
          $addFields: {
            value: { $multiply: [{ $ifNull: ["$items.price", 0] }, { $ifNull: ["$items.quantity", 1] }] },
            rate: { $ifNull: [{ $arrayElemAt: ["$p.gst", 0] }, 18] },
          },
        },
        {
          $group: {
            _id: { order: "$_id", month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "+05:30" } } },
            value: { $sum: "$value" },
            gst: { $sum: { $divide: [{ $multiply: ["$value", "$rate"] }, { $add: [100, "$rate"] }] } },
          },
        },
        {
          $group: {
            _id: "$_id.month",
            orders: { $sum: 1 },
            value: { $sum: "$value" },
            gst: { $sum: "$gst" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate }, paymentStatus: "paid" } },
        TOTAL_STAGE,
        {
          $group: {
            _id: { $toLower: { $trim: { input: { $ifNull: ["$shippingAddress.state", ""] } } } },
            state: { $first: "$shippingAddress.state" },
            orders: { $sum: 1 },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 15 },
      ]),
    ]);

    // --- Revenue / orders / signups by IST day ---
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    let currentRevenue = 0;
    let currentOrders = 0;
    for (const row of dailyAgg) {
      revenueByDay[row._id] = row.revenue;
      ordersByDay[row._id] = row.orders;
      currentRevenue += row.revenue;
      currentOrders += row.orders;
    }
    const usersByDay: Record<string, number> = {};
    for (const row of userDayAgg) usersByDay[row._id] = row.count;

    // Fill missing days
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    const customerGrowth: { date: string; newCustomers: number }[] = [];
    for (let i = 0; i < period; i++) {
      const day = istDayKey(new Date(startDate.getTime() + i * DAY_MS));
      dailyRevenue.push({
        date: day,
        revenue: revenueByDay[day] || 0,
        orders: ordersByDay[day] || 0,
      });
      customerGrowth.push({ date: day, newCustomers: usersByDay[day] || 0 });
    }

    const topProducts = topProductAgg.map((p) => ({
      id: String(p._id),
      name: p.name,
      qty: p.qty,
      revenue: p.revenue,
    }));

    // --- Summary Stats ---
    const paidOrders: number = paidAgg[0]?.orders ?? 0;
    const totalRevenue: number = paidAgg[0]?.revenue ?? 0;
    const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    return NextResponse.json({
      dailyRevenue,
      topProducts,
      customerGrowth,
      summary: {
        totalOrders,
        paidOrders,
        totalRevenue,
        totalCustomers,
        totalProducts,
        avgOrderValue,
      },
      range: { from: istDayKey(startDate), to: istDayKey(new Date(endDate.getTime() - 1)), days: period },
      gstByMonth: gstAgg.map((g) => ({
        month: g._id as string,
        orders: g.orders as number,
        itemValue: Math.round(g.value * 100) / 100,
        gst: Math.round(g.gst * 100) / 100,
        taxable: Math.round((g.value - g.gst) * 100) / 100,
      })),
      states: stateAgg.map((st) => ({
        state: (st.state as string) || "Unknown",
        orders: st.orders as number,
        revenue: st.revenue as number,
      })),
      statusCounts: { processing, confirmed, shipped, delivered, cancelled },
      paymentStatusCounts: {
        paid: paidOrders,
        pending: pendingPayments,
        failed: failedPayments,
        refunded: refundedPayments,
      },
      comparison: {
        currentRevenue,
        previousRevenue: prevAgg[0]?.revenue ?? 0,
        currentOrders,
        previousOrders: prevAgg[0]?.orders ?? 0,
      },
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
