"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import Pagination from "@/components/admin/Pagination";

interface AbandonedOrder {
  _id: string;
  user?: { name?: string; email?: string };
  items: { name: string; quantity: number; price: number }[];
  shippingAddress?: { fullName?: string; email?: string };
  total: number;
  createdAt: string;
  reminderSentAt?: string;
}

const PAGE_SIZE = 25;

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} days ago`;
};

export default function AbandonedCartsPage() {
  const confirm = useConfirm();
  const [orders, setOrders] = useState<AbandonedOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [notReminded, setNotReminded] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState<string | "all" | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const requestId = useRef(0);

  const fetchOrders = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/abandoned?page=${page}&limit=${PAGE_SIZE}`);
      const d = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(d.error || "Failed to load abandoned carts");
      setOrders(d.orders || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setNotReminded(d.notReminded || 0);
    } catch (err) {
      if (id === requestId.current) toast.error(err instanceof Error ? err.message : "Failed to load abandoned carts");
    } finally {
      if (id === requestId.current) {
        setFetching(false);
        setInitialLoading(false);
      }
    }
  }, [page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const send = async (ids?: string[]) => {
    const target = ids ? ids[0] : "all";
    if (!ids && !(await confirm(`Email a reminder to every customer who hasn't been reminded yet (${notReminded} checkouts)?`, { danger: false, confirmLabel: "Send reminders", title: "Send reminders" }))) return;
    setSending(target);
    try {
      const res = await fetch("/api/admin/abandoned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, couponCode: couponCode.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to send");
      toast.success(d.message);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Abandoned Carts</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Abandoned Carts ({total})</h1>
        <p className="text-sm text-muted-foreground">
          Customers who started checkout 1 hour to 7 days ago but didn&apos;t pay. Each customer gets at most one reminder, and
          nobody who has since paid is emailed.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="coupon" className="text-sm font-medium">Include a coupon code (optional)</label>
            <Input
              id="coupon"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. COMEBACK10"
              maxLength={30}
              className="font-mono"
            />
          </div>
          <Button variant="wellness" onClick={() => send()} disabled={sending !== null || notReminded === 0}>
            <Mail className="mr-1 h-4 w-4" />
            {sending === "all" ? "Sending..." : `Remind all (${notReminded})`}
          </Button>
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No abandoned checkouts right now</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o._id} className="border-0 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {o.shippingAddress?.fullName || o.user?.name || "Customer"}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {o.shippingAddress?.email || o.user?.email}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started {ago(o.createdAt)}
                    {o.reminderSentAt && ` · reminded ${ago(o.reminderSentAt)}`}
                  </p>
                </div>
                <p className="text-base font-semibold text-foreground">₹{o.total.toLocaleString("en-IN")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => send([o._id])}
                  disabled={sending !== null || !!o.reminderSentAt}
                >
                  {sending === o._id ? "Sending..." : o.reminderSentAt ? "Reminded" : "Send reminder"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={fetching} />
    </div>
  );
}
