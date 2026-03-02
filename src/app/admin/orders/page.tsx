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
  FileText,
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
    email?: string;
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

// Format number with commas (ASCII-safe, no Unicode)
function fmt(n: number): string {
  const s = Math.abs(n).toFixed(2);
  const [intPart, dec] = s.split(".");
  // Indian numbering: last 3 digits, then groups of 2
  if (intPart.length <= 3) return (n < 0 ? "-" : "") + intPart + (dec !== "00" ? "." + dec : "");
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return (n < 0 ? "-" : "") + parts.join(",") + "," + last3 + (dec !== "00" ? "." + dec : "");
}

// ——— Invoice PDF Generation ———
async function downloadInvoice(order: Order) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 210mm
  const H = doc.internal.pageSize.getHeight(); // 297mm
  const M = 15; // margin
  const orderId = order._id.slice(-8).toUpperCase();
  const invoiceNo = `WP-${orderId}`;
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ---------- TOP HALF: INVOICE ----------
  let y = 18;

  // Load logo as base64
  let logoBase64: string | null = null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = "/logo.png";
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL("image/png");
  } catch {
    // If logo fails to load, skip it
  }

  // Company header with logo
  const logoSize = 16; // mm - bigger to match heading
  const textStartX = logoBase64 ? M + logoSize + 3 : M;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", M, y - 6, logoSize, logoSize);
  }
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Wellness Point", textStartX, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Premium Food Supplements for Whole-Body Wellness", textStartX, y);
  y += 4;
  doc.text("Bengaluru, Karnataka, India", textStartX, y);
  y += 4;
  doc.text("GST No: 29ACQPH3825A1ZP", textStartX, y);

  // "TAX INVOICE" label on right (aligned with company name)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TAX INVOICE", W - M, 18, { align: "right" });

  // Invoice meta on right (tight below TAX INVOICE, no gap)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Invoice No: ${invoiceNo}`, W - M, 24, { align: "right" });
  doc.text(`Order ID: #${orderId}`, W - M, 28, { align: "right" });
  doc.text(`Date: ${orderDate}`, W - M, 32, { align: "right" });
  doc.text(`Payment: Razorpay (${order.paymentStatus.toUpperCase()})`, W - M, 36, { align: "right" });

  y += 6;
  // Divider below header
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 6;

  // Bill To section
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("BILL TO:", M, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(order.shippingAddress?.fullName || order.user?.name || "Customer", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  if (order.shippingAddress?.phone) {
    doc.text(`Phone: ${order.shippingAddress.phone}`, M, y);
    y += 4;
  }
  const invoiceEmail = order.shippingAddress?.email || order.user?.email;
  if (invoiceEmail) {
    doc.text(`Email: ${invoiceEmail}`, M, y);
    y += 4;
  }
  doc.text(
    `${order.shippingAddress?.street || ""}, ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} - ${order.shippingAddress?.pincode || ""}`,
    M,
    y
  );
  y += 8;

  // Items table header
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y - 1, W - 2 * M, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.text("#", M + 2, y + 3.5);
  doc.text("Product", M + 10, y + 3.5);
  doc.text("Qty", W - M - 60, y + 3.5, { align: "center" });
  doc.text("Unit Price", W - M - 35, y + 3.5, { align: "right" });
  doc.text("Amount", W - M - 2, y + 3.5, { align: "right" });
  y += 10;

  // Items rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  order.items.forEach((item, i) => {
    doc.setFontSize(8);
    doc.text(String(i + 1), M + 2, y);
    // Truncate long names
    const nameText = item.name.length > 40 ? item.name.substring(0, 37) + "..." : item.name;
    doc.text(nameText, M + 10, y);
    doc.text(String(item.quantity), W - M - 60, y, { align: "center" });
    doc.text(`Rs. ${fmt(item.price)}`, W - M - 35, y, { align: "right" });
    doc.text(`Rs. ${fmt(item.price * item.quantity)}`, W - M - 2, y, { align: "right" });
    y += 6;
  });

  // Divider
  y += 2;
  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;

  // Summary — calculate from actual items so numbers always add up
  const calcSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const calcTotal = calcSubtotal + (order.shipping || 0) - (order.discount || 0);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Subtotal:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(calcSubtotal)}`, W - M - 2, y, { align: "right" });
  y += 5;

  doc.setTextColor(80);
  doc.text("Shipping:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(order.shipping || 0)}`, W - M - 2, y, { align: "right" });
  y += 5;

  if (order.discount > 0) {
    doc.setTextColor(80);
    doc.text("Discount:", W - M - 80, y);
    doc.setTextColor(22, 163, 74);
    doc.text(`-Rs. ${fmt(order.discount)}`, W - M - 2, y, { align: "right" });
    y += 5;
  }

  // Total
  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TOTAL:", W - M - 80, y);
  doc.text(`Rs. ${fmt(calcTotal)}`, W - M - 2, y, { align: "right" });
  y += 8;

  // GST note
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text("* All prices are inclusive of applicable GST.", M, y);
  y += 3;
  doc.text("* This is a computer-generated invoice and does not require a signature.", M, y);

  // ============================
  // DASHED CUT LINE AT MIDPOINT
  // ============================
  const cutY = H / 2;
  doc.setDrawColor(150);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(M, cutY, W - M, cutY);

  // Scissors icon / text at cut line
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150);
  doc.text("--- CUT HERE --- Keep above with product, paste below on delivery box ---", M + 5, cutY - 2);
  doc.setLineDashPattern([], 0); // reset

  // ---------- BOTTOM HALF: SHIPPING LABEL ----------
  let sy = cutY + 15;

  // "SHIPPING LABEL" header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("SHIPPING LABEL", W / 2, sy, { align: "center" });
  sy += 10;

  // From
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("FROM:", M, sy);
  sy += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text("Wellness Point", M, sy);
  sy += 4;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Bengaluru, Karnataka, India", M, sy);
  sy += 4;
  doc.text("GST No: 29ACQPH3825A1ZP", M, sy);
  sy += 6;

  // To (no divider, closer to FROM)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("TO:", M, sy);
  sy += 6;

  // Big recipient name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(order.shippingAddress?.fullName || "Customer", M, sy);
  sy += 7;

  // Address
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  if (order.shippingAddress?.street) {
    doc.text(order.shippingAddress.street, M, sy);
    sy += 6;
  }
  doc.text(
    `${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""}`,
    M,
    sy
  );
  sy += 6;

  // Big pincode
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(`PIN: ${order.shippingAddress?.pincode || ""}`, M, sy);
  sy += 8;

  // Phone
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text(`Phone: ${order.shippingAddress?.phone || ""}`, M, sy);
  sy += 10;

  // Order reference box
  doc.setDrawColor(200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(M, sy, W - 2 * M, 14, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text(`Order: #${orderId}`, M + 5, sy + 6);
  doc.text(`Date: ${orderDate}`, W / 2, sy + 6);
  doc.text(`Items: ${order.items.length}`, W - M - 30, sy + 6);
  doc.text(`Total: Rs. ${fmt(calcTotal)}`, W / 2, sy + 11);

  // Save with data URI to ensure Chrome uses correct filename
  const fileName = `Invoice-${invoiceNo}.pdf`;
  const pdfDataUri = doc.output("datauristring");
  const link = document.createElement("a");
  link.href = pdfDataUri;
  link.download = fileName;
  link.click();
  toast.success("Invoice downloaded");
}

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
      .catch(() => { })
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
      o.items.reduce((s: number, item: any) => s + item.price * item.quantity, 0) + (o.shipping || 0) - (o.discount || 0),
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
        o.shippingAddress?.email?.toLowerCase().includes(search.toLowerCase()) ||
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedOrder(null)}
              className="rounded-lg p-2 hover:bg-slate-100"
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
          {/* Download Invoice Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadInvoice(o)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Download Invoice
          </Button>
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
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
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
                  <span>₹{o.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0).toLocaleString("en-IN")}</span>
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
                  <span className="text-emerald-600">₹{(o.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0) + (o.shipping || 0) - (o.discount || 0)).toLocaleString("en-IN")}</span>
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
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${isComplete || isCancelled
                              ? isCancelled
                                ? "bg-red-100 text-red-600"
                                : "bg-emerald-100 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                              }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span
                            className={`text-xs font-medium capitalize ${isComplete || isCancelled ? "text-foreground" : "text-muted-foreground"
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
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === s
              ? "bg-emerald-600 text-white"
              : "bg-muted text-muted-foreground hover:bg-slate-200"
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
                <tr key={order._id} className="hover:bg-slate-50">
                  <td className="py-3 font-mono text-xs">
                    #{order._id.slice(-8).toUpperCase()}
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-foreground">
                      {order.user?.name || order.shippingAddress?.fullName || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.shippingAddress?.email || order.user?.email || ""}
                    </p>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </td>
                  <td className="py-3 font-semibold text-emerald-700">
                    ₹{(order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0) + (order.shipping || 0) - (order.discount || 0)).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3">
                    <select
                      value={order.paymentStatus}
                      onChange={(e) => updateOrderStatus(order._id, "paymentStatus", e.target.value)}
                      disabled={updating === order._id}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium capitalize cursor-pointer ${statusColor[order.paymentStatus] || "bg-muted text-foreground"
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
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium capitalize cursor-pointer ${statusColor[order.orderStatus] || "bg-muted text-foreground"
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => downloadInvoice(order)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                        title="Download Invoice"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
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
