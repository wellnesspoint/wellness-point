"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Heart, MapPin, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    orders: 0,
    wishlist: 0,
    addresses: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [ordersRes, wishlistRes, profileRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/wishlist"),
          fetch("/api/user/profile"),
        ]);

        const ordersData = await ordersRes.json();
        const wishlistData = await wishlistRes.json();
        const profileData = await profileRes.json();

        setStats({
          orders: ordersData.orders?.length || 0,
          wishlist: wishlistData.products?.length || 0,
          addresses: profileData.user?.addresses?.length || 0,
        });

        setRecentOrders((ordersData.orders || []).slice(0, 3));
      } catch {
        // Silent fail - stats stay at 0
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const statCards = [
    {
      title: "Total Orders",
      value: stats.orders,
      icon: Package,
      href: "/dashboard/orders",
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Wishlist Items",
      value: stats.wishlist,
      icon: Heart,
      href: "/dashboard/wishlist",
      color: "text-red-500 bg-red-50",
    },
    {
      title: "Saved Addresses",
      value: stats.addresses,
      icon: MapPin,
      href: "/dashboard/addresses",
      color: "text-wellness-600 bg-wellness-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                >
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="mb-1 h-7 w-8" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-wellness-600 hover:text-wellness-700"
          >
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order._id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        Order #{order._id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-wellness-600">
                      ₹{order.total}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        order.paymentStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : order.paymentStatus === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-muted" />
              <p className="text-sm text-muted-foreground">No orders yet.</p>
              <Link
                href="/shop"
                className="mt-2 inline-block text-sm font-medium text-wellness-600 hover:text-wellness-700"
              >
                Browse Products
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
