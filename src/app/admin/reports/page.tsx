"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Download,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: string;
  name: string;
  qty: number;
  revenue: number;
}

interface CustomerGrowth {
  date: string;
  newCustomers: number;
}

interface ReportData {
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  customerGrowth: CustomerGrowth[];
  summary: {
    totalOrders: number;
    paidOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    totalProducts: number;
    avgOrderValue: number;
  };
  statusCounts: Record<string, number>;
  paymentStatusCounts: Record<string, number>;
  comparison: {
    currentRevenue: number;
    previousRevenue: number;
    currentOrders: number;
    previousOrders: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const formatCurrency = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getMaxRevenue = () => {
    if (!data) return 1;
    return Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
  };

  const getMaxCustomers = () => {
    if (!data) return 1;
    return Math.max(...data.customerGrowth.map((d) => d.newCustomers), 1);
  };

  const downloadCSV = () => {
    if (!data) return;
    const headers = ["Date", "Revenue", "Orders", "New Customers"];
    const rows = data.dailyRevenue.map((d, i) => [
      d.date,
      d.revenue.toString(),
      d.orders.toString(),
      data.customerGrowth[i]?.newCustomers?.toString() || "0",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${period}days-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        Failed to load reports.
      </div>
    );
  }

  const revenueChange = getChangePercent(
    data.comparison.currentRevenue,
    data.comparison.previousRevenue
  );
  const ordersChange = getChangePercent(
    data.comparison.currentOrders,
    data.comparison.previousOrders
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-emerald-400" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Business insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 text-white">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={downloadCSV}
            variant="outline"
            className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-gray-400">Total Revenue</span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(data.summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-gray-400">Total Orders</span>
            </div>
            <p className="text-xl font-bold text-white">
              {data.summary.totalOrders}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-400">Customers</span>
            </div>
            <p className="text-xl font-bold text-white">
              {data.summary.totalCustomers}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-gray-400">Products</span>
            </div>
            <p className="text-xl font-bold text-white">
              {data.summary.totalProducts}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Avg Order</span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(data.summary.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-400">Paid Orders</span>
            </div>
            <p className="text-xl font-bold text-white">
              {data.summary.paidOrders}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Revenue (last {period} days)
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(data.comparison.currentRevenue)}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                  revenueChange >= 0
                    ? "text-emerald-400 bg-emerald-400/10"
                    : "text-red-400 bg-red-400/10"
                }`}
              >
                {revenueChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(revenueChange).toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              vs previous {period} days:{" "}
              {formatCurrency(data.comparison.previousRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Orders (last {period} days)
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {data.comparison.currentOrders}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                  ordersChange >= 0
                    ? "text-emerald-400 bg-emerald-400/10"
                    : "text-red-400 bg-red-400/10"
                }`}
              >
                {ordersChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(ordersChange).toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              vs previous {period} days: {data.comparison.previousOrders}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart (CSS bar chart) */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Daily Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-1 min-w-fit"
              style={{ height: "200px" }}
            >
              {data.dailyRevenue.map((d, i) => {
                const height = (d.revenue / getMaxRevenue()) * 180;
                return (
                  <div
                    key={i}
                    className="group relative flex flex-col items-center"
                    style={{ minWidth: data.dailyRevenue.length > 60 ? "4px" : data.dailyRevenue.length > 30 ? "8px" : "16px" }}
                  >
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date}: {formatCurrency(d.revenue)} ({d.orders} orders)
                    </div>
                    <div
                      className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}px` }}
                    />
                    {data.dailyRevenue.length <= 14 && (
                      <span className="text-[10px] text-gray-500 mt-1 rotate-45 origin-left whitespace-nowrap">
                        {d.date.slice(5)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
            <span>{data.dailyRevenue[0]?.date}</span>
            <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Customer Growth Chart */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Customer Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-1 min-w-fit"
              style={{ height: "150px" }}
            >
              {data.customerGrowth.map((d, i) => {
                const height = (d.newCustomers / getMaxCustomers()) * 130;
                return (
                  <div
                    key={i}
                    className="group relative flex flex-col items-center"
                    style={{ minWidth: data.customerGrowth.length > 60 ? "4px" : data.customerGrowth.length > 30 ? "8px" : "16px" }}
                  >
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date}: {d.newCustomers} new
                    </div>
                    <div
                      className="w-full bg-purple-500/80 hover:bg-purple-400 rounded-t transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}px` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
            <span>{data.customerGrowth[0]?.date}</span>
            <span>
              {data.customerGrowth[data.customerGrowth.length - 1]?.date}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-400" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No sales data yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-500 w-5">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.qty} units sold
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400 whitespace-nowrap">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order & Payment Status Distribution */}
        <div className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-400" />
                Order Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.statusCounts).map(([status, count]) => {
                  const total = Object.values(data.statusCounts).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percent = total > 0 ? (count / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    processing: "bg-yellow-500",
                    confirmed: "bg-blue-500",
                    shipped: "bg-purple-500",
                    delivered: "bg-emerald-500",
                    cancelled: "bg-red-500",
                  };
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300 capitalize">
                          {status}
                        </span>
                        <span className="text-gray-400">
                          {count} ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className={`${colors[status] || "bg-gray-500"} h-2 rounded-full transition-all`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-400" />
                Payment Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.paymentStatusCounts).map(
                  ([status, count]) => {
                    const total = Object.values(
                      data.paymentStatusCounts
                    ).reduce((a, b) => a + b, 0);
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    const colors: Record<string, string> = {
                      paid: "bg-emerald-500",
                      pending: "bg-yellow-500",
                      failed: "bg-red-500",
                      refunded: "bg-blue-500",
                    };
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">
                            {status}
                          </span>
                          <span className="text-gray-400">
                            {count} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`${colors[status] || "bg-gray-500"} h-2 rounded-full transition-all`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
