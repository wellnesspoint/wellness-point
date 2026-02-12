"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, CreditCard, MapPin, ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Address {
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, getSubtotal, clearCart, removeItem, updateQuantity } = useCartStore();

  const [address, setAddress] = useState<Address>({
    fullName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [processing, setProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const subtotal = getSubtotal();
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = subtotal + shipping;

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  // Load Razorpay script
  useEffect(() => {
    if (document.getElementById("razorpay-script")) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Load saved addresses
  useEffect(() => {
    if (session) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => {
          const addrs = d.user?.addresses || [];
          setSavedAddresses(addrs);
          const defaultAddr = addrs.find((a: any) => a.isDefault) || addrs[0];
          if (defaultAddr) {
            setAddress({
              fullName: defaultAddr.fullName || "",
              email: defaultAddr.email || session?.user?.email || "",
              phone: defaultAddr.phone || "",
              street: defaultAddr.street || "",
              city: defaultAddr.city || "",
              state: defaultAddr.state || "",
              pincode: defaultAddr.pincode || "",
            });
          }
        })
        .catch(() => {});
    }
  }, [session]);

  const validateAddress = () => {
    if (
      !address.fullName ||
      !address.email ||
      !address.phone ||
      !address.street ||
      !address.city ||
      !address.state ||
      !address.pincode
    ) {
      toast.error("Please fill in all address fields");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (address.phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!validateAddress()) return;
    if (!scriptLoaded) {
      toast.error("Payment system is loading. Please wait...");
      return;
    }

    setProcessing(true);

    try {
      // Create Razorpay order
      const createRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(orderData.error);
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Wellness Point",
        description: `Order of ${items.length} item(s)`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderData: {
                  items: items.map((item) => ({
                    product: item._id,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    quantity: item.quantity,
                  })),
                  shippingAddress: address,
                  subtotal,
                  shipping,
                  discount: 0,
                  total,
                },
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              clearCart();
              toast.success("Order placed successfully!");
              router.push("/dashboard/orders");
            } else {
              toast.error("Payment verification failed");
            }
          } catch {
            toast.error("Something went wrong");
          }
        },
        prefill: {
          name: address.fullName,
          email: address.email || session?.user?.email || "",
          contact: address.phone,
        },
        theme: {
          color: "#16a34a",
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setProcessing(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-wellness-200 border-t-wellness-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Your cart is empty
        </h1>
        <p className="mb-4 text-muted-foreground">Add some products before checkout</p>
        <Link href="/shop">
          <Button variant="wellness">Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/shop"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Continue Shopping
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left – Address */}
        <div className="lg:col-span-2 space-y-6">
          {/* Saved addresses */}
          {savedAddresses.length > 1 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saved Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {savedAddresses.map((a, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      setAddress({
                        fullName: a.fullName,
                        email: a.email || session?.user?.email || "",
                        phone: a.phone,
                        street: a.street,
                        city: a.city,
                        state: a.state,
                        pincode: a.pincode,
                      })
                    }
                    className="rounded-lg border px-3 py-2 text-left text-xs hover:border-wellness-300 hover:bg-wellness-50"
                  >
                    <p className="font-medium">{a.fullName}</p>
                    <p className="text-muted-foreground">
                      {a.city}, {a.state}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Address Form */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-wellness-600" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={address.fullName}
                    onChange={(e) =>
                      setAddress({ ...address, fullName: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Email ID</Label>
                  <Input
                    type="email"
                    value={address.email}
                    onChange={(e) =>
                      setAddress({ ...address, email: e.target.value })
                    }
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={address.phone}
                    onChange={(e) =>
                      setAddress({ ...address, phone: e.target.value })
                    }
                    placeholder="8772485312"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Street Address</Label>
                  <Input
                    value={address.street}
                    onChange={(e) =>
                      setAddress({ ...address, street: e.target.value })
                    }
                    placeholder="123, MG Road, Apt 4B"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={address.city}
                    onChange={(e) =>
                      setAddress({ ...address, city: e.target.value })
                    }
                    placeholder="Bengaluru"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={address.state}
                    onChange={(e) =>
                      setAddress({ ...address, state: e.target.value })
                    }
                    placeholder="Karnataka"
                  />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={address.pincode}
                    onChange={(e) =>
                      setAddress({ ...address, pincode: e.target.value })
                    }
                    placeholder="400001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right – Summary */}
        <div>
          <Card className="sticky top-24 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-5 w-5 text-wellness-600" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-3"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => updateQuantity(item._id, item.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[20px] text-center text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item._id, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground hover:bg-accent hover:text-foreground"
                        disabled={item.quantity >= item.stock}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    ₹{((item.discountPrice || item.price) * item.quantity).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {shipping === 0
                      ? "Free"
                      : `₹${shipping}`}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-wellness-600">
                    Free shipping on orders ₹999+
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-wellness-600 dark:text-wellness-400">
                  ₹{total.toLocaleString("en-IN")}
                </span>
              </div>

              <Button
                variant="wellness"
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={processing}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {processing ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")}`}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Secured by Razorpay. 100% safe & secure.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
