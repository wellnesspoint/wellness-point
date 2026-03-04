import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET() {
  const session = await checkAdmin();
  if (!session) return unauthorizedResponse();

  await connectDB();

  try {
    // Get today's date range in IST (UTC+5:30)
    // Vercel runs in UTC, so we must offset for Indian Standard Time
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);
    // Start of today IST = midnight IST converted back to UTC
    const todayStart = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET_MS
    );
    // End of today IST = 23:59:59.999 IST converted back to UTC
    const todayEnd = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS
    );

    // Parallel queries
    const [
      orders,
      products,
      totalCustomers,
      subscriberCount,
      todayOrders,
      lowStockProducts,
    ] = await Promise.all([
      Order.find({}).populate("user", "name email").sort({ createdAt: -1 }).lean(),
      Product.countDocuments({ isActive: true }),
      User.countDocuments({ role: "user" }),
      mongoose.connection.db!.collection("newslettersubscribers").countDocuments({ isActive: true }),
      Order.find({
        createdAt: { $gte: todayStart, $lte: todayEnd },
        paymentStatus: "paid",
      }).lean(),
      Product.find({ stock: { $lte: 10 }, isActive: true })
        .select("name stock")
        .sort({ stock: 1 })
        .limit(10)
        .lean(),
    ]);

    // Helper: calculate total from items instead of stored order.total
    const calcTotal = (o: any) => {
      const subtotal = (o.items || []).reduce((s: number, item: any) => s + (item.price || 0) * (item.quantity || 1), 0);
      return subtotal + (o.shipping || 0) - (o.discount || 0);
    };

    // Calculate stats
    const totalRevenue = orders
      .filter((o: any) => o.paymentStatus === "paid")
      .reduce((sum: number, o: any) => sum + calcTotal(o), 0);

    const todaySales = todayOrders.reduce(
      (sum: number, o: any) => sum + calcTotal(o),
      0
    );

    const pendingOrders = orders.filter(
      (o: any) => o.orderStatus === "processing" || o.orderStatus === "confirmed"
    ).length;

    const paidOrders = orders.filter((o: any) => o.paymentStatus === "paid").length;
    const failedOrders = orders.filter((o: any) => o.paymentStatus === "failed").length;
    const refundedOrders = orders.filter((o: any) => o.paymentStatus === "refunded").length;

    // Top selling products (aggregate from order items)
    const productSales: Record<string, { name: string; sold: number; revenue: number }> = {};
    orders
      .filter((o: any) => o.paymentStatus === "paid")
      .forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const key = item.name || "Unknown";
          if (!productSales[key]) {
            productSales[key] = { name: key, sold: 0, revenue: 0 };
          }
          productSales[key].sold += item.quantity || 1;
          productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent orders (last 10)
    const recentOrders = orders.slice(0, 10).map((o: any) => ({
      _id: o._id,
      user: o.user,
      shippingAddress: o.shippingAddress,
      items: o.items,
      shipping: o.shipping,
      discount: o.discount,
      total: calcTotal(o),
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      totalRevenue,
      todaySales,
      todayOrderCount: todayOrders.length,
      totalOrders: orders.length,
      pendingOrders,
      totalCustomers,
      totalProducts: products,
      lowStockProducts,
      recentOrders,
      topProducts,
      paidOrders,
      failedOrders,
      refundedOrders,
      subscribers: subscriberCount,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
