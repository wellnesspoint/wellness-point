"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { FALLBACK_IMAGE } from "@/lib/constants";

interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  shippingAddress: {
    fullName: string;
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">My Orders</h1>

      {orders.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Package className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="mb-1 text-muted-foreground">No orders yet</p>
            <Link
              href="/shop"
              className="text-sm font-medium text-wellness-600 hover:text-wellness-700"
            >
              Start Shopping →
            </Link>
          </CardContent>
        </Card>
      ) : (
        orders.map((order) => {
          const expanded = expandedId === order._id;
          return (
            <Card key={order._id} className="border-0 shadow-sm">
              <button
                className="w-full text-left"
                onClick={() =>
                  setExpandedId(expanded ? null : order._id)
                }
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Order #{order._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString(
                            "en-IN",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          statusColor[order.orderStatus] || "bg-muted text-foreground"
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          statusColor[order.paymentStatus] || "bg-muted text-foreground"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                      <p className="text-sm font-bold text-wellness-700">
                        ₹{(order.items.reduce((s, item) => s + item.price * item.quantity, 0) + (order.shipping || 0) - (order.discount || 0)).toLocaleString("en-IN")}
                      </p>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </button>

              {expanded && (
                <div className="border-t px-5 pb-5 pt-3">
                  {/* Items */}
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Items ({order.items.length})
                  </p>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-lg bg-muted p-3"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-12 w-12 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_IMAGE;
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ₹{item.price}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 space-y-1 rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{order.items.reduce((s, item) => s + item.price * item.quantity, 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>
                        {order.shipping === 0
                          ? "Free"
                          : `₹${order.shipping.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-₹{order.discount.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 font-bold">
                      <span>Total</span>
                      <span>₹{(order.items.reduce((s, item) => s + item.price * item.quantity, 0) + (order.shipping || 0) - (order.discount || 0)).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  {order.shippingAddress && (
                    <div className="mt-3">
                      <p className="mb-1 text-sm font-medium text-foreground">
                        Shipping Address
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.shippingAddress.fullName},{" "}
                        {order.shippingAddress.street}
                        {order.shippingAddress.addressLine2 && `, ${order.shippingAddress.addressLine2}`},{" "}
                        {order.shippingAddress.city},{" "}
                        {order.shippingAddress.state} –{" "}
                        {order.shippingAddress.pincode}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
