import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30"; // days

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - parseInt(period));

    // --- Revenue by day ---
    const orders = await Order.find({
      createdAt: { $gte: startDate },
      paymentStatus: "paid",
    })
      .sort({ createdAt: 1 })
      .lean();

    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};

    orders.forEach((order: any) => {
      const day = new Date(order.createdAt).toISOString().split("T")[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + (order.total || 0);
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    });

    // Fill missing days
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(startDate);
    while (cursor <= now) {
      const day = cursor.toISOString().split("T")[0];
      dailyRevenue.push({
        date: day,
        revenue: revenueByDay[day] || 0,
        orders: ordersByDay[day] || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // --- Top selling products ---
    const allPaidOrders = await Order.find({ paymentStatus: "paid" }).lean();
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};

    allPaidOrders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        const pid = item.product?.toString() || item._id?.toString() || "unknown";
        if (!productSales[pid]) {
          productSales[pid] = { name: item.name || "Unknown", qty: 0, revenue: 0 };
        }
        productSales[pid].qty += item.quantity || 1;
        productSales[pid].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // --- Customer growth ---
    const users = await User.find({
      createdAt: { $gte: startDate },
    })
      .sort({ createdAt: 1 })
      .lean();

    const usersByDay: Record<string, number> = {};
    users.forEach((user: any) => {
      const day = new Date(user.createdAt).toISOString().split("T")[0];
      usersByDay[day] = (usersByDay[day] || 0) + 1;
    });

    const customerGrowth: { date: string; newCustomers: number }[] = [];
    const cursor2 = new Date(startDate);
    while (cursor2 <= now) {
      const day = cursor2.toISOString().split("T")[0];
      customerGrowth.push({
        date: day,
        newCustomers: usersByDay[day] || 0,
      });
      cursor2.setDate(cursor2.getDate() + 1);
    }

    // --- Summary Stats ---
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: "paid" });
    const totalRevenue = allPaidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const totalCustomers = await User.countDocuments({ role: "user" });
    const totalProducts = await Product.countDocuments();
    const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    // --- Order status distribution ---
    const statusCounts = {
      processing: await Order.countDocuments({ orderStatus: "processing" }),
      confirmed: await Order.countDocuments({ orderStatus: "confirmed" }),
      shipped: await Order.countDocuments({ orderStatus: "shipped" }),
      delivered: await Order.countDocuments({ orderStatus: "delivered" }),
      cancelled: await Order.countDocuments({ orderStatus: "cancelled" }),
    };

    // --- Payment method distribution ---
    const paymentStatusCounts = {
      paid: paidOrders,
      pending: await Order.countDocuments({ paymentStatus: "pending" }),
      failed: await Order.countDocuments({ paymentStatus: "failed" }),
      refunded: await Order.countDocuments({ paymentStatus: "refunded" }),
    };

    // --- Period comparison ---
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - parseInt(period));
    const prevOrders = await Order.find({
      createdAt: { $gte: prevStart, $lt: startDate },
      paymentStatus: "paid",
    }).lean();
    const prevRevenue = prevOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const prevOrderCount = prevOrders.length;

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
      statusCounts,
      paymentStatusCounts,
      comparison: {
        currentRevenue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        previousRevenue: prevRevenue,
        currentOrders: orders.length,
        previousOrders: prevOrderCount,
      },
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
