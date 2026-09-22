"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, Package, ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import confetti from "canvas-confetti";
import { FALLBACK_IMAGE } from "@/lib/constants";

interface OrderData {
  _id: string;
  items: {
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  shippingAddress: {
    fullName: string;
    email?: string;
    phone: string;
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Fire confetti on mount
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#16a34a", "#22c55e", "#4ade80", "#86efac"],
      });
    } catch {
      // confetti not available
    }
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    async function fetchOrder() {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) throw new Error();
        const data = await res.json();
        const found = data.orders?.find(
          (o: any) => o._id === orderId
        );
        setOrder(found || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="text-center space-y-4">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-5 w-96" />
        </div>
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!orderId || !order) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted" />
        <h1 className="mb-2 text-2xl font-bold">No Order Found</h1>
        <p className="mb-6 text-muted-foreground">
          We couldn&apos;t find this order. It may have already been processed.
        </p>
        <Link href="/dashboard/orders">
          <Button variant="wellness">View My Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="gradient-wellness min-h-screen py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Success Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mb-2 font-heading text-3xl font-bold text-foreground">
            Thank You!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your order has been placed successfully
          </p>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Order ID: #{order._id.slice(-8).toUpperCase()}
          </p>
        </div>

        {/* Order Items */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <Package className="h-5 w-5 text-wellness-600" />
              Order Summary
            </h2>

            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={imgErrors[idx] || !item.image ? FALLBACK_IMAGE : item.image}
                      alt={item.name}
                      fill
                      unoptimized={imgErrors[idx] || !item.image}
                      className="object-cover"
                      sizes="64px"
                      onError={() => setImgErrors((prev) => ({ ...prev, [idx]: true }))}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{order.shipping === 0 ? "Free" : `₹${order.shipping}`}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-₹{order.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Paid</span>
                <span className="text-wellness-600">
                  ₹{order.total.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="mb-3 font-semibold text-foreground">
              Shipping To
            </h2>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                {order.shippingAddress.fullName}
              </p>
              <p>{order.shippingAddress.street}</p>
              {order.shippingAddress.addressLine2 && (
                <p>{order.shippingAddress.addressLine2}</p>
              )}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} —{" "}
                {order.shippingAddress.pincode}
              </p>
              <p>Phone: {order.shippingAddress.phone}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/orders" className="flex-1">
            <Button
              variant="wellness"
              className="w-full"
              size="lg"
            >
              <Package className="mr-2 h-4 w-4" />
              Track Order
            </Button>
          </Link>
          <Link href="/shop" className="flex-1">
            <Button variant="outline" className="w-full" size="lg">
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto mt-4 h-8 w-64" />
        </div>
      }
    >
      <OrderConfirmationContent />
    </React.Suspense>
  );
}
