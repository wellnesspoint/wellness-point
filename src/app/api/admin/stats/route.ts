import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { calcOrderTotal } from "@/lib/order-math";
import { IST_OFFSET_MS, DAY_MS } from "@/lib/dates";

// Totals are derived from line items (see lib/order-math), expressed for Mongo.
const ITEM_AMOUNT = {
  $multiply: [{ $ifNull: ["$items.price", 0] }, { $ifNull: ["$items.quantity", 1] }],
};
const ORDER_TOTAL_STAGE = {
  $project: {
    paymentStatus: 1,
    orderStatus: 1,
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

const ITEMS_SUM = {
  $sum: {
    $map: {
      input: { $ifNull: ["$items", []] },
      as: "i",
      in: { $multiply: [{ $ifNull: ["$$i.price", 0] }, { $ifNull: ["$$i.quantity", 1] }] },
    },
  },
};
// what the order totals before any refund: items + shipping - discount
const GROSS = {
  $subtract: [{ $add: [ITEMS_SUM, { $ifNull: ["$shipping", 0] }] }, { $ifNull: ["$discount", 0] }],
};

export async function GET() {
  const session = await checkAdmin("reports", "view");
  if (!session) return unauthorizedResponse();

  await connectDB();

  try {
    // Today's date range in IST (UTC+5:30). Vercel runs in UTC, so offset it.
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const todayStart = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET_MS
    );
    const todayEnd = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS
    );

    // Exclude "pending" — those are checkout attempts that never completed
    // payment (created up-front by /api/payment/create-order so a total
    // can be locked in before the Razorpay redirect), not real orders.
    const notPending = { paymentStatus: { $ne: "pending" } };

    const [
      byStatus,
      todayAgg,
      topProducts,
      recentOrders,
      totalProducts,
      totalCustomers,
      subscribers,
      lowStockProducts,
    ] = await Promise.all([
      // one pass over all orders, grouped; nothing is loaded into memory
      Order.aggregate([
        { $match: notPending },
        ORDER_TOTAL_STAGE,
        {
          $group: {
            _id: { payment: "$paymentStatus", order: "$orderStatus" },
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd }, paymentStatus: "paid" } },
        ORDER_TOTAL_STAGE,
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.name", "Unknown"] },
            sold: { $sum: { $ifNull: ["$items.quantity", 1] } },
            revenue: { $sum: ITEM_AMOUNT },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.find(notPending)
        .select("user shippingAddress items shipping discount paymentStatus orderStatus createdAt")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Product.countDocuments({ isActive: true }),
      User.countDocuments({ role: "user", anonymizedAt: { $exists: false } }),
      NewsletterSubscriber.countDocuments({ isActive: true }),
      Product.find({
        isActive: true,
        archivedAt: { $exists: false },
        $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] },
      })
        .select("name stock")
        .sort({ stock: 1 })
        .limit(10)
        .lean(),
    ]);

    // Yesterday's sales (for the "vs yesterday" change), the best customers, and the refund rate.
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const [yesterdayAgg, topCustomerAgg, refundAgg] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: yesterdayStart, $lt: todayStart }, paymentStatus: "paid" } },
        ORDER_TOTAL_STAGE,
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", user: { $exists: true } } },
        {
          $project: {
            user: 1,
            // net of discount and partial refunds, same as revenue everywhere else
            amount: { $subtract: [GROSS, { $ifNull: ["$refundedAmount", 0] }] },
          },
        },
        { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$amount" } } },
        { $sort: { spent: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
        {
          $project: {
            orders: 1,
            spent: 1,
            name: { $arrayElemAt: ["$u.name", 0] },
            email: { $arrayElemAt: ["$u.email", 0] },
          },
        },
      ]),
      // Refund rate = money returned (full refunds + partial refunds) / money collected.
      Order.aggregate([
        { $match: { paymentStatus: { $in: ["paid", "refunded"] } } },
        {
          $group: {
            _id: null,
            collected: { $sum: GROSS },
            refunded: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "refunded"] }, GROSS, { $ifNull: ["$refundedAmount", 0] }],
              },
            },
          },
        },
      ]),
    ]);
    const collected: number = refundAgg[0]?.collected ?? 0;
    const refundedMoney: number = refundAgg[0]?.refunded ?? 0;

    let totalOrders = 0;
    let totalRevenue = 0;
    let pendingOrders = 0;
    let paidOrders = 0;
    let failedOrders = 0;
    let refundedOrders = 0;
    for (const row of byStatus) {
      const { payment, order } = row._id as { payment: string; order: string };
      totalOrders += row.count;
      if (order === "processing" || order === "confirmed") pendingOrders += row.count;
      if (payment === "paid") {
        paidOrders += row.count;
        totalRevenue += row.amount;
      } else if (payment === "failed") failedOrders += row.count;
      else if (payment === "refunded") refundedOrders += row.count;
    }

    return NextResponse.json({
      totalRevenue,
      todaySales: todayAgg[0]?.amount ?? 0,
      todayOrderCount: todayAgg[0]?.count ?? 0,
      yesterdaySales: yesterdayAgg[0]?.amount ?? 0,
      yesterdayOrderCount: yesterdayAgg[0]?.count ?? 0,
      topCustomers: topCustomerAgg.map((c) => ({
        name: c.name || "Customer",
        email: c.email || "",
        orders: c.orders,
        spent: c.spent,
      })),
      refundedAmount: refundedMoney,
      refundRate: collected > 0 ? refundedMoney / collected : 0,
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      lowStockProducts,
      recentOrders: recentOrders.map((o: any) => ({
        _id: o._id,
        user: o.user,
        shippingAddress: o.shippingAddress,
        items: o.items,
        shipping: o.shipping,
        discount: o.discount,
        total: calcOrderTotal(o),
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt,
      })),
      topProducts: topProducts.map((p) => ({ name: p._id, sold: p.sold, revenue: p.revenue })),
      paidOrders,
      failedOrders,
      refundedOrders,
      subscribers,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
