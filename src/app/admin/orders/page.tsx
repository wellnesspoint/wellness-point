"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag,
  Search,
  Download,
  Package,
  Clock,
  Eye,
  ArrowLeft,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import Pagination, { useDebounced } from "@/components/admin/Pagination";
import { calcOrderTotal } from "@/lib/order-math";
import { downloadCsv } from "@/lib/csv";
import { COURIERS, trackingUrlFor } from "@/lib/couriers";

import {
  statusColor,
  statusIcon,
  nextOrderStatuses,
  nextPaymentStatuses,
  orderStatusOptions,
  type Order,
} from "./order-types";
import { downloadInvoices, downloadInvoice, downloadPackingSlips } from "./documents";
import MobileOrderCards from "./MobileOrderCards";

const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const requestId = useRef(0);

  // Bulk selection (list view)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Internal notes + partial refund (detail view)
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  // Shipping & tracking form (order detail view)
  const [trackingForm, setTrackingForm] = useState({ courier: "", trackingNumber: "", trackingUrl: "" });
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [savingTracking, setSavingTracking] = useState(false);
  const selectedId = selectedOrder?._id;
  useEffect(() => {
    setTrackingForm({
      courier: selectedOrder?.tracking?.courier || "",
      trackingNumber: selectedOrder?.tracking?.trackingNumber || "",
      trackingUrl: selectedOrder?.tracking?.trackingUrl || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ status: filterStatus, ...extra });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      return params;
    },
    [filterStatus, debouncedSearch]
  );

  const fetchOrders = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/admin/orders?${buildQuery({ page: String(page), limit: String(PAGE_SIZE) })}`
      );
      const d = await res.json();
      if (id !== requestId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(d.error || "Failed to load orders");
      setOrders(d.orders || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setStatusCounts(d.statusCounts || {});
    } catch (err) {
      if (id === requestId.current) {
        toast.error(err instanceof Error ? err.message : "Failed to load orders");
      }
    } finally {
      if (id === requestId.current) {
        setFetching(false);
        setInitialLoading(false);
      }
    }
  }, [buildQuery, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, field: string, value: string) => {
    if (field === "paymentStatus" && value === "refunded") {
      if (
        !(await confirm(
          "The remaining amount will be returned to the customer via Razorpay and stock will be restored. This cannot be undone.",
          { title: "Refund this order?", confirmLabel: "Refund" }
        ))
      )
        return;
    } else if (field === "orderStatus" && value === "cancelled") {
      if (!(await confirm("Cancel this order? Stock will be restored. This cannot be undone."))) return;
    }

    setUpdating(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to update order");
      }
      const data = await res.json().catch(() => ({}));
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, [field]: value } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, [field]: value, statusHistory: data.order?.statusHistory ?? prev.statusHistory } : null
        );
      }
      fetchOrders(); // refresh tab counts / filtered rows
      toast.success(
        (field === "paymentStatus" && value === "refunded"
          ? "Order refunded via Razorpay"
          : `Order ${field === "orderStatus" ? "status" : "payment"} updated`) +
          (data.emailed ? " · customer emailed" : "")
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPageSelected = orders.length > 0 && orders.every((o) => selected.has(o._id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) orders.forEach((o) => next.delete(o._id));
      else orders.forEach((o) => next.add(o._id));
      return next;
    });

  const selectedOrders = orders.filter((o) => selected.has(o._id));

  // A selection only makes sense for the rows currently shown.
  useEffect(() => {
    setSelected(new Set());
  }, [page, filterStatus, debouncedSearch]);

  const bulkUpdate = async (target: "confirmed" | "shipped" | "delivered") => {
    const ids = selectedOrders.map((o) => o._id);
    if (ids.length === 0) return;
    if (
      !(await confirm(
        `Mark ${ids.length} order${ids.length > 1 ? "s" : ""} as ${target}? Only paid orders that can legally move to "${target}" are changed${
          target !== "confirmed" ? "; customers are emailed" : ""
        }.`,
        { danger: false, confirmLabel: `Mark ${target}`, title: `Mark as ${target}` }
      ))
    )
      return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, orderStatus: target }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Bulk update failed");
      toast.success(
        `${d.updated.length} updated${d.skipped.length ? `, ${d.skipped.length} skipped` : ""}${d.emailed ? ` · ${d.emailed} emailed` : ""}`
      );
      if (d.skipped.length) {
        toast(`Skipped: ${d.skipped.slice(0, 3).map((x: { id: string; reason: string }) => `#${x.id.slice(-8).toUpperCase()} (${x.reason})`).join(", ")}${d.skipped.length > 3 ? "…" : ""}`, { duration: 7000 });
      }
      setSelected(new Set());
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const addNote = async () => {
    if (!selectedOrder || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder._id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to add note");
      setSelectedOrder((prev) => (prev ? { ...prev, internalNotes: d.internalNotes } : null));
      setNoteText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const partialRefund = async () => {
    if (!selectedOrder) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Enter an amount of at least ₹1");
      return;
    }
    if (
      !(await confirm(`Refund ₹${amount.toLocaleString("en-IN")} to the customer via Razorpay? Stock is not restored.`, {
        title: "Partial refund",
        confirmLabel: `Refund ₹${amount.toLocaleString("en-IN")}`,
      }))
    )
      return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder._id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: refundReason }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Refund failed");
      setSelectedOrder((prev) => (prev ? { ...prev, refunds: d.refunds, refundedAmount: d.refundedAmount } : null));
      setRefundAmount("");
      setRefundReason("");
      fetchOrders();
      toast.success(`₹${amount.toLocaleString("en-IN")} refunded${d.emailed ? " · customer emailed" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const saveTracking = async () => {
    if (!selectedOrder) return;
    setSavingTracking(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking: trackingForm, notify: notifyCustomer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save tracking");
      setSelectedOrder((prev) =>
        prev ? { ...prev, tracking: data.order?.tracking ?? trackingForm, statusHistory: data.order?.statusHistory ?? prev.statusHistory } : null
      );
      toast.success("Tracking saved" + (data.emailed ? " · customer emailed" : ""));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tracking");
    } finally {
      setSavingTracking(false);
    }
  };

  const downloadCSV = async () => {
    try {
      // Export everything matching the current filters, not just this page.
      const res = await fetch(`/api/admin/orders?${buildQuery({ all: "1" })}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Export failed");
      const headers = ["Order ID", "Customer", "Email", "Items", "Total", "Payment", "Status", "Date"];
      const rows = (d.orders as Order[]).map((o) => [
        o._id,
        o.user?.name || o.shippingAddress?.fullName || "",
        o.shippingAddress?.email || o.user?.email || "",
        o.items.length,
        calcOrderTotal(o),
        o.paymentStatus,
        o.orderStatus,
        new Date(o.createdAt).toLocaleDateString("en-IN"),
      ]);
      downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success(
        d.total > rows.length ? `CSV downloaded (first ${rows.length} of ${d.total})` : "CSV downloaded"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (initialLoading) {
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
                  <span className="text-emerald-600">₹{calcOrderTotal(o).toLocaleString("en-IN")}</span>
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
                    {nextOrderStatuses(o.orderStatus).map((s) => (
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
                    {nextPaymentStatuses(o.paymentStatus).map((s) => (
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

            {/* Shipping & Tracking */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Shipping &amp; Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Courier</label>
                  <Input
                    value={trackingForm.courier}
                    onChange={(e) => setTrackingForm({ ...trackingForm, courier: e.target.value })}
                    placeholder="e.g. DTDC, Delhivery"
                    maxLength={80}
                    list="courier-presets"
                  />
                  <datalist id="courier-presets">
                    {COURIERS.map((c) => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tracking number</label>
                  <Input
                    value={trackingForm.trackingNumber}
                    onChange={(e) => setTrackingForm({ ...trackingForm, trackingNumber: e.target.value })}
                    maxLength={80}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tracking link (https)</label>
                  <Input
                    value={trackingForm.trackingUrl}
                    onChange={(e) => setTrackingForm({ ...trackingForm, trackingUrl: e.target.value })}
                    placeholder="Auto-filled for known couriers"
                    maxLength={500}
                  />
                  {!trackingForm.trackingUrl && trackingUrlFor(trackingForm.courier, trackingForm.trackingNumber) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Leave empty to use the {trackingForm.courier} tracking page automatically.
                    </p>
                  )}
                </div>
                {o.orderStatus === "shipped" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} />
                    Email the customer if the tracking details changed
                  </label>
                )}
                <Button size="sm" variant="outline" onClick={saveTracking} disabled={savingTracking} className="w-full">
                  {savingTracking ? "Saving..." : "Save tracking"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Tip: save tracking first, then mark the order Shipped — the customer&apos;s shipped email will include it.
                </p>
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
                {o.shippingAddress?.addressLine2 && (
                  <p className="text-muted-foreground">{o.shippingAddress.addressLine2}</p>
                )}
                <p className="text-muted-foreground">
                  {o.shippingAddress?.city}, {o.shippingAddress?.state} - {o.shippingAddress?.pincode}
                </p>
                <p className="text-muted-foreground">Phone: {o.shippingAddress?.phone}</p>
                {o.user && (
                  <p className="text-muted-foreground mt-2">Email: {o.user.email}</p>
                )}
              </CardContent>
            </Card>

            {/* Refunds */}
            {(o.paymentStatus === "paid" || (o.refunds && o.refunds.length > 0)) && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Partial refund</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {o.refunds && o.refunds.length > 0 && (
                    <ul className="space-y-1.5">
                      {o.refunds.map((r, i) => (
                        <li key={i} className="rounded bg-orange-50 px-2 py-1.5 text-xs">
                          <span className="font-semibold text-orange-700">₹{r.amount.toLocaleString("en-IN")}</span>
                          {r.reason ? ` · ${r.reason}` : ""}
                          <span className="block text-[11px] text-muted-foreground">
                            {r.by ? `by ${r.by} · ` : ""}
                            {new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {o.paymentStatus === "paid" && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Refundable now: ₹
                        {(calcOrderTotal(o) - (o.refundedAmount || 0)).toLocaleString("en-IN")}. To refund the rest and restore stock,
                        set Payment status → Refunded.
                      </p>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="Amount (₹)"
                      />
                      <Input
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Reason (optional)"
                        maxLength={200}
                      />
                      <Button size="sm" variant="outline" onClick={partialRefund} disabled={refunding || !refundAmount} className="w-full">
                        {refunding ? "Refunding..." : "Refund this amount"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Internal notes */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {o.internalNotes && o.internalNotes.length > 0 ? (
                  <ul className="space-y-2">
                    {o.internalNotes.map((n, i) => (
                      <li key={i} className="rounded bg-muted/60 px-2.5 py-2 text-xs">
                        <p className="whitespace-pre-wrap break-words">{n.text}</p>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {n.by ? `${n.by} · ` : ""}
                          {new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No notes yet. Only admins can see these.</p>
                )}
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  maxLength={1000}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addNote} disabled={addingNote || !noteText.trim()} className="w-full">
                  {addingNote ? "Adding..." : "Add note"}
                </Button>
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
                {o.couponCode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coupon</span>
                    <span className="font-mono text-xs">{o.couponCode}</span>
                  </div>
                )}
                {o.statusHistory && o.statusHistory.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Status history</p>
                    <ul className="space-y-1.5">
                      {[...o.statusHistory].reverse().map((h, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-medium capitalize">{h.field === "orderStatus" ? "Order" : "Payment"}</span>{" "}
                          {h.from} → <span className="font-medium">{h.to}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {h.by ? `by ${h.by} · ` : ""}
                            {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </li>
                      ))}
                    </ul>
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
          Orders ({total})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID or user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders()}
            disabled={fetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV} title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", ...orderStatusOptions].map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilterStatus(s);
              setPage(1);
            }}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filterStatus === s
              ? "bg-emerald-600 text-white"
              : "bg-muted text-muted-foreground hover:bg-slate-200"
              }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1 opacity-70">({statusCounts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShoppingBag className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
        {selectedOrders.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-emerald-800">
              {selectedOrders.length} order{selectedOrders.length > 1 ? "s" : ""} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkUpdate("confirmed")}>
                Mark confirmed
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkUpdate("shipped")}>
                Mark shipped
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkUpdate("delivered")}>
                Mark delivered
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => downloadPackingSlips(selectedOrders)}>
                <FileText className="mr-1 h-4 w-4" /> Packing slips (4/sheet)
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => downloadInvoices(selectedOrders)}>
                <FileText className="mr-1 h-4 w-4" /> Print invoices &amp; labels
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}
        <MobileOrderCards
          orders={orders}
          selected={selected}
          allOnPageSelected={allOnPageSelected}
          updating={updating}
          onToggleAll={toggleSelectAll}
          onToggle={toggleSelect}
          onStatusChange={updateOrderStatus}
          onOpen={setSelectedOrder}
        />
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-8 pb-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all orders on this page"
                    className="h-4 w-4 rounded"
                  />
                </th>
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
              {orders.map((order) => (
                <tr key={order._id} className={`hover:bg-slate-50 ${selected.has(order._id) ? "bg-emerald-50/50" : ""}`}>
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(order._id)}
                      onChange={() => toggleSelect(order._id)}
                      aria-label={`Select order ${order._id.slice(-8).toUpperCase()}`}
                      className="h-4 w-4 rounded"
                    />
                  </td>
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
                    ₹{calcOrderTotal(order).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3">
                    <select
                      value={order.paymentStatus}
                      onChange={(e) => updateOrderStatus(order._id, "paymentStatus", e.target.value)}
                      disabled={updating === order._id}
                      className={`rounded-full border-0 px-2.5 py-1.5 text-xs font-medium capitalize cursor-pointer ${statusColor[order.paymentStatus] || "bg-muted text-foreground"
                        }`}
                    >
                      {nextPaymentStatuses(order.paymentStatus).map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <select
                      value={order.orderStatus}
                      onChange={(e) => updateOrderStatus(order._id, "orderStatus", e.target.value)}
                      disabled={updating === order._id}
                      className={`rounded-full border-0 px-2.5 py-1.5 text-xs font-medium capitalize cursor-pointer ${statusColor[order.orderStatus] || "bg-muted text-foreground"
                        }`}
                    >
                      {nextOrderStatuses(order.orderStatus).map((s) => (
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
        </div>
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
