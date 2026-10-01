"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  ShoppingBag,
  Users,
  Mail,
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import TrendChart from "@/components/admin/TrendChart";
import { ArrowDownRight, ArrowUpRight, Truck, RotateCcw, MessageCircle, Star as StarIcon } from "lucide-react";

interface Stats {
  totalRevenue: number;
  todaySales: number;
  todayOrderCount: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: { _id: string; name: string; stock: number }[];
  recentOrders: any[];
  topProducts: { name: string; sold: number; revenue: number }[];
  paidOrders: number;
  failedOrders: number;
  refundedOrders: number;
  subscribers: number;
}

const defaultStats: Stats = {
  totalRevenue: 0,
  todaySales: 0,
  todayOrderCount: 0,
  totalOrders: 0,
  pendingOrders: 0,
  totalCustomers: 0,
  totalProducts: 0,
  lowStockProducts: [],
  recentOrders: [],
  topProducts: [],
  paidOrders: 0,
  failedOrders: 0,
  refundedOrders: 0,
  subscribers: 0,
};

interface Trend {
  dailyRevenue: { date: string; revenue: number; orders: number }[];
  comparison: { currentRevenue: number; previousRevenue: number; currentOrders: number; previousOrders: number };
}

interface ActionBrief {
  _id: string;
  name: string;
  total: number;
  createdAt: string;
}

interface ActionItems {
  unshipped: { count: number; orders: ActionBrief[] };
  failedRefunds: { count: number; orders: ActionBrief[] };
  newContacts: number;
  pendingReviews: number;
}

