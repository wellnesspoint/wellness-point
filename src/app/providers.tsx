"use client";

import React, { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartSidebar from "@/components/layout/CartSidebar";

function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    // Admin routes: no site header, footer, or cart sidebar
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <CartSidebar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <Footer />
    </>
  );
}

/** Registers the offline/caching service worker (public/sw.js). Production only, so dev reloads are never cached. */
function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // the site works the same without it
    });
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <LayoutShell>{children}</LayoutShell>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "12px",
            background: "#333",
            color: "#fff",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#fff" },
          },
        }}
      />
    </SessionProvider>
  );
}
