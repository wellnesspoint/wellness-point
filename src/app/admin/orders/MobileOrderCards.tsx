"use client";

import { Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calcOrderTotal } from "@/lib/order-math";
import { statusColor, nextOrderStatuses, nextPaymentStatuses, type Order } from "./order-types";
import { downloadInvoice } from "./documents";

interface Props {
  orders: Order[];
  selected: Set<string>;
  allOnPageSelected: boolean;
  updating: string | null;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onStatusChange: (id: string, field: "orderStatus" | "paymentStatus", value: string) => void;
  onOpen: (order: Order) => void;
}

/** Phones: one card per order (the 9-column table needs ~820px). Desktop keeps the table. */
export default function MobileOrderCards({
  orders,
  selected,
  allOnPageSelected,
  updating,
  onToggleAll,
  onToggle,
  onStatusChange,
  onOpen,
}: Props) {
  return (
  <div className="space-y-2 md:hidden">
    <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={allOnPageSelected}
        onChange={onToggleAll}
        className="h-5 w-5 rounded"
      />
      Select all on this page
    </label>
    {orders.map((order) => (
      <div
        key={order._id}
        className={`rounded-xl border p-3 ${selected.has(order._id) ? "border-emerald-300 bg-emerald-50/50" : "bg-card"}`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected.has(order._id)}
            onChange={() => onToggle(order._id)}
            aria-label={`Select order ${order._id.slice(-8).toUpperCase()}`}
            className="mt-0.5 h-5 w-5 shrink-0 rounded"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">#{order._id.slice(-8).toUpperCase()}</span>
              <span className="font-semibold text-emerald-700">
                ₹{calcOrderTotal(order).toLocaleString("en-IN")}
              </span>
            </div>
            <p className="mt-0.5 truncate font-medium text-foreground">
              {order.user?.name || order.shippingAddress?.fullName || "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            value={order.paymentStatus}
            onChange={(e) => onStatusChange(order._id, "paymentStatus", e.target.value)}
            disabled={updating === order._id}
            aria-label="Payment status"
            className={`h-10 rounded-lg border-0 px-2.5 text-xs font-medium capitalize ${statusColor[order.paymentStatus] || "bg-muted text-foreground"}`}
          >
            {nextPaymentStatuses(order.paymentStatus).map((st) => (
              <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
            ))}
          </select>
          <select
            value={order.orderStatus}
            onChange={(e) => onStatusChange(order._id, "orderStatus", e.target.value)}
            disabled={updating === order._id}
            aria-label="Order status"
            className={`h-10 rounded-lg border-0 px-2.5 text-xs font-medium capitalize ${statusColor[order.orderStatus] || "bg-muted text-foreground"}`}
          >
            {nextOrderStatuses(order.orderStatus).map((st) => (
              <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="h-10" onClick={() => onOpen(order)}>
            <Eye className="mr-1.5 h-4 w-4" /> Details
          </Button>
          <Button size="sm" variant="outline" className="h-10" onClick={() => downloadInvoice(order)}>
            <FileText className="mr-1.5 h-4 w-4" /> Invoice
          </Button>
        </div>
      </div>
    ))}
  </div>
  );
}