const PERIODS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const pctChange = (current: number, previous: number) =>
  previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Delta({ current, previous }: { current: number; previous: number }) {
  const change = pctChange(current, previous);
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(change).toFixed(0)}%
      <span className="font-normal text-muted-foreground"> vs previous</span>
    </span>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [trend, setTrend] = useState<Trend | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [actions, setActions] = useState<ActionItems | null>(null);

  // Needs-attention items (also drives the sidebar badges)
  useEffect(() => {
    fetch("/api/admin/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setActions(d.actions))
      .catch(() => {});
  }, []);

  // Sales trend for the selected period, compared with the period before it
  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    fetch(`/api/admin/reports?period=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.dailyRevenue) setTrend(d);
      })
      .catch(() => {})
      .finally(() => !cancelled && setTrendLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        // An error response ({ error }) lacks the stats shape and would crash the cards.
        if (res.ok && typeof data.totalRevenue === "number") setStats(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    {
      title: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString("en-IN")}`,
      subtitle: `${stats.paidOrders} paid orders`,
      icon: IndianRupee,
      color: "text-emerald-600 bg-emerald-50",
      href: "/admin/payments",
    },
    {
      title: "Today's Sales",
      value: `₹${stats.todaySales.toLocaleString("en-IN")}`,
      subtitle: `${stats.todayOrderCount} order${stats.todayOrderCount !== 1 ? "s" : ""} today`,
      icon: TrendingUp,
      color: "text-blue-600 bg-blue-50",
      href: "/admin/payments",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders,
      subtitle: `${stats.pendingOrders} pending`,
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50",
      href: "/admin/orders",
    },
    {
      title: "Pending Orders",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-yellow-600 bg-yellow-50",
      href: "/admin/orders",
    },
    {
      title: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-orange-600 bg-orange-50",
      href: "/admin/customers",
    },
    {
      title: "Total Products",
      value: stats.totalProducts,
      icon: Package,
      color: "text-cyan-600 bg-cyan-50",
      href: "/admin/products",
    },
    {
      title: "Paid Orders",
      value: stats.paidOrders,
      icon: CheckCircle,
      color: "text-green-600 bg-green-50",
      href: "/admin/payments",
    },
    {
      title: "Failed Payments",
      value: stats.failedOrders,
      icon: XCircle,
      color: "text-red-600 bg-red-50",
      href: "/admin/payments",
    },
  ];

  const statusColor: Record<string, string> = {
    processing: "bg-blue-100 text-blue-700",
    confirmed: "bg-cyan-100 text-cyan-700",
    shipped: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your store performance
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}
                >
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="mb-1 h-7 w-16" />
                  ) : (
                    <p className="text-xl font-bold text-foreground">
                      {card.value}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  {"subtitle" in card && card.subtitle && !loading && (
                    <p className="text-[10px] text-muted-foreground/70">{card.subtitle}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Action needed */}
      {actions &&
        (actions.unshipped.count > 0 ||
          actions.failedRefunds.count > 0 ||
          actions.newContacts > 0 ||
          actions.pendingReviews > 0) && (
          <Card className="border-0 border-l-4 border-l-amber-400 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Action needed
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {actions.failedRefunds.count > 0 && (
                <Link
                  href="/admin/orders"
                  className="flex items-start gap-3 rounded-lg bg-red-50 p-3 hover:bg-red-100"
                >
                  <RotateCcw className="mt-0.5 h-4 w-4 text-red-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-700">
                      {actions.failedRefunds.count} automatic refund{actions.failedRefunds.count === 1 ? "" : "s"} failed
                    </p>
                    <p className="text-xs text-red-600/80">
                      Customers were charged — open the order and set Payment → Refunded to retry.
                    </p>
                  </div>
                </Link>
              )}
              {actions.unshipped.count > 0 && (
                <Link
                  href="/admin/orders"
                  className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 hover:bg-amber-100"
                >
                  <Truck className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-700">
                      {actions.unshipped.count} order{actions.unshipped.count === 1 ? "" : "s"} unshipped for over 48 hours
                    </p>
                    <p className="text-xs text-amber-700/80">
                      Oldest: {actions.unshipped.orders[0]?.name} ·{" "}
                      {new Date(actions.unshipped.orders[0]?.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </Link>
              )}
              {actions.newContacts > 0 && (
                <Link
                  href="/admin/contacts"
                  className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 hover:bg-blue-100"
                >
                  <MessageCircle className="mt-0.5 h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-700">
                    {actions.newContacts} unanswered contact message{actions.newContacts === 1 ? "" : "s"}
                  </p>
                </Link>
              )}
              {actions.pendingReviews > 0 && (
                <Link
                  href="/admin/reviews"
                  className="flex items-start gap-3 rounded-lg bg-purple-50 p-3 hover:bg-purple-100"
                >
                  <StarIcon className="mt-0.5 h-4 w-4 text-purple-600" />
                  <p className="text-sm font-semibold text-purple-700">
                    {actions.pendingReviews} review{actions.pendingReviews === 1 ? "" : "s"} waiting for approval
                  </p>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

      {/* Sales trend */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Sales trend</CardTitle>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  days === p.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading || !trend ? (
            <Skeleton className="h-44 w-full rounded-lg" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue (last {days} days)</p>
                  <p className="text-2xl font-bold text-foreground">{rupees(trend.comparison.currentRevenue)}</p>
                  <Delta current={trend.comparison.currentRevenue} previous={trend.comparison.previousRevenue} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold text-foreground">{trend.comparison.currentOrders}</p>
                  <Delta current={trend.comparison.currentOrders} previous={trend.comparison.previousOrders} />
                </div>
              </div>
              <div className="lg:col-span-2">
                <TrendChart
                  data={trend.dailyRevenue.map((d) => ({
                    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                    value: d.revenue,
                  }))}
                  format={rupees}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              View All →
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : stats.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No orders yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Order</th>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.recentOrders.map((order: any) => (
                      <tr key={order._id} className="hover:bg-accent/50">
                        <td className="py-2.5 font-mono text-xs">
                          #{order._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-2.5 text-xs">
                          {order.user?.name || order.shippingAddress?.fullName || "—"}
                        </td>
                        <td className="py-2.5 text-xs font-semibold">
                          ₹{order.total?.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              statusColor[order.orderStatus] || "bg-muted text-foreground"
                            }`}
                          >
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Low Stock Alerts */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Low Stock
              </CardTitle>
              <Link
                href="/admin/products"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Manage →
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              ) : stats.lowStockProducts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  All products in stock ✓
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.lowStockProducts.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between rounded-lg bg-yellow-50 px-3 py-2"
                    >
                      <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
                        {p.name}
                      </span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                        {p.stock} left
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Selling Products */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Top Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              ) : stats.topProducts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No sales data yet
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.topProducts.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-accent/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                          {i + 1}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-foreground">
                          ₹{p.revenue.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.sold} sold
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Subscribers</span>
                <span className="text-sm font-semibold">{loading ? "—" : stats.subscribers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Refunded Orders</span>
                <span className="text-sm font-semibold">{loading ? "—" : stats.refundedOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Payment Success Rate</span>
                <span className="text-sm font-semibold">
                  {loading
                    ? "—"
                    : stats.paidOrders + stats.failedOrders > 0
                    ? `${((stats.paidOrders / (stats.paidOrders + stats.failedOrders)) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
