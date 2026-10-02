"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Pencil, Plus, Ticket, Trash2, X } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import toast from "react-hot-toast";

interface CouponItem {
  _id: string;
  code: string;
  description?: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxDiscount: number;
  usageLimit: number;
  perUserLimit: number;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
  uses: number;
  discountGiven: number;
}

const emptyForm = {
  code: "",
  description: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  minOrder: "",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "1",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function status(c: CouponItem): { label: string; cls: string } {
  const now = Date.now();
  if (!c.isActive) return { label: "Disabled", cls: "bg-gray-100 text-gray-600" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", cls: "bg-blue-100 text-blue-700" };
  if (c.usageLimit > 0 && c.uses >= c.usageLimit) return { label: "Used up", cls: "bg-orange-100 text-orange-700" };
  return { label: "Active", cls: "bg-green-100 text-green-700" };
}

export default function AdminCouponsPage() {
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: "enable" | "disable" | "delete") => {
    if (checked.size === 0) return;
    if (
      action === "delete" &&
      !(await confirm(`Delete ${checked.size} coupon(s)? Past orders keep their discount. This cannot be undone.`))
    )
      return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/coupons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checked], action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Bulk action failed");
      toast.success(`${d.affected} coupon(s) updated`);
      setChecked(new Set());
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/coupons");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load coupons");
      setCoupons(d.coupons || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (c: CouponItem) => {
    setForm({
      code: c.code,
      description: c.description || "",
      type: c.type,
      value: String(c.value),
      minOrder: c.minOrder ? String(c.minOrder) : "",
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      perUserLimit: String(c.perUserLimit),
      startsAt: toDateInput(c.startsAt),
      expiresAt: toDateInput(c.expiresAt),
      isActive: c.isActive,
    });
    setEditId(c._id);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        description: form.description,
        type: form.type,
        value: Number(form.value),
        minOrder: form.minOrder,
        maxDiscount: form.type === "percent" ? form.maxDiscount : "",
        usageLimit: form.usageLimit,
        perUserLimit: form.perUserLimit,
        startsAt: form.startsAt,
        // expire at the end of the chosen day
        expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59` : "",
        isActive: form.isActive,
      };
      if (!editId) payload.code = form.code;

      const res = await fetch(editId ? `/api/admin/coupons/${editId}` : "/api/admin/coupons", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to save coupon");
      toast.success(editId ? "Coupon updated" : "Coupon created");
      setShowForm(false);
      setEditId(null);
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () =>
    downloadCsv(
      `coupons-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Code", "Type", "Value", "Min order", "Max discount", "Total uses allowed", "Per customer", "Starts", "Expires", "Active", "Times used", "Discount given"],
      coupons.map((c) => [
        c.code, c.type, c.value, c.minOrder, c.maxDiscount, c.usageLimit, c.perUserLimit,
        c.startsAt ? c.startsAt.slice(0, 10) : "", c.expiresAt ? c.expiresAt.slice(0, 10) : "",
        c.isActive ? "yes" : "no", c.uses, c.discountGiven,
      ])
    );

  const toggleActive = async (c: CouponItem) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to update coupon");
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update coupon");
    }
  };

  const remove = async (c: CouponItem) => {
    if (!(await confirm(`Delete coupon ${c.code}? Past orders keep their discount. This cannot be undone.`))) return;
    try {
      const res = await fetch(`/api/admin/coupons/${c._id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to delete coupon");
      toast.success("Coupon deleted");
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete coupon");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Coupons</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons ({coupons.length})</h1>
          <p className="text-sm text-muted-foreground">
            Discount codes customers enter at checkout. Uses count paid, non-cancelled orders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={coupons.length === 0}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          {!showForm && (
            <Button variant="wellness" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> New coupon
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{editId ? `Edit ${form.code}` : "New coupon"}</CardTitle>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-accent" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="WELCOME10"
                    maxLength={30}
                    disabled={!!editId}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description (internal)</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">Discount type *</Label>
                  <select
                    id="type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="percent">Percentage off</option>
                    <option value="fixed">Fixed amount off (₹)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="value">{form.type === "percent" ? "Percent off *" : "Amount off (₹) *"}</Label>
                  <Input
                    id="value"
                    type="number"
                    min="0.01"
                    max={form.type === "percent" ? 100 : undefined}
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minOrder">Minimum order (₹)</Label>
                  <Input id="minOrder" type="number" min="0" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} placeholder="No minimum" />
                </div>
                {form.type === "percent" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDiscount">Max discount (₹)</Label>
                    <Input id="maxDiscount" type="number" min="0" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder="No cap" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="usageLimit">Total uses allowed</Label>
                  <Input id="usageLimit" type="number" min="0" step="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Unlimited" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="perUserLimit">Uses per customer</Label>
                  <Input id="perUserLimit" type="number" min="0" step="1" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">0 = unlimited</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startsAt">Starts on</Label>
                  <Input id="startsAt" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">Expires on (end of day)</Label>
                  <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="wellness" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update coupon" : "Create coupon"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
          <span className="px-1 font-medium">{checked.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("enable")}>Enable</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("disable")}>Disable</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("delete")}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
        </div>
      )}

      {coupons.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Ticket className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No coupons yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => {
            const st = status(c);
            return (
              <Card key={c._id} className="border-0 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <input
                    type="checkbox"
                    checked={checked.has(c._id)}
                    onChange={() => toggleChecked(c._id)}
                    aria-label={`Select coupon ${c.code}`}
                    className="h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground">{c.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">
                      {c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`}
                      {c.type === "percent" && c.maxDiscount > 0 && ` (max ₹${c.maxDiscount})`}
                      {c.minOrder > 0 && ` · min order ₹${c.minOrder}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Used {c.uses}
                      {c.usageLimit > 0 ? ` / ${c.usageLimit}` : ""} times · ₹{c.discountGiven.toLocaleString("en-IN")} given
                      {c.perUserLimit > 0 ? ` · ${c.perUserLimit} per customer` : ""}
                      {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN")}`}
                    </p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Disable" : "Enable"}
                    </Button>
                    <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(c)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
