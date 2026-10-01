"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Shield,
  User,
  MapPin,
  Ban,
  CheckCircle,
  ArrowLeft,
  Eye,
  Mail,
  Phone,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { downloadCsv } from "@/lib/csv";
import Pagination, { useDebounced } from "@/components/admin/Pagination";

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  addresses?: any[];
  orderCount?: number;
  totalSpent?: number;
  lastOrderAt?: string;
}

const PAGE_SIZE = 25;

export default function AdminCustomersPage() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const requestId = useRef(0);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // "Email this customer" dialog
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchUsers = useCallback(
    async (isRefresh = false) => {
      const id = ++requestId.current;
      if (isRefresh) setRefreshing(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        const res = await fetch(`/api/admin/users?${params}`);
        const d = await res.json();
        if (id !== requestId.current) return; // a newer request superseded this one
        if (!res.ok) throw new Error(d.error || "Failed to load customers");
        setUsers(d.users || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
      } catch (err) {
        if (id === requestId.current) {
          toast.error(err instanceof Error ? err.message : "Failed to load customers");
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, debouncedSearch]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const viewUser = async (user: UserItem) => {
    setSelectedUser(user);
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/admin/users/${user._id}`);
      const data = await res.json();
      if (data.user) {
        setSelectedUser(data.user);
      }
      setUserOrders(data.orders || []);
    } catch {
      // 
    } finally {
      setLoadingOrders(false);
    }
  };

  const toggleBlock = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: !isActive } : u))
      );
      if (selectedUser?._id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, isActive: !isActive } : null));
      }
      toast.success(isActive ? "User blocked" : "User unblocked");
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!(await confirm(`Permanently delete ${name || "this user"}? This cannot be undone.`))) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to delete");
        return;
      }
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      fetchUsers();
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setUserOrders([]);
      }
      toast.success(data.anonymized ? "Customer has orders, so the account was anonymised" : "User deleted");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const sendEmail = async () => {
    if (!selectedUser || !emailSubject.trim() || !emailMessage.trim()) return;
    setEmailSending(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser._id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, message: emailMessage }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to send email");
      toast.success(`Email sent to ${selectedUser.email}`);
      setEmailOpen(false);
      setEmailSubject("");
      setEmailMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  const downloadCSV = async () => {
    try {
      // Export every customer matching the search, not just this page.
      const params = new URLSearchParams({ all: "1" });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const res = await fetch(`/api/admin/users?${params}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Export failed");
      const headers = ["Name", "Email", "Phone", "Provider", "Role", "Status", "Joined", "Orders", "Total spent", "Last order"];
      const rows = (d.users as UserItem[]).map((u) => [
        u.name || "",
        u.email,
        u.phone || "",
        u.provider || "credentials",
        u.role,
        u.isActive !== false ? "Active" : "Blocked",
        new Date(u.createdAt).toLocaleDateString("en-IN"),
        u.orderCount ?? 0,
        u.totalSpent ?? 0,
        u.lastOrderAt ? new Date(u.lastOrderAt).toLocaleDateString("en-IN") : "",
      ]);
      downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const bulkDelete = async () => {
    const ids = selectableFilteredIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;
    if (
      !(await confirm(
        `Permanently delete ${ids.length} customer${ids.length > 1 ? "s" : ""}? Their wishlists and reviews will be removed. Customers who have orders are anonymised instead of removed. This cannot be undone.`
      ))
    )
      return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete customers");
        return;
      }
      const deleted = new Set<string>(data.deleted || []);
      setUsers((prev) => prev.filter((u) => !deleted.has(u._id)));
      setSelectedIds(new Set());
      fetchUsers();
      const note = data.anonymized?.length
        ? ` (${data.anonymized.length} with orders anonymised)`
        : "";
      if (data.skipped?.length) {
        toast.success(`${deleted.size} deleted${note}, ${data.skipped.length} skipped (admin or not found)`);
      } else {
        toast.success(`${deleted.size} customer${deleted.size !== 1 ? "s" : ""} deleted${note}`);
      }
    } catch {
      toast.error("Failed to delete customers");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Search/paging happen on the server; `users` is already the visible page.
  const filtered = users;

  // Admins can never be bulk-deleted, so they get no checkbox.
  const selectableFilteredIds = filtered.filter((u) => u.role !== "admin").map((u) => u._id);
  const selectedVisibleCount = selectableFilteredIds.filter((id) => selectedIds.has(id)).length;
  const allSelected =
    selectableFilteredIds.length > 0 && selectedVisibleCount === selectableFilteredIds.length;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) selectableFilteredIds.forEach((id) => next.delete(id));
      else selectableFilteredIds.forEach((id) => next.add(id));
      return next;
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Customer detail view
  if (selectedUser) {
    const u = selectedUser;
    return (
      <div className="space-y-6">
        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Email {u.name || u.email}</DialogTitle>
              <DialogDescription>Sent from your support address to {u.email}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject"
                maxLength={150}
              />
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Message"
                rows={7}
                maxLength={5000}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button variant="wellness" onClick={sendEmail} disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}>
                {emailSending ? "Sending..." : "Send email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedUser(null); setUserOrders([]); }}
            className="rounded-lg p-2 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{u.name || "Unknown"}</h1>
            <p className="text-sm text-muted-foreground">{u.email}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Customer Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  {u.role === "admin" ? (
                    <Shield className="h-6 w-6" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{u.name || "—"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                    {u.isActive !== false ? "Active" : "Blocked"}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {u.email}
                </div>
                {u.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {u.phone}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="capitalize font-medium">{u.provider || "credentials"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="capitalize font-medium">{u.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lifetime spend</span>
                  <span className="font-semibold">₹{(u.totalSpent ?? 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders</span>
                  <span>{u.orderCount ?? userOrders.length}</span>
                </div>
              </div>
              {u.role !== "admin" && (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setEmailOpen(true)}>
                  <Mail className="mr-1 h-4 w-4" /> Email this customer
                </Button>
              )}
              {u.role !== "admin" && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={u.isActive !== false ? "destructive" : "default"}
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleBlock(u._id, u.isActive !== false)}
                  >
                    {u.isActive !== false ? (
                      <><Ban className="mr-1 h-4 w-4" /> Block User</>
                    ) : (
                      <><CheckCircle className="mr-1 h-4 w-4" /> Unblock User</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDeleteUser(u._id, u.name)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                Order History ({userOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : userOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No orders from this customer
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Order</th>
                        <th className="pb-2 font-medium">Total</th>
                        <th className="pb-2 font-medium">Payment</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {userOrders.map((order: any) => (
                        <tr key={order._id} className="hover:bg-accent/50">
                          <td className="py-2 font-mono text-xs">#{order._id.slice(-6).toUpperCase()}</td>
                          <td className="py-2 font-semibold text-xs">₹{(order.items?.reduce((s: number, item: any) => s + item.price * item.quantity, 0) + (order.shipping || 0) - (order.discount || 0)).toLocaleString("en-IN")}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${order.paymentStatus === "paid" ? "bg-green-100 text-green-700" :
                              order.paymentStatus === "failed" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                              {order.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${order.orderStatus === "delivered" ? "bg-green-100 text-green-700" :
                              order.orderStatus === "cancelled" ? "bg-red-100 text-red-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                              {order.orderStatus}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Addresses */}
        {u.addresses && u.addresses.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Saved Addresses ({u.addresses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {u.addresses.map((addr: any, i: number) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{addr.fullName}</p>
                    <p className="text-muted-foreground">{addr.street}</p>
                    <p className="text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</p>
                    <p className="text-muted-foreground">Phone: {addr.phone}</p>
                    {addr.isDefault && (
                      <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Default
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Customers ({total})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
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
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV} title="Download CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedVisibleCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-red-700">
            {selectedVisibleCount} customer{selectedVisibleCount > 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkDeleting}
            >
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
              <Trash2 className="mr-1 h-4 w-4" />
              {bulkDeleting ? "Deleting..." : `Delete selected (${selectedVisibleCount})`}
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No customers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 pb-3">
                  <input
                    type="checkbox"
                    aria-label="Select all customers"
                    className="h-4 w-4 cursor-pointer accent-emerald-600"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableFilteredIds.length === 0}
                  />
                </th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium text-right">Orders</th>
                <th className="pb-3 font-medium text-right">Spent</th>
                <th className="pb-3 font-medium">Last order</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((user) => (
                <tr
                  key={user._id}
                  className={`hover:bg-accent ${selectedIds.has(user._id) ? "bg-red-50/60" : ""}`}
                >
                  <td className="w-10 py-3">
                    {user.role !== "admin" && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.name || user.email}`}
                        className="h-4 w-4 cursor-pointer accent-emerald-600"
                        checked={selectedIds.has(user._id)}
                        onChange={() => toggleSelect(user._id)}
                      />
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        {user.role === "admin" ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs capitalize">
                      {user.provider || "credentials"}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm">{user.orderCount ?? 0}</td>
                  <td className="py-3 text-right text-sm font-medium">
                    {(user.totalSpent ?? 0) > 0 ? `₹${(user.totalSpent ?? 0).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {user.lastOrderAt
                      ? new Date(user.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
                      : "—"}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                    >
                      {user.isActive !== false ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "2-digit",
                    })}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => viewUser(user)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {user.role !== "admin" && (
                        <button
                          onClick={() => toggleBlock(user._id, user.isActive !== false)}
                          className={`rounded-lg p-2 ${user.isActive !== false
                            ? "text-muted-foreground hover:bg-red-50 hover:text-red-500"
                            : "text-green-600 hover:bg-green-50"
                            }`}
                          title={user.isActive !== false ? "Block" : "Unblock"}
                        >
                          {user.isActive !== false ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </button>
                      )}
                      {user.role !== "admin" && (
                        <button
                          onClick={() => handleDeleteUser(user._id, user.name)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={(p) => {
          setSelectedIds(new Set());
          setPage(p);
        }}
        disabled={refreshing}
      />
    </div>
  );
}
