"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  FileText,
  MessageSquare,
  Users,
  Mail,
  ShoppingBag,
  Star,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/blogs", label: "Blogs", icon: FileText },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-wellness-200 border-t-wellness-600" />
      </div>
    );
  }

  if ((session?.user as any)?.role !== "admin") return null;

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-[80px] z-40 h-[calc(100vh-80px)] w-64 transform border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-foreground">Admin</span>
          <button onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" /> Back to Store
          </Link>
        </div>
        <nav className="space-y-1 px-3">
          {adminLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-wellness-50 dark:bg-wellness-900/30 text-wellness-700 dark:text-wellness-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-muted/50">
        {/* Mobile Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            Admin Panel
          </span>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
