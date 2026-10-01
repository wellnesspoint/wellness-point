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
import { downloadCsv } from "@/lib/csv";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  range?: { from: string; to: string; days: number };
  gstByMonth?: { month: string; orders: number; itemValue: number; taxable: number; gst: number }[];
  states?: { state: string; orders: number; revenue: number }[];
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
  // Custom range (both dates set) overrides the preset period.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const customRange = !!(from && to);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const query = customRange ? `from=${from}&to=${to}` : `period=${period}`;
      const res = await fetch(`/api/admin/reports?${query}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to load reports");
      } else if (json.dailyRevenue) {
        // An error response ({ error }) has no report shape and would crash the page.
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
    setLoading(false);
  }, [period, from, to, customRange]);

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

    downloadCsv(`report-${customRange ? `${from}_to_${to}` : `${period}days`}-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-emerald-500" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Business insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-10 w-[140px]" aria-label="From date" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-10 w-[140px]" aria-label="To date" />
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
                Clear
              </Button>
            )}
          </div>
          <Select value={period} onValueChange={(v) => { setPeriod(v); setFrom(""); setTo(""); }}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
            className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(data.summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total Orders</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {data.summary.totalOrders}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Customers</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {data.summary.totalCustomers}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Products</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {data.summary.totalProducts}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-500" />
              <span className="text-xs text-muted-foreground">Avg Order</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(data.summary.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Paid Orders</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {data.summary.paidOrders}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Revenue ({customRange ? `${from} to ${to}` : `last ${period} days`})
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(data.comparison.currentRevenue)}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                  revenueChange >= 0
                    ? "text-emerald-700 bg-emerald-100"
                    : "text-red-700 bg-red-100"
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
            <p className="text-xs text-muted-foreground mt-2">
              vs previous {data.range?.days ?? period} days:{" "}
              {formatCurrency(data.comparison.previousRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Orders ({customRange ? `${from} to ${to}` : `last ${period} days`})
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {data.comparison.currentOrders}
                </p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                  ordersChange >= 0
                    ? "text-emerald-700 bg-emerald-100"
                    : "text-red-700 bg-red-100"
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
            <p className="text-xs text-muted-foreground mt-2">
              vs previous {data.range?.days ?? period} days: {data.comparison.previousOrders}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart (CSS bar chart) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
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
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date}: {formatCurrency(d.revenue)} ({d.orders} orders)
                    </div>
                    <div
                      className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}px` }}
                    />
                    {data.dailyRevenue.length <= 14 && (
                      <span className="text-[10px] text-muted-foreground mt-1 rotate-45 origin-left whitespace-nowrap">
                        {d.date.slice(5)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
            <span>{data.dailyRevenue[0]?.date}</span>
            <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Customer Growth Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
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
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
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
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
            <span>{data.customerGrowth[0]?.date}</span>
            <span>
              {data.customerGrowth[data.customerGrowth.length - 1]?.date}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
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
                      <span className="text-xs font-bold text-muted-foreground w-5">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.qty} units sold
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">
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
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
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
                        <span className="text-foreground capitalize">
                          {status}
                        </span>
                        <span className="text-muted-foreground">
                          {count} ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
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

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
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
                          <span className="text-foreground capitalize">
                            {status}
                          </span>
                          <span className="text-muted-foreground">
                            {count} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
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

      {/* GST (estimate) by month */}
      {data.gstByMonth && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">GST summary (estimate)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={data.gstByMonth.length === 0}
              onClick={() =>
                downloadCsv(
                  `gst-${data.range?.from ?? "report"}_to_${data.range?.to ?? ""}.csv`,
                  ["Month", "Orders", "Item value (incl. GST)", "Taxable value", "GST"],
                  data.gstByMonth!.map((g) => [g.month, g.orders, g.itemValue, g.taxable, g.gst])
                )
              }
            >
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </CardHeader>
          <CardContent>
            {data.gstByMonth.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No paid orders in this range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Month</th>
                      <th className="pb-2 text-right font-medium">Orders</th>
                      <th className="pb-2 text-right font-medium">Item value</th>
                      <th className="pb-2 text-right font-medium">Taxable value</th>
                      <th className="pb-2 text-right font-medium">GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.gstByMonth.map((g) => (
                      <tr key={g.month}>
                        <td className="py-2">{g.month}</td>
                        <td className="py-2 text-right">{g.orders}</td>
                        <td className="py-2 text-right">{formatCurrency(g.itemValue)}</td>
                        <td className="py-2 text-right">{formatCurrency(g.taxable)}</td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(g.gst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Estimate on paid item value only (prices include GST; each product&apos;s own rate, 18% by default). Excludes shipping,
              discounts and refunds — confirm with your accountant before filing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sales by state */}
      {data.states && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by state</CardTitle>
          </CardHeader>
          <CardContent>
            {data.states.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No paid orders in this range</p>
            ) : (
              <div className="space-y-3">
                {data.states.map((st) => {
                  const max = Math.max(...data.states!.map((x) => x.revenue), 1);
                  return (
                    <div key={st.state}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-foreground">{st.state}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(st.revenue)} · {st.orders} order{st.orders === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(st.revenue / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
