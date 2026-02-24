"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Bell,
  ChevronDown,
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
  const [profileOpen, setProfileOpen] = useState(false);

  // Allow /admin/login to render without auth
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
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

  // Get current page title
  const currentPage = adminLinks.find((l) => l.href === pathname)?.label || "Admin";

  return (
    <div
      className="flex h-screen bg-muted/50"
      style={{ "--accent": "210 40% 94%", "--accent-foreground": "215 16% 35%" } as React.CSSProperties}
    >
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 transform border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header / Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-border px-4">
            <Image
              src="/logo.png"
              alt="Wellness Point"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <div>
              <p className="text-sm font-bold text-foreground">Wellness Point</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Admin Panel</p>
            </div>
            {/* Mobile close */}
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active
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

          {/* Bottom: Back to Store */}
          <div className="border-t border-border p-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Store
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Admin Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          {/* Left: Mobile menu + page title */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{currentPage}</h1>
            </div>
          </div>

          {/* Right: Profile */}
          <div className="flex items-center gap-3">
            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() || "A"}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-foreground">{session?.user?.name || "Admin"}</p>
                  <p className="text-[11px] text-muted-foreground">{session?.user?.email}</p>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-popover py-1 shadow-lg">
                    <div className="border-b border-border px-4 py-2">
                      <p className="text-sm font-medium text-popover-foreground">{session?.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut({ callbackUrl: "/admin/login" });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
