"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartSidebar from "@/components/layout/CartSidebar";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Header />
      <CartSidebar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <Footer />
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
