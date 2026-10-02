"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  IndianRupee,
  Download,
  Search,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import { downloadCsv } from "@/lib/csv";
import { calcOrderTotal } from "@/lib/order-math";
import Pagination, { useDebounced } from "@/components/admin/Pagination";

interface PaymentOrder {
  _id: string;
  user?: { name: string; email: string };
  shippingAddress?: { fullName: string };
  items: { price: number; quantity: number; name: string }[];
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  paymentStatus: string;
  orderStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
}

interface Summary {
  paidRevenue: number;
  paidCount: number;
  gstCollected: number;
  failedCount: number;
  refundedAmount: number;
  refundedCount: number;
  partialRefunded: number;
}

const emptySummary: Summary = {
  paidRevenue: 0,
  paidCount: 0,
  gstCollected: 0,
  failedCount: 0,
  refundedAmount: 0,
  refundedCount: 0,
  partialRefunded: 0,
};

const PAGE_SIZE = 25;

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const requestId = useRef(0);

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ payment: filterPayment, ...extra });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return params;
    },
    [filterPayment, debouncedSearch, dateFrom, dateTo]
  );

  useEffect(() => {
    const id = ++requestId.current;
    setFetching(true);
    fetch(`/api/admin/orders?${buildQuery({ page: String(page), limit: String(PAGE_SIZE) })}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load payments");
        return d;
      })
      .then((d) => {
        if (id !== requestId.current) return;
        setOrders(d.orders || []);
        setSummary(d.summary || emptySummary);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
      })
      .catch((err) => {
        if (id === requestId.current) toast.error(err instanceof Error ? err.message : "Failed to load payments");
      })
      .finally(() => {
        if (id === requestId.current) {
          setFetching(false);
          setInitialLoading(false);
        }
      });
  }, [buildQuery, page]);

  // Any filter change restarts from the first page.
  const changeFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const avgOrderValue = summary.paidCount > 0 ? summary.paidRevenue / summary.paidCount : 0;

  const downloadReport = async () => {
    try {
      // Export everything matching the current filters, not just this page.
      const res = await fetch(`/api/admin/orders?${buildQuery({ all: "1" })}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Export failed");
      const headers = [
        "Order ID", "Customer", "Email", "Amount", "GST (est.)", "Payment Status",
        "Razorpay Payment ID", "Razorpay Order ID", "Date",
      ];
      const rows = (d.orders as PaymentOrder[]).map((o) => [
        o._id,
        o.user?.name || o.shippingAddress?.fullName || "",
        o.user?.email || "",
        calcOrderTotal(o),
        ((o.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.18) / 1.18).toFixed(2),
        o.paymentStatus,
        o.razorpayPaymentId || "",
        o.razorpayOrderId || "",
        new Date(o.createdAt).toLocaleDateString("en-IN"),
      ]);
      downloadCsv(`payment-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success(
        d.total > rows.length ? `Report downloaded (first ${rows.length} of ${d.total})` : "Report downloaded"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const statusColor: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-orange-100 text-orange-700",
  };

  if (initialLoading) {
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{summary.paidRevenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Revenue Collected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{Math.round(avgOrderValue).toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Avg. Order Value</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">{summary.failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">₹{Math.round(summary.gstCollected).toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">GST Collected (est.)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refund Stats */}
      {(summary.refundedCount > 0 || summary.partialRefunded > 0) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <p className="text-sm">
              <span className="font-semibold">₹{summary.refundedAmount.toLocaleString("en-IN")}</span>
              {" "}refunded across{" "}
              <span className="font-semibold">{summary.refundedCount}</span>
              {" "}orders
              {summary.partialRefunded > 0 && (
                <>
                  {" "}· plus{" "}
                  <span className="font-semibold">₹{summary.partialRefunded.toLocaleString("en-IN")}</span>
                  {" "}in partial refunds (already deducted from revenue)
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transaction ID, name..."
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => changeFilter(() => setDateFrom(e.target.value))}
            className="w-32 sm:w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => changeFilter(() => setDateTo(e.target.value))}
            className="w-32 sm:w-36"
          />
        </div>
      </div>

      {/* Payment filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", "paid", "failed", "refunded"].map((s) => (
          <button
            key={s}
            onClick={() => changeFilter(() => setFilterPayment(s))}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filterPayment === s
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Transaction Table */}
      {orders.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Phones: one card per transaction */}
        <div className="space-y-2 md:hidden">
          {orders.map((order) => (
            <div key={order._id} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">#{order._id.slice(-8).toUpperCase()}</span>
                <span className="font-semibold">₹{calcOrderTotal(order).toLocaleString("en-IN")}</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium">
                {order.user?.name || order.shippingAddress?.fullName || "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{order.user?.email || ""}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[order.paymentStatus]}`}>
                  {order.paymentStatus}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
              </div>
              {order.razorpayPaymentId && (
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{order.razorpayPaymentId}</p>
              )}
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
              {orders.map((order) => (
                <tr key={order._id} className="hover:bg-accent">
                  <td className="py-3 font-mono text-xs">
                    #{order._id.slice(-8).toUpperCase()}
                  </td>
                  <td className="py-3">
                    <p className="text-xs font-medium">{order.user?.name || order.shippingAddress?.fullName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{order.user?.email || ""}</p>
                  </td>
                  <td className="py-3 font-semibold">₹{calcOrderTotal(order).toLocaleString("en-IN")}</td>
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
        </>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        disabled={fetching}
      />
    </div>
  );
}
