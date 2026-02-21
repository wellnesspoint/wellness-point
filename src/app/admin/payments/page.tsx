"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  IndianRupee,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";

interface PaymentOrder {
  _id: string;
  user?: { name: string; email: string };
  shippingAddress?: { fullName: string };
  total: number;
  subtotal: number;
  shipping: number;
  paymentStatus: string;
  orderStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders
    .filter((o) => filterPayment === "all" || o.paymentStatus === filterPayment)
    .filter((o) => {
      if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59);
        if (new Date(o.createdAt) > to) return false;
      }
      return true;
    })
    .filter((o) =>
      search
        ? o._id.toLowerCase().includes(search.toLowerCase()) ||
          o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          o.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
          o.razorpayPaymentId?.toLowerCase().includes(search.toLowerCase()) ||
          o.razorpayOrderId?.toLowerCase().includes(search.toLowerCase())
        : true
    );

  const totalRevenue = filtered
    .filter((o) => o.paymentStatus === "paid")
    .reduce((s, o) => s + o.total, 0);
  const totalPending = filtered
    .filter((o) => o.paymentStatus === "pending")
    .reduce((s, o) => s + o.total, 0);
  const totalFailed = filtered.filter((o) => o.paymentStatus === "failed").length;
  const totalRefunded = filtered
    .filter((o) => o.paymentStatus === "refunded")
    .reduce((s, o) => s + o.total, 0);

  // GST calculation (18% included in total)
  const gstCollected = filtered
    .filter((o) => o.paymentStatus === "paid")
    .reduce((s, o) => s + (o.subtotal * 0.18) / 1.18, 0);

  const downloadReport = () => {
    const headers = [
      "Order ID", "Customer", "Email", "Amount", "GST (est.)", "Payment Status",
      "Razorpay Payment ID", "Razorpay Order ID", "Date",
    ];
    const rows = filtered.map((o) => [
      o._id,
      o.user?.name || o.shippingAddress?.fullName || "",
      o.user?.email || "",
      o.total,
      ((o.subtotal * 0.18) / 1.18).toFixed(2),
      o.paymentStatus,
      o.razorpayPaymentId || "",
      o.razorpayOrderId || "",
      new Date(o.createdAt).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const statusColor: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-orange-100 text-orange-700",
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payments & Finance</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments & Finance</h1>
          <p className="text-sm text-muted-foreground">Track all transactions and revenue</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="mr-1 h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/50 text-green-600">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Revenue Collected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{totalPending.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Pending Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalFailed}</p>
              <p className="text-xs text-muted-foreground">Failed Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{Math.round(gstCollected).toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">GST Collected (est.)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refund Stats */}
      {totalRefunded > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <p className="text-sm">
              <span className="font-semibold">₹{totalRefunded.toLocaleString("en-IN")}</span>
              {" "}refunded across{" "}
              <span className="font-semibold">{filtered.filter((o) => o.paymentStatus === "refunded").length}</span>
              {" "}orders
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transaction ID, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      {/* Payment filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {["all", "paid", "pending", "failed", "refunded"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterPayment(s)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterPayment === s
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1 opacity-70">({orders.filter((o) => o.paymentStatus === s).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Transaction Table */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Order ID</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Payment ID</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((order) => (
                <tr key={order._id} className="hover:bg-accent">
                  <td className="py-3 font-mono text-xs">
                    #{order._id.slice(-8).toUpperCase()}
                  </td>
                  <td className="py-3">
                    <p className="text-xs font-medium">{order.user?.name || order.shippingAddress?.fullName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{order.user?.email || ""}</p>
                  </td>
                  <td className="py-3 font-semibold">₹{order.total.toLocaleString("en-IN")}</td>
                  <td className="py-3 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                    {order.razorpayPaymentId || "—"}
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[order.paymentStatus]}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
