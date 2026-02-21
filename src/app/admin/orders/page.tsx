"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag,
  Search,
  Download,
  ChevronDown,
  X,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  user?: { _id: string; name: string; email: string };
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const orderStatusOptions = ["processing", "confirmed", "shipped", "delivered", "cancelled"];
const paymentStatusOptions = ["pending", "paid", "failed", "refunded"];

const statusColor: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

const statusIcon: Record<string, any> = {
  processing: Clock,
  confirmed: CheckCircle,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = () => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, field: string, value: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, [field]: value } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, [field]: value } : null);
      }
      toast.success(`Order ${field === "orderStatus" ? "status" : "payment"} updated`);
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdating(null);
    }
  };

  const downloadCSV = () => {
    const headers = ["Order ID", "Customer", "Email", "Items", "Total", "Payment", "Status", "Date"];
    const rows = filtered.map((o) => [
      o._id,
      o.user?.name || o.shippingAddress?.fullName || "",
      o.user?.email || "",
      o.items.length,
      o.total,
      o.paymentStatus,
      o.orderStatus,
      new Date(o.createdAt).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const filtered = orders
    .filter((o) =>
      filterStatus === "all" ? true : o.orderStatus === filterStatus
    )
    .filter(
      (o) =>
        o._id.toLowerCase().includes(search.toLowerCase()) ||
        o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        o.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        o.shippingAddress?.fullName?.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Orders</h1>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Order detail view
  if (selectedOrder) {
    const o = selectedOrder;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedOrder(null)}
            className="rounded-lg p-2 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Order #{o._id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground">
              Placed on {new Date(o.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Items */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items ({o.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {o.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-muted" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-sm">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{o.subtotal?.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>₹{o.shipping?.toLocaleString("en-IN")}</span>
                </div>
                {o.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">-₹{o.discount?.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-emerald-600">₹{o.total?.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-4">
            {/* Status Management */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Order Status</label>
                  <select
                    value={o.orderStatus}
                    onChange={(e) => updateOrderStatus(o._id, "orderStatus", e.target.value)}
                    disabled={updating === o._id}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    {orderStatusOptions.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Payment Status</label>
                  <select
                    value={o.paymentStatus}
                    onChange={(e) => updateOrderStatus(o._id, "paymentStatus", e.target.value)}
                    disabled={updating === o._id}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    {paymentStatusOptions.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Order Timeline */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Timeline</p>
                  <div className="space-y-3">
                    {orderStatusOptions.map((status, i) => {
                      const currentIdx = orderStatusOptions.indexOf(o.orderStatus);
                      const isComplete = i <= currentIdx && o.orderStatus !== "cancelled";
                      const isCancelled = o.orderStatus === "cancelled" && status === "cancelled";
                      const Icon = statusIcon[status] || Clock;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                              isComplete || isCancelled
                                ? isCancelled
                                  ? "bg-red-100 text-red-600"
                                  : "bg-emerald-100 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span
                            className={`text-xs font-medium capitalize ${
                              isComplete || isCancelled ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer & Shipping */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{o.shippingAddress?.fullName}</p>
                <p className="text-muted-foreground">{o.shippingAddress?.street}</p>
                <p className="text-muted-foreground">
                  {o.shippingAddress?.city}, {o.shippingAddress?.state} - {o.shippingAddress?.pincode}
                </p>
                <p className="text-muted-foreground">Phone: {o.shippingAddress?.phone}</p>
                {o.user && (
                  <p className="text-muted-foreground mt-2">Email: {o.user.email}</p>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[o.paymentStatus]}`}>
                    {o.paymentStatus}
                  </span>
                </div>
                {o.razorpayPaymentId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="font-mono text-xs">{o.razorpayPaymentId}</span>
                  </div>
                )}
                {o.razorpayOrderId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Razorpay Order</span>
                    <span className="font-mono text-xs">{o.razorpayOrderId}</span>
                  </div>
                )}
                {o.notes && (
                  <div className="mt-2">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1 text-xs">{o.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Orders ({orders.length})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={downloadCSV} title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {["all", ...orderStatusOptions].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1 opacity-70">
                ({orders.filter((o) => o.orderStatus === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Order ID</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Items</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Payment</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((order) => (
                <tr key={order._id} className="hover:bg-accent">
                  <td className="py-3 font-mono text-xs">
                    #{order._id.slice(-8).toUpperCase()}
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-foreground">
                      {order.user?.name || order.shippingAddress?.fullName || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.user?.email || ""}
                    </p>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </td>
                  <td className="py-3 font-semibold text-emerald-700">
                    ₹{order.total.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3">
                    <select
                      value={order.paymentStatus}
                      onChange={(e) => updateOrderStatus(order._id, "paymentStatus", e.target.value)}
                      disabled={updating === order._id}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium capitalize cursor-pointer ${
                        statusColor[order.paymentStatus] || "bg-muted text-foreground"
                      }`}
                    >
                      {paymentStatusOptions.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <select
                      value={order.orderStatus}
                      onChange={(e) => updateOrderStatus(order._id, "orderStatus", e.target.value)}
                      disabled={updating === order._id}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium capitalize cursor-pointer ${
                        statusColor[order.orderStatus] || "bg-muted text-foreground"
                      }`}
                    >
                      {orderStatusOptions.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "2-digit",
                    })}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
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
