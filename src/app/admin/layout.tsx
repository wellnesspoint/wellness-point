"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
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
  CreditCard,
  BarChart3,
  Truck,
  Megaphone,
  LogOut,
  ShieldCheck,
} from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/blogs", label: "Blogs", icon: FileText },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/shipping", label: "Shipping", icon: Truck },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
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

  // Allow /admin/login to render without auth
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return; // Don't redirect on login page
    if (status === "unauthenticated") {
      router.push("/admin/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/admin/login");
    }
  }, [status, session, router, isLoginPage]);

  // Login page renders without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if ((session?.user as any)?.role !== "admin") return null;

  return (
    <>
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
          <div className="flex h-full flex-col">
            {/* Mobile close */}
            <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
              <span className="text-sm font-semibold text-foreground">Admin</span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Admin branding */}
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Admin Panel</p>
                  <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {adminLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom actions */}
            <div className="border-t border-border p-3 space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Store
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
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
    </>
  );
}
