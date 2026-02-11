"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  ShoppingBag,
  Users,
  Mail,
  FileText,
  MessageSquare,
  IndianRupee,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  products: number;
  orders: number;
  users: number;
  newsletter: number;
  blogs: number;
  testimonials: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    products: 0,
    orders: 0,
    users: 0,
    newsletter: 0,
    blogs: 0,
    testimonials: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [products, orders, users, newsletter, blogs, testimonials] =
          await Promise.all([
            fetch("/api/admin/products").then((r) => r.json()),
            fetch("/api/admin/orders").then((r) => r.json()),
            fetch("/api/admin/users").then((r) => r.json()),
            fetch("/api/admin/newsletter").then((r) => r.json()),
            fetch("/api/admin/blogs").then((r) => r.json()),
            fetch("/api/admin/testimonials").then((r) => r.json()),
          ]);

        const totalRevenue = (orders.orders || []).reduce(
          (sum: number, o: any) =>
            o.paymentStatus === "paid" ? sum + o.total : sum,
          0
        );

        setStats({
          products: products.products?.length || 0,
          orders: orders.orders?.length || 0,
          users: users.users?.length || 0,
          newsletter: newsletter.subscribers?.length || 0,
          blogs: blogs.blogs?.length || 0,
          testimonials: testimonials.testimonials?.length || 0,
          revenue: totalRevenue,
        });
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    {
      title: "Revenue",
      value: `₹${stats.revenue.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-green-600 bg-green-50 dark:bg-green-950/50 dark:text-green-400",
      href: "/admin/orders",
    },
    {
      title: "Products",
      value: stats.products,
      icon: Package,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400",
      href: "/admin/products",
    },
    {
      title: "Orders",
      value: stats.orders,
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400",
      href: "/admin/orders",
    },
    {
      title: "Users",
      value: stats.users,
      icon: Users,
      color: "text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-400",
      href: "/admin/users",
    },
    {
      title: "Blogs",
      value: stats.blogs,
      icon: FileText,
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 dark:text-cyan-400",
      href: "/admin/blogs",
    },
    {
      title: "Testimonials",
      value: stats.testimonials,
      icon: MessageSquare,
      color: "text-pink-600 bg-pink-50 dark:bg-pink-950/50 dark:text-pink-400",
      href: "/admin/testimonials",
    },
    {
      title: "Subscribers",
      value: stats.newsletter,
      icon: Mail,
      color: "text-wellness-600 bg-wellness-50 dark:bg-wellness-950/50 dark:text-wellness-400",
      href: "/admin/newsletter",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}
                >
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="mb-1 h-7 w-12" />
                  ) : (
                    <p className="text-xl font-bold text-foreground">
                      {card.value}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
