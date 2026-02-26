"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Shield,
  User,
  ShoppingBag,
  MapPin,
  Ban,
  CheckCircle,
  ArrowLeft,
  Eye,
  Mail,
  Phone,
  Download,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

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
}

export default function AdminCustomersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
    if (!confirm(`Permanently delete ${name || "this user"}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
        return;
      }
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setUserOrders([]);
      }
      toast.success("User deleted");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const downloadCSV = () => {
    const headers = ["Name", "Email", "Phone", "Provider", "Role", "Status", "Joined"];
    const rows = filtered.map((u) => [
      u.name || "",
      u.email,
      u.phone || "",
      u.provider || "credentials",
      u.role,
      u.isActive !== false ? "Active" : "Blocked",
      new Date(u.createdAt).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search)
  );

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
              </div>
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
          Customers ({users.length})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
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
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((user) => (
                <tr key={user._id} className="hover:bg-accent">
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
    </div>
  );
}
