"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, CreditCard, MapPin, ArrowLeft, Minus, Plus, Trash2, Save } from "lucide-react";
import Image from "next/image";
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
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

const emptyAddress: Address = {
  fullName: "",
  email: "",
  phone: "",
  street: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
};

/** Check if the user changed the address from the original saved one */
function isAddressModified(current: Address, original: Address | null): boolean {
  if (!original) return true; // No saved address → treat as "new"
  return (
    current.fullName !== original.fullName ||
    current.phone !== original.phone ||
    current.street !== original.street ||
    current.city !== original.city ||
    current.state !== original.state ||
    current.pincode !== original.pincode
  );
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { items, getSubtotal, clearCart, removeItem, updateQuantity } = useCartStore();

  const STORAGE_KEY = "checkout-address";

  // Restore address from sessionStorage on mount
  const getInitialAddress = (): Address => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { ...emptyAddress };
  };

  const [address, setAddress] = useState<Address>(getInitialAddress);

  // The address fetched from the user's profile (null = no saved address)
  const profileAddressRef = useRef<Address | null>(null);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);

  // Whether user wants to save their (new/edited) address to profile
  const [saveToProfile, setSaveToProfile] = useState(true);

  // Persist address to sessionStorage whenever it changes
  const updateAddress = useCallback((updater: Address | ((prev: Address) => Address)) => {
    setAddress((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [processing, setProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [shippingSettings, setShippingSettings] = useState({
    flatRate: 99,
    freeShippingThreshold: 999,
    enableFreeShipping: true,
  });

  const subtotal = getSubtotal();
  const shipping =
    shippingSettings.enableFreeShipping && subtotal >= shippingSettings.freeShippingThreshold
      ? 0
      : shippingSettings.flatRate;
  const total = subtotal + shipping;

  // Fetch shipping settings from admin config
  useEffect(() => {
    fetch("/api/shipping")
      .then((r) => r.json())
      .then((d) => {
        if (d.flatRate !== undefined) {
          setShippingSettings({
            flatRate: d.flatRate,
            freeShippingThreshold: d.freeShippingThreshold,
            enableFreeShipping: d.enableFreeShipping,
          });
        }
      })
      .catch(() => {});
  }, []);

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

  // Load saved address & profile data (only if no cached form data)
  useEffect(() => {
    if (session) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => {
          const user = d.user || {};
          const addrs = user.addresses || [];
          const savedAddr = addrs[0]; // Only 1 address allowed

          if (savedAddr) {
            setHasSavedAddress(true);
            const mapped: Address = {
              fullName: savedAddr.fullName || user.name || "",
              email: user.email || session?.user?.email || "",
              phone: savedAddr.phone || user.phone || "",
              street: savedAddr.street || "",
              addressLine2: savedAddr.addressLine2 || "",
              city: savedAddr.city || "",
              state: savedAddr.state || "",
              pincode: savedAddr.pincode || "",
            };
            profileAddressRef.current = mapped;

            // Only prefill from saved address if user hasn't already typed something
            const hasCachedData = sessionStorage.getItem(STORAGE_KEY);
            if (!hasCachedData) {
              updateAddress(mapped);
            }
          } else {
            setHasSavedAddress(false);
            profileAddressRef.current = null;

            // No saved address — prefill name/email/phone from profile
            const hasCachedData = sessionStorage.getItem(STORAGE_KEY);
            if (!hasCachedData) {
              updateAddress((prev) => ({
                ...prev,
                fullName: user.name || "",
                email: user.email || session?.user?.email || "",
                phone: user.phone || "",
              }));
            }
          }
        })
        .catch(() => {});
    }
  }, [session, updateAddress]);

  const validateAddress = () => {
    const errors: Record<string, string> = {};
    if (!address.fullName) errors.fullName = "Full name is required";
    else if (!/^[a-zA-Z\s]+$/.test(address.fullName)) errors.fullName = "Only letters and spaces";
    if (!address.email) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) errors.email = "Invalid email address";
    if (!address.phone) errors.phone = "Phone is required";
    else if (!/^\d{10}$/.test(address.phone)) errors.phone = "Must be 10 digits";
    if (!address.street) errors.street = "Address is required";
    if (!address.city) errors.city = "City is required";
    else if (!/^[a-zA-Z\s]+$/.test(address.city)) errors.city = "Only letters";
    if (!address.state) errors.state = "State is required";
    else if (!/^[a-zA-Z\s]+$/.test(address.state)) errors.state = "Only letters";
    if (!address.pincode) errors.pincode = "Pincode is required";
    else if (!/^\d{6}$/.test(address.pincode)) errors.pincode = "Must be 6 digits";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return false;
    }
    return true;
  };

  /** Save the current checkout address to user's profile */
  const saveAddressToProfile = async () => {
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: [
            {
              fullName: address.fullName,
              phone: address.phone,
              street: address.street,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
              isDefault: true,
            },
          ],
        }),
      });
    } catch {
      // Non-critical — don't break the order flow
      console.error("Failed to save address to profile");
    }
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
      // Create Razorpay order — server validates prices & stock
      const createRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            _id: item._id,
            quantity: item.quantity,
          })),
        }),
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
            // Verify payment — server recalculates totals and decrements stock
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
                    quantity: item.quantity,
                  })),
                  shippingAddress: address,
                },
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              // Save address to profile:
              // - First-time order (no saved address) → always save
              // - Returning order with edited address → save only if user opted in
              const addressChanged = isAddressModified(address, profileAddressRef.current);
              if (!hasSavedAddress || (addressChanged && saveToProfile)) {
                await saveAddressToProfile();
              }

              clearCart();
              try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
              toast.success("Order placed successfully!");
              router.push(`/order-confirmation?orderId=${verifyData.order._id}`);
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
          {/* Saved address indicator */}
          {hasSavedAddress && profileAddressRef.current && (
            <div className="flex items-center gap-2 rounded-lg border border-wellness-200 bg-wellness-50/50 px-4 py-2.5 text-sm">
              <MapPin className="h-4 w-4 text-wellness-600 shrink-0" />
              <span className="text-muted-foreground">
                Shipping to <span className="font-medium text-foreground">{profileAddressRef.current.fullName}</span> — {profileAddressRef.current.city}, {profileAddressRef.current.state}
              </span>
            </div>
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
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      updateAddress({ ...address, fullName: val });
                      setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                    }}
                    placeholder="Enter your full name"
                    className={fieldErrors.fullName ? "border-red-500" : ""}
                  />
                  {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>}
                </div>
                <div>
                  <Label>Email ID</Label>
                  <Input
                    type="email"
                    value={address.email}
                    onChange={(e) => {
                      updateAddress({ ...address, email: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    placeholder="Enter your email address"
                    className={fieldErrors.email ? "border-red-500" : ""}
                  />
                  {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={address.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      updateAddress({ ...address, phone: val });
                      setFieldErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="Enter your phone number"
                    className={fieldErrors.phone ? "border-red-500" : ""}
                  />
                  {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={address.street}
                    onChange={(e) => {
                      updateAddress({ ...address, street: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, street: "" }));
                    }}
                    placeholder="Enter your address"
                    className={fieldErrors.street ? "border-red-500" : ""}
                  />
                  {fieldErrors.street && <p className="text-xs text-red-500 mt-1">{fieldErrors.street}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label>Address Line 2 <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                  <Input
                    value={address.addressLine2}
                    onChange={(e) =>
                      updateAddress({ ...address, addressLine2: e.target.value })
                    }
                    placeholder="Apartment, suite, landmark, etc."
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={address.city}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      updateAddress({ ...address, city: val });
                      setFieldErrors((prev) => ({ ...prev, city: "" }));
                    }}
                    placeholder="Enter your city"
                    className={fieldErrors.city ? "border-red-500" : ""}
                  />
                  {fieldErrors.city && <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>}
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={address.state}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      updateAddress({ ...address, state: val });
                      setFieldErrors((prev) => ({ ...prev, state: "" }));
                    }}
                    placeholder="Enter your state"
                    className={fieldErrors.state ? "border-red-500" : ""}
                  />
                  {fieldErrors.state && <p className="text-xs text-red-500 mt-1">{fieldErrors.state}</p>}
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={address.pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      updateAddress({ ...address, pincode: val });
                      setFieldErrors((prev) => ({ ...prev, pincode: "" }));
                    }}
                    placeholder="Enter your pincode"
                    maxLength={6}
                    inputMode="numeric"
                    className={fieldErrors.pincode ? "border-red-500" : ""}
                  />
                  {fieldErrors.pincode && <p className="text-xs text-red-500 mt-1">{fieldErrors.pincode}</p>}
                </div>

                {/* Save address checkbox — shown when user edits an existing saved address */}
                {hasSavedAddress && isAddressModified(address, profileAddressRef.current) && (
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5">
                    <input
                      type="checkbox"
                      id="saveToProfile"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-wellness-600"
                    />
                    <Label htmlFor="saveToProfile" className="mb-0 cursor-pointer text-sm text-muted-foreground">
                      <Save className="mr-1 inline h-3.5 w-3.5" />
                      Update my saved address with this new one
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right – Summary */}
        <div>
          <Card className="sticky top-20 border-0 shadow-sm">
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
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => updateQuantity(item._id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[20px] text-center text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item._id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border text-muted-foreground hover:bg-accent hover:text-foreground"
                        disabled={item.quantity >= item.stock}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="ml-1 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                {shipping > 0 && shippingSettings.enableFreeShipping && (
                  <p className="text-xs text-wellness-600">
                    Free shipping on orders ₹{shippingSettings.freeShippingThreshold.toLocaleString("en-IN")}+
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-wellness-600">
                  ₹{total.toLocaleString("en-IN")}
                </span>
              </div>

              <Button
                variant="wellness"
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={processing || !address.fullName.trim() || !address.email.trim() || !address.phone.trim() || !address.street.trim() || !address.city.trim() || !address.state.trim() || !/^\d{6}$/.test(address.pincode)}
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
